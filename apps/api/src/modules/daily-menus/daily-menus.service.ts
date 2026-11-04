import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateOnly, ensureMenuSchema, menuUnique, normalizeAudience, weekdaysOfMonth } from './menu-audience';
import { parseMenuJson, parseMenuText, ParsedMenu } from './menu-text.parser';

type MenuInput = {
  date: string;
  breakfast?: string;
  midMorning?: string;
  lunch?: string;
  afternoon?: string;
  notes?: string;
  audienceType?: string;
  audienceIds?: unknown;
};

type MealSlot = 'midMorning' | 'lunch';

type EmergencyChangeBody = {
  mode?: 'replace' | 'swap';
  meal?: MealSlot;
  date?: string;
  newValue?: string;
  swapWithDate?: string;
  audienceType?: string;
  audienceIds?: unknown;
};

const MEAL_LABELS: Record<MealSlot, string> = {
  midMorning: 'Δεκατιανό',
  lunch: 'Μεσημεριανό',
};

const AI_PROMPT = `Είσαι βοηθός παιδικού σταθμού. Διάβασε το διατροφολόγιο και επέστρεψε ΜΟΝΟ JSON:
{"month":"yyyy-MM","monthNotes":"","days":[{"date":"yyyy-MM-dd","breakfast":"","midMorning":"","lunch":"","afternoon":""}]}
Κανόνες:
- Δεκατιανό → midMorning, Μεσημεριανό → lunch, Απογευματινό → afternoon, Πρωινό → breakfast.
- Μόνο καθημερινές. Κράτα τα φαγητά στα ελληνικά, όπως είναι γραμμένα.
- Το μπλοκ «Σημειώσεις» (συνοδευτικά μεσημεριανού, απογευματινά ανά ημέρα, ποιότητα, παιδίατρος) βάλε ΟΛΟ στο monthNotes με αλλαγές γραμμής, ΟΧΙ στο κάθε day.
- Το απογευματινό ανά ημέρα βάλε στο afternoon της αντίστοιχης ημέρας.
- Μην επινοείς ημέρες που δεν φαίνονται.`;

@Injectable()
export class DailyMenusService implements OnModuleInit {
  private readonly logger = new Logger(DailyMenusService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureSchema();
  }

  private async ensureSchema() {
    try {
      await ensureMenuSchema((sql) => this.prisma.$executeRawUnsafe(sql));
    } catch (error) {
      this.logger.warn(`Menu schema check skipped: ${error}`);
    }
  }

  async findAll(schoolId: string, from?: string, to?: string, audienceType?: string, audienceIds?: string) {
    await this.ensureSchema();
    try {
    const audience = audienceType ? normalizeAudience(audienceType, audienceIds) : null;
    return this.prisma.dailyMenu.findMany({
      where: {
        schoolId,
        ...(audience ? audience : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: dateOnly(from) } : {}),
                ...(to ? { lte: dateOnly(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error);
      throw new BadRequestException('Το διατροφολόγιο δεν φορτώθηκε. Κάνε ανανέωση και δοκίμασε ξανά.');
    }
  }

  async findByDate(schoolId: string, date: string, audienceType?: string, audienceIds?: string) {
    // Called by: daily-menus.controller findByDate. Adds monthNotes for mobile bottom sheet.
    // User: «οταν πατας πανω να σου εμφανιζει με ενα bottom sheet αναλυτικα ... σημειωσεις»
    const audience = normalizeAudience(audienceType, audienceIds);
    const menu = await this.prisma.dailyMenu.findUnique({
      where: menuUnique(schoolId, dateOnly(date), audience.audienceType, audience.audienceIds),
    });
    if (!menu) throw new NotFoundException('No menu for this date');
    const month = String(date).slice(0, 7);
    const monthNote = await this.getMonthNotes(schoolId, month);
    return { ...menu, monthNotes: monthNote?.notes ?? '' };
  }

  async getMonthNotes(schoolId: string, month: string) {
    await this.ensureSchema();
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Δώσε μήνα σε μορφή yyyy-MM.');
    return this.prisma.dailyMenuMonthNote.findUnique({
      where: { schoolId_month: { schoolId, month } },
    });
  }

  async saveMonthNotes(schoolId: string, month: string, notes: string) {
    await this.ensureSchema();
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Δώσε μήνα σε μορφή yyyy-MM.');
    const text = String(notes ?? '').trim();
    return this.prisma.dailyMenuMonthNote.upsert({
      where: { schoolId_month: { schoolId, month } },
      create: { id: crypto.randomUUID(), schoolId, month, notes: text },
      update: { notes: text },
    });
  }

  async upsert(schoolId: string, data: MenuInput) {
    await this.ensureSchema();
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(data.date || ''))) {
      throw new BadRequestException('Η ημερομηνία της ημέρας δεν είναι έγκυρη.');
    }
    const audience = normalizeAudience(data.audienceType, data.audienceIds);
    const date = dateOnly(data.date);
    const meals = {
      breakfast: data.breakfast ?? null,
      midMorning: data.midMorning ?? null,
      lunch: data.lunch ?? null,
      afternoon: data.afternoon ?? null,
      notes: data.notes ?? null,
    };
    try {
      return await this.prisma.dailyMenu.upsert({
        where: menuUnique(schoolId, date, audience.audienceType, audience.audienceIds),
        create: { schoolId, date, ...audience, ...meals },
        update: meals,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error);
      throw new BadRequestException('Η ημέρα του διατροφολόγιου δεν αποθηκεύτηκε. Δοκίμασε ξανά.');
    }
  }

  async bulkUpsert(
    schoolId: string,
    body: { days?: MenuInput[]; audienceType?: string; audienceIds?: unknown; monthNotes?: string; month?: string },
  ) {
    await this.ensureSchema();
    const days = body.days || [];
    if (!days.length) throw new BadRequestException('Δεν υπάρχουν ημέρες για αποθήκευση.');
    const audience = normalizeAudience(body.audienceType ?? days[0]?.audienceType, body.audienceIds ?? days[0]?.audienceIds);
    const saved = [];
    for (const day of days) {
      if (!day.date) continue;
      saved.push(await this.upsert(schoolId, { ...day, ...audience }));
    }
    const month =
      body.month && /^\d{4}-\d{2}$/.test(body.month)
        ? body.month
        : String(days.find((d) => d.date)?.date || '').slice(0, 7);
    if (month && body.monthNotes != null) {
      await this.saveMonthNotes(schoolId, month, body.monthNotes);
    }
    return { saved: saved.length, days: saved };
  }

  async copyMonth(
    schoolId: string,
    body: { from: string; to: string; audienceType?: string; audienceIds?: unknown },
  ) {
    const audience = normalizeAudience(body.audienceType, body.audienceIds);
    if (!/^\d{4}-\d{2}$/.test(body.from || '') || !/^\d{4}-\d{2}$/.test(body.to || '')) {
      throw new BadRequestException('Δώσε μήνα σε μορφή yyyy-MM.');
    }
    const sourceDays = weekdaysOfMonth(body.from);
    const targetDays = weekdaysOfMonth(body.to);
    const existing = await this.prisma.dailyMenu.findMany({
      where: {
        schoolId,
        ...audience,
        date: { gte: dateOnly(sourceDays[0]), lte: dateOnly(sourceDays[sourceDays.length - 1]) },
      },
      orderBy: { date: 'asc' },
    });
    const byDate = new Map(existing.map((menu) => [menu.date.toISOString().slice(0, 10), menu]));
    let copied = 0;
    for (let i = 0; i < Math.min(sourceDays.length, targetDays.length); i++) {
      const source = byDate.get(sourceDays[i]);
      if (!source) continue;
      await this.upsert(schoolId, {
        date: targetDays[i],
        breakfast: source.breakfast ?? undefined,
        midMorning: source.midMorning ?? undefined,
        lunch: source.lunch ?? undefined,
        afternoon: source.afternoon ?? undefined,
        notes: source.notes ?? undefined,
        ...audience,
      });
      copied++;
    }
    const fromNotes = await this.getMonthNotes(schoolId, body.from);
    // Always overwrite target month notes (including empty) so stale notes do not linger.
    await this.saveMonthNotes(schoolId, body.to, fromNotes?.notes ?? '');
    return { copied, to: body.to };
  }

  async importFile(file?: Express.Multer.File, month?: string) {
    try {
      return await this.readUpload(file, month);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(error);
      throw new BadRequestException('Το διατροφολόγιο δεν διαβάστηκε. Δοκίμασε JPG ή PDF μέχρι 20 MB.');
    }
  }

  private async readUpload(file?: Express.Multer.File, month?: string) {
    if (!file?.buffer?.length) throw new BadRequestException('Διάλεξε αρχείο JPG, PNG ή PDF.');
    const name = (file.originalname || '').toLowerCase();
    const mime = file.mimetype || '';
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    const isImage = /^image\/(jpeg|png|webp|jpg)$/.test(mime) || /\.(jpe?g|png|webp)$/.test(name);
    if (!isPdf && !isImage) throw new BadRequestException('Γίνονται δεκτά μόνο JPG, PNG, WEBP ή PDF.');

    const text = isPdf ? await this.extractPdfText(file.buffer) : '';
    const heuristic = text.trim().length > 40 ? parseMenuText(text, month) : null;
    if (heuristic && heuristic.days.length >= 8) {
      return { ...heuristic, warnings: [...heuristic.warnings, 'Η ανάγνωση έγινε από το κείμενο του PDF.'] };
    }

    let parsed: ParsedMenu | null = null;
    if (process.env.OPENAI_API_KEY) {
      try {
        parsed = await this.analyzeWithAi({
          text: text || undefined,
          image: isImage ? file.buffer.toString('base64') : undefined,
          pdf: isPdf ? file.buffer.toString('base64') : undefined,
          mime: isImage ? (mime || 'image/jpeg') : mime,
          month,
        });
      } catch (error) {
        if (heuristic?.days.length) parsed = heuristic;
        else throw error;
      }
    } else if (heuristic?.days.length) {
      parsed = heuristic;
    } else if (isImage) {
      throw new BadRequestException('Για φωτογραφία χρειάζεται το OPENAI_API_KEY στον server. Τα PDF με κείμενο διαβάζονται και χωρίς αυτό.');
    }

    if (parsed && !parsed.days.length && heuristic?.days.length) parsed = heuristic;
    if (!parsed?.days.length) {
      throw new BadRequestException(parsed?.warnings?.[0] || heuristic?.warnings?.[0] || 'Δεν αναγνωρίστηκε διατροφολόγιο στο αρχείο.');
    }
    return parsed;
  }

  async emergencyChange(schoolId: string, body: EmergencyChangeBody) {
    await this.ensureSchema();
    const mode = body.mode === 'swap' ? 'swap' : 'replace';
    if (body.meal !== 'midMorning' && body.meal !== 'lunch') {
      throw new BadRequestException('Διάλεξε δεκατιανό ή μεσημεριανό.');
    }
    const meal: MealSlot = body.meal;
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(body.date || ''))) {
      throw new BadRequestException('Διάλεξε ημερομηνία.');
    }
    const audience = normalizeAudience(body.audienceType, body.audienceIds);
    const date = String(body.date).slice(0, 10);
    const mealLabel = MEAL_LABELS[meal];

    if (mode === 'replace') {
      const newValue = String(body.newValue ?? '').trim();
      if (!newValue) throw new BadRequestException('Γράψε με τι θα αντικατασταθεί το γεύμα.');
      const existing = await this.prisma.dailyMenu.findUnique({
        where: menuUnique(schoolId, dateOnly(date), audience.audienceType, audience.audienceIds),
      });
      const previous = (existing?.[meal] ?? '').trim() || '—';
      const updated = await this.upsert(schoolId, {
        date,
        breakfast: existing?.breakfast ?? undefined,
        midMorning: meal === 'midMorning' ? newValue : (existing?.midMorning ?? undefined),
        lunch: meal === 'lunch' ? newValue : (existing?.lunch ?? undefined),
        afternoon: existing?.afternoon ?? undefined,
        notes: existing?.notes ?? undefined,
        ...audience,
      });
      const dateLabel = this.formatGreekDate(date);
      const bodyText = previous === '—'
        ? `${mealLabel} ${dateLabel}: ${newValue}.`
        : `${mealLabel} ${dateLabel}: αντί για «${previous}» → «${newValue}».`;
      await this.notifyMenuChange(schoolId, audience.audienceType, audience.audienceIds, {
        title: 'Έκτακτη αλλαγή διατροφολόγιου',
        body: bodyText,
        date,
        meal,
        mode,
      });
      return { mode, meal, date, previous, next: newValue, days: [updated] };
    }

    const swapWith = String(body.swapWithDate || this.nextWeekday(date)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(swapWith)) {
      throw new BadRequestException('Διάλεξε τη δεύτερη ημερομηνία για ανταλλαγή.');
    }
    if (swapWith === date) throw new BadRequestException('Διάλεξε δύο διαφορετικές ημέρες.');

    const a = await this.prisma.dailyMenu.findUnique({
      where: menuUnique(schoolId, dateOnly(date), audience.audienceType, audience.audienceIds),
    });
    const b = await this.prisma.dailyMenu.findUnique({
      where: menuUnique(schoolId, dateOnly(swapWith), audience.audienceType, audience.audienceIds),
    });
    const valueA = (a?.[meal] ?? '').trim();
    const valueB = (b?.[meal] ?? '').trim();
    if (!valueA && !valueB) {
      throw new BadRequestException('Καμία από τις δύο ημέρες δεν έχει καταχωρημένο αυτό το γεύμα.');
    }

    const mealsFor = (
      row: { breakfast?: string | null; midMorning?: string | null; lunch?: string | null; afternoon?: string | null; notes?: string | null } | null,
      slotValue: string,
    ) => ({
      breakfast: row?.breakfast ?? undefined,
      midMorning: meal === 'midMorning' ? (slotValue || undefined) : (row?.midMorning ?? undefined),
      lunch: meal === 'lunch' ? (slotValue || undefined) : (row?.lunch ?? undefined),
      afternoon: row?.afternoon ?? undefined,
      notes: row?.notes ?? undefined,
    });

    const updatedA = await this.upsert(schoolId, { date, ...mealsFor(a, valueB), ...audience });
    const updatedB = await this.upsert(schoolId, { date: swapWith, ...mealsFor(b, valueA), ...audience });

    const bodyText =
      `Ανταλλαγή ${mealLabel.toLowerCase()}: ${this.formatGreekDate(date)} («${valueA || '—'}») ↔ ` +
      `${this.formatGreekDate(swapWith)} («${valueB || '—'}»).`;
    await this.notifyMenuChange(schoolId, audience.audienceType, audience.audienceIds, {
      title: 'Έκτακτη αλλαγή διατροφολόγιου',
      body: bodyText,
      date,
      meal,
      mode,
      swapWithDate: swapWith,
    });
    return {
      mode,
      meal,
      date,
      swapWithDate: swapWith,
      previous: valueA || '—',
      next: valueB || '—',
      days: [updatedA, updatedB],
    };
  }

  private nextWeekday(isoDate: string): string {
    const base = dateOnly(isoDate);
    for (let i = 1; i <= 7; i++) {
      const next = new Date(base);
      next.setUTCDate(base.getUTCDate() + i);
      const dow = next.getUTCDay();
      if (dow !== 0 && dow !== 6) return next.toISOString().slice(0, 10);
    }
    throw new BadRequestException('Δεν βρέθηκε επόμενη εργάσιμη ημέρα.');
  }

  private formatGreekDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  private async notifyMenuChange(
    schoolId: string,
    audienceType: string,
    audienceIdsJson: string,
    payload: {
      title: string;
      body: string;
      date: string;
      meal: MealSlot;
      mode: string;
      swapWithDate?: string;
    },
  ) {
    const userIds = await this.menuRecipientIds(schoolId, audienceType, audienceIdsJson);
    if (!userIds.length) return;
    await this.notifications.notifyUsers(schoolId, userIds, {
      event: 'menu_change',
      type: 'menu_change',
      title: payload.title,
      body: payload.body,
      data: {
        screen: 'menu',
        date: payload.date,
        meal: payload.meal,
        mode: payload.mode,
        ...(payload.swapWithDate ? { swapWithDate: payload.swapWithDate } : {}),
      },
    });
  }

  private async menuRecipientIds(schoolId: string, audienceType: string, audienceIdsJson: string) {
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(audienceIdsJson || '[]');
      if (Array.isArray(parsed)) ids = parsed.map(String);
    } catch {
      ids = [];
    }
    if (audienceType === 'teachers') {
      const members = await this.prisma.schoolMember.findMany({
        where: { schoolId, role: 'teacher', isActive: true },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    }
    const parents = await this.prisma.studentParent.findMany({
      where: {
        student: {
          schoolId,
          isActive: true,
          ...(audienceType === 'class' ? { enrollments: { some: { classId: { in: ids } } } } : {}),
          ...(audienceType === 'level' ? { enrollments: { some: { class: { levelId: { in: ids } } } } } : {}),
        },
      },
      select: { userId: true },
    });
    return [...new Set(parents.map((parent) => parent.userId))];
  }

  async clearMonth(schoolId: string, month: string, audienceType?: string, audienceIds?: unknown) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Δώσε μήνα σε μορφή yyyy-MM.');
    const audience = normalizeAudience(audienceType, audienceIds);
    const start = dateOnly(`${month}-01`);
    const end = dateOnly(`${month}-31`);
    const result = await this.prisma.dailyMenu.deleteMany({
      where: {
        schoolId,
        ...audience,
        date: { gte: start, lte: end },
      },
    });
    // Month notes are school-wide; only clear them when wiping the school-wide (all) audience.
    if (audience.audienceType === 'all') {
      await this.prisma.dailyMenuMonthNote.deleteMany({ where: { schoolId, month } });
    }
    return { deleted: result.count };
  }

  async remove(id: string) {
    await this.prisma.dailyMenu.delete({ where: { id } });
  }

  private async extractPdfText(buffer: Buffer) {
    try {
      const loadPdfjs = new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")') as () => Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>;
      const pdfjs = await loadPdfjs();
      const loading = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        isEvalSupported: false,
      } as any);
      const doc = await loading.promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      }
      await doc.destroy();
      return pages.join('\n');
    } catch (error) {
      this.logger.warn(`PDF text extraction failed: ${(error as Error)?.message || error}`);
      return '';
    }
  }

  private async analyzeWithAi(input: { text?: string; image?: string; pdf?: string; mime?: string; month?: string }): Promise<ParsedMenu> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new BadRequestException(
        input.image
          ? 'Για φωτογραφία χρειάζεται το OPENAI_API_KEY στον server. Τα PDF με κείμενο διαβάζονται και χωρίς αυτό.'
          : 'Δεν αναγνωρίστηκε το PDF. Πρόσθεσε OPENAI_API_KEY για ανάγνωση με AI ή ανέβασε PDF με επιλέξιμο κείμενο.',
      );
    }
    const content: any[] = [{ type: 'text', text: `${AI_PROMPT}\nΜήνας αναφοράς: ${input.month || 'όπως φαίνεται στο αρχείο'}` }];
    if (input.text) content.push({ type: 'text', text: input.text.slice(0, 20000) });
    if (input.image) {
      content.push({ type: 'image_url', image_url: { url: `data:${input.mime || 'image/jpeg'};base64,${input.image}` } });
    }
    if (input.pdf) {
      content.push({ type: 'file', file: { filename: 'menu.pdf', file_data: `data:application/pdf;base64,${input.pdf}` } });
    }
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content }],
        }),
      });
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException('Η ανάλυση με AI δεν ολοκληρώθηκε. Δοκίμασε ξανά ή συμπλήρωσε τις ημέρες χειροκίνητα.');
    }
    if (!response.ok) {
      this.logger.warn(`Menu AI status ${response.status}`);
      throw new BadRequestException('Η ανάλυση με AI δεν ολοκληρώθηκε. Δοκίμασε ξανά ή συμπλήρωσε τις ημέρες χειροκίνητα.');
    }
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content || '';
    const parsed = parseMenuJson(text, input.month);
    return { ...parsed, warnings: [...parsed.warnings, 'Η συμπλήρωση έγινε με AI. Έλεγξε τις ημέρες πριν την αποθήκευση.'] };
  }
}

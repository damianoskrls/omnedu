import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

const AI_PROMPT = `Είσαι βοηθός παιδικού σταθμού. Διάβασε το διατροφολόγιο και επέστρεψε ΜΟΝΟ JSON:
{"month":"yyyy-MM","days":[{"date":"yyyy-MM-dd","breakfast":"","midMorning":"","lunch":"","afternoon":"","notes":""}]}
Κανόνες:
- Δεκατιανό → midMorning, Μεσημεριανό → lunch, Απογευματινό → afternoon, Πρωινό → breakfast.
- Μόνο καθημερινές. Κράτα τα φαγητά στα ελληνικά, όπως είναι γραμμένα.
- Αν η σημείωση λέει ότι κάθε μεσημέρι έχει ψωμάκι, τυράκι, σαλάτα και φρούτο, βάλε το στο notes και το απογευματινό ανά ημέρα στο afternoon.
- Μην επινοείς ημέρες που δεν φαίνονται.`;

@Injectable()
export class DailyMenusService implements OnModuleInit {
  private readonly logger = new Logger(DailyMenusService.name);

  constructor(private prisma: PrismaService) {}

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
    const audience = normalizeAudience(audienceType, audienceIds);
    const menu = await this.prisma.dailyMenu.findUnique({
      where: menuUnique(schoolId, dateOnly(date), audience.audienceType, audience.audienceIds),
    });
    if (!menu) throw new NotFoundException('No menu for this date');
    return menu;
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

  async bulkUpsert(schoolId: string, body: { days?: MenuInput[]; audienceType?: string; audienceIds?: unknown }) {
    await this.ensureSchema();
    const days = body.days || [];
    if (!days.length) throw new BadRequestException('Δεν υπάρχουν ημέρες για αποθήκευση.');
    const audience = normalizeAudience(body.audienceType ?? days[0]?.audienceType, body.audienceIds ?? days[0]?.audienceIds);
    const saved = [];
    for (const day of days) {
      if (!day.date) continue;
      saved.push(await this.upsert(schoolId, { ...day, ...audience }));
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

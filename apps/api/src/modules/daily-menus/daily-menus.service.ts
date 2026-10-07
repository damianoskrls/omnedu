import { createRequire } from 'module';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly, menuUnique, normalizeAudience, weekdaysOfMonth } from './menu-audience';
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

const nodeRequire = createRequire(__filename);

const AI_PROMPT = `Είσαι βοηθός παιδικού σταθμού. Διάβασε το διατροφολόγιο και επέστρεψε ΜΟΝΟ JSON:
{"month":"yyyy-MM","days":[{"date":"yyyy-MM-dd","breakfast":"","midMorning":"","lunch":"","afternoon":"","notes":""}]}
Κανόνες:
- Δεκατιανό → midMorning, Μεσημεριανό → lunch, Απογευματινό → afternoon, Πρωινό → breakfast.
- Μόνο καθημερινές. Κράτα τα φαγητά στα ελληνικά, όπως είναι γραμμένα.
- Αν η σημείωση λέει ότι κάθε μεσημέρι έχει ψωμάκι, τυράκι, σαλάτα και φρούτο, βάλε το στο notes και το απογευματινό ανά ημέρα στο afternoon.
- Μην επινοείς ημέρες που δεν φαίνονται.`;

@Injectable()
export class DailyMenusService {
  constructor(private prisma: PrismaService) {}

  async findAll(schoolId: string, from?: string, to?: string, audienceType?: string, audienceIds?: string) {
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
    const audience = normalizeAudience(data.audienceType, data.audienceIds);
    const date = dateOnly(data.date);
    const meals = {
      breakfast: data.breakfast ?? null,
      midMorning: data.midMorning ?? null,
      lunch: data.lunch ?? null,
      afternoon: data.afternoon ?? null,
      notes: data.notes ?? null,
    };
    return this.prisma.dailyMenu.upsert({
      where: menuUnique(schoolId, date, audience.audienceType, audience.audienceIds),
      create: { schoolId, date, ...audience, ...meals },
      update: meals,
    });
  }

  async bulkUpsert(schoolId: string, body: { days?: MenuInput[]; audienceType?: string; audienceIds?: unknown }) {
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
    if (!file) throw new BadRequestException('Διάλεξε αρχείο JPG, PNG ή PDF.');
    const mime = file.mimetype;
    const isPdf = mime === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    const isImage = /^image\/(jpeg|png|webp)$/.test(mime);
    if (!isPdf && !isImage) throw new BadRequestException('Γίνονται δεκτά μόνο JPG, PNG, WEBP ή PDF.');

    let parsed: ParsedMenu | null = null;
    if (isPdf) {
      const text = await this.extractPdfText(file.buffer);
      if (text.trim().length > 40) {
        const heuristic = parseMenuText(text, month);
        if (heuristic.days.length >= 8) parsed = { ...heuristic, warnings: [...heuristic.warnings, 'Η ανάγνωση έγινε από το κείμενο του PDF.'] };
        else if (process.env.OPENAI_API_KEY) parsed = await this.analyzeWithAi({ text, month });
        else if (heuristic.days.length) parsed = heuristic;
      }
    }
    if (!parsed) parsed = await this.analyzeWithAi({
      text: isPdf ? await this.extractPdfText(file.buffer) : undefined,
      image: isImage ? file.buffer.toString('base64') : undefined,
      mime,
      month,
    });
    if (!parsed.days.length) {
      throw new BadRequestException(parsed.warnings[0] || 'Δεν αναγνωρίστηκε διατροφολόγιο στο αρχείο.');
    }
    return parsed;
  }

  async remove(id: string) {
    await this.prisma.dailyMenu.delete({ where: { id } });
  }

  private async extractPdfText(buffer: Buffer) {
    try {
      const pdfParse = nodeRequire('pdf-parse/lib/pdf-parse.js');
      const result = await pdfParse(buffer);
      return String(result?.text || '');
    } catch {
      return '';
    }
  }

  private async analyzeWithAi(input: { text?: string; image?: string; mime?: string; month?: string }): Promise<ParsedMenu> {
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      }),
    });
    if (!response.ok) {
      throw new BadRequestException('Η ανάλυση με AI δεν ολοκληρώθηκε. Δοκίμασε ξανά ή συμπλήρωσε τις ημέρες χειροκίνητα.');
    }
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content || '';
    const parsed = parseMenuJson(text, input.month);
    return { ...parsed, warnings: [...parsed.warnings, 'Η συμπλήρωση έγινε με AI. Έλεγξε τις ημέρες πριν την αποθήκευση.'] };
  }
}

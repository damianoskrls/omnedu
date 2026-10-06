export type ParsedMenuDay = {
  date: string;
  breakfast?: string;
  midMorning?: string;
  lunch?: string;
  afternoon?: string;
  notes?: string;
};

export type ParsedMenu = {
  month?: string;
  days: ParsedMenuDay[];
  warnings: string[];
};

const MONTHS: [string, number][] = [
  ['ιανουαρ', 1],
  ['φεβρουαρ', 2],
  ['μαρτ', 3],
  ['απριλ', 4],
  ['μαι', 5],
  ['μαϊ', 5],
  ['ιουν', 6],
  ['ιουλ', 7],
  ['αυγουσ', 8],
  ['σεπτεμβ', 9],
  ['οκτωβ', 10],
  ['νοεμβ', 11],
  ['δεκεμβ', 12],
];

const WEEKDAY: Record<string, number> = {
  δευτερα: 1,
  τριτη: 2,
  τεταρτη: 3,
  πεμπτη: 4,
  παρασκευη: 5,
};

const DEFAULT_AFTERNOON: Record<number, string> = {
  1: 'Φρουτοσαλάτα εποχής (μήλο-αχλάδι-μπανάνα)',
  2: 'Ψωμάκι με τυράκι',
  3: 'Φρουτοσαλάτα εποχής (μήλο-αχλάδι-μπανάνα)',
  4: 'Τοστ ψωμάκι με ταχίνι',
  5: 'Δημητριακά',
};

const LUNCH_SIDE = 'Στο μεσημεριανό σερβίρεται και ψωμάκι, τυράκι, σαλάτα και φρούτο εποχής.';

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ')
    .toLowerCase();
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^[,:;\-–]+|[,:;\-–]+$/g, '').trim();
}

function capitalize(value: string) {
  const text = clean(value);
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('el') + text.slice(1);
}

function detectMonth(text: string, fallback?: string): string | undefined {
  const folded = fold(text);
  const yearMatch = folded.match(/\b(20\d{2})\b/);
  const year = yearMatch?.[1] || fallback?.slice(0, 4);
  const month = MONTHS.find(([name]) => folded.includes(name))?.[1];
  if (year && month) return `${year}-${String(month).padStart(2, '0')}`;
  return fallback?.slice(0, 7);
}

function weekdayOf(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function parseAfternoons(noteBlock: string): Record<number, string> {
  const found: Record<number, string> = {};
  const compact = noteBlock.replace(/\s+/g, ' ');
  const re = /(Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή)\s*:\s*([^,]+?)(?=(?:Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή)\s*:|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(compact))) {
    const day = WEEKDAY[fold(match[1])];
    const meal = capitalize(match[2]);
    if (day && meal) found[day] = meal;
  }
  return Object.keys(found).length ? found : DEFAULT_AFTERNOON;
}

function mealField(block: string, label: string) {
  const labels = ['Πρωινό', 'Δεκατιανό', 'Μεσημεριανό', 'Απογευματινό', 'Σημείωση'];
  const next = labels.filter((item) => fold(item) !== fold(label)).join('|');
  const re = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=(?:${next})\\s*:|$)`, 'i');
  const match = block.match(re);
  return match ? capitalize(match[1]) : '';
}

export function parseMenuText(raw: string, fallbackMonth?: string): ParsedMenu {
  const warnings: string[] = [];
  const text = raw.replace(/\u00a0/g, ' ').replace(/\r/g, '');
  const month = detectMonth(text, fallbackMonth);
  if (!month) warnings.push('Δεν αναγνωρίστηκε μήνας. Διάλεξε μήνα πριν την αποθήκευση.');

  const noteIndex = fold(text).search(/σημειωση/);
  const body = noteIndex >= 0 ? text.slice(0, noteIndex) : text;
  const noteBlock = noteIndex >= 0 ? text.slice(noteIndex) : '';
  const afternoons = parseAfternoons(noteBlock);
  const mentionsLunchSide = /ψωμακι/.test(fold(noteBlock)) && /φρουτο/.test(fold(noteBlock));
  const notes = [
    mentionsLunchSide ? LUNCH_SIDE : '',
    'Απογευματινό για τα παιδιά που μένουν μετά τις 15:30.',
  ].filter(Boolean).join(' ');

  const header = /(Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή)\s+(\d{1,2})/gi;
  const hits: { index: number; end: number; weekday: number; day: number }[] = [];
  let hit: RegExpExecArray | null;
  while ((hit = header.exec(body))) {
    hits.push({
      index: hit.index,
      end: header.lastIndex,
      weekday: WEEKDAY[fold(hit[1])],
      day: Number(hit[2]),
    });
  }

  const days: ParsedMenuDay[] = [];
  hits.forEach((item, index) => {
    const block = body.slice(item.end, hits[index + 1]?.index ?? body.length);
    const midMorning = mealField(block, 'Δεκατιανό') || mealField(block, 'Πρωινό');
    const lunch = mealField(block, 'Μεσημεριανό');
    const breakfast = mealField(block, 'Πρωινό');
    const afternoon = mealField(block, 'Απογευματινό') || afternoons[item.weekday] || '';
    if (!month || item.day < 1 || item.day > 31) return;
    const date = `${month}-${String(item.day).padStart(2, '0')}`;
    const actual = weekdayOf(date);
    if (actual !== item.weekday) {
      warnings.push(`Η ${item.day} δεν πέφτει στην ημέρα που γράφει το αρχείο.`);
    }
    if (actual === 6 || actual === 7) return;
    if (!midMorning && !lunch && !breakfast) return;
    days.push({
      date,
      breakfast: breakfast && breakfast !== midMorning ? breakfast : undefined,
      midMorning: midMorning || undefined,
      lunch: lunch || undefined,
      afternoon: afternoon || undefined,
      notes: notes || undefined,
    });
  });

  if (!days.length) warnings.push('Δεν βρέθηκαν ημέρες με δεκατιανό ή μεσημεριανό.');
  return { month, days, warnings };
}

export function parseMenuJson(raw: string, fallbackMonth?: string): ParsedMenu {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { days: [], warnings: ['Η απάντηση της ανάλυσης δεν είχε πρόγραμμα.'] };
  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { days: [], warnings: ['Η απάντηση της ανάλυσης δεν διαβάστηκε.'] };
  }
  const month = typeof parsed.month === 'string' ? parsed.month.slice(0, 7) : fallbackMonth;
  const rows = Array.isArray(parsed.days) ? parsed.days : [];
  const days: ParsedMenuDay[] = rows
    .map((row: any) => {
      const day = Number(row.day || String(row.date || '').slice(-2));
      const date = typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.date)
        ? row.date.slice(0, 10)
        : month && day
          ? `${month}-${String(day).padStart(2, '0')}`
          : '';
      return {
        date,
        breakfast: clean(row.breakfast || '') || undefined,
        midMorning: clean(row.midMorning || row.snack || '') || undefined,
        lunch: clean(row.lunch || '') || undefined,
        afternoon: clean(row.afternoon || '') || undefined,
        notes: clean(row.notes || '') || undefined,
      };
    })
    .filter((row: ParsedMenuDay) => row.date && (row.midMorning || row.lunch || row.breakfast || row.afternoon));
  return { month, days, warnings: days.length ? [] : ['Δεν βρέθηκαν ημέρες στο αρχείο.'] };
}

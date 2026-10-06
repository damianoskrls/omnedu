export const MENU_AUDIENCES = ['all', 'class', 'level', 'teachers'] as const;

export function normalizeAudience(type?: string, ids?: unknown) {
  const audienceType = (MENU_AUDIENCES as readonly string[]).includes(type || '') ? type! : 'all';
  let list: string[] = [];
  if (typeof ids === 'string') {
    const trimmed = ids.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed.map(String);
      } catch {
        list = [];
      }
    } else if (trimmed) {
      list = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else if (Array.isArray(ids)) {
    list = ids.map(String).filter(Boolean);
  }
  if (audienceType === 'all' || audienceType === 'teachers') list = [];
  list = [...new Set(list)].sort();
  return { audienceType, audienceIds: JSON.stringify(list) };
}

export function menuUnique(schoolId: string, date: Date, audienceType: string, audienceIds: string) {
  return {
    schoolId_date_audienceType_audienceIds: { schoolId, date, audienceType, audienceIds },
  };
}

export function dateOnly(isoDate: string) {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

export function weekdaysOfMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return [];
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    const dow = new Date(Date.UTC(year, mon - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

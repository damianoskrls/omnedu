export const MENU_AUDIENCES = ['all', 'class', 'level', 'teachers'] as const;

const MENU_SCHEMA = [
  `ALTER TABLE "daily_menus" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all'`,
  `ALTER TABLE "daily_menus" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]'`,
  `DROP INDEX IF EXISTS "daily_menus_school_id_date_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "daily_menus_school_id_date_audience_type_audience_ids_key" ON "daily_menus"("school_id", "date", "audience_type", "audience_ids")`,
  `ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'week'`,
  `ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "source_month" TEXT`,
  `ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all'`,
  `ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]'`,
  // Called by: DailyMenusService.ensureSchema. Extends existing menu-audience.ts.
  // Schema: daily_menu_month_notes (school_id, month yyyy-MM, notes).
  // User: «εκει θα πρεπει να μπορει να κανει και edit τις σημειωσεις γτ κατα το ανεβασμα εχουν λαθει»
  `CREATE TABLE IF NOT EXISTS "daily_menu_month_notes" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_menu_month_notes_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "daily_menu_month_notes_school_id_month_key" ON "daily_menu_month_notes"("school_id", "month")`,
  `DO $$ BEGIN
    ALTER TABLE "daily_menu_month_notes"
      ADD CONSTRAINT "daily_menu_month_notes_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
];

export async function ensureMenuSchema(execute: (sql: string) => Promise<unknown>) {
  for (const sql of MENU_SCHEMA) {
    try {
      await execute(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists|duplicate/i.test(message)) throw error;
    }
  }
}

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

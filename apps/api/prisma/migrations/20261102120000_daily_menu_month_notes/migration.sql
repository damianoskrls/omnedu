-- Called by: prisma migrate deploy (apps/api). Schema model DailyMenuMonthNote @@map("daily_menu_month_notes").
-- No existing migration creates this table (grep migrations: only attendance + menu audience). Runtime ensureMenuSchema also creates it.
-- Schema writes: id, school_id, month (yyyy-MM), notes TEXT. FK → schools(id).
-- User: «αυτο θα αλλαζει ανα μηνα οταν ανεβαζει ο διαχειριστης το διατροφολογιο. οποτε εκει θα πρεπει να μπορει να κανει και edit τις σημειωσεις γτ κατα το ανεβασμα εχουν λαθει»
CREATE TABLE IF NOT EXISTS "daily_menu_month_notes" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_menu_month_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_menu_month_notes_school_id_month_key"
  ON "daily_menu_month_notes"("school_id", "month");

DO $$ BEGIN
  ALTER TABLE "daily_menu_month_notes"
    ADD CONSTRAINT "daily_menu_month_notes_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

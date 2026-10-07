ALTER TABLE "daily_menus" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "daily_menus" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]';
DROP INDEX IF EXISTS "daily_menus_school_id_date_key";
CREATE UNIQUE INDEX IF NOT EXISTS "daily_menus_school_id_date_audience_type_audience_ids_key"
  ON "daily_menus"("school_id", "date", "audience_type", "audience_ids");

ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'week';
ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "source_month" TEXT;
ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "menu_templates" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]';

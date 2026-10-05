-- Menu templates
CREATE TABLE "menu_templates" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "school_id"   TEXT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "menu_templates_school_id_idx" ON "menu_templates"("school_id");

CREATE TABLE "menu_template_entries" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "template_id" TEXT NOT NULL REFERENCES "menu_templates"("id") ON DELETE CASCADE,
  "day_of_week" INTEGER NOT NULL,
  "breakfast"   TEXT,
  "mid_morning" TEXT,
  "lunch"       TEXT,
  "afternoon"   TEXT,
  "notes"       TEXT,
  CONSTRAINT "menu_template_entries_template_id_day_of_week_key" UNIQUE ("template_id", "day_of_week")
);

-- Notification broadcasts
CREATE TABLE "notification_broadcasts" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "school_id"        TEXT NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "title"            TEXT NOT NULL,
  "body"             TEXT NOT NULL,
  "target_type"      TEXT NOT NULL,
  "target_class_id"  TEXT REFERENCES "classes"("id"),
  "sent_by_user_id"  TEXT NOT NULL REFERENCES "users"("id"),
  "recipient_count"  INTEGER NOT NULL DEFAULT 0,
  "sent_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notification_broadcasts_school_id_sent_at_idx" ON "notification_broadcasts"("school_id", "sent_at" DESC);

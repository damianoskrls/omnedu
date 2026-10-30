ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "parent_to_teacher_messaging_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "teacher_to_parent_messaging_enabled" BOOLEAN NOT NULL DEFAULT true;

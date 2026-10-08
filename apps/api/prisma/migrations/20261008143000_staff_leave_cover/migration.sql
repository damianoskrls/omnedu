ALTER TABLE "teacher_profiles" ADD COLUMN IF NOT EXISTS "annual_leave_days" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "teacher_absences" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "teacher_absences" ADD COLUMN IF NOT EXISTS "substitute_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "teacher_absences_school_id_substitute_user_id_date_idx"
  ON "teacher_absences"("school_id", "substitute_user_id", "date");

DO $$ BEGIN
  ALTER TABLE "teacher_absences"
    ADD CONSTRAINT "teacher_absences_substitute_user_id_fkey"
    FOREIGN KEY ("substitute_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

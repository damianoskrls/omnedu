-- Called by: prisma migrate deploy (apps/api). No prior attendance_records migration exists (grep: only schema AttendanceRecord).
-- Schema: creates attendance_records (school_id, class_id, student_id, date, status, marked_by_id).
-- User: «θελω ο εκπαιδευτικός οταν μπαινει στην εφαρμογη του να εχει και παρουσιολογιο περα απο ημερησια ενημερωση»
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "class_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "marked_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_student_id_date_key"
  ON "attendance_records"("student_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_records_school_id_class_id_date_idx"
  ON "attendance_records"("school_id", "class_id", "date");

DO $$ BEGIN
  ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_marked_by_id_fkey"
    FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

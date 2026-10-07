CREATE TABLE IF NOT EXISTS "teacher_absences" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "teacher_user_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "note" TEXT,
  "academic_year" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_absences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_absences_school_id_teacher_user_id_date_key"
  ON "teacher_absences"("school_id", "teacher_user_id", "date");

CREATE INDEX IF NOT EXISTS "teacher_absences_school_id_academic_year_idx"
  ON "teacher_absences"("school_id", "academic_year");

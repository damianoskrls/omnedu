CREATE TABLE "student_documents" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "academic_year" TEXT,
  "title" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_type" TEXT,
  "file_size" INTEGER,
  "category" TEXT NOT NULL DEFAULT 'other',
  "notes" TEXT,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_documents_student_id_academic_year_idx" ON "student_documents"("student_id", "academic_year");
CREATE INDEX "student_documents_school_id_idx" ON "student_documents"("school_id");

ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

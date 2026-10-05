CREATE TABLE "student_siblings" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "sibling_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_siblings_student_id_sibling_id_key" ON "student_siblings"("student_id","sibling_id");
CREATE INDEX "student_siblings_student_id_idx" ON "student_siblings"("student_id");
CREATE INDEX "student_siblings_sibling_id_idx" ON "student_siblings"("sibling_id");
ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_siblings" ADD CONSTRAINT "student_siblings_sibling_id_fkey"
  FOREIGN KEY ("sibling_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

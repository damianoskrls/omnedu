-- Add annual fee to level_fees
ALTER TABLE "level_fees" ADD COLUMN IF NOT EXISTS "annual_fee" DECIMAL(10,2);

-- One-time charges (excursions, annual enrollment fee, etc.)
CREATE TABLE IF NOT EXISTS "one_time_charges" (
  "id"           TEXT NOT NULL,
  "school_id"    TEXT NOT NULL,
  "student_id"   TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "amount"       DECIMAL(10,2) NOT NULL,
  "charge_date"  DATE NOT NULL,
  "paid_amount"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status"       TEXT NOT NULL DEFAULT 'unpaid',
  "paid_at"      TIMESTAMP(3),
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "one_time_charges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "one_time_charges_school_id_status_idx" ON "one_time_charges"("school_id", "status");
CREATE INDEX "one_time_charges_student_id_idx" ON "one_time_charges"("student_id");
ALTER TABLE "one_time_charges" ADD CONSTRAINT "one_time_charges_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "one_time_charges" ADD CONSTRAINT "one_time_charges_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

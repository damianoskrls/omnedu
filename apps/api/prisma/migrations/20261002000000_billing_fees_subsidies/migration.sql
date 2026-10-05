-- Level fees (monthly tuition per level)
CREATE TABLE IF NOT EXISTS "level_fees" (
  "id"            TEXT NOT NULL,
  "school_id"     TEXT NOT NULL,
  "level_id"      TEXT NOT NULL,
  "monthly_fee"   DECIMAL(10,2) NOT NULL,
  "academic_year" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "level_fees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "level_fees_level_id_academic_year_key" UNIQUE ("level_id", "academic_year")
);
ALTER TABLE "level_fees" ADD CONSTRAINT "level_fees_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "level_fees" ADD CONSTRAINT "level_fees_level_id_fkey"
  FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-student fee overrides (discount % or flat amount)
CREATE TABLE IF NOT EXISTS "student_fee_overrides" (
  "id"             TEXT NOT NULL,
  "school_id"      TEXT NOT NULL,
  "student_id"     TEXT NOT NULL,
  "discount_pct"   DECIMAL(5,2),
  "fixed_amount"   DECIMAL(10,2),
  "reason"         TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_fee_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_fee_overrides_student_id_key" UNIQUE ("student_id")
);
ALTER TABLE "student_fee_overrides" ADD CONSTRAINT "student_fee_overrides_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_fee_overrides" ADD CONSTRAINT "student_fee_overrides_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Student subsidies (bank, voucher, etc.)
CREATE TABLE IF NOT EXISTS "student_subsidies" (
  "id"             TEXT NOT NULL,
  "school_id"      TEXT NOT NULL,
  "student_id"     TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "subsidy_type"   TEXT NOT NULL,
  "monthly_amount" DECIMAL(10,2) NOT NULL,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "starts_from"    DATE,
  "ends_at"        DATE,
  "notes"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_subsidies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "student_subsidies_student_id_is_active_idx"
  ON "student_subsidies"("student_id", "is_active");
ALTER TABLE "student_subsidies" ADD CONSTRAINT "student_subsidies_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_subsidies" ADD CONSTRAINT "student_subsidies_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Monthly charges per student
CREATE TABLE IF NOT EXISTS "monthly_charges" (
  "id"              TEXT NOT NULL,
  "school_id"       TEXT NOT NULL,
  "student_id"      TEXT NOT NULL,
  "month"           INTEGER NOT NULL,
  "year"            INTEGER NOT NULL,
  "school_fee"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "bus_fee"         DECIMAL(10,2) NOT NULL DEFAULT 0,
  "activity_fees"   DECIMAL(10,2) NOT NULL DEFAULT 0,
  "subsidy_total"   DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total_due"       DECIMAL(10,2) NOT NULL,
  "paid_amount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'unpaid',
  "paid_at"         TIMESTAMP(3),
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monthly_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_charges_student_id_month_year_key" UNIQUE ("student_id", "month", "year")
);
CREATE INDEX "monthly_charges_school_id_month_year_status_idx"
  ON "monthly_charges"("school_id", "month", "year", "status");
ALTER TABLE "monthly_charges" ADD CONSTRAINT "monthly_charges_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monthly_charges" ADD CONSTRAINT "monthly_charges_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

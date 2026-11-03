'use strict';
const { Pool } = require('pg');

const repairs = [
  `ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "due_date" DATE`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billing_due_day" INTEGER`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "gender" TEXT`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_enabled" BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_2_pct" DECIMAL(5,2)`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_3_plus_pct" DECIMAL(5,2)`,
  `ALTER TABLE "student_fee_overrides" ADD COLUMN IF NOT EXISTS "skip_sibling_discount" BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE TABLE IF NOT EXISTS "student_siblings" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "sibling_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_siblings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_siblings_sibling_id_fkey" FOREIGN KEY ("sibling_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "student_siblings_student_id_sibling_id_key" ON "student_siblings"("student_id", "sibling_id")`,
  `CREATE INDEX IF NOT EXISTS "student_siblings_student_id_idx" ON "student_siblings"("student_id")`,
  `CREATE INDEX IF NOT EXISTS "student_siblings_sibling_id_idx" ON "student_siblings"("sibling_id")`,
  `ALTER TABLE "party_invitations" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
  `UPDATE schools SET latitude = 38.0864, longitude = 23.7332 WHERE name ILIKE '%ονειροχ%' AND (latitude IS NULL OR longitude IS NULL)`,
  `CREATE TABLE IF NOT EXISTS "route_completions" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "students_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "route_completions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "route_completions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "route_completions_service_id_direction_day_key_key" ON "route_completions"("service_id", "direction", "day_key")`,
  `CREATE INDEX IF NOT EXISTS "route_completions_school_id_day_key_idx" ON "route_completions"("school_id", "day_key")`,
  `ALTER TABLE "route_completions" ADD COLUMN IF NOT EXISTS "route_id" TEXT`,
  `DROP INDEX IF EXISTS "route_completions_service_id_direction_day_key_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "rc_service_route_day_idx" ON "route_completions"(service_id, COALESCE(route_id, direction), day_key)`,
  `ALTER TABLE "student_services" ADD COLUMN IF NOT EXISTS "dropoff_route_id" TEXT`,
  // Elorus Fuse / myDATA fiscal
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "vat_number" TEXT`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_retail_series" TEXT`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_invoice_series" TEXT`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_vat_category" INTEGER`,
  `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_vat_exemption_category" INTEGER`,
  `CREATE TABLE IF NOT EXISTS "fiscal_series_counters" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_series_counters_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_series_counters_school_id_series_key" ON "fiscal_series_counters"("school_id", "series")`,
  `CREATE INDEX IF NOT EXISTS "fiscal_series_counters_school_id_idx" ON "fiscal_series_counters"("school_id")`,
  `DO $$ BEGIN
    ALTER TABLE "fiscal_series_counters"
      ADD CONSTRAINT "fiscal_series_counters_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "fiscal_documents" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT,
    "monthly_charge_id" TEXT,
    "one_time_charge_id" TEXT,
    "document_kind" TEXT NOT NULL,
    "invoice_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "net_value" DECIMAL(10,2) NOT NULL,
    "vat_category" INTEGER NOT NULL,
    "vat_exemption_category" INTEGER,
    "vat_amount" DECIMAL(10,2) NOT NULL,
    "gross_value" DECIMAL(10,2) NOT NULL,
    "payment_method_type" INTEGER,
    "cp_vat_number" TEXT,
    "cp_name" TEXT,
    "cp_country" TEXT,
    "cp_street" TEXT,
    "cp_number" TEXT,
    "cp_postal_code" TEXT,
    "cp_city" TEXT,
    "fuse_uid" TEXT,
    "mark" TEXT,
    "authentication_code" TEXT,
    "qr_url" TEXT,
    "verification_url" TEXT,
    "mydata_status" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "raw_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_school_id_series_number_key" ON "fiscal_documents"("school_id", "series", "number")`,
  `CREATE INDEX IF NOT EXISTS "fiscal_documents_school_id_student_id_idx" ON "fiscal_documents"("school_id", "student_id")`,
  `CREATE INDEX IF NOT EXISTS "fiscal_documents_school_id_status_idx" ON "fiscal_documents"("school_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "fiscal_documents_fuse_uid_idx" ON "fiscal_documents"("fuse_uid")`,
  `DO $$ BEGIN
    ALTER TABLE "fiscal_documents"
      ADD CONSTRAINT "fiscal_documents_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE "fiscal_documents"
      ADD CONSTRAINT "fiscal_documents_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
];

(async () => {
  const url = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL;
  if (!url) {
    console.error('[repair] ERROR: DATABASE_URL not set, skipping repairs');
    process.exit(0);
  }
  console.log('[repair] connecting to database...');
  const pool = new Pool({ connectionString: url });
  let ok = 0;
  let fail = 0;
  for (const sql of repairs) {
    try {
      await pool.query(sql);
      ok++;
    } catch (e) {
      console.error('[repair] FAILED:', sql.slice(0, 80), '->', e.message);
      fail++;
    }
  }
  await pool.end();
  console.log(`[repair] done: ${ok} ok, ${fail} failed`);
})();

-- Elorus Fuse / myDATA fiscal issuer settings on schools + issued documents + series counters.
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "vat_number" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_retail_series" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_invoice_series" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_vat_category" INTEGER;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "fiscal_vat_exemption_category" INTEGER;

CREATE TABLE IF NOT EXISTS "fiscal_series_counters" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "series" TEXT NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_series_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_series_counters_school_id_series_key"
  ON "fiscal_series_counters"("school_id", "series");

CREATE INDEX IF NOT EXISTS "fiscal_series_counters_school_id_idx"
  ON "fiscal_series_counters"("school_id");

DO $$ BEGIN
  ALTER TABLE "fiscal_series_counters"
    ADD CONSTRAINT "fiscal_series_counters_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "fiscal_documents" (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_school_id_series_number_key"
  ON "fiscal_documents"("school_id", "series", "number");

CREATE INDEX IF NOT EXISTS "fiscal_documents_school_id_student_id_idx"
  ON "fiscal_documents"("school_id", "student_id");

CREATE INDEX IF NOT EXISTS "fiscal_documents_school_id_status_idx"
  ON "fiscal_documents"("school_id", "status");

CREATE INDEX IF NOT EXISTS "fiscal_documents_fuse_uid_idx"
  ON "fiscal_documents"("fuse_uid");

DO $$ BEGIN
  ALTER TABLE "fiscal_documents"
    ADD CONSTRAINT "fiscal_documents_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fiscal_documents"
    ADD CONSTRAINT "fiscal_documents_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

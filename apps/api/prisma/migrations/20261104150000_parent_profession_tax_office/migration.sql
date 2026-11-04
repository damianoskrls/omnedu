-- Parent billing identity: profession + tax office (ΔΟΥ)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profession" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tax_office" TEXT;

-- Snapshot on issued fiscal documents
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "cp_profession" TEXT;
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "cp_tax_office" TEXT;

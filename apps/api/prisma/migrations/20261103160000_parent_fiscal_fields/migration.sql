-- Parent/customer AFM + address for Elorus Fuse counterparty on receipts.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vat_number" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_street" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_number" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_postal_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_city" TEXT;

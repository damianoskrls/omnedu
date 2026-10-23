-- AlterTable: add sibling discount policy fields to schools
ALTER TABLE "schools" ADD COLUMN "sibling_discount_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "schools" ADD COLUMN "sibling_discount_2_pct" DECIMAL(5,2);
ALTER TABLE "schools" ADD COLUMN "sibling_discount_3_plus_pct" DECIMAL(5,2);

-- AlterTable: add skip flag to student_fee_overrides
ALTER TABLE "student_fee_overrides" ADD COLUMN "skip_sibling_discount" BOOLEAN NOT NULL DEFAULT FALSE;

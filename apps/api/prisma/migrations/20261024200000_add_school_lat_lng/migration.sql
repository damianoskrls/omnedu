-- AlterTable: add latitude/longitude to schools (idempotent)
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

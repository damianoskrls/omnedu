-- AlterTable: add latitude/longitude to schools
ALTER TABLE "schools" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "schools" ADD COLUMN "longitude" DOUBLE PRECISION;

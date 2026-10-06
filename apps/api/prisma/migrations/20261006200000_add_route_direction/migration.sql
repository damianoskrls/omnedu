-- AlterTable: add direction column to service_routes
ALTER TABLE "service_routes" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'both';

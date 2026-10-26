-- Add dropoff_route_id to student_services
-- Uses IF NOT EXISTS so it is safe even if repair.js already added the column
ALTER TABLE "student_services" ADD COLUMN IF NOT EXISTS "dropoff_route_id" TEXT;

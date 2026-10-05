-- Add address field to route stops
ALTER TABLE "route_stops"
  ADD COLUMN IF NOT EXISTS "address" TEXT;

-- Add per-day times and pickup contact to student service assignments
ALTER TABLE "student_services"
  ADD COLUMN IF NOT EXISTS "daily_times" JSONB,
  ADD COLUMN IF NOT EXISTS "pickup_contact" TEXT;

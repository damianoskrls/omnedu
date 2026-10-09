CREATE TABLE IF NOT EXISTS "bus_pickups" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "driver_user_id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "picked_up_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bus_pickups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bus_pickups_service_id_student_id_day_key" ON "bus_pickups"("service_id", "student_id", "day");
CREATE INDEX IF NOT EXISTS "bus_pickups_school_id_day_idx" ON "bus_pickups"("school_id", "day");

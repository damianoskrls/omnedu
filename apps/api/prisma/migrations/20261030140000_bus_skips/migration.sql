CREATE TABLE IF NOT EXISTS "bus_skips" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "direction" TEXT NOT NULL,
  "reason" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bus_skips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bus_skips_service_id_student_id_day_key"
  ON "bus_skips"("service_id", "student_id", "day");
CREATE INDEX IF NOT EXISTS "bus_skips_school_id_day_idx" ON "bus_skips"("school_id", "day");
CREATE INDEX IF NOT EXISTS "bus_skips_service_id_day_idx" ON "bus_skips"("service_id", "day");

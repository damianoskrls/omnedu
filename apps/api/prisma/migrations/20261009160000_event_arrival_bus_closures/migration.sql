ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "arrive_by" TEXT;
ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "bus_operates" BOOLEAN;
ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "day_before_notified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "bus_closures" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bus_closures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bus_closures_school_id_day_key" ON "bus_closures"("school_id", "day");
CREATE INDEX IF NOT EXISTS "bus_closures_school_id_day_idx" ON "bus_closures"("school_id", "day");

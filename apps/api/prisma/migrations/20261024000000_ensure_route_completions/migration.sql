-- Ensure route_completions table exists (idempotent re-run of 20261023300000 which was pre-marked without executing)
CREATE TABLE IF NOT EXISTS "route_completions" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "students_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "route_completions_service_id_direction_day_key_key" ON "route_completions"("service_id", "direction", "day_key");

CREATE INDEX IF NOT EXISTS "route_completions_school_id_day_key_idx" ON "route_completions"("school_id", "day_key");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_completions_school_id_fkey') THEN
    ALTER TABLE "route_completions" ADD CONSTRAINT "route_completions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

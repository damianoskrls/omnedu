DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE 'driver';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "extra_services" ADD COLUMN IF NOT EXISTS "driver_user_id" TEXT;

CREATE TABLE IF NOT EXISTS "bus_positions" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "driver_user_id" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "heading" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bus_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bus_positions_service_id_key" ON "bus_positions"("service_id");
CREATE INDEX IF NOT EXISTS "bus_positions_school_id_idx" ON "bus_positions"("school_id");
CREATE INDEX IF NOT EXISTS "extra_services_driver_user_id_idx" ON "extra_services"("driver_user_id");

DO $$ BEGIN
  ALTER TABLE "extra_services"
    ADD CONSTRAINT "extra_services_driver_user_id_fkey"
    FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bus_positions"
    ADD CONSTRAINT "bus_positions_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bus_positions"
    ADD CONSTRAINT "bus_positions_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "extra_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bus_positions"
    ADD CONSTRAINT "bus_positions_driver_user_id_fkey"
    FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

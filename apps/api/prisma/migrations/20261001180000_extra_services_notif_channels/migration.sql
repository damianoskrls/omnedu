-- Add channels and image/individual targeting to notification_broadcasts
ALTER TABLE "notification_broadcasts"
  ADD COLUMN IF NOT EXISTS "image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "target_student_id" TEXT,
  ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT ARRAY['push']::TEXT[];

ALTER TABLE "notification_broadcasts"
  ADD CONSTRAINT "notification_broadcasts_target_student_id_fkey"
  FOREIGN KEY ("target_student_id") REFERENCES "students"("id") ON DELETE SET NULL;

-- Create notification_settings
CREATE TABLE "notification_settings" (
  "id"               TEXT NOT NULL,
  "school_id"        TEXT NOT NULL,
  "event_rules"      JSONB NOT NULL DEFAULT '{}',
  "default_channels" TEXT[] NOT NULL DEFAULT ARRAY['push']::TEXT[],
  "sms_api_key"      TEXT,
  "sms_sender_id"    TEXT,
  "email_from"       TEXT,
  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_settings_school_id_key" UNIQUE ("school_id"),
  CONSTRAINT "notification_settings_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE
);

-- Create extra_services
CREATE TABLE "extra_services" (
  "id"           TEXT NOT NULL,
  "school_id"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "service_type" TEXT NOT NULL,
  "monthly_cost" DECIMAL(10,2),
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extra_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "extra_services_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE
);

CREATE INDEX "extra_services_school_id_idx" ON "extra_services"("school_id");

-- Create service_routes
CREATE TABLE "service_routes" (
  "id"          TEXT NOT NULL,
  "service_id"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "service_routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_routes_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "extra_services"("id") ON DELETE CASCADE
);

CREATE INDEX "service_routes_service_id_idx" ON "service_routes"("service_id");

-- Create route_stops
CREATE TABLE "route_stops" (
  "id"           TEXT NOT NULL,
  "route_id"     TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "order"        INTEGER NOT NULL,
  "pickup_time"  TEXT,
  "dropoff_time" TEXT,
  "latitude"     DECIMAL(10,7),
  "longitude"    DECIMAL(10,7),
  CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "route_stops_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "service_routes"("id") ON DELETE CASCADE
);

CREATE INDEX "route_stops_route_id_order_idx" ON "route_stops"("route_id", "order");

-- Create student_services
CREATE TABLE "student_services" (
  "id"           TEXT NOT NULL,
  "student_id"   TEXT NOT NULL,
  "service_id"   TEXT NOT NULL,
  "route_id"     TEXT,
  "stop_id"      TEXT,
  "pickup_time"  TEXT,
  "dropoff_time" TEXT,
  "notes"        TEXT,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "enrolled_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_services_student_id_service_id_key" UNIQUE ("student_id", "service_id"),
  CONSTRAINT "student_services_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
  CONSTRAINT "student_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "extra_services"("id") ON DELETE CASCADE,
  CONSTRAINT "student_services_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "service_routes"("id") ON DELETE SET NULL,
  CONSTRAINT "student_services_stop_id_fkey"
    FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id") ON DELETE SET NULL
);

CREATE INDEX "student_services_service_id_idx" ON "student_services"("service_id");

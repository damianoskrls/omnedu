import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureRuntimeSchema();
  }

  // Railway starts the API even when migrate deploy fails. These statements
  // keep message lists working if created_by_id, hidden_at, or the owner role
  // never landed.
  async ensureRuntimeSchema() {
    const statements = [
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT`,
      `ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3)`,
      `UPDATE "conversations" AS c
        SET "created_by_id" = first_message.sender_id
        FROM (
          SELECT DISTINCT ON (conversation_id) conversation_id, sender_id
          FROM "messages"
          ORDER BY conversation_id, sent_at ASC
        ) AS first_message
        WHERE c.id = first_message.conversation_id
          AND c.created_by_id IS NULL
          AND EXISTS (SELECT 1 FROM "users" AS u WHERE u.id = first_message.sender_id)`,
      `UPDATE "conversations" AS c
        SET "created_by_id" = NULL
        WHERE c.created_by_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "users" AS u WHERE u.id = c.created_by_id)`,
      `DO $$ BEGIN
        ALTER TABLE "conversations"
          ADD CONSTRAINT "conversations_created_by_id_fkey"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$`,
      `DO $$ BEGIN
        ALTER TYPE "Role" ADD VALUE 'owner';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$`,
      `CREATE TABLE IF NOT EXISTS "class_assignments" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "class_id" TEXT NOT NULL,
        "author_id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "instructions" TEXT,
        "file_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "class_assignments_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "class_assignments_school_id_class_id_created_at_idx" ON "class_assignments"("school_id", "class_id", "created_at" DESC)`,
      `DO $$ BEGIN
        ALTER TYPE "Role" ADD VALUE 'driver';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$`,
      `ALTER TABLE "extra_services" ADD COLUMN IF NOT EXISTS "driver_user_id" TEXT`,
      `CREATE TABLE IF NOT EXISTS "bus_positions" (
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
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "bus_positions_service_id_key" ON "bus_positions"("service_id")`,
      `CREATE TABLE IF NOT EXISTS "bus_pickups" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "service_id" TEXT NOT NULL,
        "student_id" TEXT NOT NULL,
        "driver_user_id" TEXT NOT NULL,
        "day" DATE NOT NULL,
        "picked_up_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "bus_pickups_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "bus_pickups_service_id_student_id_day_key" ON "bus_pickups"("service_id", "student_id", "day")`,
      `CREATE INDEX IF NOT EXISTS "bus_pickups_school_id_day_idx" ON "bus_pickups"("school_id", "day")`,
      `ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "day_instructions" TEXT`,
      `ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "arrive_by" TEXT`,
      `ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "bus_operates" BOOLEAN`,
      `ALTER TABLE "school_events" ADD COLUMN IF NOT EXISTS "day_before_notified_at" TIMESTAMP(3)`,
      `CREATE TABLE IF NOT EXISTS "bus_closures" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "day" DATE NOT NULL,
        "reason" TEXT NOT NULL,
        "created_by_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "bus_closures_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "bus_closures_school_id_day_key" ON "bus_closures"("school_id", "day")`,
      `CREATE INDEX IF NOT EXISTS "bus_closures_school_id_day_idx" ON "bus_closures"("school_id", "day")`,
      `ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billing_due_day" INTEGER`,
      `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "gender" TEXT`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_enabled" BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_2_pct" DECIMAL(5,2)`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_3_plus_pct" DECIMAL(5,2)`,
      `ALTER TABLE "student_fee_overrides" ADD COLUMN IF NOT EXISTS "skip_sibling_discount" BOOLEAN NOT NULL DEFAULT FALSE`,
      `CREATE TABLE IF NOT EXISTS "student_siblings" (
        "id" TEXT NOT NULL,
        "student_id" TEXT NOT NULL,
        "sibling_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "student_siblings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "student_siblings_sibling_id_fkey" FOREIGN KEY ("sibling_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "student_siblings_student_id_sibling_id_key" ON "student_siblings"("student_id", "sibling_id")`,
      `CREATE INDEX IF NOT EXISTS "student_siblings_student_id_idx" ON "student_siblings"("student_id")`,
      `CREATE INDEX IF NOT EXISTS "student_siblings_sibling_id_idx" ON "student_siblings"("sibling_id")`,
      `ALTER TABLE "party_invitations" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
      `UPDATE schools SET latitude = 38.0864, longitude = 23.7332 WHERE name ILIKE '%ονειροχ%' AND (latitude IS NULL OR longitude IS NULL)`,
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "file_urls" TEXT[] DEFAULT ARRAY[]::TEXT[]`,
      `ALTER TABLE "student_services" ADD COLUMN IF NOT EXISTS "dropoff_route_id" TEXT`,
      `ALTER TABLE "service_routes" ADD COLUMN IF NOT EXISTS "direction" TEXT NOT NULL DEFAULT 'both'`,
      `CREATE TABLE IF NOT EXISTS "route_completions" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "service_id" TEXT NOT NULL,
        "driver_user_id" TEXT NOT NULL,
        "direction" TEXT NOT NULL,
        "day_key" TEXT NOT NULL,
        "students_count" INTEGER NOT NULL DEFAULT 0,
        "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "route_completions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "route_completions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "route_completions_service_id_direction_day_key_key" ON "route_completions"("service_id", "direction", "day_key")`,
      `CREATE INDEX IF NOT EXISTS "route_completions_school_id_day_key_idx" ON "route_completions"("school_id", "day_key")`,
    ];
    for (const sql of statements) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (error) {
        this.logger.warn(`Schema ensure skipped: ${(error as { message?: string })?.message ?? error}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

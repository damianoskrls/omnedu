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

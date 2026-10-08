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

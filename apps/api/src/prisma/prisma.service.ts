import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureRuntimeSchema();
  }

  // Railway starts the API even when a migration fails. These statements keep
  // messages and staff working if the owner role or conversation columns are missing.
  private async ensureRuntimeSchema() {
    const statements = [
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT`,
      `ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3)`,
    ];
    for (const sql of statements) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (error) {
        this.logger.error(error);
      }
    }
    const enumStatements = [
      `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'owner'`,
      `ALTER TYPE "Role" ADD VALUE 'owner'`,
    ];
    for (const sql of enumStatements) {
      try {
        await this.$executeRawUnsafe(sql);
        break;
      } catch (error) {
        const text = `${(error as { message?: string })?.message ?? error}`;
        if (/already exists|duplicate_object|42710/i.test(text)) break;
        this.logger.warn(text);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

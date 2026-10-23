'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const repairs = [
  `ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "due_date" DATE`,
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
];

(async () => {
  for (const sql of repairs) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.error('[repair] failed:', sql, '->', e.message);
    }
  }
  console.log('[repair] all columns ensured');
  await prisma.$disconnect();
})();

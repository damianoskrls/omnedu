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

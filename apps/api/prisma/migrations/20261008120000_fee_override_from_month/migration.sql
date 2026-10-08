ALTER TABLE "student_fee_overrides" DROP CONSTRAINT IF EXISTS "student_fee_overrides_student_id_key";
DROP INDEX IF EXISTS "student_fee_overrides_student_id_key";
ALTER TABLE "student_fee_overrides" ADD COLUMN IF NOT EXISTS "effective_from" DATE;
CREATE INDEX IF NOT EXISTS "student_fee_overrides_student_id_effective_from_idx"
  ON "student_fee_overrides"("student_id", "effective_from");

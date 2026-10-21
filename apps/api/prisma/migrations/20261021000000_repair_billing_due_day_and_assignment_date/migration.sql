ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "due_date" DATE;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billing_due_day" INTEGER;

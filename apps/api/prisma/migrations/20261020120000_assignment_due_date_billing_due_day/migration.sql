ALTER TABLE "class_assignments" ADD COLUMN "due_date" DATE;
ALTER TABLE "schools" ADD COLUMN "billing_due_day" INTEGER;
ALTER TABLE "thematic_plans" ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] NOT NULL DEFAULT '{}';

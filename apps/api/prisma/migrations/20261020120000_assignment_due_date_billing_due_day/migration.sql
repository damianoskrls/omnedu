ALTER TABLE "class_assignments" ADD COLUMN "due_date" DATE;
ALTER TABLE "schools" ADD COLUMN "billing_due_day" INTEGER;
ALTER TABLE "thematic_plans" ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "closed_classes" TEXT;
ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "dress_code" TEXT;
ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "theme" TEXT;

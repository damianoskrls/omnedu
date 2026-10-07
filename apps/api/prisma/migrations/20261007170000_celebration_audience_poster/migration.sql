ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "audience_type" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "school_celebrations" ADD COLUMN IF NOT EXISTS "audience_ids" TEXT NOT NULL DEFAULT '[]';

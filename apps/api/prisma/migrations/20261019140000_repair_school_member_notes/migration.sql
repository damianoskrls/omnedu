-- Repair: add notes column if the previous migration failed on Railway
ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT;

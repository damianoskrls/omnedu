-- Make parentId nullable (admin can enroll directly without parent)
ALTER TABLE "activity_registrations"
  ALTER COLUMN "parent_id" DROP NOT NULL;

-- Add admin-enroll flag and notes
ALTER TABLE "activity_registrations"
  ADD COLUMN IF NOT EXISTS "enrolled_by_admin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

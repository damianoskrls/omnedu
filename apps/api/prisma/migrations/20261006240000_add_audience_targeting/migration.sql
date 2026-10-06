-- Add audience targeting fields to school_posts, school_events, and activities

ALTER TABLE "school_posts"
  ADD COLUMN "audience_type" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "audience_ids" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "school_events"
  ADD COLUMN "audience_type" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "audience_ids" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "activities"
  ADD COLUMN "audience_type" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "audience_ids" TEXT NOT NULL DEFAULT '[]';

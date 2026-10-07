ALTER TABLE "parent_meetings" ADD COLUMN IF NOT EXISTS "teacher_user_id" TEXT;
ALTER TABLE "parent_meetings" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "parent_meetings" ADD COLUMN IF NOT EXISTS "window_start" TEXT;
ALTER TABLE "parent_meetings" ADD COLUMN IF NOT EXISTS "window_end" TEXT;

CREATE TABLE IF NOT EXISTS "parent_meeting_requests" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "slot_time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_meeting_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "parent_meeting_requests_meeting_id_student_id_key" ON "parent_meeting_requests"("meeting_id", "student_id");
CREATE INDEX IF NOT EXISTS "parent_meeting_requests_meeting_id_slot_time_idx" ON "parent_meeting_requests"("meeting_id", "slot_time");

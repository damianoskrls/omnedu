CREATE TABLE IF NOT EXISTS "party_invitations" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "birthday_student_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "image_url" TEXT,
  "event_date" TEXT,
  "recipient_student_ids" JSONB NOT NULL DEFAULT '[]',
  "sent_at" TIMESTAMP(3),
  "reminder_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "party_invitations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "party_invitations" ADD CONSTRAINT "party_invitations_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "party_invitations" ADD CONSTRAINT "party_invitations_birthday_student_id_fkey"
  FOREIGN KEY ("birthday_student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend questionnaires table with questions, deadline, status
ALTER TABLE "questionnaires"
  ADD COLUMN "questions" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "deadline" TIMESTAMP(3),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';

-- Create questionnaire_responses table
CREATE TABLE "questionnaire_responses" (
  "id" TEXT NOT NULL,
  "questionnaire_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "answers" TEXT NOT NULL DEFAULT '{}',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "questionnaire_responses_questionnaire_id_student_id_key"
  ON "questionnaire_responses"("questionnaire_id", "student_id");

CREATE INDEX "questionnaire_responses_questionnaire_id_idx"
  ON "questionnaire_responses"("questionnaire_id");

CREATE INDEX "questionnaire_responses_student_id_idx"
  ON "questionnaire_responses"("student_id");

ALTER TABLE "questionnaire_responses"
  ADD CONSTRAINT "questionnaire_responses_questionnaire_id_fkey"
    FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "questionnaire_responses_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

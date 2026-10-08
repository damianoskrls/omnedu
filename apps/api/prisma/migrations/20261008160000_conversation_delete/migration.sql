ALTER TABLE "conversations" ADD COLUMN "created_by_id" TEXT;

UPDATE "conversations" AS c
SET "created_by_id" = first_message.sender_id
FROM (
  SELECT DISTINCT ON (conversation_id) conversation_id, sender_id
  FROM "messages"
  ORDER BY conversation_id, sent_at ASC
) AS first_message
WHERE c.id = first_message.conversation_id;

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversation_participants" ADD COLUMN "hidden_at" TIMESTAMP(3);

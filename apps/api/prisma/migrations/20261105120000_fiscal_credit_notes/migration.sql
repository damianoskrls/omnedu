-- Link credit notes (11.4 / 5.1) back to the original fiscal document.
ALTER TABLE "fiscal_documents" ADD COLUMN IF NOT EXISTS "related_document_id" TEXT;
CREATE INDEX IF NOT EXISTS "fiscal_documents_related_document_id_idx"
  ON "fiscal_documents"("related_document_id");

CREATE TABLE IF NOT EXISTS "class_assignments" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "class_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "file_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "class_assignments_school_id_class_id_created_at_idx"
  ON "class_assignments"("school_id", "class_id", "created_at" DESC);

DO $$ BEGIN
  ALTER TABLE "class_assignments"
    ADD CONSTRAINT "class_assignments_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "class_assignments"
    ADD CONSTRAINT "class_assignments_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "class_assignments"
    ADD CONSTRAINT "class_assignments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

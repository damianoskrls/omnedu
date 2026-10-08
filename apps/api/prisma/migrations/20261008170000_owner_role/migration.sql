-- PostgreSQL before 15 rejects `ADD VALUE IF NOT EXISTS`. Ignore the value when it is already there.
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE 'owner';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

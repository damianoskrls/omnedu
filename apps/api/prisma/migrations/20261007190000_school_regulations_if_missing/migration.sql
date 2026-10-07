ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "operating_regulation" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "financial_regulation" TEXT;

CREATE TABLE IF NOT EXISTS "school_regulations" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "operating_text" TEXT,
    "financial_text" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_regulations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_regulations_school_id_academic_year_key" ON "school_regulations"("school_id", "academic_year");
CREATE INDEX IF NOT EXISTS "school_regulations_school_id_idx" ON "school_regulations"("school_id");

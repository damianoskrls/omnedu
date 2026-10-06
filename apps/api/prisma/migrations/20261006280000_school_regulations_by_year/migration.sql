CREATE TABLE "school_regulations" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "operating_text" TEXT,
    "financial_text" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_regulations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_regulations_school_id_academic_year_key" ON "school_regulations"("school_id", "academic_year");
CREATE INDEX "school_regulations_school_id_idx" ON "school_regulations"("school_id");

ALTER TABLE "school_regulations" ADD CONSTRAINT "school_regulations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "school_regulations" ("id", "school_id", "academic_year", "operating_text", "financial_text", "updated_at")
SELECT
    md5(random()::text || clock_timestamp()::text || s.id),
    s.id,
    COALESCE(
        (SELECT ay.label FROM "academic_years" ay WHERE ay.school_id = s.id AND ay.is_current = true ORDER BY ay.starts_on DESC LIMIT 1),
        CASE
            WHEN EXTRACT(MONTH FROM NOW()) >= 9 THEN EXTRACT(YEAR FROM NOW())::int::text || '-' || (EXTRACT(YEAR FROM NOW())::int + 1)::text
            ELSE (EXTRACT(YEAR FROM NOW())::int - 1)::text || '-' || EXTRACT(YEAR FROM NOW())::int::text
        END
    ),
    s.operating_regulation,
    s.financial_regulation,
    CURRENT_TIMESTAMP
FROM "schools" s
WHERE s.operating_regulation IS NOT NULL OR s.financial_regulation IS NOT NULL;

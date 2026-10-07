CREATE TABLE "school_celebrations" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "event_date" DATE,
    "arrival_time" TEXT,
    "place" TEXT,
    "details" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_celebrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_celebrations_school_id_academic_year_idx" ON "school_celebrations"("school_id", "academic_year");

ALTER TABLE "school_celebrations" ADD CONSTRAINT "school_celebrations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

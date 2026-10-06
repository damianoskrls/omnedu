-- CreateTable: questionnaires
CREATE TABLE "questionnaires" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academic_year" INTEGER NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'all',
    "scope_ids" TEXT NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questionnaires_school_id_idx" ON "questionnaires"("school_id");

-- AddForeignKey
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

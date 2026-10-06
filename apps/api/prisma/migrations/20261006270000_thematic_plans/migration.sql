CREATE TABLE "thematic_plans" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "through_month" TEXT,
    "title" TEXT NOT NULL,
    "greeting" TEXT NOT NULL DEFAULT 'Αγαπημένοι μας γονείς,',
    "introduction" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "extras" TEXT NOT NULL,
    "closing" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thematic_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thematic_plans_school_id_class_id_month_key" ON "thematic_plans"("school_id", "class_id", "month");
CREATE INDEX "thematic_plans_school_id_month_idx" ON "thematic_plans"("school_id", "month");

ALTER TABLE "thematic_plans" ADD CONSTRAINT "thematic_plans_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "thematic_plans" ADD CONSTRAINT "thematic_plans_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

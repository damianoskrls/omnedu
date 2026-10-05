-- CreateTable student_forms
CREATE TABLE "student_forms" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "food_allergies" TEXT,
    "medication_allergies" TEXT,
    "chronic_conditions" TEXT,
    "dietary_notes" TEXT,
    "emergency_contact" TEXT,
    "pediatrician_name" TEXT,
    "pediatrician_phone" TEXT,
    "additional_notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable medication_requests
CREATE TABLE "medication_requests" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "medication_name" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "reason" TEXT,
    "doctor_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_forms_school_id_student_id_academic_year_key" ON "student_forms"("school_id", "student_id", "academic_year");
CREATE INDEX "student_forms_school_id_idx" ON "student_forms"("school_id");
CREATE INDEX "medication_requests_school_id_student_id_idx" ON "medication_requests"("school_id", "student_id");
CREATE INDEX "medication_requests_school_id_status_idx" ON "medication_requests"("school_id", "status");

-- AddForeignKey
ALTER TABLE "student_forms" ADD CONSTRAINT "student_forms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_forms" ADD CONSTRAINT "student_forms_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_forms" ADD CONSTRAINT "student_forms_submitted_by_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medication_requests" ADD CONSTRAINT "medication_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_requests" ADD CONSTRAINT "medication_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_requests" ADD CONSTRAINT "medication_requests_requested_by_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medication_requests" ADD CONSTRAINT "medication_requests_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

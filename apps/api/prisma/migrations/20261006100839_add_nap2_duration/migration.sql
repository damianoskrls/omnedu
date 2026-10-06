-- DropForeignKey
ALTER TABLE "activity_registrations" DROP CONSTRAINT "activity_registrations_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "extra_services" DROP CONSTRAINT "extra_services_school_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_template_entries" DROP CONSTRAINT "menu_template_entries_template_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_templates" DROP CONSTRAINT "menu_templates_school_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_broadcasts" DROP CONSTRAINT "notification_broadcasts_school_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_broadcasts" DROP CONSTRAINT "notification_broadcasts_sent_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_broadcasts" DROP CONSTRAINT "notification_broadcasts_target_class_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_broadcasts" DROP CONSTRAINT "notification_broadcasts_target_student_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_settings" DROP CONSTRAINT "notification_settings_school_id_fkey";

-- DropForeignKey
ALTER TABLE "route_stops" DROP CONSTRAINT "route_stops_route_id_fkey";

-- DropForeignKey
ALTER TABLE "service_routes" DROP CONSTRAINT "service_routes_service_id_fkey";

-- DropForeignKey
ALTER TABLE "student_services" DROP CONSTRAINT "student_services_route_id_fkey";

-- DropForeignKey
ALTER TABLE "student_services" DROP CONSTRAINT "student_services_service_id_fkey";

-- DropForeignKey
ALTER TABLE "student_services" DROP CONSTRAINT "student_services_stop_id_fkey";

-- DropForeignKey
ALTER TABLE "student_services" DROP CONSTRAINT "student_services_student_id_fkey";

-- AlterTable
ALTER TABLE "daily_reports" ADD COLUMN     "activities" TEXT[],
ADD COLUMN     "nap2_duration_minutes" INTEGER;

-- AlterTable
ALTER TABLE "extra_services" ADD COLUMN     "dropoff_cost" DECIMAL(10,2),
ADD COLUMN     "pickup_cost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "menu_templates" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "monthly_charges" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_broadcasts" ALTER COLUMN "channels" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_settings" ALTER COLUMN "default_channels" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_routes" ADD COLUMN     "bus_number" TEXT,
ADD COLUMN     "driver_name" TEXT;

-- AlterTable
ALTER TABLE "student_forms" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_services" ADD COLUMN     "dropoff_contact" TEXT,
ADD COLUMN     "home_address" TEXT,
ADD COLUMN     "home_lat" DECIMAL(10,7),
ADD COLUMN     "home_lng" DECIMAL(10,7),
ADD COLUMN     "pickup_persons" JSONB,
ADD COLUMN     "service_mode" TEXT NOT NULL DEFAULT 'both';

-- CreateTable
CREATE TABLE "level_coordinators" (
    "level_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "level_coordinators_pkey" PRIMARY KEY ("level_id","user_id")
);

-- CreateTable
CREATE TABLE "class_instructions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_holidays" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_schedule_slots" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "notes" TEXT,

    CONSTRAINT "activity_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_instructors" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "photo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_instructor_assignments" (
    "instructor_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,

    CONSTRAINT "activity_instructor_assignments_pkey" PRIMARY KEY ("instructor_id","activity_id")
);

-- CreateTable
CREATE TABLE "school_posts" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "post_type" TEXT NOT NULL DEFAULT 'general',
    "media_urls" TEXT[],
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_events" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL DEFAULT 'general',
    "event_date" TIMESTAMP(3),
    "cost_per_child" DECIMAL(10,2),
    "class_ids" TEXT[],
    "media_urls" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_event_teachers" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "school_event_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_event_enrollments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_consent',
    "parent_consent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_event_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_event_media" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "media_type" TEXT NOT NULL DEFAULT 'image',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_event_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_holidays_school_id_idx" ON "school_holidays"("school_id");

-- CreateIndex
CREATE INDEX "activity_schedule_slots_activity_id_idx" ON "activity_schedule_slots"("activity_id");

-- CreateIndex
CREATE INDEX "activity_instructors_school_id_idx" ON "activity_instructors"("school_id");

-- CreateIndex
CREATE INDEX "school_posts_school_id_created_at_idx" ON "school_posts"("school_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "school_events_school_id_event_date_idx" ON "school_events"("school_id", "event_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "school_event_teachers_event_id_user_id_key" ON "school_event_teachers"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "school_event_enrollments_event_id_idx" ON "school_event_enrollments"("event_id");

-- CreateIndex
CREATE INDEX "school_event_enrollments_student_id_idx" ON "school_event_enrollments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_event_enrollments_event_id_student_id_key" ON "school_event_enrollments"("event_id", "student_id");

-- CreateIndex
CREATE INDEX "school_event_media_event_id_idx" ON "school_event_media"("event_id");

-- RenameForeignKey
ALTER TABLE "medication_requests" RENAME CONSTRAINT "medication_requests_acknowledged_by_fkey" TO "medication_requests_acknowledged_by_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_requests" RENAME CONSTRAINT "medication_requests_requested_by_fkey" TO "medication_requests_requested_by_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "student_forms" RENAME CONSTRAINT "student_forms_submitted_by_fkey" TO "student_forms_submitted_by_user_id_fkey";

-- AddForeignKey
ALTER TABLE "level_coordinators" ADD CONSTRAINT "level_coordinators_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_coordinators" ADD CONSTRAINT "level_coordinators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_instructions" ADD CONSTRAINT "class_instructions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_registrations" ADD CONSTRAINT "activity_registrations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_templates" ADD CONSTRAINT "menu_templates_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_template_entries" ADD CONSTRAINT "menu_template_entries_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "menu_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_target_class_id_fkey" FOREIGN KEY ("target_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_target_student_id_fkey" FOREIGN KEY ("target_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_services" ADD CONSTRAINT "extra_services_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_routes" ADD CONSTRAINT "service_routes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "extra_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "service_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_services" ADD CONSTRAINT "student_services_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_services" ADD CONSTRAINT "student_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "extra_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_services" ADD CONSTRAINT "student_services_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "service_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_services" ADD CONSTRAINT "student_services_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_holidays" ADD CONSTRAINT "school_holidays_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_schedule_slots" ADD CONSTRAINT "activity_schedule_slots_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_instructors" ADD CONSTRAINT "activity_instructors_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_instructor_assignments" ADD CONSTRAINT "activity_instructor_assignments_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "activity_instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_instructor_assignments" ADD CONSTRAINT "activity_instructor_assignments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_posts" ADD CONSTRAINT "school_posts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_posts" ADD CONSTRAINT "school_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_teachers" ADD CONSTRAINT "school_event_teachers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_teachers" ADD CONSTRAINT "school_event_teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_enrollments" ADD CONSTRAINT "school_event_enrollments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_enrollments" ADD CONSTRAINT "school_event_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_media" ADD CONSTRAINT "school_event_media_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_media" ADD CONSTRAINT "school_event_media_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

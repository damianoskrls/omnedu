-- CreateTable: levels
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "coordinator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: parent_meetings
CREATE TABLE "parent_meetings" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "class_id" TEXT,
    "level_id" TEXT,
    "notif_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: daily_menus
CREATE TABLE "daily_menus" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "breakfast" TEXT,
    "mid_morning" TEXT,
    "lunch" TEXT,
    "afternoon" TEXT,
    "notes" TEXT,
    CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id")
);

-- Alter classes: drop old level column, add level_id FK
ALTER TABLE "classes" DROP COLUMN IF EXISTS "level";
ALTER TABLE "classes" ADD COLUMN "level_id" TEXT;

-- CreateIndex
CREATE INDEX "levels_school_id_order_idx" ON "levels"("school_id", "order");
CREATE INDEX "parent_meetings_school_id_meeting_date_idx" ON "parent_meetings"("school_id", "meeting_date");
CREATE UNIQUE INDEX "daily_menus_school_id_date_key" ON "daily_menus"("school_id", "date");
CREATE INDEX "daily_menus_school_id_date_idx" ON "daily_menus"("school_id", "date");

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "levels" ADD CONSTRAINT "levels_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_menus" ADD CONSTRAINT "daily_menus_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "route_completions" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "day_key" TEXT NOT NULL,
    "students_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_completions_service_id_direction_day_key_key" ON "route_completions"("service_id", "direction", "day_key");

-- CreateIndex
CREATE INDEX "route_completions_school_id_day_key_idx" ON "route_completions"("school_id", "day_key");

-- AddForeignKey
ALTER TABLE "route_completions" ADD CONSTRAINT "route_completions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

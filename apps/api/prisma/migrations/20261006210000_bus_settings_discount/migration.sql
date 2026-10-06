-- AlterTable: add driver_name and bus_number to extra_services
ALTER TABLE "extra_services" ADD COLUMN "driver_name" TEXT;
ALTER TABLE "extra_services" ADD COLUMN "bus_number" TEXT;

-- AlterTable: add discount_amount to student_services
ALTER TABLE "student_services" ADD COLUMN "discount_amount" DECIMAL(10,2);

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { AppModule } from './app.module';
import { mountSchoolSite } from './school-site';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function runStartupRepair() {
  const prisma = new PrismaClient();
  const repairs = [
    'ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT',
    'ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "due_date" DATE',
    'ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billing_due_day" INTEGER',
    'ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "gender" TEXT',
    'ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_enabled" BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_2_pct" DECIMAL(5,2)',
    'ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "sibling_discount_3_plus_pct" DECIMAL(5,2)',
    'ALTER TABLE "student_fee_overrides" ADD COLUMN IF NOT EXISTS "skip_sibling_discount" BOOLEAN NOT NULL DEFAULT FALSE',
    `CREATE TABLE IF NOT EXISTS "student_siblings" (
      "id" TEXT NOT NULL,
      "student_id" TEXT NOT NULL,
      "sibling_id" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "student_siblings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "student_siblings_sibling_id_fkey" FOREIGN KEY ("sibling_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "student_siblings_student_id_sibling_id_key" ON "student_siblings"("student_id", "sibling_id")`,
    `CREATE INDEX IF NOT EXISTS "student_siblings_student_id_idx" ON "student_siblings"("student_id")`,
    `CREATE INDEX IF NOT EXISTS "student_siblings_sibling_id_idx" ON "student_siblings"("sibling_id")`,
    `ALTER TABLE "party_invitations" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT`,
  ];
  try {
    for (const sql of repairs) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (e: any) {
        console.error('[repair] statement failed (continuing):', e?.message);
      }
    }
    console.log('[repair] all columns ensured');
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  await runStartupRepair();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const postsDir = join(process.cwd(), 'uploads', 'posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
  const eventsDir = join(process.cwd(), 'uploads', 'events');
  if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const config = app.get(ConfigService);

  const port = config.get<number>('app.port', 3001);
  const frontendUrl = config.get<string>('app.frontendUrl');

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableCors({
    origin: [
      frontendUrl,
      'http://localhost:3000',
      'https://omnedu.vercel.app',
      'https://omneduapi-production.up.railway.app',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('omnedu API')
    .setDescription('School management platform REST API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  mountSchoolSite(app);
  await app.listen(port);
  console.log(`\n🚀 omnedu API: http://localhost:${port}/api/v1`);
  console.log(`📖 Swagger:    http://localhost:${port}/api/docs\n`);
}

bootstrap();

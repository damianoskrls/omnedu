import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { StudentsModule } from './modules/students/students.module';
import { ClassesModule } from './modules/classes/classes.module';
import { DailyReportsModule } from './modules/daily-reports/daily-reports.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { MessagesModule } from './modules/messages/messages.module';
import { BillingModule } from './modules/billing/billing.module';
import { StaffModule } from './modules/staff/staff.module';
import { LevelsModule } from './modules/levels/levels.module';
import { ParentMeetingsModule } from './modules/parent-meetings/parent-meetings.module';
import { DailyMenusModule } from './modules/daily-menus/daily-menus.module';
import { StudentFormsModule } from './modules/student-forms/student-forms.module';
import { MedicationRequestsModule } from './modules/medication-requests/medication-requests.module';
import { MenuTemplatesModule } from './modules/menu-templates/menu-templates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ExtraServicesModule } from './modules/extra-services/extra-services.module';
import { QuestionnairesModule } from './modules/questionnaires/questionnaires.module';
import { SchoolPostsModule } from './modules/school-posts/school-posts.module';
import { SchoolEventsModule } from './modules/school-events/school-events.module';
import { ThematicPlansModule } from './modules/thematic-plans/thematic-plans.module';
import { CelebrationsModule } from './modules/celebrations/celebrations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SchoolsModule,
    StudentsModule,
    ClassesModule,
    DailyReportsModule,
    ActivitiesModule,
    MessagesModule,
    BillingModule,
    StaffModule,
    LevelsModule,
    ParentMeetingsModule,
    DailyMenusModule,
    StudentFormsModule,
    MedicationRequestsModule,
    MenuTemplatesModule,
    NotificationsModule,
    ExtraServicesModule,
    QuestionnairesModule,
    SchoolPostsModule,
    SchoolEventsModule,
    ThematicPlansModule,
    CelebrationsModule,
    ReportsModule,
    StorageModule,
  ],
})
export class AppModule {}

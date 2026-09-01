import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './common/guards/subscription.guard';
import { TenantModule } from './modules/tenant/tenant.module';
import { StudentModule } from './modules/student/student.module';
import { FirebaseModule } from './database/firebase.module';
import { DatabaseProviderModule } from './database/database-provider.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { SchoolSetupModule } from './modules/school-setup/school-setup.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { BillingModule } from './modules/billing/billing.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ComplaintBoxModule } from './modules/complaint-box/complaint-box.module';
import { TeacherPortalModule } from './modules/teacher-portal/teacher-portal.module';
import { ParentPortalModule } from './modules/parent-portal/parent-portal.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'edutrack_secret_2026_!@#',
      signOptions: { expiresIn: '24h' },
    }),
    FirebaseModule,
    DatabaseProviderModule,
    AuthModule,
    TenantModule,
    StudentModule,
    AttendanceModule,
    TeacherModule,
    TimetableModule,
    SubscriptionModule,
    PlatformAdminModule,
    CommunicationsModule,
    SchoolSetupModule,
    BillingModule,
    ExpensesModule,
    ExamsModule,
    ComplaintBoxModule,
    TeacherPortalModule,
    ParentPortalModule,
    AcademicsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TeacherPortalService } from './teacher-portal.service';
import { TeacherPortalController } from './teacher-portal.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [
    DatabaseProviderModule, 
    FirebaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'edutrack_secret_2026_!@#',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [TeacherPortalController],
  providers: [TeacherPortalService],
  exports: [TeacherPortalService],
})
export class TeacherPortalModule {}

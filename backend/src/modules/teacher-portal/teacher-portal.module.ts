import { Module } from '@nestjs/common';
import { TeacherPortalService } from './teacher-portal.service';
import { TeacherPortalController } from './teacher-portal.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [DatabaseProviderModule],
  controllers: [TeacherPortalController],
  providers: [TeacherPortalService],
  exports: [TeacherPortalService],
})
export class TeacherPortalModule {}

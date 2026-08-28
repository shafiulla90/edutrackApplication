import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { TeacherPortalController, ExamConfigController } from './teacher-portal.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [DatabaseProviderModule],
  controllers: [ExamsController, TeacherPortalController, ExamConfigController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}

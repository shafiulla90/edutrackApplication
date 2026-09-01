import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { ExamScheduleController } from './exam-schedule.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [DatabaseProviderModule],
  controllers: [ExamsController, ExamScheduleController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}


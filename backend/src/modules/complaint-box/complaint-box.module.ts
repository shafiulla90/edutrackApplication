import { Module } from '@nestjs/common';
import { ComplaintBoxService } from './complaint-box.service';
import { ComplaintBoxController } from './complaint-box.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [DatabaseProviderModule],
  controllers: [ComplaintBoxController],
  providers: [ComplaintBoxService],
  exports: [ComplaintBoxService],
})
export class ComplaintBoxModule {}

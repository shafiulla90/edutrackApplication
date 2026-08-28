import { Module } from '@nestjs/common';
import { ComplaintBoxService } from './complaint-box.service';
import { ComplaintBoxController } from './complaint-box.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [DatabaseProviderModule, FirebaseModule],
  controllers: [ComplaintBoxController],
  providers: [ComplaintBoxService],
  exports: [ComplaintBoxService],
})
export class ComplaintBoxModule {}

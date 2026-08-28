import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [DatabaseProviderModule, FirebaseModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}

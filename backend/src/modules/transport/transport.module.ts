import { Module } from '@nestjs/common';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { DatabaseProviderModule } from '../../database/database-provider.module';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [DatabaseProviderModule, FirebaseModule],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [TransportService],
})
export class TransportModule {}

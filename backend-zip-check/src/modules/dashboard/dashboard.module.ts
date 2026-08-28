import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseProviderModule } from '../../database/database-provider.module';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [DatabaseProviderModule, FirebaseModule],
  controllers: [DashboardController, ReportsController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

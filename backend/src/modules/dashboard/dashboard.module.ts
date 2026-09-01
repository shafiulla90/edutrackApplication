import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardStatsService } from './dashboard-stats.service';
import { DatabaseProviderModule } from '../../database/database-provider.module';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [DatabaseProviderModule, FirebaseModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardStatsService],
  exports: [DashboardService, DashboardStatsService],
})
export class DashboardModule {}

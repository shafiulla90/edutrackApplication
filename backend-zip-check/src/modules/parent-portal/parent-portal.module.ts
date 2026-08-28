import { Module } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalController } from './parent-portal.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [DatabaseProviderModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}

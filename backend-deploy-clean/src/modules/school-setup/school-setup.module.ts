import { Module } from '@nestjs/common';
import { SchoolSetupService } from './school-setup.service';
import { SchoolSetupController } from './school-setup.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [DatabaseProviderModule],
  controllers: [SchoolSetupController],
  providers: [SchoolSetupService],
  exports: [SchoolSetupService],
})
export class SchoolSetupModule {}

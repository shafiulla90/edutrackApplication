import { Module } from '@nestjs/common';
import { LeaveManagementController } from './leave-management.controller';
import { LeaveManagementService } from './leave-management.service';
import { FirebaseModule } from '../../database/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [LeaveManagementController],
  providers: [LeaveManagementService],
  exports: [LeaveManagementService],
})
export class LeaveManagementModule {}

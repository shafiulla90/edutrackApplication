import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [SubscriptionController, PaymentController],
  providers: [SubscriptionService, PaymentService],
  exports: [SubscriptionService]
})
export class SubscriptionModule {}

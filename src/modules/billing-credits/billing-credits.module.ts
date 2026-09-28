import { Module } from '@nestjs/common';
import { BillingCreditsService } from './billing-credits.service';
import { BillingCreditsController } from './billing-credits.controller';
import { XenditService } from './xendit.service';

@Module({
  controllers: [BillingCreditsController],
  providers: [BillingCreditsService, XenditService],
  exports: [BillingCreditsService, XenditService],
})
export class BillingCreditsModule {}

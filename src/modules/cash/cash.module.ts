import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { AlertService } from './alerts/alert.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [CashController],
  providers: [CashService, AlertService],
  exports: [CashService, AlertService],
})
export class CashModule {}

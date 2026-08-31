import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { DatabaseProviderModule } from '../../database/database-provider.module';

@Module({
  imports: [
    DatabaseProviderModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}

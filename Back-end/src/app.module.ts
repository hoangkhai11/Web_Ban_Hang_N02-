import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.controller.js';
import { OrdersModule } from './orders/orders.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ProductsModule } from './products/products.controller.js';
import { PromotionsModule } from './promotions/promotions.module.js';

@ApiTags('Hệ thống')
@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/health — kiểm tra API và kết nối MySQL */
  @Get()
  @ApiOperation({ summary: 'Kiểm tra API và kết nối MySQL' })
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Giới hạn số lần gọi API theo IP — chỉ áp dụng ở route có ThrottlerGuard (đăng nhập, đăng ký, quên mật khẩu)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 10 }],
      errorMessage: 'Bạn thao tác quá nhiều lần, vui lòng thử lại sau 1 phút',
    }),
    PrismaModule,
    AuthModule,
    PromotionsModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

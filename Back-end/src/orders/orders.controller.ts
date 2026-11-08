import { Body, Controller, Get, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../auth/guards.js';
import { CreateOrderDto } from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Đơn hàng')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** POST /api/orders — tạo đơn COD */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  /** GET /api/orders/my — lịch sử đơn hàng */
  @Get('my')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.myOrders(user.id);
  }

  /** GET /api/orders/my/:code — chi tiết & theo dõi trạng thái */
  @Get('my/:code')
  one(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.orders.myOrder(user.id, code);
  }

  /** PATCH /api/orders/my/:code/cancel */
  @Patch('my/:code/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.orders.cancelMine(user.id, code);
  }
}

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}

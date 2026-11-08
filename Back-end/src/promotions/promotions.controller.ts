import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuoteDto } from '../orders/dto/order.dto.js';
import { PromotionsService } from './promotions.service.js';

@ApiTags('Khuyến mãi')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  /** GET /api/promotions — chương trình + điều kiện + sản phẩm áp dụng */
  @Get()
  list() {
    return this.promotions.list();
  }

  /** GET /api/promotions/pricing-context — dữ liệu để FE hiển thị giá giảm trên thẻ sản phẩm */
  @Get('pricing-context')
  context() {
    return this.promotions.getPricingContext();
  }

  /** POST /api/promotions/quote — tính tạm tính, giảm giá, phí vận chuyển, tổng tiền */
  @Post('quote')
  @HttpCode(200)
  quote(@Body() dto: QuoteDto) {
    return this.promotions.quote(dto.items);
  }
}

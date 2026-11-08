import { Body, Controller, Get, HttpCode, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt } from 'class-validator';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { ProductsService } from './products.service.js';

/** Body của POST /api/products/by-ids: tối đa 100 id sản phẩm */
class ByIdsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  ids: number[];
}

@ApiTags('Sản phẩm')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** GET /api/products — danh sách + tìm kiếm + lọc + sắp xếp + phân trang + facet */
  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  /** GET /api/products/accessories?exclude=1,2 — gợi ý phụ kiện mua kèm */
  @Get('accessories')
  accessories(@Query('exclude') exclude?: string) {
    const ids = (exclude ?? '').split(',').map(Number).filter(Number.isInteger);
    return this.products.accessories(ids);
  }

  /** POST /api/products/by-ids — lấy thông tin sản phẩm trong giỏ hàng */
  @Post('by-ids')
  @HttpCode(200)
  byIds(@Body() dto: ByIdsDto) {
    return this.products.byIds(dto.ids);
  }

  /** GET /api/products/:id/related — sản phẩm cùng danh mục */
  @Get(':id/related')
  related(@Param('id', ParseIntPipe) id: number) {
    return this.products.related(id);
  }

  /** GET /api/products/:slug — chi tiết theo slug hoặc mã sản phẩm */
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.products.detail(slug);
  }
}

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}

import { Body, Controller, Delete, Get, Module, Param, ParseIntPipe, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard, type AuthUser } from '../auth/guards.js';
import { MAX_IMAGE_BYTES } from '../common/upload.js';
import { AdminService } from './admin.service.js';
import {
  CategoryInputDto,
  DashboardQueryDto,
  MovementQueryDto,
  OrderQueryDto,
  OrderStatusDto,
  PaymentStatusDto,
  ProductInputDto,
  PromotionInputDto,
  SettingsDto,
  StockChangeDto,
  StockDto,
} from './dto/admin.dto.js';

/** Toàn bộ API quản trị: bắt buộc đăng nhập + vai trò ADMIN (kiểm tra ở server). */
@ApiTags('Quản trị')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** GET /api/admin/dashboard?days=7|30|90 — số liệu tổng quan + thống kê theo kỳ */
  @Get('dashboard')
  dashboard(@Query() q: DashboardQueryDto) {
    return this.admin.dashboard(q.days ?? 7);
  }

  // ----- Sản phẩm -----
  /** GET /api/admin/products — sản phẩm đang kinh doanh */
  @Get('products')
  @ApiOperation({ summary: 'Danh sách sản phẩm đang kinh doanh' })
  products() {
    return this.admin.listProducts();
  }
  /** GET /api/admin/products/:id */
  @Get('products/:id')
  product(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getProduct(id);
  }
  /** POST /api/admin/products — thêm sản phẩm, ghi tồn kho ban đầu vào lịch sử kho */
  @Post('products')
  createProduct(@Body() dto: ProductInputDto, @CurrentUser() user: AuthUser) {
    return this.admin.createProduct(dto, user.id);
  }
  /** PUT /api/admin/products/:id — sửa thông tin sản phẩm (tồn kho bị bỏ qua, sửa ở trang Kho hàng) */
  @Put('products/:id')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() dto: ProductInputDto) {
    return this.admin.updateProduct(id, dto);
  }
  /** DELETE /api/admin/products/:id — xóa mềm (ẩn khỏi cửa hàng, giữ lịch sử đơn) */
  @Delete('products/:id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteProduct(id);
  }

  /** POST /api/admin/uploads — tải ảnh sản phẩm từ thiết bị (JPG, PNG, WebP, tối đa 5 MB) → { url } */
  @Post('uploads')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  uploadImage(@UploadedFile() file?: { buffer: Buffer }) {
    return this.admin.saveImage(file?.buffer);
  }

  // ----- Kho hàng -----
  /** GET /api/admin/inventory/movements?productId=&type=&from=&to=&page= — lịch sử kho */
  @Get('inventory/movements')
  @ApiOperation({ summary: 'Lịch sử kho, lọc theo sản phẩm, loại, ngày' })
  movements(@Query() q: MovementQueryDto) {
    return this.admin.listMovements(q);
  }
  /** PATCH /api/admin/inventory/:id — kiểm kê: đặt tồn kho = số đếm thực tế */
  @Patch('inventory/:id')
  stock(@Param('id', ParseIntPipe) id: number, @Body() dto: StockDto, @CurrentUser() user: AuthUser) {
    return this.admin.updateStock(id, dto.stock, dto.note, user.id);
  }
  /** POST /api/admin/inventory/:id/import — nhập thêm hàng */
  @Post('inventory/:id/import')
  importStock(@Param('id', ParseIntPipe) id: number, @Body() dto: StockChangeDto, @CurrentUser() user: AuthUser) {
    return this.admin.importStock(id, dto.quantity, dto.note, user.id);
  }
  /** POST /api/admin/inventory/:id/export — xuất kho ngoài bán hàng (không vượt tồn) */
  @Post('inventory/:id/export')
  exportStock(@Param('id', ParseIntPipe) id: number, @Body() dto: StockChangeDto, @CurrentUser() user: AuthUser) {
    return this.admin.exportStock(id, dto.quantity, dto.note, user.id);
  }

  // ----- Danh mục -----
  /** GET /api/admin/categories — tất cả danh mục kèm số sản phẩm */
  @Get('categories')
  @ApiOperation({ summary: 'Tất cả danh mục kèm số sản phẩm' })
  categories() {
    return this.admin.listCategories();
  }
  /** POST /api/admin/categories — chỉ thêm danh mục cấp 2 */
  @Post('categories')
  createCategory(@Body() dto: CategoryInputDto) {
    return this.admin.createCategory(dto);
  }
  /** PUT /api/admin/categories/:id */
  @Put('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryInputDto) {
    return this.admin.updateCategory(id, dto);
  }
  /** DELETE /api/admin/categories/:id — chỉ xóa được danh mục cấp 2 không còn sản phẩm */
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCategory(id);
  }

  // ----- Đơn hàng -----
  /** GET /api/admin/orders?status=&paymentStatus=&from=&to=&q=&page=&pageSize= — có phân trang + tổng hợp */
  @Get('orders')
  @ApiOperation({ summary: 'Danh sách đơn có phân trang và tổng hợp' })
  orders(@Query() q: OrderQueryDto) {
    return this.admin.listOrders(q);
  }
  /** GET /api/admin/orders/:code — chi tiết đơn + khách hàng + tồn kho hiện tại */
  @Get('orders/:code')
  order(@Param('code') code: string) {
    return this.admin.getOrder(code);
  }
  /** PATCH /api/admin/orders/:code/status — chuyển trạng thái theo ORDER_TRANSITIONS */
  @Patch('orders/:code/status')
  status(@Param('code') code: string, @Body() dto: OrderStatusDto) {
    return this.admin.updateOrderStatus(code, dto.status, dto.note);
  }
  /** PATCH /api/admin/orders/:code/payment — cập nhật thanh toán theo PAYMENT_TRANSITIONS */
  @Patch('orders/:code/payment')
  payment(@Param('code') code: string, @Body() dto: PaymentStatusDto) {
    return this.admin.updatePaymentStatus(code, dto.paymentStatus);
  }

  // ----- Nâng cao -----
  /** GET /api/admin/customers — khách hàng + số đơn + tổng chi tiêu */
  @Get('customers')
  @ApiOperation({ summary: 'Khách hàng kèm số đơn và tổng chi tiêu' })
  customers() {
    return this.admin.listCustomers();
  }
  /** GET /api/admin/promotions — chương trình khuyến mãi + phí vận chuyển */
  @Get('promotions')
  promotions() {
    return this.admin.promotionSettings();
  }
  /** PUT /api/admin/promotions/:id — sửa chương trình (không đổi loại) */
  @Put('promotions/:id')
  updatePromotion(@Param('id', ParseIntPipe) id: number, @Body() dto: PromotionInputDto) {
    return this.admin.updatePromotion(id, dto);
  }
  /** PUT /api/admin/settings — phí vận chuyển cố định */
  @Put('settings')
  settings(@Body() dto: SettingsDto) {
    return this.admin.updateSettings(dto.baseShippingFee);
  }
}

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

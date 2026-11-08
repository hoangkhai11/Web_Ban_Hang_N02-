import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Dữ liệu thêm / sửa sản phẩm (POST, PUT /api/admin/products). Slug do server tự sinh. */
export class ProductInputDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Mã sản phẩm không được để trống' }) @MaxLength(50)
  code: string;

  @Transform(trim) @IsString() @MinLength(1, { message: 'Tên sản phẩm không được để trống' }) @MaxLength(255)
  name: string;

  @IsInt({ message: 'Vui lòng chọn danh mục' })
  categoryId: number;

  @Transform(trim) @IsString() @MinLength(1, { message: 'Vui lòng nhập thương hiệu' }) @MaxLength(100)
  brand: string;

  @IsInt({ message: 'Giá bán phải là số nguyên (VNĐ)' }) @Min(1, { message: 'Giá bán phải lớn hơn 0' }) @Max(2_000_000_000)
  price: number;

  /** Tồn kho ban đầu — chỉ dùng khi THÊM sản phẩm; khi sửa bị bỏ qua */
  @IsInt({ message: 'Tồn kho phải là số nguyên' }) @Min(0, { message: 'Tồn kho phải >= 0' })
  stock: number;

  @IsInt() @Min(0) @Max(120)
  warrantyMonths: number;

  @IsArray() @IsString({ each: true })
  images: string[];

  @IsArray() @IsString({ each: true })
  highlights: string[];

  @IsString() @MaxLength(10000)
  description: string;

  /** Bảng thông số hiển thị: { "CPU": "Intel Core i5", ... } */
  @IsObject()
  specs: Record<string, string>;

  /** Thuộc tính dùng để lọc (khóa trong ATTRIBUTE_KEYS); khóa lạ bị bỏ qua ở service */
  @IsObject()
  attributes: Record<string, string>;

  @IsOptional() @IsString() @MaxLength(500)
  compatibilityNote?: string;
}

/** Kiểm kê: số tồn kho mới (tuyệt đối, không phải chênh lệch). */
export class StockDto {
  @IsInt({ message: 'Tồn kho phải là số nguyên' }) @Min(0, { message: 'Tồn kho phải >= 0' })
  stock: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  note?: string;
}

/** Nhập / xuất kho: số lượng thay đổi (luôn dương), kèm ghi chú (nhà cung cấp, lý do xuất...). */
export class StockChangeDto {
  @IsInt({ message: 'Số lượng phải là số nguyên' }) @Min(1, { message: 'Số lượng tối thiểu là 1' }) @Max(100_000)
  quantity: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  note?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Bộ lọc lịch sử kho; from/to dạng YYYY-MM-DD. */
export class MovementQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() productId?: number;
  @IsOptional() @IsIn(['IMPORT', 'EXPORT', 'ADJUST', 'ORDER', 'RETURN']) type?: 'IMPORT' | 'EXPORT' | 'ADJUST' | 'ORDER' | 'RETURN';
  @IsOptional() @Matches(DAY_RE) from?: string;
  @IsOptional() @Matches(DAY_RE) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/** Bộ lọc danh sách đơn hàng Admin; from/to dạng YYYY-MM-DD; q: mã đơn, tên, SĐT, email. */
export class OrderQueryDto {
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
  @IsOptional() @IsIn(['UNPAID', 'PAID', 'REFUNDED']) paymentStatus?: 'UNPAID' | 'PAID' | 'REFUNDED';
  @IsOptional() @Matches(DAY_RE, { message: 'Ngày không hợp lệ' }) from?: string;
  @IsOptional() @Matches(DAY_RE, { message: 'Ngày không hợp lệ' }) to?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/** Kỳ thống kê của Dashboard: 7, 30 hoặc 90 ngày. */
export class DashboardQueryDto {
  @IsOptional() @Type(() => Number) @IsIn([7, 30, 90]) days?: number;
}

/** Thêm / sửa danh mục; parentId bắt buộc với danh mục cấp 2. */
export class CategoryInputDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Tên danh mục không được để trống' }) @MaxLength(100)
  name: string;

  @IsOptional() @IsInt()
  parentId: number | null;

  @IsOptional() @IsString() @MaxLength(500)
  description = '';
}

/** Trạng thái đơn mới; hợp lệ hay không do ORDER_TRANSITIONS quyết định. */
export class OrderStatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'])
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

  @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  note?: string;
}

/** Trạng thái thanh toán: chưa thu / đã thu / đã hoàn tiền. */
export class PaymentStatusDto {
  @IsIn(['UNPAID', 'PAID', 'REFUNDED'])
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sửa chương trình khuyến mãi. value: % giảm (PRODUCT_PERCENT); minOrderValue: ngưỡng miễn phí ship (FREE_SHIPPING). */
export class PromotionInputDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(150)
  name: string;

  @IsInt() @Min(0) @Max(99)
  value: number;

  @IsInt() @Min(0)
  minOrderValue: number;

  @Matches(DATE_RE) startDate: string;
  @Matches(DATE_RE) endDate: string;

  @IsBoolean()
  isActive: boolean;

  @IsArray() @IsInt({ each: true }) @Type(() => Number)
  productIds: number[];

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  conditions?: string[];
}

/** Cấu hình cửa hàng: phí vận chuyển cố định (VNĐ). */
export class SettingsDto {
  @IsInt({ message: 'Phí vận chuyển phải là số nguyên' }) @Min(0)
  baseShippingFee: number;
}

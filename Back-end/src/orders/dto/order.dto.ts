import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PHONE_RE } from '../../auth/dto/auth.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// DTO lồng nhau phải nằm chung file: plugin Swagger sinh sai import khác file khi đường dẫn dự án có dấu tiếng Việt
/** Số lượng tối đa mỗi sản phẩm trong 1 đơn */
export const MAX_QTY_PER_ITEM = 10;

/** 1 dòng giỏ hàng: id sản phẩm + số lượng (1–10). Dùng chung cho báo giá và tạo đơn. */
export class CartItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(MAX_QTY_PER_ITEM, { message: `Tối đa ${MAX_QTY_PER_ITEM} sản phẩm mỗi loại` })
  quantity: number;
}

/** Body của POST /api/promotions/quote */
export class QuoteDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}

/** Thông tin người nhận hàng */
export class ShippingDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Vui lòng nhập họ tên người nhận' }) @MaxLength(100)
  fullName: string;

  @Transform(trim) @Matches(PHONE_RE, { message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' })
  phone: string;

  @Transform(trim) @IsString() @MinLength(2, { message: 'Vui lòng chọn tỉnh/thành phố' }) @MaxLength(100)
  province: string;

  @Transform(trim) @IsString() @MinLength(1, { message: 'Vui lòng nhập quận/huyện' }) @MaxLength(100)
  district: string;

  @Transform(trim) @IsString() @MinLength(5, { message: 'Vui lòng nhập địa chỉ cụ thể' }) @MaxLength(255)
  address: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  note?: string;
}

/**
 * POST /api/orders — client CHỈ gửi sản phẩm + số lượng + thông tin nhận hàng.
 * Không nhận giá, tổng tiền hay trạng thái từ client.
 */
export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Giỏ hàng trống' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @ValidateNested()
  @Type(() => ShippingDto)
  shipping: ShippingDto;

  @IsOptional()
  @IsIn(['COD'], { message: 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD)' })
  paymentMethod?: 'COD';
}

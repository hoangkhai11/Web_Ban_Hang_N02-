import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Các thuộc tính được phép lọc (khớp với cột `key` của bảng product_attributes). */
export const ATTRIBUTE_KEYS = [
  'cpu',
  'ram',
  'storage',
  'storageType',
  'gpu',
  'vram',
  'ramType',
  'socket',
  'connection',
  'screenSize',
  'resolution',
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/** Khoảng giá lọc: [từ, dưới] (VNĐ). */
export const PRICE_RANGES = {
  'under-5': [0, 5_000_000],
  '5-15': [5_000_000, 15_000_000],
  'over-15': [15_000_000, Infinity],
} as const;

/** Danh sách phân tách bằng dấu phẩy: ?brand=Dell,ASUS */
const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

/**
 * GET /api/products?category=laptop&q=i5&brand=Dell,ASUS&price=5-15&ram=16 GB&stock=1&sort=price-asc&page=1&pageSize=8
 */
export class ProductQueryDto {
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Transform(csv) brand?: string[];
  @IsOptional() @IsIn(Object.keys(PRICE_RANGES)) price?: keyof typeof PRICE_RANGES;
  @IsOptional() @IsIn(['popular', 'newest', 'price-asc', 'price-desc']) sort?: 'popular' | 'newest' | 'price-asc' | 'price-desc';
  @IsOptional() @IsIn(['1']) stock?: string;
  @IsOptional() @IsIn(['1']) promo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize?: number;

  // Thuộc tính lọc (LAB 6)
  @IsOptional() @Transform(csv) cpu?: string[];
  @IsOptional() @Transform(csv) ram?: string[];
  @IsOptional() @Transform(csv) storage?: string[];
  @IsOptional() @Transform(csv) storageType?: string[];
  @IsOptional() @Transform(csv) gpu?: string[];
  @IsOptional() @Transform(csv) vram?: string[];
  @IsOptional() @Transform(csv) ramType?: string[];
  @IsOptional() @Transform(csv) socket?: string[];
  @IsOptional() @Transform(csv) connection?: string[];
  @IsOptional() @Transform(csv) screenSize?: string[];
  @IsOptional() @Transform(csv) resolution?: string[];
}

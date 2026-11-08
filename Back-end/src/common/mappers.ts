/**
 * Chuyển bản ghi Prisma sang đúng định dạng JSON mà Front-end đang dùng (src/types của FE),
 * để khi kết nối FE ↔ BE không phải sửa giao diện.
 */
import type {
  Order,
  OrderItem,
  OrderStatusHistory,
  Product,
  ProductAttribute,
  Promotion,
  PromotionProduct,
  User,
} from '@prisma/client';
import type { PricingPromotion } from './pricing.js';

export type ProductWithAttrs = Product & { attributes: ProductAttribute[] };

/** Sản phẩm → JSON cho FE; thuộc tính lọc chuyển từ danh sách dòng sang object { key: value }. */
export function toProductDto(p: ProductWithAttrs) {
  return {
    id: p.id,
    code: p.code,
    slug: p.slug,
    name: p.name,
    categoryId: p.categoryId,
    brand: p.brand,
    price: p.price,
    stock: p.stock,
    images: p.images as string[],
    highlights: p.highlights as string[],
    description: p.description,
    specs: p.specs as Record<string, string>,
    attributes: Object.fromEntries(p.attributes.map((a) => [a.key, a.value])),
    warrantyMonths: p.warrantyMonths,
    soldCount: p.soldCount,
    createdAt: p.createdAt.toISOString().slice(0, 10),
    isActive: p.isActive,
    compatibilityNote: p.compatibilityNote ?? undefined,
  };
}

export type PromotionWithProducts = Promotion & { products: PromotionProduct[] };

/** Date → 'YYYY-MM-DD' */
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Chương trình khuyến mãi → JSON cho FE (productIds: sản phẩm áp dụng). */
export function toPromotionDto(p: PromotionWithProducts) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    value: p.value,
    minOrderValue: p.minOrderValue,
    startDate: day(p.startDate),
    endDate: day(p.endDate),
    isActive: p.isActive,
    productIds: p.products.map((x) => x.productId),
    description: p.description,
    conditions: p.conditions as string[],
  };
}

/** Dạng rút gọn dùng cho hàm tính giá (common/pricing.ts). */
export const toPricingPromotion = (p: PromotionWithProducts): PricingPromotion => toPromotionDto(p);

/** Người dùng → JSON cho FE; KHÔNG bao giờ trả passwordHash. */
export function toUserDto(u: User) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    address: u.address,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export type OrderFull = Order & { items: OrderItem[]; history: OrderStatusHistory[] };

/** Đơn hàng → JSON cho FE: gom thông tin giao hàng vào `shipping`, lịch sử trạng thái sắp theo thời gian. */
export function toOrderDto(o: OrderFull) {
  return {
    id: o.id,
    code: o.code,
    customerId: o.userId,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      productId: i.productId,
      productCode: i.productCode,
      productName: i.productName,
      image: i.image,
      unitPrice: i.unitPrice,
      originalPrice: i.originalPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    discountTotal: o.discountTotal,
    shippingFee: o.shippingFee,
    total: o.total,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    shipping: {
      fullName: o.shipFullName,
      phone: o.shipPhone,
      province: o.shipProvince,
      district: o.shipDistrict,
      address: o.shipAddress,
      note: o.shipNote,
    },
    history: [...o.history]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
      .map((h) => ({ status: h.status, at: h.createdAt.toISOString(), note: h.note })),
    stockReleased: o.stockReleased,
  };
}

/** Quan hệ cần nạp kèm khi đọc đơn hàng để dùng được toOrderDto. */
export const orderInclude = { items: true, history: true } as const;

/** Tạo slug URL: bỏ dấu tiếng Việt, đ → d, ký tự khác chữ/số thành '-'. VD: "Bàn phím" → "ban-phim" */
export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Quy tắc tính tiền — GIỐNG HỆT Front-end/src/lib/pricing.ts.
 * Server là nơi quyết định giá cuối cùng: khi tạo đơn, mọi con số đều được tính lại ở đây.
 *
 * 1. Giảm % chỉ áp dụng cho sản phẩm nằm trong chương trình PRODUCT_PERCENT đang hiệu lực.
 * 2. Đơn giá sau giảm làm tròn tới đồng.
 * 3. Phí vận chuyển = phí cố định; miễn phí nếu tổng tiền hàng (sau giảm) >= ngưỡng FREE_SHIPPING.
 */

export interface PricingProduct {
  id: number;
  price: number;
}

export interface PricingPromotion {
  type: 'PRODUCT_PERCENT' | 'FREE_SHIPPING';
  value: number;
  minOrderValue: number;
  startDate: Date | string;
  endDate: Date | string;
  isActive: boolean;
  productIds: number[];
}

const toDay = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Chương trình đang bật và hôm nay nằm trong khoảng [ngày bắt đầu, hết ngày kết thúc]. */
export function isPromotionRunning(p: PricingPromotion, now = new Date()) {
  if (!p.isActive) return false;
  const start = new Date(toDay(p.startDate) + 'T00:00:00');
  const end = new Date(toDay(p.endDate) + 'T23:59:59');
  return now >= start && now <= end;
}

/** % giảm của sản phẩm (0 nếu không thuộc chương trình giảm giá nào đang chạy). */
export function getDiscountPercent(product: PricingProduct, promotions: PricingPromotion[]) {
  const promo = promotions.find(
    (p) => p.type === 'PRODUCT_PERCENT' && isPromotionRunning(p) && p.productIds.includes(product.id),
  );
  return promo ? promo.value : 0;
}

/** Đơn giá sau giảm, làm tròn tới đồng. */
export function getUnitPrice(product: PricingProduct, promotions: PricingPromotion[]) {
  return Math.round((product.price * (100 - getDiscountPercent(product, promotions))) / 100);
}

/** Chương trình miễn phí vận chuyển đang chạy (nếu có). */
export function getFreeShippingPromotion(promotions: PricingPromotion[]) {
  return promotions.find((p) => p.type === 'FREE_SHIPPING' && isPromotionRunning(p)) ?? null;
}

export interface QuoteLine<P extends PricingProduct> {
  product: P;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
}

/**
 * Tính tiền giỏ hàng: từng dòng (giá gốc, giá sau giảm, thành tiền), tạm tính, tổng giảm,
 * phí vận chuyển và tổng thanh toán. Sản phẩm không có trong `products` bị bỏ qua.
 */
export function quote<P extends PricingProduct>(
  cart: { productId: number; quantity: number }[],
  products: P[],
  promotions: PricingPromotion[],
  baseShippingFee: number,
) {
  const lines: QuoteLine<P>[] = [];
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const unitPrice = getUnitPrice(product, promotions);
    lines.push({
      product,
      quantity: item.quantity,
      originalPrice: product.price,
      unitPrice,
      discountPercent: getDiscountPercent(product, promotions),
      lineTotal: unitPrice * item.quantity,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.originalPrice * l.quantity, 0);
  const merchandiseTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const freeShip = getFreeShippingPromotion(promotions);
  const threshold = freeShip ? freeShip.minOrderValue : null;
  const freeShipping = threshold !== null && merchandiseTotal >= threshold;
  const shippingFee = lines.length === 0 || freeShipping ? 0 : baseShippingFee;

  return {
    lines,
    subtotal,
    discountTotal: subtotal - merchandiseTotal,
    merchandiseTotal,
    shippingFee,
    freeShipping,
    freeShippingThreshold: threshold,
    amountToFreeShipping: threshold === null ? 0 : Math.max(0, threshold - merchandiseTotal),
    total: merchandiseTotal + shippingFee,
  };
}

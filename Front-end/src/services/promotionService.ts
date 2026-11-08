import type { CartLine, PriceQuote, Product, Promotion, ShopSettings } from '../types'
import { api } from './api'

/** Chương trình khuyến mãi kèm cờ "đang chạy" và danh sách sản phẩm áp dụng */
export type PromotionWithProducts = Promotion & { running: boolean; products: Product[] }

/** GET /api/promotions — danh sách chương trình kèm sản phẩm áp dụng */
export function getPromotions() {
  return api.get<PromotionWithProducts[]>('/promotions')
}

/** GET /api/promotions/pricing-context — dữ liệu để FE tự hiển thị giá (BE vẫn tính lại khi tạo đơn). */
export function getPricingContext() {
  return api.get<{ promotions: Promotion[]; settings: ShopSettings }>('/promotions/pricing-context')
}

/** POST /api/promotions/quote — tính tiền giỏ hàng (giá, giảm giá, phí ship, tổng). */
export function quoteCart(cart: CartLine[]) {
  return api.post<PriceQuote>('/promotions/quote', {
    items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
  })
}

export type { Promotion }

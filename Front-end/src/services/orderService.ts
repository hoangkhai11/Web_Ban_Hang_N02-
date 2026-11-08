import type { CartLine, Order, ShippingInfo } from '../types'
import { api } from './api'

/** Dữ liệu đặt hàng từ trang thanh toán */
export interface CreateOrderInput {
  items: CartLine[]
  shipping: ShippingInfo
}

/**
 * POST /api/orders
 * Client chỉ gửi productId + số lượng + thông tin nhận hàng.
 * Giá, khuyến mãi, phí ship và tổng tiền đều được TÍNH LẠI ở server; tồn kho được kiểm tra và trừ ngay.
 */
export function createOrder(input: CreateOrderInput) {
  return api.post<Order>('/orders', {
    items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
    shipping: input.shipping,
    paymentMethod: 'COD',
  })
}

/** GET /api/orders/my */
export function getMyOrders() {
  return api.get<Order[]>('/orders/my')
}

/** GET /api/orders/my/:code — chỉ xem được đơn của chính mình */
export function getMyOrder(code: string) {
  return api.get<Order>(`/orders/my/${encodeURIComponent(code)}`)
}

/** PATCH /api/orders/my/:code/cancel — khách chỉ được hủy khi đơn còn "Chờ xác nhận" */
export function cancelMyOrder(code: string) {
  return api.patch<Order>(`/orders/my/${encodeURIComponent(code)}/cancel`)
}

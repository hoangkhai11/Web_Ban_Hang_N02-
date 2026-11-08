import type { OrderStatus, PaymentStatus } from '../types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang chuẩn bị hàng',
  SHIPPING: 'Đang giao hàng',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-sky-100 text-sky-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800',
  SHIPPING: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  REFUNDED: 'Đã hoàn tiền',
}

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  UNPAID: 'bg-slate-100 text-slate-700',
  PAID: 'bg-emerald-100 text-emerald-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
}

/** Các bước chuyển trạng thái hợp lệ (Admin Order Flow — LAB 4). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED']

/** Các bước chuyển trạng thái thanh toán hợp lệ — GIỐNG Back-end (common/order-status.ts). */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: ['PAID'],
  PAID: ['UNPAID', 'REFUNDED'],
  REFUNDED: [],
}

/** Trạng thái thanh toán có thể chuyển tới; đơn đã hủy thì không đổi được nữa. */
export function allowedPaymentStatuses(status: OrderStatus, payment: PaymentStatus): PaymentStatus[] {
  return status === 'CANCELLED' ? [] : PAYMENT_TRANSITIONS[payment]
}

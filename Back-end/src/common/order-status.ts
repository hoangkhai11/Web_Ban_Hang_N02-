import { OrderStatus, PaymentStatus } from '@prisma/client';

/** Tên hiển thị tiếng Việt của trạng thái đơn (dùng trong thông báo lỗi). */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang chuẩn bị hàng',
  SHIPPING: 'Đang giao hàng',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

/** Các bước chuyển trạng thái hợp lệ (Admin Order Flow — LAB 4). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Các bước chuyển trạng thái thanh toán hợp lệ:
 * - Chưa thu → Đã thu.
 * - Đã thu → Hoàn tiền, hoặc về Chưa thu (sửa nhầm khi đối soát).
 * - Đã hoàn tiền: kết thúc.
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: ['PAID'],
  PAID: ['UNPAID', 'REFUNDED'],
  REFUNDED: [],
};

/** Trạng thái thanh toán có thể chuyển tới; đơn đã hủy thì không đổi được nữa (hủy đơn đã tự xử lý hoàn tiền). */
export function allowedPaymentStatuses(status: OrderStatus, payment: PaymentStatus): PaymentStatus[] {
  return status === 'CANCELLED' ? [] : PAYMENT_TRANSITIONS[payment];
}

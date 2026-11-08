import type { Category, Order, OrderStatus, Paginated, PaymentStatus, Product, Promotion, ShopSettings, User } from '../types'
import { api } from './api'

/** Mọi API Admin đều yêu cầu JWT có vai trò ADMIN (RolesGuard ở NestJS kiểm tra), không chỉ ẩn nút ở giao diện. */

// ================= Dashboard / thống kê =================

export type DashboardDays = 7 | 30 | 90

export interface DashboardData {
  days: DashboardDays
  revenue: number
  totalOrders: number
  pendingOrders: number
  statusCounts: { status: OrderStatus; count: number }[]
  customers: number
  products: number
  inventory: { units: number; value: number; outOfStock: number }
  period: { revenue: number; orders: number; completedOrders: number; cancelledOrders: number; averageOrderValue: number }
  lowStock: Product[]
  recentOrders: Order[]
  revenueByDay: { date: string; revenue: number }[]
  topProducts: { productId: number; code: string; name: string; image: string; stock: number; quantity: number; revenue: number }[]
  revenueByCategory: { name: string; revenue: number }[]
}

/** GET /api/admin/dashboard?days=7|30|90 — doanh thu chỉ tính đơn COMPLETED */
export function getDashboard(days: DashboardDays = 7) {
  return api.get<DashboardData>('/admin/dashboard', { days })
}

// ================= Sản phẩm =================

export type ProductInput = Omit<Product, 'id' | 'slug' | 'soldCount' | 'createdAt' | 'isActive'>

/** GET /api/admin/products */
export function listProducts() {
  return api.get<Product[]>('/admin/products')
}

/** GET /api/admin/products/:id */
export function getProduct(id: number) {
  return api.get<Product>(`/admin/products/${id}`)
}

/** POST /api/admin/products */
export function createProduct(input: ProductInput) {
  return api.post<Product>('/admin/products', input)
}

/** PUT /api/admin/products/:id — tồn kho bị bỏ qua (chỉ sửa qua trang Kho hàng) */
export function updateProduct(id: number, input: ProductInput) {
  return api.put<Product>(`/admin/products/${id}`, input)
}

/** POST /api/admin/uploads — tải 1 ảnh từ thiết bị, trả về đường dẫn để lưu vào sản phẩm */
export function uploadProductImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  return api.post<{ url: string }>('/admin/uploads', body)
}

/** DELETE /api/admin/products/:id — xóa mềm để không làm mất lịch sử đơn hàng */
export function deleteProduct(id: number) {
  return api.delete<{ ok: true }>(`/admin/products/${id}`)
}

// ================= Kho hàng =================

/** PATCH /api/admin/inventory/:id — kiểm kê: đặt lại số lượng tồn kho */
export function updateStock(id: number, stock: number, note = '') {
  return api.patch<Product>(`/admin/inventory/${id}`, { stock, note })
}

/** POST /api/admin/inventory/:id/import — nhập thêm hàng */
export function importStock(id: number, quantity: number, note = '') {
  return api.post<Product>(`/admin/inventory/${id}/import`, { quantity, note })
}

/** POST /api/admin/inventory/:id/export — xuất kho (hàng lỗi, bảo hành...) */
export function exportStock(id: number, quantity: number, note = '') {
  return api.post<Product>(`/admin/inventory/${id}/export`, { quantity, note })
}

export type StockMovementType = 'IMPORT' | 'EXPORT' | 'ADJUST' | 'ORDER' | 'RETURN'

export interface StockMovement {
  id: number
  type: StockMovementType
  quantity: number
  stockAfter: number
  note: string
  orderCode: string | null
  createdAt: string
  product: Pick<Product, 'id' | 'code' | 'name'>
  userName: string | null
}

export interface MovementQuery {
  productId?: number
  type?: StockMovementType | ''
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

/** GET /api/admin/inventory/movements — lịch sử nhập / xuất / bán / hoàn kho */
export function listMovements(q: MovementQuery = {}) {
  return api.get<Paginated<StockMovement>>('/admin/inventory/movements', { ...q })
}

// ================= Danh mục =================

/** GET /api/admin/categories — kèm số sản phẩm */
export function listCategories() {
  return api.get<(Category & { productCount: number })[]>('/admin/categories')
}

export type CategoryInput = Pick<Category, 'name' | 'parentId' | 'description'>

/** POST /api/admin/categories */
export function createCategory(input: CategoryInput) {
  return api.post<Category>('/admin/categories', input)
}

/** PUT /api/admin/categories/:id */
export function updateCategory(id: number, input: CategoryInput) {
  return api.put<Category>(`/admin/categories/${id}`, input)
}

/** DELETE /api/admin/categories/:id */
export function deleteCategory(id: number) {
  return api.delete<{ ok: true }>(`/admin/categories/${id}`)
}

// ================= Đơn hàng =================

export type AdminOrderRow = Order & { customerEmail: string }

export interface OrderFilter {
  status?: OrderStatus | ''
  paymentStatus?: PaymentStatus | ''
  from?: string
  to?: string
  /** Tìm theo mã đơn, tên / SĐT người nhận, email */
  q?: string
  page?: number
  pageSize?: number
}

/** Tổng hợp trên TOÀN BỘ đơn khớp bộ lọc (không chỉ trang hiện tại) */
export interface OrderSummary {
  cancelled: number
  validTotal: number
  paid: number
  unpaid: number
  refunded: number
}

export type OrderListResult = Paginated<AdminOrderRow> & { summary: OrderSummary }

/** GET /api/admin/orders?status=&paymentStatus=&from=&to=&q=&page=&pageSize= */
export function listOrders(filter: OrderFilter = {}) {
  return api.get<OrderListResult>('/admin/orders', { ...filter })
}

/** Lấy tất cả đơn khớp bộ lọc (gọi lần lượt từng trang 100 đơn) — dùng cho xuất CSV */
export async function listAllOrders(filter: Omit<OrderFilter, 'page' | 'pageSize'> = {}) {
  const all: AdminOrderRow[] = []
  for (let page = 1; ; page++) {
    const r = await listOrders({ ...filter, page, pageSize: 100 })
    all.push(...r.items)
    if (page >= r.totalPages) return all
  }
}

/** GET /api/admin/orders/:code — kèm tồn kho hiện tại để kiểm tra */
export function getOrder(code: string) {
  return api.get<{
    order: Order
    customer: Pick<User, 'id' | 'fullName' | 'email' | 'phone'> | null
    stock: Record<number, number>
  }>(`/admin/orders/${encodeURIComponent(code)}`)
}

/** PATCH /api/admin/orders/:code/status */
export function updateOrderStatus(code: string, status: OrderStatus, note = '') {
  return api.patch<Order>(`/admin/orders/${encodeURIComponent(code)}/status`, { status, note })
}

/** PATCH /api/admin/orders/:code/payment — quản lý thanh toán tách riêng với trạng thái đơn */
export function updatePaymentStatus(code: string, paymentStatus: PaymentStatus) {
  return api.patch<Order>(`/admin/orders/${encodeURIComponent(code)}/payment`, { paymentStatus })
}

// ================= Khách hàng (nâng cao) =================

/** GET /api/admin/customers */
export function listCustomers() {
  return api.get<(User & { orderCount: number; totalSpent: number })[]>('/admin/customers')
}

// ================= Khuyến mãi (nâng cao) =================

/** GET /api/admin/promotions */
export function getPromotionSettings() {
  return api.get<{ promotions: Promotion[]; settings: ShopSettings }>('/admin/promotions')
}

/** PUT /api/admin/promotions/:id */
export function updatePromotion(id: number, input: Omit<Promotion, 'id' | 'type'>) {
  return api.put<Promotion>(`/admin/promotions/${id}`, input)
}

/** PUT /api/admin/settings */
export function updateSettings(settings: ShopSettings) {
  return api.put<ShopSettings>('/admin/settings', { baseShippingFee: settings.baseShippingFee })
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { orderInclude, slugify, toOrderDto, toProductDto, toPromotionDto, toUserDto } from '../common/mappers.js';
import { allowedPaymentStatuses, ORDER_STATUS_LABEL, ORDER_TRANSITIONS } from '../common/order-status.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SETTING_SHIPPING_FEE } from '../promotions/promotions.service.js';
import { ATTRIBUTE_KEYS } from '../products/dto/product-query.dto.js';
import { restockOrder } from '../orders/orders.service.js';
import { logStock } from '../common/stock.js';
import { imageExtension, uploadDir } from '../common/upload.js';
import type { CategoryInputDto, MovementQueryDto, OrderQueryDto, ProductInputDto, PromotionInputDto } from './dto/admin.dto.js';

/** Số danh mục con tối đa trong mỗi danh mục cấp 1 (LAB 6). */
const MAX_CHILDREN = 4;

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { UNPAID: 'Chưa thanh toán', PAID: 'Đã thanh toán', REFUNDED: 'Đã hoàn tiền' };

/** Lọc theo ngày tạo (YYYY-MM-DD, giờ máy chủ); "to" tính hết ngày đó. */
function dateRange(from?: string, to?: string) {
  if (!from && !to) return {};
  const end = to ? new Date(`${to}T00:00:00`) : undefined;
  end?.setDate(end.getDate() + 1);
  return { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(end ? { lt: end } : {}) } };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= Dashboard =================

  /** Doanh thu CHỈ tính đơn COMPLETED (theo ngày hoàn thành); đơn hủy không được tính. */
  async dashboard(days = 7) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [revenue, totalOrders, groups, customers, stockRows, lowStock, recent, completedInPeriod, periodOrders, topGroups, categoryItems] = await Promise.all([
      this.prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { total: true } }),
      this.prisma.order.count(),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.product.findMany({ where: { isActive: true }, select: { price: true, stock: true } }),
      this.prisma.product.findMany({ where: { isActive: true, stock: { lte: 5 } }, orderBy: { stock: 'asc' }, include: { attributes: true } }),
      this.prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: orderInclude }),
      this.prisma.order.findMany({ where: { status: 'COMPLETED', completedAt: { gte: since } }, select: { total: true, completedAt: true } }),
      this.prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      // Bán chạy: tính theo đơn đặt trong kỳ, không tính đơn đã hủy
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: since }, status: { not: 'CANCELLED' } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      // Doanh thu theo danh mục cấp 1: chỉ đơn hoàn thành trong kỳ (tiền hàng, không gồm phí ship)
      this.prisma.orderItem.findMany({
        where: { order: { status: 'COMPLETED', completedAt: { gte: since } } },
        select: { lineTotal: true, product: { select: { category: { select: { name: true, parent: { select: { name: true } } } } } } },
      }),
    ]);

    // Doanh thu từng ngày trong kỳ (ngày không có đơn = 0) để vẽ biểu đồ
    const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const revenueByDay = [...Array(days)].map((_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = localKey(d);
      return { date: key, revenue: completedInPeriod.filter((o) => o.completedAt && localKey(o.completedAt) === key).reduce((s, o) => s + o.total, 0) };
    });

    // Bổ sung tên, ảnh, tồn kho cho top 5 sản phẩm bán chạy
    const topInfo = await this.prisma.product.findMany({
      where: { id: { in: topGroups.map((g) => g.productId) } },
      select: { id: true, code: true, name: true, images: true, stock: true },
    });
    const topProducts = topGroups.map((g) => {
      const p = topInfo.find((x) => x.id === g.productId);
      return {
        productId: g.productId,
        code: p?.code ?? '',
        name: p?.name ?? '',
        image: (p?.images as string[] | undefined)?.[0] ?? '',
        stock: p?.stock ?? 0,
        quantity: g._sum.quantity ?? 0,
        revenue: g._sum.lineTotal ?? 0,
      };
    });

    // Gộp doanh thu về danh mục cấp 1 (sản phẩm luôn nằm ở danh mục cấp 2)
    const byCategory = new Map<string, number>();
    for (const i of categoryItems) {
      const c = i.product.category;
      const name = c.parent?.name ?? c.name;
      byCategory.set(name, (byCategory.get(name) ?? 0) + i.lineTotal);
    }

    const count = (s: OrderStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
    const periodCount = (s?: OrderStatus) => periodOrders.filter((g) => !s || g.status === s).reduce((n, g) => n + g._count._all, 0);
    const periodRevenue = completedInPeriod.reduce((s, o) => s + o.total, 0);
    return {
      days,
      revenue: revenue._sum.total ?? 0,
      totalOrders,
      pendingOrders: count('PENDING'),
      statusCounts: (Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => ({ status, count: count(status) })),
      customers,
      products: stockRows.length,
      inventory: {
        units: stockRows.reduce((s, p) => s + p.stock, 0),
        value: stockRows.reduce((s, p) => s + p.stock * p.price, 0),
        outOfStock: stockRows.filter((p) => p.stock === 0).length,
      },
      period: {
        revenue: periodRevenue,
        orders: periodCount(),
        completedOrders: completedInPeriod.length,
        cancelledOrders: periodCount('CANCELLED'),
        averageOrderValue: completedInPeriod.length ? Math.round(periodRevenue / completedInPeriod.length) : 0,
      },
      lowStock: lowStock.map(toProductDto),
      recentOrders: recent.map(toOrderDto),
      revenueByDay,
      topProducts,
      revenueByCategory: [...byCategory].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
    };
  }

  // ================= Sản phẩm =================

  /** Danh sách sản phẩm đang kinh doanh (sản phẩm đã xóa mềm bị ẩn). */
  listProducts() {
    return this.prisma.product
      .findMany({ where: { isActive: true }, include: { attributes: true }, orderBy: { id: 'asc' } })
      .then((l) => l.map(toProductDto));
  }

  /** Lấy 1 sản phẩm đang kinh doanh, không có thì 404. Dùng lại để kiểm tra tồn tại ở các hàm khác. */
  async getProduct(id: number) {
    const p = await this.prisma.product.findFirst({ where: { id, isActive: true }, include: { attributes: true } });
    if (!p) throw new NotFoundException('Không tìm thấy sản phẩm');
    return toProductDto(p);
  }

  /** Sản phẩm phải thuộc danh mục cấp 2 và mã sản phẩm không trùng với sản phẩm khác. */
  private async validateProduct(dto: ProductInputDto, id?: number) {
    const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!cat || cat.parentId === null) throw new BadRequestException('Sản phẩm phải thuộc một danh mục cấp 2');
    const dup = await this.prisma.product.findUnique({ where: { code: dto.code } });
    if (dup && dup.id !== id) throw new ConflictException('Mã sản phẩm đã tồn tại');
  }

  /** Chỉ giữ các khóa thuộc tính chuẩn và giá trị không rỗng */
  private attributeRows(attrs: Record<string, string>) {
    return Object.entries(attrs)
      .filter(([k, v]) => (ATTRIBUTE_KEYS as readonly string[]).includes(k) && typeof v === 'string' && v.trim())
      .map(([key, value]) => ({ key, value: value.trim() }));
  }

  /** Chuyển DTO thành dữ liệu ghi DB; slug sinh từ mã + tên. Không gồm tồn kho (xem createProduct / trang Kho hàng). */
  private productData(dto: ProductInputDto) {
    return {
      code: dto.code,
      slug: slugify(dto.code + '-' + dto.name),
      name: dto.name,
      categoryId: dto.categoryId,
      brand: dto.brand,
      price: dto.price,
      warrantyMonths: dto.warrantyMonths,
      images: dto.images,
      highlights: dto.highlights,
      description: dto.description,
      specs: dto.specs,
      compatibilityNote: dto.compatibilityNote || null,
    };
  }

  /** Thêm sản phẩm + thuộc tính lọc; ghi tồn kho ban đầu là 1 lần nhập kho. */
  async createProduct(dto: ProductInputDto, userId?: number) {
    await this.validateProduct(dto);
    const p = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...this.productData(dto), stock: dto.stock, attributes: { create: this.attributeRows(dto.attributes) } },
        include: { attributes: true },
      });
      await logStock(tx, { productId: created.id, type: 'IMPORT', quantity: created.stock, note: 'Tồn kho ban đầu khi thêm sản phẩm', userId });
      return created;
    });
    return toProductDto(p);
  }

  /**
   * Sửa thông tin sản phẩm + thay toàn bộ thuộc tính lọc.
   * KHÔNG sửa tồn kho ở đây: form có thể đã mở từ trước khi khách đặt hàng, ghi đè số cũ sẽ làm sai tồn kho.
   * Tồn kho chỉ thay đổi qua nhập / xuất / kiểm kê (trang Kho hàng) và đơn hàng.
   */
  async updateProduct(id: number, dto: ProductInputDto) {
    await this.getProduct(id);
    await this.validateProduct(dto, id);
    const p = await this.prisma.$transaction(async (tx) => {
      await tx.productAttribute.deleteMany({ where: { productId: id } });
      return tx.product.update({
        where: { id },
        data: { ...this.productData(dto), attributes: { create: this.attributeRows(dto.attributes) } },
        include: { attributes: true },
      });
    });
    return toProductDto(p);
  }

  /** Xóa mềm: ẩn khỏi cửa hàng nhưng giữ nguyên lịch sử đơn hàng (order_items tham chiếu sản phẩm). */
  async deleteProduct(id: number) {
    await this.getProduct(id);
    // đổi mã để có thể tạo lại sản phẩm cùng mã sau này
    await this.prisma.product.update({ where: { id }, data: { isActive: false, code: `DEL${id}-${Date.now()}`.slice(0, 50), slug: `deleted-${id}-${Date.now()}` } });
    return { ok: true };
  }

  // ================= Kho hàng =================

  /** Điều chỉnh theo kiểm kê: đặt tồn kho = số đếm thực tế, ghi phần chênh lệch. */
  async updateStock(id: number, stock: number, note = '', userId?: number) {
    const before = await this.getProduct(id);
    const p = await this.prisma.$transaction(async (tx) => {
      // Chỉ ghi khi tồn kho chưa bị đơn hàng khác thay đổi kể từ lúc đọc → chênh lệch ghi vào lịch sử luôn đúng
      const r = await tx.product.updateMany({ where: { id, stock: before.stock }, data: { stock } });
      if (r.count === 0) throw new ConflictException('Tồn kho vừa thay đổi (có đơn hàng mới), vui lòng tải lại và kiểm kê lại');
      await logStock(tx, { productId: id, type: 'ADJUST', quantity: stock - before.stock, note: note || 'Điều chỉnh tồn kho (kiểm kê)', userId });
      return tx.product.findUniqueOrThrow({ where: { id }, include: { attributes: true } });
    });
    return toProductDto(p);
  }

  /** Nhập hàng: cộng thêm số lượng vào tồn kho. */
  async importStock(id: number, quantity: number, note = '', userId?: number) {
    await this.getProduct(id);
    const p = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: { stock: { increment: quantity } }, include: { attributes: true } });
      await logStock(tx, { productId: id, type: 'IMPORT', quantity, note: note || 'Nhập hàng', userId });
      return updated;
    });
    return toProductDto(p);
  }

  /** Lưu ảnh sản phẩm với tên ngẫu nhiên; chỉ nhận ảnh thật (kiểm tra nội dung file). */
  async saveImage(data?: Buffer) {
    if (!data?.length) throw new BadRequestException('Vui lòng chọn ảnh');
    const extension = imageExtension(data);
    if (!extension) throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
    const name = `${randomUUID()}.${extension}`;
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(join(uploadDir(), name), data);
    return { url: `/api/uploads/${name}` };
  }

  /** Xuất kho ngoài bán hàng (hàng lỗi, bảo hành, trưng bày...) — không cho xuất vượt tồn. */
  async exportStock(id: number, quantity: number, note = '', userId?: number) {
    await this.getProduct(id);
    const p = await this.prisma.$transaction(async (tx) => {
      const r = await tx.product.updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
      if (r.count === 0) {
        const now = await tx.product.findUnique({ where: { id } });
        throw new ConflictException(`Không đủ hàng để xuất (tồn kho hiện tại: ${now?.stock ?? 0})`);
      }
      await logStock(tx, { productId: id, type: 'EXPORT', quantity: -quantity, note: note || 'Xuất kho', userId });
      return tx.product.findUniqueOrThrow({ where: { id }, include: { attributes: true } });
    });
    return toProductDto(p);
  }

  /** Lịch sử nhập / xuất / điều chỉnh / bán / hoàn kho. */
  async listMovements(q: MovementQueryDto) {
    const where: Prisma.StockMovementWhereInput = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...dateRange(q.from, q.to),
    };
    const pageSize = q.pageSize ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: ((q.page ?? 1) - 1) * pageSize,
        take: pageSize,
        include: { product: { select: { id: true, code: true, name: true } }, user: { select: { fullName: true } } },
      }),
    ]);
    return {
      items: rows.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        stockAfter: m.stockAfter,
        note: m.note,
        orderCode: m.orderCode,
        createdAt: m.createdAt.toISOString(),
        product: m.product,
        userName: m.user?.fullName ?? null,
      })),
      total,
      page: q.page ?? 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ================= Danh mục =================

  /** Tất cả danh mục kèm số sản phẩm đang kinh doanh. */
  async listCategories() {
    const list = await this.prisma.category.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });
    return list.map(({ _count, createdAt: _c, ...c }) => ({ ...c, productCount: _count.products }));
  }

  /** Quy tắc LAB 6: đúng 3 danh mục cấp 1 (cố định), tối đa 4 danh mục con/nhóm, tối đa 2 cấp. */
  private async validateChild(dto: CategoryInputDto, id?: number) {
    if (dto.parentId == null) throw new BadRequestException('Hệ thống cố định 3 danh mục cấp 1 (LAB 6). Chỉ được thêm danh mục con.');
    const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId }, include: { children: true } });
    if (!parent || parent.parentId !== null) throw new BadRequestException('Danh mục cha phải là danh mục cấp 1');
    const siblings = parent.children.filter((c) => c.id !== id);
    if (siblings.length >= MAX_CHILDREN) throw new BadRequestException(`"${parent.name}" đã có đủ ${MAX_CHILDREN} danh mục con`);
    if (siblings.some((c) => c.name.toLowerCase() === dto.name.toLowerCase())) throw new ConflictException('Tên danh mục đã tồn tại trong nhóm');
  }

  /** Thêm danh mục cấp 2; slug trùng thì thêm hậu tố số. */
  async createCategory(dto: CategoryInputDto) {
    await this.validateChild(dto);
    let slug = slugify(dto.name);
    if (await this.prisma.category.findUnique({ where: { slug } })) slug = `${slug}-${Date.now() % 10000}`;
    return this.prisma.category.create({ data: { name: dto.name, slug, parentId: dto.parentId, description: dto.description ?? '' } });
  }

  /** Sửa danh mục: cấp 1 chỉ đổi tên/mô tả; cấp 2 được đổi cả danh mục cha. */
  async updateCategory(id: number, dto: CategoryInputDto) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Không tìm thấy danh mục');
    if (cat.parentId === null) {
      // cấp 1: chỉ đổi tên & mô tả, không đổi cấp
      return this.prisma.category.update({ where: { id }, data: { name: dto.name, description: dto.description ?? '' } });
    }
    await this.validateChild(dto, id);
    return this.prisma.category.update({ where: { id }, data: { name: dto.name, parentId: dto.parentId, description: dto.description ?? '' } });
  }

  /** Xóa danh mục cấp 2 khi không còn sản phẩm nào (kể cả sản phẩm đã xóa mềm). */
  async deleteCategory(id: number) {
    const cat = await this.prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!cat) throw new NotFoundException('Không tìm thấy danh mục');
    if (cat.parentId === null) throw new BadRequestException('Không thể xóa danh mục cấp 1');
    if (cat._count.products > 0) throw new ConflictException('Danh mục đang có sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước');
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  // ================= Đơn hàng =================

  /**
   * Danh sách đơn hàng có phân trang (mới nhất trước) kèm email khách.
   * `summary` tổng hợp trên TOÀN BỘ đơn khớp bộ lọc (không chỉ trang hiện tại) để đối soát tiền thu.
   */
  async listOrders(q: OrderQueryDto = {}) {
    const term = q.q?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
      ...dateRange(q.from, q.to),
      // Tìm theo mã đơn, tên / SĐT người nhận, email tài khoản
      ...(term
        ? { OR: [{ code: { contains: term } }, { shipFullName: { contains: term } }, { shipPhone: { contains: term } }, { user: { email: { contains: term } } }] }
        : {}),
    };
    const pageSize = q.pageSize ?? 20;
    const [total, groups] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status', 'paymentStatus'], where, _count: { _all: true }, _sum: { total: true } }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(q.page ?? 1, totalPages);
    const list = await this.prisma.order.findMany({
      where,
      include: { ...orderInclude, user: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const sum = (keep: (g: (typeof groups)[number]) => boolean) => groups.filter(keep).reduce((s, g) => s + (g._sum.total ?? 0), 0);
    return {
      items: list.map((o) => ({ ...toOrderDto(o), customerEmail: o.user.email })),
      total,
      page,
      pageSize,
      totalPages,
      summary: {
        cancelled: groups.filter((g) => g.status === 'CANCELLED').reduce((n, g) => n + g._count._all, 0),
        validTotal: sum((g) => g.status !== 'CANCELLED'),
        paid: sum((g) => g.paymentStatus === 'PAID'),
        unpaid: sum((g) => g.paymentStatus === 'UNPAID' && g.status !== 'CANCELLED'),
        refunded: sum((g) => g.paymentStatus === 'REFUNDED'),
      },
    };
  }

  /** Chi tiết đơn + thông tin khách + tồn kho hiện tại của từng sản phẩm trong đơn. */
  async getOrder(code: string) {
    const order = await this.prisma.order.findUnique({ where: { code }, include: { ...orderInclude, user: true } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const products = await this.prisma.product.findMany({ where: { id: { in: order.items.map((i) => i.productId) } }, select: { id: true, stock: true } });
    return {
      order: toOrderDto(order),
      customer: { id: order.user.id, fullName: order.user.fullName, email: order.user.email, phone: order.user.phone },
      stock: Object.fromEntries(products.map((p) => [p.id, p.stock])),
    };
  }

  /**
   * Chuyển trạng thái đơn theo quy trình ORDER_TRANSITIONS.
   * Hoàn thành → đánh dấu đã thu tiền (COD); Hủy → hoàn kho, đã thu thì chuyển sang hoàn tiền.
   */
  async updateOrderStatus(code: string, status: OrderStatus, note = '') {
    const order = await this.prisma.order.findUnique({ where: { code } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!ORDER_TRANSITIONS[order.status].includes(status))
      throw new ConflictException(`Không thể chuyển từ "${ORDER_STATUS_LABEL[order.status]}" sang "${ORDER_STATUS_LABEL[status]}"`);

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.OrderUpdateManyMutationInput = { status };
      if (status === 'COMPLETED') {
        data.paymentStatus = 'PAID'; // COD: giao thành công = đã thu tiền
        data.completedAt = new Date();
      }
      if (status === 'CANCELLED' && order.paymentStatus === 'PAID') data.paymentStatus = 'REFUNDED';
      // Cập nhật có điều kiện theo trạng thái cũ — tránh 2 thao tác đồng thời ghi đè nhau
      const r = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data });
      if (r.count === 0) throw new ConflictException('Đơn hàng vừa được cập nhật bởi người khác, vui lòng tải lại');
      if (status === 'CANCELLED') await restockOrder(tx, order.id);
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status, note } });
    });
    return (await this.getOrder(code)).order;
  }

  /** Cập nhật trạng thái thanh toán (đối soát thu tiền). */
  async updatePaymentStatus(code: string, paymentStatus: PaymentStatus) {
    const order = await this.prisma.order.findUnique({ where: { code } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!allowedPaymentStatuses(order.status, order.paymentStatus).includes(paymentStatus))
      throw new ConflictException(
        order.status === 'CANCELLED'
          ? 'Đơn đã hủy, không thể thay đổi trạng thái thanh toán'
          : `Không thể chuyển thanh toán từ "${PAYMENT_STATUS_LABEL[order.paymentStatus]}" sang "${PAYMENT_STATUS_LABEL[paymentStatus]}"`,
      );
    // Cập nhật có điều kiện theo trạng thái cũ — tránh 2 thao tác đồng thời ghi đè nhau
    const r = await this.prisma.order.updateMany({
      where: { id: order.id, status: order.status, paymentStatus: order.paymentStatus },
      data: { paymentStatus },
    });
    if (r.count === 0) throw new ConflictException('Đơn hàng vừa được cập nhật bởi người khác, vui lòng tải lại');
    return (await this.getOrder(code)).order;
  }

  // ================= Khách hàng (nâng cao) =================

  /** Khách hàng + số đơn đã đặt + tổng chi tiêu (chỉ tính đơn hoàn thành). */
  async listCustomers() {
    const users = await this.prisma.user.findMany({ where: { role: 'CUSTOMER' }, include: { orders: { select: { status: true, total: true } } }, orderBy: { id: 'asc' } });
    return users.map(({ orders, ...u }) => ({
      ...toUserDto(u),
      orderCount: orders.length,
      totalSpent: orders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.total, 0),
    }));
  }

  // ================= Khuyến mãi (nâng cao) =================

  /** Tất cả chương trình khuyến mãi (kể cả đang tắt) + phí vận chuyển hiện tại. */
  async promotionSettings() {
    const promotions = await this.prisma.promotion.findMany({ include: { products: true }, orderBy: { id: 'asc' } });
    const fee = await this.prisma.setting.findUnique({ where: { key: SETTING_SHIPPING_FEE } });
    return { promotions: promotions.map(toPromotionDto), settings: { baseShippingFee: Number(fee?.value ?? 30000) } };
  }

  /** Sửa chương trình: thay toàn bộ danh sách sản phẩm áp dụng (bỏ qua id sản phẩm không tồn tại). */
  async updatePromotion(id: number, dto: PromotionInputDto) {
    const p = await this.prisma.promotion.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy chương trình');
    if (dto.startDate > dto.endDate) throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    if (p.type === 'PRODUCT_PERCENT' && (dto.value < 1 || dto.value > 99)) throw new BadRequestException('Phần trăm giảm phải từ 1 đến 99');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
      const valid = p.type === 'PRODUCT_PERCENT' ? await tx.product.findMany({ where: { id: { in: dto.productIds } }, select: { id: true } }) : [];
      return tx.promotion.update({
        where: { id },
        data: {
          name: dto.name,
          value: dto.value,
          minOrderValue: dto.minOrderValue,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isActive: dto.isActive,
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.conditions !== undefined && { conditions: dto.conditions }),
          products: { create: valid.map((x) => ({ productId: x.id })) },
        },
        include: { products: true },
      });
    });
    return toPromotionDto(updated);
  }

  /** Lưu phí vận chuyển vào bảng settings (tạo mới nếu chưa có). */
  async updateSettings(baseShippingFee: number) {
    await this.prisma.setting.upsert({
      where: { key: SETTING_SHIPPING_FEE },
      update: { value: String(baseShippingFee) },
      create: { key: SETTING_SHIPPING_FEE, value: String(baseShippingFee) },
    });
    return { baseShippingFee };
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { orderInclude, toOrderDto } from '../common/mappers.js';
import { logStock } from '../common/stock.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { MAX_QTY_PER_ITEM, type CreateOrderDto } from './dto/order.dto.js';

/**
 * Hoàn tồn kho cho đơn bị hủy — chỉ thực hiện MỘT lần nhờ điều kiện stockReleased = false.
 * Dùng chung cho khách hủy đơn và Admin hủy đơn.
 */
export async function restockOrder(tx: Prisma.TransactionClient, orderId: number) {
  const flagged = await tx.order.updateMany({ where: { id: orderId, stockReleased: false }, data: { stockReleased: true } });
  if (flagged.count === 0) return;
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const i of order.items) {
    await tx.product.update({
      where: { id: i.productId },
      data: { stock: { increment: i.quantity }, soldCount: { decrement: i.quantity } },
    });
    await logStock(tx, { productId: i.productId, type: 'RETURN', quantity: i.quantity, note: 'Hoàn kho do hủy đơn', orderCode: order.code });
  }
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionsService,
  ) {}

  /**
   * Tạo đơn COD trong 1 transaction: trừ tồn kho có điều kiện, lưu đơn + chi tiết + lịch sử,
   * sinh mã đơn GC + (100000 + id), ghi lịch sử kho. Lỗi ở bất kỳ bước nào → hoàn tác toàn bộ.
   */
  async create(userId: number, dto: CreateOrderDto) {
    // Gộp các dòng trùng sản phẩm
    const merged = new Map<number, number>();
    for (const i of dto.items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
    const items = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
    // Kiểm tra lại giới hạn sau khi gộp: gửi 2 dòng × 10 cùng sản phẩm không được vượt qua
    if (items.some((i) => i.quantity > MAX_QTY_PER_ITEM)) throw new BadRequestException(`Tối đa ${MAX_QTY_PER_ITEM} sản phẩm mỗi loại`);

    // Tính lại giá ở server với giá & khuyến mãi HIỆN TẠI
    const q = await this.promotions.quote(items);
    if (q.lines.length !== items.length) throw new BadRequestException('Có sản phẩm không còn kinh doanh trong giỏ hàng');

    const order = await this.prisma.$transaction(async (tx) => {
      // Trừ tồn kho có điều kiện: chỉ trừ khi stock >= số lượng (tránh bán vượt tồn khi nhiều người đặt cùng lúc)
      for (const l of q.lines) {
        const r = await tx.product.updateMany({
          where: { id: l.product.id, isActive: true, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity }, soldCount: { increment: l.quantity } },
        });
        if (r.count === 0) {
          const now = await tx.product.findUnique({ where: { id: l.product.id } });
          throw new ConflictException(`"${l.product.name}" chỉ còn ${now?.stock ?? 0} sản phẩm`);
        }
      }

      const created = await tx.order.create({
        data: {
          code: `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20), // mã tạm, đổi ngay bên dưới
          userId,
          subtotal: q.subtotal,
          discountTotal: q.discountTotal,
          shippingFee: q.shippingFee,
          total: q.total,
          status: 'PENDING',
          paymentMethod: 'COD',
          paymentStatus: 'UNPAID', // COD: chưa thanh toán khi vừa tạo đơn
          shipFullName: dto.shipping.fullName,
          shipPhone: dto.shipping.phone,
          shipProvince: dto.shipping.province,
          shipDistrict: dto.shipping.district,
          shipAddress: dto.shipping.address,
          shipNote: dto.shipping.note ?? '',
          items: {
            create: q.lines.map((l) => ({
              productId: l.product.id,
              productCode: l.product.code,
              productName: l.product.name,
              image: l.product.images[0] ?? '',
              originalPrice: l.originalPrice,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
            })),
          },
          history: { create: { status: 'PENDING', note: 'Đặt hàng thành công' } },
        },
      });
      const final = await tx.order.update({
        where: { id: created.id },
        data: { code: `GC${100000 + created.id}` },
        include: orderInclude,
      });
      for (const l of q.lines) {
        await logStock(tx, { productId: l.product.id, type: 'ORDER', quantity: -l.quantity, note: 'Bán theo đơn hàng', orderCode: final.code });
      }
      return final;
    });
    return toOrderDto(order);
  }

  /** Đơn hàng của khách đang đăng nhập, mới nhất trước. */
  async myOrders(userId: number) {
    const list = await this.prisma.order.findMany({ where: { userId }, include: orderInclude, orderBy: { createdAt: 'desc' } });
    return list.map(toOrderDto);
  }

  /** Khách chỉ xem được đơn của chính mình (đơn người khác trả 404, không lộ thông tin). */
  async myOrder(userId: number, code: string) {
    const order = await this.prisma.order.findUnique({ where: { code }, include: orderInclude });
    if (!order || order.userId !== userId) throw new NotFoundException('Không tìm thấy đơn hàng');
    return toOrderDto(order);
  }

  /** Khách chỉ được hủy khi đơn còn "Chờ xác nhận". */
  async cancelMine(userId: number, code: string) {
    const order = await this.prisma.order.findUnique({ where: { code } });
    if (!order || order.userId !== userId) throw new NotFoundException('Không tìm thấy đơn hàng');
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      if (r.count === 0) throw new ConflictException('Chỉ có thể hủy đơn khi đang chờ xác nhận');
      await restockOrder(tx, order.id);
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: 'CANCELLED', note: 'Khách hàng hủy đơn' } });
    });
    return this.myOrder(userId, code);
  }
}

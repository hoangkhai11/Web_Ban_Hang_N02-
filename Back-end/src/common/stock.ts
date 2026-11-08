import type { Prisma, StockMovementType } from '@prisma/client';

/**
 * Ghi 1 dòng lịch sử kho SAU KHI tồn kho đã được cập nhật (cùng transaction),
 * stockAfter lấy từ DB nên luôn khớp với số tồn thực tế.
 */
export async function logStock(
  tx: Prisma.TransactionClient,
  m: { productId: number; type: StockMovementType; quantity: number; note?: string; orderCode?: string; userId?: number },
) {
  if (m.quantity === 0) return;
  const p = await tx.product.findUniqueOrThrow({ where: { id: m.productId }, select: { stock: true } });
  await tx.stockMovement.create({
    data: {
      productId: m.productId,
      type: m.type,
      quantity: m.quantity,
      stockAfter: p.stock,
      note: m.note ?? '',
      orderCode: m.orderCode ?? null,
      userId: m.userId ?? null,
    },
  });
}

/**
 * Seed dữ liệu mẫu cho MySQL: 14 danh mục, 26 sản phẩm, 2 khuyến mãi, 2 tài khoản, 4 đơn mẫu.
 * Chạy: npm run db:seed   (CẢNH BÁO: xóa toàn bộ dữ liệu cũ trong các bảng trước khi seed)
 */
import { PrismaClient, type OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { quote } from '../src/common/pricing.js';
import { seedCategories } from './seed-data/categories';
import { seedProducts } from './seed-data/products';
import { seedPromotions, seedSettings } from './seed-data/promotions';
import { seedUsers } from './seed-data/users';

const prisma = new PrismaClient();

async function main() {
  console.log('Xóa dữ liệu cũ...');
  await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.promotionProduct.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.productAttribute.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany({ where: { parentId: { not: null } } }),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  console.log('Danh mục...');
  for (const c of [...seedCategories].sort((a, b) => (a.parentId ?? 0) - (b.parentId ?? 0))) {
    await prisma.category.create({ data: { id: c.id, slug: c.slug, name: c.name, parentId: c.parentId, description: c.description, icon: c.icon } });
  }

  console.log('Sản phẩm...');
  for (const p of seedProducts) {
    await prisma.product.create({
      data: {
        id: p.id,
        code: p.code,
        slug: p.slug,
        name: p.name,
        categoryId: p.categoryId,
        brand: p.brand,
        price: p.price,
        stock: p.stock,
        images: p.images,
        highlights: p.highlights,
        description: p.description,
        specs: p.specs,
        warrantyMonths: p.warrantyMonths,
        soldCount: p.soldCount,
        compatibilityNote: p.compatibilityNote ?? null,
        createdAt: new Date(p.createdAt + 'T08:00:00'),
        attributes: { create: Object.entries(p.attributes).map(([key, value]) => ({ key, value: value! })) },
        stockMovements: { create: { type: 'IMPORT', quantity: p.stock, stockAfter: p.stock, note: 'Tồn kho ban đầu', createdAt: new Date(p.createdAt + 'T08:00:00') } },
      },
    });
  }

  console.log('Khuyến mãi & cấu hình...');
  for (const p of seedPromotions) {
    await prisma.promotion.create({
      data: {
        id: p.id,
        name: p.name,
        type: p.type,
        value: p.value,
        minOrderValue: p.minOrderValue,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        isActive: p.isActive,
        description: p.description,
        conditions: p.conditions,
        products: { create: p.productIds.map((productId) => ({ productId })) },
      },
    });
  }
  await prisma.setting.create({ data: { key: 'base_shipping_fee', value: String(seedSettings.baseShippingFee) } });

  console.log('Tài khoản (mật khẩu băm bcrypt)...');
  for (const u of seedUsers) {
    await prisma.user.create({
      data: { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, address: u.address, role: u.role, passwordHash: await bcrypt.hash(u.password, 10), createdAt: new Date(u.createdAt) },
    });
  }

  console.log('Đơn hàng mẫu...');
  const customer = seedUsers.find((u) => u.role === 'CUSTOMER')!;
  const pricingPromos = seedPromotions.map((p) => ({ ...p }));
  const samples: { daysAgo: number; cart: { productId: number; quantity: number }[]; status: OrderStatus }[] = [
    { daysAgo: 12, cart: [{ productId: 3, quantity: 1 }, { productId: 20, quantity: 1 }], status: 'COMPLETED' },
    { daysAgo: 3, cart: [{ productId: 13, quantity: 2 }], status: 'SHIPPING' },
    { daysAgo: 1, cart: [{ productId: 19, quantity: 1 }], status: 'PENDING' },
    { daysAgo: 6, cart: [{ productId: 25, quantity: 1 }], status: 'CANCELLED' },
  ];
  const flow: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED'];
  for (const [idx, s] of samples.entries()) {
    const id = idx + 1;
    const q = quote(s.cart, seedProducts, pricingPromos, seedSettings.baseShippingFee);
    const createdAt = new Date(Date.now() - s.daysAgo * 86_400_000);
    const steps = s.status === 'CANCELLED' ? (['PENDING', 'CANCELLED'] as OrderStatus[]) : flow.slice(0, flow.indexOf(s.status) + 1);
    const at = (i: number) => new Date(createdAt.getTime() + i * 6 * 3_600_000);
    await prisma.order.create({
      data: {
        id,
        code: `GC${100000 + id}`,
        userId: customer.id,
        subtotal: q.subtotal,
        discountTotal: q.discountTotal,
        shippingFee: q.shippingFee,
        total: q.total,
        status: s.status,
        paymentStatus: s.status === 'COMPLETED' ? 'PAID' : 'UNPAID',
        shipFullName: customer.fullName,
        shipPhone: customer.phone,
        shipProvince: 'Hà Nội',
        shipDistrict: 'Quận Cầu Giấy',
        shipAddress: customer.address,
        stockReleased: s.status === 'CANCELLED',
        completedAt: s.status === 'COMPLETED' ? at(steps.length - 1) : null,
        createdAt,
        items: {
          create: q.lines.map((l) => ({
            productId: l.product.id,
            productCode: l.product.code,
            productName: l.product.name,
            image: l.product.images[0],
            originalPrice: l.originalPrice,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          })),
        },
        history: { create: steps.map((st, i) => ({ status: st, createdAt: at(i), note: i === 0 ? 'Đặt hàng thành công' : st === 'CANCELLED' ? 'Khách hàng yêu cầu hủy' : '' })) },
      },
    });
  }

  const counts = await Promise.all([prisma.category.count(), prisma.product.count(), prisma.promotion.count(), prisma.user.count(), prisma.order.count()]);
  console.log(`Hoàn tất: ${counts[0]} danh mục, ${counts[1]} sản phẩm, ${counts[2]} khuyến mãi, ${counts[3]} tài khoản, ${counts[4]} đơn hàng.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

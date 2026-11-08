import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { toProductDto } from '../common/mappers.js';
import { getUnitPrice, isPromotionRunning } from '../common/pricing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { ATTRIBUTE_KEYS, PRICE_RANGES, type ProductQueryDto } from './dto/product-query.dto.js';

/** Luôn nạp kèm thuộc tính lọc để dùng toProductDto */
const include = { attributes: true } as const;

// Sắp xếp giá trị thuộc tính tự nhiên: 8 GB < 16 GB < 1 TB
const toNumber = (v: string) => {
  const m = v.match(/([\d.]+)\s*(TB|GB|inch)?/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return m[2]?.toUpperCase() === 'TB' ? n * 1024 : n;
};
const sortValues = (vs: string[]) =>
  vs.sort((a, b) => {
    const [na, nb] = [toNumber(a), toNumber(b)];
    return !isNaN(na) && !isNaN(nb) && na !== nb ? na - nb : a.localeCompare(b, 'vi');
  });

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionsService,
  ) {}

  /** Id danh mục và các danh mục con của nó */
  private async categoryScope(slug: string) {
    const cat = await this.prisma.category.findUnique({ where: { slug }, include: { children: true } });
    if (!cat) throw new NotFoundException('Không tìm thấy danh mục');
    return [cat.id, ...cat.children.map((c) => c.id)];
  }

  /** Danh sách sản phẩm cho trang danh mục / tìm kiếm, kèm facet để dựng bộ lọc. */
  async list(query: ProductQueryDto) {
    // 1) Điều kiện nền: còn kinh doanh + danh mục + từ khóa (tìm theo tên, mã, thương hiệu, thông số)
    const base: Prisma.ProductWhereInput[] = [{ isActive: true }];
    if (query.category) base.push({ categoryId: { in: await this.categoryScope(query.category) } });
    for (const term of (query.q ?? '').trim().split(/\s+/).filter(Boolean)) {
      base.push({
        OR: [
          { name: { contains: term } },
          { code: { contains: term } },
          { brand: { contains: term } },
          { attributes: { some: { value: { contains: term } } } },
        ],
      });
    }

    // 2) Facet (giá trị bộ lọc khả dụng) tính trên điều kiện nền
    const [brandGroups, attrRows] = await Promise.all([
      this.prisma.product.groupBy({ by: ['brand'], where: { AND: base }, _count: { _all: true }, orderBy: { brand: 'asc' } }),
      this.prisma.productAttribute.findMany({ where: { product: { AND: base } }, distinct: ['key', 'value'], select: { key: true, value: true } }),
    ]);
    const attributes: Record<string, string[]> = {};
    for (const r of attrRows) (attributes[r.key] ??= []).push(r.value);
    for (const k of Object.keys(attributes)) sortValues(attributes[k]);

    // 3) Bộ lọc người dùng chọn — thực hiện bằng truy vấn MySQL
    const where: Prisma.ProductWhereInput[] = [...base];
    if (query.brand?.length) where.push({ brand: { in: query.brand } });
    for (const key of ATTRIBUTE_KEYS) {
      const values = query[key];
      if (values?.length) where.push({ attributes: { some: { key, value: { in: values } } } });
    }
    if (query.stock === '1') where.push({ stock: { gt: 0 } });

    const promotions = await this.promotions.getPricingPromotions();
    if (query.promo === '1') {
      // Chỉ chương trình giảm giá ĐANG CHẠY (đang bật và hôm nay nằm trong khoảng ngày áp dụng)
      const ids = promotions.filter((p) => p.type === 'PRODUCT_PERCENT' && isPromotionRunning(p)).flatMap((p) => p.productIds);
      where.push({ id: { in: ids } });
    }

    let items = (await this.prisma.product.findMany({ where: { AND: where }, include })).map(toProductDto);

    // 4) Lọc/sắp xếp theo GIÁ BÁN THỰC TẾ (sau khuyến mãi) — giá này phụ thuộc chương trình đang chạy
    //    nên được tính ở tầng service thay vì cột trong DB.
    const priceOf = (p: { id: number; price: number }) => getUnitPrice(p, promotions);
    if (query.price) {
      const [min, max] = PRICE_RANGES[query.price];
      items = items.filter((p) => priceOf(p) >= min && priceOf(p) < max);
    }
    switch (query.sort ?? 'popular') {
      case 'newest':
        items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        break;
      case 'price-asc':
        items.sort((a, b) => priceOf(a) - priceOf(b));
        break;
      case 'price-desc':
        items.sort((a, b) => priceOf(b) - priceOf(a));
        break;
      default:
        items.sort((a, b) => b.soldCount - a.soldCount);
    }

    // 5) Phân trang
    const pageSize = query.pageSize ?? 8;
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(query.page ?? 1, totalPages);
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      totalPages,
      facets: {
        brands: brandGroups.map((g) => ({ value: g.brand, count: g._count._all })),
        attributes,
      },
    };
  }

  /** Chi tiết theo slug hoặc mã sản phẩm */
  async detail(slugOrCode: string) {
    const product = await this.prisma.product.findFirst({
      where: { isActive: true, OR: [{ slug: slugOrCode }, { code: slugOrCode }] },
      include: { attributes: true, category: { include: { parent: true } } },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại hoặc đã ngừng kinh doanh');
    const { category, ...rest } = product;
    const { parent, ...cat } = category;
    return { product: toProductDto(rest), category: cat, parent };
  }

  /** Sản phẩm cùng danh mục, bán chạy nhất trước. */
  async related(id: number, limit = 4) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy sản phẩm');
    const list = await this.prisma.product.findMany({
      where: { isActive: true, categoryId: p.categoryId, id: { not: id } },
      orderBy: { soldCount: 'desc' },
      take: limit,
      include,
    });
    return list.map(toProductDto);
  }

  /** Gợi ý phụ kiện mua kèm (combo — LAB 1) */
  async accessories(exclude: number[], limit = 3) {
    const root = await this.prisma.category.findUnique({ where: { slug: 'phu-kien-may-tinh' }, include: { children: true } });
    const list = await this.prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 }, id: { notIn: exclude }, categoryId: { in: root?.children.map((c) => c.id) ?? [] } },
      orderBy: { price: 'asc' },
      take: limit,
      include,
    });
    return list.map(toProductDto);
  }

  /** Dùng cho giỏ hàng — trả cả sản phẩm đã ngừng bán để FE báo cho khách */
  async byIds(ids: number[]) {
    const list = await this.prisma.product.findMany({ where: { id: { in: ids } }, include });
    return list.map(toProductDto);
  }
}

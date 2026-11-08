import { Injectable } from '@nestjs/common';
import { toPricingPromotion, toProductDto, toPromotionDto } from '../common/mappers.js';
import { isPromotionRunning, quote, type PricingPromotion } from '../common/pricing.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Khóa lưu phí vận chuyển trong bảng settings, và giá trị mặc định khi chưa cấu hình. */
export const SETTING_SHIPPING_FEE = 'base_shipping_fee';
export const DEFAULT_SHIPPING_FEE = 30_000;

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Toàn bộ chương trình (kể cả đã tắt) — dùng để tính giá, hàm tính giá tự lọc chương trình đang hiệu lực. */
  async getPricingPromotions(): Promise<PricingPromotion[]> {
    const list = await this.prisma.promotion.findMany({ include: { products: true } });
    return list.map(toPricingPromotion);
  }

  /** Phí vận chuyển cố định (đọc từ bảng settings). */
  async getBaseShippingFee() {
    const s = await this.prisma.setting.findUnique({ where: { key: SETTING_SHIPPING_FEE } });
    const fee = s ? Number(s.value) : DEFAULT_SHIPPING_FEE;
    return Number.isFinite(fee) ? fee : DEFAULT_SHIPPING_FEE;
  }

  /** Toàn bộ khuyến mãi + phí ship để FE tự hiển thị giá giảm. */
  async getPricingContext() {
    const promotions = await this.prisma.promotion.findMany({ include: { products: true }, orderBy: { id: 'asc' } });
    return {
      promotions: promotions.map(toPromotionDto),
      settings: { baseShippingFee: await this.getBaseShippingFee() },
    };
  }

  /** Danh sách chương trình + sản phẩm áp dụng + cờ "đang chạy". */
  async list() {
    const promotions = await this.prisma.promotion.findMany({
      orderBy: { id: 'asc' },
      include: { products: { include: { product: { include: { attributes: true } } } } },
    });
    return promotions.map((p) => {
      const dto = toPromotionDto(p);
      return {
        ...dto,
        running: isPromotionRunning(dto),
        products: p.products.map((x) => x.product).filter((x) => x.isActive).map(toProductDto),
      };
    });
  }

  /** Tính tiền giỏ hàng — dùng chung cho API báo giá và khi tạo đơn. */
  async quote(items: { productId: number; quantity: number }[]) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      include: { attributes: true },
    });
    const q = quote(items, products.map(toProductDto), await this.getPricingPromotions(), await this.getBaseShippingFee());
    return q;
  }
}

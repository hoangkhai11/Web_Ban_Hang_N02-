import { Controller, Get, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

const select = { id: true, slug: true, name: true, parentId: true, description: true, icon: true } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cây danh mục 2 cấp */
  async tree() {
    const all = await this.prisma.category.findMany({ select, orderBy: { id: 'asc' } });
    return all.filter((c) => c.parentId === null).map((root) => ({ ...root, children: all.filter((c) => c.parentId === root.id) }));
  }

  /** Danh mục theo slug + danh mục cha (nếu là cấp 2) + danh mục con (nếu là cấp 1). */
  async bySlug(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug }, select });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    const [parent, children] = await Promise.all([
      category.parentId ? this.prisma.category.findUnique({ where: { id: category.parentId }, select }) : null,
      this.prisma.category.findMany({ where: { parentId: category.id }, select, orderBy: { id: 'asc' } }),
    ]);
    return { category, parent, children };
  }
}

@ApiTags('Danh mục')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** GET /api/categories — cây danh mục */
  @Get()
  tree() {
    return this.categories.tree();
  }

  /** GET /api/categories/:slug — danh mục + cha + con (sản phẩm: GET /api/products?category=:slug) */
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.categories.bySlug(slug);
  }
}

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}

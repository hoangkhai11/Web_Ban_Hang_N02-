import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { uploadDir } from './common/upload.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const production = process.env.NODE_ENV === 'production';

  // Header bảo mật (X-Content-Type-Options, HSTS...). CSP chỉ bật ở production vì Swagger UI cần script nội tuyến
  app.use(helmet({ contentSecurityPolicy: production ? undefined : false }));
  // Ảnh sản phẩm tải lên; cho phép hiển thị khi Front-end deploy ở domain khác
  app.useStaticAssets(uploadDir(), {
    prefix: '/api/uploads',
    index: false,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
  });

  // Kiểm tra dữ liệu đầu vào bằng DTO; loại bỏ trường lạ client gửi lên (VD: price, total, role)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.flatMap(function collect(e): string[] {
          return [...Object.values(e.constraints ?? {}), ...(e.children ?? []).flatMap(collect)];
        });
        return new BadRequestException({ statusCode: 400, message: messages[0] ?? 'Dữ liệu không hợp lệ', errors: messages });
      },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Tài liệu API: http://localhost:3000/api/docs (JSON: /api/docs-json) — không mở ở production
  if (!production) {
    const config = new DocumentBuilder()
      .setTitle('GICUNGCO API')
      .setDescription('REST API website bán máy tính GICUNGCO. Lỗi trả về dạng { statusCode, message }.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`GICUNGCO API đang chạy tại http://localhost:${port}/api`);
}
await bootstrap();

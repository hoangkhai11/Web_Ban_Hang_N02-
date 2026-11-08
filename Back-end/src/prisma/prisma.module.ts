import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Module toàn cục: mọi service đều inject được PrismaService mà không cần import lại. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

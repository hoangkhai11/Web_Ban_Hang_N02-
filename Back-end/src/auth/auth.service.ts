import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { toUserDto } from '../common/mappers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './dto/auth.dto.js';
import { Notifier, type Channel } from './notifier.js';

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MS = 10 * 60 * 1000; // mã có hiệu lực 10 phút
const OTP_RESEND_MS = 60 * 1000; // tối thiểu 60 giây giữa hai lần gửi
const OTP_MAX_ATTEMPTS = 5;
const INVALID_OTP = 'Mã xác nhận không đúng hoặc đã hết hạn';
const ADMIN_TOKEN_TTL = '8h'; // tài khoản quản trị dùng phiên ngắn hơn khách hàng

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifier: Notifier,
  ) {}

  private readonly logger = new Logger('AuthService');

  /** Ký JWT chứa id (sub), vai trò, mốc đổi mật khẩu (pwd) và phiên bản token (ver) — xem JwtAuthGuard. */
  private async issue(user: { id: number; role: string; passwordChangedAt: Date | null; tokenVersion: number }) {
    const payload = { sub: user.id, role: user.role, pwd: user.passwordChangedAt?.getTime() ?? 0, ver: user.tokenVersion };
    return user.role === 'ADMIN' ? this.jwt.signAsync(payload, { expiresIn: ADMIN_TOKEN_TTL }) : this.jwt.signAsync(payload);
  }

  /** Đăng ký tài khoản khách hàng; mật khẩu lưu dạng băm bcrypt. */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email đã được sử dụng');
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: 'CUSTOMER', // không bao giờ nhận role từ client
      },
    });
    return { accessToken: await this.issue(user), user: toUserDto(user) };
  }

  /** Đăng nhập; trang quản trị (admin = true) chỉ cho tài khoản ADMIN. */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    if (dto.admin && user.role !== 'ADMIN') throw new ForbiddenException('Tài khoản không có quyền quản trị');
    return { accessToken: await this.issue(user), user: toUserDto(user) };
  }

  /** Đăng xuất: tăng tokenVersion để mọi JWT đã cấp cho tài khoản này hết hiệu lực. */
  async logout(userId: number) {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    return { message: 'Đã đăng xuất' };
  }

  /** Thông tin người dùng đang đăng nhập. */
  async me(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toUserDto(user);
  }

  /** Cập nhật họ tên, SĐT, địa chỉ (không cho đổi email, vai trò). */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, phone: dto.phone, address: dto.address },
    });
    return toUserDto(user);
  }

  /** Tìm tài khoản theo email hoặc SĐT. SĐT không duy nhất: trùng nhiều tài khoản thì coi như không tìm thấy. */
  private async findByIdentifier(identifier: string) {
    const channel: Channel = identifier.includes('@') ? 'email' : 'sms';
    if (channel === 'email') return { channel, user: await this.prisma.user.findUnique({ where: { email: identifier } }) };
    const users = await this.prisma.user.findMany({ where: { phone: identifier }, take: 2 });
    return { channel, user: users.length === 1 ? users[0] : null };
  }

  /**
   * Quên mật khẩu: tạo mã OTP 6 số (lưu bản băm, hết hạn 10 phút) và gửi qua email hoặc SMS.
   * Mọi trường hợp đều trả cùng một phản hồi để không lộ email/SĐT đã đăng ký:
   * luôn băm mã (thời gian xử lý như nhau), việc gửi chạy nền, lỗi gửi chỉ ghi log.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const { channel, user } = await this.findByIdentifier(dto.identifier);
    const message =
      channel === 'email'
        ? 'Nếu email đã đăng ký, mã xác nhận gồm 6 chữ số sẽ được gửi tới hộp thư của bạn.'
        : 'Nếu số điện thoại đã đăng ký, mã xác nhận gồm 6 chữ số sẽ được gửi qua SMS.';
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    if (!user) return { message, channel };

    const last = await this.prisma.passwordReset.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_MS) return { message, channel };

    await this.prisma.passwordReset.create({
      data: { userId: user.id, channel, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    const text = `GICUNGCO: Ma xac nhan dat lai mat khau cua ban la ${code}. Ma co hieu luc 10 phut. Khong chia se ma nay cho bat ky ai.`;
    this.notifier
      .send(channel, channel === 'email' ? user.email : user.phone, 'GICUNGCO - Mã đặt lại mật khẩu', text)
      .catch((err: Error) => this.logger.error(`Gửi mã qua ${channel} thất bại: ${err.message}`));
    // Chế độ demo: chỉ trả mã khi bật rõ OTP_DEMO_MODE=true và chưa cấu hình kênh gửi, không bao giờ ở production
    const demo = process.env.OTP_DEMO_MODE === 'true' && !this.notifier.isConfigured(channel) && process.env.NODE_ENV !== 'production';
    return { message, channel, ...(demo && { devCode: code }) };
  }

  /** Xác nhận OTP (tối đa 5 lần sai) rồi đặt mật khẩu mới; mã dùng xong bị vô hiệu. */
  async resetPassword(dto: ResetPasswordDto) {
    const { user } = await this.findByIdentifier(dto.identifier);
    if (!user) throw new BadRequestException(INVALID_OTP);
    const reset = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset) throw new BadRequestException(INVALID_OTP);
    // Giành lượt thử TRƯỚC khi so khớp bằng 1 câu UPDATE có điều kiện: gửi song song cũng không vượt giới hạn
    const claimed = await this.prisma.passwordReset.updateMany({
      where: { id: reset.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0 || !(await bcrypt.compare(dto.code, reset.codeHash))) throw new BadRequestException(INVALID_OTP);
    await this.prisma.$transaction([
      // passwordChangedAt: vô hiệu mọi phiên đăng nhập cũ (xem JwtAuthGuard)
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS), passwordChangedAt: new Date() },
      }),
      this.prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
  }
}

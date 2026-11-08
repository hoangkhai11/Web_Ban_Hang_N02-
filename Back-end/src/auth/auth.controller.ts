import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './dto/auth.dto.js';
import { CurrentUser, JwtAuthGuard, type AuthUser } from './guards.js';

/** Mặc định tối đa 10 lần / phút / IP cho mỗi route; các route nhạy cảm giới hạn chặt hơn. */
@ApiTags('Xác thực')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/register → { accessToken, user } */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /** POST /api/auth/login → { accessToken, user } */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** POST /api/auth/logout — thu hồi mọi token của tài khoản; client xóa token. */
  @Post('logout')
  @ApiBearerAuth()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }

  /** GET /api/auth/me */
  @Get('me')
  @ApiBearerAuth()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** PATCH /api/auth/me — cập nhật thông tin cá nhân */
  @Patch('me')
  @ApiBearerAuth()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  /** POST /api/auth/forgot-password — gửi mã OTP 6 số qua email hoặc SMS; luôn trả cùng một phản hồi, không tiết lộ tài khoản có tồn tại. */
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  /** POST /api/auth/reset-password — xác nhận mã OTP và đặt mật khẩu mới */
  @Post('reset-password')
  @HttpCode(200)
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}

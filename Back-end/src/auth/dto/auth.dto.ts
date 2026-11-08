import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Cắt khoảng trắng đầu/cuối */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Cắt khoảng trắng + chuyển chữ thường (dùng cho email) */
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** SĐT Việt Nam: 10 chữ số, bắt đầu bằng 0 */
export const PHONE_RE = /^0\d{9}$/;

/** POST /api/auth/register */
export class RegisterDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập họ tên' })
  @MaxLength(100)
  fullName: string;

  @Transform(lower)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email: string;

  @Transform(trim)
  @Matches(PHONE_RE, { message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' })
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: 'Mật khẩu phải gồm chữ và số' })
  password: string;
}

/** POST /api/auth/login */
export class LoginDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  password: string;

  /** true khi đăng nhập từ trang quản trị */
  @IsOptional()
  @IsBoolean()
  admin?: boolean;
}

/** PATCH /api/auth/me */
export class UpdateProfileDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập họ tên' })
  @MaxLength(100)
  fullName: string;

  @Transform(trim)
  @Matches(PHONE_RE, { message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' })
  phone: string;

  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address: string;
}

/** identifier: email hoặc số điện thoại đã đăng ký */
export class ForgotPasswordDto {
  @Transform(lower)
  @IsString()
  @Matches(/^([^\s@]+@[^\s@]+\.[^\s@]+|0\d{9})$/, { message: 'Nhập email hoặc số điện thoại đã đăng ký' })
  identifier: string;
}

/** POST /api/auth/reset-password: email/SĐT + mã OTP + mật khẩu mới */
export class ResetPasswordDto extends ForgotPasswordDto {
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Mã xác nhận gồm 6 chữ số' })
  code: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: 'Mật khẩu phải gồm chữ và số' })
  password: string;
}

import type { User } from '../types'
import { api, getToken, setToken } from './api'

export { getToken }

/** Phản hồi đăng nhập / đăng ký: JWT + thông tin người dùng */
interface AuthResponse {
  accessToken: string
  user: User
}

/** Dữ liệu form đăng ký */
export interface RegisterInput {
  fullName: string
  email: string
  phone: string
  password: string
}

/** POST /api/auth/register */
export async function register(input: RegisterInput) {
  const res = await api.post<AuthResponse>('/auth/register', input)
  setToken(res.accessToken)
  return res.user
}

/** POST /api/auth/login — admin=true dùng cho trang đăng nhập quản trị */
export async function login(email: string, password: string, admin = false) {
  const res = await api.post<AuthResponse>('/auth/login', { email, password, admin })
  setToken(res.accessToken)
  return res.user
}

/** POST /api/auth/logout — gọi khi còn token để server thu hồi, sau đó xóa token ở client kể cả khi lỗi mạng */
export async function logout() {
  await api.post('/auth/logout').catch(() => undefined)
  setToken(null)
}

/** GET /api/auth/me — null nếu chưa đăng nhập hoặc token hết hạn */
export async function me(): Promise<User | null> {
  if (!getToken()) return null
  try {
    return await api.get<User>('/auth/me')
  } catch {
    return null
  }
}

/** PATCH /api/auth/me */
export function updateProfile(input: { fullName: string; phone: string; address: string }) {
  return api.patch<User>('/auth/me', input)
}

/** POST /api/auth/forgot-password — gửi mã OTP 6 số tới email hoặc SĐT đã đăng ký.
 *  devCode chỉ có khi Back-end chưa cấu hình kênh gửi (chế độ demo). */
export function forgotPassword(identifier: string) {
  return api.post<{ message: string; channel: 'email' | 'sms'; devCode?: string }>('/auth/forgot-password', { identifier })
}

/** POST /api/auth/reset-password — xác nhận mã OTP và đặt mật khẩu mới */
export function resetPassword(input: { identifier: string; code: string; password: string }) {
  return api.post<{ message: string }>('/auth/reset-password', input)
}

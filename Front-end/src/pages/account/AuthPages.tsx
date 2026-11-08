import { Loader2 } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/layout/Header'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { classNames } from '../../lib/format'
import { forgotPassword, resetPassword } from '../../services/authService'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0\d{9}$/

/** Khung trang đăng nhập / đăng ký: toàn màn hình, chỉ có logo (không header, menu, footer). */
function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <Link to="/" className="mt-4 block text-center text-sm text-slate-500 hover:underline">← Về trang chủ</Link>
      </div>
    </div>
  )
}

function Field({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{label}</label>
      <input {...props} className={classNames('input', error && 'input-error')} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const { login, user } = useAuth()
  const location = useLocation()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? (admin ? '/admin' : '/')

  if (user && (!admin || user.role === 'ADMIN')) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!EMAIL_RE.test(email)) errs.email = 'Email không hợp lệ'
    if (!password) errs.password = 'Vui lòng nhập mật khẩu'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setServerError('')
    try {
      const u = await login(email, password, admin)
      toast.success(`Xin chào, ${u.fullName}!`)
      // Khi user được cập nhật, component tự chuyển về `from` (xem Navigate ở trên)
    } catch (err) {
      setServerError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
      <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Field id="password" label="Mật khẩu" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      {!admin && (
        <div className="text-right">
          <Link to="/quen-mat-khau" className="text-sm text-brand-700 hover:underline">Quên mật khẩu?</Link>
        </div>
      )}
      <button className="btn-primary w-full py-3" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" />} Đăng nhập
      </button>
      {/* Chỉ hiện khi chạy npm run dev; bản build production không chứa thông tin này */}
      {import.meta.env.DEV && (
        <div className="rounded-lg bg-surface p-3 text-xs text-slate-600">
          <b>Tài khoản demo:</b>
          <br />
          {admin ? 'admin@gicungco.vn / Admin@123' : 'khachhang@gicungco.vn / Khach@123'}
        </div>
      )}
      {!admin && (
        <p className="text-center text-sm text-slate-600">
          Chưa có tài khoản? <Link to="/dang-ky" state={location.state} className="font-semibold text-brand-700 hover:underline">Đăng ký ngay</Link>
        </p>
      )}
    </form>
  )

  if (admin)
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8">
          <Logo />
          <h1 className="mt-6 text-xl font-bold">Đăng nhập quản trị</h1>
          <p className="mb-6 text-sm text-slate-500">Khu vực dành riêng cho nhân viên cửa hàng.</p>
          {content}
          <Link to="/" className="mt-4 block text-center text-sm text-slate-500 hover:underline">← Về trang bán hàng</Link>
        </div>
      </div>
    )

  return <AuthCard title="Đăng nhập" subtitle="Đăng nhập để đặt hàng và theo dõi đơn hàng.">{content}</AuthCard>
}

export function RegisterPage() {
  const { register, user } = useAuth()
  const location = useLocation()
  const toast = useToast()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (form.fullName.trim().length < 2) errs.fullName = 'Vui lòng nhập họ tên'
    if (!EMAIL_RE.test(form.email)) errs.email = 'Email không hợp lệ'
    if (!/^0\d{9}$/.test(form.phone)) errs.phone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số'
    if (form.confirm !== form.password) errs.confirm = 'Mật khẩu nhập lại không khớp'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setServerError('')
    try {
      await register({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password })
      toast.success('Đăng ký tài khoản thành công!')
    } catch (err) {
      setServerError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Tạo tài khoản" subtitle="Đăng ký để mua hàng nhanh hơn và theo dõi đơn hàng.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
        <Field id="fullName" label="Họ và tên" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
        <Field id="email" label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Field id="phone" label="Số điện thoại" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Field id="password" label="Mật khẩu" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
        <Field id="confirm" label="Nhập lại mật khẩu" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <button className="btn-primary w-full py-3" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />} Đăng ký
        </button>
        <p className="text-center text-sm text-slate-600">
          Đã có tài khoản? <Link to="/dang-nhap" className="font-semibold text-brand-700 hover:underline">Đăng nhập</Link>
        </p>
      </form>
    </AuthCard>
  )
}

/** Quên mật khẩu: B1 nhập email/SĐT → nhận mã 6 số; B2 nhập mã + mật khẩu mới. */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState<{ message: string; devCode?: string } | null>(null)
  const [form, setForm] = useState({ code: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    const id = identifier.trim().toLowerCase()
    if (!EMAIL_RE.test(id) && !PHONE_RE.test(id)) return setErrors({ identifier: 'Nhập email hoặc số điện thoại (10 số, bắt đầu bằng 0)' })
    setErrors({})
    setServerError('')
    setLoading(true)
    try {
      const r = await forgotPassword(id)
      // Server không báo lần gửi có bị bỏ qua hay không; giữ mã demo đang hiển thị nếu lần này không có mã mới
      setSent((old) => ({ ...r, devCode: r.devCode ?? old?.devCode }))
      if (sent) toast.success('Đã ghi nhận yêu cầu. Mã mới được gửi tối đa 1 lần mỗi 60 giây')
    } catch (err) {
      setServerError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!/^\d{6}$/.test(form.code.trim())) errs.code = 'Mã xác nhận gồm 6 chữ số'
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số'
    if (form.confirm !== form.password) errs.confirm = 'Mật khẩu nhập lại không khớp'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setServerError('')
    setLoading(true)
    try {
      const r = await resetPassword({ identifier: identifier.trim().toLowerCase(), code: form.code.trim(), password: form.password })
      toast.success(r.message)
      navigate('/dang-nhap', { replace: true })
    } catch (err) {
      setServerError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!sent)
    return (
      <AuthCard title="Quên mật khẩu" subtitle="Nhập email hoặc số điện thoại đã đăng ký để nhận mã xác nhận.">
        <form onSubmit={sendCode} noValidate className="space-y-4">
          {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
          <Field id="identifier" label="Email hoặc số điện thoại" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={errors.identifier} />
          <button className="btn-primary w-full py-3" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Gửi mã xác nhận
          </button>
          <Link to="/dang-nhap" className="block text-center text-sm text-brand-700 hover:underline">Quay lại đăng nhập</Link>
        </form>
      </AuthCard>
    )

  return (
    <AuthCard title="Đặt lại mật khẩu" subtitle={sent.message}>
      <form onSubmit={submitReset} noValidate className="space-y-4">
        {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
        {sent.devCode && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Chế độ demo (chưa cấu hình gửi email/SMS): mã xác nhận là <b className="text-sm tracking-widest">{sent.devCode}</b>
          </p>
        )}
        <Field id="code" label="Mã xác nhận (6 số)" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.code} onChange={set('code')} error={errors.code} />
        <Field id="password" label="Mật khẩu mới" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
        <Field id="confirm" label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <button className="btn-primary w-full py-3" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />} Đặt lại mật khẩu
        </button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-slate-500 hover:underline" onClick={() => { setSent(null); setServerError('') }}>Đổi email / SĐT</button>
          <button type="button" className="text-brand-700 hover:underline" disabled={loading} onClick={() => sendCode()}>Gửi lại mã</button>
        </div>
      </form>
    </AuthCard>
  )
}

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../src/components/common/ErrorBoundary'
import { EmptyState, ErrorState } from '../src/components/common/States'
import { RequireAdmin, RequireAuth } from '../src/components/layout/Guards'
import { ProductCard } from '../src/components/product/ProductCard'
import { LoginPage } from '../src/pages/account/AuthPages'
import type { Product } from '../src/types'

const mocks = vi.hoisted(() => ({
  auth: { user: null as { role: string; fullName: string } | null, ready: true, login: (() => undefined) as (...args: unknown[]) => unknown },
  cartAdd: (() => undefined) as (id: number) => void,
  toastSuccess: (() => undefined) as (message: string) => void,
}))

vi.mock('../src/context/AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('../src/context/CartContext', () => ({ useCart: () => ({ add: mocks.cartAdd, count: 0, lines: [] }) }))
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({ success: mocks.toastSuccess, error: vi.fn() }) }))
vi.mock('../src/context/PricingContext', () => ({ usePricing: () => ({ priceOf: (p: Product) => p.price, discountOf: () => 0 }) }))

beforeEach(() => {
  mocks.auth.user = null
  mocks.auth.ready = true
  mocks.auth.login = vi.fn()
  mocks.cartAdd = vi.fn()
  mocks.toastSuccess = vi.fn()
})

describe('trạng thái hiển thị', () => {
  it('ErrorState cho phép thử lại', async () => {
    const retry = vi.fn()
    render(<ErrorState message="Mất kết nối" onRetry={retry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(screen.getByText('Mất kết nối')).toBeInTheDocument()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('EmptyState hiện tiêu đề', () => {
    render(<EmptyState title="Giỏ hàng của bạn đang trống" />)
    expect(screen.getByRole('heading', { name: 'Giỏ hàng của bạn đang trống' })).toBeInTheDocument()
  })

  it('ErrorBoundary thay trang trắng bằng thông báo, không lộ chi tiết lỗi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Broken = (): never => {
      throw new Error('bí mật kỹ thuật')
    }
    render(<ErrorBoundary><Broken /></ErrorBoundary>)
    expect(screen.getByText(/Trang gặp lỗi không mong muốn/)).toBeInTheDocument()
    expect(screen.queryByText(/bí mật kỹ thuật/)).not.toBeInTheDocument()
  })
})

describe('phân quyền giao diện', () => {
  const app = (guard: 'auth' | 'admin') => (
    <MemoryRouter initialEntries={['/bao-ve']}>
      <Routes>
        <Route path="/bao-ve" element={guard === 'auth' ? <RequireAuth><p>Nội dung riêng</p></RequireAuth> : <RequireAdmin><p>Nội dung riêng</p></RequireAdmin>} />
        <Route path="/dang-nhap" element={<p>Trang đăng nhập khách</p>} />
        <Route path="/admin/dang-nhap" element={<p>Trang đăng nhập admin</p>} />
      </Routes>
    </MemoryRouter>
  )

  it('chưa đăng nhập bị chuyển về trang đăng nhập', () => {
    render(app('auth'))
    expect(screen.getByText('Trang đăng nhập khách')).toBeInTheDocument()
    expect(screen.queryByText('Nội dung riêng')).not.toBeInTheDocument()
  })

  it('khách đã đăng nhập xem được trang tài khoản', () => {
    mocks.auth.user = { role: 'CUSTOMER', fullName: 'An' }
    render(app('auth'))
    expect(screen.getByText('Nội dung riêng')).toBeInTheDocument()
  })

  it('khách vào trang admin thấy thông báo không có quyền', () => {
    mocks.auth.user = { role: 'CUSTOMER', fullName: 'An' }
    render(app('admin'))
    expect(screen.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
    expect(screen.queryByText('Nội dung riêng')).not.toBeInTheDocument()
  })

  it('admin vào được khu quản trị', () => {
    mocks.auth.user = { role: 'ADMIN', fullName: 'Admin' }
    render(app('admin'))
    expect(screen.getByText('Nội dung riêng')).toBeInTheDocument()
  })
})

describe('thẻ sản phẩm', () => {
  const product = { id: 7, slug: 'chuot', code: 'PK-1', name: 'Chuột không dây', brand: 'Logi', price: 490000, stock: 3, images: [], highlights: ['USB'] } as unknown as Product
  const card = (p: Product) => render(<MemoryRouter><ProductCard product={p} /></MemoryRouter>)

  it('một lần bấm thêm vào giỏ và có thông báo', async () => {
    card(product)
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }))
    expect(mocks.cartAdd).toHaveBeenCalledWith(7)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã thêm vào giỏ hàng')
  })

  it('hết hàng thì khóa nút mua', () => {
    card({ ...product, stock: 0 })
    expect(screen.getByRole('button', { name: 'Tạm hết hàng' })).toBeDisabled()
  })
})

describe('đăng nhập', () => {
  const page = () => render(<MemoryRouter><LoginPage /></MemoryRouter>)

  it('dữ liệu sai thì báo lỗi, không gọi API', async () => {
    page()
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument()
    expect(mocks.auth.login).not.toHaveBeenCalled()
  })

  it('hiển thị lỗi từ server', async () => {
    mocks.auth.login = vi.fn().mockRejectedValue(new Error('Email hoặc mật khẩu không đúng'))
    page()
    await userEvent.type(screen.getByLabelText('Email'), 'an@test.vn')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'sai')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(screen.getByText('Email hoặc mật khẩu không đúng')).toBeInTheDocument())
  })

  it('đăng nhập thành công có lời chào', async () => {
    mocks.auth.login = vi.fn().mockResolvedValue({ fullName: 'Nguyễn Văn An' })
    page()
    await userEvent.type(screen.getByLabelText('Email'), 'an@test.vn')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Khach@123')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Xin chào, Nguyễn Văn An!'))
    expect(mocks.auth.login).toHaveBeenCalledWith('an@test.vn', 'Khach@123', false)
  })
})

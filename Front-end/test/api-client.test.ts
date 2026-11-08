import { describe, expect, it, vi } from 'vitest'
import { api, ApiError, getToken, setToken } from '../src/services/api'
import { logout } from '../src/services/authService'

const reply = (status: number, body: unknown) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe('lớp gọi API', () => {
  it('gắn token vào header, không đưa token lên URL', async () => {
    setToken('abc')
    const fetchMock = reply(200, [])
    await api.get('/orders/my')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain('abc')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('chưa đăng nhập thì không gửi Authorization', async () => {
    const fetchMock = reply(200, [])
    await api.get('/products')
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('bỏ tham số rỗng khi tạo query string', async () => {
    const fetchMock = reply(200, [])
    await api.get('/products', { q: 'ssd', brand: '', stock: true, ids: ['1', '2'] })
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/products?q=ssd&stock=1&ids=1%2C2')
  })

  it('token hết hạn (401) thì xóa token', async () => {
    setToken('abc')
    reply(401, { statusCode: 401, message: 'Phiên đăng nhập đã hết hạn' })
    await expect(api.get('/auth/me')).rejects.toThrow('Phiên đăng nhập đã hết hạn')
    expect(getToken()).toBeNull()
  })

  it('lỗi nghiệp vụ giữ nguyên token và trả thông báo của server', async () => {
    setToken('abc')
    reply(409, { statusCode: 409, message: 'Sản phẩm đã hết hàng' })
    await expect(api.post('/orders')).rejects.toMatchObject({ status: 409, message: 'Sản phẩm đã hết hàng' })
    expect(getToken()).toBe('abc')
  })

  it('đăng xuất gửi token để server thu hồi rồi mới xóa ở client', async () => {
    setToken('abc')
    const fetchMock = reply(200, { message: 'Đã đăng xuất' })
    await logout()
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer abc')
    expect(getToken()).toBeNull()
  })

  it('mất kết nối trả ApiError mã 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed'))
    const error = await api.get('/products').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImagePicker } from '../src/pages/admin/AdminProducts'
import { uploadProductImage } from '../src/services/adminService'

vi.mock('../src/services/adminService', () => ({ uploadProductImage: vi.fn() }))
vi.mock('../src/context/CartContext', () => ({ useCart: () => ({}) }))
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({}) }))
vi.mock('../src/context/PricingContext', () => ({ usePricing: () => ({}) }))

function Harness({ initial = [] as string[] }) {
  const [images, setImages] = useState(initial)
  const [uploading, setUploading] = useState(false)
  return (
    <>
      <ImagePicker images={images} onChange={setImages} uploading={uploading} setUploading={setUploading} />
      <output data-testid="images">{images.join(' ')}</output>
    </>
  )
}

const png = (name = 'a.png', size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' })
const value = () => screen.getByTestId('images').textContent
const user = () => userEvent.setup({ applyAccept: false })

beforeEach(() => {
  vi.mocked(uploadProductImage).mockReset()
})

describe('chọn ảnh sản phẩm', () => {
  it('tải nhiều ảnh từ thiết bị theo đúng thứ tự', async () => {
    vi.mocked(uploadProductImage).mockResolvedValueOnce({ url: '/api/uploads/1.png' }).mockResolvedValueOnce({ url: '/api/uploads/2.png' })
    render(<Harness />)
    await user().upload(screen.getByLabelText('Chọn ảnh từ thiết bị'), [png('1.png'), png('2.png')])
    await waitFor(() => expect(value()).toBe('/api/uploads/1.png /api/uploads/2.png'))
  })

  it('từ chối file không phải ảnh, không gọi API', async () => {
    render(<Harness />)
    await user().upload(screen.getByLabelText('Chọn ảnh từ thiết bị'), new File(['x'], 'a.pdf', { type: 'application/pdf' }))
    expect(screen.getByText('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP')).toBeInTheDocument()
    expect(uploadProductImage).not.toHaveBeenCalled()
  })

  it('từ chối ảnh quá 5 MB', async () => {
    render(<Harness />)
    await user().upload(screen.getByLabelText('Chọn ảnh từ thiết bị'), png('big.png', 5 * 1024 * 1024 + 1))
    expect(screen.getByText('Mỗi ảnh tối đa 5 MB')).toBeInTheDocument()
    expect(uploadProductImage).not.toHaveBeenCalled()
  })

  it('hiển thị lỗi từ server', async () => {
    vi.mocked(uploadProductImage).mockRejectedValue(new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP'))
    render(<Harness />)
    await user().upload(screen.getByLabelText('Chọn ảnh từ thiết bị'), png())
    await waitFor(() => expect(screen.getByText('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP')).toBeInTheDocument())
    expect(value()).toBe('')
  })

  it('xóa ảnh và đổi ảnh đại diện', async () => {
    render(<Harness initial={['a.png', 'b.png', 'c.png']} />)
    await userEvent.click(screen.getByRole('button', { name: 'Đặt ảnh 3 làm đại diện' }))
    expect(value()).toBe('c.png a.png b.png')
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ảnh 2' }))
    expect(value()).toBe('c.png b.png')
  })

  it('vẫn thêm được ảnh bằng link, từ chối link sai', async () => {
    render(<Harness />)
    const link = screen.getByLabelText('Link ảnh')
    await userEvent.type(link, 'javascript:alert(1){Enter}')
    expect(screen.getByText('Link ảnh phải bắt đầu bằng http:// hoặc https://')).toBeInTheDocument()
    await userEvent.clear(link)
    await userEvent.type(link, 'https://example.com/a.jpg{Enter}')
    expect(value()).toBe('https://example.com/a.jpg')
  })
})

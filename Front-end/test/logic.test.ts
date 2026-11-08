import { describe, expect, it } from 'vitest'
import { sortAttributeValues } from '../src/lib/filters'
import { formatVND, readVND } from '../src/lib/format'
import { getDiscountPercent, isPromotionRunning, quote } from '../src/lib/pricing'
import { validateShipping } from '../src/pages/customer/CheckoutPage'
import type { Product, Promotion } from '../src/types'

const product = (id: number, price: number) => ({ id, price }) as Product
const percent: Promotion = { id: 1, name: 'Giảm 5%', type: 'PRODUCT_PERCENT', value: 5, minOrderValue: 0, startDate: '2020-01-01', endDate: '2099-12-31', isActive: true, productIds: [1] } as Promotion
const freeShip: Promotion = { ...percent, id: 2, type: 'FREE_SHIPPING', value: 0, minOrderValue: 5_000_000, productIds: [] }
const settings = { baseShippingFee: 30_000 }

describe('tính tiền', () => {
  it('chỉ giảm giá sản phẩm thuộc chương trình', () => {
    expect(getDiscountPercent(product(1, 100), [percent])).toBe(5)
    expect(getDiscountPercent(product(2, 100), [percent])).toBe(0)
  })

  it('chương trình tắt hoặc hết hạn thì không áp dụng', () => {
    expect(isPromotionRunning({ ...percent, isActive: false })).toBe(false)
    expect(isPromotionRunning({ ...percent, endDate: '2020-01-02' })).toBe(false)
  })

  it('dưới ngưỡng tính phí vận chuyển', () => {
    const q = quote([{ productId: 2, quantity: 1 }], [product(2, 1_000_000)], [freeShip], settings)
    expect(q.shippingFee).toBe(30_000)
    expect(q.amountToFreeShipping).toBe(4_000_000)
    expect(q.total).toBe(1_030_000)
  })

  it('đạt ngưỡng sau giảm thì miễn phí vận chuyển', () => {
    const q = quote([{ productId: 1, quantity: 1 }], [product(1, 6_000_000)], [percent, freeShip], settings)
    expect(q.discountTotal).toBe(300_000)
    expect(q.freeShipping).toBe(true)
    expect(q.total).toBe(5_700_000)
  })

  it('giỏ hàng trống không tính phí vận chuyển', () => {
    expect(quote([], [], [freeShip], settings).total).toBe(0)
  })
})

describe('định dạng', () => {
  it('hiển thị tiền Việt', () => {
    expect(formatVND(1_490_000)).toBe('1.490.000đ')
  })

  it('đọc số tiền bằng chữ trên hóa đơn', () => {
    expect(readVND(0)).toBe('Không đồng')
    expect(readVND(1_500_000)).toBe('Một triệu năm trăm nghìn đồng')
  })

  it('sắp xếp dung lượng theo thứ tự tự nhiên', () => {
    expect(sortAttributeValues(['1 TB', '16 GB', '8 GB'])).toEqual(['8 GB', '16 GB', '1 TB'])
  })
})

describe('kiểm tra thông tin nhận hàng', () => {
  const valid = { fullName: 'Nguyễn Văn An', phone: '0912345678', province: 'Hà Nội', district: 'Cầu Giấy', address: '12 Trần Duy Hưng', note: '' }

  it('thông tin đúng không có lỗi', () => {
    expect(validateShipping(valid)).toEqual({})
  })

  it('báo lỗi từng trường sai', () => {
    const e = validateShipping({ ...valid, fullName: 'A', phone: '123', province: '', district: ' ', address: 'abc' })
    expect(Object.keys(e).sort()).toEqual(['address', 'district', 'fullName', 'phone', 'province'])
  })
})

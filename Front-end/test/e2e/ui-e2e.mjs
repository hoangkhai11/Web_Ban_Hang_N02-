/**
 * Kiểm thử giao diện end-to-end trên Chrome thật, chạy với bản build production.
 *   1. Back-end chạy ở cổng 3000 với dữ liệu seed mới (kịch bản này tạo đơn hàng thật trong DB)
 *   2. Front-end: npm run build && npm run preview
 *   3. npm run test:e2e
 * Biến môi trường: BASE_URL (mặc định http://localhost:4173), BROWSER_CHANNEL (mặc định chrome).
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const results = []
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${info ? ' | ' + info : ''}`)

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome' })
const newPage = async (viewport = { width: 1366, height: 820 }) => {
  const page = await (await browser.newContext({ viewport, locale: 'vi-VN' })).newPage()
  page.setDefaultTimeout(10_000)
  page.problems = []
  page.on('console', (m) => {
    // Ảnh minh họa bên ngoài có thể lỗi mạng; chỉ tính vi phạm CSP và lỗi trang
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) page.problems.push(m.text())
  })
  page.on('pageerror', (e) => page.problems.push(e.message))
  page.on('dialog', (d) => d.accept()) // các thao tác quan trọng có hộp thoại xác nhận
  return page
}
const step = async (name, fn) => {
  try {
    await fn()
  } catch (e) {
    check(name, false, e.message.split('\n')[0])
  }
}

// ---------- Khách hàng: một đơn đi từ tìm kiếm tới đặt hàng ----------
const shop = await newPage()
let orderCode = ''
let clicks = 0
let orderClicks = 0
const click = async (locator) => {
  clicks++
  await locator.click()
}

await step('Trang chủ hiển thị sản phẩm từ API', async () => {
  await shop.goto(BASE)
  await shop.getByRole('button', { name: 'Thêm vào giỏ' }).first().waitFor()
  check('Trang chủ hiển thị sản phẩm từ API', true)
})
await step('Tìm kiếm theo mã sản phẩm', async () => {
  await shop.getByPlaceholder('Tìm laptop, mã sản phẩm, linh kiện...').first().fill('PK-MS-LOGI')
  await shop.keyboard.press('Enter')
  await shop.waitForURL(/tim-kiem/)
  await shop.waitForFunction(() => document.querySelectorAll('article').length === 1)
  check('Tìm kiếm theo mã sản phẩm', true)
})
await step('Thêm vào giỏ có thông báo', async () => {
  await click(shop.locator('article').first().getByRole('link').last())
  await shop.waitForURL(/san-pham/)
  await click(shop.getByRole('button', { name: 'Mua ngay' }))
  await shop.waitForURL(/dang-nhap/)
  check('Khách chưa đăng nhập được đưa tới trang đăng nhập', true)
})
await step('Trang đăng nhập không lộ tài khoản demo', async () => {
  check('Trang đăng nhập không lộ tài khoản demo', !(await shop.content()).includes('Khach@123'))
})
await step('Đăng nhập rồi quay lại thanh toán', async () => {
  await shop.getByLabel('Email').fill('khachhang@gicungco.vn')
  await shop.getByLabel('Mật khẩu').fill('Khach@123')
  await click(shop.getByRole('button', { name: 'Đăng nhập' }))
  await shop.waitForURL(/thanh-toan/)
  check('Đăng nhập rồi quay lại thanh toán', true)
})
await step('Đặt hàng', async () => {
  check('Thông tin người nhận được điền sẵn', (await shop.locator('#fullName').inputValue()).length > 0)
  await click(shop.getByRole('button', { name: 'Xác nhận đặt hàng' }))
  check('Thiếu tỉnh/thành thì báo lỗi ngay trên form', await shop.getByText('Vui lòng chọn tỉnh/thành phố').isVisible())
  await shop.locator('#province').selectOption('Hà Nội')
  await shop.locator('#district').fill('Quận Cầu Giấy')
  await shop.locator('#address').fill('12 Trần Duy Hưng')
  await click(shop.getByRole('button', { name: 'Xác nhận đặt hàng' }))
  await shop.waitForURL(/dat-hang-thanh-cong/)
  await shop.getByRole('heading', { name: 'Đặt hàng thành công!' }).waitFor()
  orderCode = shop.url().split('/').pop()
  orderClicks = clicks - 1 // không tính lần bấm thử form thiếu tỉnh/thành
  check('Đặt hàng thành công', !!orderCode, orderCode)
})
await step('Khách xem đơn', async () => {
  await click(shop.getByRole('link', { name: 'Theo dõi đơn hàng' }))
  await shop.waitForURL(/tai-khoan\/don-hang/)
  await shop.locator('span.bg-amber-100', { hasText: 'Chờ xác nhận' }).first().waitFor()
  check('Khách theo dõi được đơn mới', true)
})
await step('JWT không nằm trên URL', async () => {
  check('Token không xuất hiện trên URL', !/token|eyJ/.test(shop.url()))
})
check('Luồng khách không có lỗi trang hay vi phạm CSP', shop.problems.length === 0, shop.problems[0])

// ---------- Phân quyền ----------
const guest = await newPage()
await step('Khách chưa đăng nhập vào admin', async () => {
  await guest.goto(BASE + '/admin')
  await guest.waitForURL(/admin\/dang-nhap/)
  check('Chưa đăng nhập vào /admin bị chuyển về đăng nhập admin', !(await guest.content()).includes('Admin@123'))
})
await step('Đăng nhập admin sai', async () => {
  await guest.getByLabel('Email').fill('admin@gicungco.vn')
  await guest.getByLabel('Mật khẩu').fill('sai-mat-khau')
  await guest.getByRole('button', { name: 'Đăng nhập' }).click()
  await guest.getByText('Email hoặc mật khẩu không đúng').waitFor()
  check('Sai mật khẩu hiển thị lỗi', true)
})

// ---------- Admin xử lý đơn vừa đặt ----------
await step('Admin xác nhận đơn', async () => {
  await guest.getByLabel('Mật khẩu').fill('Admin@123')
  await guest.getByRole('button', { name: 'Đăng nhập' }).click()
  await guest.waitForURL(/\/admin$/)
  await guest.goto(`${BASE}/admin/don-hang/${orderCode}`)
  await guest.getByRole('button', { name: 'Chuyển sang: Đã xác nhận' }).click()
  await guest.getByRole('button', { name: 'Chuyển sang: Đang chuẩn bị hàng' }).waitFor()
  check('Admin chuyển trạng thái đơn', true)
})
await step('Khách thấy trạng thái mới', async () => {
  await shop.reload()
  await shop.locator('span.bg-sky-100', { hasText: 'Đã xác nhận' }).first().waitFor()
  check('Khách thấy trạng thái Admin vừa cập nhật', true)
})
await step('Trang quản trị mở được', async () => {
  for (const path of ['san-pham', 'ton-kho', 'don-hang', 'khach-hang']) {
    await guest.goto(`${BASE}/admin/${path}`)
    await guest.locator('main h1').first().waitFor()
  }
  check('Các trang quản trị mở được', true)
})
check('Luồng admin không có lỗi trang hay vi phạm CSP', guest.problems.length === 0, guest.problems[0])

// ---------- Điện thoại ----------
const mobile = await newPage({ width: 390, height: 780 })
await step('Giao diện điện thoại', async () => {
  await mobile.goto(BASE)
  await mobile.getByRole('button', { name: 'Thêm vào giỏ' }).first().waitFor()
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('Màn hình 390px không cuộn ngang', overflow <= 0, `lệch ${overflow}px`)
  await mobile.getByRole('button', { name: 'Mở menu' }).click()
  await mobile.getByRole('button', { name: 'Đóng menu' }).waitFor()
  check('Menu ngăn kéo trên điện thoại', true)
})
await step('Trang 404', async () => {
  await mobile.goto(BASE + '/khong-ton-tai')
  await mobile.getByText(/404/).first().waitFor()
  check('Đường dẫn sai hiện trang 404', true)
})

await browser.close()
console.log(results.join('\n'))
console.log(`\nSố lần bấm từ kết quả tìm kiếm tới đặt hàng thành công (gồm cả bước đăng nhập): ${orderClicks}`)
const pass = results.filter((x) => x.startsWith('PASS')).length
console.log(`\n${pass}/${results.length} PASS`)
process.exit(pass === results.length ? 0 : 1)

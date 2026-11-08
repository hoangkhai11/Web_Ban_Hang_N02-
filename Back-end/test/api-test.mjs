/**
 * Kiểm thử API GICUNGCO (Giai đoạn 5) — chạy khi API đang chạy ở http://localhost:3000
 *   node test/api-test.mjs
 * Lưu ý: script tạo đơn hàng/sản phẩm thử. Chạy "npm run db:seed" để đưa dữ liệu về ban đầu.
 * Cần dữ liệu seed mới và Back-end chạy với OTP_DEMO_MODE=true (kịch bản quên mật khẩu đọc mã từ phản hồi API).
 */
const API = process.env.API_URL ?? 'http://localhost:3000/api';
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} | ${name}${info ? ' | ' + info : ''}`);

async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const get = (p, t) => call('GET', p, null, t);

// ---------- Hệ thống ----------
let r = await get('/health');
check('Health: API + MySQL kết nối', r.status === 200 && r.data.database === 'connected');

// ---------- 1. Danh mục & sản phẩm ----------
r = await get('/categories');
check('Cây danh mục: 3 cấp 1, mỗi nhóm <= 4 con', r.data.length === 3 && r.data.every((c) => c.children.length <= 4), r.data.map((c) => `${c.name}(${c.children.length})`).join(', '));
r = await get('/products?pageSize=48');
check('>= 10 sản phẩm từ MySQL', r.data.total >= 10, `${r.data.total} sản phẩm`);
r = await get('/products?category=may-tinh-laptop&pageSize=8&page=1');
check('Phân trang: 8/trang', r.data.items.length === 8 && r.data.totalPages === 1 && r.data.total === 8, `total=${r.data.total}`);
r = await get('/categories/khong-ton-tai');
check('Danh mục không tồn tại → 404', r.status === 404);

// ---------- 2. Tìm kiếm & lọc ----------
r = await get('/products?q=LK-SSD-01');
check('Tìm theo mã sản phẩm', r.data.total === 1 && r.data.items[0].code === 'LK-SSD-01');
r = await get('/products?q=' + encodeURIComponent('core i5'));
check('Tìm theo thông số "core i5"', r.data.total >= 3 && r.data.items.every((p) => /i5/i.test(p.name + JSON.stringify(p.attributes))), `${r.data.total} SP`);
r = await get('/products?category=laptop&brand=ASUS');
check('Lọc thương hiệu', r.data.items.length === 2 && r.data.items.every((p) => p.brand === 'ASUS'));
r = await get('/products?category=laptop&ram=' + encodeURIComponent('16 GB'));
check('Lọc thuộc tính RAM 16 GB', r.data.items.length > 0 && r.data.items.every((p) => p.attributes.ram === '16 GB'), `${r.data.items.length} SP`);
r = await get('/products?category=laptop&price=5-15');
check('Lọc giá 5–15 triệu (giá sau KM)', r.data.items.every((p) => p.price * (p.id === 1 || p.id === 3 ? 0.95 : 1) < 15_000_000), r.data.items.map((p) => p.code).join(','));
r = await get('/products?category=laptop&sort=price-asc');
const prices = r.data.items.map((p) => p.price);
check('Sắp xếp giá tăng dần', prices.every((v, i) => i === 0 || v >= prices[i - 1] * 0.95 - 1));
r = await get('/products?category=man-hinh');
check('Facet theo loại SP: màn hình có screenSize, không có cpu', !!r.data.facets.attributes.screenSize && !r.data.facets.attributes.cpu);
r = await get('/products?sort=hacker');
check('Tham số sort không hợp lệ → 400', r.status === 400);

// ---------- 3. Chi tiết ----------
r = await get('/products/LT-NB14-01');
const novabook = r.data.product;
check('Chi tiết sản phẩm theo mã + breadcrumb', r.status === 200 && novabook.price === 14_990_000 && r.data.category.slug === 'laptop' && r.data.parent.slug === 'may-tinh-laptop');
r = await get('/products/khong-co');
check('Sản phẩm không tồn tại → 404', r.status === 404);

// ---------- 5–7. Tính tiền & khuyến mãi ----------
r = await call('POST', '/promotions/quote', { items: [{ productId: 1, quantity: 2 }, { productId: 14, quantity: 1 }] });
check('Báo giá: tạm tính 31.270.000', r.data.subtotal === 31_270_000);
check('Giảm 5% CHỈ cho SP đủ điều kiện (-1.499.000)', r.data.discountTotal === 1_499_000 && r.data.lines.find((l) => l.product.id === 14).discountPercent === 0);
check('Đạt ngưỡng → miễn phí ship, tổng 29.771.000', r.data.shippingFee === 0 && r.data.total === 29_771_000);
r = await call('POST', '/promotions/quote', { items: [{ productId: 14, quantity: 1 }] });
check('Dưới ngưỡng → phí ship 30.000, tổng 1.320.000', r.data.shippingFee === 30_000 && r.data.total === 1_320_000);
r = await get('/promotions');
check('Danh sách 2 khuyến mãi có điều kiện & thời gian', r.data.length === 2 && r.data.every((p) => p.conditions.length && p.startDate && p.endDate));

// ---------- Xác thực ----------
r = await call('POST', '/auth/login', { email: 'khachhang@gicungco.vn', password: 'sai' });
check('Sai mật khẩu → 401', r.status === 401);
r = await call('POST', '/auth/register', { fullName: 'A', email: 'x', phone: '1', password: '1' });
check('Đăng ký dữ liệu sai → 400 kèm thông báo', r.status === 400 && typeof r.data.message === 'string', r.data.message);
const email = `sv${Date.now()}@test.vn`;
r = await call('POST', '/auth/register', { fullName: 'Sinh Viên', email, phone: '0987654321', password: 'Test1234', role: 'ADMIN' });
check('Đăng ký thành công, không nhận role từ client', r.status === 201 && r.data.user.role === 'CUSTOMER' && !!r.data.accessToken);
r = await call('POST', '/auth/register', { fullName: 'Sinh Viên', email, phone: '0987654321', password: 'Test1234' });
check('Email trùng → 409', r.status === 409);
r = await call('POST', '/auth/login', { email: 'khachhang@gicungco.vn', password: 'Khach@123' });
const cust = r.data.accessToken;
check('Khách đăng nhập', r.status === 200 && !!cust);
r = await call('POST', '/auth/login', { email: 'khachhang@gicungco.vn', password: 'Khach@123', admin: true });
check('Khách đăng nhập trang admin → 403', r.status === 403);
r = await call('POST', '/auth/login', { email: 'admin@gicungco.vn', password: 'Admin@123', admin: true });
const adm = r.data.accessToken;
check('Admin đăng nhập', r.status === 200 && r.data.user.role === 'ADMIN');
r = await get('/auth/me', cust);
check('GET /auth/me', r.data.email === 'khachhang@gicungco.vn' && !('passwordHash' in r.data));

// ---------- 14. Phân quyền ----------
check('Admin API không token → 401', (await get('/admin/dashboard')).status === 401);
check('Admin API bằng token khách → 403', (await get('/admin/dashboard', cust)).status === 403);
check('Token giả → 401', (await get('/orders/my', 'abc.def.ghi')).status === 401);

// ---------- 8–9. Đặt hàng COD ----------
const stockBefore = (await get('/products/LT-NB14-01')).data.product.stock;
const shipping = { fullName: 'Nguyễn Văn An', phone: '0912345678', province: 'Hà Nội', district: 'Quận Cầu Giấy', address: '12 Trần Duy Hưng, P. Trung Hòa' };
r = await call('POST', '/orders', { items: [{ productId: 1, quantity: 2 }, { productId: 14, quantity: 1 }], shipping }, null);
check('Đặt hàng chưa đăng nhập → 401', r.status === 401);
r = await call('POST', '/orders', { items: [{ productId: 1, quantity: 2, price: 1 }], shipping: { ...shipping, phone: '123' }, total: 1 }, cust);
check('Đặt hàng SĐT sai → 400', r.status === 400, r.data?.message);
r = await call('POST', '/orders', { items: [{ productId: 1, quantity: 2, price: 1 }, { productId: 14, quantity: 1 }], shipping, total: 1000 }, cust);
const order = r.data;
check('Tạo đơn COD: giá tính ở server (bỏ qua price/total client gửi)', r.status === 201 && order.total === 29_771_000 && order.items[0].unitPrice === 14_240_500, `${order.code} total=${order.total}`);
check('Đơn mới: PENDING + UNPAID + COD', order.status === 'PENDING' && order.paymentStatus === 'UNPAID' && order.paymentMethod === 'COD');
const stockAfter = (await get('/products/LT-NB14-01')).data.product.stock;
check('12. Tồn kho bị trừ khi đặt', stockAfter === stockBefore - 2, `${stockBefore} -> ${stockAfter}`);
r = await call('POST', '/orders', { items: [{ productId: 5, quantity: 1 }], shipping }, cust);
check('12. Đặt SP hết hàng → 409', r.status === 409, r.data?.message);
r = await call('POST', '/orders', { items: [{ productId: 7, quantity: 10 }], shipping }, cust);
check('12. Đặt vượt tồn kho → 409', r.status === 409, r.data?.message);

r = await get('/orders/my', cust);
check('Lịch sử đơn của khách có đơn mới', r.data.some((o) => o.code === order.code));
r = await call('POST', '/auth/login', { email, password: 'Test1234' });
const other = r.data.accessToken;
check('Khách khác không xem được đơn → 404', (await get('/orders/my/' + order.code, other)).status === 404);

// ---------- 10–11. Admin cập nhật trạng thái ----------
r = await call('PATCH', `/admin/orders/${order.code}/status`, { status: 'COMPLETED' }, adm);
check('Chuyển trạng thái sai quy trình → 409', r.status === 409, r.data?.message);
for (const s of ['CONFIRMED', 'PROCESSING', 'SHIPPING']) {
  r = await call('PATCH', `/admin/orders/${order.code}/status`, { status: s, note: 'test' }, adm);
}
check('Admin cập nhật tới SHIPPING', r.status === 200 && r.data.status === 'SHIPPING');
r = await call('PATCH', `/orders/my/${order.code}/cancel`, null, cust);
check('Khách không hủy được đơn đang giao → 409', r.status === 409);
r = await get('/orders/my/' + order.code, cust);
check('11. Khách thấy trạng thái mới + lịch sử', r.data.status === 'SHIPPING' && r.data.history.length === 4);
const revBefore = (await get('/admin/dashboard', adm)).data.revenue;
r = await call('PATCH', `/admin/orders/${order.code}/status`, { status: 'COMPLETED' }, adm);
check('Hoàn thành → tự ghi nhận PAID', r.data.status === 'COMPLETED' && r.data.paymentStatus === 'PAID');
const revAfter = (await get('/admin/dashboard', adm)).data.revenue;
check('Doanh thu chỉ cộng khi hoàn thành', revAfter - revBefore === 29_771_000, `${revBefore} -> ${revAfter}`);

// ---------- 13. Hủy đơn hoàn tồn kho ----------
const s0 = (await get('/products/PK-MS-LOGI')).data.product.stock;
const o2 = (await call('POST', '/orders', { items: [{ productId: 20, quantity: 3 }], shipping }, cust)).data;
const s1 = (await get('/products/PK-MS-LOGI')).data.product.stock;
r = await call('PATCH', `/orders/my/${o2.code}/cancel`, null, cust);
const s2 = (await get('/products/PK-MS-LOGI')).data.product.stock;
check('Khách hủy đơn PENDING → hoàn tồn kho', r.data.status === 'CANCELLED' && s1 === s0 - 3 && s2 === s0, `${s0} -> ${s1} -> ${s2}`);
r = await call('PATCH', `/orders/my/${o2.code}/cancel`, null, cust);
const s3 = (await get('/products/PK-MS-LOGI')).data.product.stock;
check('Hủy lần 2 không hoàn kho lần nữa', r.status === 409 && s3 === s0);
const o3 = (await call('POST', '/orders', { items: [{ productId: 20, quantity: 1 }], shipping }, cust)).data;
await call('PATCH', `/admin/orders/${o3.code}/status`, { status: 'CONFIRMED' }, adm);
r = await call('PATCH', `/admin/orders/${o3.code}/status`, { status: 'CANCELLED', note: 'Thông tin không hợp lệ' }, adm);
const s4 = (await get('/products/PK-MS-LOGI')).data.product.stock;
check('Admin hủy đơn đã xác nhận → hoàn tồn kho', r.data.status === 'CANCELLED' && s4 === s0);

// ---------- Admin: sản phẩm, danh mục, tồn kho ----------
const newP = { code: 'TEST-' + Date.now(), name: 'Sản phẩm kiểm thử', categoryId: 32, brand: 'Test', price: 100000, stock: 5, warrantyMonths: 12, images: [], highlights: ['USB'], description: 'Mô tả', specs: { 'Kết nối': 'USB' }, attributes: { connection: 'USB', hacker: 'x' } };
r = await call('POST', '/admin/products', newP, adm);
const pid = r.data.id;
check('Admin thêm sản phẩm (bỏ thuộc tính không chuẩn)', r.status === 201 && r.data.attributes.connection === 'USB' && !r.data.attributes.hacker);
r = await call('POST', '/admin/products', newP, adm);
check('Trùng mã sản phẩm → 409', r.status === 409);
r = await call('POST', '/admin/products', { ...newP, code: 'X1', categoryId: 3 }, adm);
check('SP gắn danh mục cấp 1 → 400', r.status === 400);
r = await call('PUT', `/admin/products/${pid}`, { ...newP, price: 120000 }, adm);
check('Admin sửa sản phẩm', r.data.price === 120000);
r = await call('PATCH', `/admin/inventory/${pid}`, { stock: -1 }, adm);
check('Tồn kho âm → 400', r.status === 400);
r = await call('PATCH', `/admin/inventory/${pid}`, { stock: 0 }, adm);
check('Admin cập nhật tồn kho', r.data.stock === 0);
r = await call('DELETE', `/admin/products/${pid}`, null, adm);
check('Admin xóa (mềm) sản phẩm, không còn trên cửa hàng', r.status === 200 && (await get('/products/' + newP.code)).status === 404);

r = await call('POST', '/admin/categories', { name: 'Danh mục cấp 1 mới', parentId: null }, adm);
check('Không cho thêm danh mục cấp 1 thứ 4 → 400', r.status === 400);
r = await call('POST', '/admin/categories', { name: 'Loa', parentId: 3 }, adm);
check('Nhóm đã đủ 4 danh mục con → 400', r.status === 400, r.data?.message);
r = await call('DELETE', '/admin/categories/11', null, adm);
check('Xóa danh mục đang có sản phẩm → 409', r.status === 409);

// ---------- Admin: khuyến mãi ----------
r = await call('PUT', '/admin/settings', { baseShippingFee: 35000 }, adm);
r = await call('POST', '/promotions/quote', { items: [{ productId: 14, quantity: 1 }] });
check('Đổi phí ship cấu hình → báo giá cập nhật', r.data.shippingFee === 35000);
await call('PUT', '/admin/settings', { baseShippingFee: 30000 }, adm);

// ---------- Tài khoản ----------
r = await call('PATCH', '/auth/me', { fullName: 'Sinh Viên Mới', phone: '0987654322', address: '1 Nguyễn Trãi, Hà Nội' }, other);
check('Cập nhật thông tin cá nhân', r.status === 200 && r.data.fullName === 'Sinh Viên Mới' && r.data.email === email);
r = await call('PATCH', '/auth/me', { fullName: 'A', phone: '123', address: '' }, other);
check('Cập nhật thông tin sai định dạng → 400', r.status === 400, r.data?.message);
check('Sửa thông tin không token → 401', (await call('PATCH', '/auth/me', { fullName: 'Hacker', phone: '0987654322', address: '' })).status === 401);

// ---------- Quên mật khẩu ----------
r = await call('POST', '/auth/forgot-password', { identifier: 'khong-ton-tai@test.vn' });
check('Email chưa đăng ký: phản hồi chung, không tạo mã', r.status === 200 && !r.data.devCode, r.data?.message);
r = await call('POST', '/auth/forgot-password', { identifier: email });
const otp = r.data.devCode;
check('Quên mật khẩu: tạo mã OTP 6 số', r.status === 200 && /^\d{6}$/.test(otp ?? ''));
r = await call('POST', '/auth/forgot-password', { identifier: email });
check('Gửi lại trong 60 giây: phản hồi chung, không tạo mã mới', r.status === 200 && !r.data.devCode, r.data?.message);
const unknown = await call('POST', '/auth/forgot-password', { identifier: 'chua-dang-ky@test.vn' });
check('Email đã đăng ký và chưa đăng ký trả phản hồi giống nhau', unknown.status === r.status && JSON.stringify(unknown.data) === JSON.stringify(r.data));
const wrongOtp = otp === '000000' ? '000001' : '000000';
r = await call('POST', '/auth/reset-password', { identifier: email, code: wrongOtp, password: 'MatKhau123' });
check('Mã OTP sai → 400', r.status === 400, r.data?.message);
r = await call('POST', '/auth/reset-password', { identifier: email, code: otp, password: '123' });
check('Mật khẩu mới yếu → 400', r.status === 400, r.data?.message);
r = await call('POST', '/auth/reset-password', { identifier: email, code: otp, password: 'MatKhau123' });
check('OTP đúng → đặt lại mật khẩu', r.status === 200);
check('Token cũ mất hiệu lực sau khi đổi mật khẩu → 401', (await get('/auth/me', other)).status === 401);
r = await call('POST', '/auth/reset-password', { identifier: email, code: otp, password: 'MatKhau456' });
check('OTP đã dùng không dùng lại được → 400', r.status === 400);
check('Mật khẩu cũ không đăng nhập được → 401', (await call('POST', '/auth/login', { email, password: 'Test1234' })).status === 401);
check('Đăng nhập bằng mật khẩu mới', (await call('POST', '/auth/login', { email, password: 'MatKhau123' })).status === 200);

// ---------- Đăng xuất & thời hạn token ----------
const session = (await call('POST', '/auth/login', { email, password: 'MatKhau123' })).data.accessToken;
const session2 = (await call('POST', '/auth/login', { email, password: 'MatKhau123' })).data.accessToken;
check('Đăng xuất không token → 401', (await call('POST', '/auth/logout')).status === 401);
check('Token dùng được trước khi đăng xuất', (await get('/auth/me', session)).status === 200);
check('Đăng xuất thành công', (await call('POST', '/auth/logout', null, session)).status === 200);
check('Token đã đăng xuất → 401', (await get('/auth/me', session)).status === 401);
check('Đăng xuất thu hồi token khác của tài khoản → 401', (await get('/auth/me', session2)).status === 401);
check('Đăng nhập lại sau khi đăng xuất', (await get('/auth/me', (await call('POST', '/auth/login', { email, password: 'MatKhau123' })).data.accessToken)).status === 200);
const ttlHours = (token) => {
  const { iat, exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return (exp - iat) / 3600;
};
check('Token admin tối đa 24 giờ', ttlHours(adm) <= 24, `${ttlHours(adm)} giờ`);

// ---------- Admin: kho hàng ----------
const stock0 = (await get('/products/PK-MS-LOGI')).data.product.stock;
r = await call('POST', '/admin/inventory/20/import', { quantity: 5, note: 'Nhập thử' }, adm);
check('Nhập hàng tăng tồn kho', r.status === 201 && r.data.stock === stock0 + 5, `${stock0} -> ${r.data?.stock}`);
r = await call('POST', '/admin/inventory/20/export', { quantity: 2, note: 'Hàng lỗi' }, adm);
check('Xuất kho giảm tồn kho', r.status === 201 && r.data.stock === stock0 + 3);
r = await call('POST', '/admin/inventory/20/export', { quantity: 100000 }, adm);
check('Xuất vượt tồn → 409', r.status === 409, r.data?.message);
r = await call('POST', '/admin/inventory/20/import', { quantity: 0 }, adm);
check('Số lượng nhập không hợp lệ → 400', r.status === 400);
r = await get('/admin/inventory/movements?productId=20&type=IMPORT', adm);
check('Lịch sử kho ghi nhận lần nhập', r.status === 200 && r.data.items.some((m) => m.note === 'Nhập thử'));
check('Khách gọi API kho → 403', (await call('POST', '/admin/inventory/20/import', { quantity: 1 }, cust)).status === 403);

// ---------- Admin: thanh toán ----------
r = await call('PATCH', `/admin/orders/${order.code}/payment`, { paymentStatus: 'REFUNDED' }, adm);
check('Đơn đã thu → hoàn tiền', r.status === 200 && r.data.paymentStatus === 'REFUNDED');
r = await call('PATCH', `/admin/orders/${order.code}/payment`, { paymentStatus: 'PAID' }, adm);
check('Đã hoàn tiền không đổi lại được → 409', r.status === 409, r.data?.message);
r = await call('PATCH', `/admin/orders/${o2.code}/payment`, { paymentStatus: 'PAID' }, adm);
check('Đơn đã hủy không đổi thanh toán → 409', r.status === 409, r.data?.message);

// ---------- Admin: khách hàng ----------
r = await get('/admin/customers', adm);
check('Danh sách khách có thống kê, không lộ mật khẩu', r.status === 200 && r.data.some((c) => c.email === email) && !JSON.stringify(r.data).includes('passwordHash'));
check('Khách xem danh sách khách → 403', (await get('/admin/customers', cust)).status === 403);

// ---------- Admin: tải ảnh sản phẩm ----------
const uploadFile = async (bytes, name, type, token) => {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(API + '/admin/uploads', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
r = await uploadFile(pngBytes, 'anh san pham.png', 'image/png', adm);
check('Admin tải ảnh lên, tên file do server đặt', r.status === 201 && /^\/api\/uploads\/[0-9a-f-]{36}\.png$/.test(r.data.url), r.data?.url);
const image = await fetch(API.replace(/\/api$/, '') + r.data.url);
check('Ảnh đã tải xem được qua API', image.status === 200 && image.headers.get('content-type') === 'image/png');
check('Không đăng nhập không tải ảnh được → 401', (await uploadFile(pngBytes, 'a.png', 'image/png')).status === 401);
check('Khách không tải ảnh được → 403', (await uploadFile(pngBytes, 'a.png', 'image/png', cust)).status === 403);
r = await uploadFile(new TextEncoder().encode('<script>alert(1)</script>'), 'gia.png', 'image/png', adm);
check('File giả ảnh (đổi đuôi .png) → 400', r.status === 400, r.data?.message);
r = await uploadFile(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml', adm);
check('SVG có script → 400', r.status === 400, r.data?.message);
r = await uploadFile(new Uint8Array(5 * 1024 * 1024 + 1), 'lon.png', 'image/png', adm);
check('Ảnh quá 5 MB → 413', r.status === 413);

// ---------- Bảo mật & tài liệu ----------
const health = await fetch(API + '/health');
check('Header bảo mật từ helmet', health.headers.get('x-content-type-options') === 'nosniff' && !health.headers.has('x-powered-by'));
const cors = await fetch(API + '/health', { headers: { Origin: 'https://evil.example' } });
check('CORS không cấp quyền cho domain lạ', cors.headers.get('access-control-allow-origin') !== 'https://evil.example');
if (process.env.NODE_ENV !== 'production') {
  const docs = await fetch(API + '/docs-json').then((x) => x.json());
  check('Swagger mô tả đủ nhóm API', ['/api/auth/login', '/api/orders', '/api/admin/dashboard'].every((path) => path in docs.paths), `${Object.keys(docs.paths).length} đường dẫn`);
}
// Giữ ở cuối: sau bước này IP bị giới hạn đăng nhập trong 1 phút
let limited = false;
for (let i = 0; i < 12 && !limited; i++) limited = (await call('POST', '/auth/login', { email, password: 'sai-mat-khau' })).status === 429;
check('Đăng nhập sai liên tục → 429', limited);

console.log(results.join('\n'));
const pass = results.filter((x) => x.startsWith('PASS')).length;
console.log(`\n${pass}/${results.length} PASS`);
process.exit(pass === results.length ? 0 : 1);

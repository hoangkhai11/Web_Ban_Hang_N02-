import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/layout/AdminLayout'
import { CustomerLayout } from './components/layout/CustomerLayout'
import { RequireAdmin, RequireAuth } from './components/layout/Guards'
import { AccountLayout, MyOrderDetailPage, MyOrdersPage, ProfilePage } from './pages/account/AccountPages'
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/account/AuthPages'
import { AdminCustomers, AdminPromotions } from './pages/admin/AdminAdvancedPages'
import { AdminCategories } from './pages/admin/AdminCatalogPages'
import { AdminInventory } from './pages/admin/AdminInventory'
import AdminDashboard from './pages/admin/AdminDashboard'
import { AdminInvoice, AdminOrderDetail, AdminOrders } from './pages/admin/AdminOrderPages'
import AdminProducts from './pages/admin/AdminProducts'
import CartPage from './pages/customer/CartPage'
import CheckoutPage from './pages/customer/CheckoutPage'
import HomePage from './pages/customer/HomePage'
import OrderSuccessPage from './pages/customer/OrderSuccessPage'
import ProductDetailPage from './pages/customer/ProductDetailPage'
import ProductListPage from './pages/customer/ProductListPage'
import { AboutPage, ContactPage, PolicyPage, PromotionsPage, SupportPage } from './pages/info/InfoPages'
import NotFoundPage from './pages/info/NotFoundPage'

/** Sitemap theo LAB 5 — khu vực khách hàng và Admin tách biệt. */
export default function App() {
  return (
    <Routes>
      {/* Đăng nhập / đăng ký / quên mật khẩu: trang riêng, không có header và menu của cửa hàng */}
      <Route path="dang-nhap" element={<LoginPage />} />
      <Route path="dang-ky" element={<RegisterPage />} />
      <Route path="quen-mat-khau" element={<ForgotPasswordPage />} />

      <Route element={<CustomerLayout />}>
        <Route index element={<HomePage />} />
        {/* Sản phẩm & tìm kiếm */}
        <Route path="danh-muc/:slug" element={<ProductListPage mode="category" />} />
        <Route path="tim-kiem" element={<ProductListPage mode="search" />} />
        <Route path="san-pham/:slug" element={<ProductDetailPage />} />
        {/* Mua hàng */}
        <Route path="gio-hang" element={<CartPage />} />
        <Route path="thanh-toan" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        <Route path="dat-hang-thanh-cong/:code" element={<RequireAuth><OrderSuccessPage /></RequireAuth>} />
        {/* Tài khoản */}
        <Route path="tai-khoan" element={<RequireAuth><AccountLayout /></RequireAuth>}>
          <Route index element={<ProfilePage />} />
          <Route path="don-hang" element={<MyOrdersPage />} />
          <Route path="don-hang/:code" element={<MyOrderDetailPage />} />
        </Route>
        {/* Thông tin */}
        <Route path="khuyen-mai" element={<PromotionsPage />} />
        <Route path="ho-tro" element={<SupportPage />} />
        <Route path="chinh-sach/:type" element={<PolicyPage />} />
        <Route path="gioi-thieu" element={<AboutPage />} />
        <Route path="lien-he" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Khu vực Admin */}
      <Route path="admin/dang-nhap" element={<LoginPage admin />} />
      {/* Hóa đơn in: không dùng AdminLayout để trang in chỉ có nội dung hóa đơn */}
      <Route path="admin/don-hang/:code/hoa-don" element={<RequireAdmin><AdminInvoice /></RequireAdmin>} />
      <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<AdminDashboard />} />
        <Route path="san-pham" element={<AdminProducts />} />
        <Route path="danh-muc" element={<AdminCategories />} />
        <Route path="ton-kho" element={<AdminInventory />} />
        <Route path="don-hang" element={<AdminOrders />} />
        <Route path="don-hang/:code" element={<AdminOrderDetail />} />
        <Route path="khach-hang" element={<AdminCustomers />} />
        <Route path="khuyen-mai" element={<AdminPromotions />} />
      </Route>
    </Routes>
  )
}

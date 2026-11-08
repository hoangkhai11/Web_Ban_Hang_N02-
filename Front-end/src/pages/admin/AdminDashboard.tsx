import { AlertTriangle, Ban, ClipboardList, Package, Receipt, Users, Wallet, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '../../components/common/Misc'
import { ErrorState, Spinner } from '../../components/common/States'
import { ProductImage } from '../../components/product/ProductCard'
import { AdminPageTitle } from '../../components/layout/AdminLayout'
import { useAsync } from '../../hooks/useAsync'
import { classNames, formatDateTime, formatVND } from '../../lib/format'
import { ORDER_STATUS_LABEL } from '../../lib/orderStatus'
import { getDashboard, type DashboardDays } from '../../services/adminService'

const PERIODS: { days: DashboardDays; label: string }[] = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
]

/** Rút gọn số tiền cho nhãn biểu đồ: 12.5tr, 850k */
const shortVND = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}tr` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))

function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue))
  // Với 30/90 ngày chỉ hiện nhãn ngày thưa để không chồng chữ
  const labelEvery = data.length <= 7 ? 1 : data.length <= 30 ? 5 : 15
  return (
    <div>
      <div className={classNames('flex h-48 items-end border-b border-slate-200', data.length <= 7 ? 'gap-3' : 'gap-px')}>
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center">
            <div className="w-full max-w-10 rounded-t bg-brand-600 transition group-hover:bg-brand-800" style={{ height: `${Math.max(d.revenue ? 4 : 0, (d.revenue / max) * 100)}%` }} />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
              {new Date(d.date).toLocaleDateString('vi-VN')}: {formatVND(d.revenue)}
            </div>
          </div>
        ))}
      </div>
      <div className={classNames('mt-2 flex', data.length <= 7 ? 'gap-3' : 'gap-px')}>
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 text-center text-xs whitespace-nowrap text-slate-500">
            {i % labelEvery === 0 ? new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [days, setDays] = useState<DashboardDays>(7)
  const { data, loading, error, reload } = useAsync(() => getDashboard(days), [days])
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />

  const { period, inventory } = data
  const cancelRate = period.orders ? Math.round((period.cancelledOrders / period.orders) * 100) : 0

  const periodStats = [
    { label: `Doanh thu ${days} ngày`, value: formatVND(period.revenue), sub: `${period.completedOrders} đơn hoàn thành`, icon: Wallet },
    { label: `Đơn hàng ${days} ngày`, value: period.orders, sub: `${data.pendingOrders} đơn đang chờ xác nhận`, icon: ClipboardList, warn: data.pendingOrders > 0 },
    { label: 'Giá trị đơn trung bình', value: formatVND(period.averageOrderValue), sub: 'Tính trên đơn hoàn thành', icon: Receipt },
    { label: 'Tỷ lệ hủy đơn', value: `${cancelRate}%`, sub: `${period.cancelledOrders} đơn bị hủy`, icon: Ban, warn: cancelRate >= 20 },
  ]
  const totals = [
    { label: 'Tổng doanh thu', value: formatVND(data.revenue), sub: `${data.totalOrders} đơn từ trước tới nay`, icon: Wallet },
    { label: 'Giá trị tồn kho', value: formatVND(inventory.value), sub: `${inventory.units.toLocaleString('vi-VN')} sản phẩm trong kho`, icon: Warehouse },
    { label: 'Sản phẩm đang bán', value: data.products, sub: inventory.outOfStock ? `${inventory.outOfStock} mã đã hết hàng` : 'Không có mã hết hàng', icon: Package, warn: inventory.outOfStock > 0 },
    { label: 'Khách hàng', value: data.customers, icon: Users },
  ]
  const maxCategory = Math.max(1, ...data.revenueByCategory.map((c) => c.revenue))

  return (
    <>
      <AdminPageTitle
        title="Dashboard"
        subtitle="Tổng quan hoạt động cửa hàng"
        action={
          <div className="flex rounded-lg bg-white p-1 shadow-sm">
            {PERIODS.map((p) => (
              <button key={p.days} onClick={() => setDays(p.days)} className={classNames('rounded-md px-3 py-1.5 text-sm font-medium', days === p.days ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-surface')}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {[periodStats, totals].map((group, gi) => (
        <div key={gi} className={classNames('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', gi > 0 && 'mt-4', loading && 'opacity-60')}>
          {group.map(({ label, value, sub, icon: Icon, warn }) => (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{label}</span>
                <Icon className="size-5 text-brand-700" />
              </div>
              <p className="mt-2 text-2xl font-bold">{value}</p>
              {sub && <p className={classNames('text-xs', warn ? 'text-amber-600' : 'text-slate-500')}>{sub}</p>}
            </div>
          ))}
        </div>
      ))}

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="card p-5">
          <h2 className="font-semibold">Doanh thu {days} ngày gần nhất</h2>
          <p className="mb-4 text-xs text-slate-500">Chỉ tính đơn đã hoàn thành (theo ngày hoàn thành); không tính đơn đã hủy.</p>
          <RevenueChart data={data.revenueByDay} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Đơn hàng theo trạng thái</h2>
          <ul className="space-y-2 text-sm">
            {data.statusCounts.map((s) => (
              <li key={s.status}>
                <Link to={`/admin/don-hang?status=${s.status}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface">
                  <span>{ORDER_STATUS_LABEL[s.status]}</span>
                  <b>{s.count}</b>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="card p-5">
          <h2 className="font-semibold">Sản phẩm bán chạy ({days} ngày)</h2>
          <p className="mb-3 text-xs text-slate-500">Theo số lượng trong các đơn đặt trong kỳ, không tính đơn đã hủy.</p>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có đơn hàng trong kỳ này.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 uppercase">
                <tr><th className="pb-2">#</th><th className="pb-2">Sản phẩm</th><th className="pb-2 text-right">Đã bán</th><th className="pb-2 text-right">Doanh số</th><th className="pb-2 text-right">Tồn</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topProducts.map((p, i) => (
                  <tr key={p.productId}>
                    <td className="py-2 pr-2 font-bold text-slate-400">{i + 1}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3">
                        <ProductImage src={p.image} alt="" className="size-9 shrink-0 rounded object-cover" />
                        <div className="min-w-0"><p className="line-clamp-1 font-medium">{p.name}</p><p className="text-xs text-slate-500">{p.code}</p></div>
                      </div>
                    </td>
                    <td className="py-2 text-right font-semibold">{p.quantity}</td>
                    <td className="py-2 text-right">{formatVND(p.revenue)}</td>
                    <td className={classNames('py-2 text-right', p.stock === 0 ? 'font-semibold text-red-600' : p.stock <= 5 ? 'font-semibold text-amber-600' : 'text-slate-600')}>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Doanh thu theo danh mục ({days} ngày)</h2>
          <p className="mb-4 text-xs text-slate-500">Tiền hàng của đơn hoàn thành, không gồm phí vận chuyển.</p>
          {data.revenueByCategory.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có đơn hoàn thành trong kỳ này.</p>
          ) : (
            <ul className="space-y-4">
              {data.revenueByCategory.map((c) => (
                <li key={c.name} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3"><span>{c.name}</span><b title={formatVND(c.revenue)}>{shortVND(c.revenue)}</b></div>
                  <div className="h-2.5 rounded-full bg-surface"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(c.revenue / maxCategory) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Đơn hàng mới nhất</h2>
            <Link to="/admin/don-hang" className="text-sm text-brand-700 hover:underline">Xem tất cả</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {data.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="py-2"><Link to={`/admin/don-hang/${o.code}`} className="font-semibold text-brand-700">{o.code}</Link><p className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</p></td>
                  <td className="py-2"><OrderStatusBadge status={o.status} /></td>
                  <td className="py-2 text-right font-semibold">{formatVND(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-500" /> Sắp hết / hết hàng (≤ 5)</h2>
            <Link to="/admin/ton-kho" className="text-sm text-brand-700 hover:underline">Quản lý kho</Link>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">Không có sản phẩm sắp hết hàng.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="line-clamp-1">{p.code} — {p.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{p.stock === 0 ? 'Hết hàng' : `Còn ${p.stock}`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

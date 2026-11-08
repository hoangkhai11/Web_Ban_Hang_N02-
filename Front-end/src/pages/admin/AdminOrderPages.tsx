import { AlertTriangle, ArrowLeft, Download, Loader2, Printer, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { OrderStatusBadge, Pagination, PaymentStatusBadge } from '../../components/common/Misc'
import { EmptyState, ErrorState, Spinner } from '../../components/common/States'
import { ProductImage } from '../../components/product/ProductCard'
import { AdminPageTitle } from '../../components/layout/AdminLayout'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { downloadCsv, toDateInput } from '../../lib/csv'
import { classNames, formatDateTime, formatVND, readVND } from '../../lib/format'
import { allowedPaymentStatuses, ORDER_STATUS_LABEL, ORDER_TRANSITIONS, PAYMENT_STATUS_LABEL } from '../../lib/orderStatus'
import { getOrder, listAllOrders, listOrders, updateOrderStatus, updatePaymentStatus } from '../../services/adminService'
import type { OrderStatus, PaymentStatus } from '../../types'
import { OrderTimeline } from '../account/AccountPages'

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateInput(d)
}
const firstOfMonth = () => {
  const d = new Date()
  return toDateInput(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function AdminOrders() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as OrderStatus | ''
  const paymentStatus = (params.get('payment') ?? '') as PaymentStatus | ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const search = params.get('q') ?? ''
  const page = Number(params.get('page')) || 1
  const filter = { status, paymentStatus, from, to, q: search }
  // Lọc, tìm kiếm, phân trang đều làm ở server
  const { data, loading, error, reload } = useAsync(() => listOrders({ ...filter, page, pageSize: 20 }), [status, paymentStatus, from, to, search, page])
  const [q, setQ] = useState(search)
  const [exporting, setExporting] = useState(false)
  // Tính mốc ngày một lần khi mở trang
  const [presets] = useState(() => [
    { label: 'Hôm nay', from: daysAgo(0), to: daysAgo(0) },
    { label: '7 ngày', from: daysAgo(6), to: '' },
    { label: '30 ngày', from: daysAgo(29), to: '' },
    { label: 'Tháng này', from: firstOfMonth(), to: '' },
    { label: 'Tất cả', from: '', to: '' },
  ])

  /** Cập nhật 1 hoặc nhiều tham số lọc trên URL (giữ nguyên các tham số khác); đổi bộ lọc thì về trang 1 */
  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }

  // Gõ tìm kiếm: chờ 300ms sau lần gõ cuối mới gọi API
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() !== search) setFilter({ q: q.trim() })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const rows = data?.items ?? []
  const s = data?.summary
  const summary = [
    { label: 'Số đơn', value: (data?.total ?? 0).toLocaleString('vi-VN'), sub: `${s?.cancelled ?? 0} đơn đã hủy` },
    { label: 'Tổng giá trị (trừ đơn hủy)', value: formatVND(s?.validTotal ?? 0) },
    { label: 'Đã thu', value: formatVND(s?.paid ?? 0), cls: 'text-emerald-700' },
    { label: 'Chưa thu (COD)', value: formatVND(s?.unpaid ?? 0), cls: 'text-amber-700' },
    { label: 'Đã hoàn tiền', value: formatVND(s?.refunded ?? 0), cls: 'text-violet-700' },
  ]

  /** Xuất CSV toàn bộ đơn khớp bộ lọc (không chỉ trang đang xem) */
  const exportCsv = async () => {
    setExporting(true)
    let all: Awaited<ReturnType<typeof listAllOrders>>
    try {
      all = await listAllOrders(filter)
    } catch (e) {
      alert((e as Error).message)
      return
    } finally {
      setExporting(false)
    }
    downloadCsv(
      `don-hang-${toDateInput(new Date())}.csv`,
      ['Mã đơn', 'Ngày đặt', 'Người nhận', 'SĐT', 'Email tài khoản', 'Địa chỉ', 'Số SP', 'Tạm tính', 'Giảm giá', 'Phí ship', 'Tổng tiền', 'Trạng thái', 'Thanh toán'],
      all.map((o) => [
        o.code,
        formatDateTime(o.createdAt),
        o.shipping.fullName,
        o.shipping.phone,
        o.customerEmail,
        `${o.shipping.address}, ${o.shipping.district}, ${o.shipping.province}`,
        o.items.reduce((s, i) => s + i.quantity, 0),
        o.subtotal,
        o.discountTotal,
        o.shippingFee,
        o.total,
        ORDER_STATUS_LABEL[o.status],
        PAYMENT_STATUS_LABEL[o.paymentStatus],
      ]),
    )
  }

  return (
    <>
      <AdminPageTitle
        title="Đơn hàng & hóa đơn"
        subtitle="Theo dõi, xử lý đơn và đối soát tiền thu COD"
        action={<button className="btn-outline" onClick={exportCsv} disabled={!data?.total || exporting}>{exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Xuất CSV</button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[{ v: '', l: 'Tất cả' }, ...STATUSES.map((s) => ({ v: s, l: ORDER_STATUS_LABEL[s] }))].map((t) => (
          <button key={t.v} onClick={() => setFilter({ status: t.v })} className={classNames('rounded-full px-4 py-1.5 text-sm font-medium', status === t.v ? 'bg-brand-700 text-white' : 'bg-white text-slate-600')}>{t.l}</button>
        ))}
      </div>
      <div className="card mb-4 space-y-3 p-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute top-3 left-3 size-4 text-slate-400" />
            <input className="input pl-9" placeholder="Tìm mã đơn, tên, SĐT, email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={paymentStatus} onChange={(e) => setFilter({ payment: e.target.value })} aria-label="Thanh toán">
            <option value="">Mọi trạng thái thanh toán</option>
            {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((p) => <option key={p} value={p}>{PAYMENT_STATUS_LABEL[p]}</option>)}
          </select>
          <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFilter({ from: e.target.value })} aria-label="Từ ngày" />
          <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setFilter({ to: e.target.value })} aria-label="Đến ngày" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Ngày đặt:</span>
          {presets.map((p) => (
            <button key={p.label} onClick={() => setFilter({ from: p.from, to: p.to })} className={classNames('rounded-md px-2.5 py-1', from === p.from && to === p.to ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-surface')}>{p.label}</button>
          ))}
        </div>
      </div>

      {!error && data && (
        <div className={classNames('mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5', loading && 'opacity-60')}>
          {summary.map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={classNames('mt-1 text-lg font-bold', s.cls)}>{s.value}</p>
              {s.sub && <p className="text-xs text-slate-500">{s.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState title="Không có đơn hàng" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-surface text-left text-xs text-slate-500 uppercase">
              <tr><th className="px-4 py-3">Mã đơn</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Ngày đặt</th><th className="px-4 py-3 text-right">Tổng tiền</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thanh toán</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3"><Link to={`/admin/don-hang/${o.code}`} className="font-semibold text-brand-700 hover:underline">{o.code}</Link></td>
                  <td className="px-4 py-3"><p>{o.shipping.fullName}</p><p className="text-xs text-slate-500">{o.shipping.phone}</p></td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatVND(o.total)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/don-hang/${o.code}/hoa-don`} className="btn-ghost inline-flex p-2" title="In hóa đơn" aria-label={`In hóa đơn ${o.code}`}><Printer className="size-4" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <div className="mt-4">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setFilter({ page: String(p) })} />
        </div>
      )}
    </>
  )
}

export function AdminOrderDetail() {
  const { code = '' } = useParams()
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => getOrder(code), [code])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />
  const { order, customer, stock } = data
  const next = ORDER_TRANSITIONS[order.status]

  const changeStatus = async (s: OrderStatus) => {
    const msg = s === 'CANCELLED' ? 'Hủy đơn này? Tồn kho sẽ được hoàn lại.' : `Chuyển đơn sang "${ORDER_STATUS_LABEL[s]}"?`
    if (!confirm(msg)) return
    setBusy(true)
    try {
      await updateOrderStatus(order.code, s, note)
      toast.success(`Đã cập nhật: ${ORDER_STATUS_LABEL[s]}`)
      setNote('')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const paymentOptions = allowedPaymentStatuses(order.status, order.paymentStatus)
  const changePayment = async (p: PaymentStatus) => {
    try {
      await updatePaymentStatus(order.code, p)
      toast.success('Đã cập nhật trạng thái thanh toán')
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <Link to="/admin/don-hang" className="text-sm text-brand-700 hover:underline">← Danh sách đơn hàng</Link>
      <AdminPageTitle
        title={`Đơn hàng ${order.code}`}
        subtitle={`Đặt lúc ${formatDateTime(order.createdAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <Link to={`/admin/don-hang/${order.code}/hoa-don`} className="btn-outline py-1.5"><Printer className="size-4" /> In hóa đơn</Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card p-5"><OrderTimeline order={order} /></div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Sản phẩm & kiểm tra tồn kho</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-3 py-3 text-sm">
                  <ProductImage src={i.image} alt="" className="size-12 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-medium">{i.productName}</p>
                    <p className="text-xs text-slate-500">{i.productCode} · {formatVND(i.unitPrice)} × {i.quantity}</p>
                    <p className="text-xs text-slate-500">Tồn kho hiện tại: <b>{stock[i.productId]}</b> (đã trừ {i.quantity} cho đơn này{order.stockReleased ? ' — đã hoàn lại' : ''})</p>
                  </div>
                  <span className="font-semibold">{formatVND(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 ml-auto max-w-xs space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Tạm tính</span><span>{formatVND(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Giảm giá</span><span>-{formatVND(order.discountTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Phí vận chuyển</span><span>{formatVND(order.shippingFee)}</span></div>
              <div className="flex justify-between font-bold"><span>Tổng</span><span className="text-red-600">{formatVND(order.total)}</span></div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Lịch sử xử lý</h2>
            <ul className="space-y-2 text-sm">
              {[...order.history].reverse().map((h, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="w-36 shrink-0 text-xs text-slate-500">{formatDateTime(h.at)}</span>
                  <span><b>{ORDER_STATUS_LABEL[h.status]}</b>{h.note && <span className="text-slate-600"> — {h.note}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Cập nhật trạng thái đơn</h2>
            {next.length === 0 ? (
              <p className="text-sm text-slate-500">Đơn đã ở trạng thái cuối, không thể thay đổi.</p>
            ) : (
              <>
                <textarea className="input mb-3" rows={2} placeholder="Ghi chú (VD: lý do hủy, mã vận đơn...)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-col gap-2">
                  {next.map((s) => (
                    <button key={s} disabled={busy} onClick={() => changeStatus(s)} className={s === 'CANCELLED' ? 'btn-outline border-red-300 text-red-600 hover:border-red-600 hover:text-red-700' : 'btn-primary'}>
                      {busy && <Loader2 className="size-4 animate-spin" />}
                      {s === 'CANCELLED' ? 'Hủy đơn hàng' : `Chuyển sang: ${ORDER_STATUS_LABEL[s]}`}
                    </button>
                  ))}
                </div>
                {order.status === 'PENDING' && (
                  <p className="mt-3 flex gap-1.5 text-xs text-slate-500"><AlertTriangle className="size-4 shrink-0 text-amber-500" /> Kiểm tra thông tin người nhận và tồn kho trước khi xác nhận. Nếu thông tin không hợp lệ, hãy hủy đơn kèm lý do.</p>
                )}
              </>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Thanh toán (COD)</h2>
            {/* Chỉ hiện trạng thái hiện tại + các bước chuyển hợp lệ (Back-end cũng kiểm tra lại) */}
            <select className="input" value={order.paymentStatus} disabled={paymentOptions.length === 0} onChange={(e) => changePayment(e.target.value as PaymentStatus)}>
              {[order.paymentStatus, ...paymentOptions].map((p) => <option key={p} value={p}>{PAYMENT_STATUS_LABEL[p]}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {order.status === 'CANCELLED'
                ? 'Đơn đã hủy: không thể thay đổi thanh toán (đơn đã thu tiền được tự chuyển sang "Đã hoàn tiền").'
                : order.paymentStatus === 'REFUNDED'
                  ? 'Đã hoàn tiền: không thể thay đổi thêm.'
                  : 'Quản lý riêng với trạng thái đơn. Hệ thống tự ghi nhận "Đã thanh toán" khi đơn COD hoàn thành.'}
            </p>
          </div>

          <div className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Người nhận</h2>
            <p>{order.shipping.fullName}</p>
            <p>{order.shipping.phone}</p>
            <p className="text-slate-600">{order.shipping.address}, {order.shipping.district}, {order.shipping.province}</p>
            {order.shipping.note && <p className="mt-1 text-slate-500">Ghi chú: {order.shipping.note}</p>}
            {customer && (
              <>
                <h2 className="mt-4 mb-1 font-semibold">Tài khoản đặt hàng</h2>
                <p>{customer.fullName} · {customer.email}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ======================= HÓA ĐƠN (bản in) =======================

const SHOP = { name: 'GICUNGCO', tagline: 'Máy tính · Laptop · Linh kiện · Phụ kiện', hotline: '1900 6868', email: 'hotro@gicungco.vn' }

export function AdminInvoice() {
  const { code = '' } = useParams()
  const { data, loading, error, reload } = useAsync(() => getOrder(code), [code])
  if (loading) return <Spinner />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />
  const { order, customer } = data
  const cancelled = order.status === 'CANCELLED'
  const qty = order.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="min-h-screen bg-surface py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 px-4 print:hidden">
        <Link to={`/admin/don-hang/${order.code}`} className="flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="size-4" /> Quay lại đơn hàng</Link>
        <button className="btn-primary" onClick={() => window.print()}><Printer className="size-4" /> In / Lưu PDF</button>
      </div>

      <article className="relative mx-auto max-w-3xl overflow-hidden bg-white p-8 text-sm shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {cancelled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded-lg border-4 border-red-500/40 px-6 py-2 text-6xl font-black text-red-500/30">ĐÃ HỦY</span>
          </div>
        )}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <p className="text-2xl font-black tracking-tight text-brand-700">{SHOP.name}</p>
            <p className="text-xs text-slate-600">{SHOP.tagline}</p>
            <p className="text-xs text-slate-600">Hotline: {SHOP.hotline} · Email: {SHOP.email}</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold uppercase">Hóa đơn bán hàng</h1>
            <p>Số: <b>{order.code}</b></p>
            <p className="text-slate-600">Ngày: {formatDateTime(order.createdAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Người nhận hàng</p>
            <p className="font-semibold">{order.shipping.fullName}</p>
            <p>SĐT: {order.shipping.phone}</p>
            <p>Địa chỉ: {order.shipping.address}, {order.shipping.district}, {order.shipping.province}</p>
            {order.shipping.note && <p className="text-slate-600">Ghi chú: {order.shipping.note}</p>}
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Thanh toán</p>
            <p>Hình thức: Thanh toán khi nhận hàng (COD)</p>
            <p>Trạng thái: <b>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</b></p>
            <p>Đơn hàng: <b>{ORDER_STATUS_LABEL[order.status]}</b></p>
            {customer && <p className="text-slate-600">Tài khoản: {customer.email}</p>}
          </div>
        </section>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-y border-slate-300 bg-surface text-left text-xs uppercase print:bg-white">
              <th className="px-2 py-2">STT</th><th className="px-2 py-2">Mã hàng</th><th className="px-2 py-2">Tên hàng</th>
              <th className="px-2 py-2 text-right">SL</th><th className="px-2 py-2 text-right">Đơn giá</th><th className="px-2 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={i.productId} className="border-b border-slate-200 align-top">
                <td className="px-2 py-2">{idx + 1}</td>
                <td className="px-2 py-2 font-mono text-xs">{i.productCode}</td>
                <td className="px-2 py-2">{i.productName}</td>
                <td className="px-2 py-2 text-right">{i.quantity}</td>
                <td className="px-2 py-2 text-right">
                  {formatVND(i.unitPrice)}
                  {i.originalPrice > i.unitPrice && <p className="text-xs text-slate-400 line-through">{formatVND(i.originalPrice)}</p>}
                </td>
                <td className="px-2 py-2 text-right font-semibold">{formatVND(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1">
          <div className="flex justify-between"><span className="text-slate-600">Tạm tính ({qty} sản phẩm)</span><span>{formatVND(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Giảm giá</span><span>-{formatVND(order.discountTotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Phí vận chuyển</span><span>{order.shippingFee ? formatVND(order.shippingFee) : 'Miễn phí'}</span></div>
          <div className="flex justify-between border-t border-ink pt-2 text-base font-bold"><span>Tổng thanh toán</span><span>{formatVND(order.total)}</span></div>
        </div>
        <p className="mt-2 text-right italic">Bằng chữ: {readVND(order.total)}</p>

        <div className="mt-10 grid grid-cols-2 text-center">
          <div><p className="font-semibold">Người mua hàng</p><p className="text-xs text-slate-500">(Ký, ghi rõ họ tên)</p></div>
          <div><p className="font-semibold">Người bán hàng</p><p className="text-xs text-slate-500">(Ký, ghi rõ họ tên)</p></div>
        </div>
        <p className="mt-20 text-center text-xs text-slate-500">Cảm ơn quý khách đã mua sắm tại {SHOP.name}! Vui lòng giữ hóa đơn để được bảo hành.</p>
      </article>
    </div>
  )
}

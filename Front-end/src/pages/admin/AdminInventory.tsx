import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Download, History, Loader2, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal } from '../../components/common/Misc'
import { EmptyState, ErrorState, Spinner } from '../../components/common/States'
import { AdminPageTitle } from '../../components/layout/AdminLayout'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { downloadCsv, toDateInput } from '../../lib/csv'
import { classNames, formatDateTime, formatVND } from '../../lib/format'
import { exportStock, importStock, listMovements, listProducts, updateStock, type StockMovementType } from '../../services/adminService'
import type { Product } from '../../types'

const LOW_STOCK = 5

const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  IMPORT: 'Nhập hàng',
  EXPORT: 'Xuất kho',
  ADJUST: 'Kiểm kê',
  ORDER: 'Bán hàng',
  RETURN: 'Hoàn kho',
}

const MOVEMENT_STYLE: Record<StockMovementType, string> = {
  IMPORT: 'bg-emerald-100 text-emerald-800',
  EXPORT: 'bg-orange-100 text-orange-800',
  ADJUST: 'bg-slate-100 text-slate-700',
  ORDER: 'bg-blue-100 text-blue-800',
  RETURN: 'bg-violet-100 text-violet-800',
}

const stockStatus = (stock: number) =>
  stock === 0 ? { label: 'Hết hàng', cls: 'bg-red-100 text-red-700' } : stock <= LOW_STOCK ? { label: 'Sắp hết', cls: 'bg-amber-100 text-amber-800' } : { label: 'Còn hàng', cls: 'bg-emerald-100 text-emerald-800' }

// ======================= Phiếu nhập / xuất / kiểm kê =======================

type StockMode = 'import' | 'export' | 'adjust'

const MODE_TEXT: Record<StockMode, { title: string; qty: string; button: string; notePlaceholder: string }> = {
  import: { title: 'Nhập hàng', qty: 'Số lượng nhập *', button: 'Xác nhận nhập', notePlaceholder: 'VD: Nhập từ nhà phân phối ABC, phiếu NK-0012' },
  export: { title: 'Xuất kho', qty: 'Số lượng xuất *', button: 'Xác nhận xuất', notePlaceholder: 'VD: Hàng lỗi gửi bảo hành, xuất trưng bày...' },
  adjust: { title: 'Kiểm kê', qty: 'Số lượng thực tế đếm được *', button: 'Cập nhật tồn kho', notePlaceholder: 'VD: Kiểm kê cuối tháng, phát hiện thiếu 1' },
}

function StockForm({ product, mode, onDone, onCancel }: { product: Product; mode: StockMode; onDone: () => void; onCancel: () => void }) {
  const toast = useToast()
  const [qty, setQty] = useState(mode === 'adjust' ? String(product.stock) : '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const t = MODE_TEXT[mode]
  const n = Number(qty)
  const valid = qty !== '' && Number.isInteger(n) && (mode === 'adjust' ? n >= 0 : n >= 1)
  const after = !valid ? null : mode === 'import' ? product.stock + n : mode === 'export' ? product.stock - n : n

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return setError(mode === 'adjust' ? 'Số lượng phải là số nguyên >= 0' : 'Số lượng phải là số nguyên >= 1')
    if (mode === 'export' && n > product.stock) return setError(`Không thể xuất quá tồn kho hiện tại (${product.stock})`)
    if (mode === 'adjust' && n === product.stock) return setError('Số lượng thực tế trùng với tồn kho, không cần điều chỉnh')
    setSaving(true)
    setError('')
    try {
      if (mode === 'import') await importStock(product.id, n, note)
      else if (mode === 'export') await exportStock(product.id, n, note)
      else await updateStock(product.id, n, note)
      toast.success(`${t.title}: ${product.code} — tồn kho mới ${after}`)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="rounded-lg bg-surface p-3 text-sm">
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-slate-500">{product.code} · Tồn kho hiện tại: <b>{product.stock}</b></p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <label className="label">{t.qty}</label>
        <input className="input" type="number" min={mode === 'adjust' ? 0 : 1} autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        {after !== null && (
          <p className={classNames('mt-1 text-xs', after < 0 ? 'text-red-600' : 'text-slate-500')}>
            Tồn kho sau khi cập nhật: <b>{after}</b>
            {mode === 'adjust' && after !== product.stock && ` (${after > product.stock ? '+' : ''}${after - product.stock})`}
          </p>
        )}
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <textarea className="input" rows={2} value={note} maxLength={500} placeholder={t.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onCancel}>Hủy</button>
        <button className="btn-primary" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} {t.button}</button>
      </div>
    </form>
  )
}

// ======================= Tab Tồn kho =======================

function StockTab({ products, reload, onHistory }: { products: Product[]; reload: () => void; onHistory: (p: Product) => void }) {
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [q, setQ] = useState('')
  const [action, setAction] = useState<{ product: Product; mode: StockMode } | null>(null)

  const low = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length
  const out = products.filter((p) => p.stock === 0).length
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return products
      .filter((p) => (filter === 'low' ? p.stock > 0 && p.stock <= LOW_STOCK : filter === 'out' ? p.stock === 0 : true))
      .filter((p) => !term || p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term))
  }, [products, filter, q])

  const exportReport = () =>
    downloadCsv(
      `ton-kho-${toDateInput(new Date())}.csv`,
      ['Mã', 'Sản phẩm', 'Thương hiệu', 'Giá bán', 'Tồn kho', 'Giá trị tồn', 'Đã bán', 'Trạng thái'],
      rows.map((p) => [p.code, p.name, p.brand, p.price, p.stock, p.price * p.stock, p.soldCount, stockStatus(p.stock).label]),
    )

  const tabs = [
    { key: 'all', label: `Tất cả (${products.length})` },
    { key: 'low', label: `Sắp hết (${low})` },
    { key: 'out', label: `Hết hàng (${out})` },
  ] as const

  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)} className={classNames('rounded-full px-4 py-1.5 text-sm font-medium', filter === t.key ? 'bg-brand-700 text-white' : 'bg-surface text-slate-600')}>{t.label}</button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-3 left-3 size-4 text-slate-400" />
          <input className="input pl-9" placeholder="Tìm theo mã, tên, thương hiệu" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-outline" onClick={exportReport} disabled={rows.length === 0}><Download className="size-4" /> Xuất CSV</button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Không có sản phẩm phù hợp" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3 text-right">Tồn kho</th>
                <th className="px-4 py-3 text-right">Giá trị tồn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const st = stockStatus(p.stock)
                return (
                  <tr key={p.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-3"><p className="line-clamp-1">{p.name}</p><p className="text-xs text-slate-500">{formatVND(p.price)} · đã bán {p.soldCount}</p></td>
                    <td className="px-4 py-3 text-right text-base font-bold">{p.stock}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatVND(p.price * p.stock)}</td>
                    <td className="px-4 py-3"><span className={classNames('rounded-full px-2 py-0.5 text-xs font-semibold', st.cls)}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2 py-1.5 text-xs text-emerald-700" onClick={() => setAction({ product: p, mode: 'import' })}><ArrowDownToLine className="size-4" /> Nhập</button>
                        <button className="btn-ghost px-2 py-1.5 text-xs text-orange-700" disabled={p.stock === 0} onClick={() => setAction({ product: p, mode: 'export' })}><ArrowUpFromLine className="size-4" /> Xuất</button>
                        <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setAction({ product: p, mode: 'adjust' })}><ClipboardCheck className="size-4" /> Kiểm kê</button>
                        <button className="btn-ghost p-1.5" onClick={() => onHistory(p)} aria-label={`Lịch sử kho ${p.code}`} title="Lịch sử kho"><History className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={action !== null} title={action ? MODE_TEXT[action.mode].title : ''} onClose={() => setAction(null)}>
        {action && (
          <StockForm
            key={`${action.product.id}-${action.mode}`}
            product={action.product}
            mode={action.mode}
            onCancel={() => setAction(null)}
            onDone={() => {
              setAction(null)
              reload()
            }}
          />
        )}
      </Modal>
    </>
  )
}

// ======================= Tab Lịch sử =======================

function HistoryTab({ products, productId, setProductId }: { products: Product[]; productId: number | undefined; setProductId: (id: number | undefined) => void }) {
  const [type, setType] = useState<StockMovementType | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const query = { productId, type, from, to, page, pageSize: 20 }
  const { data, loading, error, reload } = useAsync(() => listMovements(query), [JSON.stringify(query)])
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  return (
    <>
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
        <select className="input" value={productId ?? ''} onChange={(e) => resetPage(setProductId)(e.target.value ? Number(e.target.value) : undefined)} aria-label="Sản phẩm">
          <option value="">Tất cả sản phẩm</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => resetPage(setType)(e.target.value as StockMovementType | '')} aria-label="Loại">
          <option value="">Tất cả loại</option>
          {(Object.keys(MOVEMENT_LABEL) as StockMovementType[]).map((t) => <option key={t} value={t}>{MOVEMENT_LABEL[t]}</option>)}
        </select>
        <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} aria-label="Từ ngày" />
        <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} aria-label="Đến ngày" />
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Chưa có biến động kho" />
      ) : (
        <>
          <div className={classNames('card overflow-x-auto', loading && 'opacity-60')}>
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-surface text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3 text-right">Thay đổi</th><th className="px-4 py-3 text-right">Tồn sau</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3"><p className="line-clamp-1">{m.product.name}</p><p className="font-mono text-xs text-slate-500">{m.product.code}</p></td>
                    <td className="px-4 py-3"><span className={classNames('rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', MOVEMENT_STYLE[m.type])}>{MOVEMENT_LABEL[m.type]}</span></td>
                    <td className={classNames('px-4 py-3 text-right font-bold', m.quantity > 0 ? 'text-emerald-700' : 'text-red-600')}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                    <td className="px-4 py-3 text-right">{m.stockAfter}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {m.note}
                      {m.orderCode && <> · <Link to={`/admin/don-hang/${m.orderCode}`} className="font-semibold text-brand-700 hover:underline">{m.orderCode}</Link></>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.userName ?? (m.orderCode ? 'Hệ thống' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{data.total} dòng · trang {data.page}/{data.totalPages}</span>
            <div className="flex gap-2">
              <button className="btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</button>
              <button className="btn-outline px-3 py-1.5" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Sau →</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ======================= Trang Kho hàng =======================

export function AdminInventory() {
  const { data, loading, error, reload } = useAsync(listProducts, [])
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'lich-su' ? 'history' : 'stock'
  const productId = params.get('sp') ? Number(params.get('sp')) : undefined

  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState message={error ?? ''} onRetry={reload} />

  const units = data.reduce((s, p) => s + p.stock, 0)
  const value = data.reduce((s, p) => s + p.stock * p.price, 0)
  const summary = [
    { label: 'Mã hàng đang bán', value: data.length },
    { label: 'Tổng số lượng tồn', value: units.toLocaleString('vi-VN') },
    { label: 'Giá trị tồn kho (giá bán)', value: formatVND(value) },
    { label: 'Sắp hết / hết hàng', value: `${data.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length} / ${data.filter((p) => p.stock === 0).length}` },
  ]

  const go = (t: 'stock' | 'history', sp?: number) => setParams(t === 'history' ? { tab: 'lich-su', ...(sp ? { sp: String(sp) } : {}) } : {})

  return (
    <>
      <AdminPageTitle title="Quản lý kho hàng" subtitle="Tồn kho tự trừ khi khách đặt hàng, tự hoàn khi đơn bị hủy. Nhập / xuất / kiểm kê đều được ghi lịch sử." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="card p-4"><p className="text-sm text-slate-500">{s.label}</p><p className="mt-1 text-xl font-bold">{s.value}</p></div>
        ))}
      </div>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([['stock', 'Tồn kho'], ['history', 'Lịch sử nhập / xuất']] as const).map(([k, l]) => (
          <button key={k} onClick={() => go(k)} className={classNames('-mb-px border-b-2 px-4 py-2 text-sm font-semibold', tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{l}</button>
        ))}
      </div>
      {tab === 'stock' ? (
        <StockTab products={data} reload={reload} onHistory={(p) => go('history', p.id)} />
      ) : (
        <HistoryTab products={data} productId={productId} setProductId={(id) => go('history', id)} />
      )}
    </>
  )
}

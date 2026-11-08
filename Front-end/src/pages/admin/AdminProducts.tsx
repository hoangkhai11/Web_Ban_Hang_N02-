import { Copy, Loader2, Pencil, Plus, Search, Star, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/common/Misc'
import { EmptyState, ErrorState, Spinner } from '../../components/common/States'
import { ProductImage } from '../../components/product/ProductCard'
import { AdminPageTitle } from '../../components/layout/AdminLayout'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { ATTRIBUTE_LABELS, CATEGORY_FILTERS } from '../../lib/filters'
import { formatVND } from '../../lib/format'
import { createProduct, deleteProduct, listCategories, listProducts, updateProduct, uploadProductImage, type ProductInput } from '../../services/adminService'
import type { AttributeKey, Category, Product } from '../../types'

interface FormState {
  code: string
  name: string
  categoryId: string
  brand: string
  price: string
  stock: string
  warrantyMonths: string
  images: string[]
  highlights: string
  description: string
  specs: string
  attributes: Partial<Record<AttributeKey, string>>
  compatibilityNote: string
}

const empty: FormState = { code: '', name: '', categoryId: '', brand: '', price: '', stock: '0', warrantyMonths: '12', images: [], highlights: '', description: '', specs: '', attributes: {}, compatibilityNote: '' }

const toForm = (p: Product): FormState => ({
  code: p.code,
  name: p.name,
  categoryId: String(p.categoryId),
  brand: p.brand,
  price: String(p.price),
  stock: String(p.stock),
  warrantyMonths: String(p.warrantyMonths),
  images: [...p.images],
  highlights: p.highlights.join('\n'),
  description: p.description,
  specs: Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join('\n'),
  attributes: { ...p.attributes },
  compatibilityNote: p.compatibilityNote ?? '',
})

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_MB = 5

/** Chọn ảnh sản phẩm: tải từ thiết bị hoặc dán link; ảnh đầu tiên là ảnh đại diện. */
export function ImagePicker({ images, onChange, uploading, setUploading }: { images: string[]; onChange: Dispatch<SetStateAction<string[]>>; uploading: boolean; setUploading: (on: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // cho phép chọn lại đúng file vừa chọn
    if (files.some((file) => !IMAGE_TYPES.includes(file.type))) return setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP')
    if (files.some((file) => file.size > MAX_IMAGE_MB * 1024 * 1024)) return setError(`Mỗi ảnh tối đa ${MAX_IMAGE_MB} MB`)
    setError('')
    setUploading(true)
    try {
      for (const file of files) {
        const { url } = await uploadProductImage(file)
        onChange((cur) => [...cur, url])
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const addLink = () => {
    const url = link.trim()
    if (!/^https?:\/\//i.test(url)) return setError('Link ảnh phải bắt đầu bằng http:// hoặc https://')
    setError('')
    onChange((cur) => [...cur, url])
    setLink('')
  }

  return (
    <div>
      <span className="label">Ảnh sản phẩm (ảnh đầu tiên là ảnh đại diện)</span>
      {error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={src + i} className="group relative">
            <ProductImage src={src} alt={`Ảnh ${i + 1}`} className={`size-24 rounded-lg border-2 object-cover ${i === 0 ? 'border-brand-600' : 'border-slate-200'}`} />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 rounded bg-brand-700 px-1.5 text-[10px] font-semibold text-white">Đại diện</span>
            ) : (
              <button type="button" className="absolute bottom-1 left-1 rounded bg-white/90 p-1 text-slate-600 shadow hover:text-brand-700" aria-label={`Đặt ảnh ${i + 1} làm đại diện`} title="Đặt làm ảnh đại diện" onClick={() => onChange((cur) => [src, ...cur.filter((_, k) => k !== i)])}>
                <Star className="size-3.5" />
              </button>
            )}
            <button type="button" className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-red-600 shadow" aria-label={`Xóa ảnh ${i + 1}`} title="Xóa ảnh" onClick={() => onChange((cur) => cur.filter((_, k) => k !== i))}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <button type="button" className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:border-brand-600 hover:text-brand-700 disabled:opacity-60" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
        </button>
      </div>
      <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden aria-label="Chọn ảnh từ thiết bị" onChange={upload} />
      <p className="mt-1.5 text-xs text-slate-500">JPG, PNG hoặc WebP, tối đa {MAX_IMAGE_MB} MB mỗi ảnh. Có thể chọn nhiều ảnh cùng lúc.</p>
      <div className="mt-2 flex gap-2">
        <input className="input py-1.5" placeholder="Hoặc dán link ảnh (https://...)" aria-label="Link ảnh" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
        <button type="button" className="btn-outline py-1.5" disabled={!link.trim()} onClick={addLink}>Thêm</button>
      </div>
    </div>
  )
}

function ProductForm({ initial, categories, isEdit, onSubmit, onCancel }: { initial: FormState; categories: Category[]; isEdit: boolean; onSubmit: (input: ProductInput) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState<FormState>(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const leafs = categories.filter((c) => c.parentId !== null)
  const cat = categories.find((c) => String(c.id) === f.categoryId)
  const attrKeys: AttributeKey[] = cat ? CATEGORY_FILTERS[cat.slug] ?? [] : []

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const price = Number(f.price)
    const stock = Number(f.stock)
    if (!f.code.trim() || !f.name.trim() || !f.categoryId || !f.brand.trim()) return setError('Vui lòng nhập đủ mã, tên, danh mục và thương hiệu')
    if (!(price > 0)) return setError('Giá bán phải lớn hơn 0')
    if (!Number.isInteger(stock) || stock < 0) return setError('Tồn kho phải là số nguyên >= 0')
    const specs: Record<string, string> = {}
    for (const l of lines(f.specs)) {
      const i = l.indexOf(':')
      if (i > 0) specs[l.slice(0, i).trim()] = l.slice(i + 1).trim()
    }
    // Chỉ giữ thuộc tính phù hợp với danh mục đã chọn
    const attributes = Object.fromEntries(attrKeys.filter((k) => f.attributes[k]?.trim()).map((k) => [k, f.attributes[k]!.trim()]))
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        code: f.code,
        name: f.name.trim(),
        categoryId: Number(f.categoryId),
        brand: f.brand.trim(),
        price,
        stock,
        warrantyMonths: Number(f.warrantyMonths) || 0,
        images: f.images,
        highlights: lines(f.highlights),
        description: f.description.trim(),
        specs,
        attributes,
        compatibilityNote: f.compatibilityNote.trim() || undefined,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div><label className="label">Mã sản phẩm *</label><input className="input" value={f.code} onChange={set('code')} placeholder="VD: LT-NB14-02" /></div>
      <div><label className="label">Thương hiệu *</label><input className="input" value={f.brand} onChange={set('brand')} /></div>
      <div className="sm:col-span-2"><label className="label">Tên sản phẩm *</label><input className="input" value={f.name} onChange={set('name')} /></div>
      <div>
        <label className="label">Danh mục *</label>
        <select className="input" value={f.categoryId} onChange={set('categoryId')}>
          <option value="">-- Chọn danh mục --</option>
          {categories.filter((c) => c.parentId === null).map((root) => (
            <optgroup key={root.id} label={root.name}>
              {leafs.filter((c) => c.parentId === root.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Giá (đ) *</label><input className="input" type="number" min={0} value={f.price} onChange={set('price')} /></div>
        <div><label className="label">{isEdit ? 'Tồn kho' : 'Tồn kho *'}</label><input className="input" type="number" min={0} value={f.stock} onChange={set('stock')} disabled={isEdit} title={isEdit ? 'Sửa tồn kho tại trang Kho hàng' : undefined} /></div>
        <div><label className="label">BH (tháng)</label><input className="input" type="number" min={0} value={f.warrantyMonths} onChange={set('warrantyMonths')} /></div>
      </div>
      {isEdit && <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Tồn kho không sửa ở đây (tránh ghi đè số lượng khi đang có đơn hàng). Nhập / xuất / kiểm kê tại trang <Link to="/admin/ton-kho" className="text-brand-700 hover:underline">Kho hàng</Link>.</p>}
      {attrKeys.length > 0 && (
        <div className="rounded-lg bg-surface p-3 sm:col-span-2">
          <p className="mb-2 text-xs font-semibold text-slate-600">Thuộc tính lọc (chuẩn hóa — VD: "16 GB", "Intel Core i5", "Full HD")</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {attrKeys.map((k) => (
              <div key={k}>
                <label className="text-xs text-slate-600">{ATTRIBUTE_LABELS[k]}</label>
                <input className="input py-1.5" value={f.attributes[k] ?? ''} onChange={(e) => setF({ ...f, attributes: { ...f.attributes, [k]: e.target.value } })} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div><label className="label">Thông số nổi bật (mỗi dòng 1 ý)</label><textarea className="input" rows={4} value={f.highlights} onChange={set('highlights')} /></div>
      <div><label className="label">Bảng thông số (Tên: Giá trị)</label><textarea className="input" rows={4} value={f.specs} onChange={set('specs')} placeholder={'CPU: Intel Core i5\nRAM: 16 GB'} /></div>
      <div className="sm:col-span-2">
        <ImagePicker images={f.images} onChange={(update) => setF((cur) => ({ ...cur, images: typeof update === 'function' ? update(cur.images) : update }))} uploading={uploading} setUploading={setUploading} />
      </div>
      <div className="sm:col-span-2"><label className="label">Mô tả</label><textarea className="input" rows={3} value={f.description} onChange={set('description')} /></div>
      <div className="sm:col-span-2"><label className="label">Lưu ý tương thích (linh kiện)</label><input className="input" value={f.compatibilityNote} onChange={set('compatibilityNote')} /></div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-outline" onClick={onCancel}>Hủy</button>
        <button className="btn-primary" disabled={saving || uploading}>{saving && <Loader2 className="size-4 animate-spin" />} Lưu sản phẩm</button>
      </div>
    </form>
  )
}

export default function AdminProducts() {
  const toast = useToast()
  const products = useAsync(listProducts, [])
  const categories = useAsync(listCategories, [])
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('')
  // new: thêm mới · edit: sửa · copy: thêm mới từ sản phẩm có sẵn (nhân bản)
  const [editing, setEditing] = useState<{ mode: 'new' | 'edit' | 'copy'; product?: Product } | null>(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (products.data ?? []).filter((p) => (!term || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)) && (!catFilter || String(p.categoryId) === catFilter))
  }, [products.data, q, catFilter])

  if (products.loading || categories.loading) return <Spinner />
  if (products.error) return <ErrorState message={products.error} onRetry={products.reload} />

  const catName = (id: number) => categories.data?.find((c) => c.id === id)?.name ?? '—'

  const remove = async (p: Product) => {
    if (!confirm(`Xóa sản phẩm "${p.name}"?\nSản phẩm sẽ bị ẩn khỏi cửa hàng; lịch sử đơn hàng vẫn được giữ.`)) return
    try {
      await deleteProduct(p.id)
      toast.success('Đã xóa sản phẩm')
      products.reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <AdminPageTitle title="Quản lý sản phẩm" subtitle={`${products.data?.length ?? 0} sản phẩm đang kinh doanh`} action={<button className="btn-primary" onClick={() => setEditing({ mode: 'new' })}><Plus className="size-4" /> Thêm sản phẩm</button>} />
      <div className="card mb-4 flex flex-wrap gap-3 p-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-3 left-3 size-4 text-slate-400" />
          <input className="input pl-9" placeholder="Tìm theo tên hoặc mã sản phẩm" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.data?.filter((c) => c.parentId !== null).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Không có sản phẩm" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface text-left text-xs text-slate-500 uppercase">
              <tr><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">Danh mục</th><th className="px-4 py-3 text-right">Giá</th><th className="px-4 py-3 text-right">Tồn kho</th><th className="px-4 py-3 text-right">Đã bán</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProductImage src={p.images[0]} alt="" className="size-10 rounded object-cover" />
                      <div className="min-w-0">
                        <Link to={`/san-pham/${p.slug}`} target="_blank" className="line-clamp-1 font-medium hover:text-brand-700">{p.name}</Link>
                        <p className="text-xs text-slate-500">{p.code} · {p.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{catName(p.categoryId)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatVND(p.price)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-600' : ''}`}>{p.stock}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.soldCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost p-2" onClick={() => setEditing({ mode: 'edit', product: p })} aria-label="Sửa" title="Sửa"><Pencil className="size-4" /></button>
                      <button className="btn-ghost p-2" onClick={() => setEditing({ mode: 'copy', product: p })} aria-label="Nhân bản" title="Nhân bản thành sản phẩm mới"><Copy className="size-4" /></button>
                      <button className="btn-ghost p-2 text-red-600" onClick={() => remove(p)} aria-label="Xóa"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} wide title={editing?.mode === 'edit' ? 'Sửa sản phẩm' : editing?.mode === 'copy' ? `Nhân bản từ ${editing.product?.code}` : 'Thêm sản phẩm'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <ProductForm
            key={`${editing.mode}-${editing.product?.id ?? 'new'}`}
            initial={
              !editing.product ? empty
              : editing.mode === 'copy' ? { ...toForm(editing.product), code: '', name: `${editing.product.name} (bản sao)`, stock: '0' }
              : toForm(editing.product)
            }
            categories={categories.data ?? []}
            isEdit={editing.mode === 'edit'}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              if (editing.mode === 'edit' && editing.product) await updateProduct(editing.product.id, input)
              else await createProduct(input)
              toast.success(editing.mode === 'edit' ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
              setEditing(null)
              products.reload()
            }}
          />
        )}
      </Modal>
    </>
  )
}

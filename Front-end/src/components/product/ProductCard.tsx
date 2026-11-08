import { Check, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { usePricing } from '../../context/PricingContext'
import { useToast } from '../../context/ToastContext'
import { classNames, formatVND } from '../../lib/format'
import { assetUrl } from '../../services/api'
import type { Product } from '../../types'

export function ProductImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  return (
    <img
      src={assetUrl(src) || '/placeholder.svg'}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => {
        const img = e.currentTarget
        if (!img.src.endsWith('/placeholder.svg')) img.src = '/placeholder.svg'
      }}
    />
  )
}

export function PriceTag({ product, size = 'md' }: { product: Product; size?: 'md' | 'lg' }) {
  const { priceOf, discountOf } = usePricing()
  const discount = discountOf(product)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={classNames('font-bold text-red-600', size === 'lg' ? 'text-3xl' : 'text-lg')}>{formatVND(priceOf(product))}</span>
      {discount > 0 && <span className={classNames('text-slate-400 line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{formatVND(product.price)}</span>}
    </div>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const { discountOf } = usePricing()
  const cart = useCart()
  const toast = useToast()
  const discount = discountOf(product)
  const out = product.stock <= 0
  const to = `/san-pham/${product.slug}`

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={to} className="relative block bg-white p-3">
        {discount > 0 && <span className="absolute top-3 left-3 z-10 rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">-{discount}%</span>}
        {out && <span className="absolute top-3 right-3 z-10 rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white">Hết hàng</span>}
        <ProductImage src={product.images[0]} alt={product.name} className={classNames('aspect-[4/3] w-full rounded-lg object-cover transition group-hover:scale-[1.03]', out && 'opacity-60')} />
      </Link>
      <div className="flex flex-1 flex-col px-3 pb-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold tracking-wide uppercase">{product.brand}</span>
          <span>{product.code}</span>
        </div>
        <Link to={to} className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold hover:text-brand-700">
          {product.name}
        </Link>
        <ul className="mt-2 grid grid-cols-1 gap-0.5 text-xs text-slate-500 sm:grid-cols-2">
          {product.highlights.slice(0, 4).map((h) => (
            <li key={h} className="flex items-center gap-1 truncate">
              <Check className="size-3 shrink-0 text-brand-600" />
              <span className="truncate">{h}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-3">
          <PriceTag product={product} />
          <button
            className="btn-primary mt-2 w-full py-2"
            disabled={out}
            onClick={() => {
              cart.add(product.id)
              toast.success('Đã thêm vào giỏ hàng')
            }}
          >
            <ShoppingCart className="size-4" />
            {out ? 'Tạm hết hàng' : 'Thêm vào giỏ'}
          </button>
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

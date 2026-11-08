import { Boxes, ClipboardList, FolderTree, LayoutDashboard, LogOut, Menu, Package, Store, TicketPercent, Users, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { classNames } from '../../lib/format'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/san-pham', label: 'Sản phẩm', icon: Package },
  { to: '/admin/danh-muc', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/ton-kho', label: 'Kho hàng', icon: Boxes },
  { to: '/admin/don-hang', label: 'Đơn hàng & hóa đơn', icon: ClipboardList },
  { to: '/admin/khach-hang', label: 'Khách hàng', icon: Users, advanced: true },
  { to: '/admin/khuyen-mai', label: 'Khuyến mãi', icon: TicketPercent, advanced: true },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const sidebar = (
    <aside className="flex h-full w-60 flex-col bg-ink text-slate-300">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 font-extrabold text-white">G</span>
        <span className="font-extrabold text-white">GICUNGCO</span>
        <span className="rounded bg-white/10 px-1.5 text-[10px] font-semibold">ADMIN</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ to, label, icon: Icon, end, advanced }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => classNames('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-700 text-white' : 'hover:bg-white/5 hover:text-white')}>
            <Icon className="size-4" /> {label}
            {advanced && <span className="ml-auto text-[10px] text-slate-500">nâng cao</span>}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3 text-sm">
        <NavLink to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white"><Store className="size-4" /> Xem cửa hàng</NavLink>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-fit" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu">{open ? <X /> : <Menu />}</button>
          <span className="text-sm text-slate-500">Hệ thống quản trị cửa hàng</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-semibold">{user?.fullName}</span>
              <span className="block text-xs text-slate-500">{user?.email}</span>
            </span>
            <button
              className="btn-ghost px-2"
              onClick={async () => {
                await logout()
                navigate('/admin/dang-nhap')
              }}
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function AdminPageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.svg'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const navItems = [
  { to: '/', label: 'Início', end: true },
  { to: '/minha-pro-delphus', label: 'Minha Pro Delphus' },
  { to: '/precos', label: 'Tabela de Preços' },
  { to: '/produtos', label: 'Produtos' },
  { to: '/orcamentos', label: 'Orçamentos' },
  { to: '/pedidos', label: 'Pedidos' },
]

const adminNavItems = [
  { to: '/admin/contas', label: 'Contas' },
  { to: '/admin/setores', label: 'Setores' },
  { to: '/admin/metricas', label: 'Métricas' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // storage indisponível — a preferência só vale para esta sessão
      }
      return next
    })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'border-brand-500 bg-brand-50 text-brand-700 translate-x-0.5'
        : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-ink-900 hover:translate-x-0.5'
    }`

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <aside
        className={`flex shrink-0 flex-col bg-white transition-all duration-200 ${
          collapsed
            ? 'w-0 overflow-hidden border-r-0 px-0 py-6'
            : 'w-64 overflow-y-auto border-r border-neutral-200 px-4 py-6'
        }`}
      >
        <div className="mb-8 px-2">
          <img src={logo} alt="Pro Delphus" className="h-20 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <>
              <div className="mt-6 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Administração
              </div>
              {adminNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
          <Link
            to="/minha-conta"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-neutral-100"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white transition-transform hover:scale-105">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
              <p className="truncate text-xs text-neutral-500">{user?.email}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="Sair"
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-brand-600"
          >
            Sair
          </button>
        </div>
      </aside>
      <div className="relative flex-1 overflow-y-auto">
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
          className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-all hover:bg-neutral-100 hover:text-ink-900 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <main className="p-8 pt-16">
          <div key={location.pathname} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

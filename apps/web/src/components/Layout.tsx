import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.svg'

const navItems = [
  { to: '/', label: 'Início', end: true },
  { to: '/precos', label: 'Tabela de Preços' },
  { to: '/produtos', label: 'Produtos' },
  { to: '/orcamentos', label: 'Orçamentos' },
  { to: '/minha-conta', label: 'Minha Conta' },
]

const adminNavItems = [{ to: '/admin/contas', label: 'Contas' }]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg border-l-[3px] px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'border-brand-500 bg-brand-50 text-brand-700'
        : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-ink-900'
    }`

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white px-4 py-6">
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
          <Link to="/minha-conta" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 -m-1 hover:bg-neutral-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
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
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-brand-600"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}

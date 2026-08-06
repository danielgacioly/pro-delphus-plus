import { useState, type ComponentType, type SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import logo from '../assets/logo.svg'
import {
  IconBoard,
  IconBox,
  IconChart,
  IconContacts,
  IconHome,
  IconLayers,
  IconLogout,
  IconQuote,
  IconSidebar,
  IconTag,
  IconTruck,
  IconUsers,
} from './icons'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Início', icon: IconHome, end: true },
  { to: '/minha-pro-delphus', label: 'Minha Pro Delphus', icon: IconBoard },
  { to: '/precos', label: 'Tabela de Preços', icon: IconTag },
  { to: '/produtos', label: 'Produtos', icon: IconBox },
  { to: '/clientes', label: 'Clientes', icon: IconContacts },
  { to: '/orcamentos', label: 'Orçamentos', icon: IconQuote },
  { to: '/pedidos', label: 'Pedidos', icon: IconTruck },
]

const adminNavItems: NavItem[] = [
  { to: '/admin/contas', label: 'Contas', icon: IconUsers },
  { to: '/admin/setores', label: 'Setores', icon: IconLayers },
  { to: '/admin/metricas', label: 'Métricas', icon: IconChart },
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

  /* Abaixo de `lg` a barra sempre vira trilho de ícones; acima, respeita a
     preferência salva. Assim não existe estado "escondido" que deixe o app
     sem navegação em telas pequenas. */
  const labelClass = collapsed ? 'hidden' : 'hidden lg:inline'

  function renderItem({ to, label, icon: Icon, end }: NavItem) {
    return (
      <NavLink
        key={to}
        to={to}
        end={end}
        title={label}
        className={({ isActive }) =>
          cn(
            'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px]',
            'transition-[background-color,color] duration-150 ease-out',
            collapsed ? 'justify-center' : 'justify-center lg:justify-start',
            isActive
              ? 'bg-ink-900/[0.06] font-semibold text-ink-900'
              : 'font-medium text-neutral-600 hover:bg-ink-900/[0.035] hover:text-ink-900',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn(
                'h-[18px] w-[18px] shrink-0 transition-colors duration-150',
                isActive ? 'text-brand-600' : 'text-neutral-400 group-hover:text-neutral-600',
              )}
            />
            <span className={cn('truncate', labelClass)}>{label}</span>
          </>
        )}
      </NavLink>
    )
  }

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside
        className={cn(
          'material z-40 flex shrink-0 flex-col border-r border-neutral-200/70',
          'transition-[width] duration-300 ease-out-expo',
          collapsed ? 'w-[68px]' : 'w-[68px] lg:w-[248px]',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center px-3',
            collapsed ? 'justify-center' : 'justify-center lg:justify-between',
          )}
        >
          <Link to="/" className={cn('shrink-0 rounded-md px-1', collapsed ? 'hidden' : 'hidden lg:block')}>
            <img src={logo} alt="Pro Delphus" className="h-11 w-auto" />
          </Link>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-ink-900/5 hover:text-ink-900 active:scale-90 lg:flex"
          >
            <IconSidebar className="h-[18px] w-[18px]" />
          </button>
          <Link to="/" className={cn('lg:hidden', collapsed && 'lg:block')} aria-label="Início">
            <img src={logo} alt="" className="h-8 w-auto" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2">
          {navItems.map(renderItem)}

          {user?.role === 'ADMIN' && (
            <>
              <div className={cn('mt-6 mb-1.5 px-2.5', collapsed ? 'hidden' : 'hidden lg:block')}>
                <span className="text-eyebrow text-neutral-400">Administração</span>
              </div>
              <div className={cn('my-3 h-px bg-neutral-200/80', collapsed ? 'block' : 'block lg:hidden')} />
              {adminNavItems.map(renderItem)}
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-neutral-200/70 p-2.5">
          <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'flex-col lg:flex-row')}>
            <Link
              to="/minha-conta"
              title={user?.name}
              className={cn(
                'flex min-w-0 items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-ink-900/[0.04]',
                collapsed ? '' : 'lg:flex-1',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[13px] font-semibold text-white shadow-sm">
                {initial}
              </span>
              <span className={cn('min-w-0 flex-1', labelClass)}>
                <span className="block truncate text-[13px] font-medium text-ink-900">{user?.name}</span>
                <span className="block truncate text-[11.5px] text-neutral-500">{user?.email}</span>
              </span>
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Sair"
              title="Sair"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-[background-color,color,transform] duration-150 hover:bg-brand-50 hover:text-brand-600 active:scale-90"
            >
              <IconLogout className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        {/* Só opacidade: um `transform` aqui viraria bloco de contenção e
            quebraria qualquer filho `position: fixed`. */}
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

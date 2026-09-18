import { useState, type ComponentType, type SVGProps } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import logo from '../assets/logo.svg'
import {
  IconBoard,
  IconBot,
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

// Sem preferência salva ainda (primeira visita), o padrão é minimizada.
function loadCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return stored === null ? true : stored === '1'
  } catch {
    return true
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
  { to: '/neo', label: 'NEO', icon: IconBot },
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
            // Lista de origem do macOS: linha baixa, texto regular, seleção
            // em cinza — a cor de marca aparece só no ícone do item ativo.
            'group relative flex h-[30px] items-center gap-2 rounded-md px-2 text-[13.5px] text-ink-900',
            'transition-colors duration-100 ease-out',
            collapsed ? 'justify-center' : 'justify-center lg:justify-start',
            isActive ? 'bg-black/[0.07] font-medium' : 'hover:bg-black/[0.035]',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn(
                'h-[17px] w-[17px] shrink-0 transition-colors duration-100',
                isActive ? 'text-brand-600' : 'text-neutral-600',
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
          'z-40 flex shrink-0 flex-col border-r border-black/[0.08] bg-neutral-50',
          'transition-[width] duration-300 ease-out-expo',
          collapsed ? 'w-[60px]' : 'w-[60px] lg:w-[228px]',
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center px-3',
            collapsed ? 'justify-center' : 'justify-center lg:justify-between lg:pl-4',
          )}
        >
          <Link to="/" className={cn('shrink-0', collapsed ? 'hidden' : 'hidden lg:block')}>
            <img src={logo} alt="Pro Delphus" className="h-7 w-auto" />
          </Link>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors duration-100 hover:bg-black/[0.05] hover:text-ink-900 lg:flex"
          >
            <IconSidebar className="h-[17px] w-[17px]" />
          </button>
          <Link to="/" className="lg:hidden" aria-label="Início">
            <img src={logo} alt="" className="h-6 w-auto" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2.5 pt-1 pb-2">
          {navItems.map(renderItem)}

          {user?.role === 'ADMIN' && (
            <>
              <div className={cn('mt-5 mb-1 px-2', collapsed ? 'hidden' : 'hidden lg:block')}>
                <span className="text-[11.5px] font-semibold text-neutral-600">Administração</span>
              </div>
              <div className={cn('mx-2 my-2.5 h-px bg-black/[0.08]', collapsed ? 'block' : 'block lg:hidden')} />
              {adminNavItems.map(renderItem)}
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-black/[0.06] px-2.5 py-2">
          <div className={cn('flex items-center gap-1', collapsed ? 'flex-col' : 'flex-col lg:flex-row')}>
            <Link
              to="/minha-conta"
              title={user?.name}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-md p-1.5 transition-colors duration-100 hover:bg-black/[0.04]',
                collapsed ? '' : 'lg:flex-1',
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-400 text-[11px] font-semibold text-white">
                {initial}
              </span>
              <span className={cn('min-w-0 flex-1', labelClass)}>
                <span className="block truncate text-[13px] leading-tight font-medium text-ink-900">{user?.name}</span>
                <span className="block truncate text-[11.5px] leading-tight text-neutral-600">{user?.email}</span>
              </span>
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Sair"
              title="Sair"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors duration-100 hover:bg-black/[0.05] hover:text-ink-900"
            >
              <IconLogout className="h-4 w-4" />
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

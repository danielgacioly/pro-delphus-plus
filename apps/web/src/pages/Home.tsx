import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const shortcuts = [
  { to: '/orcamentos', title: 'Novo orçamento', description: 'Gere um orçamento em PDF a partir do SKU do produto.' },
  { to: '/precos', title: 'Tabela de preços', description: 'Consulte preços em reais e em dólar por setor.' },
  { to: '/produtos', title: 'Produtos', description: 'Veja o catálogo, mídia e customizações disponíveis.' },
]

const adminShortcuts = [
  { to: '/admin/contas', title: 'Contas', description: 'Aprove cadastros e gerencie o acesso dos usuários.' },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function Home() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink-900">
        {greeting()}, {user?.name?.split(' ')[0]}
      </h1>
      <p className="mt-1 text-neutral-500">Bem-vindo ao Pro Delphus+.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-300 hover:shadow-sm"
          >
            <div className="mb-2 h-1.5 w-8 rounded-full bg-brand-500 transition-all group-hover:w-12" />
            <h2 className="font-semibold text-ink-900">{s.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
          </Link>
        ))}
      </div>

      {user?.role === 'ADMIN' && (
        <>
          <h2 className="mt-10 mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Administração
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminShortcuts.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-brand-300 hover:shadow-sm"
              >
                <div className="mb-2 h-1.5 w-8 rounded-full bg-ink-900 transition-all group-hover:w-12" />
                <h2 className="font-semibold text-ink-900">{s.title}</h2>
                <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { IconBoard, IconBox, IconChart, IconLayers, IconQuote, IconTag, IconTruck, IconUsers } from '../components/icons'

const shortcuts = [
  {
    to: '/minha-pro-delphus',
    title: 'Minha Pro Delphus',
    description: 'Seu mural pessoal de tarefas, lembretes e acesso rápido.',
    icon: IconBoard,
  },
  {
    to: '/orcamentos/novo',
    title: 'Novo orçamento',
    description: 'Gere um orçamento em PDF a partir do SKU do produto.',
    icon: IconQuote,
  },
  {
    to: '/precos',
    title: 'Tabela de preços',
    description: 'Consulte preços em reais e em dólar por setor.',
    icon: IconTag,
  },
  {
    to: '/produtos',
    title: 'Produtos',
    description: 'Veja o catálogo, mídia e customizações disponíveis.',
    icon: IconBox,
  },
  {
    to: '/pedidos',
    title: 'Pedidos',
    description: 'Invoice, Packing List e documentos de exportação.',
    icon: IconTruck,
  },
]

const adminShortcuts = [
  { to: '/admin/contas', title: 'Contas', description: 'Aprove cadastros e gerencie o acesso dos usuários.', icon: IconUsers },
  { to: '/admin/setores', title: 'Setores', description: 'Crie, renomeie e exclua os setores do catálogo.', icon: IconLayers },
  {
    to: '/admin/metricas',
    title: 'Métricas',
    description: 'Vendas por período, status dos pedidos e produtos mais vendidos.',
    icon: IconChart,
  },
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
      <h1 className="mt-1 text-2xl font-bold uppercase tracking-wider text-brand-600">{greeting()}, {user?.name?.split(' ')[0]}.</h1>
      <p className="mt-2 text-neutral-500">O que você deseja fazer hoje?</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-brand-900/5"
          >
            <s.icon className="h-6 w-6 text-brand-600" />
            <h2 className="mt-3 font-semibold text-ink-900">{s.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
            <span className="absolute right-4 top-5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500">
              →
            </span>
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
                className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md hover:shadow-ink-900/5"
              >
                <s.icon className="h-6 w-6 text-ink-900" />
                <h2 className="mt-3 font-semibold text-ink-900">{s.title}</h2>
                <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
                <span className="absolute right-4 top-5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-700">
                  →
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

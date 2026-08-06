import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import { Page, Section } from '../components/ui'
import {
  IconBoard,
  IconBox,
  IconChart,
  IconChevronRight,
  IconLayers,
  IconQuote,
  IconTag,
  IconTruck,
  IconUsers,
} from '../components/icons'

interface Shortcut {
  to: string
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const shortcuts: Shortcut[] = [
  {
    to: '/minha-pro-delphus',
    title: 'Minha Pro Delphus',
    description: 'Seu mural pessoal de tarefas, lembretes e acesso rápido.',
    icon: IconBoard,
  },
  {
    to: '/orcamentos',
    title: 'Orçamentos',
    description: 'Gere orçamentos em PDF ou Excel a partir do catálogo.',
    icon: IconQuote,
  },
  {
    to: '/precos',
    title: 'Tabela de preços',
    description: 'Consulte preços em real, dólar e euro por setor.',
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

const adminShortcuts: Shortcut[] = [
  { to: '/admin/contas', title: 'Contas', description: 'Aprove cadastros e gerencie o acesso.', icon: IconUsers },
  { to: '/admin/setores', title: 'Setores', description: 'Crie, renomeie e exclua setores do catálogo.', icon: IconLayers },
  { to: '/admin/metricas', title: 'Métricas', description: 'Vendas, status dos pedidos e mais vendidos.', icon: IconChart },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function ShortcutCard({ shortcut, tone, index }: { shortcut: Shortcut; tone: 'brand' | 'neutral'; index: number }) {
  const { to, title, description, icon: Icon } = shortcut
  return (
    <Link
      to={to}
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        'group animate-fade-in-up relative flex flex-col rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm',
        'transition-[transform,box-shadow,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-lg',
        tone === 'brand' ? 'hover:border-brand-200' : 'hover:border-neutral-300',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200',
          tone === 'brand'
            ? 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
            : 'bg-neutral-500/8 text-ink-800 group-hover:bg-neutral-500/14',
        )}
      >
        <Icon className="h-4.75 w-4.75" />
      </div>

      <h3 className="text-heading mt-3.5 text-ink-900">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>

      <IconChevronRight className="absolute right-4 top-5 h-4 w-4 text-neutral-300 transition-[transform,color] duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-neutral-500" />
    </Link>
  )
}

export function Home() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] ?? ''

  return (
    <Page title={`${greeting()}, ${firstName}.`} description="O que você deseja fazer hoje?">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((shortcut, i) => (
          <ShortcutCard key={shortcut.to} shortcut={shortcut} tone="brand" index={i} />
        ))}
      </div>

      {user?.role === 'ADMIN' && (
        <Section title="Administração">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {adminShortcuts.map((shortcut, i) => (
              <ShortcutCard key={shortcut.to} shortcut={shortcut} tone="neutral" index={i} />
            ))}
          </div>
        </Section>
      )}
    </Page>
  )
}

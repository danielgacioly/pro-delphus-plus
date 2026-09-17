import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/cn'
import { Page, Section, ButtonLink } from '../components/ui'
import { NeoAvatar } from '../components/NeoMascot'
import {
  IconBoard,
  IconBox,
  IconChevronRight,
  IconContacts,
  IconPlus,
  IconQuote,
  IconTag,
  IconTruck,
} from '../components/icons'

interface Shortcut {
  to: string
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Orçamentos, Pedidos e Clientes são o fluxo do dia a dia — cards maiores, tom
// de marca. O resto é ferramenta de apoio, usada com menos frequência.
const primaryShortcuts: Shortcut[] = [
  {
    to: '/orcamentos',
    title: 'Orçamentos',
    description: 'Gere orçamentos em PDF ou Excel a partir do catálogo.',
    icon: IconQuote,
  },
  {
    to: '/pedidos',
    title: 'Pedidos',
    description: 'Invoice, Packing List e documentos de exportação.',
    icon: IconTruck,
  },
  {
    to: '/clientes',
    title: 'Clientes',
    description: 'Contatos, endereços e o histórico de cada cliente.',
    icon: IconContacts,
  },
]

const secondaryShortcuts: Shortcut[] = [
  {
    to: '/minha-pro-delphus',
    title: 'Minha Pro Delphus',
    description: 'Seu mural pessoal de tarefas e lembretes.',
    icon: IconBoard,
  },
  {
    to: '/precos',
    title: 'Tabela de preços',
    description: 'Preços em real, dólar e euro por setor.',
    icon: IconTag,
  },
  {
    to: '/produtos',
    title: 'Produtos',
    description: 'Catálogo, mídia e customizações disponíveis.',
    icon: IconBox,
  },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function ShortcutCard({
  shortcut,
  tone,
  size,
  index,
}: {
  shortcut: Shortcut
  tone: 'brand' | 'neutral'
  size: 'lg' | 'sm'
  index: number
}) {
  const { to, title, description, icon: Icon } = shortcut
  return (
    <Link
      to={to}
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        'group animate-fade-in-up relative flex flex-col rounded-2xl border border-neutral-200/70 bg-white shadow-sm',
        'transition-[transform,box-shadow,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-lg',
        tone === 'brand' ? 'hover:border-brand-200' : 'hover:border-neutral-300',
        size === 'lg' ? 'p-5' : 'p-4',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-xl transition-colors duration-200',
          size === 'lg' ? 'h-10 w-10' : 'h-8 w-8',
          tone === 'brand'
            ? 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
            : 'bg-neutral-500/8 text-ink-800 group-hover:bg-neutral-500/14',
        )}
      >
        <Icon className={size === 'lg' ? 'h-4.75 w-4.75' : 'h-4 w-4'} />
      </div>

      <h3 className={cn('mt-3.5 text-ink-900', size === 'lg' ? 'text-heading' : 'text-[13.5px] font-semibold')}>
        {title}
      </h3>
      <p className={cn('mt-1 leading-relaxed text-neutral-500', size === 'lg' ? 'text-[13px]' : 'text-[12.5px]')}>
        {description}
      </p>

      <IconChevronRight
        className={cn(
          'absolute right-4 h-4 w-4 text-neutral-300 transition-[transform,color] duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-neutral-500',
          size === 'lg' ? 'top-5' : 'top-4',
        )}
      />
    </Link>
  )
}

export function Home() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] ?? ''
  const isAdmin = user?.role === 'ADMIN'

  return (
    <Page title={`${greeting()}, ${firstName}.`} description="O que você deseja fazer hoje?">
      <div className="flex flex-wrap gap-3">
        <ButtonLink to="/orcamentos/novo" variant="primary" size="lg">
          <IconPlus className="h-4 w-4" />
          Novo Orçamento
        </ButtonLink>
        <ButtonLink to="/pedidos/novo" variant="primary" size="lg">
          <IconPlus className="h-4 w-4" />
          Novo Pedido
        </ButtonLink>
        <ButtonLink to="/clientes?novo=1" variant="secondary" size="lg">
          <IconPlus className="h-4 w-4" />
          Novo Cliente
        </ButtonLink>
        {isAdmin && (
          <ButtonLink to="/produtos/novo" variant="secondary" size="lg">
            <IconPlus className="h-4 w-4" />
            Novo Produto
          </ButtonLink>
        )}
      </div>

      <Link
        to="/neo"
        className={cn(
          'group relative mt-8 flex flex-col items-start gap-4 overflow-hidden rounded-3xl bg-ink-900 p-6 text-white shadow-sm',
          'transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg',
          'sm:flex-row sm:items-center sm:justify-between',
        )}
      >
        <div className="flex items-center gap-4">
          <NeoAvatar className="h-14 w-14 shrink-0 ring-2 ring-white/15" />
          <div>
            <h3 className="text-heading text-white">Converse com o Neo</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-white/60">
              Pergunte sobre preços e produtos, ou peça para montar um orçamento por você.
            </p>
          </div>
        </div>
        <span className="inline-flex h-9.5 shrink-0 items-center gap-1.5 self-start rounded-lg bg-white px-4 text-sm font-semibold text-ink-900 transition-colors duration-150 group-hover:bg-neutral-100 sm:self-auto">
          Conversar
          <IconChevronRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </span>
      </Link>

      <Section title="Principal">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {primaryShortcuts.map((shortcut, i) => (
            <ShortcutCard key={shortcut.to} shortcut={shortcut} tone="brand" size="lg" index={i} />
          ))}
        </div>
      </Section>

      <Section title="Mais ferramentas">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {secondaryShortcuts.map((shortcut, i) => (
            <ShortcutCard key={shortcut.to} shortcut={shortcut} tone="neutral" size="sm" index={i} />
          ))}
        </div>
      </Section>
    </Page>
  )
}

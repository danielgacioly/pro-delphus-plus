import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

// Orçamentos, Pedidos e Clientes são o fluxo do dia a dia — ganham tiles.
// O resto é ferramenta de apoio e vira lista agrupada: a hierarquia vem da
// forma diferente, não de repetir o mesmo card em dois tamanhos.
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
    description: 'Seu mural pessoal de tarefas e lembretes',
    icon: IconBoard,
  },
  {
    to: '/precos',
    title: 'Tabela de preços',
    description: 'Preços em real, dólar e euro por setor',
    icon: IconTag,
  },
  {
    to: '/produtos',
    title: 'Produtos',
    description: 'Catálogo, mídia e customizações disponíveis',
    icon: IconBox,
  },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function PrimaryTile({ shortcut }: { shortcut: Shortcut }) {
  const { to, title, description, icon: Icon } = shortcut
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-black/[0.06] bg-white p-5 transition-[border-color,box-shadow] duration-150 ease-out hover:border-black/[0.12] hover:shadow-md"
    >
      <Icon className="h-[22px] w-[22px] text-brand-600" />
      <div className="pt-7">
        <h3 className="flex items-center gap-1 text-[17px] font-semibold tracking-[-0.022em] text-ink-900">
          {title}
          <IconChevronRight
            className="h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            strokeWidth={2.2}
          />
        </h3>
        <p className="mt-0.5 text-[13px] leading-snug text-neutral-600">{description}</p>
      </div>
    </Link>
  )
}

export function Home() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(' ')[0] ?? ''
  const isAdmin = user?.role === 'ADMIN'

  return (
    <Page title={`${greeting()}, ${firstName}.`} description="Tudo em ordem. Vamos começar?">
      <div className="-mt-2 flex flex-wrap gap-2">
        <ButtonLink to="/orcamentos/novo" variant="primary" size="lg">
          <IconPlus className="h-4 w-4" strokeWidth={2} />
          Novo Orçamento
        </ButtonLink>
        <ButtonLink to="/pedidos/novo" size="lg">
          <IconPlus className="h-4 w-4 text-neutral-500" strokeWidth={2} />
          Novo Pedido
        </ButtonLink>
        <ButtonLink to="/clientes?novo=1" size="lg">
          <IconPlus className="h-4 w-4 text-neutral-500" strokeWidth={2} />
          Novo Cliente
        </ButtonLink>
        {isAdmin && (
          <ButtonLink to="/produtos/novo" size="lg">
            <IconPlus className="h-4 w-4 text-neutral-500" strokeWidth={2} />
            Novo Produto
          </ButtonLink>
        )}
      </div>

      <Link
        to="/neo"
        className="group mt-7 flex flex-col items-start gap-4 rounded-2xl bg-ink-900 py-4 pr-4 pl-4 text-white transition-colors duration-150 ease-out hover:bg-ink-800 sm:flex-row sm:items-center sm:justify-between sm:pl-5"
      >
        <div className="flex items-center gap-3.5">
          <NeoAvatar className="h-10 w-10 shrink-0" />
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.014em] text-white">Vamos bater um papo!</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-white/55">
              Pergunte ao NEO sobre preços, clientes e produtos, ou peça para montar um orçamento ou um pedido por você.
            </p>
          </div>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-lg bg-white/[0.12] px-3.5 text-[13px] font-medium text-white transition-colors duration-150 group-hover:bg-white/[0.18] sm:self-auto">
          Conversar
          <IconChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </Link>

      <Section title="Principal" className="mt-12">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {primaryShortcuts.map((shortcut) => (
            <PrimaryTile key={shortcut.to} shortcut={shortcut} />
          ))}
        </div>
      </Section>

      <Section title="Mais ferramentas" className="mt-10">
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {secondaryShortcuts.map(({ to, title, description, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              className="group relative flex h-12 items-center gap-3 px-4 transition-colors duration-100 hover:bg-black/[0.025]"
            >
              {/* Separador recuado até o texto, como nas listas agrupadas do macOS. */}
              {i > 0 && <span aria-hidden className="absolute top-0 right-0 left-11 h-px bg-black/[0.06]" />}
              <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-500" />
              <span className="text-[14px] font-medium text-ink-900">{title}</span>
              <span className="hidden truncate text-[13px] text-neutral-500 sm:inline">{description}</span>
              <IconChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-400" strokeWidth={2.2} />
            </Link>
          ))}
        </div>
      </Section>
    </Page>
  )
}

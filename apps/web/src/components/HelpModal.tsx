import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from './Modal'
import { Badge, SegmentedControl } from './ui'

interface FaqItem {
  question: string
  answer: string
}

const FAQ: FaqItem[] = [
  {
    question: 'Esqueci minha senha, como recupero?',
    answer:
      'Não existe recuperação automática por e-mail. Peça a um administrador para definir uma nova senha em Administração → Contas.',
  },
  {
    question: "Por que não vejo o menu 'Administração'?",
    answer: 'Esse menu só aparece para contas com perfil Admin. Se precisar de acesso, peça a um administrador.',
  },
  {
    question: "O que é o 'preço especial' que aparece riscado no orçamento?",
    answer:
      'Aparece só quando o preço cobrado no item é menor que o preço de tabela — mostra o preço de tabela riscado ao lado do preço negociado. Um preço customizado maior não conta como especial.',
  },
  {
    question: 'Posso editar um orçamento depois de gerado?',
    answer: "Sim. Clique em 'Editar' na lista de Orçamentos — o PDF e o Excel são regenerados automaticamente.",
  },
  {
    question: 'O câmbio USD/BRL do pedido é automático?',
    answer:
      'Sim, ao criar um pedido o sistema busca o câmbio do dia automaticamente. Você pode ajustar o valor manualmente antes de salvar, se precisar.',
  },
  {
    question: 'Um orçamento já virou pedido e não consigo excluí-lo. Por quê?',
    answer:
      'O sistema bloqueia a exclusão de orçamentos que já viraram pedido, para não deixar o pedido sem origem. Exclua o pedido primeiro, se for o caso.',
  },
  {
    question: 'Como divido os itens de um pedido entre caixas diferentes?',
    answer:
      "No formulário do pedido, na seção 'Itens por caixa', use o botão 'Dividir' — ele já manda a parte dividida para outra caixa automaticamente. Itens de quantidade 1 não podem ser divididos.",
  },
  {
    question: 'Quem pode excluir clientes, orçamentos e pedidos?',
    answer: 'Só contas com perfil Admin. Use o ícone de lixeira na lista correspondente.',
  },
]

interface TutorialStep {
  title: string
  description: string
  to: string
  linkLabel: string
}

const TUTORIAL: TutorialStep[] = [
  {
    title: '1. Cadastre o cliente',
    description: 'Guarda contato, endereços de cobrança/entrega e o histórico de orçamentos e pedidos dele.',
    to: '/clientes',
    linkLabel: 'Ir para Clientes',
  },
  {
    title: '2. Gere o orçamento',
    description: 'Escolha o cliente, adicione os produtos e gere o PDF/Excel automaticamente.',
    to: '/orcamentos/novo',
    linkLabel: 'Novo orçamento',
  },
  {
    title: '3. Crie o pedido a partir do orçamento',
    description: 'Preenche Invoice, Packing List, Packing List Box e o Documento de Exportação de uma vez.',
    to: '/pedidos/novo',
    linkLabel: 'Novo pedido',
  },
  {
    title: '4. Atualize com AWB e Nota Fiscal',
    description: 'No detalhe do pedido, preencha o número do AWB/NF ou anexe os arquivos manualmente assim que chegarem.',
    to: '/pedidos',
    linkLabel: 'Ir para Pedidos',
  },
  {
    title: '5. Marque como concluído',
    description: "Na lista de Pedidos, clique no status ('Pendente' → 'Concluído') quando o envio for finalizado.",
    to: '/pedidos',
    linkLabel: 'Ir para Pedidos',
  },
]

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'faq' | 'tutorial'>('faq')

  return (
    <Modal onClose={onClose} dismissOnBackdrop>
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-title text-ink-900">Ajuda</h2>
            <p className="mt-1 text-[13px] text-neutral-500">Dúvidas rápidas e o passo a passo de uma venda completa.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-ink-900"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          <SegmentedControl
            aria-label="Seção de ajuda"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'faq', label: 'Perguntas frequentes' },
              { value: 'tutorial', label: 'Tutorial de venda' },
            ]}
          />
        </div>

        {tab === 'faq' ? (
          <div className="mt-5 space-y-4">
            {FAQ.map((item) => (
              <div key={item.question}>
                <p className="text-[13.5px] font-semibold text-ink-900">{item.question}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{item.answer}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-[13px] leading-relaxed text-neutral-500">
              O fluxo completo de uma venda, do primeiro contato até o envio confirmado:
            </p>
            {TUTORIAL.map((step) => (
              <div key={step.title} className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3.5">
                <p className="text-[13.5px] font-semibold text-ink-900">{step.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{step.description}</p>
                <Link
                  to={step.to}
                  onClick={onClose}
                  className="mt-2 inline-flex items-center text-[12.5px] font-semibold text-brand-600 hover:underline"
                >
                  {step.linkLabel} →
                </Link>
              </div>
            ))}
            <Badge tone="ink">Fim do fluxo — pedido enviado e documentado</Badge>
          </div>
        )}
      </div>
    </Modal>
  )
}

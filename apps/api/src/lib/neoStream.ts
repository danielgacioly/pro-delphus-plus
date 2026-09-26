/**
 * Peças do NEO em streaming: o texto sai para a tela enquanto o Gemini
 * escreve, e o que ele está fazendo entre uma escrita e outra vira aviso.
 */
import { redactInternalIds } from './neoPendingActions.js'

// Um UUID tem 36 caracteres: segurando os últimos 36 até chegar mais texto,
// um id que venha partido entre dois pedaços do stream nunca aparece pela
// metade na tela antes de ser riscado.
const HOLD_BACK = 36

/**
 * Risca ids internos de um texto que chega aos pedaços. `push` devolve o que
 * já pode ir para a tela; `flush` devolve o resto quando o texto termina.
 */
export class IdRedactingStream {
  private buffer = ''

  push(text: string): string {
    this.buffer = redactInternalIds(this.buffer + text)
    if (this.buffer.length <= HOLD_BACK) return ''
    const ready = this.buffer.slice(0, -HOLD_BACK)
    this.buffer = this.buffer.slice(-HOLD_BACK)
    return ready
  }

  flush(): string {
    const rest = redactInternalIds(this.buffer)
    this.buffer = ''
    return rest
  }

  reset() {
    this.buffer = ''
  }
}

const TOOL_STATUS: Record<string, string> = {
  buscar_produtos: 'Buscando produtos',
  listar_clientes: 'Buscando clientes',
  buscar_cliente: 'Buscando cliente',
  listar_setores: 'Consultando setores',
  buscar_orcamentos: 'Buscando orçamentos',
  buscar_pedidos: 'Buscando pedidos',
  verificar_pendencias: 'Verificando pendências',
  buscar_biblioteca: 'Consultando a Biblioteca',
  criar_tarefa: 'Criando tarefa',
  propor_orcamento: 'Montando orçamento',
  propor_edicao_orcamento: 'Montando edição do orçamento',
  propor_pedido: 'Montando pedido',
  propor_edicao_pedido: 'Montando edição do pedido',
  propor_cliente: 'Preparando cadastro do cliente',
  propor_edicao_cliente: 'Preparando edição do cliente',
  propor_registro_biblioteca: 'Preparando registro na Biblioteca',
}

/** O aviso de progresso para as ferramentas que o NEO chamou de uma vez. */
export function neoToolStatus(toolNames: string[]): string {
  const labels = [...new Set(toolNames.map((name) => TOOL_STATUS[name] ?? 'Consultando o sistema'))]
  return `${labels.map((label, i) => (i === 0 ? label : label[0]!.toLowerCase() + label.slice(1))).join(' e ')}…`
}

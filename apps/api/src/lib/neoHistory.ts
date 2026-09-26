/**
 * Quantas mensagens anteriores da conversa vão para o Gemini a cada pergunta.
 * A conversa inteira era reenviada em toda chamada — e cada pergunta faz de 1
 * a 5 chamadas —, então numa conversa longa o histórico virava a maior parte
 * da conta e do tempo de resposta. 16 cobre com folga um pedido, o fluxo mais
 * longo (orçamento criado, perguntas do pedido, respostas, prévia).
 */
export const NEO_HISTORY_LIMIT = 16

export interface NeoHistoryMessage {
  role: string
  text: string
}

/**
 * As últimas `limit` mensagens, começando sempre numa mensagem da pessoa: o
 * Gemini espera que a conversa abra com o usuário, e cortar no meio deixaria
 * uma resposta do NEO solta no início, sem a pergunta que a originou.
 */
export function recentHistory<T extends NeoHistoryMessage>(history: T[], limit = NEO_HISTORY_LIMIT): T[] {
  const recent = history.slice(-limit)
  const firstUser = recent.findIndex((m) => m.role === 'user')
  return firstUser === -1 ? [] : recent.slice(firstUser)
}

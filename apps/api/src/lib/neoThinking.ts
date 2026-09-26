/**
 * Quanto o NEO raciocina em cada pergunta. Raciocínio baixo é mais rápido e
 * mais barato e dá conta de consulta (preço, produto, cliente, Biblioteca);
 * orçamento, pedido, desconto e edição pedem interpretação — escolher o campo
 * certo, fazer conta, não pular pergunta obrigatória — e ganham raciocínio
 * médio. A decisão é por palavras, sem chamada extra ao Gemini: uma chamada a
 * mais para decidir custaria justamente o tempo que se quer economizar.
 */
import { normalize } from './fuzzyMatch.js'

export type NeoThinking = 'low' | 'medium'

// Sem acento e em minúsculas (comparado depois de `normalize`). Radicais
// valem pelas variações: "desconto"/"descontos", "edita"/"editar".
const CAREFUL_PATTERNS: RegExp[] = [
  // Preço e desconto: o NEO decide entre preço do item, desconto do item e
  // desconto geral, e converte porcentagem em valor.
  /desconto/,
  /%/,
  /preco (especial|customizad|diferente)/,
  /r\$|us\$|€/,
  // Montar ou mexer em documento.
  /orcamento/,
  /pedido/,
  /cadastr/,
  /novo cliente/,
  // Campos do pedido que a pessoa responde depois de o NEO perguntar.
  /caixa/,
  /\bpeso|\bkg\b/,
  /pagamento|paypal|\bpix\b|transferencia|wire/,
  /incoterm|\b(exw|dap|ddp|fob|cif)\b/,
  /\bawb\b|nota fiscal|\bnf\b|expedicao|sedex|transportadora/,
  /descricao|componente/,
  // Edição de algo que já existe.
  /\b(muda|mude|mudar|troca|troque|trocar|tira|tire|tirar|acrescenta|acrescente|adiciona|adicione|remove|remova|altera|altere|edita|edite|corrige|corrija)/,
]

/**
 * `lastModelText` é a última fala do NEO: quando ele pergunta "quantas caixas
 * e qual o pagamento?", a resposta "3, PayPal" sozinha não parece exigir
 * nada, mas é a continuação de um pedido.
 */
export function neoThinkingFor(message: string, lastModelText = ''): NeoThinking {
  const text = normalize(`${message}\n${lastModelText}`)
  return CAREFUL_PATTERNS.some((pattern) => pattern.test(text)) ? 'medium' : 'low'
}

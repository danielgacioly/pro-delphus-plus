/**
 * Quanto o NEO raciocina em cada pergunta. Baixo é o padrão — mais rápido e
 * mais barato, e dá conta de consulta e de montar orçamento/pedido/cliente
 * simples: as regras que protegem dado (moeda, idioma, padrão da descrição,
 * campos do pedido) são checadas pelo servidor, não dependem de o modelo
 * raciocinar. Médio só onde há interpretação de verdade: conta de desconto,
 * preço especial, reescrever algo que já existe sem perder o resto, texto
 * ditado pela pessoa e divisão em várias caixas. Se uma ferramenta recusar os
 * dados, a rota sobe pra médio na tentativa seguinte (neo.routes.ts).
 * A decisão é por palavras, sem chamada extra ao Gemini: uma chamada a mais
 * para decidir custaria justamente o tempo que se quer economizar.
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
  /preco (especial|customizad|diferente|negociad)/,
  /r\$|us\$|€/,
  // Edição: o documento é reescrito inteiro, e o que não muda tem que ser
  // repassado igual.
  /\b(muda|mude|mudar|troca|troque|trocar|tira|tire|tirar|acrescenta|acrescente|adiciona|adicione|remove|remova|altera|altere|edita|edite|editar|corrige|corrija)/,
  // Divisão em mais de uma caixa: casar item com caixa e quantidade.
  /caixa\s*\d[\s\S]*caixa\s*\d/,
]

// Descrição/componentes ditados pela pessoa (e não "o padrão"): o texto tem
// que sair exatamente como ela falou, no item certo.
const DICTATED_TEXT = /descricao|componente/

/**
 * Só a mensagem da pessoa decide: a última fala do NEO repete palavras como
 * "orçamento" e "descrição" o tempo todo, e subiria o nível de toda resposta.
 */
export function neoThinkingFor(message: string): NeoThinking {
  const text = normalize(message)
  if (CAREFUL_PATTERNS.some((pattern) => pattern.test(text))) return 'medium'
  if (DICTATED_TEXT.test(text) && !/padr/.test(text)) return 'medium'
  return 'low'
}

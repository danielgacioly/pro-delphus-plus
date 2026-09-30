const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// O flag vem do próprio modelo, que já marcou `true` sem perguntar (visto ao
// vivo) — então só vale se a última mensagem REAL da pessoa também diz "sim,
// o padrão". Texto que ela digitou o modelo não consegue forjar.
const AFFIRMATIVE =
  /\b(sim|s|ss|pode|podes|padrao|padroes|default|usa|usar|use|ok|okay|claro|isso|quero|blz|beleza|perfeito|certo|correto|exato|exatamente|fechado|fechou|bora|siga|show|top|otimo|positivo|afirmativo|yes|yep|uhum|aham|tranquilo|joia|combinado|mantem|mantenha|manter|valeu)\b|\b(manda ver|manda bala|pode seguir|segue assim|ta bom|pode ser)\b/

export function saidYesToDefault(userText: string) {
  const t = plain(userText)
  if (/\b(nao|nunca|custom\w*|minha|meu|outra|outro|diferente|mudar|alterar)\b/.test(t)) return false
  // "padroes" (plural, sem acento) era recusado: a pessoa escrevia "descrição
  // e componentes padrões" já no pedido e o NEO perguntava de novo.
  return AFFIRMATIVE.test(t) || /👍|✅|👌/.test(userText)
}

/**
 * A pessoa já confirmou, na própria mensagem, que o documento pode ser gravado
 * ("confirmo a geração do orçamento", "pode criar direto", "sem precisar
 * confirmar") — aí a proposta do NEO é gravada na hora, sem o cartão. Precisa
 * falar da gravação: um "confirmo, é internacional" responde outra pergunta
 * e não pode virar autorização.
 */
export function confirmedUpFront(userText: string) {
  const t = plain(userText)
  if (/\bnao\s+(confirm|ger|cri|salv|grav)/.test(t)) return false
  return (
    /\bconfirm(o|ado|ada)\b[^.!?\n]{0,30}\b(gera\w*|cria\w*|cadastr\w*|grav\w*|salv\w*|registr\w*|orcamento|pedido|edicao|alteracao)/.test(t) ||
    /\b(pode|ja pode)\s+(gerar|criar|salvar|gravar|cadastrar|registrar)\s+(direto|sem\s+(me\s+)?(perguntar|confirmar))/.test(t) ||
    /\b(gera|gere|cria|crie|salva|salve|grava|grave)\s+direto\b/.test(t) ||
    /\bsem\s+(precisar\s+(de\s+)?)?(confirmar|confirmacao)\b/.test(t)
  )
}

// Mensagem com cara de pedido novo ou de resposta com condição — não é um
// "sim" puro, mesmo tendo "padrão" ou "pode" no meio.
const NOT_A_PLAIN_ANSWER =
  /\b(orcamento|orcamentos|cotacao|pedido|pedidos|cliente|faz|faca|monta|monte|novo|nova|unidade|unidades|mas|porem|exceto|menos|troca|troque|muda|mude|so que)\b/

/**
 * A mensagem é só a resposta "sim" à pergunta do padrão — de qualquer jeito
 * que a pessoa fale ("manda ver", "pode seguir", "beleza, pode ser", "👍")?
 * É o que libera montar o cartão sem o modelo, a partir do rascunho guardado.
 * Por isso recusa o que tem cara de pedido novo ou de condição: visto ao
 * vivo, "Faz um orçamento nacional pro Dr. X com 1 HOP, descrição e
 * componentes padrão" tem "padrão" e "pode", e gravava o rascunho da
 * conversa ANTERIOR no lugar do orçamento novo. Número, pergunta e "mas…"
 * também ficam de fora — aí o modelo interpreta.
 */
export function isPlainYesToDefault(userText: string) {
  const t = plain(userText)
  if (/\d|\?/.test(t) || NOT_A_PLAIN_ANSWER.test(t)) return false
  if (t.split(/\s+/).filter(Boolean).length > 20) return false
  return saidYesToDefault(userText)
}

/**
 * Se a pessoa disse, no que digitou, que o pedido é nacional ou internacional
 * ("gera o pedido internacional do orçamento X"). Só vale quando fala de um
 * dos dois — citar os dois (ou nenhum) não decide nada.
 */
export function declaredExportScope(userText: string): 'NATIONAL' | 'INTERNATIONAL' | undefined {
  const t = plain(userText)
  const international = /\b(internaciona(l|is)|exterior|exportacao)\b/.test(t)
  const national = /\bnaciona(l|is)\b/.test(t)
  if (international === national) return undefined
  return international ? 'INTERNATIONAL' : 'NATIONAL'
}

/**
 * A forma de pagamento que a pessoa escreveu (Pix ou PayPal). Visto ao vivo:
 * ela pediu Pix num pedido internacional e o modelo, sabendo que não pode,
 * trocou sozinho pra transferência sem avisar. Citar transferência junto
 * ("não é PayPal, é transferência") não decide nada.
 */
export function declaredPrepayment(userText: string): 'PIX' | 'PAYPAL' | undefined {
  // Nos formulários de atalho só conta o valor de cada linha, não o rótulo
  // ("Pagamento (PayPal ou transferência): Pix", "Taxa do PayPal: ").
  const values = userText
    .split('\n')
    .map((line) => line.match(/^[^:\n]{1,120}:(.*)$/)?.[1] ?? line)
    .join('\n')
  const t = plain(values.replace(/\([^)]*\)/g, ''))
  const pix = /\bpix\b/.test(t)
  const paypal = /\bpaypal\b/.test(t)
  if (pix === paypal || /\btransferencia|\bwire\b/.test(t)) return undefined
  return pix ? 'PIX' : 'PAYPAL'
}

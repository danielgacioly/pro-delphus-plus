const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// O flag vem do próprio modelo, que já marcou `true` sem perguntar (visto ao
// vivo) — então só vale se a última mensagem REAL da pessoa também diz "sim,
// o padrão". Texto que ela digitou o modelo não consegue forjar.
export function saidYesToDefault(userText: string) {
  const t = plain(userText)
  if (/\b(nao|nunca|custom\w*|minha|meu|outra|outro|diferente|mudar|alterar)\b/.test(t)) return false
  // "padroes" (plural, sem acento) era recusado: a pessoa escrevia "descrição
  // e componentes padrões" já no pedido e o NEO perguntava de novo.
  return /\b(sim|pode|padrao|padroes|default|usa|usar|use|ok|claro|isso|quero|blz|beleza|s)\b/.test(t)
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

// Só palavras de "sim" — qualquer outra (nome de cliente, produto, "orçamento")
// indica mensagem nova, não resposta à pergunta.
const PLAIN_YES_WORDS = new Set(
  (
    'sim s ss pode podes ok okay blz beleza claro isso exato certo perfeito fechado bora quero ' +
    'usa use usar usando manter mantem mantenha mesmo o os a as e de do da dos das deste desse destes desses esse esses este estes ' +
    'padrao padroes default descricao descricoes componente componentes com tudo por favor pfv pf ' +
    'gera gerar gere cria criar crie grava gravar grave salva salvar salve direto confirmo confirma confirmar pode sem perguntar ja'
  ).split(' '),
)

/**
 * A mensagem é SÓ a resposta "sim" à pergunta do padrão ("sim", "pode usar o
 * padrão", "sim, pode gravar direto")? É o que libera montar o cartão sem o
 * modelo, a partir do rascunho guardado — e por isso é bem mais estrito que
 * `saidYesToDefault`: visto ao vivo, "Faz um orçamento nacional pro Dr. X com
 * 1 HOP, descrição e componentes padrão" tem "padrão" e "pode", e gravava o
 * rascunho da conversa ANTERIOR no lugar do orçamento novo.
 */
export function isPlainYesToDefault(userText: string) {
  const words = plain(userText).split(/[^a-z0-9]+/).filter(Boolean)
  return words.length > 0 && words.length <= 12 && words.every((w) => PLAIN_YES_WORDS.has(w)) && saidYesToDefault(userText)
}

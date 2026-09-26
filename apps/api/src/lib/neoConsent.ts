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

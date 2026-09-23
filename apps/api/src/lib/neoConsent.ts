// O flag vem do próprio modelo, que já marcou `true` sem perguntar (visto ao
// vivo) — então só vale se a última mensagem REAL da pessoa também diz "sim,
// o padrão". Texto que ela digitou o modelo não consegue forjar.
export function saidYesToDefault(userText: string) {
  const t = userText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\b(nao|nunca|custom\w*|minha|meu|outra|outro|diferente|mudar|alterar)\b/.test(t)) return false
  return /\b(sim|pode|padrao|default|usa|usar|use|ok|claro|isso|quero|blz|beleza|s)\b/.test(t)
}


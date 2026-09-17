// <input type="datetime-local"> troca dados em horário LOCAL, sem timezone —
// convertendo pra/de ISO explicitamente aqui, o instante final nunca depende
// de o navegador e o servidor compartilharem o mesmo fuso horário.
export function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toIsoFromDatetimeLocal(value: string) {
  return new Date(value).toISOString()
}

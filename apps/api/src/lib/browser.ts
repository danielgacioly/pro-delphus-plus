import { launch, type Browser, type PDFOptions } from 'puppeteer'

/**
 * Um único Chromium para todos os PDFs do sistema (orçamento, documentos de
 * pedido, tabela de preços). Subir o navegador custa caro, então ele é
 * reaproveitado entre requisições — mas *só enquanto estiver vivo*.
 *
 * Antes, cada arquivo de PDF tinha seu próprio `browserPromise ??= launch()`,
 * e essa promessa nunca era descartada. Quando o Chromium caía — máquina
 * dormiu, OOM, crash — a promessa resolvida continuava ali apontando para um
 * navegador morto, e toda geração seguinte falhava com 500 até alguém
 * reiniciar o processo: não dava mais para editar orçamento, criar pedido nem
 * regerar documento nenhum. Um `launch()` que falhasse ficava igualmente
 * gravado para sempre.
 */
let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  const pending = browserPromise
  if (pending) {
    const existing = await pending.catch(() => null)
    if (existing?.connected) return existing
    if (browserPromise === pending) browserPromise = null
  }

  // O Chromium do Debian (instalado via apt no Dockerfile) tenta subir o
  // crash_reporter/crashpad_handler ao iniciar e falha em alguns hosts com
  // "chrome_crashpad_handler: --database is required", derrubando o launch
  // inteiro antes mesmo de renderizar qualquer página. Desabilitar o crash
  // reporter evita que esse subprocesso seja disparado.
  const launched = launch({ headless: true, args: ['--no-sandbox', '--disable-crash-reporter'] })
  browserPromise = launched

  let browser: Browser
  try {
    browser = await launched
  } catch (err) {
    if (browserPromise === launched) browserPromise = null
    throw err
  }

  browser.once('disconnected', () => {
    if (browserPromise === launched) browserPromise = null
  })
  return browser
}

async function renderWith(browser: Browser, html: string, options: PDFOptions): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    return Buffer.from(await page.pdf(options))
  } finally {
    await page.close()
  }
}

/** HTML → PDF. Se o navegador tiver morrido, sobe outro e tenta de novo. */
export async function renderPdf(html: string, options: PDFOptions): Promise<Buffer> {
  const browser = await getBrowser()
  try {
    return await renderWith(browser, html, options)
  } catch (err) {
    // Navegador vivo: o erro é da renderização em si, e repetir não ajuda.
    if (browser.connected) throw err
    return renderWith(await getBrowser(), html, options)
  }
}

async function closeBrowser() {
  const pending = browserPromise
  browserPromise = null
  try {
    await (await pending)?.close()
  } catch {
    // Navegador já morto é exatamente o que se queria.
  }
}

// `tsx watch` derruba o processo a cada alteração de arquivo; sem isto, cada
// reload deixava um Chromium órfão vivo pelo resto do dia.
function onSignal(signal: NodeJS.Signals) {
  void closeBrowser().finally(() => process.kill(process.pid, signal))
}
process.once('SIGINT', onSignal)
process.once('SIGTERM', onSignal)

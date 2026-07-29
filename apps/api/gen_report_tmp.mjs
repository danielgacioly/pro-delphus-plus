import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { prisma } from './src/lib/prisma.ts'

const logoPng = fs.readFileSync(path.join('src/assets/logo-company.png'))
const logoDataUri = `data:image/png;base64,${logoPng.toString('base64')}`

const noSku = await prisma.product.findMany({
  where: { sku: '' },
  select: { name: true, sectors: true, kind: true },
  orderBy: { name: 'asc' },
})

const kindLabel = { COMPLETE_MODEL: 'Modelo completo', COMPONENT: 'Componente / peça' }

function escapeHtml(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const noSkuRows = noSku.map(p => `
  <tr>
    <td>${escapeHtml(p.name)}</td>
    <td>${escapeHtml(p.sectors.join(', '))}</td>
    <td>${kindLabel[p.kind]}</td>
  </tr>`).join('')

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 28mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 11px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #EF1818; padding-bottom: 10px; margin-bottom: 18px; }
  .header img { height: 40px; }
  .header .title { text-align: right; }
  .header h1 { font-size: 16px; margin: 0; color: #1a1a1a; }
  .header .date { font-size: 10px; color: #6a6a6a; margin-top: 2px; }
  h2 { font-size: 13px; color: #EF1818; border-bottom: 1px solid #e2e0d8; padding-bottom: 4px; margin-top: 26px; margin-bottom: 8px; }
  p.lead { color: #4a4a4a; margin: 4px 0 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { text-align: left; background: #f1efe9; font-size: 9.5px; text-transform: uppercase; color: #6a6a6a; padding: 5px 6px; border: 1px solid #e2e0d8; }
  td { padding: 5px 6px; border: 1px solid #e2e0d8; font-size: 10.5px; vertical-align: top; }
  tr:nth-child(even) td { background: #fafaf8; }
  .done-list { margin: 0; padding-left: 18px; }
  .done-list li { margin-bottom: 5px; }
  .note { background: #FFF3CD; border: 1px solid #E0B400; border-radius: 4px; padding: 8px 10px; font-size: 10px; margin-top: 8px; }
  .badge-ok { display: inline-block; background: #2e7d32; color: #fff; font-size: 8.5px; font-weight: bold; padding: 1px 6px; border-radius: 3px; margin-left: 6px; }
  .footer { position: fixed; bottom: -12mm; left: 0; right: 0; font-size: 8.5px; color: #999; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <img src="${logoDataUri}" alt="Pro Delphus+">
    <div class="title">
      <h1>Relatório de Pendências e Ajustes — Catálogo de Produtos</h1>
      <div class="date">${today}</div>
    </div>
  </div>

  <h2>1. Ajustes aplicados nesta rodada</h2>
  <p class="lead">Confirmados e executados a partir das correções enviadas (WhatsApp, 29/07/2026):</p>
  <ul class="done-list">
    <li><strong>15 cadastros duplicados removidos</strong> — SKU 2886 (UROGNM-1 duplicado, mantida LAB-GNM1), SKU 2887 (LAB-GNM-0 inexistente, mantida UROGNM-0), SKUs 2915–2925 (11 duplicatas "LABGNM-x" em ENDOUROLOGY - Penile procedures, criadas por engano ao inserir esse setor — mantidas apenas as LAB-GNMx em Lab - Male Genitals), SKU 368 (ETX-11 em Suture Models, não existe em Sutura), SKU 2548 (ETR-5V, confirmado que não existe).</li>
    <li><strong>BP-2 (SKU 527)</strong> — descrição unificada para <em>"Peristaltic pump IN-OUT"</em> nos 4 cadastros (Postpartum, Pectus Excavatum, Spine, Thoracic Trauma). Mantidos como 4 cadastros separados a pedido, já que os preços divergem entre setores.</li>
    <li><strong>THOR-2P / THOR-2PP (SKU 3338)</strong> — renomeado de "THOR-2PP" para "THOR-2P" nos dois cadastros (Pectus Excavatum e Thor A2 2nd Generation), conforme definido pela Lidiane.</li>
    <li><strong>Correção de SKU</strong> — ETH7L-MT1T2/2G: 2705 → <strong>2840</strong>. ETH7L-RP: 2722 → <strong>2822</strong>.</li>
  </ul>

  <h2>2. Duplicidades de SKU remanescentes (intencionais)</h2>
  <p class="lead">Únicos casos restantes de SKU repetido no catálogo — mantidos propositalmente, não são erro:</p>
  <table>
    <thead><tr><th>SKU</th><th>Situação</th></tr></thead>
    <tbody>
      <tr><td>527 (BP-2)</td><td>4 cadastros — um por setor (Postpartum, Pectus Excavatum, Spine, Thoracic Trauma), preços diferentes conforme o simulador que acompanha. Descrição já padronizada. <span class="badge-ok">RESOLVIDO</span></td></tr>
      <tr><td>3338 (THOR-2P)</td><td>2 cadastros — Pectus Excavatum (com patologia) e Thor A2 2nd Generation (com patologia), preços diferentes por setor. Nome já padronizado. <span class="badge-ok">RESOLVIDO</span></td></tr>
    </tbody>
  </table>

  <h2>3. Produtos sem SKU cadastrado (${noSku.length})</h2>
  <p class="lead">Modelos completos/componentes sem código de SKU atribuído. Segundo a Lidiane, para parte destes "kits completos" nunca foi solicitada a criação de um código — não é necessariamente um erro, mas segue listado para acompanhamento.</p>
  <table>
    <thead><tr><th>Nome</th><th>Setor</th><th>Tipo</th></tr></thead>
    <tbody>${noSkuRows}</tbody>
  </table>
  <div class="note">Pendente de definição: confirmar quais destes precisam de SKU novo e quais devem continuar sem código.</div>

  <div class="footer">Pro Delphus+ · Relatório gerado automaticamente a partir do catálogo de produtos</div>
</body>
</html>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '28mm', bottom: '20mm', left: '16mm', right: '16mm' } })
await browser.close()

const outPath = '/private/tmp/claude-501/-Users-danielacioly-Documents-prodelphusplus/f3e3ea8e-0399-4db0-985c-b1a3bd3bc4a7/scratchpad/Relatorio-Pendencias-Catalogo.pdf'
fs.writeFileSync(outPath, pdfBuffer)
console.log('PDF written to', outPath, 'size', pdfBuffer.length)

await prisma.$disconnect()

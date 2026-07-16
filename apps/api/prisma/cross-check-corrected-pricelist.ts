import 'dotenv/config'
import fs from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

interface PdfRecord {
  sku: string | null
  name: string
  oldUsd: number | null
  usd: number | null
}

const CODEISH = /^[A-Z0-9][A-Z0-9/.-]*$/
const SLASH_CODE = /^[A-Z]{2,}\/[A-Za-z][A-Za-z0-9-]*$/

function extractCode(rawText: string): string | null {
  const text = rawText.trim().replace(/^\$+\s*/, '')
  const words = text.split(/\s+/)
  let i = 0
  while (i < words.length && (CODEISH.test(words[i]) || SLASH_CODE.test(words[i]))) {
    i++
  }
  if (i === 0) return null
  return words.slice(0, i).join(' ').toUpperCase()
}

const DRY_RUN = !process.argv.includes('--apply')

async function main() {
  const pdfRecords: PdfRecord[] = JSON.parse(
    fs.readFileSync(
      '/private/tmp/claude-501/-Users-danielacioly-Documents-prodelphusplus/f3e3ea8e-0399-4db0-985c-b1a3bd3bc4a7/scratchpad/pricelist_corrected_parsed.json',
      'utf-8',
    ),
  )

  const pdfByCode = new Map<string, PdfRecord>()
  for (const r of pdfRecords) {
    const code = extractCode(r.name)
    if (!code) continue
    const existing = pdfByCode.get(code)
    // Prefer the record that actually has a usd price and a sku, in case of buffer-contamination duplicates
    if (!existing || (r.usd !== null && existing.usd === null) || (r.sku && !existing.sku)) {
      pdfByCode.set(code, r)
    }
  }

  const products = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, description: true, priceUSD: true, sector: true, kind: true },
  })

  const filledSkus: Array<{ id: string; code: string; oldSku: string; newSku: string }> = []
  const priceMismatches: Array<{ code: string; dbSku: string; dbName: string; dbUsd: string; pdfUsd: number }> = []
  const skuConflicts: Array<{ code: string; dbSku: string; pdfSku: string; dbName: string }> = []
  const notFound: Array<{ sku: string; name: string }> = []

  for (const p of products) {
    const fullText = p.description ? `${p.name} ${p.description}` : p.name
    const code = extractCode(fullText) ?? extractCode(p.name)
    if (!code) continue
    const pdfRecord = pdfByCode.get(code)
    if (!pdfRecord) {
      if (!p.sku) notFound.push({ sku: '(sem sku)', name: p.name })
      continue
    }

    if (!p.sku && pdfRecord.sku) {
      filledSkus.push({ id: p.id, code, oldSku: p.sku, newSku: pdfRecord.sku })
    } else if (p.sku && pdfRecord.sku && p.sku !== pdfRecord.sku) {
      skuConflicts.push({ code, dbSku: p.sku, pdfSku: pdfRecord.sku, dbName: p.name })
    }

    if (pdfRecord.usd !== null) {
      const dbUsd = p.priceUSD !== null ? Number(p.priceUSD) : null
      if (dbUsd !== null && Math.abs(dbUsd - pdfRecord.usd) > 0.5) {
        priceMismatches.push({
          code,
          dbSku: p.sku || '(sem sku)',
          dbName: p.name,
          dbUsd: dbUsd.toFixed(2),
          pdfUsd: pdfRecord.usd,
        })
      }
    }
  }

  console.log(`=== SKUs em branco preenchidos via a nova price list (${filledSkus.length}) ===`)
  for (const f of filledSkus) console.log(`  [${f.code}] '' -> ${f.newSku}`)

  console.log(`\n=== Conflitos de SKU (DB tem um valor, price list tem outro) (${skuConflicts.length}) ===`)
  for (const c of skuConflicts) console.log(`  [${c.code}] "${c.dbName}" -- DB: ${c.dbSku} | Price list: ${c.pdfSku}`)

  console.log(`\n=== Divergencias de preco USD (${priceMismatches.length}) ===`)
  for (const m of priceMismatches)
    console.log(`  [${m.code}] sku=${m.dbSku} "${m.dbName}" -- DB: $${m.dbUsd} | Price list: $${m.pdfUsd}`)

  console.log(`\n=== Produtos com SKU em branco e SEM correspondencia na price list (${notFound.length}) ===`)
  for (const n of notFound) console.log(`  ${n.name}`)

  if (!DRY_RUN) {
    for (const f of filledSkus) {
      await prisma.product.update({ where: { id: f.id }, data: { sku: f.newSku } })
    }
    console.log(`\nAplicado: ${filledSkus.length} SKUs preenchidos.`)
  } else {
    console.log('\n(dry-run - nada foi gravado no banco. Rode com --apply para preencher os SKUs em branco.)')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

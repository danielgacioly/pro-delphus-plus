/**
 * Importa os preços antigos (OLD USD, OLD EURO, REAL ANTIGO) da planilha
 * "Price List Final 2025" para os produtos do catálogo.
 *
 *   npm run prisma:seed:old-prices --workspace=apps/api             # só mostra o que faria
 *   npm run prisma:seed:old-prices --workspace=apps/api -- --apply  # grava
 *
 * Em produção (imagem sem tsx, script compilado em dist/):
 *   docker compose -f docker-compose.prod.yml --env-file .env.prod exec api \
 *     node apps/api/dist/prisma/seed-old-prices.js [--apply]
 *
 * Não sobrescreve produto que já tem algum preço antigo (preenchido à mão no
 * cadastro, por exemplo), a não ser com `--force`. Os que não casam com a
 * planilha ficam listados no fim para preencher pelo cadastro do produto.
 * Regras de casamento: src/domain/oldPrices.ts.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { matchOldPrice, type OldPriceRow } from '../src/domain/oldPrices.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apply = process.argv.includes('--apply')
const force = process.argv.includes('--force')

const money = (v: number | null) => (v === null ? '—' : v.toFixed(2))

async function main() {
  // Rodando com tsx, o arquivo está ao lado (prisma/data); compilado, este
  // script fica em dist/prisma e os dados continuam em prisma/data.
  const dataFile = [
    path.join(__dirname, 'data', 'old-prices-2025.json'),
    path.join(__dirname, '..', '..', 'prisma', 'data', 'old-prices-2025.json'),
  ].find((candidate) => fs.existsSync(candidate))
  if (!dataFile) throw new Error('old-prices-2025.json não encontrado em prisma/data')
  const rows: OldPriceRow[] = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  console.log(`${rows.length} linhas da planilha, ${products.length} produtos ativos${apply ? '' : ' — simulação, nada é gravado (use --apply)'}`)

  const unmatched: string[] = []
  const divergent: string[] = []
  let updated = 0
  let skipped = 0

  for (const p of products) {
    const label = `${p.name}${p.sku ? ` (SKU ${p.sku})` : ''}`
    const match = matchOldPrice(
      {
        id: p.id,
        sku: p.sku,
        name: p.name,
        priceUSD: p.priceUSD === null ? null : Number(p.priceUSD),
        priceEUR: p.priceEUR === null ? null : Number(p.priceEUR),
      },
      rows,
    )
    if (match.status === 'unmatched') {
      unmatched.push(label)
      continue
    }
    if (match.status === 'divergent') {
      const others = match.alternatives.map((r) => `${r.sheet} US$ ${money(r.oldUSD)}`).join(', ')
      divergent.push(`${label}: usado ${match.row.sheet} US$ ${money(match.row.oldUSD)} — também há ${others}`)
    }
    const hasOld = p.oldPriceUSD !== null || p.oldPriceEUR !== null || p.oldPriceBRL !== null
    if (hasOld && !force) {
      skipped++
      continue
    }
    if (apply) {
      await prisma.product.update({
        where: { id: p.id },
        data: { oldPriceUSD: match.row.oldUSD, oldPriceEUR: match.row.oldEUR, oldPriceBRL: match.row.oldBRL },
      })
    }
    updated++
  }

  console.log(`\n${apply ? 'atualizados' : 'seriam atualizados'}: ${updated}`)
  console.log(`já tinham preço antigo (mantidos${force ? '' : ', use --force para sobrescrever'}): ${skipped}`)
  if (divergent.length > 0) {
    console.log(`\nvalores diferentes na planilha para o mesmo produto (${divergent.length}) — conferir:`)
    for (const line of divergent) console.log(`  ${line}`)
  }
  console.log(`\nsem preço antigo na planilha (${unmatched.length}) — preencher pelo cadastro se precisar:`)
  for (const line of unmatched) console.log(`  ${line}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

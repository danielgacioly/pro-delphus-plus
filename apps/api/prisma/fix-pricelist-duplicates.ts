import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PREDEFINED_SECTORS } from '@prodelphusplus/shared'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface ParsedProduct {
  line: number
  sector: string
  kind: 'COMPLETE_MODEL' | 'COMPONENT'
  sku: string
  name: string
  description: string | null
  priceUSDDistributor: number | null
  priceUSD: number | null
  duplicate?: boolean
  derived_sku?: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sectorByNorm = new Map(PREDEFINED_SECTORS.map((s) => [norm(s), s]))

function normalizeSector(raw: string): string {
  return sectorByNorm.get(norm(raw)) ?? raw
}

// One-time correction for the initial price-list seed (task #43), which
// incorrectly synthesized SKUs for blank entries and skipped real duplicate
// SKUs instead of keeping them. Per the user: duplicate SKUs from the source
// list are legitimate (kept as-is), blank SKUs stay blank for manual fill-in later.
async function main() {
  const repoFile = path.join(__dirname, 'data', 'pricelist-reps-2025.json')
  const products: ParsedProduct[] = JSON.parse(fs.readFileSync(repoFile, 'utf-8'))

  let blanked = 0
  let blankNotFound = 0
  for (const p of products.filter((p) => p.derived_sku)) {
    const result = await prisma.product.updateMany({
      where: { sku: p.sku, name: p.name },
      data: { sku: '' },
    })
    if (result.count > 0) blanked += result.count
    else blankNotFound++
  }

  let created = 0
  for (const p of products.filter((p) => p.duplicate)) {
    await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        description: p.description,
        sector: normalizeSector(p.sector),
        kind: p.kind,
        priceUSDDistributor: p.priceUSDDistributor,
        priceUSD: p.priceUSD,
      },
    })
    created++
  }

  console.log(`SKUs em branco corrigidos: ${blanked} (não encontrados: ${blankNotFound})`)
  console.log(`duplicados criados: ${created}`)
  const total = await prisma.product.count()
  console.log(`total de produtos no banco: ${total}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

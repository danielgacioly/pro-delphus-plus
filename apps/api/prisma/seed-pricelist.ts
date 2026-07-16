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

// Map ALL-CAPS PDF sector names onto the nicely-cased predefined list when they match.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sectorByNorm = new Map(PREDEFINED_SECTORS.map((s) => [norm(s), s]))

function normalizeSector(raw: string): string {
  return sectorByNorm.get(norm(raw)) ?? raw
}

async function main() {
  const repoFile = path.join(__dirname, 'data', 'pricelist-reps-2025.json')
  const file = fs.existsSync(repoFile) ? repoFile : '/tmp/pricelist_parsed.json'
  const products: ParsedProduct[] = JSON.parse(fs.readFileSync(file, 'utf-8'))
  console.log(`lendo ${products.length} produtos de ${file}`)

  // SKU is not a unique key: the source list has real duplicate SKUs (kept as
  // separate products) and blank SKUs (left blank for manual fill-in later),
  // so every row is inserted as-is rather than upserted by SKU.
  let created = 0
  for (const p of products) {
    await prisma.product.create({
      data: {
        sku: p.derived_sku ? '' : p.sku,
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

  console.log(`criados: ${created}`)
  const total = await prisma.product.count()
  console.log(`total de produtos no banco: ${total}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Product names in the price list are "CODE + descriptive sentence" (e.g.
// "SIMPEC STANDARD ALICE Simulator for obstetric maneuvers"). For COMPLETE_MODEL
// products this makes the catalog title unreadably long. This extracts the
// leading code/model-designation run and moves the rest into `description`.
const CODEISH = /^[A-Z0-9][A-Z0-9/.-]*$/
const SLASH_CODE = /^[A-Z]{2,}\/[A-Za-z][A-Za-z0-9-]*$/

function splitTitle(rawName: string, existingDescription: string | null): { name: string; description: string } | null {
  const name = rawName.trim().replace(/^\$+\s*/, '')
  const words = name.split(/\s+/)

  let i = 0
  while (i < words.length && (CODEISH.test(words[i]) || SLASH_CODE.test(words[i]))) {
    i++
  }
  if (i === 0 || i === words.length) return null

  const nameWords = words.slice(0, i).filter((w, idx, arr) => idx === 0 || w !== arr[idx - 1])
  const newName = nameWords.join(' ')
  const extracted = words.slice(i).join(' ').trim()
  if (!extracted) return null

  const existing = existingDescription?.trim()
  if (!existing) return { name: newName, description: extracted }

  const sep = /[.!?]$/.test(extracted) ? ' ' : '. '
  return { name: newName, description: extracted + sep + existing }
}

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const products = await prisma.product.findMany({
    where: { kind: 'COMPLETE_MODEL' },
    select: { id: true, sku: true, name: true, description: true },
  })

  let changed = 0
  let unchanged = 0

  for (const p of products) {
    const result = splitTitle(p.name, p.description)
    if (!result) {
      unchanged++
      continue
    }
    console.log(`[${p.sku || '(sem sku)'}]`)
    console.log(`  antes: ${p.name}`)
    console.log(`  nome:  ${result.name}`)
    console.log(`  desc:  ${result.description}`)
    console.log()
    if (!DRY_RUN) {
      await prisma.product.update({
        where: { id: p.id },
        data: { name: result.name, description: result.description },
      })
    }
    changed++
  }

  console.log(`Modelos completos: ${products.length}`)
  console.log(`Títulos ajustados: ${changed}`)
  console.log(`Sem alteração: ${unchanged}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

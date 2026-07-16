import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PREDEFINED_SECTORS } from '@prodelphusplus/shared'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  let created = 0
  for (const name of PREDEFINED_SECTORS) {
    const result = await prisma.sector.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    if (result.createdAt.getTime() > Date.now() - 5000) created++
  }
  const total = await prisma.sector.count()
  console.log(`setores predefinidos garantidos, total no banco: ${total}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

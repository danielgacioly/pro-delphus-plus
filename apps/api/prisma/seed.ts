import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@prodelphus.com'
  const name = process.env.ADMIN_SEED_NAME ?? 'Administrador'
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'troque-esta-senha'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Usuário admin já existe: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: { name, email, passwordHash, role: 'ADMIN' },
  })

  console.log(`Usuário admin criado: ${email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

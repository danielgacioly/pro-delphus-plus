import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@prodelphus.com'
  const name = process.env.ADMIN_SEED_NAME ?? 'Administrador'
  // Sem default: uma senha conhecida no código viraria a porta de entrada de
  // qualquer instalação que rodasse o seed sem configurar o .env.
  const password = process.env.ADMIN_SEED_PASSWORD
  if (!password || password.length < 10) {
    console.error('Defina ADMIN_SEED_PASSWORD no .env (mínimo 10 caracteres) antes de rodar o seed.')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Usuário admin já existe: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  // `status` default é PENDING e o login recusa PENDING — sem marcar APPROVED
  // aqui, a primeira conta de uma instalação nova nasceria trancada e não
  // haveria admin para aprovar ninguém.
  await prisma.user.create({
    data: { name, email, passwordHash, role: 'ADMIN', status: 'APPROVED' },
  })

  console.log(`Usuário admin criado: ${email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

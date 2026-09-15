import { prisma } from './prisma.js'
import { toClientDTO } from './dto.js'

function productSummary(p: {
  id: string
  sku: string
  name: string
  kind: string
  sectors: string[]
  priceBRL: unknown
  priceUSD: unknown
  priceUSDDistributor: unknown
  priceEUR: unknown
}) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    kind: p.kind,
    sectors: p.sectors,
    priceBRL: p.priceBRL?.toString() ?? null,
    priceUSD: p.priceUSD?.toString() ?? null,
    priceUSDDistributor: p.priceUSDDistributor?.toString() ?? null,
    priceEUR: p.priceEUR?.toString() ?? null,
  }
}

export async function buscarProdutos(args: { setores?: string[]; texto?: string }) {
  const { setores, texto } = args
  const products = await prisma.product.findMany({
    where: {
      active: true,
      AND: [
        setores && setores.length > 0 ? { sectors: { hasSome: setores } } : {},
        texto
          ? {
              OR: [
                { name: { contains: texto, mode: 'insensitive' } },
                { description: { contains: texto, mode: 'insensitive' } },
                { descriptionPt: { contains: texto, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    take: 15,
    orderBy: { name: 'asc' },
  })
  return products.map(productSummary)
}

export async function listarClientes(args: { filtro?: string; setor?: string; emAtendimento?: boolean }) {
  const { filtro, setor, emAtendimento } = args
  const clients = await prisma.client.findMany({
    where: {
      active: true,
      AND: [
        filtro
          ? { OR: [{ name: { contains: filtro, mode: 'insensitive' } }, { institution: { contains: filtro, mode: 'insensitive' } }] }
          : {},
        setor ? { sectors: { has: setor } } : {},
        emAtendimento !== undefined ? { inService: emAtendimento } : {},
      ],
    },
    take: 20,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function buscarCliente(args: { nome: string }) {
  const clients = await prisma.client.findMany({
    where: { name: { contains: args.nome, mode: 'insensitive' } },
    take: 5,
    orderBy: { name: 'asc' },
  })
  return clients.map((c) => toClientDTO(c))
}

export async function listarSetores() {
  return prisma.sector.findMany({ select: { name: true, namePt: true }, orderBy: { name: 'asc' } })
}

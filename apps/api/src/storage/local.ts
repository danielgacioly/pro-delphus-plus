import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import { env } from '../lib/env.js'

const uploadsDir = path.resolve(env.UPLOADS_DIR)
fs.mkdirSync(uploadsDir, { recursive: true })

/**
 * Só entram os tipos que o sistema de fato usa: foto de produto, assinatura,
 * e digitalização de documento (PDF/imagem) em brochura, AWB, boleto e NF.
 *
 * O que está fora da lista é o ponto importante: `.html`, `.svg` e afins são
 * servidos de volta pelo /uploads na MESMA origem da API, e o navegador os
 * executa. Um arquivo desses, aberto por quem tem sessão, roda script no
 * contexto da API e consegue trocar o cookie por um accessToken via
 * /api/auth/refresh. SVG fica de fora justamente por isso, mesmo sendo
 * `image/*` — ele carrega <script> dentro.
 */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
  'application/pdf',
])
const ALLOWED_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.tif', '.tiff', '.bmp', '.pdf',
])

export class UnsupportedFileTypeError extends Error {
  status = 415
  constructor(detail: string) {
    super(`Tipo de arquivo não aceito (${detail}). Envie imagem (JPG, PNG, WEBP, HEIC) ou PDF.`)
  }
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      // Extensão normalizada: o nome final é sempre uuid + extensão da lista
      // acima, então nada de `.php`/`.html` chega ao disco nem por engano.
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new UnsupportedFileTypeError(file.mimetype))
    if (!ALLOWED_EXT.has(ext)) return cb(new UnsupportedFileTypeError(ext || 'sem extensão'))
    cb(null, true)
  },
})

export function publicUrlFor(filename: string) {
  return `/uploads/${filename}`
}

// Documentos comerciais têm nome determinístico pelo número (Order-2801-
// Invoice.pdf). Como o número é reaproveitado quando um pedido/orçamento é
// excluído, o documento do cliente novo cai exatamente na mesma URL do
// anterior — e o navegador serve a cópia em cache, mostrando o cliente
// errado mesmo com o arquivo correto no disco. O `?v=` muda a cada geração,
// então a URL nunca se repete; `express.static` ignora a query e o nome do
// arquivo baixado continua limpo, sem o token.
export function versionedUrlFor(filename: string) {
  return `/uploads/${filename}?v=${Date.now().toString(36)}`
}

// URLs guardadas no banco podem carregar o `?v=` acima — o disco não.
export function storageFilename(url: string) {
  return path.basename(url.split('?')[0])
}

export function deleteStoredFile(url: string) {
  const filePath = path.join(uploadsDir, storageFilename(url))
  fs.rm(filePath, { force: true }, (err) => {
    if (err) console.error(`Falha ao excluir arquivo órfão ${filePath}:`, err)
  })
}

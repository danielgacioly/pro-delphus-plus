import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import { env } from '../lib/env.js'

const uploadsDir = path.resolve(env.UPLOADS_DIR)
fs.mkdirSync(uploadsDir, { recursive: true })

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
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

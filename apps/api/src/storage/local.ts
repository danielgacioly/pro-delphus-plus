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

export function deleteStoredFile(url: string) {
  const filename = path.basename(url)
  const filePath = path.join(uploadsDir, filename)
  fs.rm(filePath, { force: true }, (err) => {
    if (err) console.error(`Falha ao excluir arquivo órfão ${filePath}:`, err)
  })
}

import nodemailer from 'nodemailer'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env

const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const subject = 'Redefinição de senha — Pro Delphus+'
  const html = `
    <p>Foi solicitada a redefinição de senha da sua conta no Pro Delphus+.</p>
    <p><a href="${resetUrl}">Clique aqui para escolher uma nova senha</a></p>
    <p>Esse link expira em 1 hora. Se você não pediu essa redefinição, ignore este e-mail.</p>
  `

  if (!transporter) {
    // No SMTP configured (e.g. local dev) — log the link instead of failing silently.
    console.log(`[mailer] SMTP não configurado. Link de redefinição para ${to}: ${resetUrl}`)
    return
  }

  await transporter.sendMail({ from: SMTP_FROM ?? SMTP_USER, to, subject, html })
}

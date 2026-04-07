import { Resend } from 'resend'
import { render } from '@react-email/render'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import OtpEmail from '@/emails/otp-email'
import LoginSuccessEmail from '@/emails/login-success-email'
import AffiliationCompletedEmail from '@/emails/affiliation-completed-email'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Administración Segura Web <onboarding@resend.dev>'

interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

interface EmailOptions {
  to: string
  cc?: string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export async function sendEmail({ to, cc, subject, html, replyTo, attachments }: EmailOptions) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    cc: cc?.length ? cc : undefined,
    subject,
    html,
    replyTo,
    attachments: attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }

  return data
}

/**
 * Initialize S3 Client for Cloudflare R2
 */
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

/**
 * Fetch a file from R2 storage as a Buffer
 */
export async function fetchR2FileAsBuffer(s3Key: string): Promise<Buffer> {
  const r2Client = getR2Client()
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: s3Key,
  })

  const response = await r2Client.send(command)

  if (!response.Body) {
    throw new Error(`No body returned for R2 key: ${s3Key}`)
  }

  const chunks: Uint8Array[] = []
  const stream = response.Body as AsyncIterable<Uint8Array>
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Send affiliation completed email with attachments
 */
export async function sendAffiliationCompletedEmail({
  to,
  cc,
  subject,
  emailBody,
  hasAttachments,
  attachmentFiles,
}: {
  to: string
  cc?: string[]
  subject: string
  emailBody: string
  hasAttachments?: boolean
  attachmentFiles?: { fileName: string; s3Key: string; fileType: string }[]
}) {
  const html = await render(
    AffiliationCompletedEmail({
      emailBody,
      hasAttachments,
    })
  )

  let attachments: EmailAttachment[] | undefined
  if (attachmentFiles?.length) {
    attachments = await Promise.all(
      attachmentFiles.map(async (file) => ({
        filename: file.fileName,
        content: await fetchR2FileAsBuffer(file.s3Key),
        contentType: file.fileType,
      }))
    )
  }

  return { html, result: await sendEmail({ to, cc, subject, html, attachments }) }
}

export function generateContactEmailHtml({
  fullName,
  email,
  phone,
  subject,
  message,
}: {
  fullName: string
  email: string
  phone: string
  subject: string
  message: string
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #00A86B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-top: 5px; }
        .message-box { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #00A86B; }
        .footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Nuevo Mensaje de Contacto</h1>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Nombre:</div>
            <div class="value">${fullName}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value"><a href="mailto:${email}">${email}</a></div>
          </div>
          <div class="field">
            <div class="label">Teléfono:</div>
            <div class="value"><a href="tel:${phone}">${phone}</a></div>
          </div>
          <div class="field">
            <div class="label">Asunto:</div>
            <div class="value">${subject}</div>
          </div>
          <div class="field">
            <div class="label">Mensaje:</div>
            <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
          </div>
        </div>
        <div class="footer">
          Este mensaje fue enviado desde el formulario de contacto de administracionsegura.com
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Send OTP email using React Email template
 */
export async function sendOtpEmail({
  to,
  code,
  expirationMinutes = 5,
}: {
  to: string
  code: string
  expirationMinutes?: number
}) {
  const html = await render(OtpEmail({ code, expirationMinutes }))

  return sendEmail({
    to,
    subject: 'Tu codigo de acceso - Administracion Segura',
    html,
  })
}

/**
 * Send login success notification using React Email template
 */
export async function sendLoginSuccessEmail({
  to,
  userName,
  userEmail,
  loginTimestamp,
  ipAddress,
  userAgent,
}: {
  to: string
  userName: string
  userEmail: string
  loginTimestamp: Date
  ipAddress?: string
  userAgent?: string
}) {
  const html = await render(
    LoginSuccessEmail({
      userName,
      userEmail,
      loginTimestamp,
      ipAddress,
      userAgent,
    })
  )

  return sendEmail({
    to,
    subject: 'Inicio de sesion exitoso - Administracion Segura',
    html,
  })
}

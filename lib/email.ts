import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

interface EmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, replyTo }: EmailOptions) {
  const mailOptions = {
    from: `"Administración Segura Web" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    replyTo,
  }

  return transporter.sendMail(mailOptions)
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

import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import OtpEmail from '@/emails/otp-email'
import LoginSuccessEmail from '@/emails/login-success-email'

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

/**
 * @deprecated Use sendOtpEmail instead - migrated to React Email
 * Legacy function kept for backwards compatibility
 */
export function generateOtpEmailHtml({
  code,
  expirationMinutes,
}: {
  code: string
  expirationMinutes: number
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #00A86B 0%, #008556 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 10px 0 0;
          opacity: 0.95;
          font-size: 14px;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 16px;
          color: #333;
          margin-bottom: 20px;
        }
        .otp-code {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: 12px;
          color: #00A86B;
          text-align: center;
          padding: 30px 20px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          border: 3px dashed #00A86B;
          margin: 30px 0;
          font-family: 'Courier New', monospace;
        }
        .expiry {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: -15px;
          margin-bottom: 30px;
        }
        .expiry strong {
          color: #d9534f;
          font-weight: 600;
        }
        .warning {
          background: #fff3cd;
          border-left: 5px solid #ffc107;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .warning strong {
          color: #856404;
          font-size: 15px;
        }
        .warning ul {
          margin: 12px 0 0;
          padding-left: 25px;
          color: #856404;
        }
        .warning li {
          margin: 8px 0;
        }
        .support {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
          color: #666;
          font-size: 14px;
          text-align: center;
        }
        .footer {
          background: #f8f9fa;
          text-align: center;
          padding: 20px;
          color: #6c757d;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Código de Acceso</h1>
          <p>Administración Segura</p>
        </div>

        <div class="content">
          <p class="greeting">Hola,</p>
          <p>Has solicitado acceso al panel administrativo. Usa el siguiente código para iniciar sesión:</p>

          <div class="otp-code">${code}</div>

          <p class="expiry">
            Este código expirará en <strong>${expirationMinutes} minutos</strong>
          </p>

          <div class="warning">
            <strong>⚠️ Importante - Seguridad</strong>
            <ul>
              <li><strong>No compartas</strong> este código con nadie</li>
              <li>Nuestro equipo <strong>nunca te pedirá</strong> este código</li>
              <li>Si no solicitaste este código, <strong>ignora este correo</strong></li>
              <li>Cada código solo puede usarse <strong>una vez</strong></li>
            </ul>
          </div>

          <p class="support">
            Si tienes problemas para iniciar sesión o necesitas ayuda, <br>
            contacta a nuestro equipo de soporte.
          </p>
        </div>

        <div class="footer">
          © ${new Date().getFullYear()} Administración Segura. Todos los derechos reservados.<br>
          Este es un correo automático, por favor no respondas a este mensaje.
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
  try {
    const html = await render(OtpEmail({ code, expirationMinutes }))

    return sendEmail({
      to,
      subject: 'Tu código de acceso - Administración Segura',
      html,
    })
  } catch (renderError) {
    console.error('[Email] React Email render failed, using fallback:', renderError)
    // Fallback to old template
    return sendEmail({
      to,
      subject: 'Tu código de acceso - Administración Segura',
      html: generateOtpEmailHtml({ code, expirationMinutes }),
    })
  }
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
  try {
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
      subject: '✅ Inicio de sesión exitoso - Administración Segura',
      html,
    })
  } catch (renderError) {
    console.error('[Email] Login success email render failed:', renderError)
    throw renderError
  }
}

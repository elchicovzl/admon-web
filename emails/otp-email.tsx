import { Section, Text } from '@react-email/components'
import { EmailLayout } from './_components/email-layout'
import { EmailHeader } from './_components/email-header'
import { EmailFooter } from './_components/email-footer'

interface OtpEmailProps {
  code: string
  expirationMinutes: number
}

export function OtpEmail({ code, expirationMinutes }: OtpEmailProps) {
  return (
    <EmailLayout previewText={`Tu código de acceso es ${code}`}>
      <EmailHeader title="🔐 Código de Acceso" subtitle="Administración Segura" />

      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hola,</Text>
        <Text style={introStyle}>
          Has solicitado acceso al panel administrativo. Usa el siguiente código para iniciar sesión:
        </Text>

        <Section style={otpContainerStyle}>
          <Text style={otpCodeStyle}>{code}</Text>
        </Section>

        <Text style={expiryStyle}>
          Este código expirará en <strong style={expiryBoldStyle}>{expirationMinutes} minutos</strong>
        </Text>

        <Section style={warningBoxStyle}>
          <Text style={warningHeaderStyle}>⚠️ Importante - Seguridad</Text>
          <ul style={warningListStyle}>
            <li style={warningItemStyle}>
              <strong>No compartas</strong> este código con nadie
            </li>
            <li style={warningItemStyle}>
              Nuestro equipo <strong>nunca te pedirá</strong> este código
            </li>
            <li style={warningItemStyle}>
              Si no solicitaste este código, <strong>ignora este correo</strong>
            </li>
            <li style={warningItemStyle}>
              Cada código solo puede usarse <strong>una vez</strong>
            </li>
          </ul>
        </Section>

        <Text style={supportStyle}>
          Si tienes problemas para iniciar sesión o necesitas ayuda, contacta a nuestro equipo de soporte.
        </Text>
      </Section>

      <EmailFooter />
    </EmailLayout>
  )
}

export default OtpEmail

const contentStyle = {
  padding: '40px 30px',
}

const greetingStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '16px',
  color: '#333',
  marginBottom: '20px',
}

const introStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#666',
  lineHeight: '1.6',
  marginBottom: '30px',
}

const otpContainerStyle = {
  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
  border: '3px dashed #F1AD32',
  borderRadius: '12px',
  padding: '30px 20px',
  textAlign: 'center' as const,
  margin: '30px 0',
}

const otpCodeStyle = {
  fontFamily: "'Courier New', monospace",
  fontSize: '48px',
  fontWeight: 700,
  letterSpacing: '12px',
  color: '#F1AD32',
  margin: 0,
}

const expiryStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#666',
  textAlign: 'center' as const,
  marginTop: '-15px',
  marginBottom: '30px',
}

const expiryBoldStyle = {
  color: '#d9534f',
  fontWeight: 600,
}

const warningBoxStyle = {
  backgroundColor: '#fff3cd',
  borderLeft: '5px solid #ffc107',
  borderRadius: '8px',
  padding: '20px',
  margin: '25px 0',
}

const warningHeaderStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#856404',
  marginBottom: '12px',
}

const warningListStyle = {
  margin: '12px 0 0',
  paddingLeft: '25px',
  color: '#856404',
}

const warningItemStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  marginBottom: '8px',
}

const supportStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#666',
  textAlign: 'center' as const,
  marginTop: '30px',
  paddingTop: '20px',
  borderTop: '1px solid #e9ecef',
  lineHeight: '1.6',
}

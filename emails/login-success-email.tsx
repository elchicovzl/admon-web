import { Section, Text } from '@react-email/components'
import { EmailLayout } from './_components/email-layout'
import { EmailHeader } from './_components/email-header'
import { EmailFooter } from './_components/email-footer'

interface LoginSuccessEmailProps {
  userName: string
  userEmail: string
  loginTimestamp: Date
  ipAddress?: string
  userAgent?: string
}

export function LoginSuccessEmail({
  userName,
  userEmail,
  loginTimestamp,
  ipAddress,
  userAgent,
}: LoginSuccessEmailProps) {
  const formattedDate = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(loginTimestamp)

  return (
    <EmailLayout previewText="Inicio de sesión exitoso en tu cuenta">
      <EmailHeader
        title="✅ Inicio de Sesión Exitoso"
        subtitle="Notificación de Seguridad"
      />

      <Section style={contentStyle}>
        <Text style={greetingStyle}>Hola {userName},</Text>
        <Text style={messageStyle}>
          Se ha iniciado sesión en tu cuenta exitosamente.
        </Text>

        <Section style={detailsBoxStyle}>
          <Text style={detailsHeaderStyle}>📋 Detalles del acceso</Text>
          <table style={detailsTableStyle}>
            <tbody>
              <tr>
                <td style={detailsLabelStyle}>Fecha y hora:</td>
                <td style={detailsValueStyle}>{formattedDate}</td>
              </tr>
              <tr>
                <td style={detailsLabelStyle}>Email:</td>
                <td style={detailsValueStyle}>{userEmail}</td>
              </tr>
              {ipAddress && (
                <tr>
                  <td style={detailsLabelStyle}>Dirección IP:</td>
                  <td style={detailsValueStyle}>{ipAddress}</td>
                </tr>
              )}
              {userAgent && (
                <tr>
                  <td style={detailsLabelStyle}>Dispositivo:</td>
                  <td style={detailsValueStyle}>{userAgent}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        <Section style={securityBoxStyle}>
          <Text style={securityHeaderStyle}>🔒 Seguridad</Text>
          <Text style={securityTextStyle}>
            Si <strong>no fuiste tú</strong> quien inició sesión, tu cuenta podría estar comprometida.
          </Text>
          <Text style={securityTextStyle}>
            <strong>Contacta inmediatamente</strong> a nuestro equipo de soporte.
          </Text>
        </Section>

        <Section style={tipsBoxStyle}>
          <Text style={tipsHeaderStyle}>💡 Consejos de Seguridad:</Text>
          <ul style={tipsListStyle}>
            <li style={tipItemStyle}>
              Nunca compartas tu código OTP con nadie
            </li>
            <li style={tipItemStyle}>
              Cierra sesión al terminar de usar el sistema
            </li>
            <li style={tipItemStyle}>
              Usa una conexión segura al acceder al panel
            </li>
          </ul>
        </Section>
      </Section>

      <EmailFooter />
    </EmailLayout>
  )
}

export default LoginSuccessEmail

const contentStyle = {
  padding: '40px 30px',
}

const greetingStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '16px',
  color: '#333',
  marginBottom: '10px',
}

const messageStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#666',
  lineHeight: '1.6',
  marginBottom: '30px',
}

const detailsBoxStyle = {
  backgroundColor: '#e7f3ff',
  borderLeft: '5px solid #2563EB',
  borderRadius: '8px',
  padding: '20px',
  margin: '25px 0',
}

const detailsHeaderStyle = {
  fontFamily: "'Figtree', Arial, sans-serif",
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#2563EB',
  marginBottom: '15px',
}

const detailsTableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const detailsLabelStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#2563EB',
  padding: '8px 0',
  verticalAlign: 'top' as const,
  width: '40%',
}

const detailsValueStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#333',
  padding: '8px 0',
}

const securityBoxStyle = {
  backgroundColor: '#fff4e6',
  borderLeft: '5px solid #F1AD32',
  borderRadius: '8px',
  padding: '20px',
  margin: '25px 0',
}

const securityHeaderStyle = {
  fontFamily: "'Figtree', Arial, sans-serif",
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#F1AD32',
  marginBottom: '12px',
}

const securityTextStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#856404',
  lineHeight: '1.6',
  marginBottom: '8px',
}

const tipsBoxStyle = {
  marginTop: '25px',
  paddingTop: '20px',
  borderTop: '1px solid #e9ecef',
}

const tipsHeaderStyle = {
  fontFamily: "'Figtree', Arial, sans-serif",
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '12px',
}

const tipsListStyle = {
  margin: '12px 0 0',
  paddingLeft: '25px',
  color: '#666',
}

const tipItemStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  marginBottom: '8px',
  lineHeight: '1.5',
}

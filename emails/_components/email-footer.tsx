import { Section, Text, Hr } from '@react-email/components'

export function EmailFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <>
      <Hr style={separatorStyle} />
      <Section style={footerStyle}>
        <Text style={footerTextStyle}>
          © {currentYear} Administración Segura. Todos los derechos reservados.
        </Text>
        <Text style={footerTextStyle}>
          Este es un correo automático, por favor no respondas a este mensaje.
        </Text>
      </Section>
    </>
  )
}

const separatorStyle = {
  borderColor: '#e9ecef',
  margin: '0',
}

const footerStyle = {
  backgroundColor: '#f8f9fa',
  padding: '20px',
  textAlign: 'center' as const,
}

const footerTextStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '12px',
  color: '#6c757d',
  margin: '5px 0',
}

import { Section, Img, Heading, Text } from '@react-email/components'

interface EmailHeaderProps {
  title: string
  subtitle?: string
}

const BASE_URL = process.env.AUTH_URL ?? 'https://administracionsegura.co'

export function EmailHeader({ title, subtitle }: EmailHeaderProps) {
  return (
    <Section style={headerStyle}>
      <Img
        src={`${BASE_URL}/images/logoadmon2.webp`}
        alt="Administración Segura"
        width="90"
        style={logoStyle}
      />
      <Heading style={titleStyle}>{title}</Heading>
      {subtitle && <Text style={subtitleStyle}>{subtitle}</Text>}
    </Section>
  )
}

const headerStyle = {
  background: '#020617',
  color: '#ffffff',
  padding: '40px 30px',
  textAlign: 'center' as const,
}

const logoStyle = {
  margin: '0 auto 20px',
  display: 'block',
}

const titleStyle = {
  fontFamily: "'Figtree', Arial, sans-serif",
  fontSize: '24px',
  fontWeight: 600,
  margin: '20px 0 0',
  color: '#ffffff',
}

const subtitleStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  margin: '10px 0 0',
  opacity: 0.95,
  color: '#ffffff',
}

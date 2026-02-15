import {
  Html,
  Head,
  Body,
  Container,
  Font,
  Preview,
} from '@react-email/components'

interface EmailLayoutProps {
  children: React.ReactNode
  previewText?: string
}

export function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head>
        <Font
          fontFamily="Figtree"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&display=swap',
            format: 'woff2',
          }}
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
            format: 'woff2',
          }}
        />
      </Head>
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>{children}</Container>
      </Body>
    </Html>
  )
}

const bodyStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  backgroundColor: '#f5f5f5',
  margin: 0,
  padding: '40px 20px',
}

const containerStyle = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
}

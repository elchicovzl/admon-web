import { Section, Text } from '@react-email/components'
import { EmailLayout } from './_components/email-layout'
import { EmailHeader } from './_components/email-header'
import { EmailFooter } from './_components/email-footer'

interface AffiliationCompletedEmailProps {
  emailBody: string
  hasAttachments?: boolean
}

export function AffiliationCompletedEmail({
  emailBody,
  hasAttachments,
}: AffiliationCompletedEmailProps) {
  return (
    <EmailLayout previewText="Certificados de afiliación">
      <EmailHeader
        title="Afiliación Completada"
        subtitle="Certificados de Afiliación"
      />

      <Section style={contentStyle}>
        <Text style={bodyStyle}>
          {emailBody}
        </Text>

        {hasAttachments && (
          <Section style={attachmentsNoteStyle}>
            <Text style={attachmentsNoteTextStyle}>
              Se adjuntan los documentos soporte de los trámites realizados.
            </Text>
          </Section>
        )}
      </Section>

      <EmailFooter />
    </EmailLayout>
  )
}

export default AffiliationCompletedEmail

const contentStyle = {
  padding: '40px 30px',
}

const bodyStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#333',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap' as const,
}

const attachmentsNoteStyle = {
  margin: '25px 0 0',
  padding: '15px 20px',
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  borderLeft: '5px solid #16a34a',
}

const attachmentsNoteTextStyle = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '14px',
  color: '#166534',
  lineHeight: '1.5',
  margin: '0',
}

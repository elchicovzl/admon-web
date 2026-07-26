/**
 * Counterparty card for any finances document detail page.
 *
 * Renders the embedded contact object from the document — NOT a lookup of
 * our own `Client` model. The two are kept decoupled.
 *
 * The contact shape is identical across /invoices, /estimates and /bills
 * (verified against the Alegra API — extra fields like `fax`, `mobile`,
 * `phoneSecondary` pass through thanks to `InvoiceClientSchema.passthrough()`).
 * Only the LABEL differs: a sales document has a cliente, a purchase document
 * has a proveedor. Hence the `title` prop rather than a duplicated component.
 *
 * If the schemas ever diverge, this will need a union type or a split.
 */

import { Mail, Phone, MapPin, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Structural minimum this card needs, declared here rather than importing a
 * Zod-inferred type.
 *
 * Clients and providers are the same contact in Alegra but their schemas
 * differ in optionality (`identification` is nullable-required on clients,
 * fully optional on providers). Depending on one concrete inferred type made
 * the other fail to assign for a reason that has nothing to do with
 * rendering. The component states its own contract; both shapes satisfy it.
 */
export interface ContactCardData {
  name: string
  identification?: string | null
  email?: string | null
  phonePrimary?: string | null
  address?: {
    address?: string | null
    city?: string | null
    country?: string | null
  } | null
}

interface ClientCardProps {
  client: ContactCardData
  /** Card heading. Defaults to "Cliente"; pass "Proveedor" on bills. */
  title?: string
}

export function ClientCard({ client, title = 'Cliente' }: ClientCardProps) {
  const address = client.address
  const addressLine = address
    ? [address.address, address.city, address.country].filter(Boolean).join(', ')
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-base font-semibold">{client.name}</p>
        {client.identification && (
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{client.identification}</span>
          </p>
        )}
        <dl className="mt-3 space-y-1.5 text-sm">
          {client.email && (
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <a
                href={`mailto:${client.email}`}
                className="text-foreground hover:underline"
              >
                {client.email}
              </a>
            </div>
          )}
          {client.phonePrimary && (
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <a
                href={`tel:${client.phonePrimary}`}
                className="text-foreground hover:underline"
              >
                {client.phonePrimary}
              </a>
            </div>
          )}
          {addressLine && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{addressLine}</span>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}
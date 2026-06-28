/**
 * Client card on the invoice detail page.
 *
 * Renders the embedded client object from the invoice — NOT a lookup of
 * our own `Client` model. The two are kept decoupled in V1.
 */

import { Mail, Phone, MapPin, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InvoiceClient } from '@/lib/alegra/types'

interface ClientCardProps {
  client: InvoiceClient
}

export function ClientCard({ client }: ClientCardProps) {
  const address = client.address
  const addressLine = address
    ? [address.address, address.city, address.country].filter(Boolean).join(', ')
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Cliente
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

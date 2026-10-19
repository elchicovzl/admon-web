import type { Metadata } from 'next'
import { MessageCircle } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'WhatsApp | Dashboard',
}

// Placeholder until the shared inbox lands (M2). Access is enforced by
// app/dashboard/whatsapp/layout.tsx.
export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Bandeja compartida de conversaciones con clientes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Próximamente
          </CardTitle>
          <CardDescription>
            La bandeja de WhatsApp estará disponible muy pronto.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tienes acceso al módulo. Cuando la bandeja esté lista, aquí podrás ver
          y responder las conversaciones.
        </CardContent>
      </Card>
    </div>
  )
}

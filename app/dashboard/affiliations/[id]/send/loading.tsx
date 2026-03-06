import { Loader2, Mail } from 'lucide-react'

export default function SendAffiliationLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <Mail className="h-12 w-12 text-muted-foreground/30" />
        <Loader2 className="h-6 w-6 animate-spin text-primary absolute -bottom-1 -right-1" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-medium">Preparando correo</p>
        <p className="text-sm text-muted-foreground">
          Cargando datos del cliente y documentos...
        </p>
      </div>
    </div>
  )
}

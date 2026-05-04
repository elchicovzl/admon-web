'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Phone, FileText, ExternalLink, IdCard, Briefcase, Calendar } from 'lucide-react'
import { getClientById } from '@/lib/actions/client.actions'
import type { ClientWithRelations } from '@/lib/types/client.types'

interface EmployeeDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
}

function formatUtcDate(date: Date | string): string {
  const d = new Date(date)
  const localized = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return format(localized, 'dd MMM yyyy', { locale: es })
}

export function EmployeeDetailSheet({ open, onOpenChange, employeeId }: EmployeeDetailSheetProps) {
  const [employee, setEmployee] = useState<ClientWithRelations | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && employeeId) {
      loadEmployee()
    }
  }, [open, employeeId])

  async function loadEmployee() {
    setLoading(true)
    try {
      const result = await getClientById(employeeId)
      if (result.success && result.data) {
        setEmployee(result.data)
      }
    } catch (error) {
      console.error('Error loading employee:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto p-6">
        <SheetHeader>
          <SheetTitle>{employee?.fullName || 'Empleado'}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : employee ? (
          <div className="space-y-5 mt-4">
            {/* Personal Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Información Personal</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IdCard className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{employee.identificationType}</span>
                </div>
                <div className="font-medium">{employee.identificationNumber}</div>

                {employee.email && (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Email</span>
                    </div>
                    <div className="font-medium truncate">{employee.email}</div>
                  </>
                )}

                {employee.phone && (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Teléfono</span>
                    </div>
                    <div className="font-medium">{employee.phone}</div>
                  </>
                )}
              </div>
            </div>

            {/* Additional Info */}
            {employee.additionalInfo && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Información Laboral</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {employee.additionalInfo.actividadComercial && (
                      <>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>Actividad</span>
                        </div>
                        <div className="font-medium">{employee.additionalInfo.actividadComercial}</div>
                      </>
                    )}

                    {employee.additionalInfo.salario != null && (
                      <>
                        <div className="text-muted-foreground">Salario</div>
                        <div className="font-medium">
                          ${employee.additionalInfo.salario.toLocaleString('es-CO')}
                        </div>
                      </>
                    )}

                    {employee.additionalInfo.fechaIngreso && (
                      <>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>Novedad de Ingreso</span>
                        </div>
                        <div className="font-medium">
                          {formatUtcDate(employee.additionalInfo.fechaIngreso)}
                        </div>
                      </>
                    )}

                    {employee.additionalInfo.fechaRetiro && (
                      <>
                        <div className="text-muted-foreground">Novedad de Retiro</div>
                        <div className="font-medium">
                          {formatUtcDate(employee.additionalInfo.fechaRetiro)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Documents */}
            {employee.documents && employee.documents.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos ({employee.documents.length})
                  </h4>
                  <div className="space-y-2">
                    {employee.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-md border p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {(doc.fileSize / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          asChild
                        >
                          <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

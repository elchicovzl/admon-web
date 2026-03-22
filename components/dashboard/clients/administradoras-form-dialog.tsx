'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { getAdministradoras, updateClientAdministradoras } from '@/lib/actions/client.actions'
import type { AdministradoraInfo } from '@/lib/types/client.types'

const NO_APLICA_VALUE = '__no_aplica__'

const administradorasFormSchema = z.object({
  epsId: z.string().nullable(),
  afpId: z.string().nullable(),
  arlId: z.string().nullable(),
  arlRiskLevel: z.number().min(1).max(5).nullable(),
  ccfId: z.string().nullable(),
})

type AdministradorasFormInput = z.infer<typeof administradorasFormSchema>

interface AdministradorasGrouped {
  EPS: AdministradoraInfo[]
  AFP: AdministradoraInfo[]
  ARL: AdministradoraInfo[]
  CCF: AdministradoraInfo[]
}

interface AdministradorasFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  initialData: {
    eps?: AdministradoraInfo | null
    afp?: AdministradoraInfo | null
    arl?: AdministradoraInfo | null
    arlRiskLevel?: number | null
    ccf?: AdministradoraInfo | null
  }
  onUpdated: () => void
}

function toSelectOptions(items: AdministradoraInfo[]) {
  return [
    { value: NO_APLICA_VALUE, label: 'No aplica' },
    ...items.map((adm) => ({
      value: adm.id,
      label: `${adm.name} (${adm.code})`,
    })),
  ]
}

export function AdministradorasFormDialog({
  open,
  onOpenChange,
  clientId,
  initialData,
  onUpdated,
}: AdministradorasFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [catalogo, setCatalogo] = useState<AdministradorasGrouped | null>(null)

  const form = useForm<AdministradorasFormInput>({
    resolver: zodResolver(administradorasFormSchema),
    defaultValues: {
      epsId: initialData.eps?.id ?? null,
      afpId: initialData.afp?.id ?? null,
      arlId: initialData.arl?.id ?? null,
      arlRiskLevel: initialData.arlRiskLevel ?? null,
      ccfId: initialData.ccf?.id ?? null,
    },
  })

  const watchArlId = form.watch('arlId')

  useEffect(() => {
    if (open) {
      form.reset({
        epsId: initialData.eps?.id ?? null,
        afpId: initialData.afp?.id ?? null,
        arlId: initialData.arl?.id ?? null,
        arlRiskLevel: initialData.arlRiskLevel ?? null,
        ccfId: initialData.ccf?.id ?? null,
      })
      getAdministradoras().then((result) => {
        if (result.success && result.data) {
          setCatalogo(result.data as AdministradorasGrouped)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(data: AdministradorasFormInput) {
    setIsLoading(true)
    try {
      const result = await updateClientAdministradoras(clientId, {
        epsId: data.epsId,
        afpId: data.afpId,
        arlId: data.arlId,
        arlRiskLevel: data.arlId ? data.arlRiskLevel : null,
        ccfId: data.ccfId,
      })
      if (result.success) {
        toast.success(result.message || 'Administradoras actualizadas')
        onUpdated()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al actualizar')
      }
    } catch (error) {
      console.error('Update administradoras error:', error)
      toast.error('Error inesperado al actualizar administradoras')
    } finally {
      setIsLoading(false)
    }
  }

  function renderSearchableSelect(
    name: 'epsId' | 'afpId' | 'arlId' | 'ccfId',
    label: string,
    options: AdministradoraInfo[]
  ) {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <SearchableSelect
              options={toSelectOptions(options)}
              value={field.value ?? NO_APLICA_VALUE}
              onValueChange={(val) => field.onChange(val === NO_APLICA_VALUE ? null : val)}
              placeholder="Seleccionar..."
              searchPlaceholder={`Buscar ${label}...`}
              disabled={isLoading}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Administradoras</DialogTitle>
          <DialogDescription>
            Selecciona las administradoras de seguridad social
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {catalogo ? (
              <>
                {renderSearchableSelect('epsId', 'EPS', catalogo.EPS)}
                {renderSearchableSelect('afpId', 'AFP', catalogo.AFP)}
                {renderSearchableSelect('arlId', 'ARL', catalogo.ARL)}
                {watchArlId && watchArlId !== NO_APLICA_VALUE && (
                  <FormField
                    control={form.control}
                    name="arlRiskLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel de Riesgo ARL (1-5)</FormLabel>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <Button
                              key={level}
                              type="button"
                              variant={field.value === level ? 'default' : 'outline'}
                              size="sm"
                              className="w-9 h-9 font-bold"
                              disabled={isLoading}
                              onClick={() => field.onChange(field.value === level ? null : level)}
                            >
                              {level}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {renderSearchableSelect('ccfId', 'CCF', catalogo.CCF)}
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !catalogo}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

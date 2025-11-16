/**
 * Affiliation Create Wizard Component
 * 2-step wizard for creating new affiliations
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AffiliationSubProcessType } from '@prisma/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Check, ChevronRight, ChevronLeft, Key } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getClients } from '@/lib/actions/client.actions'
import { getUsers } from '@/lib/actions'
import { createAffiliation } from '@/lib/actions/affiliation.actions'
import type { SafeClient } from '@/lib/types/client.types'
import type { SafeUser } from '@/lib/types'
import { ClientCredentialsQuickView } from './client-credentials-quick-view'

const createAffiliationFormSchema = z.object({
  clientId: z.string().min(1, 'Debe seleccionar un cliente'),
  subProcesses: z.array(
    z.object({
      type: z.nativeEnum(AffiliationSubProcessType),
      assignedToId: z.string().nullable(),
      assignToSelf: z.boolean(),
    })
  ).min(1, 'Debe seleccionar al menos un sub-proceso'),
})

type CreateAffiliationFormValues = z.infer<typeof createAffiliationFormSchema>

interface AffiliationCreateWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAffiliationCreated?: () => void
  currentUserId?: string
}

export function AffiliationCreateWizard({
  open,
  onOpenChange,
  onAffiliationCreated,
  currentUserId,
}: AffiliationCreateWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<SafeClient[]>([])
  const [managers, setManagers] = useState<SafeUser[]>([])
  const [selectedClient, setSelectedClient] = useState<SafeClient | null>(null)
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)

  const form = useForm<CreateAffiliationFormValues>({
    resolver: zodResolver(createAffiliationFormSchema),
    defaultValues: {
      clientId: '',
      subProcesses: [],
    },
  })

  useEffect(() => {
    if (open) {
      loadClients()
      loadManagers()
    }
  }, [open])

  async function loadClients() {
    try {
      const result = await getClients()
      if (result.success && result.data) {
        setClients(result.data.filter((c) => c.isActive))
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  async function loadManagers() {
    try {
      const result = await getUsers()
      if (result.success && result.data) {
        setManagers(result.data.filter((u) => u.isActive))
      }
    } catch (error) {
      console.error('Error loading managers:', error)
    }
  }

  function handleClientSelect(client: SafeClient) {
    setSelectedClient(client)
    form.setValue('clientId', client.id)
    setComboboxOpen(false)
  }

  function handleNextStep() {
    if (step === 1) {
      if (!form.getValues('clientId')) {
        toast.error('Debe seleccionar un cliente')
        return
      }
      setStep(2)
    }
  }

  function handlePrevStep() {
    setStep(1)
  }

  async function onSubmit(data: CreateAffiliationFormValues) {
    setLoading(true)
    try {
      // Transform data: if assignToSelf is true, use currentUserId
      const transformedSubProcesses = data.subProcesses.map((sp) => ({
        type: sp.type,
        assignedToId: sp.assignToSelf ? currentUserId : sp.assignedToId,
      }))

      const result = await createAffiliation({
        clientId: data.clientId,
        subProcesses: transformedSubProcesses,
      })

      if (result.success && result.data) {
        toast.success('Afiliación creada exitosamente')
        form.reset()
        setStep(1)
        setSelectedClient(null)
        onOpenChange(false)
        onAffiliationCreated?.()
        // Redirect to detail page
        router.push(`/dashboard/affiliations/${result.data.id}`)
      } else {
        toast.error(result.error || 'Error al crear la afiliación')
      }
    } catch (error) {
      console.error('Error creating affiliation:', error)
      toast.error('Error al crear la afiliación')
    } finally {
      setLoading(false)
    }
  }

  const subProcessTypes = [
    { value: AffiliationSubProcessType.ARL, label: 'ARL' },
    { value: AffiliationSubProcessType.EPS, label: 'EPS' },
    { value: AffiliationSubProcessType.AFP, label: 'AFP' },
    { value: AffiliationSubProcessType.CCF, label: 'CCF' },
  ]

  function toggleSubProcess(type: AffiliationSubProcessType) {
    const current = form.getValues('subProcesses')
    const exists = current.find((sp) => sp.type === type)

    if (exists) {
      form.setValue(
        'subProcesses',
        current.filter((sp) => sp.type !== type)
      )
    } else {
      form.setValue('subProcesses', [
        ...current,
        { type, assignedToId: null, assignToSelf: false },
      ])
    }
  }

  function updateSubProcessAssignment(type: AffiliationSubProcessType, assignedToId: string | null, assignToSelf: boolean) {
    const current = form.getValues('subProcesses')
    const updated = current.map((sp) =>
      sp.type === type ? { ...sp, assignedToId, assignToSelf } : sp
    )
    form.setValue('subProcesses', updated)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Crear Nueva Afiliación {step === 1 ? '- Paso 1/2' : '- Paso 2/2'}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? 'Seleccione el cliente para la afiliación'
                : 'Configure los sub-procesos de afiliación'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* STEP 1: SELECT CLIENT */}
              {step === 1 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Cliente *</FormLabel>
                        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {selectedClient
                                  ? selectedClient.fullName
                                  : 'Buscar cliente...'}
                                <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Buscar por nombre, identificación o email..." />
                              <CommandList>
                                <CommandEmpty>No se encontraron clientes</CommandEmpty>
                                <CommandGroup>
                                  {clients.map((client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={`${client.fullName} ${client.identificationNumber} ${client.email}`}
                                      onSelect={() => handleClientSelect(client)}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          client.id === field.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{client.fullName}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {client.identificationType} {client.identificationNumber} •{' '}
                                          {client.email}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedClient && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Información del Cliente</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Nombre:</span>
                            <p className="font-medium">{selectedClient.fullName}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tipo:</span>
                            <p className="font-medium">
                              <Badge variant="outline">{selectedClient.clientType}</Badge>
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Identificación:</span>
                            <p className="font-medium">
                              {selectedClient.identificationType} {selectedClient.identificationNumber}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email:</span>
                            <p className="font-medium">{selectedClient.email}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Teléfono:</span>
                            <p className="font-medium">{selectedClient.phone}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full mt-4"
                          onClick={() => setCredentialsModalOpen(true)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Ver Credenciales de Administradoras
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* STEP 2: CONFIGURE SUB-PROCESSES */}
              {step === 2 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="subProcesses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-procesos de Afiliación *</FormLabel>
                        <FormDescription>
                          Seleccione los sub-procesos necesarios y asigne managers
                        </FormDescription>
                        <div className="space-y-3 mt-4">
                          {subProcessTypes.map((spType) => {
                            const isSelected = field.value.some((sp) => sp.type === spType.value)
                            const subProcess = field.value.find((sp) => sp.type === spType.value)

                            return (
                              <Card key={spType.value} className={cn(isSelected && 'border-primary')}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleSubProcess(spType.value)}
                                    />
                                    <CardTitle className="text-base">{spType.label}</CardTitle>
                                  </div>
                                </CardHeader>
                                {isSelected && (
                                  <CardContent className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={subProcess?.assignToSelf || false}
                                        onCheckedChange={(checked) =>
                                          updateSubProcessAssignment(
                                            spType.value,
                                            null,
                                            checked as boolean
                                          )
                                        }
                                      />
                                      <label className="text-sm font-medium">
                                        Asignarme este sub-proceso
                                      </label>
                                    </div>
                                    {!subProcess?.assignToSelf && (
                                      <div>
                                        <label className="text-sm font-medium">
                                          Asignar a manager
                                        </label>
                                        <Select
                                          value={subProcess?.assignedToId || 'unassigned'}
                                          onValueChange={(value) =>
                                            updateSubProcessAssignment(
                                              spType.value,
                                              value === 'unassigned' ? null : value,
                                              false
                                            )
                                          }
                                        >
                                          <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Sin asignar (opcional)" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                                            {managers.map((manager) => (
                                              <SelectItem key={manager.id} value={manager.id}>
                                                {manager.name || manager.email}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </CardContent>
                                )}
                              </Card>
                            )
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter className="flex justify-between">
                <div className="flex gap-2">
                  {step === 2 && (
                    <Button type="button" variant="outline" onClick={handlePrevStep}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Anterior
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  {step === 1 ? (
                    <Button type="button" onClick={handleNextStep}>
                      Siguiente
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Crear Afiliación
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Credentials Quick View Modal */}
      {selectedClient && (
        <ClientCredentialsQuickView
          open={credentialsModalOpen}
          onOpenChange={setCredentialsModalOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.fullName}
        />
      )}
    </>
  )
}

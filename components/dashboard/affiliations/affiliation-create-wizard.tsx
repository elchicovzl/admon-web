/**
 * Affiliation Create Wizard Component
 * 2-step wizard for creating new affiliations
 * Supports EMPRESA clients with employee selection per sub-process type
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AffiliationSubProcessType, AffiliationProcessType } from '@prisma/client'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { Loader2, Check, ChevronRight, ChevronLeft, Key, Users, AlertCircle, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getClients, getCompanyEmployees } from '@/lib/actions/client.actions'
import { getManagers } from '@/lib/actions'
import { createAffiliation, getClientBeneficiaries } from '@/lib/actions/affiliation.actions'
import type { SafeClient } from '@/lib/types/client.types'
import type { SafeUser } from '@/lib/types/auth.types'
import { ClientCredentialsQuickView } from './client-credentials-quick-view'

const processTypeOptions = [
  { value: AffiliationProcessType.DEPENDIENTE, label: '(01) Dependiente' },
  { value: AffiliationProcessType.INDEPENDIENTE, label: '(3) Independiente' },
  { value: AffiliationProcessType.TRABAJADOR_TIEMPO_PARCIAL, label: '(51) Trabajador de tiempo parcial' },
  { value: AffiliationProcessType.INDEPENDIENTE_VOLUNTARIO, label: '(57) Independiente voluntario' },
  { value: AffiliationProcessType.CONTRATISTA_INDEPENDIENTE, label: '(59) Contratista independiente' },
  { value: AffiliationProcessType.BENEFICIARIO_UPC_ADICIONAL, label: '(40) Beneficiario UPC adicional' },
  { value: AffiliationProcessType.COTIZANTE_INDEPENDIENTE_SALUD, label: '(42) Cotizante independiente pago solo salud' },
  { value: AffiliationProcessType.COTIZANTE_PENSIONES_PAGO_TERCERO, label: '(43) Cotizante a pensiones con pago por tercero' },
  { value: AffiliationProcessType.PLANILLA_S_SERVICIO_DOMESTICO, label: 'Planilla S Servicio doméstico' },
  { value: AffiliationProcessType.PLANILLA_E_EMPLEADOS, label: 'Planilla E (Empleados)' },
  { value: AffiliationProcessType.LIQUIDACIONES, label: 'Liquidaciones' },
  { value: AffiliationProcessType.TRASLADO_EPS, label: 'Traslado de EPS' },
  { value: AffiliationProcessType.COBRO_INCAPACIDADES, label: 'Cobro Incapacidades' },
  { value: AffiliationProcessType.PENSIONADO, label: 'Pensionado' },
  { value: AffiliationProcessType.INCLUSION_BENEFICIARIOS, label: 'Inclusion Beneficiarios' },
  { value: AffiliationProcessType.EXCLUSION_BENEFICIARIOS, label: 'Exclusión de Beneficiarios' },
  { value: AffiliationProcessType.ASESORIAS_PENSIONES, label: 'Asesorias y pensiones' },
  { value: AffiliationProcessType.OTRO, label: 'Otro' },
]

const createAffiliationFormSchema = z.object({
  clientId: z.string().min(1, 'Debe seleccionar un cliente'),
  processType: z.nativeEnum(AffiliationProcessType, {
    required_error: 'Debe seleccionar el tipo de proceso',
  }),
  processTypeOther: z.string().min(2, 'Mínimo 2 caracteres').max(200).optional().nullable(),
  startDate: z.date().optional().nullable(),
  subProcesses: z.array(
    z.object({
      type: z.nativeEnum(AffiliationSubProcessType),
      assignedToId: z.string().nullable(),
      assignToSelf: z.boolean(),
      disabilityStartDate: z.date().nullable().optional(),
      disabilityEndDate: z.date().nullable().optional(),
      bankRegistry: z.boolean().optional(),
      transcription: z.boolean().optional(),
      collection: z.boolean().optional(),
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
  const [navigating, setNavigating] = useState(false)

  // Beneficiary selection state (INDIVIDUAL + INCLUSION/EXCLUSION_BENEFICIARIOS)
  const [beneficiaries, setBeneficiaries] = useState<Array<{
    id: string
    tipoRelacion: string
    nombreCompleto: string
    identificationType: string
    identificationNumber: string
    isExcluded: boolean
  }>>([])
  const [selectedBeneficiaryIds, setSelectedBeneficiaryIds] = useState<string[]>([])
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false)

  // Employee selection state (for EMPRESA clients)
  const [companyEmployees, setCompanyEmployees] = useState<SafeClient[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [selectedEmployeesByType, setSelectedEmployeesByType] = useState<
    Record<AffiliationSubProcessType, string[]>
  >({
    ARL: [],
    EPS: [],
    AFP: [],
    CCF: [],
    PILA: [],
    TRASLADOS: [],
    INCAPACIDADES: [],
    CONCILIACION_MORA: [],
  })

  const isEmpresa = selectedClient?.clientType === 'EMPRESA'

  const form = useForm<CreateAffiliationFormValues>({
    resolver: zodResolver(createAffiliationFormSchema),
    defaultValues: {
      clientId: '',
      processType: undefined,
      processTypeOther: null,
      subProcesses: [],
    },
  })

  useEffect(() => {
    if (open) {
      setNavigating(false)
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
      const result = await getManagers()
      if (result.success && result.data) {
        setManagers(result.data.filter((u) => u.isActive))
      }
    } catch (error) {
      console.error('Error loading managers:', error)
    }
  }

  async function loadBeneficiaries(clientId: string) {
    setLoadingBeneficiaries(true)
    try {
      const result = await getClientBeneficiaries(clientId)
      setBeneficiaries(result.success && result.data ? result.data : [])
    } catch (error) {
      console.error('Error loading beneficiaries:', error)
      setBeneficiaries([])
    } finally {
      setLoadingBeneficiaries(false)
    }
  }

  async function loadCompanyEmployees(companyId: string) {
    setLoadingEmployees(true)
    try {
      const result = await getCompanyEmployees(companyId)
      if (result.success && result.data) {
        setCompanyEmployees(result.data)
      } else {
        setCompanyEmployees([])
      }
    } catch (error) {
      console.error('Error loading employees:', error)
      setCompanyEmployees([])
    } finally {
      setLoadingEmployees(false)
    }
  }

  function handleClientSelect(client: SafeClient) {
    setSelectedClient(client)
    form.setValue('clientId', client.id)
    setComboboxOpen(false)
    // Reset employee + beneficiary selections when client changes
    setCompanyEmployees([])
    setSelectedEmployeesByType({ ARL: [], EPS: [], AFP: [], CCF: [], PILA: [], TRASLADOS: [], INCAPACIDADES: [], CONCILIACION_MORA: [] })
    setBeneficiaries([])
    setSelectedBeneficiaryIds([])
  }

  function handleNextStep() {
    if (step === 1) {
      if (!form.getValues('clientId')) {
        toast.error('Debe seleccionar un cliente')
        return
      }
      if (!form.getValues('processType')) {
        toast.error('Debe seleccionar el tipo de proceso')
        return
      }
      const pt = form.getValues('processType')
      const ptOther = form.getValues('processTypeOther')
      if (pt === AffiliationProcessType.OTRO && (!ptOther || (ptOther as string).trim().length < 2)) {
        form.setError('processTypeOther', { message: 'Debe especificar el tipo de proceso' })
        return
      }
      // Load employees if EMPRESA
      if (selectedClient?.clientType === 'EMPRESA') {
        loadCompanyEmployees(selectedClient.id)
      }
      // Load beneficiaries if INDIVIDUAL + INCLUSION/EXCLUSION
      const needsBeneficiaries =
        selectedClient?.clientType !== 'EMPRESA' &&
        (pt === AffiliationProcessType.INCLUSION_BENEFICIARIOS ||
          pt === AffiliationProcessType.EXCLUSION_BENEFICIARIOS)
      if (needsBeneficiaries && selectedClient) {
        loadBeneficiaries(selectedClient.id)
      }
      setStep(2)
    }
  }

  function handlePrevStep() {
    setStep(1)
  }

  function toggleEmployeeForType(type: AffiliationSubProcessType, employeeId: string) {
    setSelectedEmployeesByType((prev) => {
      const current = prev[type]
      const exists = current.includes(employeeId)
      return {
        ...prev,
        [type]: exists
          ? current.filter((id) => id !== employeeId)
          : [...current, employeeId],
      }
    })
  }

  function toggleAllEmployeesForType(type: AffiliationSubProcessType) {
    setSelectedEmployeesByType((prev) => {
      const allSelected = prev[type].length === companyEmployees.length
      return {
        ...prev,
        [type]: allSelected ? [] : companyEmployees.map((e) => e.id),
      }
    })
  }

  async function onSubmit(data: CreateAffiliationFormValues) {
    // Validate employee selection for EMPRESA
    if (isEmpresa) {
      const selectedTypes = data.subProcesses.map((sp) => sp.type)
      for (const type of selectedTypes) {
        if (selectedEmployeesByType[type].length === 0) {
          toast.error(`Debe seleccionar al menos un empleado para ${type}`)
          return
        }
      }
    }

    // Validate beneficiary selection (INDIVIDUAL + INCLUSION/EXCLUSION)
    const isBeneficiaryProcess =
      data.processType === AffiliationProcessType.INCLUSION_BENEFICIARIOS ||
      data.processType === AffiliationProcessType.EXCLUSION_BENEFICIARIOS
    if (isBeneficiaryProcess && !isEmpresa && selectedBeneficiaryIds.length === 0) {
      toast.error('Debe seleccionar al menos un beneficiario')
      return
    }

    setLoading(true)
    try {
      // Build sub-processes array
      const transformedSubProcesses: { type: AffiliationSubProcessType; assignedToId?: string | null; employeeId?: string | null }[] = []

      for (const sp of data.subProcesses) {
        const assignedToId = sp.assignToSelf ? currentUserId : sp.assignedToId

        const isDisability = sp.type === AffiliationSubProcessType.INCAPACIDADES
        const disabilityFields = isDisability
          ? {
              disabilityStartDate: sp.disabilityStartDate ?? null,
              disabilityEndDate: sp.disabilityEndDate ?? null,
              bankRegistry: sp.bankRegistry ?? false,
              transcription: sp.transcription ?? false,
              collection: sp.collection ?? false,
            }
          : {}

        const isBeneficiaryProcess =
          data.processType === AffiliationProcessType.INCLUSION_BENEFICIARIOS ||
          data.processType === AffiliationProcessType.EXCLUSION_BENEFICIARIOS
        const beneficiaryFields =
          isBeneficiaryProcess && !isEmpresa && selectedBeneficiaryIds.length > 0
            ? { beneficiaryIds: selectedBeneficiaryIds }
            : {}

        if (isEmpresa) {
          // Expand to one sub-process per employee
          const employeeIds = selectedEmployeesByType[sp.type]
          for (const employeeId of employeeIds) {
            transformedSubProcesses.push({
              type: sp.type,
              assignedToId,
              employeeId,
              ...disabilityFields,
            })
          }
        } else {
          // Individual/independent client - no employeeId
          transformedSubProcesses.push({
            type: sp.type,
            assignedToId,
            ...disabilityFields,
            ...beneficiaryFields,
          })
        }
      }

      // Validate "Otro" manually (can't use refine in local schema without breaking types)
      if (data.processType === AffiliationProcessType.OTRO && (!data.processTypeOther || (data.processTypeOther as string).trim().length < 2)) {
        form.setError('processTypeOther', { message: 'Debe especificar el tipo de proceso' })
        setLoading(false)
        return
      }

      const result = await createAffiliation({
        clientId: data.clientId,
        processType: data.processType,
        processTypeOther: data.processTypeOther ?? null,
        startDate: data.startDate ?? null,
        subProcesses: transformedSubProcesses,
      })

      if (result.success && result.data) {
        toast.success('Afiliación creada exitosamente')
        form.reset()
        setStep(1)
        setSelectedClient(null)
        setCompanyEmployees([])
        setSelectedEmployeesByType({ ARL: [], EPS: [], AFP: [], CCF: [], PILA: [], TRASLADOS: [], INCAPACIDADES: [], CONCILIACION_MORA: [] })
        setBeneficiaries([])
        setSelectedBeneficiaryIds([])
        setNavigating(true)
        onAffiliationCreated?.()
        // Redirect to detail page — modal closes naturally when page navigates
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
    { value: AffiliationSubProcessType.PILA, label: 'Pila' },
    { value: AffiliationSubProcessType.TRASLADOS, label: 'Traslados' },
    { value: AffiliationSubProcessType.INCAPACIDADES, label: 'Incapacidades' },
    { value: AffiliationSubProcessType.CONCILIACION_MORA, label: 'Conciliación Mora' },
  ]

  function toggleSubProcess(type: AffiliationSubProcessType) {
    const current = form.getValues('subProcesses')
    const exists = current.find((sp) => sp.type === type)

    if (exists) {
      form.setValue(
        'subProcesses',
        current.filter((sp) => sp.type !== type)
      )
      // Clear employee selection for this type
      setSelectedEmployeesByType((prev) => ({ ...prev, [type]: [] }))
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

  function updateSubProcessDisability(
    type: AffiliationSubProcessType,
    patch: Partial<{
      disabilityStartDate: Date | null
      disabilityEndDate: Date | null
      bankRegistry: boolean
      transcription: boolean
      collection: boolean
    }>
  ) {
    const current = form.getValues('subProcesses')
    const updated = current.map((sp) =>
      sp.type === type ? { ...sp, ...patch } : sp
    )
    form.setValue('subProcesses', updated)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          'max-h-[90vh] overflow-y-auto',
          isEmpresa && step === 2 ? 'sm:max-w-[800px]' : 'sm:max-w-[700px]'
        )}>
          {navigating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold text-lg">Proceso creado</p>
                <p className="text-sm text-muted-foreground mt-1">Abriendo detalle...</p>
              </div>
            </div>
          ) : (
          <>
          <DialogHeader>
            <DialogTitle>
              Crear Nueva Afiliación {step === 1 ? '- Paso 1/2' : '- Paso 2/2'}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? 'Seleccione el cliente'
                : 'Configure los sub-procesos'}
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
                          Ver Claves de Administradoras
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* PROCESS TYPE COMBOBOX */}
                  <FormField
                    control={form.control}
                    name="processType"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Tipo de Proceso *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={cn(!field.value && 'text-muted-foreground')}>
                              <SelectValue placeholder="Seleccionar tipo de proceso..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {processTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* OTRO: show custom text input */}
                  {form.watch('processType') === AffiliationProcessType.OTRO && (
                    <FormField
                      control={form.control}
                      name="processTypeOther"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Especificar tipo de proceso *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Describe el tipo de proceso..."
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* START DATE */}
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value
                                  ? format(field.value, "d 'de' MMMM, yyyy", { locale: es })
                                  : 'Seleccionar fecha de inicio...'}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Fecha en la que inicia el proceso (puede ser futura)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* STEP 2: CONFIGURE SUB-PROCESSES */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Beneficiary selection (INDIVIDUAL + INCLUSION/EXCLUSION_BENEFICIARIOS) */}
                  {!isEmpresa &&
                    (form.watch('processType') === AffiliationProcessType.INCLUSION_BENEFICIARIOS ||
                      form.watch('processType') === AffiliationProcessType.EXCLUSION_BENEFICIARIOS) && (
                      <Card className="border-primary/40 bg-primary/5">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            {form.watch('processType') === AffiliationProcessType.EXCLUSION_BENEFICIARIOS
                              ? 'Beneficiarios a excluir *'
                              : 'Beneficiarios a incluir *'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {loadingBeneficiaries ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando beneficiarios...
                            </div>
                          ) : beneficiaries.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                              <AlertCircle className="h-4 w-4 flex-shrink-0" />
                              Este cliente no tiene beneficiarios registrados. Agregalos desde el perfil del cliente primero.
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {selectedBeneficiaryIds.length} de {beneficiaries.length} seleccionados
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto py-1 px-2 text-xs"
                                  onClick={() =>
                                    setSelectedBeneficiaryIds((prev) =>
                                      prev.length === beneficiaries.length
                                        ? []
                                        : beneficiaries.map((b) => b.id)
                                    )
                                  }
                                >
                                  {selectedBeneficiaryIds.length === beneficiaries.length
                                    ? 'Deseleccionar todos'
                                    : 'Seleccionar todos'}
                                </Button>
                              </div>
                              <div className="max-h-56 overflow-y-auto rounded-md border bg-background p-2 space-y-1">
                                {beneficiaries.map((b) => {
                                  const checked = selectedBeneficiaryIds.includes(b.id)
                                  return (
                                    <div
                                      key={b.id}
                                      className={cn(
                                        'flex items-center gap-2 rounded-sm px-2 py-1.5 cursor-pointer hover:bg-muted/50',
                                        checked && 'bg-muted/30'
                                      )}
                                      onClick={() =>
                                        setSelectedBeneficiaryIds((prev) =>
                                          prev.includes(b.id)
                                            ? prev.filter((id) => id !== b.id)
                                            : [...prev, b.id]
                                        )
                                      }
                                    >
                                      <div
                                        className={cn(
                                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                                          checked ? 'bg-primary border-primary' : 'border-input'
                                        )}
                                      >
                                        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {b.nombreCompleto}{' '}
                                          <span className="text-xs text-muted-foreground">
                                            ({b.tipoRelacion})
                                          </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {b.identificationType} {b.identificationNumber}
                                          {b.isExcluded && (
                                            <Badge variant="outline" className="ml-2 text-[10px] border-red-300 text-red-700">
                                              Ya excluido
                                            </Badge>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}

                  {/* Show employee loading/warning for EMPRESA */}
                  {isEmpresa && loadingEmployees && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando empleados de la empresa...
                    </div>
                  )}
                  {isEmpresa && !loadingEmployees && companyEmployees.length === 0 && (
                    <div className="flex items-center gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      Esta empresa no tiene empleados registrados. Debe agregar empleados desde el perfil del cliente antes de crear una afiliación.
                    </div>
                  )}
                  {isEmpresa &&
                    (form.watch('processType') === AffiliationProcessType.INCLUSION_BENEFICIARIOS ||
                      form.watch('processType') === AffiliationProcessType.EXCLUSION_BENEFICIARIOS) && (
                      <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Los beneficiarios a {form.watch('processType') === AffiliationProcessType.EXCLUSION_BENEFICIARIOS ? 'excluir' : 'incluir'} se seleccionan por empleado desde el detalle de cada sub-proceso, una vez creado.
                        </span>
                      </div>
                    )}

                  <FormField
                    control={form.control}
                    name="subProcesses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-procesos *</FormLabel>
                        <FormDescription>
                          {isEmpresa
                            ? 'Seleccione los sub-procesos y los empleados a los que se les aplicará cada uno'
                            : 'Seleccione los sub-procesos necesarios y asigne managers'}
                        </FormDescription>
                        <div className="space-y-3 mt-4">
                          {subProcessTypes.map((spType) => {
                            const isSelected = field.value.some((sp) => sp.type === spType.value)
                            const subProcess = field.value.find((sp) => sp.type === spType.value)
                            const selectedCount = selectedEmployeesByType[spType.value].length

                            return (
                              <Card key={spType.value} className={cn(isSelected && 'border-primary')}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleSubProcess(spType.value)}
                                        disabled={isEmpresa && !loadingEmployees && companyEmployees.length === 0}
                                      />
                                      <CardTitle className="text-base">{spType.label}</CardTitle>
                                    </div>
                                    {isSelected && isEmpresa && (
                                      <Badge variant="secondary" className="text-xs">
                                        <Users className="mr-1 h-3 w-3" />
                                        {selectedCount} empleado{selectedCount !== 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </CardHeader>
                                {isSelected && (
                                  <CardContent className="space-y-3">
                                    {/* Disability-specific fields (only INCAPACIDADES + non-EMPRESA clients) */}
                                    {spType.value === AffiliationSubProcessType.INCAPACIDADES && !isEmpresa && (
                                      <div className="rounded-md border bg-rose-50/50 p-3 space-y-3">
                                        <p className="text-xs font-semibold text-rose-900">Datos de la incapacidad</p>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-xs font-medium">Fecha inicio</label>
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className={cn(
                                                    'w-full justify-start text-left font-normal mt-1',
                                                    !subProcess?.disabilityStartDate && 'text-muted-foreground'
                                                  )}
                                                >
                                                  {subProcess?.disabilityStartDate
                                                    ? format(subProcess.disabilityStartDate as Date, 'd MMM yyyy', { locale: es })
                                                    : 'Seleccionar...'}
                                                  <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                  mode="single"
                                                  selected={(subProcess?.disabilityStartDate as Date | undefined) ?? undefined}
                                                  onSelect={(d) => updateSubProcessDisability(spType.value, { disabilityStartDate: d ?? null })}
                                                  locale={es}
                                                />
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium">Fecha fin</label>
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className={cn(
                                                    'w-full justify-start text-left font-normal mt-1',
                                                    !subProcess?.disabilityEndDate && 'text-muted-foreground'
                                                  )}
                                                >
                                                  {subProcess?.disabilityEndDate
                                                    ? format(subProcess.disabilityEndDate as Date, 'd MMM yyyy', { locale: es })
                                                    : 'Seleccionar...'}
                                                  <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                  mode="single"
                                                  selected={(subProcess?.disabilityEndDate as Date | undefined) ?? undefined}
                                                  onSelect={(d) => updateSubProcessDisability(spType.value, { disabilityEndDate: d ?? null })}
                                                  locale={es}
                                                />
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Checkbox
                                              checked={subProcess?.bankRegistry ?? false}
                                              onCheckedChange={(v) => updateSubProcessDisability(spType.value, { bankRegistry: !!v })}
                                            />
                                            Registro de banco
                                          </label>
                                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Checkbox
                                              checked={subProcess?.transcription ?? false}
                                              onCheckedChange={(v) => updateSubProcessDisability(spType.value, { transcription: !!v })}
                                            />
                                            Transcripción
                                          </label>
                                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Checkbox
                                              checked={subProcess?.collection ?? false}
                                              onCheckedChange={(v) => updateSubProcessDisability(spType.value, { collection: !!v })}
                                            />
                                            Cobro
                                          </label>
                                        </div>
                                      </div>
                                    )}

                                    {/* Employee selection for EMPRESA clients */}
                                    {isEmpresa && companyEmployees.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium">Seleccionar empleados</label>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto py-1 px-2 text-xs"
                                            onClick={() => toggleAllEmployeesForType(spType.value)}
                                          >
                                            {selectedEmployeesByType[spType.value].length === companyEmployees.length
                                              ? 'Deseleccionar todos'
                                              : 'Seleccionar todos'}
                                          </Button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                                          {companyEmployees.map((employee) => {
                                            const isChecked = selectedEmployeesByType[spType.value].includes(employee.id)
                                            return (
                                              <div
                                                key={employee.id}
                                                className={cn(
                                                  'flex items-center space-x-2 rounded-sm px-2 py-1.5 cursor-pointer hover:bg-muted/50',
                                                  isChecked && 'bg-muted/30'
                                                )}
                                                onClick={() => toggleEmployeeForType(spType.value, employee.id)}
                                              >
                                                <div className={cn(
                                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                                                  isChecked
                                                    ? 'bg-primary border-primary'
                                                    : 'border-input'
                                                )}>
                                                  {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-medium truncate">{employee.fullName}</p>
                                                  <p className="text-xs text-muted-foreground">
                                                    {employee.identificationType} {employee.identificationNumber}
                                                  </p>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Manager assignment */}
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
                      Crear Proceso
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
          </>
          )}
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ClientBeneficiary } from '@/lib/types/client.types'
import {
  addClientBeneficiary,
  updateClientBeneficiary,
  deleteClientBeneficiary,
} from '@/lib/actions'
import {
  clientBeneficiarySchema,
  type ClientBeneficiaryInput,
} from '@/lib/validations/client-info.schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Users, UserPlus, MoreHorizontal, Edit, Trash2, Loader2 } from 'lucide-react'
import { IdentificationType } from '@prisma/client'

interface ClientBeneficiariesSectionProps {
  clientId: string
  initialBeneficiaries: ClientBeneficiary[]
}

const TIPO_RELACION_OPTIONS = [
  { value: 'hijo', label: 'Hijo/a', color: 'bg-blue-500' },
  { value: 'padre', label: 'Padre/Madre', color: 'bg-green-500' },
  { value: 'conyuge', label: 'Cónyuge', color: 'bg-pink-500' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-500' },
]

export function ClientBeneficiariesSection({
  clientId,
  initialBeneficiaries,
}: ClientBeneficiariesSectionProps) {
  const router = useRouter()
  const [beneficiaries, setBeneficiaries] = useState<ClientBeneficiary[]>(initialBeneficiaries)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBeneficiary, setEditingBeneficiary] = useState<ClientBeneficiary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<ClientBeneficiaryInput>({
    resolver: zodResolver(clientBeneficiarySchema),
    defaultValues: {
      tipoRelacion: 'hijo',
      nombreCompleto: '',
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
    },
  })

  const handleOpenCreateDialog = () => {
    setEditingBeneficiary(null)
    form.reset({
      tipoRelacion: 'hijo',
      nombreCompleto: '',
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
    })
    setIsDialogOpen(true)
  }

  const handleOpenEditDialog = (beneficiary: ClientBeneficiary) => {
    setEditingBeneficiary(beneficiary)
    form.reset({
      tipoRelacion: beneficiary.tipoRelacion as any,
      nombreCompleto: beneficiary.nombreCompleto,
      identificationType: beneficiary.identificationType,
      identificationNumber: beneficiary.identificationNumber,
    })
    setIsDialogOpen(true)
  }

  const onSubmit = async (data: ClientBeneficiaryInput) => {
    setIsLoading(true)

    try {
      let result

      if (editingBeneficiary) {
        result = await updateClientBeneficiary(editingBeneficiary.id, data)
      } else {
        result = await addClientBeneficiary(clientId, data)
      }

      if (result.success && result.data) {
        toast.success(result.message || 'Beneficiario guardado exitosamente')

        if (editingBeneficiary) {
          setBeneficiaries((prev) =>
            prev.map((b) => (b.id === editingBeneficiary.id ? result.data! : b))
          )
        } else {
          setBeneficiaries((prev) => [result.data!, ...prev])
        }

        setIsDialogOpen(false)
        form.reset()
        router.refresh()
      } else {
        toast.error(result.error || 'Error al guardar beneficiario')
      }
    } catch (error) {
      console.error('Save beneficiary error:', error)
      toast.error('Error inesperado al guardar beneficiario')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (beneficiary: ClientBeneficiary) => {
    if (!confirm(`¿Estás seguro de eliminar a ${beneficiary.nombreCompleto}?`)) {
      return
    }

    setIsDeleting(true)

    try {
      const result = await deleteClientBeneficiary(beneficiary.id)

      if (result.success) {
        toast.success(result.message || 'Beneficiario eliminado exitosamente')
        setBeneficiaries((prev) => prev.filter((b) => b.id !== beneficiary.id))
        router.refresh()
      } else {
        toast.error(result.error || 'Error al eliminar beneficiario')
      }
    } catch (error) {
      console.error('Delete beneficiary error:', error)
      toast.error('Error inesperado al eliminar beneficiario')
    } finally {
      setIsDeleting(false)
    }
  }

  const getIdentificationTypeLabel = (type: IdentificationType) => {
    const labels = {
      CEDULA: 'CC',
      CEDULA_EXTRANJERIA: 'CE',
      PPT: 'PPT',
      NIT: 'NIT',
    }
    return labels[type]
  }

  const getRelacionBadgeColor = (tipoRelacion: string) => {
    const option = TIPO_RELACION_OPTIONS.find((o) => o.value === tipoRelacion)
    return option?.color || 'bg-gray-500'
  }

  const getRelacionLabel = (tipoRelacion: string) => {
    const option = TIPO_RELACION_OPTIONS.find((o) => o.value === tipoRelacion)
    return option?.label || tipoRelacion
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Beneficiarios</CardTitle>
                <CardDescription>
                  {beneficiaries.length}{' '}
                  {beneficiaries.length === 1 ? 'beneficiario registrado' : 'beneficiarios registrados'}
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleOpenCreateDialog} size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar Beneficiario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {beneficiaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No hay beneficiarios registrados</p>
              <p className="text-xs mt-2">
                Usa el botón "Agregar Beneficiario" para empezar
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Relación</TableHead>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Identificación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beneficiaries.map((beneficiary) => (
                    <TableRow key={beneficiary.id}>
                      <TableCell>
                        <Badge className={getRelacionBadgeColor(beneficiary.tipoRelacion)}>
                          {getRelacionLabel(beneficiary.tipoRelacion)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{beneficiary.nombreCompleto}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            {getIdentificationTypeLabel(beneficiary.identificationType)}
                          </span>
                          <span className="font-mono text-sm">
                            {beneficiary.identificationNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenEditDialog(beneficiary)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(beneficiary)}
                              disabled={isDeleting}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingBeneficiary ? 'Editar Beneficiario' : 'Agregar Beneficiario'}
            </DialogTitle>
            <DialogDescription>
              Completa la información del beneficiario
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Tipo de Relación */}
              <FormField
                control={form.control}
                name="tipoRelacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Relación</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el tipo de relación" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPO_RELACION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nombre Completo */}
              <FormField
                control={form.control}
                name="nombreCompleto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez García" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo y Número de Identificación */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="identificationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo ID</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={IdentificationType.CEDULA}>Cédula</SelectItem>
                          <SelectItem value={IdentificationType.CEDULA_EXTRANJERIA}>
                            Cédula Extranjería
                          </SelectItem>
                          <SelectItem value={IdentificationType.PPT}>PPT</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="identificationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingBeneficiary ? 'Actualizar' : 'Agregar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}

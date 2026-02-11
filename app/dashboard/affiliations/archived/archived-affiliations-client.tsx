/**
 * Archived Affiliations Client Component
 * Displays table of archived affiliations
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, Search, Archive } from 'lucide-react'
import type { AffiliationWithRelations } from '@/lib/types/affiliation.types'

interface ArchivedAffiliationsClientProps {
  affiliations: AffiliationWithRelations[]
}

export function ArchivedAffiliationsClient({ affiliations }: ArchivedAffiliationsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter affiliations by client name
  const filteredAffiliations = affiliations.filter((affiliation) =>
    affiliation.client?.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (affiliations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Archive className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay afiliaciones archivadas</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Las afiliaciones enviadas a clientes aparecerán aquí para consulta histórica.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Archivadas</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{affiliations.length}</div>
            <p className="text-xs text-muted-foreground">Afiliaciones completadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por nombre de cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Identificación</TableHead>
              <TableHead>Fecha de Envío</TableHead>
              <TableHead>Enviada Por</TableHead>
              <TableHead>Sub-Procesos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAffiliations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No se encontraron afiliaciones con ese nombre
                </TableCell>
              </TableRow>
            ) : (
              filteredAffiliations.map((affiliation) => (
                <TableRow key={affiliation.id}>
                  <TableCell className="font-medium">
                    {affiliation.client?.fullName || 'Sin nombre'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {affiliation.client?.identificationType}{' '}
                    {affiliation.client?.identificationNumber}
                  </TableCell>
                  <TableCell>
                    {affiliation.sentAt ? (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {format(new Date(affiliation.sentAt), 'd MMM yyyy', { locale: es })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(affiliation.sentAt), 'HH:mm', { locale: es })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {affiliation.sentBy ? (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {affiliation.sentBy.name || 'Sin nombre'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {affiliation.sentBy.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {affiliation.subProcesses?.map((sp) => (
                        <Badge key={sp.id} variant="outline" className="text-xs">
                          {sp.type}
                        </Badge>
                      ))}
                      {!affiliation.subProcesses || affiliation.subProcesses.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Sin sub-procesos</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/affiliations/${affiliation.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredAffiliations.length} de {affiliations.length} afiliaciones
        </p>
      )}
    </div>
  )
}

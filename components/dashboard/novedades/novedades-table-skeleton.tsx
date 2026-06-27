import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function NovedadesTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Periodo</TableHead>
            <TableHead className="text-center">Días</TableHead>
            <TableHead>Observación</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 6 }).map((__, j) => (
                <TableCell key={j}>
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

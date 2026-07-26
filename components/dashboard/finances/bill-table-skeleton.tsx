/**
 * Loading skeleton for the purchase invoices table.
 * Mirrors `BillTable`'s columns so the streaming transition doesn't jump.
 */

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function BillTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Vencimiento</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Proveedor</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Por pagar</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3">
                    <Skeleton className="mb-1 h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

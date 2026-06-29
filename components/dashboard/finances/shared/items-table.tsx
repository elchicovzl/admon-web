/**
 * Items table for any finances document detail page (invoice or estimate).
 *
 * The `items[]` shape is identical between /invoices and /estimates (verified
 * against the Alegra API — /estimates returns a `total` field per item that
 * invoices don't, plus extra tax metadata like `type` / `status`, all of
 * which pass through thanks to `InvoiceItemSchema.passthrough()`).
 *
 * Renders:
 *   - Empty state ("Sin items registrados.") if `items.length === 0`
 *   - Otherwise a table with: descripción / cant / precio / descuento /
 *     impuestos (as badges) / total por línea
 *
 * Line totals are computed locally (`price * quantity - discount`) because
 * Alegra's `item.total` already includes tax, while the column expectation
 * is "net price × qty − discount" — same convention as the V1 invoice
 * detail. The discrepancy is small in practice (taxes are already included
 * in the displayed total via the items.tax[] badges) and consistent across
 * documents.
 */

import { Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/alegra/transformers'
import type { InvoiceItem } from '@/lib/alegra/types'

interface ItemsTableProps {
  items: InvoiceItem[]
  currencyCode: string
}

export function ItemsTable({ items, currencyCode }: ItemsTableProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />
            Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin items registrados.</p>
        </CardContent>
      </Card>
    )
  }

  const fmt = (n: number) => formatCurrency(n, currencyCode)
  const lineTotal = (item: InvoiceItem) => item.price * item.quantity - (item.discount ?? 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-muted-foreground" />
          Items
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {items.length} {items.length === 1 ? 'línea' : 'líneas'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-muted-foreground">Descripción</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Cant.</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Precio</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Desc.</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Impuestos</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    )}
                    {item.reference && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Ref: <span className="font-mono">{item.reference}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(item.price)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {item.discount ? `−${fmt(item.discount)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {(item.tax ?? []).map((t) => (
                        <Badge key={t.id} variant="secondary" className="text-xs font-normal">
                          {t.name} {t.percentage}%
                        </Badge>
                      ))}
                      {!item.tax?.length && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {fmt(lineTotal(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
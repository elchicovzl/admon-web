/**
 * PDF del recibo de pago. Server-only: se renderiza con `renderToBuffer`.
 *
 * Layout mirrors the Alegra quote the firm already hands out (logo, centered
 * issuer, grey client box, ruled item table, totals, "ELABORADO POR" line).
 * Copy is neutral Spanish because the document goes to the client. It uses the
 * built-in Helvetica font (WinAnsi), which covers every accent and "Ñ" used in
 * Spanish. The smoke test only checks that the render produces a PDF (with and
 * without logo) and that the annulled render is larger; glyph coverage was
 * inspected by hand on a real render, not asserted.
 */

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { EmisorRecibo } from '@/lib/config/recibo-emisor'
import type { DatosRecibo } from '@/lib/utils/control-recibo'
import { formatearFecha, formatearMonto } from '@/lib/utils/control-format'

export type { EmisorRecibo }

export interface ReciboPagoDocumentProps {
  datos: DatosRecibo
  emisor: EmisorRecibo
  /** PNG bytes. When absent, the header is rendered without a logo. */
  logoBuffer?: Buffer | Uint8Array
}

const COLOR_TEXTO = '#1f2937'
const COLOR_GRIS = '#a8a8a8'
const COLOR_LINEA = '#9ca3af'
const COLOR_SUAVE = '#6b7280'

const MARGEN = 30
// Width of each numeric column of the item table (Precio, Cantidad, Descuento, Total).
const ANCHO_PRECIO = 80
const ANCHO_CANTIDAD = 66
const ANCHO_DESCUENTO = 66
const ANCHO_TOTAL = 88
const ANCHO_FECHAS = 150
// The item area is padded up to this height so a short receipt still looks like
// the sample (ruled columns running down the page). Each line is budgeted at
// ALTO_LINEA to size the empty filler that completes the area; with many (or
// wrapped) lines the filler shrinks to nothing and the table flows to the next
// page, where the totals and signature block follow the last item.
const ALTO_AREA_ITEMS = 420
const ALTO_LINEA = 24

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGEN,
    paddingHorizontal: MARGEN,
    paddingBottom: 50,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLOR_TEXTO,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  logoCol: { width: 90 },
  logo: { width: 80, objectFit: 'contain' },
  emisor: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  tituloCol: { width: 100, paddingLeft: 8 },
  tituloTexto: { fontSize: 8 },
  tituloNumero: { fontFamily: 'Helvetica-Bold', fontSize: 11 },

  caja: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: COLOR_LINEA,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cajaIzq: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  cajaDer: {
    width: ANCHO_FECHAS,
    borderLeftWidth: 0.5,
    borderColor: COLOR_LINEA,
  },
  // minHeight, not height: a long name or address wraps and grows the row.
  filaCaja: { flexDirection: 'row', minHeight: 16, alignItems: 'stretch' },
  filaConBorde: { borderBottomWidth: 0.5, borderColor: COLOR_LINEA },
  etiqueta: {
    width: 62,
    backgroundColor: COLOR_GRIS,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingHorizontal: 3,
    paddingTop: 4,
  },
  valor: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingLeft: 4,
    paddingTop: 4,
    paddingBottom: 2,
  },
  tipoDoc: {
    width: 70,
    backgroundColor: COLOR_GRIS,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'right',
    paddingRight: 4,
    paddingTop: 4,
  },
  numeroDoc: { width: 150, paddingLeft: 4, paddingTop: 4 },
  cabeceraDer: {
    minHeight: 16,
    backgroundColor: COLOR_GRIS,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textAlign: 'center',
    paddingTop: 5,
  },
  valorDer: {
    minHeight: 16,
    fontSize: 8,
    textAlign: 'center',
    paddingTop: 4,
    paddingHorizontal: 3,
  },

  tablaCabecera: {
    flexDirection: 'row',
    backgroundColor: COLOR_GRIS,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    height: 16,
    alignItems: 'center',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  areaItems: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 3,
    borderColor: COLOR_GRIS,
  },
  filaItem: { flexDirection: 'row' },
  colItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  colPrecio: { width: ANCHO_PRECIO },
  colCantidad: { width: ANCHO_CANTIDAD },
  colDescuento: { width: ANCHO_DESCUENTO },
  colTotal: { width: ANCHO_TOTAL },
  celdaNumero: {
    borderLeftWidth: 0.5,
    borderColor: COLOR_LINEA,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  alineadoDerecha: { textAlign: 'right' },
  centrado: { textAlign: 'center' },
  tablaPie: { height: 3 },

  resumen: { flexDirection: 'row', marginTop: 10 },
  resumenIzq: { flexGrow: 1, flexShrink: 1, paddingRight: 16 },
  totales: { width: ANCHO_DESCUENTO + ANCHO_TOTAL + ANCHO_CANTIDAD },
  totalFila: { flexDirection: 'row', height: 15, alignItems: 'center' },
  totalFilaGris: { backgroundColor: COLOR_GRIS },
  totalEtiqueta: { flexGrow: 1, textAlign: 'right', paddingRight: 10 },
  totalValor: { width: ANCHO_TOTAL, textAlign: 'right', paddingRight: 3 },
  enLetras: { marginBottom: 6 },
  negrita: { fontFamily: 'Helvetica-Bold' },

  firma: { marginTop: 40, width: 190 },
  firmaNombre: { textAlign: 'center', marginBottom: 2, fontSize: 9 },
  firmaLinea: { borderTopWidth: 0.5, borderColor: COLOR_TEXTO, paddingTop: 3 },
  firmaEtiqueta: { textAlign: 'center', fontSize: 8 },

  pie: {
    position: 'absolute',
    left: MARGEN,
    right: MARGEN,
    bottom: 28,
    textAlign: 'center',
    fontSize: 8,
    color: COLOR_SUAVE,
  },
  anuladoMarca: {
    position: 'absolute',
    top: 330,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 90,
    color: '#dc2626',
    opacity: 0.25,
    transform: 'rotate(-30deg)',
  },
  anuladoBanner: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
    marginBottom: 14,
  },
})

export function ReciboPagoDocument({ datos, emisor, logoBuffer }: ReciboPagoDocumentProps) {
  const ubicacion = [emisor.direccion, emisor.ciudad].filter(Boolean).join(' - ')
  const { cliente } = datos
  const altoRelleno = Math.max(0, ALTO_AREA_ITEMS - datos.lineas.length * ALTO_LINEA)

  return (
    <Document title={`Recibo de pago ${datos.numeroFormateado}`} author={emisor.razonSocial}>
      <Page size="A4" style={styles.page}>
        {datos.anulado ? <Text style={styles.anuladoBanner}>ANULADO</Text> : null}

        <View style={styles.header}>
          <View style={styles.logoCol}>
            {logoBuffer ? (
              <Image src={{ data: Buffer.from(logoBuffer), format: 'png' }} style={styles.logo} />
            ) : null}
          </View>
          <View style={styles.emisor}>
            {/* Blank issuer fields print nothing, not even their label. */}
            {emisor.razonSocial ? (
              <Text style={styles.emisorNombre}>{emisor.razonSocial}</Text>
            ) : null}
            {emisor.nit ? <Text>NIT {emisor.nit}</Text> : null}
            {ubicacion ? <Text>{ubicacion}</Text> : null}
            {emisor.telefono ? <Text>{emisor.telefono}</Text> : null}
            {emisor.email ? <Text>{emisor.email}</Text> : null}
          </View>
          <View style={styles.tituloCol}>
            <Text style={styles.tituloTexto}>Recibo de pago</Text>
            <Text style={styles.tituloNumero}>No. {datos.numeroFormateado}</Text>
          </View>
        </View>

        <View style={styles.caja}>
          <View style={styles.cajaIzq}>
            <View style={[styles.filaCaja, styles.filaConBorde]}>
              <Text style={styles.etiqueta}>SEÑOR(ES)</Text>
              <Text style={styles.valor}>{cliente.nombre}</Text>
            </View>
            <View style={[styles.filaCaja, styles.filaConBorde]}>
              <Text style={styles.etiqueta}>DIRECCIÓN</Text>
              <Text style={styles.valor}>{cliente.direccion}</Text>
            </View>
            <View style={[styles.filaCaja, styles.filaConBorde]}>
              <Text style={styles.etiqueta}>CIUDAD</Text>
              <Text style={styles.valor}>{cliente.ciudad}</Text>
            </View>
            <View style={styles.filaCaja}>
              <Text style={styles.etiqueta}>TELÉFONO</Text>
              <Text style={styles.valor}>{cliente.telefono}</Text>
              <Text style={styles.tipoDoc}>{cliente.tipoDocumento}</Text>
              <Text style={styles.numeroDoc}>{cliente.documento ?? ''}</Text>
            </View>
          </View>
          <View style={styles.cajaDer}>
            <Text style={styles.cabeceraDer}>FECHA DE EXPEDICIÓN</Text>
            <Text style={styles.valorDer}>{formatearFecha(datos.fecha)}</Text>
            <Text style={styles.cabeceraDer}>MEDIO DE PAGO</Text>
            <Text style={styles.valorDer}>{datos.medioDePago}</Text>
          </View>
        </View>

        <View style={styles.tablaCabecera}>
          <Text style={[styles.colItem, styles.centrado]}>Ítem</Text>
          <Text style={[styles.colPrecio, styles.centrado]}>Precio</Text>
          <Text style={[styles.colCantidad, styles.centrado]}>Cantidad</Text>
          <Text style={[styles.colDescuento, styles.centrado]}>Descuento</Text>
          <Text style={[styles.colTotal, styles.centrado]}>Total</Text>
        </View>
        <View style={styles.areaItems}>
          {datos.lineas.map((linea, indice) => (
            <View key={indice} style={styles.filaItem} wrap={false}>
              <Text style={styles.colItem}>{linea.servicio}</Text>
              <View style={[styles.colPrecio, styles.celdaNumero]}>
                <Text style={styles.alineadoDerecha}>{formatearMonto(linea.monto)}</Text>
              </View>
              <View style={[styles.colCantidad, styles.celdaNumero]}>
                <Text style={styles.centrado}>1</Text>
              </View>
              <View style={[styles.colDescuento, styles.celdaNumero]}>
                <Text style={styles.centrado}>0.00%</Text>
              </View>
              <View style={[styles.colTotal, styles.celdaNumero]}>
                <Text style={styles.alineadoDerecha}>{formatearMonto(linea.monto)}</Text>
              </View>
            </View>
          ))}
          {/* Empty row that carries the column rules down to the bottom. */}
          <View style={[styles.filaItem, { minHeight: altoRelleno }]}>
            <View style={[styles.colItem, { paddingVertical: 0 }]} />
            <View style={[styles.colPrecio, styles.celdaNumero]} />
            <View style={[styles.colCantidad, styles.celdaNumero]} />
            <View style={[styles.colDescuento, styles.celdaNumero]} />
            <View style={[styles.colTotal, styles.celdaNumero]} />
          </View>
        </View>

        {/* Totals and signature stay together and flow after the last item. */}
        <View wrap={false}>
          <View style={styles.resumen}>
            <View style={styles.resumenIzq}>
              <Text style={styles.enLetras}>
                <Text style={styles.negrita}>Son: </Text>
                {datos.totalEnLetras}
              </Text>
              <Text>
                <Text style={styles.negrita}>Concepto: </Text>
                {datos.concepto}
              </Text>
            </View>
            <View style={styles.totales}>
              <View style={styles.totalFila}>
                <Text style={styles.totalEtiqueta}>Subtotal</Text>
                <Text style={styles.totalValor}>{formatearMonto(datos.total)}</Text>
              </View>
              <View style={[styles.totalFila, styles.totalFilaGris]}>
                <Text style={styles.totalEtiqueta}>Total</Text>
                <Text style={styles.totalValor}>{formatearMonto(datos.total)}</Text>
              </View>
            </View>
          </View>

          {/* Left blank on purpose: whoever delivers the receipt signs it by hand. */}
          <View style={styles.firma}>
            <Text style={styles.firmaNombre}> </Text>
            <View style={styles.firmaLinea}>
              <Text style={styles.firmaEtiqueta}>ELABORADO POR</Text>
            </View>
          </View>
        </View>

        {datos.anulado ? <Text style={styles.anuladoMarca}>ANULADO</Text> : null}

        <Text style={styles.pie} fixed>
          Este documento no es una factura de venta.
        </Text>
      </Page>
    </Document>
  )
}

/** Renders the receipt to PDF bytes. Typed here so callers need no JSX. */
export function renderizarReciboPdf(props: ReciboPagoDocumentProps): Promise<Buffer> {
  return renderToBuffer(<ReciboPagoDocument {...props} />)
}

/**
 * PDF del recibo de pago. Server-only: se renderiza con `renderToBuffer`.
 *
 * Copy is neutral Spanish because the document goes to the client. It uses the
 * built-in Helvetica font (WinAnsi), which covers every accent and "Ñ" used in
 * Spanish; the smoke test checks that no glyph falls outside it.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { DatosRecibo } from '@/lib/utils/control-recibo'
import { formatearFecha, formatearMonto } from '@/lib/utils/control-format'

export interface EmisorRecibo {
  razonSocial: string
  nit: string
  direccion: string
  ciudad: string
  telefono: string
  email: string
}

export interface ReciboPagoDocumentProps {
  datos: DatosRecibo
  emisor: EmisorRecibo
  /** PNG bytes. When absent, the header is rendered without a logo. */
  logoBuffer?: Buffer | Uint8Array
}

const COLOR_TEXTO = '#1f2937'
const COLOR_SUAVE = '#6b7280'
const COLOR_LINEA = '#d1d5db'

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLOR_TEXTO,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  logo: { width: 140, objectFit: 'contain' },
  emisor: { alignItems: 'flex-end', maxWidth: 260 },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 2 },
  suave: { color: COLOR_SUAVE },
  tituloBloque: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLOR_LINEA,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  numero: { fontFamily: 'Helvetica-Bold', fontSize: 14, textAlign: 'right' },
  etiqueta: { fontSize: 8, color: COLOR_SUAVE, textTransform: 'uppercase', marginBottom: 2 },
  cliente: { marginBottom: 18 },
  clienteNombre: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  tablaCabecera: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: COLOR_TEXTO,
    paddingBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  fila: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: COLOR_LINEA,
    paddingVertical: 5,
  },
  colServicio: { flexGrow: 1, paddingRight: 8 },
  colValor: { width: 110, textAlign: 'right' },
  totalFila: { flexDirection: 'row', paddingTop: 8 },
  totalEtiqueta: { flexGrow: 1, fontFamily: 'Helvetica-Bold', textAlign: 'right', paddingRight: 8 },
  totalValor: { width: 110, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  enLetras: { marginTop: 10 },
  detalle: { marginTop: 16 },
  detalleFila: { flexDirection: 'row', marginBottom: 4 },
  detalleEtiqueta: { width: 90, fontFamily: 'Helvetica-Bold' },
  detalleValor: { flexGrow: 1, flexShrink: 1 },
  pie: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 30,
    borderTopWidth: 0.5,
    borderColor: COLOR_LINEA,
    paddingTop: 8,
    textAlign: 'center',
    fontSize: 9,
    color: COLOR_SUAVE,
  },
  anuladoMarca: {
    position: 'absolute',
    top: 300,
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
  const ubicacion = [emisor.direccion, emisor.ciudad].filter(Boolean).join(', ')

  return (
    <Document title={`Recibo de pago ${datos.numeroFormateado}`} author={emisor.razonSocial}>
      <Page size="A4" style={styles.page}>
        {datos.anulado ? <Text style={styles.anuladoBanner}>ANULADO</Text> : null}

        <View style={styles.header}>
          {logoBuffer ? (
            <Image src={{ data: Buffer.from(logoBuffer), format: 'png' }} style={styles.logo} />
          ) : (
            <View />
          )}
          <View style={styles.emisor}>
            <Text style={styles.emisorNombre}>{emisor.razonSocial}</Text>
            <Text>NIT {emisor.nit}</Text>
            <Text style={styles.suave}>{ubicacion}</Text>
            <Text style={styles.suave}>Tel. {emisor.telefono}</Text>
            <Text style={styles.suave}>{emisor.email}</Text>
          </View>
        </View>

        <View style={styles.tituloBloque}>
          <Text style={styles.titulo}>RECIBO DE PAGO</Text>
          <View>
            <Text style={styles.numero}>{datos.numeroFormateado}</Text>
            <Text style={[styles.suave, { textAlign: 'right' }]}>
              Fecha: {formatearFecha(datos.fecha)}
            </Text>
          </View>
        </View>

        <View style={styles.cliente}>
          <Text style={styles.etiqueta}>Cliente</Text>
          <Text style={styles.clienteNombre}>{datos.cliente.nombre}</Text>
          {datos.cliente.documento ? (
            <Text style={styles.suave}>Documento: {datos.cliente.documento}</Text>
          ) : null}
        </View>

        <View style={styles.tablaCabecera}>
          <Text style={styles.colServicio}>Servicio</Text>
          <Text style={styles.colValor}>Valor</Text>
        </View>
        {datos.lineas.map((linea, indice) => (
          <View key={indice} style={styles.fila} wrap={false}>
            <Text style={styles.colServicio}>{linea.servicio}</Text>
            <Text style={styles.colValor}>{formatearMonto(linea.monto)}</Text>
          </View>
        ))}

        <View style={styles.totalFila}>
          <Text style={styles.totalEtiqueta}>TOTAL</Text>
          <Text style={styles.totalValor}>{formatearMonto(datos.total)}</Text>
        </View>
        <Text style={styles.enLetras}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Son: </Text>
          {datos.totalEnLetras}
        </Text>

        <View style={styles.detalle}>
          <View style={styles.detalleFila}>
            <Text style={styles.detalleEtiqueta}>Medio de pago</Text>
            <Text style={styles.detalleValor}>{datos.medioDePago}</Text>
          </View>
          <View style={styles.detalleFila}>
            <Text style={styles.detalleEtiqueta}>Concepto</Text>
            <Text style={styles.detalleValor}>{datos.concepto}</Text>
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

# Migración del Excel — reporte previo

**Estado:** análisis terminado. **NO se importó nada todavía.**
**Alcance pedido:** movimientos desde enero-2026 · préstamos completos, sin corte de fecha.

Este documento es la Fase 3 del plan: el reporte de discrepancias que hay que
resolver **antes** de escribir en la base. Cada sección termina en una decisión
concreta.

---

## 1. Lo que ya está resuelto

El parser de `PAGOS POR DEBAJO` **cuadra exacto** contra el Excel:

| Periodo | Movs | Egresos de caja | Abonos | TOTAL del Excel | Diferencia |
|---|---:|---:|---:|---:|---:|
| 2026-01 | 13 | 990.000 | 384.000 | 990.000 | **0** |
| 2026-02 | 31 | 3.313.394 | 695.000 | 3.313.394 | **0** |
| 2026-03 | 38 | 3.137.800 | 1.032.000 | 2.926.800 | **+211.000** ⚠️ |
| 2026-04 | 29 | 2.492.000 | 608.000 | *(sin total)* | — |
| 2026-05 | 28 | 2.015.000 | 692.000 | *(sin total)* | — |
| 2026-06 | 21 | 1.526.000 | 670.300 | *(sin total)* | — |
| 2026-07 | 30 | 1.956.000 | 555.100 | *(sin total)* | — |
| 2026-08 | 5 | 444.000 | 0 | *(sin total)* | — |
| **Total** | **195** | **15.874.194** | **4.636.400** | | |

Los 211.000 de marzo **no son un error del parser**: son el error de fórmula ya
conocido (`SUM(K172:K201)` cuando el bloque arrancaba en 168). El parser
reproduce el Excel donde el Excel está bien y difiere donde está mal, que es
exactamente lo que tiene que hacer.

**Una sola anomalía:** `B158`, febrero, `LUISA` sin monto. La celda dice `NO` —
no se le pagó. Se saltea correctamente.

---

## 2. 🔴 El hallazgo que cambia el alcance

> **48.151.660 en 37 pagos a Fawer viven ÚNICAMENTE como texto libre dentro de
> celdas de la hoja `CUENTAS`.**

No están en `PAGOS POR DEBAJO`. No están en `PAGOS FAWER`, que muere el
26/01/2026. Están escritos a mano, así:

```
PAGO A FAWER 05/01  $400.000 DE EFECTIVO
PAGO A FAWER 03/02 1,439,040 DESDE IVONE
PAGO A FAWER 20/08 1,322,000 DESDE IVONE
```

**Son TRES VECES más plata que todo `PAGOS POR DEBAJO` de 2026** (48,1M contra
15,8M). Si migramos solo lo estructurado, estaríamos trayendo **una cuarta parte
del movimiento real**.

**La buena noticia:** el formato es sorprendentemente consistente. Los 37
parsearon al primer intento, y el texto trae el bolsillo:

| Bolsillo | Pagos |
|---|---:|
| IVONE | 30 |
| ADMON | 4 |
| EFECTIVO | 3 |

### Decisión 1
**¿Se parsean estos 37 pagos y se importan?**
Recomendación: **sí.** El formato es regular, trae fecha, monto y bolsillo, y sin
ellos la migración no representa la realidad. Cada uno quedaría con
`origenImport` apuntando a su celda para poder auditarlo.

---

## 3. 🟡 Hay más plata escondida en texto

En las mismas celdas de `CUENTAS` aparecen, con formato menos regular:

- `PRESTAMO JACKE $1,400,000` · `PRESTAMO DANI $1,000,000`
- `ABONO DANI 300,000` · `ABONO DANI 350,000` · `YUDY ABONA PRESTAMO: $...`
- `PAGO TATY 3,000,000` · `PRESTAMO TATY $3,000,...`
- `GUARDADO EN EFECTIVO: ...` · `ENTRA EN EFECTIVO: 2.1...`

Estas no tienen un patrón tan limpio como las de Fawer y **varias están
truncadas** en la celda.

### Decisión 2
**¿Se revisan una por una?**
Recomendación: **sí, pero como lista para que las apruebes**, no automático. Son
pocas (menos de 20) y cada una vale entre 300.000 y 3.000.000.

---

## 4. 🔴 Los saldos no van a cuadrar, y hay que asumirlo

La hoja `PAGOS POR DEBAJO` **no contiene los ingresos del negocio**. Ejemplo de
enero-2026 según `CUENTAS`:

| Bolsillo | Inicia | Finaliza | Movimiento neto |
|---|---:|---:|---:|
| IVONE | 344.000 | 5.200.000 | **+4.856.000** |
| EFECTIVO | 70.000 | 120.000 | +50.000 |
| ADMON | 17.860.000 | 5.512.000 | −12.348.000 |

Pero todo lo que tenemos documentado para enero son **990.000 de egresos**. La
plata que entró —y buena parte de la que salió— no está registrada en ninguna
hoja de forma estructurada.

**Consecuencia:** el saldo calculado por el sistema **no va a coincidir** con el
`FINALIZA CON` del Excel. Y eso está bien: el sistema va a mostrar lo que
realmente está documentado, en vez de un número que nadie puede reconstruir.

### Decisión 3
**¿Cómo arrancamos los saldos?**

- **Opción A (recomendada):** apertura en **enero-2026** con los saldos del Excel
  (IVONE 344.000 · EFECTIVO 70.000 · ADMON 17.860.000), y de ahí en adelante los
  saldos los calcula el sistema desde los movimientos que sí tenemos. Los meses
  viejos quedan descuadrados contra el Excel y se documenta por qué.
- **Opción B:** apertura en el mes actual con un conteo real, e importar los
  movimientos de 2026 solo como historial consultable, sin pretender que cuadren.

La A conserva la historia. La B arranca limpio. **A es la que yo elegiría**, pero
implica aceptar que los meses de 2026 van a mostrar diferencias.

---

## 5. 🔴 Préstamos: el estado no se puede derivar

**222 préstamos con nombre y monto. 38.819.900 en total.** Desde mayo-2021.

Clasificados por lo que dice el texto de seguimiento:

| El texto… | Préstamos | Monto |
|---|---:|---:|
| dice pagado / descontado / cancelado / ok | 175 | 25.012.000 |
| dice RESTA y no dice pagado | 1 | 150.000 |
| menciona abonos pero nunca cierra | 4 | 1.149.000 |
| **no tiene marca reconocible** | **42** | **12.508.900** |

Los 42 sin marca son el problema. Mirando el detalle, se mezclan dos cosas
distintas:

- **Préstamos viejos de 2022–2023** (`f26 DANIELA 1.500.000`, `f39 TATIANA
  2.000.000`) — casi seguro pagados, pero nadie lo anotó.
- **Préstamos recientes de 2026** (`f238 YUDY 45.000` del 18/08, `f240 YUDY
  200.000` del 24/08) — claramente vivos.

**Si los importo todos como abiertos, el sistema va a decir que el equipo debe
13.807.900. Eso sería falso.** Y ese número, apareciendo en pantalla, hace más
daño que no migrar nada.

> **Nota de honestidad:** intenté clasificarlos con expresiones regulares y me
> equivoqué dos veces. La segunda fue grosera: la palabra `PRESTAMO` contiene
> `RESTA`, así que todas las filas con la palabra "préstamo" me daban "abierto".
> Lo corregí, pero el episodio es la prueba de que **adivinar el estado desde
> texto libre no es confiable**, y no habría que apoyarse en eso.

### Decisión 4
**¿Qué hacemos con los préstamos?**

- **Opción A:** importar los 222 con su monto y fecha. Los 175 que dicen pagado
  entran cancelados. Los 47 restantes quedan abiertos, y te genero **una lista
  imprimible para que confirmes uno por uno** cuáles siguen vivos.
- **Opción B:** importar solo los que tengan movimiento en 2026 (los recientes,
  que son los que importan hoy) y archivar el resto como historial sin saldo.
- **Opción C:** vos me pasás el saldo real por persona (cuánto debe Jacke, cuánto
  Yudy, cuánto Tatiana, cuánto Daniela) y armo un préstamo consolidado por cada
  uno con ese número. El detalle histórico queda en el Excel congelado.

**C es la más rápida y la única que arranca con números ciertos.** A conserva el
detalle pero te deja 47 decisiones por tomar.

---

## 6. 🟡 Los abonos de 2026 no dicen a qué préstamo van

Detecté **27 abonos** en `PAGOS POR DEBAJO` (4.636.400), con monto y mes exactos:

```
2026-01  JACKE    162.000     2026-05  DANI     292.000
2026-01  TATIANA  162.000     2026-06  YUDY     210.000
2026-01  YUDY      60.000     2026-07  TATIANA  137.500   …
```

El problema: dicen **"JACKE 162.000"**, no **a cuál de sus 67 préstamos**. No hay
forma de cruzarlos automáticamente.

Esto refuerza la **Opción C** de la decisión anterior: con un préstamo
consolidado por persona, cada abono tiene un único destino posible y el cruce
deja de ser un problema.

---

## 7. 🟡 Enero y febrero no tienen día

| Mes | Filas con fecha explícita |
|---|---|
| enero-2026 | **0 de 15** |
| febrero-2026 | **0 de 34** |
| marzo-2026 | 25 de 40 |
| abril–julio | ~50% |
| agosto-2026 | 5 de 5 |

Las filas sin fecha son, casi siempre, los pagos fijos mensuales — que se hacen a
fin de mes.

**Propuesta:** usar el **último día del mes** para las que no tienen fecha, y
marcarlo en las notas del movimiento. El periodo (que es lo que importa para los
cierres) queda correcto; solo el día es aproximado, y queda dicho que lo es.

---

## Resumen de decisiones

| # | Decisión | Recomendación |
|---|---|---|
| 1 | Parsear los 37 pagos a Fawer del texto (48,1M) | **Sí** |
| 2 | Revisar las otras notas de texto de `CUENTAS` | **Sí, como lista para aprobar** |
| 3 | Saldos de apertura | **Enero-2026 con los del Excel**, asumiendo descuadres |
| 4 | Préstamos | **Consolidado por persona** con saldos que vos confirmes |
| 5 | Fechas de enero y febrero | Último día del mes, marcado en las notas |

Con esas cinco respuestas, el importador se escribe y se corre.

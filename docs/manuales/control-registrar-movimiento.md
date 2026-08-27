# Cómo registrar un movimiento en Control

Guía para el equipo. Explica qué significa cada campo de la ventana
**Nuevo movimiento** y cómo llenarla con casos reales del día a día.

> **Antes que nada:** un movimiento es **plata que se movió de verdad**. Si el
> dinero no entró ni salió de ningún bolsillo, no es un movimiento.

---

## Lo primero que hay que entender

En la parte de arriba de la ventana dice:

> *Los movimientos no se editan ni se borran. Si te equivocás, se anula con un
> contra-movimiento y queda el registro de los dos.*

Esto no es un capricho del sistema. Es **la razón por la que existe**.

En el Excel, cuando algo estaba mal, alguien lo corregía encima y el error
desaparecía. Así fue como entre noviembre y diciembre de 2025 la cuenta ADMON
cerró en 8.000.000 y abrió en 6.067.340: **1.932.660 que se esfumaron sin dejar
rastro**, y hoy nadie puede reconstruir qué pasó.

Acá eso no puede ocurrir. Si se equivoca, no lo borre: **anúlelo**. El sistema
crea un movimiento espejo que lo cancela, y quedan los dos a la vista con el
motivo. Al final las cuentas dan igual, pero se sabe qué pasó.

---

## Los campos, uno por uno

### 📅 Fecha

**Qué es:** el día en que la plata realmente se movió.

Viene con la fecha de hoy, que es lo correcto el 90% de las veces. Cámbiela solo
si está registrando algo de otro día.

**Ojo con esto:** la fecha decide **a qué mes pertenece** el movimiento. Si paga
algo el 31 de agosto pero lo registra el 2 de septiembre, la fecha debe decir
**31 de agosto** — si no, ese gasto se le suma al mes equivocado y el cierre de
agosto no va a cuadrar.

**Ejemplo:**
> Le pagó a Burbuja el viernes 29, pero recién lo carga el lunes 1.
> ➜ La fecha va **29**, no 1.

Si el mes ya está cerrado, el sistema no lo va a dejar guardar. Eso es a
propósito: un mes cerrado ya se dio por bueno.

---

### 🔀 Tipo

**Qué es:** hacia dónde va la plata. Hay tres opciones y no se mezclan.

| Tipo | Cuándo se usa | Ejemplo |
|---|---|---|
| **Ingreso — entra plata** | Alguien le paga a Admon | Un cliente paga la cotización de mensajería |
| **Egreso — sale plata** | Admon le paga a alguien | Gaseosas en Burbuja, la comisión de Carlos |
| **Traslado — entre bolsillos** | La plata cambia de lugar, pero sigue siendo de Admon | Sacar efectivo de la cuenta de Ivone para la caja menor |

**El traslado es el que más se confunde.** Un traslado **no es un gasto**: la
plata no se fue, solo cambió de bolsillo. Si registra un traslado como egreso,
el mes le va a mostrar un gasto que nunca existió.

**Ejemplo:**
> Pasa 500.000 de la cuenta de Ivone al efectivo de la oficina.
> ➜ Eso es **Traslado**, no egreso. Total gastado del mes: no cambia.

Cuando elige Traslado, el campo Bolsillo se parte en dos: **Desde** y **Hacia**.

---

### 💵 Monto

**Qué es:** cuánta plata se movió.

Se escribe en pesos y **siempre en positivo**, sin importar si entra o sale. El
sistema le pone los puntos de miles solo: usted escribe `40000` y ve `$ 40.000`.

**No lleva centavos** — no se usan en la práctica y solo se prestan a errores.

> ⚠️ **Nunca use el signo menos.** La dirección la da el **Tipo**, no el signo.
> Un egreso ya sabe que resta. Poner `-40000` en un egreso lo sumaría dos veces.

**Ejemplo:**
> Pagó 1.076.500 del pago por debajo de Jacke.
> ➜ Escriba `1076500`. El sistema muestra `$ 1.076.500`.

---

### ✍️ Concepto

**Qué es:** en pocas palabras, qué fue eso.

Es texto libre y es lo que va a leer alguien dentro de seis meses tratando de
entender el movimiento. Escríbalo pensando en esa persona.

| ✅ Sirve | ❌ No sirve |
|---|---|
| `Gaseosas para la reunión del lunes` | `Varios` |
| `Comisión Carlos — afiliación Sanitas` | `Pago` |
| `Pasajes al centro por trámite de Fawer` | `Transporte` |

**Truco:** si el concepto que escribió sirve para veinte movimientos distintos,
está muy general. Agréguele el para qué.

---

### 👛 Bolsillo

**Qué es:** de qué cuenta o caja salió (o a cuál entró) la plata.

Los bolsillos son los lugares donde Admon guarda dinero: `IVONE`, `EFECTIVO`,
`CAJA MENOR`, `ADMON`, `AHORRO EFECTIVO`.

**Es obligatorio y no hay forma de saltearlo.** Es el campo que hace que el
cierre del mes cuadre: si un movimiento no dice de dónde salió la plata, el
saldo de ese bolsillo queda mal para siempre.

**Ejemplo:**
> Sacó 40.000 de la caja menor para las gaseosas.
> ➜ Bolsillo: **CAJA MENOR**. No IVONE, aunque la plata originalmente
> viniera de ahí — eso ya fue otro movimiento (un traslado).

Si el tipo es **Traslado**, va a ver dos campos:
- **Desde:** de dónde sale
- **Hacia:** a dónde entra (el sistema no le deja elegir el mismo)

---

### 🏷️ Categoría

**Qué es:** qué **tipo** de gasto o ingreso es. Sirve para los reportes.

Es lo que después permite preguntar *"¿cuánto gastamos en transporte este año?"*
o *"¿cuánto pagamos en comisiones?"*.

Tiene buscador: **escriba dos o tres letras** en vez de bajar por la lista.
Escribiendo `gasto` le filtra todos los gastos operativos; escribiendo `burbuja`
le encuentra la categoría sin que tenga que saber en qué grupo quedó.

#### Si la categoría que necesita no existe

Use el botón **+ Crear categoría** arriba a la derecha. Le va a pedir dos cosas:

1. **El nombre** — cómo se va a llamar
2. **El grupo** — en qué renglón del reporte aparece (obligatorio)

> ⚠️ **Busque antes de crear.** Si crea "Papelería oficina" cuando ya existía
> "Papelería y oficina", el total se le parte en dos y ninguno de los dos
> números va a servir.
>
> El sistema lo ayuda: si escribe un nombre que ya existe (aunque sea con otras
> mayúsculas), en vez de crear una repetida le selecciona la que ya estaba.

**Ejemplo:**
> Compró veneno para fumigar la oficina y no encuentra dónde ponerlo.
> ➜ Busque primero `aseo`. Si no aparece nada que sirva, cree
> **"Aseo y fumigación"** en el grupo **Gastos operativos**.

---

### 👤 Contraparte *(opcional)*

**Qué es:** a quién le pagó, o quién le pagó a usted.

Es opcional, **pero llenarlo es lo que le da valor al sistema**. Es lo único que
después permite preguntar *"¿cuánto le pagamos a Burbuja este año?"* o
*"¿cuánto se le pagó a Yudy en total?"*.

En el Excel esto no se podía responder, porque el nombre de la persona y el tipo
de gasto estaban en la misma columna. Acá van separados: **la contraparte es el
quién, la categoría es el qué**.

**Ejemplo:**
> Gaseosas compradas en la tienda de Burbuja.
> ➜ Contraparte: **Burbuja** · Categoría: **Cafetería y bebidas**
>
> Así, a fin de año puede ver *cuánto le compró a Burbuja* y, por separado,
> *cuánto gastó en bebidas* (que puede incluir otras tiendas).

También tiene buscador. Si la persona no está en la lista, se crea desde
**Control → Catálogos → Contrapartes**.

**Cuándo dejarlo vacío:** cuando de verdad no hay nadie del otro lado. Un
traslado entre dos bolsillos propios, por ejemplo.

---

### 📝 Notas *(opcional)*

**Qué es:** todo lo que no cabe en el concepto.

El concepto es el titular; las notas son la letra chica. Úselas cuando algo
necesita explicación, sobre todo si es raro.

**Ejemplos de buenas notas:**
> - *"Se pagó en efectivo porque la transferencia falló. Comprobante en la carpeta de agosto."*
> - *"Es la segunda parte del arreglo de la oficina; la primera fue el 18."*
> - *"Don Luis pidió el adelanto antes de terminar el trabajo."*

Si dentro de seis meses alguien va a mirar ese movimiento y preguntar *"¿y esto
qué fue?"*, la respuesta va acá.

---

## Casos reales, paso a paso

### 1. Gaseosas para la oficina

| Campo | Valor |
|---|---|
| Fecha | El día que las compró |
| Tipo | **Egreso** |
| Monto | `40000` |
| Concepto | `Gaseosas para la oficina` |
| Bolsillo | **CAJA MENOR** |
| Categoría | **Cafetería y bebidas** |
| Contraparte | **Burbuja** |

---

### 2. Pasar plata de la cuenta de Ivone al efectivo

| Campo | Valor |
|---|---|
| Tipo | **Traslado** |
| Monto | `500000` |
| Concepto | `Retiro para caja de la oficina` |
| Desde | **IVONE** |
| Hacia | **EFECTIVO** |
| Categoría | **Traslado entre bolsillos** |
| Contraparte | *(vacío — no hay nadie del otro lado)* |

**El total de gastos del mes no cambia.** La plata sigue siendo de Admon.

---

### 3. Pago "por debajo" con descuento de préstamo

Este es el caso que en el Excel se anotaba en dos hojas distintas y nunca se
cruzaba. Acá **son dos movimientos**, y por eso funciona.

Jacke tiene un pago de `1.076.500` y le descuentan `200.000` de un préstamo.
Se lleva `876.500` en la mano.

**Movimiento 1 — el pago completo:**

| Campo | Valor |
|---|---|
| Tipo | **Egreso** |
| Monto | `1076500` ← el bruto, no el neto |
| Concepto | `Pago por debajo — agosto` |
| Categoría | **Pago por debajo** |
| Contraparte | **Jacke** |

**Movimiento 2 — el descuento:** no lo cargue a mano. Vaya a
**Control → Préstamos**, busque el préstamo de Jacke y use **Registrar abono**
por `200.000`. El sistema crea el movimiento solo y le baja el saldo.

> **Por qué así:** de la caja salen 1.076.500 y vuelven 200.000 → salida neta
> **876.500**, que es exactamente lo que Jacke se llevó. Y el préstamo queda con
> su abono registrado, **cruzado con el pago**. Una sola verdad, no dos
> anotaciones sueltas.

---

### 4. Comisión a un asesor

| Campo | Valor |
|---|---|
| Tipo | **Egreso** |
| Monto | `100000` |
| Concepto | `Comisión Carlos — afiliación Colpensiones` |
| Bolsillo | **IVONE** |
| Categoría | **Comisión de afiliación** |
| Contraparte | **Carlos** |

---

### 5. Servicios de mensajería y exámenes médicos

**Estos NO se cargan acá.** Van por **Control → Servicios**, porque tienen dos
partes que deben quedar unidas: lo que se cobra y lo que se entrega.

Si carga solo la entrega como un egreso suelto, el mes le va a mostrar un gasto
que no es de Admon — es plata de un tercero que solo pasó por la caja.

---

## Si se equivocó

**No borre. No cargue "lo mismo pero al revés" a mano.**

Vaya a la lista de movimientos, busque el que está mal, y en el menú de la
derecha elija **Anular**. Le va a pedir un motivo — escríbalo de verdad, es lo
que va a leer quien revise después.

El sistema crea el movimiento espejo automáticamente. Los dos quedan visibles: el
original tachado, y su anulación al lado. Después registre el movimiento
correcto.

> **Por qué el motivo es obligatorio:** una anulación sin explicación es el mismo
> agujero que dejaba el Excel. "Se anuló" no dice nada; "se cargó dos veces por
> error" sí.

---

## Preguntas frecuentes

**¿Qué pasa si no sé de qué bolsillo salió?**
Averígüelo antes de registrar. Es el único campo que no admite una aproximación:
un movimiento sin bolsillo correcto deja el saldo mal para siempre.

**¿Puedo dejar la categoría en "Varios"?**
Puede, pero si "Varios" se le empieza a llenar, es señal de que falta una
categoría real. Revísela cada tanto.

**¿Y si el gasto es de dos categorías a la vez?**
Cárguelo como dos movimientos separados, cada uno con su monto. Es más fiel que
forzar uno solo.

**¿Por qué no puedo poner un monto negativo?**
Porque la dirección la da el Tipo. Un egreso ya resta; un monto negativo en un
egreso terminaría sumando.

**¿Qué pasa si registro algo en un mes ya cerrado?**
El sistema no se lo permite. Si de verdad hace falta, hay que reabrir ese mes
desde **Cierre mensual** — y eso queda registrado.

---

## En una línea

> **Fecha** cuándo · **Tipo** para dónde · **Monto** cuánto · **Concepto** qué fue ·
> **Bolsillo** de dónde salió · **Categoría** de qué tipo es · **Contraparte** con quién

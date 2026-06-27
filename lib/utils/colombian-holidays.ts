/**
 * Festivos colombianos y conteo de días hábiles.
 *
 * Calcula los festivos según:
 * - Festivos fijos (no se trasladan).
 * - Ley 51 de 1983 ("Ley Emiliani"): se trasladan al lunes siguiente.
 * - Festivos derivados de la Pascua (Semana Santa, Ascensión, Corpus Christi,
 *   Sagrado Corazón).
 *
 * Todo el cálculo se hace en UTC para evitar corrimientos por la zona horaria
 * del servidor (Colombia es UTC-5, pero el servidor suele correr en UTC).
 */

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
function easterSundayUTC(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/** Traslada la fecha al lunes siguiente si no cae ya en lunes (Ley Emiliani). */
function moveToNextMonday(date: Date): Date {
  const day = date.getUTCDay() // 0 = domingo ... 6 = sábado
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  return addDaysUTC(date, add)
}

/** Clave estable YYYY-MM-DD a partir de los componentes UTC. */
function dateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Devuelve el conjunto de festivos colombianos de un año como claves YYYY-MM-DD.
 */
export function getColombianHolidays(year: number): Set<string> {
  const holidays: Date[] = [
    // Festivos fijos (no se trasladan)
    new Date(Date.UTC(year, 0, 1)), // Año Nuevo
    new Date(Date.UTC(year, 4, 1)), // Día del Trabajo
    new Date(Date.UTC(year, 6, 20)), // Día de la Independencia
    new Date(Date.UTC(year, 7, 7)), // Batalla de Boyacá
    new Date(Date.UTC(year, 11, 8)), // Inmaculada Concepción
    new Date(Date.UTC(year, 11, 25)), // Navidad

    // Festivos Emiliani (se trasladan al lunes siguiente)
    moveToNextMonday(new Date(Date.UTC(year, 0, 6))), // Reyes Magos
    moveToNextMonday(new Date(Date.UTC(year, 2, 19))), // San José
    moveToNextMonday(new Date(Date.UTC(year, 5, 29))), // San Pedro y San Pablo
    moveToNextMonday(new Date(Date.UTC(year, 7, 15))), // Asunción de la Virgen
    moveToNextMonday(new Date(Date.UTC(year, 9, 12))), // Día de la Raza
    moveToNextMonday(new Date(Date.UTC(year, 10, 1))), // Todos los Santos
    moveToNextMonday(new Date(Date.UTC(year, 10, 11))), // Independencia de Cartagena
  ]

  // Festivos derivados de la Pascua
  const easter = easterSundayUTC(year)
  holidays.push(addDaysUTC(easter, -3)) // Jueves Santo (no se traslada)
  holidays.push(addDaysUTC(easter, -2)) // Viernes Santo (no se traslada)
  holidays.push(moveToNextMonday(addDaysUTC(easter, 39))) // Ascensión del Señor
  holidays.push(moveToNextMonday(addDaysUTC(easter, 60))) // Corpus Christi
  holidays.push(moveToNextMonday(addDaysUTC(easter, 68))) // Sagrado Corazón

  return new Set(holidays.map(dateKey))
}

/** True si la fecha cae sábado o domingo (en UTC). */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

/**
 * Cuenta los días HÁBILES (excluye fines de semana y festivos colombianos)
 * dentro del rango [start, end], ambos inclusive.
 *
 * El conteo es por día calendario: la hora se ignora normalizando a medianoche
 * UTC. Soporta rangos que cruzan de un año a otro (diciembre → enero).
 */
export function businessDaysBetween(start: Date, end: Date): number {
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  )
  const last = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  )

  if (cursor > last) return 0

  // Cache de festivos por año (el rango puede abarcar más de un año).
  const holidayCache = new Map<number, Set<string>>()
  const holidaysFor = (year: number): Set<string> => {
    let set = holidayCache.get(year)
    if (!set) {
      set = getColombianHolidays(year)
      holidayCache.set(year, set)
    }
    return set
  }

  let count = 0
  while (cursor <= last) {
    if (!isWeekend(cursor) && !holidaysFor(cursor.getUTCFullYear()).has(dateKey(cursor))) {
      count++
    }
    cursor = addDaysUTC(cursor, 1)
  }
  return count
}

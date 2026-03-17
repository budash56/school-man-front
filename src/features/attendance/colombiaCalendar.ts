export type ColombiaHoliday = {
  date: string
  name: string
}

export type CalendarDay = {
  key: string
  isoDate: string
  dayNumber: number
  isCurrentMonth: boolean
  isWeekend: boolean
  holidayName: string | null
}

const dayLabelFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
})

const pad = (value: number) => String(value).padStart(2, '0')

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

export const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const moveToNextMonday = (date: Date) => {
  const next = new Date(date)
  const day = next.getDay()
  const offset = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  next.setDate(next.getDate() + offset)
  return next
}

const getEasterSunday = (year: number) => {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const buildHolidayDate = (
  year: number,
  month: number,
  day: number,
  name: string,
  moveToMonday = false,
): ColombiaHoliday => {
  const date = new Date(year, month - 1, day)
  return {
    date: toIsoDate(moveToMonday ? moveToNextMonday(date) : date),
    name,
  }
}

export const getColombiaHolidays = (year: number): ColombiaHoliday[] => {
  const easterSunday = getEasterSunday(year)
  const holyThursday = addDays(easterSunday, -3)
  const goodFriday = addDays(easterSunday, -2)

  const holidays: ColombiaHoliday[] = [
    buildHolidayDate(year, 1, 1, 'Año Nuevo'),
    buildHolidayDate(year, 1, 6, 'Día de los Reyes Magos', true),
    buildHolidayDate(year, 3, 19, 'Día de San José', true),
    { date: toIsoDate(holyThursday), name: 'Jueves Santo' },
    { date: toIsoDate(goodFriday), name: 'Viernes Santo' },
    buildHolidayDate(year, 5, 1, 'Día del Trabajo'),
    {
      date: toIsoDate(moveToNextMonday(addDays(easterSunday, 43))),
      name: 'Ascensión del Señor',
    },
    {
      date: toIsoDate(moveToNextMonday(addDays(easterSunday, 64))),
      name: 'Corpus Christi',
    },
    {
      date: toIsoDate(moveToNextMonday(addDays(easterSunday, 71))),
      name: 'Sagrado Corazón de Jesús',
    },
    buildHolidayDate(year, 6, 29, 'San Pedro y San Pablo', true),
    buildHolidayDate(year, 7, 20, 'Día de la Independencia'),
    buildHolidayDate(year, 8, 7, 'Batalla de Boyacá'),
    buildHolidayDate(year, 8, 15, 'La Asunción de la Virgen', true),
    buildHolidayDate(year, 10, 12, 'Día de la Raza', true),
    buildHolidayDate(year, 11, 1, 'Día de Todos los Santos', true),
    buildHolidayDate(year, 11, 11, 'Independencia de Cartagena', true),
    buildHolidayDate(year, 12, 8, 'Inmaculada Concepción'),
    buildHolidayDate(year, 12, 25, 'Navidad'),
  ]

  return holidays.sort((left, right) => left.date.localeCompare(right.date))
}

export const buildCalendarMonth = (monthDate: Date) => {
  const firstDay = startOfMonth(monthDate)
  const holidays = new Map(
    getColombiaHolidays(firstDay.getFullYear()).map((holiday) => [holiday.date, holiday.name]),
  )

  const startOffset = (firstDay.getDay() + 6) % 7
  const gridStart = addDays(firstDay, -startOffset)
  const days: CalendarDay[] = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const isoDate = toIsoDate(date)
    const dayOfWeek = date.getDay()

    return {
      key: isoDate,
      isoDate,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === firstDay.getMonth(),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      holidayName: holidays.get(isoDate) ?? null,
    }
  })

  const weeks: CalendarDay[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return {
    label: dayLabelFormatter.format(firstDay),
    holidays: getColombiaHolidays(firstDay.getFullYear()),
    weeks,
  }
}

export const isInstructionalDay = (isoDate: string) => {
  const date = parseIsoDate(isoDate)
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }

  const holidays = getColombiaHolidays(date.getFullYear())
  return !holidays.some((holiday) => holiday.date === isoDate)
}

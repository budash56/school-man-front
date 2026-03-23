import type { CalendarEvent, CalendarEventCategory } from '../../api/calendarEventsApi'
import type { SchoolYear } from '../../api/schoolYearsApi'
import type { Term } from '../../api/termsApi'

export type AcademicCalendarItem = {
  id: string
  title: string
  startDate: string
  endDate: string
  category: 'school_year' | 'term' | CalendarEventCategory
  kind: string
}

const dateRangeFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
})

export const periodTones = {
  P1: '#74a9ff',
  P2: '#63cfa0',
  P3: '#f2b66d',
  P4: '#e589a1',
} as const

export const getPeriodColor = (kind: string) =>
  periodTones[kind as keyof typeof periodTones] ?? '#95a2b3'

export const getCalendarItemColor = (category: AcademicCalendarItem['category']) => {
  if (category === 'school_year') {
    return 'primary'
  }
  if (category === 'term') {
    return 'secondary'
  }
  if (category === 'communication') {
    return 'info'
  }
  if (
    category === 'official' ||
    category === 'retake_period' ||
    category === 'enrollment_period'
  ) {
    return 'warning'
  }
  return 'success'
}

export const getCalendarItemLabel = (item: AcademicCalendarItem) => {
  if (item.category === 'school_year') {
    return 'Año escolar'
  }
  if (item.category === 'term') {
    return item.kind.replace('P', 'Periodo ')
  }
  if (item.category === 'communication') {
    return 'Comunicado'
  }
  if (item.category === 'official') {
    return 'Oficial'
  }
  if (item.category === 'retake_period') {
    return 'Retomas'
  }
  if (item.category === 'enrollment_period') {
    return 'Matrículas'
  }
  if (item.category === 'teacher_exam') {
    return 'Evaluación'
  }
  if (item.category === 'teacher_homework') {
    return 'Tarea'
  }
  return 'Evento'
}

export const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate}${startDate !== endDate ? ` - ${endDate}` : ''}`
  }

  const startLabel = dateRangeFormatter.format(start)
  const endLabel = dateRangeFormatter.format(end)
  return startDate === endDate ? startLabel : `${startLabel} - ${endLabel}`
}

export const isItemOnDate = (item: AcademicCalendarItem, isoDate: string) =>
  item.startDate <= isoDate && item.endDate >= isoDate

export const buildAcademicCalendarItems = (
  schoolYear: SchoolYear | null,
  terms: Term[],
  events: CalendarEvent[],
): AcademicCalendarItem[] => {
  if (!schoolYear) {
    return []
  }

  const items: AcademicCalendarItem[] = [
    {
      id: `school-year-start-${schoolYear.schoolYearId}`,
      title: `Inicio año escolar ${schoolYear.name}`,
      startDate: schoolYear.yearStart,
      endDate: schoolYear.yearStart,
      category: 'school_year',
      kind: 'school_year_start',
    },
    {
      id: `school-year-end-${schoolYear.schoolYearId}`,
      title: `Fin año escolar ${schoolYear.name}`,
      startDate: schoolYear.yearEnd,
      endDate: schoolYear.yearEnd,
      category: 'school_year',
      kind: 'school_year_end',
    },
    ...terms.map<AcademicCalendarItem>((term) => ({
      id: `term-${term.termId}`,
      title: `Periodo ${term.name.replace('P', '')}`,
      startDate: term.startDate,
      endDate: term.endDate,
      category: 'term',
      kind: term.name,
    })),
    ...events.map<AcademicCalendarItem>((event) => ({
      id: `event-${event.calendarEventId}`,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      category: event.category,
      kind: event.kind,
    })),
  ]

  return items.sort((left, right) => left.startDate.localeCompare(right.startDate))
}

export const getImportantAcademicItems = (
  items: AcademicCalendarItem[],
  todayIso: string,
) =>
  items
    .filter(
      (item) =>
        item.endDate >= todayIso &&
        [
          'school_year',
          'term',
          'official',
          'retake_period',
          'enrollment_period',
        ].includes(item.category),
    )
    .slice(0, 6)

export const getUpcomingAcademicItems = (
  items: AcademicCalendarItem[],
  todayIso: string,
) =>
  items
    .filter((item) => item.endDate >= todayIso)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))

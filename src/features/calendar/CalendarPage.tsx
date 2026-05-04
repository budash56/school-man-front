import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { alpha, type Theme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  calendarEventsApi,
  type CalendarEventCategory,
  type CalendarEventVisibilityScope,
} from '../../api/calendarEventsApi'
import { coursesApi } from '../../api/coursesApi'
import { schoolYearsApi } from '../../api/schoolYearsApi'
import { subjectAreasApi } from '../../api/subjectAreasApi'
import { termsApi, type Term } from '../../api/termsApi'
import { usersApi } from '../../api/usersApi'
import { useAuth } from '../auth/AuthContext'
import {
  addDays,
  buildCalendarMonth,
  parseIsoDate,
  startOfMonth,
  toIsoDate,
} from '../attendance/colombiaCalendar'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'

type CalendarDisplayItem = {
  id: string
  source: 'system' | 'event'
  title: string
  description: string | null
  startDate: string
  endDate: string
  category: CalendarEventCategory | 'school_year' | 'term'
  kind: string
  editable: boolean
  createdByName?: string | null
  calendarEventId?: number
}

type CalendarDayMarkerTone =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'
  | 'default'

type CalendarDayMarker = {
  key: string
  label: string
  tone: CalendarDayMarkerTone
  priority: number
}

type AdminEventDraft = {
  title: string
  description: string
  category: Extract<
    CalendarEventCategory,
    'communication' | 'official' | 'retake_period' | 'enrollment_period'
  >
  kind: string
  startDate: string
  endDate: string
  visibilityScope: Extract<
    CalendarEventVisibilityScope,
    'everyone' | 'registrars' | 'all_teachers' | 'selected_teachers' | 'teacher_areas'
  >
  targetTeacherIds: string[]
  targetAreaIds: number[]
}

type TeacherEventDraft = {
  title: string
  description: string
  category: Extract<
    CalendarEventCategory,
    'teacher_exam' | 'teacher_homework' | 'teacher_custom'
  >
  startDate: string
  endDate: string
  targetClassGroupIds: number[]
}

const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const requiredTermNames = ['P1', 'P2', 'P3', 'P4'] as const
const adminCategoryOptions: Array<{
  value: AdminEventDraft['category']
  label: string
}> = [
  { value: 'communication', label: 'Comunicado' },
  { value: 'official', label: 'Fecha oficial' },
  { value: 'retake_period', label: 'Periodo de retomas' },
  { value: 'enrollment_period', label: 'Periodo de matrículas' },
]
const adminKindOptions: Record<AdminEventDraft['category'], Array<{ value: string; label: string }>> = {
  communication: [
    { value: 'announcement', label: 'Comunicado general' },
    { value: 'meeting', label: 'Reunión' },
    { value: 'custom', label: 'Otro' },
  ],
  official: [
    { value: 'school_break', label: 'Receso' },
    { value: 'special_day', label: 'Día especial' },
    { value: 'graduation', label: 'Graduación' },
    { value: 'custom', label: 'Otro' },
  ],
  retake_period: [{ value: 'retake_period', label: 'Retomas' }],
  enrollment_period: [{ value: 'enrollment_period', label: 'Matrículas' }],
}
const visibilityOptions: Array<{
  value: AdminEventDraft['visibilityScope']
  label: string
}> = [
  { value: 'everyone', label: 'Todos' },
  { value: 'registrars', label: 'Registro' },
  { value: 'all_teachers', label: 'Todos los profesores' },
  { value: 'selected_teachers', label: 'Profesores específicos' },
  { value: 'teacher_areas', label: 'Áreas' },
]
const teacherCategoryOptions: Array<{
  value: TeacherEventDraft['category']
  label: string
}> = [
  { value: 'teacher_exam', label: 'Examen o prueba' },
  { value: 'teacher_homework', label: 'Tarea' },
  { value: 'teacher_custom', label: 'Personalizado' },
]

const getDefaultAdminDraft = (): AdminEventDraft => ({
  title: '',
  description: '',
  category: 'communication',
  kind: 'announcement',
  startDate: '',
  endDate: '',
  visibilityScope: 'all_teachers',
  targetTeacherIds: [],
  targetAreaIds: [],
})

const getDefaultTeacherDraft = (): TeacherEventDraft => ({
  title: '',
  description: '',
  category: 'teacher_exam',
  startDate: '',
  endDate: '',
  targetClassGroupIds: [],
})

const formatShortDateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
  }).format(parsed)
}

const formatDateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

const isWithinRange = (date: string, startDate: string, endDate: string) =>
  startDate <= date && date <= endDate

const getEventChipColor = (category: CalendarDisplayItem['category']) => {
  if (category === 'school_year' || category === 'term') {
    return 'primary'
  }
  if (category === 'communication') {
    return 'secondary'
  }
  if (category === 'official') {
    return 'success'
  }
  if (category === 'retake_period' || category === 'enrollment_period') {
    return 'warning'
  }
  return 'default'
}

const getItemKindLabel = (item: CalendarDisplayItem) => {
  if (item.category === 'school_year') {
    return 'Año escolar'
  }
  if (item.category === 'term') {
    return 'Periodo'
  }
  return item.kind
}

const getMarkerPalette = (theme: Theme, tone: CalendarDayMarkerTone) => {
  switch (tone) {
    case 'primary':
      return theme.palette.primary
    case 'secondary':
      return theme.palette.secondary
    case 'success':
      return theme.palette.success
    case 'warning':
      return theme.palette.warning
    case 'info':
      return theme.palette.info
    case 'error':
      return theme.palette.error
    default:
      return {
        main: theme.palette.text.secondary,
        dark: theme.palette.text.primary,
      }
  }
}

const getMarkerBadgeSx = (tone: CalendarDayMarkerTone) => (theme: Theme) => {
  const palette = getMarkerPalette(theme, tone)
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    px: 0.6,
    py: 0.15,
    borderRadius: 999,
    border: '1px solid',
    borderColor: alpha(palette.main, 0.45),
    bgcolor: alpha(palette.main, theme.palette.mode === 'dark' ? 0.24 : 0.14),
    color: palette.dark ?? palette.main,
    fontSize: '0.62rem',
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: 0.2,
    whiteSpace: 'nowrap',
  }
}

const CalendarMarkerBadge = ({ label, tone }: { label: string; tone: CalendarDayMarkerTone }) => (
  <Box component="span" sx={getMarkerBadgeSx(tone)}>
    {label}
  </Box>
)

const getItemMarkers = (item: CalendarDisplayItem): CalendarDayMarker[] => {
  if (item.category === 'term') {
    return [
      {
        key: item.kind,
        label: item.kind,
        tone: 'primary',
        priority: 10,
      },
    ]
  }

  if (item.category === 'school_year') {
    return [
      {
        key: item.kind,
        label: item.kind === 'school_year_start' ? 'Ini' : 'Fin',
        tone: 'info',
        priority: 60,
      },
    ]
  }

  if (item.category === 'communication') {
    return [
      {
        key: item.kind === 'meeting' ? 'communication-meeting' : 'communication',
        label: item.kind === 'meeting' ? 'Reu' : 'Com',
        tone: 'secondary',
        priority: 40,
      },
    ]
  }

  if (item.category === 'official') {
    if (item.kind === 'school_break') {
      return [{ key: 'official-school-break', label: 'Rec', tone: 'success', priority: 20 }]
    }
    if (item.kind === 'graduation') {
      return [{ key: 'official-graduation', label: 'Grad', tone: 'success', priority: 30 }]
    }
    if (item.kind === 'special_day') {
      return [{ key: 'official-special-day', label: 'Esp', tone: 'success', priority: 35 }]
    }
    return [{ key: `official-${item.kind}`, label: 'Ofi', tone: 'success', priority: 35 }]
  }

  if (item.category === 'retake_period') {
    return [{ key: 'retake-period', label: 'Ret', tone: 'warning', priority: 25 }]
  }

  if (item.category === 'enrollment_period') {
    return [{ key: 'enrollment-period', label: 'Mat', tone: 'warning', priority: 27 }]
  }

  if (item.category === 'teacher_exam') {
    return [{ key: 'teacher-exam', label: 'Eval', tone: 'error' as CalendarDayMarkerTone, priority: 50 }]
  }

  if (item.category === 'teacher_homework') {
    return [{ key: 'teacher-homework', label: 'Tarea', tone: 'default', priority: 52 }]
  }

  return [{ key: `teacher-${item.kind}`, label: 'Doc', tone: 'default', priority: 54 }]
}

const buildOfficialItems = (
  schoolYear:
    | {
        schoolYearId: number
        name: string
        yearStart: string
        yearEnd: string
      }
    | null,
  terms: Term[],
): CalendarDisplayItem[] => {
  if (!schoolYear) {
    return []
  }

  const items: CalendarDisplayItem[] = [
    {
      id: `school-year-start-${schoolYear.schoolYearId}`,
      source: 'system',
      title: `Inicio año escolar ${schoolYear.name}`,
      description: 'Fecha oficial de apertura del año escolar.',
      startDate: schoolYear.yearStart,
      endDate: schoolYear.yearStart,
      category: 'school_year',
      kind: 'school_year_start',
      editable: false,
    },
    {
      id: `school-year-end-${schoolYear.schoolYearId}`,
      source: 'system',
      title: `Fin año escolar ${schoolYear.name}`,
      description: 'Fecha oficial de cierre del año escolar.',
      startDate: schoolYear.yearEnd,
      endDate: schoolYear.yearEnd,
      category: 'school_year',
      kind: 'school_year_end',
      editable: false,
    },
  ]

  terms.forEach((term) => {
    items.push({
      id: `term-${term.termId}`,
      source: 'system',
      title: `Periodo ${term.name.replace('P', '')}`,
      description: `Rango oficial del ${term.name}.`,
      startDate: term.startDate,
      endDate: term.endDate,
      category: 'term',
      kind: term.name,
      editable: false,
    })
  })

  return items
}

const getTeacherEventKind = (category: TeacherEventDraft['category']) => {
  if (category === 'teacher_exam') {
    return 'exam'
  }
  if (category === 'teacher_homework') {
    return 'homework'
  }
  return 'custom'
}

const CalendarPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(toIsoDate(today))
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today))
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | ''>('')
  const [yearDraft, setYearDraft] = useState({ yearStart: '', yearEnd: '' })
  const [termDrafts, setTermDrafts] = useState<Record<string, { startDate: string; endDate: string }>>({})
  const [adminDraft, setAdminDraft] = useState<AdminEventDraft>(getDefaultAdminDraft())
  const [teacherDraft, setTeacherDraft] = useState<TeacherEventDraft>(getDefaultTeacherDraft())
  const [pageMessage, setPageMessage] = useState<string | null>(null)
  const [requiredConfigExpanded, setRequiredConfigExpanded] = useState(true)
  const [adminEventExpanded, setAdminEventExpanded] = useState(false)

  const isAdminLike = user?.role === 'admin' || user?.role === 'coordinator'
  const isTeacher = user?.role === 'teacher'
  const isRegistrar = user?.role === 'registrar'

  const { data: schoolYears, isLoading: isLoadingYears } = useSchoolYearsQuery()

  const sortedSchoolYears = useMemo(() => {
    return (schoolYears ?? []).slice().sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1
      }
      return right.yearStart.localeCompare(left.yearStart)
    })
  }, [schoolYears])

  useEffect(() => {
    if (selectedSchoolYearId !== '' || sortedSchoolYears.length === 0) {
      return
    }
    const activeYear = sortedSchoolYears.find((schoolYear) => schoolYear.isActive)
    setSelectedSchoolYearId(activeYear?.schoolYearId ?? sortedSchoolYears[0]?.schoolYearId ?? '')
  }, [selectedSchoolYearId, sortedSchoolYears])

  const activeSchoolYear = useMemo(
    () =>
      sortedSchoolYears.find((schoolYear) => schoolYear.schoolYearId === selectedSchoolYearId) ?? null,
    [selectedSchoolYearId, sortedSchoolYears],
  )

  useEffect(() => {
    if (!activeSchoolYear) {
      return
    }
    setYearDraft({
      yearStart: activeSchoolYear.yearStart,
      yearEnd: activeSchoolYear.yearEnd,
    })
  }, [activeSchoolYear])

  const {
    data: terms = [],
    isLoading: isLoadingTerms,
  } = useQuery({
    queryKey: ['calendar-terms', selectedSchoolYearId],
    queryFn: () =>
      termsApi.list({
        schoolYearId: Number(selectedSchoolYearId),
      }),
    enabled: selectedSchoolYearId !== '',
  })

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      requiredTermNames.map((name) => {
        const term = terms.find((entry) => entry.name === name)
        return [
          name,
          {
            startDate: term?.startDate ?? '',
            endDate: term?.endDate ?? '',
          },
        ]
      }),
    ) as Record<string, { startDate: string; endDate: string }>

    setTermDrafts(nextDrafts)
  }, [terms])

  const {
    data: events = [],
    isLoading: isLoadingEvents,
  } = useQuery({
    queryKey: ['calendar-events', selectedSchoolYearId, user?.nationalId, user?.role],
    queryFn: () =>
      calendarEventsApi.list({
        schoolYearId: Number(selectedSchoolYearId),
      }),
    enabled: selectedSchoolYearId !== '',
  })

  const { data: teacherUsersResult } = useQuery({
    queryKey: ['calendar-teachers'],
    queryFn: () => usersApi.list({ role: 'teacher', page: 1, pageSize: 250 }),
    enabled: isAdminLike,
  })

  const { data: subjectAreasResult } = useQuery({
    queryKey: ['calendar-areas'],
    queryFn: () => subjectAreasApi.list({ page: 1, pageSize: 250 }),
    enabled: isAdminLike,
  })

  const { data: teacherCourses = [] } = useQuery({
    queryKey: ['calendar-teacher-courses', selectedSchoolYearId, user?.nationalId],
    queryFn: () =>
      coursesApi.list({
        schoolYearId: Number(selectedSchoolYearId),
        teacherId: user?.nationalId,
      }),
    enabled: Boolean(isTeacher && user?.nationalId && selectedSchoolYearId !== ''),
  })

  const teacherUsers = teacherUsersResult?.data ?? []
  const subjectAreas = subjectAreasResult?.data ?? []

  const teacherClassGroups = useMemo(() => {
    const map = new Map<number, { classGroupId: number; label: string }>()
    teacherCourses.forEach((course) => {
      if (!map.has(course.classGroupId)) {
        map.set(course.classGroupId, {
          classGroupId: course.classGroupId,
          label: course.classGroupCode || `${course.gradeLevel}${course.section}`,
        })
      }
    })
    return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, 'es'))
  }, [teacherCourses])

  const officialItems = useMemo(
    () => buildOfficialItems(activeSchoolYear, terms),
    [activeSchoolYear, terms],
  )

  const calendarItems = useMemo<CalendarDisplayItem[]>(
    () =>
      [
        ...officialItems,
        ...events.map((event): CalendarDisplayItem => ({
          id: `event-${event.calendarEventId}`,
          source: 'event',
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          category: event.category,
          kind: event.kind,
          editable: event.editable,
          createdByName: event.createdByName,
          calendarEventId: event.calendarEventId,
        })),
      ].sort((left, right) => {
        if (left.startDate !== right.startDate) {
          return left.startDate.localeCompare(right.startDate)
        }
        return left.title.localeCompare(right.title, 'es')
      }),
    [events, officialItems],
  )

  const calendarMonth = useMemo(() => buildCalendarMonth(visibleMonth), [visibleMonth])
  const dayMarkersByDate = useMemo(() => {
    const markersByDate = new Map<string, CalendarDayMarker[]>()
    const monthDays = calendarMonth.weeks.flat()
    const monthStart = monthDays[0]?.isoDate
    const monthEnd = monthDays[monthDays.length - 1]?.isoDate

    if (!monthStart || !monthEnd) {
      return markersByDate
    }

    calendarItems.forEach((item) => {
      const itemMarkers = getItemMarkers(item)
      const clampedStart = item.startDate > monthStart ? item.startDate : monthStart
      const clampedEnd = item.endDate < monthEnd ? item.endDate : monthEnd
      if (clampedStart > clampedEnd) {
        return
      }

      let cursor = parseIsoDate(clampedStart)
      while (toIsoDate(cursor) <= clampedEnd) {
        const dateKey = toIsoDate(cursor)
        const currentMarkers = markersByDate.get(dateKey) ?? []
        itemMarkers.forEach((marker) => {
          if (!currentMarkers.some((existing) => existing.key === marker.key)) {
            currentMarkers.push(marker)
          }
        })
        currentMarkers.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label, 'es'))
        markersByDate.set(dateKey, currentMarkers)
        cursor = addDays(cursor, 1)
      }
    })

    return markersByDate
  }, [calendarItems, calendarMonth.weeks])

  const selectedDateItems = useMemo(
    () =>
      calendarItems.filter((item) =>
        isWithinRange(selectedDate, item.startDate, item.endDate),
      ),
    [calendarItems, selectedDate],
  )

  const upcomingItems = useMemo(
    () =>
      calendarItems
        .filter((item) => item.endDate >= toIsoDate(today))
        .slice(0, 8),
    [calendarItems, today],
  )

  const missingRequiredTerms = useMemo(
    () =>
      requiredTermNames.filter((name) => {
        const draft = termDrafts[name]
        return !draft?.startDate || !draft?.endDate
      }),
    [termDrafts],
  )

  const optionalWarnings = useMemo(() => {
    const warnings: string[] = []
    if (!events.some((event) => event.category === 'official' && event.kind === 'school_break')) {
      warnings.push('Falta registrar al menos un receso oficial.')
    }
    if (!events.some((event) => event.category === 'official' && event.kind === 'graduation')) {
      warnings.push('Falta registrar la graduación o acto de cierre, si aplica.')
    }
    if (!events.some((event) => event.category === 'retake_period')) {
      warnings.push('Falta registrar el periodo oficial de retomas.')
    }
    if (!events.some((event) => event.category === 'enrollment_period')) {
      warnings.push('Falta registrar el periodo oficial de matrículas.')
    }
    return warnings
  }, [events])

  const requiredConfigurationReady =
    Boolean(yearDraft.yearStart && yearDraft.yearEnd) && missingRequiredTerms.length === 0

  const adminEventSummary = useMemo(() => {
    const details: string[] = []

    const categoryLabel =
      adminCategoryOptions.find((option) => option.value === adminDraft.category)?.label ??
      'Evento administrativo'
    const kindLabel =
      adminKindOptions[adminDraft.category].find((option) => option.value === adminDraft.kind)
        ?.label ?? adminDraft.kind

    details.push(adminDraft.title.trim() || kindLabel || categoryLabel)
    details.push(categoryLabel)

    if (adminDraft.startDate && adminDraft.endDate) {
      details.push(
        adminDraft.startDate === adminDraft.endDate
          ? formatDateLabel(adminDraft.startDate)
          : `${formatShortDateLabel(adminDraft.startDate)} - ${formatShortDateLabel(adminDraft.endDate)}`,
      )
    }

    if (adminDraft.category === 'communication') {
      const visibilityLabel =
        visibilityOptions.find((option) => option.value === adminDraft.visibilityScope)?.label ??
        adminDraft.visibilityScope
      details.push(`Visible: ${visibilityLabel}`)
    }

    return details.join(' · ')
  }, [adminDraft])

  const configuredTermSummary = useMemo(
    () =>
      requiredTermNames
        .map((name) => {
          const draft = termDrafts[name]
          if (!draft?.startDate || !draft?.endDate) {
            return null
          }
          return `${name}: ${formatShortDateLabel(draft.startDate)} - ${formatShortDateLabel(draft.endDate)}`
        })
        .filter(Boolean) as string[],
    [termDrafts],
  )

  useEffect(() => {
    if (!requiredConfigurationReady) {
      setRequiredConfigExpanded(true)
      return
    }
    setRequiredConfigExpanded(false)
  }, [requiredConfigurationReady, selectedSchoolYearId])

  const updateYearMutation = useMutation({
    mutationFn: () => {
      if (!activeSchoolYear) {
        throw new Error('Selecciona un año escolar.')
      }
      return schoolYearsApi.update(activeSchoolYear.schoolYearId, {
        startDate: yearDraft.yearStart,
        endDate: yearDraft.yearEnd,
      })
    },
    onSuccess: async () => {
      setPageMessage('Año escolar actualizado.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['school-years'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-terms'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
      ])
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo actualizar el año escolar.')
    },
  })

  const saveTermMutation = useMutation({
    mutationFn: async (name: (typeof requiredTermNames)[number]) => {
      const draft = termDrafts[name]
      if (!draft?.startDate || !draft?.endDate || selectedSchoolYearId === '') {
        throw new Error(`Completa las fechas de ${name}.`)
      }

      const existing = terms.find((term) => term.name === name)
      if (existing) {
        return termsApi.update(existing.termId, {
          schoolYearId: Number(selectedSchoolYearId),
          name,
          startDate: draft.startDate,
          endDate: draft.endDate,
        })
      }

      return termsApi.create({
        schoolYearId: Number(selectedSchoolYearId),
        name,
        startDate: draft.startDate,
        endDate: draft.endDate,
      })
    },
    onSuccess: async (_, name) => {
      setPageMessage(`${name} guardado.`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar-terms'] }),
        queryClient.invalidateQueries({ queryKey: ['terms'] }),
      ])
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo guardar el periodo.')
    },
  })

  const handleSaveTerm = (name: (typeof requiredTermNames)[number]) => {
    const draft = termDrafts[name]
    const existing = terms.find((term) => term.name === name)

    if (
      existing &&
      draft &&
      (existing.startDate !== draft.startDate || existing.endDate !== draft.endDate)
    ) {
      const confirmed = window.confirm(
        `Vas a cambiar las fechas de ${name}.\nActual: ${formatDateLabel(existing.startDate)} - ${formatDateLabel(existing.endDate)}\nNuevo: ${formatDateLabel(draft.startDate)} - ${formatDateLabel(draft.endDate)}\n\n¿Confirmas el cambio?`,
      )

      if (!confirmed) {
        return
      }
    }

    saveTermMutation.mutate(name)
  }

  const createAdminEventMutation = useMutation({
    mutationFn: () => {
      if (selectedSchoolYearId === '') {
        throw new Error('Selecciona un año escolar.')
      }

      const payload = {
        schoolYearId: Number(selectedSchoolYearId),
        title: adminDraft.title,
        description: adminDraft.description || null,
        category: adminDraft.category,
        kind: adminDraft.kind,
        startDate: adminDraft.startDate,
        endDate: adminDraft.endDate,
        visibilityScope:
          adminDraft.category === 'communication'
            ? adminDraft.visibilityScope
            : 'everyone',
        ...(adminDraft.category === 'communication' &&
        adminDraft.visibilityScope === 'selected_teachers' &&
        adminDraft.targetTeacherIds.length > 0
          ? { targetTeacherIds: adminDraft.targetTeacherIds }
          : {}),
        ...(adminDraft.category === 'communication' &&
        adminDraft.visibilityScope === 'teacher_areas' &&
        adminDraft.targetAreaIds.length > 0
          ? { targetAreaIds: adminDraft.targetAreaIds }
          : {}),
      }

      return calendarEventsApi.create(payload)
    },
    onSuccess: async () => {
      setAdminDraft(getDefaultAdminDraft())
      setAdminEventExpanded(false)
      setPageMessage('Evento administrativo creado.')
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo crear el evento.')
    },
  })

  const createTeacherEventMutation = useMutation({
    mutationFn: () => {
      if (selectedSchoolYearId === '') {
        throw new Error('Selecciona un año escolar.')
      }

      const payload = {
        schoolYearId: Number(selectedSchoolYearId),
        title: teacherDraft.title,
        description: teacherDraft.description || null,
        category: teacherDraft.category,
        kind: getTeacherEventKind(teacherDraft.category),
        startDate: teacherDraft.startDate,
        endDate: teacherDraft.endDate,
        ...(teacherDraft.targetClassGroupIds.length > 0
          ? { targetClassGroupIds: teacherDraft.targetClassGroupIds }
          : {}),
      }

      return calendarEventsApi.create(payload)
    },
    onSuccess: async () => {
      setTeacherDraft(getDefaultTeacherDraft())
      setPageMessage('Evento docente creado.')
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo crear el evento docente.')
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: (calendarEventId: number) => calendarEventsApi.remove(calendarEventId),
    onSuccess: async () => {
      setPageMessage('Evento eliminado.')
      await queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo eliminar el evento.')
    },
  })

  const isLoading = isLoadingYears || (selectedSchoolYearId !== '' && (isLoadingTerms || isLoadingEvents))

  if (isLoading && !activeSchoolYear) {
    return (
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography color="text.secondary">Cargando calendario...</Typography>
      </Stack>
    )
  }

  if (!activeSchoolYear) {
    return <Alert severity="info">Crea o activa un año escolar para usar el calendario.</Alert>
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography variant="h4">Calendario</Typography>
          <Typography color="text.secondary">
            {isAdminLike
              ? 'Configura fechas oficiales y publica eventos para la comunidad educativa.'
              : isTeacher
                ? 'Revisa eventos próximos y publica pruebas, tareas o avisos para tus grupos.'
                : 'Consulta las fechas oficiales y los comunicados disponibles para registro.'}
          </Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="calendar-school-year-label">Año escolar</InputLabel>
          <Select
            labelId="calendar-school-year-label"
            label="Año escolar"
            value={selectedSchoolYearId}
            onChange={(event) => setSelectedSchoolYearId(event.target.value as number)}
          >
            {sortedSchoolYears.map((schoolYear) => (
              <MenuItem key={schoolYear.schoolYearId} value={schoolYear.schoolYearId}>
                {schoolYear.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {pageMessage ? <Alert severity="info">{pageMessage}</Alert> : null}

      {isAdminLike ? (
        <Accordion
          expanded={requiredConfigExpanded}
          onChange={(_, expanded) => setRequiredConfigExpanded(expanded)}
          disableGutters
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            '&::before': { display: 'none' },
            overflow: 'hidden',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            sx={{ px: 2, py: 1.25 }}
          >
            <Stack spacing={0.75} sx={{ width: '100%' }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Typography variant="h6">Configuración oficial obligatoria</Typography>
                <Chip
                  size="small"
                  color={requiredConfigurationReady ? 'success' : 'warning'}
                  label={requiredConfigurationReady ? 'Completa' : 'Pendiente'}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {requiredConfigurationReady
                  ? 'Inicio y cierre del año escolar, más los periodos P1-P4, ya están definidos. Puedes desplegar para revisarlos o ajustarlos.'
                  : 'Debes definir inicio y cierre del año escolar, además de los cuatro periodos P1-P4.'}
              </Typography>
              {requiredConfigurationReady ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Año: ${formatShortDateLabel(yearDraft.yearStart)} - ${formatShortDateLabel(yearDraft.yearEnd)}`}
                  />
                  {configuredTermSummary.map((label) => (
                    <Chip key={label} size="small" variant="outlined" label={label} />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </AccordionSummary>

          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Stack spacing={2}>
              {missingRequiredTerms.length > 0 ? (
                <Alert severity="warning">
                  Faltan periodos obligatorios por completar: {missingRequiredTerms.join(', ')}.
                </Alert>
              ) : null}
              {optionalWarnings.length > 0 ? (
                <Alert severity="warning">
                  {optionalWarnings.join(' ')}
                </Alert>
              ) : null}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  type="date"
                  label="Inicio año escolar"
                  value={yearDraft.yearStart}
                  onChange={(event) => setYearDraft((current) => ({ ...current, yearStart: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="date"
                  label="Fin año escolar"
                  value={yearDraft.yearEnd}
                  onChange={(event) => setYearDraft((current) => ({ ...current, yearEnd: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
                <Button
                  variant="contained"
                  onClick={() => updateYearMutation.mutate()}
                  disabled={updateYearMutation.isPending}
                >
                  {updateYearMutation.isPending ? 'Guardando...' : 'Guardar año'}
                </Button>
              </Stack>

              <Divider />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, minmax(0, 1fr))',
                  },
                  gap: 2,
                }}
              >
                {requiredTermNames.map((name) => (
                  <Paper key={name} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle1">{name}</Typography>
                      <TextField
                        type="date"
                        label="Inicio"
                        value={termDrafts[name]?.startDate ?? ''}
                        onChange={(event) =>
                          setTermDrafts((current) => ({
                            ...current,
                            [name]: {
                              ...current[name],
                              startDate: event.target.value,
                            },
                          }))
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        type="date"
                        label="Fin"
                        value={termDrafts[name]?.endDate ?? ''}
                        onChange={(event) =>
                          setTermDrafts((current) => ({
                            ...current,
                            [name]: {
                              ...current[name],
                              endDate: event.target.value,
                            },
                          }))
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                      <Button
                        variant="outlined"
                        onClick={() => handleSaveTerm(name)}
                        disabled={saveTermMutation.isPending}
                      >
                        {saveTermMutation.isPending ? 'Guardando...' : `Guardar ${name}`}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {(isAdminLike || isTeacher) ? (
        isAdminLike ? (
          <Accordion
            expanded={adminEventExpanded}
            onChange={(_, expanded) => setAdminEventExpanded(expanded)}
            disableGutters
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              '&::before': { display: 'none' },
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRoundedIcon />}
              sx={{ px: 2, py: 1.25 }}
            >
              <Stack spacing={0.75} sx={{ width: '100%' }}>
                <Typography variant="h6">Crear evento administrativo</Typography>
                <Typography variant="body2" color="text.secondary">
                  {adminEventSummary}
                </Typography>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="calendar-admin-category-label">Categoría</InputLabel>
                    <Select
                      labelId="calendar-admin-category-label"
                      label="Categoría"
                      value={adminDraft.category}
                      onChange={(event) => {
                        const nextCategory = event.target.value as AdminEventDraft['category']
                        setAdminDraft((current) => ({
                          ...current,
                          category: nextCategory,
                          kind: adminKindOptions[nextCategory][0]?.value ?? current.kind,
                          visibilityScope:
                            nextCategory === 'communication' ? current.visibilityScope : 'everyone',
                          targetTeacherIds: nextCategory === 'communication' ? current.targetTeacherIds : [],
                          targetAreaIds: nextCategory === 'communication' ? current.targetAreaIds : [],
                        }))
                      }}
                    >
                      {adminCategoryOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="calendar-admin-kind-label">Tipo</InputLabel>
                    <Select
                      labelId="calendar-admin-kind-label"
                      label="Tipo"
                      value={adminDraft.kind}
                      onChange={(event) =>
                        setAdminDraft((current) => ({
                          ...current,
                          kind: event.target.value,
                        }))
                      }
                    >
                      {adminKindOptions[adminDraft.category].map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Título"
                    value={adminDraft.title}
                    onChange={(event) =>
                      setAdminDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    fullWidth
                  />
                </Stack>

                <TextField
                  label="Descripción"
                  value={adminDraft.description}
                  onChange={(event) =>
                    setAdminDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  multiline
                  minRows={2}
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    type="date"
                    label="Inicio"
                    value={adminDraft.startDate}
                    onChange={(event) =>
                      setAdminDraft((current) => ({ ...current, startDate: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    type="date"
                    label="Fin"
                    value={adminDraft.endDate}
                    onChange={(event) =>
                      setAdminDraft((current) => ({ ...current, endDate: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                  {adminDraft.category === 'communication' ? (
                    <FormControl size="small" sx={{ minWidth: 240 }}>
                      <InputLabel id="calendar-admin-visibility-label">Visible para</InputLabel>
                      <Select
                        labelId="calendar-admin-visibility-label"
                        label="Visible para"
                        value={adminDraft.visibilityScope}
                        onChange={(event) =>
                          setAdminDraft((current) => ({
                            ...current,
                            visibilityScope: event.target.value as AdminEventDraft['visibilityScope'],
                            targetTeacherIds: [],
                            targetAreaIds: [],
                          }))
                        }
                      >
                        {visibilityOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Alert severity="info" sx={{ flex: 1 }}>
                      Las fechas oficiales se publican para todos los usuarios.
                    </Alert>
                  )}
                </Stack>

                {adminDraft.category === 'communication' &&
                adminDraft.visibilityScope === 'selected_teachers' ? (
                  <FormControl size="small" fullWidth>
                    <InputLabel id="calendar-target-teachers-label">Profesores</InputLabel>
                    <Select
                      labelId="calendar-target-teachers-label"
                      multiple
                      value={adminDraft.targetTeacherIds}
                      onChange={(event) =>
                        setAdminDraft((current) => ({
                          ...current,
                          targetTeacherIds:
                            typeof event.target.value === 'string'
                              ? event.target.value.split(',')
                              : (event.target.value as string[]),
                        }))
                      }
                      input={<OutlinedInput label="Profesores" />}
                      renderValue={(selected) =>
                        teacherUsers
                          .filter((teacher) => (selected as string[]).includes(teacher.nationalId))
                          .map((teacher) => `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim() || teacher.username)
                          .join(', ')
                      }
                    >
                      {teacherUsers.map((teacher) => (
                        <MenuItem key={teacher.nationalId} value={teacher.nationalId}>
                          <ListItemText
                            primary={`${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim() || teacher.username}
                            secondary={teacher.nationalId}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}

                {adminDraft.category === 'communication' &&
                adminDraft.visibilityScope === 'teacher_areas' ? (
                  <FormControl size="small" fullWidth>
                    <InputLabel id="calendar-target-areas-label">Áreas</InputLabel>
                    <Select
                      labelId="calendar-target-areas-label"
                      multiple
                      value={adminDraft.targetAreaIds}
                      onChange={(event) =>
                        setAdminDraft((current) => ({
                          ...current,
                          targetAreaIds:
                            typeof event.target.value === 'string'
                              ? event.target.value.split(',').map((value) => Number(value))
                              : (event.target.value as number[]),
                        }))
                      }
                      input={<OutlinedInput label="Áreas" />}
                      renderValue={(selected) =>
                        subjectAreas
                          .filter((area) => (selected as number[]).includes(area.areaId))
                          .map((area) => area.name)
                          .join(', ')
                      }
                    >
                      {subjectAreas.map((area) => (
                        <MenuItem key={area.areaId} value={area.areaId}>
                          <ListItemText primary={area.name} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}

                <Button
                  variant="contained"
                  onClick={() => createAdminEventMutation.mutate()}
                  disabled={createAdminEventMutation.isPending}
                >
                  {createAdminEventMutation.isPending ? 'Guardando...' : 'Crear evento'}
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ) : (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Crear evento docente</Typography>
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="calendar-teacher-category-label">Tipo</InputLabel>
                    <Select
                      labelId="calendar-teacher-category-label"
                      label="Tipo"
                      value={teacherDraft.category}
                      onChange={(event) =>
                        setTeacherDraft((current) => ({
                          ...current,
                          category: event.target.value as TeacherEventDraft['category'],
                        }))
                      }
                    >
                      {teacherCategoryOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Título"
                    value={teacherDraft.title}
                    onChange={(event) =>
                      setTeacherDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    fullWidth
                  />
                </Stack>

                <TextField
                  label="Descripción"
                  value={teacherDraft.description}
                  onChange={(event) =>
                    setTeacherDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  multiline
                  minRows={2}
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    type="date"
                    label="Inicio"
                    value={teacherDraft.startDate}
                    onChange={(event) =>
                      setTeacherDraft((current) => ({ ...current, startDate: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    type="date"
                    label="Fin"
                    value={teacherDraft.endDate}
                    onChange={(event) =>
                      setTeacherDraft((current) => ({ ...current, endDate: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>

                <FormControl size="small" fullWidth>
                  <InputLabel id="calendar-teacher-groups-label">Grupos</InputLabel>
                  <Select
                    labelId="calendar-teacher-groups-label"
                    multiple
                    value={teacherDraft.targetClassGroupIds}
                    onChange={(event) =>
                      setTeacherDraft((current) => ({
                        ...current,
                        targetClassGroupIds:
                          typeof event.target.value === 'string'
                            ? event.target.value.split(',').map((value) => Number(value))
                            : (event.target.value as number[]),
                      }))
                    }
                    input={<OutlinedInput label="Grupos" />}
                    renderValue={(selected) =>
                      teacherClassGroups
                        .filter((group) => (selected as number[]).includes(group.classGroupId))
                        .map((group) => group.label)
                        .join(', ')
                    }
                  >
                    {teacherClassGroups.map((group) => (
                      <MenuItem key={group.classGroupId} value={group.classGroupId}>
                        <ListItemText primary={group.label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  onClick={() => createTeacherEventMutation.mutate()}
                  disabled={createTeacherEventMutation.isPending}
                >
                  {createTeacherEventMutation.isPending ? 'Guardando...' : 'Crear evento'}
                </Button>
              </>
            </Stack>
          </Paper>
        )
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(380px, 460px) 1fr' },
          gap: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button onClick={() => setVisibleMonth(addDays(startOfMonth(visibleMonth), -1))}>
                Mes anterior
              </Button>
              <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                {calendarMonth.label}
              </Typography>
              <Button
                onClick={() =>
                  setVisibleMonth(
                    addDays(
                      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                      0,
                    ),
                  )
                }
              >
                Mes siguiente
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMarkerBadge label="P#" tone="primary" />
                <Typography variant="caption" color="text.secondary">Periodo</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMarkerBadge label="Rec" tone="success" />
                <Typography variant="caption" color="text.secondary">Receso / oficial</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMarkerBadge label="Com" tone="secondary" />
                <Typography variant="caption" color="text.secondary">Comunicado</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMarkerBadge label="Ret" tone="warning" />
                <Typography variant="caption" color="text.secondary">Retomas / matrículas</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMarkerBadge label="FE" tone="warning" />
                <Typography variant="caption" color="text.secondary">Festivo</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMarkerBadge label="Doc" tone="default" />
                <Typography variant="caption" color="text.secondary">Docente / otros</Typography>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}>
              {weekdayLabels.map((label) => (
                <Typography key={label} variant="caption" color="text.secondary" textAlign="center">
                  {label}
                </Typography>
              ))}
              {calendarMonth.weeks.flat().map((day) => {
                const dayMarkers = dayMarkersByDate.get(day.isoDate) ?? []
                const combinedMarkers = day.holidayName
                  ? [
                      {
                        key: 'holiday',
                        label: 'FE',
                        tone: 'warning' as CalendarDayMarkerTone,
                        priority: 5,
                      },
                      ...dayMarkers,
                    ]
                  : dayMarkers
                const visibleMarkers = combinedMarkers.slice(0, 2)
                const remainingMarkers = combinedMarkers.length - visibleMarkers.length
                const isSelected = day.isoDate === selectedDate
                return (
                  <Button
                    key={day.key}
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={isSelected ? 'primary' : day.holidayName ? 'warning' : 'inherit'}
                    onClick={() => {
                      setSelectedDate(day.isoDate)
                      setVisibleMonth(startOfMonth(parseIsoDate(day.isoDate)))
                    }}
                    title={
                      combinedMarkers.length > 0
                        ? combinedMarkers.map((marker) => marker.label).join(' · ')
                        : day.holidayName ?? undefined
                    }
                    sx={{
                      minWidth: 0,
                      px: 0.5,
                      py: 1,
                      minHeight: 80,
                      opacity: day.isCurrentMonth ? 1 : 0.45,
                    }}
                  >
                    <Stack spacing={0.25} alignItems="center">
                      <Typography variant="body2">{day.dayNumber}</Typography>
                      <Stack spacing={0.35} alignItems="center">
                        {visibleMarkers.map((marker) => (
                          <CalendarMarkerBadge
                            key={`${day.key}-${marker.key}`}
                            label={marker.label}
                            tone={marker.tone}
                          />
                        ))}
                        {remainingMarkers > 0 ? (
                          <CalendarMarkerBadge label={`+${remainingMarkers}`} tone="default" />
                        ) : null}
                      </Stack>
                    </Stack>
                  </Button>
                )
              })}
            </Box>
          </Stack>
        </Paper>

        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Eventos del {formatDateLabel(selectedDate)}</Typography>
              {selectedDateItems.length === 0 ? (
                <Typography color="text.secondary">
                  No hay eventos activos para este día.
                </Typography>
              ) : (
                selectedDateItems.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                        <Chip
                          size="small"
                          color={getEventChipColor(item.category)}
                          label={getItemKindLabel(item)}
                        />
                        <Typography variant="subtitle2">{item.title}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateLabel(item.startDate)}
                        {item.startDate !== item.endDate ? ` - ${formatDateLabel(item.endDate)}` : ''}
                      </Typography>
                      {item.description ? (
                        <Typography variant="body2">{item.description}</Typography>
                      ) : null}
                      {item.createdByName ? (
                        <Typography variant="caption" color="text.secondary">
                          Creado por {item.createdByName}
                        </Typography>
                      ) : null}
                      {item.source === 'event' && item.editable && item.calendarEventId ? (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            const confirmed = window.confirm('¿Eliminar este evento?')
                            if (!confirmed) {
                              return
                            }
                            deleteEventMutation.mutate(item.calendarEventId!)
                          }}
                          disabled={deleteEventMutation.isPending}
                        >
                          Eliminar
                        </Button>
                      ) : null}
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Próximos eventos</Typography>
              {upcomingItems.length === 0 ? (
                <Typography color="text.secondary">
                  No hay eventos próximos para este año escolar.
                </Typography>
              ) : (
                upcomingItems.map((item) => (
                  <Stack key={`upcoming-${item.id}`} spacing={0.5}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip
                        size="small"
                        color={getEventChipColor(item.category)}
                        label={getItemKindLabel(item)}
                      />
                      <Typography variant="subtitle2">{item.title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateLabel(item.startDate)}
                      {item.startDate !== item.endDate ? ` - ${formatDateLabel(item.endDate)}` : ''}
                    </Typography>
                    {item.description ? (
                      <Typography variant="body2">{item.description}</Typography>
                    ) : null}
                    <Divider />
                  </Stack>
                ))
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      {isRegistrar ? (
        <Alert severity="info">
          Registro solo visualiza fechas oficiales, periodos, matrículas, graduaciones y comunicados habilitados por administración.
        </Alert>
      ) : null}
    </Stack>
  )
}

export default CalendarPage

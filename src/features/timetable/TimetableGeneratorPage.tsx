import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/apiClient'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { useClassGroupsQuery } from '../classGroups/useClassGroupsQuery'
import type { ClassGroup } from '../../api/classGroupsApi'
import {
  timetableGeneratorApi,
  type CoursePreferenceDto,
  type Division,
  type GenerateTimetableDto,
  type TeacherConstraintDto,
  type TimetableApplyResponse,
  type TimetableAssignment,
  type TimetableImportApplyResponse,
  type TimetablePreviewResponse,
} from '../../api/timetableGeneratorApi'
import { professorsApi } from '../../api/professorsApi'
import { timetableSlotsApi } from '../../api/timetableSlotsApi'
import { timetableAssignmentsApi } from '../../api/timetableAssignmentsApi'
import { coursesApi, type CourseSummary } from '../../api/coursesApi'
import { scannerApi, type ScannedTimetableResponse } from '../../api/scannerApi'

const CREATE_DEFAULT_WEEKLY_CAP = 25
const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const formatTimetableImportError = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'No se pudo confirmar la importación.'
  }

  const details = error.details
  if (!isRecord(details)) {
    return error.message
  }

  const message = typeof details.message === 'string' ? details.message : error.message
  const conflicts = Array.isArray(details.conflicts) ? details.conflicts : []
  if (conflicts.length === 0) {
    return message
  }

  const lines = conflicts.slice(0, 30).flatMap((conflict) => {
    if (!isRecord(conflict)) {
      return []
    }
    const grade = conflict.gradeLevel ?? '?'
    const subject = conflict.subjectName ?? conflict.subjectCode ?? 'Asignatura'
    const expected = conflict.expectedWeeklyHours ?? '?'
    const groups = Array.isArray(conflict.groups) ? conflict.groups : []
    return [
      `Grado ${grade} · ${subject} · intensidad esperada ${expected}`,
      ...groups.map((group) => {
        if (!isRecord(group)) {
          return ''
        }
        const slots = Array.isArray(group.slots) ? group.slots.join(', ') : ''
        return `  ${group.groupCode ?? '?'}: ${group.weeklyHours ?? 0} horas${slots ? ` (${slots})` : ''}`
      }).filter(Boolean),
    ]
  })

  const remainder = conflicts.length > 30 ? `\n...${conflicts.length - 30} conflictos más.` : ''
  return `${message}\n${lines.join('\n')}${remainder}`
}
const WORKING_DAYS = [1, 2, 3, 4, 5]

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

type WizardStep = 1 | 2 | 3 | 4

type TeacherConstraintRow = TeacherConstraintDto
const DIVISION_CONFIG: Record<Division, { label: string; minGrade: number; maxGrade: number }> = {
  elementary: { label: 'Primaria (1° a 5°)', minGrade: 1, maxGrade: 5 },
  secondary: { label: 'Secundaria (6° a 9°)', minGrade: 6, maxGrade: 9 },
  senior: { label: 'Media (10° a 11°)', minGrade: 10, maxGrade: 11 },
}

type CapacityShortage = {
  gradeLevel: number
  subjectName: string
  requiredTeachers: number
  availableTeachers: number
}

const TimetableResultsTable = ({ title, assignments }: { title: string; assignments: TimetableAssignment[] | null }) => {
  if (!assignments) {
    return null
  }
  if (assignments.length === 0) {
    return <Alert severity="info">No timetable entries found for this {title.toLowerCase()}.</Alert>
  }
  const formatSlot = (assignment: TimetableAssignment) => {
    if (!assignment.slot) {
      return 'Sin horario asignado'
    }
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    const day = assignment.slot.dayOfWeek ? days[assignment.slot.dayOfWeek - 1] ?? 'Día' : 'Día'
    return `${day} ${assignment.slot.startTime ?? ''}–${assignment.slot.endTime ?? ''}`
  }
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{title}</TableCell>
            <TableCell>Slot</TableCell>
            <TableCell>Classroom</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.assignmentId}>
              <TableCell>{assignment.teacherId ?? assignment.classGroupId ?? assignment.courseId}</TableCell>
              <TableCell>{formatSlot(assignment)}</TableCell>
              <TableCell>{assignment.classroom?.name ?? 'Sin aula'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

const extractCapacityShortages = (details: unknown): CapacityShortage[] => {
  const rawShortages =
    (Array.isArray(details)
      ? details
      : typeof details === 'object' && details !== null && Array.isArray((details as { shortages?: unknown[] }).shortages)
        ? (details as { shortages?: unknown[] }).shortages
        : []) ?? []

  return rawShortages
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null
      }
      const gradeLevel = Number((item as Record<string, unknown>).gradeLevel ?? 0)
      const subjectName = String(
        (item as Record<string, unknown>).subjectName ??
          (item as Record<string, unknown>).subjectCode ??
          'Asignatura',
      )
      const requiredTeachers = Number(
        (item as Record<string, unknown>).requiredTeachers ??
          (item as Record<string, unknown>).required ??
          0,
      )
      const availableTeachers = Number(
        (item as Record<string, unknown>).availableTeachers ??
          (item as Record<string, unknown>).available ??
          0,
      )
      return {
        gradeLevel: Number.isFinite(gradeLevel) ? gradeLevel : 0,
        subjectName,
        requiredTeachers: Number.isFinite(requiredTeachers) ? requiredTeachers : 0,
        availableTeachers: Number.isFinite(availableTeachers) ? availableTeachers : 0,
      }
    })
    .filter((item): item is CapacityShortage => Boolean(item))
}

const TimetableGeneratorPage = () => {
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('')
  const [isWizardActive, setIsWizardActive] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [division, setDivision] = useState<Division | ''>('')
  const [selectedClassGroupIds, setSelectedClassGroupIds] = useState<number[]>([])
  const [hasInitializedGroups, setHasInitializedGroups] = useState(false)
  const [teacherWeeklyHourCap, setTeacherWeeklyHourCap] = useState<number>(CREATE_DEFAULT_WEEKLY_CAP)
  const [teacherConstraints, setTeacherConstraints] = useState<TeacherConstraintRow[]>([])
  const [coursePreferences, setCoursePreferences] = useState<CoursePreferenceDto[]>([])
  const [coursePreferenceDraft, setCoursePreferenceDraft] = useState<{
    courseId: number | ''
    preferredShift: 'any' | 'morning' | 'afternoon'
    blockLength: string
    sessionsPerWeek: string
  }>({
    courseId: '',
    preferredShift: 'any',
    blockLength: '',
    sessionsPerWeek: '',
  })
  const [previewResult, setPreviewResult] = useState<TimetablePreviewResponse | null>(null)
  const [applyResult, setApplyResult] = useState<TimetableApplyResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [previewGrouping, setPreviewGrouping] = useState<'classGroup' | 'day'>('classGroup')
  const [teacherDraft, setTeacherDraft] = useState<{ teacherId: string; preferredShift: 'any' | 'morning' | 'afternoon'; avoidLastSlot: boolean }>({
    teacherId: '',
    preferredShift: 'any',
    avoidLastSlot: false,
  })
  const [professorSelection, setProfessorSelection] = useState('')
  const [classGroupSelection, setClassGroupSelection] = useState<number | ''>('')
  const [professorSearch, setProfessorSearch] = useState('')
  const [classGroupSearch, setClassGroupSearch] = useState('')
  const [professorAssignments, setProfessorAssignments] = useState<TimetableAssignment[] | null>(null)
  const [classGroupAssignments, setClassGroupAssignments] = useState<TimetableAssignment[] | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wizardMessage, setWizardMessage] = useState<string | null>(null)
  const [periodsPerDay, setPeriodsPerDay] = useState(5)
  const [classDurationMinutes, setClassDurationMinutes] = useState(45)
  const [schoolStartTime, setSchoolStartTime] = useState('08:00')
  const [breakBetweenClassesMinutes, setBreakBetweenClassesMinutes] = useState(0)
  const [mealBreakTime, setMealBreakTime] = useState('')
  const [mealBreakDurationMinutes, setMealBreakDurationMinutes] = useState(60)
  const [generalBreakTime, setGeneralBreakTime] = useState('')
  const [generalBreakDurationMinutes, setGeneralBreakDurationMinutes] = useState(15)
  const [showSlotEditor, setShowSlotEditor] = useState(false)
  const [confirmDeleteSlots, setConfirmDeleteSlots] = useState(false)
  const [confirmDeleteTimetable, setConfirmDeleteTimetable] = useState(false)
  const [timetableMessage, setTimetableMessage] = useState<string | null>(null)
  const [capacityError, setCapacityError] = useState<CapacityShortage[] | null>(null)
  const [timetableImportResult, setTimetableImportResult] = useState<ScannedTimetableResponse | null>(null)
  const [timetableImportError, setTimetableImportError] = useState<string | null>(null)
  const [timetableImportApplyResult, setTimetableImportApplyResult] = useState<TimetableImportApplyResponse | null>(null)

  const { data: schoolYears } = useSchoolYearsQuery({})
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!selectedSchoolYearId && schoolYears && schoolYears.length > 0) {
      setSelectedSchoolYearId(String(schoolYears[0].schoolYearId))
    }
  }, [selectedSchoolYearId, schoolYears])

  useEffect(() => {
    setIsWizardActive(false)
    setWizardStep(1)
    setDivision('')
    setSelectedClassGroupIds([])
    setHasInitializedGroups(false)
    setTeacherWeeklyHourCap(CREATE_DEFAULT_WEEKLY_CAP)
    setTeacherConstraints([])
    setTeacherDraft({ teacherId: '', preferredShift: 'any', avoidLastSlot: false })
    setCoursePreferences([])
    setCoursePreferenceDraft({
      courseId: '',
      preferredShift: 'any',
      blockLength: '',
      sessionsPerWeek: '',
    })
    setPreviewResult(null)
    setApplyResult(null)
    setPreviewError(null)
    setApplyError(null)
    setPreviewGrouping('classGroup')
    setProfessorAssignments(null)
    setClassGroupAssignments(null)
    setWizardMessage(null)
    setBreakBetweenClassesMinutes(0)
    setMealBreakTime('')
    setMealBreakDurationMinutes(60)
    setGeneralBreakTime('')
    setGeneralBreakDurationMinutes(15)
    setShowSlotEditor(false)
    setConfirmDeleteSlots(false)
    setConfirmDeleteTimetable(false)
    setTimetableMessage(null)
    setProfessorSearch('')
    setClassGroupSearch('')
    setProfessorSelection('')
    setClassGroupSelection('')
    setCapacityError(null)
  }, [selectedSchoolYearId])

  useEffect(() => {
    setSelectedClassGroupIds([])
    setHasInitializedGroups(false)
    setCapacityError(null)
    setPreviewResult(null)
    setApplyResult(null)
    setPreviewError(null)
    setApplyError(null)
    setPreviewGrouping('classGroup')
    setCoursePreferences([])
    setCoursePreferenceDraft({
      courseId: '',
      preferredShift: 'any',
      blockLength: '',
      sessionsPerWeek: '',
    })
  }, [division])

  const schoolYearId = selectedSchoolYearId ? Number(selectedSchoolYearId) || undefined : undefined
  const { data: coursesData } = useQuery({
    queryKey: ['courses', schoolYearId],
    queryFn: () => {
      if (!schoolYearId) {
        throw new Error('schoolYearId required')
      }
      return coursesApi.list({ schoolYearId })
    },
    enabled: Boolean(schoolYearId),
  })
  const coursesById = useMemo(() => {
    const map = new Map<number, CourseSummary>()
    ;(coursesData ?? []).forEach((course) => {
      map.set(course.courseId, course)
    })
    return map
  }, [coursesData])

  const classGroupQueryParams = useMemo(
    () => ({
      schoolYearId,
      page: 1,
      pageSize: 100,
    }),
    [schoolYearId],
  )

  const {
    data: classGroupsData,
    isLoading: isLoadingClassGroups,
    isError: isClassGroupsError,
    error: classGroupsError,
  } = useClassGroupsQuery(classGroupQueryParams)

  const classGroups = classGroupsData?.data ?? []
  const describeCourse = useCallback(
    (courseId: number, classGroupId?: number) => {
      const course = coursesById.get(courseId)
      if (course) {
        return `${course.subjectName} (${course.subjectCode}) · ${course.gradeLevel}° ${course.section}`
      }
      if (!classGroupId) {
        return `Curso ${courseId}`
      }
      const classGroup = classGroups.find((group) => group.classGroupId === classGroupId)
      const groupLabel = classGroup ? `${classGroup.gradeLevel}° ${classGroup.section}` : `Grupo ${classGroupId}`
      return `Curso ${courseId} · ${groupLabel}`
    },
    [coursesById, classGroups],
  )
  const divisionRange = division ? DIVISION_CONFIG[division] : null
  const classGroupsForDivision = useMemo(() => {
    if (!divisionRange) {
      return [] as ClassGroup[]
    }
    return classGroups.filter(
      (group) => group.gradeLevel >= divisionRange.minGrade && group.gradeLevel <= divisionRange.maxGrade,
    )
  }, [classGroups, divisionRange])
  const filteredClassGroups = useMemo(() => {
    const base = divisionRange ? classGroupsForDivision : []
    if (!classGroupSearch.trim()) {
      return base
    }
    const term = classGroupSearch.toLowerCase()
    return base.filter((group) =>
      `${group.gradeLevel}° ${group.section}`.toLowerCase().includes(term),
    )
  }, [classGroupsForDivision, classGroupSearch, divisionRange])
  const groupedClassGroups = useMemo(() => {
    return classGroupsForDivision.reduce<Record<string, ClassGroup[]>>((acc, group) => {
      const key = String(group.gradeLevel)
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(group)
      return acc
    }, {})
  }, [classGroupsForDivision])

  const gradeClassGroupIds = useMemo(() => {
    const map = new Map<number, number[]>()
    classGroupsForDivision.forEach((group) => {
      if (!map.has(group.gradeLevel)) {
        map.set(group.gradeLevel, [])
      }
      map.get(group.gradeLevel)?.push(group.classGroupId)
    })
    return map
  }, [classGroupsForDivision])

  const classGroupIds = useMemo(
    () => classGroupsForDivision.map((group) => group.classGroupId),
    [classGroupsForDivision],
  )

  useEffect(() => {
    if (!divisionRange) {
      setSelectedClassGroupIds((prev) => (prev.length > 0 ? [] : prev))
      return
    }
    if (!hasInitializedGroups && classGroupsForDivision.length > 0) {
      setSelectedClassGroupIds(classGroupsForDivision.map((group) => group.classGroupId))
      setHasInitializedGroups(true)
    }
  }, [divisionRange, classGroupsForDivision, hasInitializedGroups])

  const { data: professorsData } = useQuery({
    queryKey: ['professors', 'timetable'],
    queryFn: () => professorsApi.list({ pageSize: 100 }),
  })
  const professors = professorsData?.data ?? []
  const filteredProfessors = useMemo(() => {
    if (!professorSearch.trim()) {
      return professors
    }
    const term = professorSearch.toLowerCase()
    return professors.filter((prof) =>
      `${prof.firstName ?? ''} ${prof.lastName ?? ''}`.toLowerCase().includes(term),
    )
  }, [professors, professorSearch])

  const {
    data: slots,
    isLoading: isLoadingSlots,
    refetch: refetchSlots,
    isError: isSlotsError,
    error: slotsError,
  } = useQuery({
    queryKey: ['timetable-slots', schoolYearId, division],
    queryFn: () => {
      if (!schoolYearId || !division) {
        throw new Error('schoolYearId and division required')
      }
      return timetableSlotsApi.listBySchoolYear(schoolYearId, division)
    },
    enabled: Boolean(schoolYearId) && Boolean(division),
  })
  const slotsForYear = slots ?? []
  const hasSlotsForYear = slotsForYear.length > 0
  const selectedYear = schoolYears?.find((year) => year.schoolYearId === schoolYearId)

  const {
    data: hasTimetable,
    isLoading: isCheckingTimetable,
    refetch: refetchHasTimetable,
  } = useQuery({
    queryKey: ['has-timetable', schoolYearId, division, classGroupIds.join('-')],
    queryFn: () => {
      if (!schoolYearId || !division) {
        throw new Error('schoolYearId and division required')
      }
      return timetableGeneratorApi.hasTimetableForYear(schoolYearId, classGroupIds, division)
    },
    enabled: Boolean(schoolYearId) && Boolean(division) && classGroupIds.length > 0,
  })

  const searchAssignmentsMutation = useMutation({
    mutationFn: (params: { teacherId?: string; classGroupId?: number }) => {
      if (params.teacherId) {
        return timetableGeneratorApi.getProfessorTimetable(params.teacherId)
      }
      if (params.classGroupId) {
        return timetableGeneratorApi.getClassGroupTimetable(params.classGroupId)
      }
      return Promise.resolve([] as TimetableAssignment[])
    },
  })

  const scanTimetableMutation = useMutation({
    mutationFn: (file: File) => scannerApi.scanTimetable(file),
    onSuccess: (result) => {
      setTimetableImportResult(result)
      setTimetableImportError(null)
      setTimetableImportApplyResult(null)
    },
    onError: (error) => {
      setTimetableImportResult(null)
      setTimetableImportError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'No se pudo leer el horario.',
      )
    },
  })

  const confirmTimetableImportMutation = useMutation({
    mutationFn: () => {
      if (!schoolYearId || !timetableImportResult) {
        throw new Error('Selecciona un año escolar y sube un horario antes de confirmar.')
      }
      return timetableGeneratorApi.confirmImport({
        schoolYearId,
        scan: {
          assignments: timetableImportResult.assignments,
        },
      })
    },
    onSuccess: (result) => {
      setTimetableImportApplyResult(result)
      setTimetableImportError(null)
      queryClient.invalidateQueries({ queryKey: ['professors', 'timetable'] })
      queryClient.invalidateQueries({ queryKey: ['courses', schoolYearId] })
      queryClient.invalidateQueries({ queryKey: ['class-groups', schoolYearId] })
      queryClient.invalidateQueries({ queryKey: ['timetable-slots', schoolYearId, division] })
      queryClient.invalidateQueries({ queryKey: ['has-timetable'] })
    },
    onError: (error) => {
      setTimetableImportError(formatTimetableImportError(error))
    },
  })

  const previewMutation = useMutation({
    mutationFn: (payload: GenerateTimetableDto) => timetableGeneratorApi.preview(payload),
    onSuccess: (result) => {
      setPreviewResult(result)
      setApplyResult(null)
      setPreviewError(null)
      setApplyError(null)
      setCapacityError(null)
      setWizardMessage('Previsualización generada correctamente.')
    },
    onError: (error) => {
      setPreviewResult(null)
      setApplyResult(null)
      setApplyError(null)
      if (error instanceof ApiError && error.message === 'insufficientTeacherCapacity') {
        const shortages = extractCapacityShortages(error.details)
        setCapacityError(shortages)
        setPreviewError('Faltan docentes para cubrir el horario solicitado.')
      } else {
        const message = error instanceof Error ? error.message : 'No se pudo generar la previsualización.'
        setPreviewError(message)
      }
    },
  })

  const applyMutation = useMutation({
    mutationFn: (payload: GenerateTimetableDto) => timetableGeneratorApi.apply(payload),
    onSuccess: (result) => {
      setPreviewResult({
        assignments: result.assignments,
        unassignedSessions: result.unassignedSessions,
      })
      setApplyResult(result)
      setPreviewError(null)
      setApplyError(null)
      setCapacityError(null)
      setWizardMessage('Horario aplicado correctamente.')
      refetchHasTimetable()
    },
    onError: (error) => {
      setApplyResult(null)
      const message = error instanceof Error ? error.message : 'No se pudo aplicar el horario.'
      setApplyError(message)
    },
  })

  const regenerateTimetableMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload()
      if (!payload) {
        throw new Error('Selecciona año, división y límite docente antes de regenerar.')
      }
      return timetableGeneratorApi.apply(payload)
    },
    onSuccess: async () => {
      setTimetableMessage('Horario regenerado correctamente.')
      setConfirmOpen(false)
      await refetchHasTimetable()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo regenerar el horario.'
      setTimetableMessage(message)
    },
  })

  type SlotRow = {
    start: string
    end: string
    label: string
    isBreak?: boolean
  }

  const slotRows = useMemo<SlotRow[]>(() => {
    if (!hasSlotsForYear) {
      return []
    }
    const map = new Map<string, SlotRow>()
    slotsForYear.forEach((slot) => {
      const key = `${slot.startTime}-${slot.endTime}`
      if (!map.has(key)) {
        map.set(key, {
          start: slot.startTime,
          end: slot.endTime,
          label: `${slot.startTime.slice(0, 5)}-${slot.endTime.slice(0, 5)}`,
        })
      }
    })
    const sorted = Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start))
    const rows: SlotRow[] = []
    let previousEnd: string | null = null
    sorted.forEach((row) => {
      if (previousEnd && row.start > previousEnd) {
        rows.push({
          start: previousEnd,
          end: row.start,
          label: `${previousEnd.slice(0, 5)}-${row.start.slice(0, 5)} BREAK`,
          isBreak: true,
        })
      }
      rows.push(row)
      previousEnd = row.end
    })
    return rows
  }, [hasSlotsForYear, slotsForYear])

  const previewGroupedAssignments = useMemo(() => {
    if (!previewResult) {
      return []
    }
    const groups = new Map<string, typeof previewResult.assignments>()
    previewResult.assignments.forEach((assignment) => {
      const groupKey =
        previewGrouping === 'day'
          ? DAYS_OF_WEEK[(assignment.dayOfWeek ?? 1) - 1] ?? `Día ${assignment.dayOfWeek}`
          : describeCourse(assignment.courseId, assignment.classGroupId)
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)?.push(assignment)
    })
    return Array.from(groups.entries())
  }, [previewResult, previewGrouping, describeCourse])

  const isWithinWindow = (start: number, duration: number, windowStart: number | null, windowDuration: number) => {
    if (windowStart === null || windowDuration <= 0) {
      return false
    }
    const windowEnd = windowStart + windowDuration
    return (
      (start >= windowStart && start < windowEnd) ||
      (start < windowStart && start + duration > windowStart)
    )
  }

  const buildSlotPattern = () => {
    if (!division) {
      return []
    }
    const totalPeriods = Math.max(1, periodsPerDay)
    const duration = Math.max(5, classDurationMinutes)
    const spacing = Math.max(0, breakBetweenClassesMinutes)
    const mealStartMinutes = mealBreakTime ? timeToMinutes(mealBreakTime) : null
    const mealDuration = Math.max(0, mealBreakDurationMinutes)
    const generalStartMinutes = generalBreakTime ? timeToMinutes(generalBreakTime) : null
    const generalDuration = Math.max(0, generalBreakDurationMinutes)
    const slotsPayload: Array<{
      division: Division
      dayOfWeek: number
      startTime: string
      endTime: string
      slotIndex: number
    }> = []

    WORKING_DAYS.forEach((day) => {
      let currentMinutes = timeToMinutes(schoolStartTime)
      for (let period = 1; period <= totalPeriods; period++) {
        while (isWithinWindow(currentMinutes, duration, generalStartMinutes, generalDuration)) {
          currentMinutes = (generalStartMinutes ?? currentMinutes) + generalDuration
        }
        while (isWithinWindow(currentMinutes, duration, mealStartMinutes, mealDuration)) {
          currentMinutes = (mealStartMinutes ?? currentMinutes) + mealDuration
        }
        const startMinutes = currentMinutes
        const endMinutes = startMinutes + duration
        slotsPayload.push({
          division,
          dayOfWeek: day,
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes),
          slotIndex: period,
        })
        currentMinutes = endMinutes + spacing
      }
    })

    return slotsPayload
  }

  const createSlotsMutation = useMutation({
    mutationFn: async () => {
      if (!schoolYearId || !division) {
        throw new Error('schoolYearId y división requeridos para crear slots')
      }
      if (hasSlotsForYear) {
        await deleteAllSlots()
      }
      const slotsPayload = buildSlotPattern()
      // TODO: soportar múltiples patrones por día o múltiples descansos.
      await timetableSlotsApi.createBulkForYear(slotsPayload)
      await refetchSlots()
    },
    onSuccess: () => {
      setShowSlotEditor(false)
      setWizardMessage('Slots generados correctamente.')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron crear los slots.'
      setWizardMessage(message)
    },
  })

  const deleteAllSlots = async () => {
    for (const slot of slotsForYear) {
      await timetableSlotsApi.delete(slot.slotId)
    }
  }

  const deleteSlotsMutation = useMutation({
    mutationFn: deleteAllSlots,
    onSuccess: () => {
      setConfirmDeleteSlots(false)
      setShowSlotEditor(false)
      refetchSlots()
      setWizardMessage('Slots eliminados correctamente.')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron eliminar los slots.'
      setWizardMessage(message)
    },
  })

  const deleteTimetableMutation = useMutation({
    mutationFn: async () => {
      if (!schoolYearId || classGroupIds.length === 0) {
        throw new Error('schoolYearId and division required')
      }
      await timetableAssignmentsApi.deleteAllForYear(schoolYearId, classGroupIds)
    },
    onSuccess: async () => {
      setConfirmDeleteTimetable(false)
      setPreviewResult(null)
      setApplyResult(null)
      setPreviewError(null)
      setApplyError(null)
      setTimetableMessage('Horario eliminado correctamente.')
      await refetchHasTimetable()
      queryClient.invalidateQueries({ queryKey: ['has-timetable', schoolYearId, classGroupIds.join('-')] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el horario.'
      setTimetableMessage(message)
    },
  })

  const handleToggleGrade = (gradeLevel: number) => {
    const idsForGrade = gradeClassGroupIds.get(gradeLevel) ?? []
    if (idsForGrade.length === 0) {
      return
    }
    setSelectedClassGroupIds((prev) => {
      const allSelected = idsForGrade.every((id) => prev.includes(id))
      if (allSelected) {
        return prev.filter((id) => !idsForGrade.includes(id))
      }
      const next = new Set(prev)
      idsForGrade.forEach((id) => next.add(id))
      return Array.from(next)
    })
  }

  const handleAddTeacherConstraint = () => {
    if (!teacherDraft.teacherId) {
      return
    }
    setTeacherConstraints((prev) => [
      ...prev,
      {
        teacherId: teacherDraft.teacherId,
        preferredShift: teacherDraft.preferredShift,
        avoidLastSlot: teacherDraft.avoidLastSlot,
      },
    ])
    setTeacherDraft({ teacherId: '', preferredShift: 'any', avoidLastSlot: false })
  }

  const handleRemoveTeacherConstraint = (index: number) => {
    setTeacherConstraints((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleAddCoursePreference = () => {
    if (coursePreferenceDraft.courseId === '') {
      return
    }
    const preference: CoursePreferenceDto = {
      courseId: coursePreferenceDraft.courseId,
      preferredShift: coursePreferenceDraft.preferredShift,
    }
    const blockLengthValue = Number(coursePreferenceDraft.blockLength)
    if (!Number.isNaN(blockLengthValue) && blockLengthValue > 0) {
      preference.blockLength = blockLengthValue
    }
    const sessionsValue = Number(coursePreferenceDraft.sessionsPerWeek)
    if (!Number.isNaN(sessionsValue) && sessionsValue > 0) {
      preference.sessionsPerWeek = sessionsValue
    }
    setCoursePreferences((prev) => [...prev, preference])
    setCoursePreferenceDraft({
      courseId: '',
      preferredShift: 'any',
      blockLength: '',
      sessionsPerWeek: '',
    })
  }

  const handleRemoveCoursePreference = (index: number) => {
    setCoursePreferences((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleProfessorSearch = async (teacherId?: string) => {
    const targetId = teacherId ?? professorSelection
    if (!targetId) {
      setProfessorAssignments([])
      return
    }
    const result = await searchAssignmentsMutation.mutateAsync({ teacherId: targetId })
    setProfessorAssignments(result)
  }

  const handleClassGroupSearch = async (classGroupId?: number) => {
    const targetId = classGroupId ?? (classGroupSelection ? Number(classGroupSelection) : undefined)
    if (!targetId) {
      setClassGroupAssignments([])
      return
    }
    const result = await searchAssignmentsMutation.mutateAsync({ classGroupId: targetId })
    setClassGroupAssignments(result)
  }

  const buildPayload = (): GenerateTimetableDto | null => {
    if (!schoolYearId || teacherWeeklyHourCap <= 0 || !division) {
      return null
    }
    return {
      schoolYearId,
      division,
      teacherWeeklyHourCap,
      teacherConstraints: teacherConstraints.length ? teacherConstraints : undefined,
      coursePreferences: coursePreferences.length ? coursePreferences : undefined,
    }
  }

  const handlePreview = () => {
    const payload = buildPayload()
    if (!payload) {
      setPreviewError('Completa los datos requeridos antes de previsualizar.')
      return
    }
    setPreviewError(null)
    setApplyError(null)
    setCapacityError(null)
    previewMutation.mutate(payload)
  }

  const handleApply = () => {
    if (!previewResult) {
      setApplyError('Genera una previsualización antes de aplicar.')
      return
    }
    const payload = buildPayload()
    if (!payload) {
      setApplyError('Completa los datos requeridos antes de aplicar.')
      return
    }
    setApplyError(null)
    applyMutation.mutate(payload)
  }

  const renderSlotPatternForm = () => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle2">
          Define el patrón diario para generar franjas horarias.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Periodos por día"
            type="number"
            value={periodsPerDay}
            onChange={(event) => setPeriodsPerDay(Math.max(1, Number(event.target.value) || periodsPerDay))}
          />
          <TextField
            label="Duración de cada clase (min)"
            type="number"
            value={classDurationMinutes}
            onChange={(event) =>
              setClassDurationMinutes(Math.max(5, Number(event.target.value) || classDurationMinutes))
            }
          />
          <TextField
            label="Inicio de jornada"
            type="time"
            value={schoolStartTime}
            onChange={(event) => setSchoolStartTime(event.target.value || '08:00')}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Descanso entre clases (min)"
            type="number"
            value={breakBetweenClassesMinutes}
            onChange={(event) =>
              setBreakBetweenClassesMinutes(Math.max(0, Number(event.target.value) || breakBetweenClassesMinutes))
            }
            helperText="0 para clases consecutivas"
          />
          <TextField
            label="Hora de almuerzo"
            type="time"
            value={mealBreakTime}
            onChange={(event) => setMealBreakTime(event.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Dejar vacío si no aplica"
          />
          <TextField
            label="Duración del almuerzo (min)"
            type="number"
            value={mealBreakDurationMinutes}
            onChange={(event) =>
              setMealBreakDurationMinutes(Math.max(0, Number(event.target.value) || mealBreakDurationMinutes))
            }
          />
          <TextField
            label="Hora del receso general"
            type="time"
            value={generalBreakTime}
            onChange={(event) => setGeneralBreakTime(event.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Dejar vacío si no aplica"
          />
          <TextField
            label="Duración receso general (min)"
            type="number"
            value={generalBreakDurationMinutes}
            onChange={(event) =>
              setGeneralBreakDurationMinutes(Math.max(0, Number(event.target.value) || generalBreakDurationMinutes))
            }
          />
        </Stack>
        <Alert severity="info">
          TODO: soportar múltiples descansos y patrones diferentes por día.
        </Alert>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={() => createSlotsMutation.mutate()}
            disabled={createSlotsMutation.isPending || !schoolYearId}
          >
            {createSlotsMutation.isPending ? 'Generando slots…' : 'Preview & create slots'}
          </Button>
          {hasSlotsForYear ? (
            <Button variant="text" onClick={() => setShowSlotEditor(false)} disabled={createSlotsMutation.isPending}>
              Cancelar
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  )

  const wizardCanProceed = () => {
    if (!schoolYearId || !division) {
      return false
    }
    if (wizardStep === 1) {
      return selectedClassGroupIds.length > 0
    }
    if (wizardStep === 2) {
      return hasSlotsForYear && !deleteSlotsMutation.isPending && !createSlotsMutation.isPending
    }
    if (wizardStep === 3) {
      return teacherWeeklyHourCap > 0
    }
    return true
  }

  const renderWizardStep = () => {
    if (wizardStep === 1) {
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle1">Step 1 · Scope</Typography>
          {!divisionRange ? (
            <Alert severity="info">Selecciona una división para listar los grupos disponibles.</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Selecciona los grupos que entrarán en la generación. Por defecto, el generador utilizará todos los cursos del año escolar y las horas semanales definidas en cada curso.
              </Typography>
              {isLoadingClassGroups ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : null}
              {isClassGroupsError ? (
                <Alert severity="error">{classGroupsError?.message || 'Error cargando grupos.'}</Alert>
              ) : null}
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                }}
              >
                {Object.entries(groupedClassGroups).map(([grade, groups]) => (
                  <Paper key={grade} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle1">Grado {grade}</Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {groups.map((group) => (
                          <Chip
                            key={group.classGroupId}
                            label={`${group.gradeLevel}° ${group.section}`}
                            color={
                              (gradeClassGroupIds.get(group.gradeLevel) ?? []).every((id) =>
                                selectedClassGroupIds.includes(id),
                              )
                                ? 'primary'
                                : 'default'
                            }
                            onClick={() => handleToggleGrade(group.gradeLevel)}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </>
          )}
        </Stack>
      )
    }

    if (wizardStep === 2) {
      if (!divisionRange) {
        return <Alert severity="info">Selecciona una división para configurar las franjas horarias.</Alert>
      }
      const yearLabel = selectedYear?.name ?? 'este año escolar'

      return (
        <Stack spacing={2}>
          <Typography variant="subtitle1">Step 2 · Time slots skeleton</Typography>
          <Typography variant="body2" color="text.secondary">
            Asegúrate de que las franjas horarias estén configuradas para {yearLabel} antes de continuar.
          </Typography>
          {isSlotsError ? (
            <Alert severity="error">{slotsError?.message || 'Error cargando las franjas horarias.'}</Alert>
          ) : null}
          {isLoadingSlots ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          ) : hasSlotsForYear ? (
            <>
              <Typography variant="body2">Time slots skeleton for {yearLabel}</Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Horario</TableCell>
                      {WORKING_DAYS.map((day) => (
                        <TableCell key={day} align="center">
                          {DAYS_OF_WEEK[day - 1]?.slice(0, 3) ?? `Día ${day}`}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {slotRows.map((row) => (
                      <TableRow key={row.label} sx={row.isBreak ? { bgcolor: 'warning.light' } : undefined}>
                        <TableCell>{row.label}</TableCell>
                        {WORKING_DAYS.map((day) => {
                          if (row.isBreak) {
                            return (
                              <TableCell key={`${day}-${row.start}`} align="center">
                                BREAK
                              </TableCell>
                            )
                          }
                          const exists = slotsForYear.some(
                            (slot) =>
                              slot.dayOfWeek === day &&
                              slot.startTime === row.start &&
                              slot.endTime === row.end,
                          )
                          return (
                            <TableCell key={`${day}-${row.start}`} align="center">
                              {exists ? '✓' : ''}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="body2" color="text.secondary">
                Si este esqueleto luce correcto, continúa al siguiente paso.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={() => setShowSlotEditor((prev) => !prev)}>
                  {showSlotEditor ? 'Ocultar editor' : 'Editar/Agregar slots'}
                </Button>
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => setConfirmDeleteSlots(true)}
                  disabled={deleteSlotsMutation.isPending}
                >
                  {deleteSlotsMutation.isPending ? 'Eliminando…' : 'Eliminar slots'}
                </Button>
              </Stack>
              {showSlotEditor ? renderSlotPatternForm() : null}
            </>
          ) : (
            renderSlotPatternForm()
          )}
        </Stack>
      )
    }

    if (wizardStep === 3) {
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle1">Step 3 · Teacher constraints</Typography>
          <TextField
            label="Global weekly cap per teacher"
            type="number"
            value={teacherWeeklyHourCap}
            onChange={(event) => {
              const nextValue = Number(event.target.value)
              setTeacherWeeklyHourCap(Number.isFinite(nextValue) ? nextValue : 0)
            }}
            error={teacherWeeklyHourCap <= 0}
            helperText={teacherWeeklyHourCap <= 0 ? 'Debe ser mayor a 0' : ''}
            sx={{ maxWidth: 240 }}
          />
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="body2" fontWeight={600}>
                Nuevo constraint
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="teacher-select-label">Professor</InputLabel>
                <Select
                  labelId="teacher-select-label"
                  label="Professor"
                  value={teacherDraft.teacherId}
                  onChange={(event) => setTeacherDraft((prev) => ({ ...prev, teacherId: event.target.value as string }))}
                >
                  {professors.map((prof) => (
                    <MenuItem key={prof.nationalId} value={prof.nationalId}>
                      {(prof.firstName ?? '') + ' ' + (prof.lastName ?? '')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="shift-select-label">Preferred shift</InputLabel>
                <Select
                  labelId="shift-select-label"
                  label="Preferred shift"
                  value={teacherDraft.preferredShift}
                  onChange={(event) =>
                    setTeacherDraft((prev) => ({
                      ...prev,
                      preferredShift: event.target.value as 'any' | 'morning' | 'afternoon',
                    }))
                  }
                >
                  <MenuItem value="any">Any</MenuItem>
                  <MenuItem value="morning">Morning</MenuItem>
                  <MenuItem value="afternoon">Afternoon</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={teacherDraft.avoidLastSlot}
                    onChange={(event) => setTeacherDraft((prev) => ({ ...prev, avoidLastSlot: event.target.checked }))}
                  />
                }
                label="Avoid last slot"
              />
              <Button variant="contained" onClick={handleAddTeacherConstraint} disabled={!teacherDraft.teacherId}>
                Add constraint
              </Button>
            </Stack>
          </Paper>
          {teacherConstraints.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No teacher-specific constraints yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Teacher</TableCell>
                    <TableCell>Shift</TableCell>
                    <TableCell>Avoid last slot</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teacherConstraints.map((constraint, index) => {
                    const prof = professors.find((p) => p.nationalId === constraint.teacherId)
                    return (
                      <TableRow key={`${constraint.teacherId}-${index}`}>
                        <TableCell>{prof ? `${prof.firstName ?? ''} ${prof.lastName ?? ''}` : constraint.teacherId}</TableCell>
                        <TableCell>{constraint.preferredShift ?? 'any'}</TableCell>
                        <TableCell>{constraint.avoidLastSlot ? 'Yes' : 'No'}</TableCell>
                        <TableCell align="right">
                          <Button color="error" size="small" onClick={() => handleRemoveTeacherConstraint(index)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      )
    }

    if (wizardStep === 4) {
      const coursePreferenceOptions = (coursesData ?? [])
        .filter((course) => {
          if (!divisionRange) {
            return true
          }
          return course.gradeLevel >= divisionRange.minGrade && course.gradeLevel <= divisionRange.maxGrade
        })
        .map((course) => ({
          value: course.courseId,
          label: `${course.subjectName} · ${course.gradeLevel}° ${course.section}`,
        }))

      return (
        <Stack spacing={2}>
          <Typography variant="subtitle1">Step 4 · Revisión y aplicación</Typography>
          {capacityError && capacityError.length > 0 ? (
            <Alert severity="error">
              <Typography variant="subtitle2" gutterBottom>
                Faltan docentes para completar el horario:
              </Typography>
              <Stack spacing={0.5}>
                {capacityError.map((issue, index) => (
                  <Typography key={`${issue.gradeLevel}-${issue.subjectName}-${index}`} variant="body2">
                    Grado {issue.gradeLevel}: {issue.subjectName} · Requeridos {issue.requiredTeachers} · Disponibles{' '}
                    {issue.availableTeachers}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          ) : null}
          {previewError ? <Alert severity="error">{previewError}</Alert> : null}
          {applyError ? <Alert severity="error">{applyError}</Alert> : null}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="body2">
                Año escolar: {selectedYear?.name ?? 'N/A'}
              </Typography>
              <Typography variant="body2">División: {division ? DIVISION_CONFIG[division].label : 'N/A'}</Typography>
              <Typography variant="body2">
                Grupos seleccionados: {selectedClassGroupIds.length || 'todos'}
              </Typography>
              <Typography variant="body2">
                Límite semanal global: {teacherWeeklyHourCap}
              </Typography>
              <Typography variant="body2">Constraints docentes: {teacherConstraints.length}</Typography>
              <Typography variant="body2">Preferencias de cursos: {coursePreferences.length}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} mt={2}>
              <Button variant="text" onClick={() => setWizardStep(3)}>
                Editar constraints
              </Button>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2">Preferencias de cursos</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Curso"
                  value={coursePreferenceDraft.courseId}
                  onChange={(event) =>
                    setCoursePreferenceDraft((prev) => ({
                      ...prev,
                      courseId: event.target.value === '' ? '' : Number(event.target.value),
                    }))
                  }
                >
                  <MenuItem value="">
                    <em>Selecciona un curso</em>
                  </MenuItem>
                  {coursePreferenceOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Turno preferido"
                  value={coursePreferenceDraft.preferredShift}
                  onChange={(event) =>
                    setCoursePreferenceDraft((prev) => ({
                      ...prev,
                      preferredShift: event.target.value as 'any' | 'morning' | 'afternoon',
                    }))
                  }
                >
                  <MenuItem value="any">Cualquiera</MenuItem>
                  <MenuItem value="morning">Mañana</MenuItem>
                  <MenuItem value="afternoon">Tarde</MenuItem>
                </TextField>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Bloques consecutivos"
                  type="number"
                  value={coursePreferenceDraft.blockLength}
                  onChange={(event) =>
                    setCoursePreferenceDraft((prev) => ({ ...prev, blockLength: event.target.value }))
                  }
                />
                <TextField
                  label="Sesiones por semana"
                  type="number"
                  value={coursePreferenceDraft.sessionsPerWeek}
                  onChange={(event) =>
                    setCoursePreferenceDraft((prev) => ({ ...prev, sessionsPerWeek: event.target.value }))
                  }
                />
                <Button variant="outlined" onClick={handleAddCoursePreference} disabled={!coursePreferenceDraft.courseId}>
                  Agregar preferencia
                </Button>
              </Stack>
              {coursePreferences.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Curso</TableCell>
                        <TableCell>Turno</TableCell>
                        <TableCell>Bloque</TableCell>
                        <TableCell>Sesiones/sem</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {coursePreferences.map((preference, index) => (
                        <TableRow key={`${preference.courseId}-${index}`}>
                          <TableCell>
                            {describeCourse(preference.courseId, coursesById.get(preference.courseId)?.classGroupId)}
                          </TableCell>
                          <TableCell>{preference.preferredShift ?? 'any'}</TableCell>
                          <TableCell>{preference.blockLength ?? 'auto'}</TableCell>
                          <TableCell>{preference.sessionsPerWeek ?? 'auto'}</TableCell>
                          <TableCell align="right">
                            <Button color="error" size="small" onClick={() => handleRemoveCoursePreference(index)}>
                              Quitar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin preferencias adicionales. El generador usará las horas semanales por defecto.
                </Typography>
              )}
            </Stack>
          </Paper>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" onClick={() => setWizardStep(3)}>
                Back
              </Button>
              <Button variant="contained" onClick={handlePreview} disabled={previewMutation.isPending}>
                {previewMutation.isPending ? 'Generando preview…' : 'Previsualizar horario'}
              </Button>
            </Stack>
            {previewResult ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">Resultado de previsualización</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Alert severity="success" sx={{ flex: 1 }}>
                      Asignaciones propuestas: {previewResult.assignments.length}
                    </Alert>
                    <Alert severity={previewResult.unassignedSessions.length > 0 ? 'warning' : 'success'} sx={{ flex: 1 }}>
                      Sesiones sin asignar: {previewResult.unassignedSessions.length}
                    </Alert>
                  </Stack>
                  {previewResult.unassignedSessions.length > 0 ? (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Sesiones sin asignar</Typography>
                      {previewResult.unassignedSessions.map((item, index) => (
                        <Paper key={`${item.courseId}-${item.classGroupId}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {describeCourse(item.courseId, item.classGroupId)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Docente {item.teacherId ?? 'N/A'} · Motivo: {item.reason}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">Ver agrupado por:</Typography>
                    <Button
                      size="small"
                      variant={previewGrouping === 'classGroup' ? 'contained' : 'outlined'}
                      onClick={() => setPreviewGrouping('classGroup')}
                    >
                      Grupo
                    </Button>
                    <Button
                      size="small"
                      variant={previewGrouping === 'day' ? 'contained' : 'outlined'}
                      onClick={() => setPreviewGrouping('day')}
                    >
                      Día
                    </Button>
                  </Stack>
                  {previewGroupedAssignments.length > 0 ? (
                    <Stack spacing={1}>
                      {previewGroupedAssignments.map(([label, assignments]) => (
                        <Paper key={label} variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="subtitle2">{label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Sesiones: {assignments.length}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleApply}
                    disabled={applyMutation.isPending || previewMutation.isPending}
                  >
                    {applyMutation.isPending ? 'Aplicando…' : 'Aplicar horario'}
                  </Button>
                </Stack>
              </Paper>
            ) : null}
            {applyResult ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2">Resultado al aplicar</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={1}>
                  <Alert severity="success" sx={{ flex: 1 }}>
                    Persistidas: {applyResult.persistedAssignments.length}
                  </Alert>
                  <Alert severity={applyResult.failedToPersist.length > 0 ? 'warning' : 'success'} sx={{ flex: 1 }}>
                    No guardadas: {applyResult.failedToPersist.length}
                  </Alert>
                </Stack>
                {applyResult.failedToPersist.length > 0 ? (
                  <Stack spacing={0.5} mt={2}>
                    {applyResult.failedToPersist.map((item, index) => (
                      <Typography key={`${item.courseId}-${item.classGroupId}-${index}`} variant="body2" color="error">
                        • {describeCourse(item.courseId, item.classGroupId)} · Motivo: {item.reason ?? 'Error desconocido'}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" mt={2}>
                    Todas las sesiones fueron registradas correctamente.
                  </Typography>
                )}
              </Paper>
            ) : null}
          </Stack>
        </Stack>
      )
    }

    return (
      <Stack spacing={2}>
        <Alert severity="info">Selecciona un paso válido.</Alert>
      </Stack>
    )
  }

  const renderWizard = () => {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h6">Timetable wizard</Typography>
          {wizardMessage ? <Alert severity="info">{wizardMessage}</Alert> : null}
          {renderWizardStep()}
          {wizardStep < 4 ? (
            <Stack direction="row" spacing={2}>
              {wizardStep > 1 ? (
                <Button variant="outlined" onClick={() => setWizardStep(((wizardStep - 1) as WizardStep))}>
                  Back
                </Button>
              ) : (
                <Button variant="text" onClick={() => setIsWizardActive(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => setWizardStep(((wizardStep + 1) as WizardStep))}
                disabled={!wizardCanProceed()}
              >
                Next
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    )
  }

  const renderExistingTools = () => (
    <Box sx={{ px: { xs: 1, md: 3 }, py: 3, width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }} >
        Current timetable for {schoolYears?.find((year) => year.schoolYearId === schoolYearId)?.name ?? 'year'}
      </Typography>
      {!division ? (
        <Alert severity="info">Selecciona una división para revisar el horario existente.</Alert>
      ) : null}
      {timetableMessage ? (
        <Alert severity="info" sx={{ mb: 2 }}>{timetableMessage}</Alert>
      ) : null}
      {division ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
            width: '100%',
          }}
        >
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            minWidth: { xs: '100%', md: '50%' },
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="subtitle1">Profesores</Typography>
          <TextField
            label="Buscar profesor"
            value={professorSearch}
            onChange={(event) => setProfessorSearch(event.target.value)}
            placeholder="e.g. Juan Pérez"
          />
          <Stack spacing={1} sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {filteredProfessors.map((prof) => (
              <Button
                key={prof.nationalId}
                variant={professorSelection === prof.nationalId ? 'contained' : 'outlined'}
                onClick={() => {
                  setProfessorSelection(prof.nationalId)
                  handleProfessorSearch(prof.nationalId)
                }}
                disabled={searchAssignmentsMutation.isPending}
              >
                {(prof.firstName ?? '') + ' ' + (prof.lastName ?? '')}
              </Button>
            ))}
            {filteredProfessors.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin profesores que coincidan.
              </Typography>
            ) : null}
          </Stack>
          <TimetableResultsTable title="Professor" assignments={professorAssignments} />
        </Paper>
        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            minWidth: { xs: '100%', md: '50%' },
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="subtitle1">Grupos</Typography>
          <TextField
            label="Buscar grupo"
            value={classGroupSearch}
            onChange={(event) => setClassGroupSearch(event.target.value)}
            placeholder="e.g. 8° B"
          />
          <Stack spacing={1} sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {filteredClassGroups.map((group) => (
              <Button
                key={group.classGroupId}
                variant={Number(classGroupSelection) === group.classGroupId ? 'contained' : 'outlined'}
                onClick={() => {
                  setClassGroupSelection(group.classGroupId)
                  handleClassGroupSearch(group.classGroupId)
                }}
                disabled={searchAssignmentsMutation.isPending}
              >
                {`${group.gradeLevel}° ${group.section}`}
              </Button>
            ))}
            {filteredClassGroups.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin grupos que coincidan.
              </Typography>
            ) : null}
          </Stack>
          <TimetableResultsTable title="Class group" assignments={classGroupAssignments} />
        </Paper>
        </Box>
      ) : null}
      <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} sx={{ mt: 3, maxWidth: 600, mx: 'auto' }}>
        <Button
          sx={{ flex: 1 }}
          color="warning"
          variant="contained"
          onClick={() => setConfirmOpen(true)}
          disabled={regenerateTimetableMutation.isPending}
        >
          Regenerate timetable
        </Button>
        <Button
          sx={{ flex: 1 }}
          color="error"
          variant="outlined"
          onClick={() => setConfirmDeleteTimetable(true)}
          disabled={deleteTimetableMutation.isPending || !schoolYearId}
        >
          {deleteTimetableMutation.isPending ? 'Deleting timetable…' : 'Delete timetable'}
        </Button>
      </Stack>
    </Box>
  )

  const renderWizardLauncher = () => (
    <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography>No timetable has been generated for this school year yet.</Typography>
      <Button
        variant="contained"
        onClick={() => {
          setWizardMessage(null)
          setIsWizardActive(true)
        }}
      >
        Start timetable generation
      </Button>
      {wizardMessage ? <Alert severity="info">{wizardMessage}</Alert> : null}
    </Paper>
  )

  const renderImportPanel = () => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="h6">Importar horario desde PDF</Typography>
            <Typography variant="body2" color="text.secondary">
              Sube el horario de profesores para detectar profesores, grupos, asignaturas, franjas y clases antes de confirmar la carga.
            </Typography>
          </Box>
          <Box>
            <Button
              component="label"
              variant="outlined"
              disabled={scanTimetableMutation.isPending}
            >
              {scanTimetableMutation.isPending ? 'Leyendo PDF...' : 'Subir PDF'}
              <input
                hidden
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) {
                    scanTimetableMutation.mutate(file)
                  }
                }}
              />
            </Button>
          </Box>
        </Stack>

        {timetableImportError ? (
          <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{timetableImportError}</Alert>
        ) : null}
        {timetableImportResult ? (
          <Stack spacing={2}>
            <Alert severity="info">{timetableImportResult.message}</Alert>
            {timetableImportResult.warnings.length > 0 ? (
              <Alert severity="warning">{timetableImportResult.warnings.join(' ')}</Alert>
            ) : null}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${timetableImportResult.teachers.length} profesores`} />
              <Chip label={`${timetableImportResult.classGroups.length} grupos`} />
              <Chip label={`${timetableImportResult.subjects.length} asignaturas`} />
              <Chip label={`${timetableImportResult.slots.length} franjas`} />
              <Chip label={`${timetableImportResult.assignments.length} clases`} />
            </Stack>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Profesor</TableCell>
                    <TableCell>Asignatura</TableCell>
                    <TableCell>Grupo</TableCell>
                    <TableCell>Día</TableCell>
                    <TableCell>Periodo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {timetableImportResult.assignments.slice(0, 80).map((assignment, index) => (
                    <TableRow
                      key={`${assignment.teacherId}-${assignment.groupCode}-${assignment.dayOfWeek}-${assignment.period}-${index}`}
                    >
                      <TableCell>{assignment.teacherName}</TableCell>
                      <TableCell>{assignment.subjectName}</TableCell>
                      <TableCell>{assignment.groupCode}</TableCell>
                      <TableCell>{DAYS_OF_WEEK[assignment.dayOfWeek - 1] ?? assignment.dayOfWeek}</TableCell>
                      <TableCell>{`${assignment.period} · ${assignment.startTime.slice(0, 5)}-${assignment.endTime.slice(0, 5)}`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {timetableImportResult.assignments.length > 80 ? (
              <Typography variant="caption" color="text.secondary">
                Mostrando 80 de {timetableImportResult.assignments.length} clases detectadas.
              </Typography>
            ) : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                variant="contained"
                color="warning"
                onClick={() => confirmTimetableImportMutation.mutate()}
                disabled={!schoolYearId || confirmTimetableImportMutation.isPending}
              >
                {confirmTimetableImportMutation.isPending ? 'Importando...' : 'Confirmar importación'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Revisa la muestra antes de confirmar. La importación creará datos faltantes y omitirá choques de horario existentes.
              </Typography>
            </Stack>
            {timetableImportApplyResult ? (
              <Alert severity="success">
                {timetableImportApplyResult.message} Contraseña temporal para profesores nuevos: {timetableImportApplyResult.defaultTeacherPassword}
              </Alert>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="h5">Timetable generator</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="school-year-select">School year</InputLabel>
          <Select
            labelId="school-year-select"
            label="School year"
            value={selectedSchoolYearId}
            onChange={(event) => setSelectedSchoolYearId(event.target.value as string)}
          >
            {(schoolYears ?? []).map((year) => (
              <MenuItem key={year.schoolYearId} value={year.schoolYearId}>
                {year.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="division-select">División</InputLabel>
          <Select
            labelId="division-select"
            label="División"
            value={division}
            onChange={(event) => setDivision(event.target.value as Division | '')}
          >
            <MenuItem value="">
              <em>Selecciona una división</em>
            </MenuItem>
            {Object.entries(DIVISION_CONFIG).map(([key, info]) => {
              const typedKey = key as Division
              return (
                <MenuItem key={typedKey} value={typedKey}>
                  {info.label}
                </MenuItem>
              )
            })}
          </Select>
        </FormControl>
        {isCheckingTimetable || isLoadingClassGroups ? <CircularProgress size={24} /> : null}
      </Stack>

      {renderImportPanel()}

      {hasTimetable ? renderExistingTools() : isWizardActive ? renderWizard() : renderWizardLauncher()}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Regenerate timetable?</DialogTitle>
        <DialogContent>
          <Typography>
            This will recompute the timetable for the selected year and may overwrite existing assignments. Are you sure you want to continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirmOpen(false)
              regenerateTimetableMutation.mutate()
            }}
            disabled={regenerateTimetableMutation.isPending}
          >
            {regenerateTimetableMutation.isPending ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmDeleteSlots} onClose={() => setConfirmDeleteSlots(false)}>
        <DialogTitle>Eliminar slots de horario</DialogTitle>
        <DialogContent>
          <Typography>
            Esta acción eliminará todas las franjas horarias configuradas para {selectedYear?.name ?? 'este año escolar'}. ¿Deseas continuar?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteSlots(false)}>Cancelar</Button>
          <Button
            color="error"
            onClick={() => deleteSlotsMutation.mutate()}
            disabled={deleteSlotsMutation.isPending}
          >
            {deleteSlotsMutation.isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmDeleteTimetable} onClose={() => setConfirmDeleteTimetable(false)}>
        <DialogTitle>Delete timetable?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove all timetable assignments for {selectedYear?.name ?? 'the selected year'}. ¿Deseas continuar?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteTimetable(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => deleteTimetableMutation.mutate()}
            disabled={deleteTimetableMutation.isPending}
          >
            {deleteTimetableMutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default TimetableGeneratorPage

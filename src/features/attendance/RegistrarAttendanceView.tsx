import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
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
  Tooltip,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { attendanceApi, type AttendanceRecord, type AttendanceStatus } from '../../api/attendanceApi'
import { coursesApi, type CourseSummary } from '../../api/coursesApi'
import { timetableAssignmentsApi } from '../../api/timetableAssignmentsApi'
import type { TimetableAssignment } from '../../api/timetableGeneratorApi'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { addDays, parseIsoDate, toIsoDate } from './colombiaCalendar'

type GroupOption = {
  classGroupId: number
  gradeLevel: number
  section: string
  groupCode: string
}

type WeekDay = {
  dayOfWeek: number
  isoDate: string
  label: string
}

type DaySlotColumn = {
  key: string
  dayOfWeek: number
  isoDate: string
  slotOrder: number
  assignment: TimetableAssignment | null
  course: CourseSummary | null
}

const weekdayColumns = [
  { dayOfWeek: 1, label: 'Lunes' },
  { dayOfWeek: 2, label: 'Martes' },
  { dayOfWeek: 3, label: 'Miércoles' },
  { dayOfWeek: 4, label: 'Jueves' },
  { dayOfWeek: 5, label: 'Viernes' },
] as const

const formatFullName = (firstName: string | null, lastName: string | null) =>
  `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Sin nombre'

const normalize = (value: string) => value.trim().toLocaleLowerCase('es')

const startOfWeekMonday = (date: Date) => {
  const day = date.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return addDays(date, offset)
}

const statusCellStyles: Record<AttendanceStatus, { backgroundColor: string; color: string }> = {
  P: { backgroundColor: 'success.50', color: 'success.dark' },
  A: { backgroundColor: 'error.50', color: 'error.dark' },
  AE: { backgroundColor: 'warning.50', color: 'warning.dark' },
}

export const RegistrarAttendanceView = () => {
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(toIsoDate(today))
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | ''>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<number | ''>('')
  const [selectedClassGroupId, setSelectedClassGroupId] = useState<number | ''>('')
  const [studentSearch, setStudentSearch] = useState('')
  const deferredStudentSearch = useDeferredValue(studentSearch)

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
    const activeSchoolYear = sortedSchoolYears.find((schoolYear) => schoolYear.isActive)
    setSelectedSchoolYearId(activeSchoolYear?.schoolYearId ?? sortedSchoolYears[0]?.schoolYearId ?? '')
  }, [selectedSchoolYearId, sortedSchoolYears])

  const {
    data: courses,
    isLoading: isLoadingCourses,
    isError: isCoursesError,
    error: coursesError,
  } = useQuery({
    queryKey: ['registrar-attendance-courses', selectedSchoolYearId],
    queryFn: () => {
      if (selectedSchoolYearId === '') {
        return Promise.resolve([])
      }
      return coursesApi.list({ schoolYearId: Number(selectedSchoolYearId) })
    },
    enabled: selectedSchoolYearId !== '',
    staleTime: 5 * 60_000,
  })

  const {
    data: assignments,
    isLoading: isLoadingAssignments,
    isError: isAssignmentsError,
    error: assignmentsError,
  } = useQuery({
    queryKey: ['registrar-attendance-assignments', selectedSchoolYearId],
    queryFn: () => {
      if (selectedSchoolYearId === '') {
        return Promise.resolve([])
      }
      return timetableAssignmentsApi.listByYear(Number(selectedSchoolYearId))
    },
    enabled: selectedSchoolYearId !== '',
    staleTime: 5 * 60_000,
  })

  const sortedCourses = useMemo(() => {
    return (courses ?? []).slice().sort((left, right) => {
      if (left.gradeLevel !== right.gradeLevel) {
        return left.gradeLevel - right.gradeLevel
      }
      const sectionCompare = left.classGroupCode.localeCompare(right.classGroupCode, 'es', {
        numeric: true,
      })
      if (sectionCompare !== 0) {
        return sectionCompare
      }
      return left.subjectName.localeCompare(right.subjectName, 'es')
    })
  }, [courses])

  const groupOptions = useMemo<GroupOption[]>(() => {
    const seen = new Set<number>()
    const groups: GroupOption[] = []

    sortedCourses.forEach((course) => {
      if (seen.has(course.classGroupId)) {
        return
      }
      seen.add(course.classGroupId)
      groups.push({
        classGroupId: course.classGroupId,
        gradeLevel: course.gradeLevel,
        section: course.section,
        groupCode: course.classGroupCode,
      })
    })

    return groups.sort((left, right) => {
      if (left.gradeLevel !== right.gradeLevel) {
        return left.gradeLevel - right.gradeLevel
      }
      return left.groupCode.localeCompare(right.groupCode, 'es', { numeric: true })
    })
  }, [sortedCourses])

  const availableGrades = useMemo(() => {
    return Array.from(new Set(groupOptions.map((group) => group.gradeLevel))).sort((left, right) => left - right)
  }, [groupOptions])

  useEffect(() => {
    if (
      selectedGradeLevel !== '' &&
      availableGrades.some((gradeLevel) => gradeLevel === selectedGradeLevel)
    ) {
      return
    }
    setSelectedGradeLevel(availableGrades[0] ?? '')
  }, [availableGrades, selectedGradeLevel])

  const groupsForSelectedGrade = useMemo(() => {
    if (selectedGradeLevel === '') {
      return []
    }
    return groupOptions.filter((group) => group.gradeLevel === selectedGradeLevel)
  }, [groupOptions, selectedGradeLevel])

  useEffect(() => {
    if (
      selectedClassGroupId !== '' &&
      groupsForSelectedGrade.some((group) => group.classGroupId === selectedClassGroupId)
    ) {
      return
    }
    setSelectedClassGroupId(groupsForSelectedGrade[0]?.classGroupId ?? '')
  }, [groupsForSelectedGrade, selectedClassGroupId])

  const selectedGroup = useMemo(
    () => groupsForSelectedGrade.find((group) => group.classGroupId === selectedClassGroupId) ?? null,
    [groupsForSelectedGrade, selectedClassGroupId],
  )

  const selectedGroupCourses = useMemo(() => {
    if (!selectedGroup) {
      return []
    }
    return sortedCourses.filter((course) => course.classGroupId === selectedGroup.classGroupId)
  }, [selectedGroup, sortedCourses])

  const courseLookup = useMemo(() => {
    return new Map<number, CourseSummary>(selectedGroupCourses.map((course) => [course.courseId, course]))
  }, [selectedGroupCourses])

  const weekDays = useMemo<WeekDay[]>(() => {
    const weekStart = startOfWeekMonday(parseIsoDate(selectedDate))
    return weekdayColumns.map((weekday, index) => ({
      dayOfWeek: weekday.dayOfWeek,
      isoDate: toIsoDate(addDays(weekStart, index)),
      label: weekday.label,
    }))
  }, [selectedDate])

  const weekStartDate = weekDays[0]?.isoDate ?? selectedDate
  const weekEndDate = weekDays[weekDays.length - 1]?.isoDate ?? selectedDate

  const selectedAssignments = useMemo(() => {
    if (!selectedGroup) {
      return []
    }

    return (assignments ?? [])
      .filter((assignment) => Number(assignment.classGroupId ?? 0) === selectedGroup.classGroupId)
      .filter((assignment) => {
        const slotDay = assignment.slot?.dayOfWeek
        return Boolean(slotDay && slotDay >= 1 && slotDay <= 5 && assignment.slot?.startTime && assignment.slot?.endTime)
      })
      .sort((left, right) => {
        const leftDay = left.slot?.dayOfWeek ?? 0
        const rightDay = right.slot?.dayOfWeek ?? 0
        if (leftDay !== rightDay) {
          return leftDay - rightDay
        }
        const startCompare = (left.slot?.startTime ?? '').localeCompare(right.slot?.startTime ?? '')
        if (startCompare !== 0) {
          return startCompare
        }
        return (left.slot?.endTime ?? '').localeCompare(right.slot?.endTime ?? '')
      })
  }, [assignments, selectedGroup])

  const daySlotColumnsByDay = useMemo(() => {
    return weekDays.map((day) => {
      const dayAssignments = selectedAssignments
        .filter((assignment) => assignment.slot?.dayOfWeek === day.dayOfWeek)
        .sort((left, right) => {
          const startCompare = (left.slot?.startTime ?? '').localeCompare(right.slot?.startTime ?? '')
          if (startCompare !== 0) {
            return startCompare
          }
          return (left.slot?.endTime ?? '').localeCompare(right.slot?.endTime ?? '')
        })

      const columns: DaySlotColumn[] =
        dayAssignments.length > 0
          ? dayAssignments.map((assignment, index) => ({
              key: `${day.isoDate}:${assignment.assignmentId}`,
              dayOfWeek: day.dayOfWeek,
              isoDate: day.isoDate,
              slotOrder: index + 1,
              assignment,
              course: courseLookup.get(Number(assignment.courseId)) ?? null,
            }))
          : [
              {
                key: `${day.isoDate}:empty`,
                dayOfWeek: day.dayOfWeek,
                isoDate: day.isoDate,
                slotOrder: 1,
                assignment: null,
                course: null,
              },
            ]

      return {
        ...day,
        columns,
      }
    })
  }, [courseLookup, selectedAssignments, weekDays])

  const flatDaySlotColumns = useMemo(() => {
    return daySlotColumnsByDay.flatMap((day) => day.columns)
  }, [daySlotColumnsByDay])

  const {
    data: roster,
    isLoading: isLoadingRoster,
    isError: isRosterError,
    error: rosterError,
  } = useQuery({
    queryKey: ['registrar-attendance-roster', selectedClassGroupId, selectedDate],
    queryFn: () => {
      if (selectedClassGroupId === '') {
        return Promise.resolve(null)
      }
      return attendanceApi.sheet({
        classGroupId: Number(selectedClassGroupId),
        date: selectedDate,
      })
    },
    enabled: selectedClassGroupId !== '',
    staleTime: 60_000,
  })

  const selectedCourseIdsKey = useMemo(() => {
    return selectedGroupCourses
      .map((course) => course.courseId)
      .sort((left, right) => left - right)
      .join(',')
  }, [selectedGroupCourses])

  const {
    data: weeklyRecords,
    isLoading: isLoadingRecords,
    isError: isRecordsError,
    error: recordsError,
  } = useQuery({
    queryKey: [
      'registrar-attendance-records',
      selectedClassGroupId,
      selectedCourseIdsKey,
      weekStartDate,
      weekEndDate,
    ],
    queryFn: async () => {
      if (!selectedGroupCourses.length) {
        return []
      }

      const results = await Promise.all(
        selectedGroupCourses.map((course) =>
          attendanceApi.list({
            courseId: course.courseId,
            from: weekStartDate,
            to: weekEndDate,
            page: 1,
            pageSize: 500,
          }),
        ),
      )

      return results.flatMap((result) => result.data)
    },
    enabled: selectedGroupCourses.length > 0,
    staleTime: 60_000,
  })

  const rosterStudents = roster?.students ?? []
  const normalizedSearch = normalize(deferredStudentSearch)

  const filteredStudents = useMemo(() => {
    if (!normalizedSearch) {
      return rosterStudents
    }

    return rosterStudents.filter((student) =>
      normalize(formatFullName(student.firstName, student.lastName)).includes(normalizedSearch),
    )
  }, [normalizedSearch, rosterStudents])

  const attendanceLookups = useMemo(() => {
    const byCourseDateStudent = new Map<string, AttendanceRecord>()
    const byCourseDateSlotStudent = new Map<string, AttendanceRecord>()
    const slotScopedCourseDates = new Set<string>()

    ;(weeklyRecords ?? []).forEach((record) => {
      const date = record.date.slice(0, 10)
      const courseDateKey = `${record.courseId}:${date}`
      const courseDateStudentKey = `${record.courseId}:${date}:${record.studentId}`
      byCourseDateStudent.set(courseDateStudentKey, record)

      if (record.slotId !== null) {
        slotScopedCourseDates.add(courseDateKey)
        byCourseDateSlotStudent.set(
          `${record.courseId}:${date}:${record.slotId}:${record.studentId}`,
          record,
        )
      }
    })

    return {
      byCourseDateStudent,
      byCourseDateSlotStudent,
      slotScopedCourseDates,
    }
  }, [weeklyRecords])

  const getAttendanceForCell = (studentId: number, column: DaySlotColumn) => {
    if (!column.assignment) {
      return null
    }

    const courseId = Number(column.assignment.courseId)
    const courseDateKey = `${courseId}:${column.isoDate}`

    if (attendanceLookups.slotScopedCourseDates.has(courseDateKey)) {
      return (
        attendanceLookups.byCourseDateSlotStudent.get(
          `${courseId}:${column.isoDate}:${column.assignment.slotId ?? 'none'}:${studentId}`,
        ) ?? null
      )
    }

    return attendanceLookups.byCourseDateStudent.get(`${courseId}:${column.isoDate}:${studentId}`) ?? null
  }

  const summaryCounts = useMemo(() => {
    const counts = { P: 0, A: 0, AE: 0 }

    filteredStudents.forEach((student) => {
      flatDaySlotColumns.forEach((column) => {
        const record = getAttendanceForCell(student.studentId, column)
        if (record) {
          counts[record.status] += 1
        }
      })
    })

    return counts
  }, [filteredStudents, flatDaySlotColumns, attendanceLookups])

  const isLoading =
    isLoadingYears ||
    isLoadingCourses ||
    isLoadingAssignments ||
    (selectedClassGroupId !== '' && isLoadingRoster) ||
    (selectedGroupCourses.length > 0 && isLoadingRecords)

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Typography variant="h4">Asistencia por grupo</Typography>
        <Chip label="Vista registro" color="primary" variant="outlined" />
      </Stack>

      <Alert severity="info">
        Vista solo lectura. La cuadrícula sigue el horario del grupo: días arriba, horas debajo de cada día y estudiantes en filas.
      </Alert>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="registrar-attendance-year-label">Año escolar</InputLabel>
              <Select
                labelId="registrar-attendance-year-label"
                label="Año escolar"
                value={selectedSchoolYearId}
                onChange={(event) => {
                  const value = event.target.value as string | number
                  setSelectedSchoolYearId(value === '' ? '' : Number(value))
                  setSelectedGradeLevel('')
                  setSelectedClassGroupId('')
                }}
                disabled={isLoadingYears}
              >
                {sortedSchoolYears.map((schoolYear) => (
                  <MenuItem key={schoolYear.schoolYearId} value={schoolYear.schoolYearId}>
                    {schoolYear.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="registrar-attendance-grade-label">Grado</InputLabel>
              <Select
                labelId="registrar-attendance-grade-label"
                label="Grado"
                value={selectedGradeLevel}
                onChange={(event) => {
                  const value = event.target.value as string | number
                  setSelectedGradeLevel(value === '' ? '' : Number(value))
                  setSelectedClassGroupId('')
                }}
                disabled={isLoadingCourses || availableGrades.length === 0}
              >
                {availableGrades.map((gradeLevel) => (
                  <MenuItem key={gradeLevel} value={gradeLevel}>
                    {`Grado ${gradeLevel}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="registrar-attendance-group-label">Grupo</InputLabel>
              <Select
                labelId="registrar-attendance-group-label"
                label="Grupo"
                value={selectedClassGroupId}
                onChange={(event) => setSelectedClassGroupId(Number(event.target.value))}
                disabled={groupsForSelectedGrade.length === 0}
              >
                {groupsForSelectedGrade.map((group) => (
                  <MenuItem key={group.classGroupId} value={group.classGroupId}>
                    {group.groupCode}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              type="date"
              label="Semana de referencia"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Buscar nombre completo"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Ej. Ana María Torres"
              fullWidth
              disabled={!rosterStudents.length}
            />
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {selectedGroup ? (
              <Chip label={`Grado ${selectedGroup.gradeLevel} · Grupo ${selectedGroup.groupCode}`} color="primary" />
            ) : null}
            <Chip label={`Semana ${weekStartDate} → ${weekEndDate}`} variant="outlined" />
            <Chip label={`Estudiantes ${filteredStudents.length}`} variant="outlined" />
            <Chip label={`P ${summaryCounts.P}`} color="success" variant="outlined" />
            <Chip label={`A ${summaryCounts.A}`} color="error" variant="outlined" />
            <Chip label={`AE ${summaryCounts.AE}`} color="warning" variant="outlined" />
          </Stack>

          {isCoursesError ? (
            <Alert severity="error">
              {coursesError instanceof Error ? coursesError.message : 'No se pudieron cargar los cursos.'}
            </Alert>
          ) : null}

          {isAssignmentsError ? (
            <Alert severity="error">
              {assignmentsError instanceof Error ? assignmentsError.message : 'No se pudieron cargar los módulos del horario.'}
            </Alert>
          ) : null}

          {isRosterError ? (
            <Alert severity="error">
              {rosterError instanceof Error ? rosterError.message : 'No se pudo cargar el listado del grupo.'}
            </Alert>
          ) : null}

          {isRecordsError ? (
            <Alert severity="error">
              {recordsError instanceof Error ? recordsError.message : 'No se pudo cargar la asistencia semanal.'}
            </Alert>
          ) : null}

          {isLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : null}

          {!isLoading && selectedClassGroupId === '' ? (
            <Alert severity="info">Selecciona un grupo para consultar la asistencia semanal.</Alert>
          ) : null}

          {!isLoading && selectedClassGroupId !== '' && !selectedAssignments.length ? (
            <Alert severity="info">
              El grupo seleccionado no tiene horas asignadas en el horario para construir la cuadrícula de asistencia.
            </Alert>
          ) : null}

          {!isLoading && rosterStudents.length > 0 && filteredStudents.length === 0 ? (
            <Alert severity="info">No hay estudiantes del grupo que coincidan con la búsqueda por nombre completo.</Alert>
          ) : null}

          {!isLoading && selectedAssignments.length > 0 ? (
            <TableContainer sx={{ maxHeight: '70vh' }}>
              <Table
                stickyHeader
                size="small"
                sx={{
                  minWidth: 1120,
                  '& .sticky-student': {
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
                  },
                  '& .sticky-student-header': {
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    backgroundColor: 'background.paper',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell className="sticky-student-header" rowSpan={2} sx={{ minWidth: 260 }}>
                      Estudiante
                    </TableCell>
                    {daySlotColumnsByDay.map((day) => (
                      <TableCell key={day.isoDate} align="center" colSpan={day.columns.length}>
                        {day.label}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    {daySlotColumnsByDay.flatMap((day) =>
                      day.columns.map((column) => (
                        <TableCell key={column.key} align="center" sx={{ minWidth: 72 }}>
                          {column.assignment ? column.slotOrder : ''}
                        </TableCell>
                      )),
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const fullName = formatFullName(student.firstName, student.lastName)

                    return (
                      <TableRow key={student.studentId} hover>
                        <TableCell className="sticky-student">
                          <Stack spacing={0.25}>
                            <Typography variant="body2" fontWeight={600}>
                              {fullName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID {student.studentId}
                            </Typography>
                          </Stack>
                        </TableCell>

                        {flatDaySlotColumns.map((column) => {
                          const record = getAttendanceForCell(student.studentId, column)
                          const status = record?.status ?? null
                          const tooltipTitle = column.assignment
                            ? `${column.course?.subjectName ?? 'Clase'} · ${column.course?.teacherName ?? 'Profesor'}`
                            : 'Sin clase asignada'

                          return (
                            <TableCell key={`${student.studentId}:${column.key}`} align="center" sx={{ p: 0.5 }}>
                              <Tooltip title={tooltipTitle} arrow>
                                <Box
                                  sx={{
                                    minHeight: 34,
                                    minWidth: 48,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: column.assignment ? 'divider' : 'action.hover',
                                    backgroundColor: column.assignment ? 'background.paper' : 'action.hover',
                                    ...(status ? statusCellStyles[status] : {}),
                                  }}
                                >
                                  <Typography variant="caption" fontWeight={700}>
                                    {status ?? ''}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {!isLoading && filteredStudents.length > 0 ? (
            <Alert severity="info">
              Celdas vacías significan que no hay asistencia registrada para esa hora. Cada columna se genera con la cantidad de horas definida por el horario del grupo.
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  )
}

export default RegistrarAttendanceView

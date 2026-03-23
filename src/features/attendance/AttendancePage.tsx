import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
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
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attendanceApi, type AttendanceStatus } from '../../api/attendanceApi'
import { coursesApi } from '../../api/coursesApi'
import { useAuth } from '../auth/AuthContext'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import RegistrarAttendanceView from './RegistrarAttendanceView'
import {
  addDays,
  buildCalendarMonth,
  isInstructionalDay,
  parseIsoDate,
  startOfMonth,
  toIsoDate,
} from './colombiaCalendar'

const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const editableRoles = new Set(['admin', 'coordinator', 'teacher'])

const statusLabel: Record<AttendanceStatus, string> = {
  P: 'Presente',
  A: 'Ausente',
  AE: 'Ausencia excusada',
}

const formatFullName = (firstName: string | null, lastName: string | null) =>
  `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Sin nombre'

export const AttendancePage = () => {
  const { user } = useAuth()

  if (user?.role === 'registrar') {
    return <RegistrarAttendanceView />
  }

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const queryClient = useQueryClient()
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(toIsoDate(today))
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today))
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | ''>('')
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('')
  const [groupSearch, setGroupSearch] = useState('')
  const [draftStatuses, setDraftStatuses] = useState<Record<number, AttendanceStatus | ''>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const canEditAttendance = editableRoles.has(user?.role ?? '')

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
    queryKey: ['attendance-courses', selectedSchoolYearId, user?.nationalId, user?.role],
    queryFn: () => {
      if (selectedSchoolYearId === '') {
        return Promise.resolve([])
      }

      return coursesApi.list({
        schoolYearId: Number(selectedSchoolYearId),
        teacherId: user?.role === 'teacher' ? user.nationalId : undefined,
      })
    },
    enabled: selectedSchoolYearId !== '',
  })

  const sortedCourses = useMemo(() => {
    return (courses ?? []).slice().sort((left, right) => {
      if (left.gradeLevel !== right.gradeLevel) {
        return left.gradeLevel - right.gradeLevel
      }
      const sectionCompare = left.section.localeCompare(right.section, 'es')
      if (sectionCompare !== 0) {
        return sectionCompare
      }
      return left.subjectName.localeCompare(right.subjectName, 'es')
    })
  }, [courses])

  useEffect(() => {
    if (selectedCourseId !== '' && sortedCourses.some((course) => course.courseId === selectedCourseId)) {
      return
    }
    setSelectedCourseId(sortedCourses[0]?.courseId ?? '')
  }, [selectedCourseId, sortedCourses])

  useEffect(() => {
    setGroupSearch('')
  }, [selectedCourseId])

  const selectedCourse = useMemo(
    () => sortedCourses.find((course) => course.courseId === selectedCourseId) ?? null,
    [selectedCourseId, sortedCourses],
  )

  const {
    data: roster,
    isLoading: isLoadingRoster,
    isError: isRosterError,
    error: rosterError,
  } = useQuery({
    queryKey: ['attendance-roster', selectedCourse?.classGroupId, selectedDate],
    queryFn: () => {
      if (!selectedCourse) {
        return Promise.resolve(null)
      }
      return attendanceApi.sheet({
        classGroupId: selectedCourse.classGroupId,
        date: selectedDate,
      })
    },
    enabled: Boolean(selectedCourse),
  })

  const {
    data: attendanceResult,
    isLoading: isLoadingAttendance,
    isError: isAttendanceError,
    error: attendanceError,
  } = useQuery({
    queryKey: ['attendance-records', selectedCourseId, selectedDate, user?.role],
    queryFn: () => {
      if (!selectedCourse) {
        return Promise.resolve({ data: [], total: 0, page: 1, pageSize: 500 })
      }
      return attendanceApi.list({
        courseId: selectedCourse.courseId,
        from: selectedDate,
        to: selectedDate,
        page: 1,
        pageSize: 500,
        scope: user?.role === 'teacher' ? 'own' : undefined,
      })
    },
    enabled: Boolean(selectedCourse),
  })

  const recordsByStudentId = useMemo(() => {
    const map = new Map<number, { attendanceId: number; status: AttendanceStatus }>()
    ;(attendanceResult?.data ?? []).forEach((record) => {
      map.set(record.studentId, {
        attendanceId: record.attendanceId,
        status: record.status,
      })
    })
    return map
  }, [attendanceResult?.data])

  useEffect(() => {
    const nextDrafts: Record<number, AttendanceStatus | ''> = {}
    ;(roster?.students ?? []).forEach((student) => {
      nextDrafts[student.studentId] = recordsByStudentId.get(student.studentId)?.status ?? 'P'
    })
    setDraftStatuses(nextDrafts)
    setSaveError(null)
    setSaveSuccess(null)
  }, [recordsByStudentId, roster?.date, roster?.students, selectedCourseId])

  const attendanceSummary = useMemo(() => {
    const summary = { P: 0, A: 0, AE: 0 }
    Object.values(draftStatuses).forEach((status) => {
      if (status === 'P' || status === 'A' || status === 'AE') {
        summary[status] += 1
      }
    })
    return summary
  }, [draftStatuses])

  const filteredStudents = useMemo(() => {
    const normalizedQuery = groupSearch.trim().toLocaleLowerCase('es')
    if (!normalizedQuery) {
      return roster?.students ?? []
    }

    return (roster?.students ?? []).filter((student) => {
      const fullName = formatFullName(student.firstName, student.lastName).toLocaleLowerCase('es')
      return (
        fullName.includes(normalizedQuery) ||
        String(student.studentId).includes(normalizedQuery)
      )
    })
  }, [groupSearch, roster?.students])

  const calendarMonth = useMemo(() => buildCalendarMonth(visibleMonth), [visibleMonth])
  const selectedDay = useMemo(
    () => calendarMonth.weeks.flat().find((day) => day.isoDate === selectedDate) ?? null,
    [calendarMonth.weeks, selectedDate],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourse || !roster) {
        return
      }

      const tasks = roster.students.flatMap((student) => {
        const draftStatus = draftStatuses[student.studentId] ?? ''
        const existing = recordsByStudentId.get(student.studentId)

        if (!draftStatus) {
          return []
        }

        if (existing) {
          if (existing.status === draftStatus) {
            return []
          }
          return [attendanceApi.update(existing.attendanceId, { status: draftStatus })]
        }

        return [
          attendanceApi.create({
            studentId: student.studentId,
            courseId: selectedCourse.courseId,
            date: selectedDate,
            status: draftStatus,
          }),
        ]
      })

      await Promise.all(tasks)
    },
    onSuccess: async () => {
      setSaveSuccess('Asistencia guardada correctamente.')
      setSaveError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance-records'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-roster'] }),
      ])
    },
    onError: (error: Error) => {
      setSaveSuccess(null)
      setSaveError(error.message || 'No se pudo guardar la asistencia.')
    },
  })

  const nonInstructionalDay = !isInstructionalDay(selectedDate)

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Typography variant="h4">Asistencia y calendario</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" disabled>
          Importar calendario
        </Button>
      </Stack>

      <Alert severity="info">
        El calendario marca fines de semana y festivos oficiales de Colombia. La importación de horarios de profesores queda como TODO para la siguiente fase.
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(360px, 420px) 1fr' },
          gap: 2,
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button onClick={() => setVisibleMonth(addDays(startOfMonth(visibleMonth), -1))}>
                Mes anterior
              </Button>
              <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                {calendarMonth.label}
              </Typography>
              <Button onClick={() => setVisibleMonth(addDays(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1), 0))}>
                Mes siguiente
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip size="small" label="Clase" />
              <Chip size="small" label="Fin de semana" color="default" variant="outlined" />
              <Chip size="small" label="Festivo Colombia" color="warning" variant="outlined" />
              <Chip size="small" label="Seleccionado" color="primary" />
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 1 } }}>
              {weekdayLabels.map((label) => (
                <Typography key={label} variant="caption" color="text.secondary" textAlign="center">
                  {label}
                </Typography>
              ))}
              {calendarMonth.weeks.flat().map((day) => {
                const isSelected = day.isoDate === selectedDate
                const isWeekendDisabled = day.isWeekend
                return (
                  <Button
                    key={day.key}
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={day.holidayName ? 'warning' : isSelected ? 'primary' : 'inherit'}
                    onClick={() => {
                      if (isWeekendDisabled) {
                        return
                      }
                      setSelectedDate(day.isoDate)
                      setVisibleMonth(startOfMonth(parseIsoDate(day.isoDate)))
                    }}
                    disabled={isWeekendDisabled}
                    sx={{
                      minWidth: 0,
                      px: { xs: 0.25, sm: 0.5 },
                      py: { xs: 0.75, sm: 1 },
                      minHeight: { xs: 54, sm: 64 },
                      opacity: day.isCurrentMonth ? 1 : 0.45,
                      borderColor: day.isWeekend ? 'divider' : undefined,
                    }}
                  >
                    <Stack spacing={0.25} alignItems="center">
                      <Typography variant="body2">{day.dayNumber}</Typography>
                      {day.holidayName ? (
                        <Typography variant="caption" align="center">
                          FE
                        </Typography>
                      ) : null}
                    </Stack>
                  </Button>
                )
              })}
            </Box>

            <Box>
              <Typography variant="subtitle2">Fecha seleccionada</Typography>
              <Typography variant="body1">{selectedDate}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedDay?.holidayName
                  ? selectedDay.holidayName
                  : selectedDay?.isWeekend
                    ? 'Fin de semana'
                    : 'Día lectivo'}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="attendance-year-label">Año escolar</InputLabel>
                <Select
                  labelId="attendance-year-label"
                  label="Año escolar"
                  value={selectedSchoolYearId}
                  onChange={(event) => {
                    const value = event.target.value as string | number
                    setSelectedSchoolYearId(value === '' ? '' : Number(value))
                    setSelectedCourseId('')
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
                <InputLabel id="attendance-course-label">Curso</InputLabel>
                <Select
                  labelId="attendance-course-label"
                  label="Curso"
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(Number(event.target.value))}
                  disabled={isLoadingCourses || sortedCourses.length === 0}
                >
                  {sortedCourses.map((course) => (
                    <MenuItem key={course.courseId} value={course.courseId}>
                      {`Grado ${course.gradeLevel} · ${course.section} · ${course.subjectName}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                type="date"
                label="Fecha"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value)
                  setVisibleMonth(startOfMonth(parseIsoDate(event.target.value)))
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>

            {isCoursesError ? (
              <Alert severity="error">
                {coursesError instanceof Error ? coursesError.message : 'No se pudieron cargar los cursos.'}
              </Alert>
            ) : null}

            {!canEditAttendance ? (
              <Alert severity="info">
                Tu rol solo puede consultar la asistencia y el calendario.
              </Alert>
            ) : null}

            {nonInstructionalDay ? (
              <Alert severity="warning">
                La fecha seleccionada corresponde a un fin de semana o festivo colombiano. La edición de asistencia queda bloqueada para evitar registros en días no lectivos.
              </Alert>
            ) : null}

            {saveError ? <Alert severity="error">{saveError}</Alert> : null}
            {saveSuccess ? <Alert severity="success">{saveSuccess}</Alert> : null}

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`Presentes: ${attendanceSummary.P}`} color="success" variant="outlined" />
              <Chip label={`Ausentes: ${attendanceSummary.A}`} color="error" variant="outlined" />
              <Chip label={`Excusadas: ${attendanceSummary.AE}`} color="warning" variant="outlined" />
            </Stack>

            {selectedCourse ? (
              <Typography variant="body2" color="text.secondary">
                {`Curso seleccionado: ${selectedCourse.subjectName} · Grado ${selectedCourse.gradeLevel} · Grupo ${selectedCourse.section}`}
              </Typography>
            ) : (
              <Alert severity="info">Selecciona un curso para ver y registrar asistencia.</Alert>
            )}

            <TextField
              label="Buscar estudiante del grupo"
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
              placeholder="Nombre o ID"
              fullWidth
              disabled={!roster?.students.length}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                onClick={() => saveMutation.mutate()}
                disabled={
                  !canEditAttendance ||
                  nonInstructionalDay ||
                  !selectedCourse ||
                  !roster?.students.length ||
                  saveMutation.isPending
                }
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar asistencia'}
              </Button>
            </Stack>

            {isLoadingRoster || isLoadingAttendance ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : null}

            {isRosterError ? (
              <Alert severity="error">
                {rosterError instanceof Error ? rosterError.message : 'No se pudo cargar el listado del grupo.'}
              </Alert>
            ) : null}

            {isAttendanceError ? (
              <Alert severity="error">
                {attendanceError instanceof Error ? attendanceError.message : 'No se pudo cargar la asistencia.'}
              </Alert>
            ) : null}

            {filteredStudents.length ? (
              isMobile ? (
                <Stack spacing={1.25}>
                  {filteredStudents.map((student) => {
                    const value = draftStatuses[student.studentId] ?? ''
                    const currentRecord = recordsByStudentId.get(student.studentId)
                    return (
                      <Paper key={student.studentId} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={1}>
                          <Box>
                            <Typography fontWeight={600}>
                              {formatFullName(student.firstName, student.lastName)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              ID {student.studentId}
                            </Typography>
                          </Box>
                          {canEditAttendance ? (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={value}
                                onChange={(event) =>
                                  setDraftStatuses((previous) => ({
                                    ...previous,
                                    [student.studentId]: event.target.value as AttendanceStatus | '',
                                  }))
                                }
                                disabled={nonInstructionalDay}
                              >
                                <MenuItem value="">Sin marcar</MenuItem>
                                <MenuItem value="P">Presente</MenuItem>
                                <MenuItem value="A">Ausente</MenuItem>
                                <MenuItem value="AE">Ausencia excusada</MenuItem>
                              </Select>
                            </FormControl>
                          ) : value ? (
                            <Chip
                              label={statusLabel[value]}
                              color={value === 'P' ? 'success' : value === 'A' ? 'error' : 'warning'}
                              sx={{ alignSelf: 'flex-start' }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Sin marcar
                            </Typography>
                          )}
                          {currentRecord ? (
                            <Typography variant="caption" color="text.secondary">
                              Registro existente
                            </Typography>
                          ) : null}
                        </Stack>
                      </Paper>
                    )
                  })}
                </Stack>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Estudiante</TableCell>
                        <TableCell align="center">Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredStudents.map((student) => {
                        const value = draftStatuses[student.studentId] ?? ''
                        const currentRecord = recordsByStudentId.get(student.studentId)
                        return (
                          <TableRow key={student.studentId}>
                            <TableCell>
                              <Stack spacing={0.25}>
                                <Typography variant="body2">
                                  {formatFullName(student.firstName, student.lastName)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID {student.studentId}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell align="center">
                              {canEditAttendance ? (
                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                  <Select
                                    value={value}
                                    onChange={(event) =>
                                      setDraftStatuses((previous) => ({
                                        ...previous,
                                        [student.studentId]: event.target.value as AttendanceStatus | '',
                                      }))
                                    }
                                    disabled={nonInstructionalDay}
                                  >
                                    <MenuItem value="">Sin marcar</MenuItem>
                                    <MenuItem value="P">Presente</MenuItem>
                                    <MenuItem value="A">Ausente</MenuItem>
                                    <MenuItem value="AE">Ausencia excusada</MenuItem>
                                  </Select>
                                </FormControl>
                              ) : value ? (
                                <Chip label={statusLabel[value]} color={value === 'P' ? 'success' : value === 'A' ? 'error' : 'warning'} />
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Sin marcar
                                </Typography>
                              )}
                              {currentRecord ? (
                                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                  Registro existente
                                </Typography>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            ) : null}

            {roster?.students?.length && filteredStudents.length === 0 ? (
              <Alert severity="info">
                No hay estudiantes del grupo que coincidan con la búsqueda.
              </Alert>
            ) : null}

            {selectedCourse && !isLoadingRoster && !roster?.students?.length ? (
              <Alert severity="info">
                No hay estudiantes activos en el grupo de este curso para la fecha seleccionada.
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}

export default AttendancePage

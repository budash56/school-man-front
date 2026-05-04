import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import {
  Alert,
  alpha,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  schoolYearsApi,
  type CompleteSchoolYearResult,
} from '../../api/schoolYearsApi'
import { classGroupsApi } from '../../api/classGroupsApi'
import { coursesApi } from '../../api/coursesApi'
import { dashboardsApi } from '../../api/dashboardsApi'
import { useAuth } from '../auth/AuthContext'
import { startOfMonth, toIsoDate } from '../attendance/colombiaCalendar'
import { AcademicCalendarBoard } from '../calendar/AcademicCalendarBoard'
import {
  formatDateRange,
  getPeriodColor,
  isItemOnDate,
} from '../calendar/academicCalendar'
import { useAcademicCalendarData } from '../calendar/useAcademicCalendarData'

const monthTitleFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
})

const percentFormatter = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
})

const MetricTile = ({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) => (
  <Paper
    variant="outlined"
    sx={(theme) => ({
      p: 1.5,
      borderRadius: 3,
      backgroundColor: alpha(theme.palette.background.paper, 0.72),
    })}
  >
    <Stack spacing={0.4}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {helper}
      </Typography>
    </Stack>
  </Paper>
)

export const DashboardHomePage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const displayName = user?.firstName || user?.username || 'usuario'
  const todayIso = useMemo(() => toIsoDate(new Date()), [])
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [metricsGrade, setMetricsGrade] = useState('')
  const [metricsClassGroupId, setMetricsClassGroupId] = useState('')
  const [metricsCourseId, setMetricsCourseId] = useState('')
  const [completionResult, setCompletionResult] =
    useState<CompleteSchoolYearResult | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const { data: activeYears, isLoading: isLoadingYear } = useQuery({
    queryKey: ['school-years', { active: true }],
    queryFn: () => schoolYearsApi.list({ active: true }),
    staleTime: 5 * 60_000,
  })

  const activeYear = activeYears?.[0] ?? null
  const canOpenCalendarPage = user?.role !== 'teacher'
  const isTeacher = user?.role === 'teacher'
  const canSeeMetrics = user?.role === 'admin' || user?.role === 'teacher'

  const { data: classGroupsResult } = useQuery({
    queryKey: ['dashboard-class-groups', activeYear?.schoolYearId],
    queryFn: () =>
      classGroupsApi.list({
        schoolYearId: activeYear?.schoolYearId,
        page: 1,
        pageSize: 200,
      }),
    enabled: canSeeMetrics && Boolean(activeYear?.schoolYearId),
    staleTime: 5 * 60_000,
  })

  const { data: courses } = useQuery({
    queryKey: ['dashboard-courses', activeYear?.schoolYearId, user?.nationalId, user?.role],
    queryFn: () =>
      coursesApi.list({
        schoolYearId: activeYear?.schoolYearId,
        teacherId: isTeacher ? user?.nationalId : undefined,
      }),
    enabled: canSeeMetrics && Boolean(activeYear?.schoolYearId),
    staleTime: 5 * 60_000,
  })

  const classGroups = classGroupsResult?.data ?? []
  const visibleClassGroups = useMemo(() => {
    if (!isTeacher) {
      return classGroups
    }
    const allowedIds = new Set((courses ?? []).map((course) => course.classGroupId))
    return classGroups.filter((group) => allowedIds.has(group.classGroupId))
  }, [classGroups, courses, isTeacher])
  const grades = useMemo(
    () => [...new Set(visibleClassGroups.map((group) => group.gradeLevel))].sort((a, b) => a - b),
    [visibleClassGroups],
  )

  const filteredClassGroups = useMemo(() => {
    const grade = metricsGrade ? Number(metricsGrade) : null
    return grade ? visibleClassGroups.filter((group) => group.gradeLevel === grade) : visibleClassGroups
  }, [metricsGrade, visibleClassGroups])

  const filteredCourses = useMemo(() => {
    const grade = metricsGrade ? Number(metricsGrade) : null
    const classGroupId = metricsClassGroupId ? Number(metricsClassGroupId) : null
    return (courses ?? []).filter((course) => {
      if (grade && course.gradeLevel !== grade) {
        return false
      }
      if (classGroupId && course.classGroupId !== classGroupId) {
        return false
      }
      return true
    })
  }, [courses, metricsClassGroupId, metricsGrade])

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: [
      'dashboard-metrics',
      activeYear?.schoolYearId,
      user?.role,
      metricsGrade,
      metricsClassGroupId,
      metricsCourseId,
    ],
    queryFn: () =>
      dashboardsApi.metrics({
        schoolYearId: activeYear?.schoolYearId,
        gradeLevel: metricsGrade ? Number(metricsGrade) : undefined,
        classGroupId: metricsClassGroupId ? Number(metricsClassGroupId) : undefined,
        courseId: metricsCourseId ? Number(metricsCourseId) : undefined,
      }),
    enabled: canSeeMetrics && Boolean(activeYear?.schoolYearId),
  })

  const { items: calendarItems } = useAcademicCalendarData({
    schoolYear: activeYear,
    user,
    enabled: Boolean(activeYear?.schoolYearId && user?.nationalId),
  })

  const periodItems = useMemo(
    () =>
      calendarItems
        .filter((item) => item.category === 'term')
        .sort((left, right) => left.startDate.localeCompare(right.startDate)),
    [calendarItems],
  )

  const activePeriod = useMemo(
    () => periodItems.find((item) => isItemOnDate(item, todayIso)) ?? null,
    [periodItems, todayIso],
  )

  const previewItems = useMemo(
    () =>
      calendarItems
        .filter((item) => item.endDate >= todayIso)
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
        .slice(0, 3),
    [calendarItems, todayIso],
  )

  const completeMutation = useMutation({
    mutationFn: (payload: { schoolYearId: number; force: boolean }) =>
      schoolYearsApi.complete(payload.schoolYearId, { force: payload.force }),
    onSuccess: (result) => {
      setCompletionResult(result)
      setCompletionError(null)
      queryClient.invalidateQueries({ queryKey: ['school-years'] })
    },
    onError: (error) => {
      setCompletionError(
        error instanceof Error
          ? error.message
          : 'No se pudo cerrar el año escolar.',
      )
    },
  })

  const handleCompleteYear = () => {
    if (!activeYear) {
      return
    }
    const confirmed = window.confirm(
      `¿Seguro que deseas finalizar el año escolar ${activeYear.name}?`,
    )
    if (!confirmed) {
      return
    }
    completeMutation.mutate({
      schoolYearId: activeYear.schoolYearId,
      force: true,
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Hola, {displayName}</Typography>
        <Typography color="text.secondary">
          {activeYear
            ? `Resumen del calendario de ${activeYear.name}`
            : isLoadingYear
              ? 'Cargando calendario activo...'
              : 'No hay año escolar activo'}
        </Typography>
      </Stack>

      {!activeYear ? (
        <Alert severity="info">
          Activa un año escolar para mostrar el calendario del dashboard.
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <Box
            component="button"
            type="button"
            onClick={() => setCalendarOpen(true)}
            sx={(theme) => ({
              width: { xs: '100%', sm: 320 },
              minHeight: 320,
              p: 2.25,
              borderRadius: 4,
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(
                theme.palette.background.paper,
                0.96,
              )} 58%)`,
              color: theme.palette.text.primary,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'transform 140ms ease, border-color 140ms ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: alpha(theme.palette.primary.main, 0.55),
              },
            })}
          >
            <Stack justifyContent="space-between" sx={{ height: '100%' }}>
              <Stack spacing={1.25}>
                <Stack spacing={0.4}>
                  <Typography variant="overline" color="text.secondary">
                    Calendario
                  </Typography>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                    {monthTitleFormatter.format(visibleMonth)}
                  </Typography>
                </Stack>

                {activePeriod ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: getPeriodColor(activePeriod.kind),
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Periodo activo: {activePeriod.kind.replace('P', '')}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No hay periodo activo hoy.
                  </Typography>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">
                    Próximos eventos
                  </Typography>
                  {previewItems.length === 0 ? (
                    <Typography color="text.secondary">
                      No hay eventos próximos.
                    </Typography>
                  ) : (
                    previewItems.map((item) => (
                      <Stack key={item.id} spacing={0.2}>
                        <Typography variant="subtitle2" noWrap>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateRange(item.startDate, item.endDate)}
                        </Typography>
                      </Stack>
                    ))
                  )}
                </Stack>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Selecciona para abrir el calendario
              </Typography>
            </Stack>
          </Box>

          {canSeeMetrics ? (
            <Paper
              variant="outlined"
              sx={(theme) => ({
                flex: '1 1 520px',
                minWidth: { xs: '100%', md: 520 },
                p: 2.25,
                borderRadius: 4,
                borderColor: alpha(theme.palette.divider, 0.8),
                background: `linear-gradient(165deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(
                  theme.palette.background.paper,
                  0.98,
                )} 54%)`,
              })}
            >
              <Stack spacing={2}>
                <Stack spacing={0.4}>
                  <Typography variant="overline" color="text.secondary">
                    Métricas
                  </Typography>
                  <Typography variant="h6">
                    {isTeacher ? 'Mis cursos' : 'Seguimiento académico'}
                  </Typography>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="dashboard-grade-filter">Grado</InputLabel>
                    <Select
                      labelId="dashboard-grade-filter"
                      label="Grado"
                      value={metricsGrade}
                      onChange={(event) => {
                        setMetricsGrade(event.target.value)
                        setMetricsClassGroupId('')
                        setMetricsCourseId('')
                      }}
                    >
                      <MenuItem value="">Todos</MenuItem>
                      {grades.map((grade) => (
                        <MenuItem key={grade} value={String(grade)}>
                          Grado {grade}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="dashboard-group-filter">Grupo</InputLabel>
                    <Select
                      labelId="dashboard-group-filter"
                      label="Grupo"
                      value={metricsClassGroupId}
                      onChange={(event) => {
                        setMetricsClassGroupId(event.target.value)
                        setMetricsCourseId('')
                      }}
                    >
                      <MenuItem value="">Todos</MenuItem>
                      {filteredClassGroups.map((group) => (
                        <MenuItem key={group.classGroupId} value={String(group.classGroupId)}>
                          {group.gradeLevel}{group.section}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                    <InputLabel id="dashboard-course-filter">Curso</InputLabel>
                    <Select
                      labelId="dashboard-course-filter"
                      label="Curso"
                      value={metricsCourseId}
                      onChange={(event) => setMetricsCourseId(event.target.value)}
                    >
                      <MenuItem value="">Todos</MenuItem>
                      {filteredCourses.map((course) => (
                        <MenuItem key={course.courseId} value={String(course.courseId)}>
                          {course.subjectName} · {course.gradeLevel}{course.section}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  <MetricTile
                    label="Asistencia"
                    value={metrics ? percentFormatter.format(1 - metrics.attendance.absenceRate) : '...'}
                    helper={`${metrics?.attendance.present ?? 0}/${metrics?.attendance.total ?? 0} presentes`}
                  />
                  <MetricTile
                    label="Ausencia"
                    value={metrics ? percentFormatter.format(metrics.attendance.absenceRate) : '...'}
                    helper={`${(metrics?.attendance.absent ?? 0) + (metrics?.attendance.excused ?? 0)} registros`}
                  />
                  <MetricTile
                    label="Promedio"
                    value={metrics ? decimalFormatter.format(metrics.academic.average) : '...'}
                    helper={`${metrics?.academic.low ?? 0} en bajo`}
                  />
                </Box>

                {isLoadingMetrics ? (
                  <Typography variant="body2" color="text.secondary">
                    Cargando métricas...
                  </Typography>
                ) : metrics?.academic.total === 0 && metrics?.attendance.total === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No hay registros para los filtros seleccionados.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      Rendimiento por curso
                    </Typography>
                    {(metrics?.academic.byCourse ?? []).slice(0, 4).map((course) => (
                      <Stack key={course.courseId} direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" noWrap>
                          {course.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {decimalFormatter.format(course.average)} · {percentFormatter.format(course.lowRate)} bajo
                        </Typography>
                      </Stack>
                    ))}
                    {isTeacher && (metrics?.academic.bySubject.length ?? 0) > 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        Global: {metrics?.academic.bySubject.map((item) => `${item.label} ${decimalFormatter.format(item.average)}`).join(' · ')}
                      </Typography>
                    ) : null}
                    {!isTeacher && (metrics?.academic.byTeacher.length ?? 0) > 0 ? (
                      <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                        <Typography variant="overline" color="text.secondary">
                          Rendimiento por profesor
                        </Typography>
                        {(metrics?.academic.byTeacher ?? []).slice(0, 4).map((teacher) => (
                          <Stack key={teacher.teacherId} direction="row" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2" noWrap>
                              {teacher.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {decimalFormatter.format(teacher.average)} · {percentFormatter.format(teacher.lowRate)} bajo
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                )}
              </Stack>
            </Paper>
          ) : null}
        </Box>
      )}

      <Dialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        fullWidth
        maxWidth="xl"
        PaperProps={{
          sx: {
            borderRadius: 4,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack spacing={0.5}>
              <Typography variant="overline" color="text.secondary">
                Calendario
              </Typography>
              <Typography variant="h5" sx={{ textTransform: 'capitalize' }}>
                {monthTitleFormatter.format(visibleMonth)}
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent={{ xs: 'space-between', sm: 'flex-end' }}
            >
              {canOpenCalendarPage ? (
                <Button
                  variant="text"
                  startIcon={<EventRoundedIcon />}
                  onClick={() => {
                    setCalendarOpen(false)
                    navigate('/dashboard/calendar')
                  }}
                >
                  Ver calendario completo
                </Button>
              ) : null}
              <IconButton onClick={() => setCalendarOpen(false)}>
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: 0 }}>
          <AcademicCalendarBoard
            items={calendarItems}
            visibleMonth={visibleMonth}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPreviousMonth={() =>
              setVisibleMonth(
                new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
              )
            }
            onNextMonth={() =>
              setVisibleMonth(
                new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
              )
            }
            selectedDateEmptyText="No hay eventos cargados para la fecha seleccionada."
          />
        </DialogContent>
      </Dialog>

      {user?.role === 'admin' ? (
        <Paper sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Cierre de año escolar</Typography>
            <Typography color="text.secondary">
              Año activo:{' '}
              {activeYear
                ? activeYear.name
                : isLoadingYear
                  ? 'Cargando…'
                  : 'No hay año activo'}
            </Typography>
            <Button
              variant="contained"
              onClick={handleCompleteYear}
              disabled={!activeYear || completeMutation.isPending}
            >
              Finalizar año escolar
            </Button>
            {completionError ? <Alert severity="error">{completionError}</Alert> : null}
            {completionResult ? (
              <Alert severity="success">
                Año cerrado. Promovidos: {completionResult.studentsPromoted}. Graduados:{' '}
                {completionResult.studentsGraduated}.
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      ) : null}
    </Box>
  )
}

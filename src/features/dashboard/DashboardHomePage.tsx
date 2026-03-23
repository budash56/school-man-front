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
  IconButton,
  Paper,
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

export const DashboardHomePage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const displayName = user?.firstName || user?.username || 'usuario'
  const todayIso = useMemo(() => toIsoDate(new Date()), [])
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [calendarOpen, setCalendarOpen] = useState(false)
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                Click para abrir el calendario
              </Typography>
            </Stack>
          </Box>
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

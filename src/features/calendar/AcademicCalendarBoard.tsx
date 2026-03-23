import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import {
  alpha,
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useMemo } from 'react'
import {
  buildCalendarMonth,
  type CalendarDay,
  toIsoDate,
} from '../attendance/colombiaCalendar'
import {
  formatDateRange,
  getCalendarItemColor,
  getCalendarItemLabel,
  getImportantAcademicItems,
  getPeriodColor,
  getUpcomingAcademicItems,
  isItemOnDate,
  type AcademicCalendarItem,
} from './academicCalendar'

const monthTitleFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
})

const fullDateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

type AcademicCalendarBoardProps = {
  items: AcademicCalendarItem[]
  visibleMonth: Date
  selectedDate: string
  onSelectDate: (isoDate: string) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  isDateDisabled?: (day: CalendarDay) => boolean
  selectedDateEmptyText?: string
}

export const AcademicCalendarBoard = ({
  items,
  visibleMonth,
  selectedDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  isDateDisabled,
  selectedDateEmptyText = 'No hay eventos activos para este día.',
}: AcademicCalendarBoardProps) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), [])
  const calendarMonth = useMemo(() => buildCalendarMonth(visibleMonth), [visibleMonth])

  const periodItems = useMemo(
    () =>
      items
        .filter((item) => item.category === 'term')
        .sort((left, right) => left.startDate.localeCompare(right.startDate)),
    [items],
  )

  const getPeriodForDate = (isoDate: string) =>
    periodItems.find((item) => isItemOnDate(item, isoDate)) ?? null

  const selectedDayItems = useMemo(
    () => items.filter((item) => isItemOnDate(item, selectedDate)),
    [items, selectedDate],
  )

  const importantItems = useMemo(
    () => getImportantAcademicItems(items, todayIso),
    [items, todayIso],
  )

  const upcomingItems = useMemo(
    () => getUpcomingAcademicItems(items, todayIso),
    [items, todayIso],
  )

  const nextEvent = upcomingItems[0] ?? null

  const selectedDateLabel = useMemo(() => {
    const selected = new Date(`${selectedDate}T00:00:00`)
    if (Number.isNaN(selected.getTime())) {
      return selectedDate
    }
    return fullDateFormatter.format(selected)
  }, [selectedDate])

  const dayEventCount = useMemo(() => {
    const counts = new Map<string, number>()
    calendarMonth.weeks.flat().forEach((day) => {
      counts.set(
        day.isoDate,
        items.filter(
          (item) => item.category !== 'term' && isItemOnDate(item, day.isoDate),
        ).length,
      )
    })
    return counts
  }, [calendarMonth.weeks, items])

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {periodItems.map((item) => (
          <Stack
            key={item.id}
            direction="row"
            spacing={0.75}
            alignItems="center"
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: getPeriodColor(item.kind),
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {item.title}
            </Typography>
          </Stack>
        ))}
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: `2px solid ${theme.palette.success.main}`,
              backgroundColor: alpha(theme.palette.success.main, 0.18),
            })}
          />
          <Typography variant="caption" color="text.secondary">
            Hoy
          </Typography>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        El color suave indica el periodo activo de cada fecha. Los fines de semana van en gris, los festivos usan el tono de calendario de asistencia y el punto azul marca días con eventos adicionales.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: 'minmax(0, 1.45fr) minmax(320px, 0.95fr)',
          },
          gap: 2,
        }}
      >
        <Paper
          variant="outlined"
          sx={(theme) => ({
            p: 2,
            borderRadius: 3,
            backgroundColor: alpha(theme.palette.background.paper, 0.98),
          })}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography
                variant="subtitle1"
                sx={{ textTransform: 'capitalize' }}
              >
                {monthTitleFormatter.format(visibleMonth)}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  aria-label="Mes anterior"
                  onClick={onPreviousMonth}
                >
                  <ChevronLeftRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Mes siguiente"
                  onClick={onNextMonth}
                >
                  <ChevronRightRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 0.75,
              }}
            >
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
                <Typography
                  key={label}
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 0.5, textTransform: 'uppercase' }}
                >
                  {label}
                </Typography>
              ))}

              {calendarMonth.weeks.flat().map((day) => {
                const isSelected = selectedDate === day.isoDate
                const isToday = todayIso === day.isoDate
                const period = getPeriodForDate(day.isoDate)
                const eventCount = dayEventCount.get(day.isoDate) ?? 0
                const disabled = isDateDisabled?.(day) ?? false

                return (
                  <Box
                    key={day.key}
                    component="button"
                    type="button"
                    onClick={() => {
                      if (disabled) {
                        return
                      }
                      onSelectDate(day.isoDate)
                    }}
                    sx={(theme) => ({
                      minHeight: 62,
                      p: 0.75,
                      borderRadius: 2.5,
                      border: `1px solid ${
                        isSelected
                          ? alpha(theme.palette.primary.main, 0.7)
                          : day.holidayName
                            ? alpha(theme.palette.warning.main, 0.5)
                            : isToday
                              ? alpha(theme.palette.success.main, 0.7)
                              : day.isWeekend
                                ? alpha(theme.palette.divider, 0.9)
                                : alpha(theme.palette.divider, 0.65)
                      }`,
                      backgroundColor: (() => {
                        if (isSelected) {
                          if (day.holidayName) {
                            return alpha(theme.palette.warning.main, 0.22)
                          }
                          if (day.isWeekend) {
                            return alpha(theme.palette.action.disabledBackground, 0.78)
                          }
                          if (period) {
                            return alpha(getPeriodColor(period.kind), 0.24)
                          }
                          if (isToday) {
                            return alpha(theme.palette.success.main, 0.18)
                          }
                          return alpha(theme.palette.primary.main, 0.14)
                        }

                        if (day.holidayName) {
                          return alpha(theme.palette.warning.main, 0.18)
                        }

                        if (day.isWeekend) {
                          return alpha(theme.palette.action.disabledBackground, 0.52)
                        }

                        if (isToday) {
                          return alpha(theme.palette.success.main, 0.12)
                        }

                        if (period) {
                          return alpha(getPeriodColor(period.kind), 0.18)
                        }

                        return day.isCurrentMonth
                          ? alpha(theme.palette.background.paper, 0.96)
                          : alpha(theme.palette.action.disabledBackground, 0.28)
                      })(),
                      color: theme.palette.text.primary,
                      textAlign: 'left',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: day.isCurrentMonth ? (disabled ? 0.72 : 1) : 0.45,
                      '&:hover': disabled
                        ? undefined
                        : {
                            borderColor: alpha(theme.palette.primary.main, 0.65),
                          },
                    })}
                  >
                    <Stack justifyContent="space-between" sx={{ height: '100%' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isSelected || isToday ? 700 : 600,
                        }}
                      >
                        {day.dayNumber}
                      </Typography>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        {period ? (
                          <Box
                            sx={{
                              width: 18,
                              height: 4,
                              borderRadius: 999,
                              backgroundColor: alpha(
                                getPeriodColor(period.kind),
                                day.isWeekend || day.holidayName ? 0.45 : 0.9,
                              ),
                            }}
                          />
                        ) : (
                          <Box />
                        )}
                        {eventCount > 0 ? (
                          <Box
                            sx={(theme) => ({
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: theme.palette.primary.main,
                            })}
                          />
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>
                )
              })}
            </Box>
          </Stack>
        </Paper>

        <Paper
          variant="outlined"
          sx={(theme) => ({
            p: 2,
            borderRadius: 3,
            backgroundColor: alpha(theme.palette.background.paper, 0.98),
          })}
        >
          <Stack spacing={2}>
            <Stack spacing={0.75}>
              <Typography variant="overline" color="text.secondary">
                Siguiente evento
              </Typography>
              {nextEvent ? (
                <Stack spacing={0.75}>
                  <Chip
                    size="small"
                    color={getCalendarItemColor(nextEvent.category)}
                    label={getCalendarItemLabel(nextEvent)}
                    sx={{ alignSelf: 'flex-start' }}
                  />
                  <Typography variant="h6">{nextEvent.title}</Typography>
                  <Typography color="text.secondary">
                    {formatDateRange(nextEvent.startDate, nextEvent.endDate)}
                  </Typography>
                </Stack>
              ) : (
                <Typography color="text.secondary">
                  No hay eventos próximos para mostrar.
                </Typography>
              )}
            </Stack>

            <Divider />

            <Stack spacing={1.1}>
              <Typography variant="overline" color="text.secondary">
                Fechas importantes
              </Typography>
              {importantItems.length === 0 ? (
                <Typography color="text.secondary">
                  No hay fechas importantes configuradas todavía.
                </Typography>
              ) : (
                importantItems.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateRange(item.startDate, item.endDate)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={getCalendarItemColor(item.category)}
                      label={getCalendarItemLabel(item)}
                    />
                  </Stack>
                ))
              )}
            </Stack>

            <Divider />

            <Stack spacing={1.1}>
              <Typography variant="overline" color="text.secondary">
                {selectedDateLabel}
              </Typography>
              {selectedDayItems.length === 0 ? (
                <Typography color="text.secondary">
                  {selectedDateEmptyText}
                </Typography>
              ) : (
                selectedDayItems.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={0.75}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Chip
                          size="small"
                          color={getCalendarItemColor(item.category)}
                          label={getCalendarItemLabel(item)}
                        />
                        <Typography variant="subtitle2">{item.title}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateRange(item.startDate, item.endDate)}
                      </Typography>
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  )
}

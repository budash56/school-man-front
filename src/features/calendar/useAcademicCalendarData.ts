import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { calendarEventsApi } from '../../api/calendarEventsApi'
import type { SchoolYear } from '../../api/schoolYearsApi'
import { termsApi } from '../../api/termsApi'
import { buildAcademicCalendarItems } from './academicCalendar'

type CalendarUserContext = {
  nationalId?: string | null
  role?: string | null
}

type UseAcademicCalendarDataArgs = {
  schoolYear: SchoolYear | null
  user?: CalendarUserContext | null
  enabled?: boolean
}

export const useAcademicCalendarData = ({
  schoolYear,
  user,
  enabled = true,
}: UseAcademicCalendarDataArgs) => {
  const schoolYearId = schoolYear?.schoolYearId

  const {
    data: terms = [],
    isLoading: isLoadingTerms,
  } = useQuery({
    queryKey: ['calendar-terms', schoolYearId],
    queryFn: () => termsApi.list({ schoolYearId }),
    enabled: Boolean(enabled && schoolYearId),
    staleTime: 5 * 60_000,
  })

  const {
    data: events = [],
    isLoading: isLoadingEvents,
  } = useQuery({
    queryKey: ['calendar-events', schoolYearId, user?.nationalId, user?.role],
    queryFn: () => calendarEventsApi.list({ schoolYearId }),
    enabled: Boolean(enabled && schoolYearId),
    staleTime: 60_000,
  })

  const items = useMemo(
    () => buildAcademicCalendarItems(schoolYear, terms, events),
    [events, schoolYear, terms],
  )

  return {
    terms,
    events,
    items,
    isLoading: isLoadingTerms || isLoadingEvents,
  }
}

import { apiClient } from './apiClient'

export type CalendarEventCategory =
  | 'communication'
  | 'official'
  | 'retake_period'
  | 'enrollment_period'
  | 'teacher_exam'
  | 'teacher_homework'
  | 'teacher_custom'

export type CalendarEventVisibilityScope =
  | 'everyone'
  | 'registrars'
  | 'all_teachers'
  | 'selected_teachers'
  | 'teacher_areas'
  | 'class_groups'

export type CalendarEvent = {
  calendarEventId: number
  schoolYearId: number
  title: string
  description: string | null
  category: CalendarEventCategory
  kind: string
  startDate: string
  endDate: string
  visibilityScope: CalendarEventVisibilityScope
  targetTeacherIds: string[]
  targetAreaIds: number[]
  targetClassGroupIds: number[]
  createdById: string | null
  createdByRole: string | null
  createdByName: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  editable: boolean
}

export type CalendarEventsQuery = {
  schoolYearId?: number
  from?: string
  to?: string
}

export type CreateCalendarEventPayload = {
  schoolYearId: number
  title: string
  description?: string | null
  category: CalendarEventCategory
  kind: string
  startDate: string
  endDate: string
  visibilityScope?: CalendarEventVisibilityScope
  targetTeacherIds?: string[]
  targetAreaIds?: number[]
  targetClassGroupIds?: number[]
}

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>

export const calendarEventsApi = {
  list(params: CalendarEventsQuery = {}) {
    return apiClient.get<CalendarEvent[]>('/calendar-events', {
      query: {
        schoolYearId: params.schoolYearId,
        from: params.from,
        to: params.to,
      },
    })
  },
  getById(calendarEventId: number) {
    return apiClient.get<CalendarEvent>(`/calendar-events/${calendarEventId}`)
  },
  create(payload: CreateCalendarEventPayload) {
    return apiClient.post<CalendarEvent>('/calendar-events', payload)
  },
  update(calendarEventId: number, payload: UpdateCalendarEventPayload) {
    return apiClient.patch<CalendarEvent>(`/calendar-events/${calendarEventId}`, payload)
  },
  remove(calendarEventId: number) {
    return apiClient.del<{ deleted: true }>(`/calendar-events/${calendarEventId}`)
  },
}

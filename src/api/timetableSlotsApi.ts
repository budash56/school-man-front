import { apiClient } from './apiClient'
import type { PaginatedResult } from '../types/pagination'
import type { Division } from './timetableGeneratorApi'

export type TimetableSlot = {
  slotId: number
  schoolYearId?: number
  division?: Division
  dayOfWeek: number
  startTime: string
  endTime: string
  durationMinutes: number
}

export type CreateTimetableSlotPayload = {
  division: Division
  dayOfWeek: number
  startTime: string
  endTime: string
  slotIndex?: number
}

const normalizeListResponse = (payload: TimetableSlot[] | PaginatedResult<TimetableSlot>) => {
  if (Array.isArray(payload)) {
    return payload
  }
  return payload.data ?? []
}

const createSlot = (payload: CreateTimetableSlotPayload) => {
  return apiClient.post<TimetableSlot>('/timetable-slots', payload)
}

export const timetableSlotsApi = {
  async listBySchoolYear(schoolYearId: number, division: Division) {
    const result = await apiClient.get<TimetableSlot[] | PaginatedResult<TimetableSlot>>('/timetable-slots', {
      query: {
        schoolYearId,
        division,
        page: 1,
        pageSize: 100,
      },
    })
    return normalizeListResponse(result)
  },
  async createBulkForYear(
    slots: Array<CreateTimetableSlotPayload>,
  ) {
    const results: TimetableSlot[] = []
    for (const slot of slots) {
      const created = await createSlot({
        division: slot.division,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotIndex: slot.slotIndex,
      })
      results.push(created)
    }
    return results
  },
  delete(slotId: number) {
    return apiClient.del(`/timetable-slots/${slotId}`)
  },
}

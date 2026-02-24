import { apiClient } from './apiClient'

export type SchoolYear = {
  schoolYearId: number
  name: string
  yearStart: string
  yearEnd: string
  isActive: boolean
}

export type SchoolYearsQuery = {
  active?: boolean
  name?: string
}

export const schoolYearsApi = {
  list(params: SchoolYearsQuery = {}) {
    return apiClient.get<SchoolYear[]>('/school-years', {
      query: {
        active: params.active,
        name: params.name,
      },
    })
  },
  rollover(payload: { startDate: string; endDate: string; name?: string }) {
    return apiClient.post<{ previous: SchoolYear | null; current: SchoolYear }>('/school-years/rollover', payload)
  },
}

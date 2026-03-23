import { apiClient } from './apiClient'

export type SchoolYear = {
  schoolYearId: number
  name: string
  yearStart: string
  yearEnd: string
  isActive: boolean
}

export type CompleteSchoolYearResult = {
  schoolYearId: number
  nextSchoolYearId: number | null
  closedAt: string
  force: boolean
  enrollmentsClosed: number
  studentsPromoted: number
  studentsGraduated: number
  studentsAlreadyEnrolled: number
}

export type SchoolYearsQuery = {
  active?: boolean
  name?: string
}

export type UpdateSchoolYearPayload = Partial<{
  name: string
  startDate: string
  endDate: string
  active: boolean
}>

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
  update(schoolYearId: number, payload: UpdateSchoolYearPayload) {
    return apiClient.patch<SchoolYear>(`/school-years/${schoolYearId}`, payload)
  },
  complete(schoolYearId: number, payload: { force?: boolean }) {
    return apiClient.post<CompleteSchoolYearResult>(`/school-years/${schoolYearId}/complete`, payload)
  },
}

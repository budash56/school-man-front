import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Enrollment = {
  enrollmentId: number
  studentId: number
  classGroupId: number
  schoolYearId: number
  active: boolean
  enrolledAt: string | null
}

export type EnrollmentsQuery = {
  studentId?: number
  classGroupId?: number
  schoolYearId?: number
  page?: number
  pageSize?: number
}

export type CreateEnrollmentPayload = {
  studentId: number
  classGroupId: number
  schoolYearId: number
}

export const enrollmentsApi = {
  list(params: EnrollmentsQuery) {
    return apiClient.get<PaginatedResult<Enrollment>>('/enrollments', {
      query: {
        studentId: params.studentId,
        classGroupId: params.classGroupId,
        schoolYearId: params.schoolYearId,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  create(payload: CreateEnrollmentPayload) {
    return apiClient.post<Enrollment>('/enrollments', payload)
  },
}

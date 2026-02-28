import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Enrollment = {
  enrollmentId: number
  studentId: number
  classGroupId: number | null
  gradeLevel: number
  schoolYearId: number
  active: boolean
  enrolledAt: string | null
}

export type EnrollmentsQuery = {
  studentId?: number
  classGroupId?: number
  gradeLevel?: number
  schoolYearId?: number
  page?: number
  pageSize?: number
}

export type CreateEnrollmentPayload = {
  studentId: number
  schoolYearId: number
  gradeLevel: number
  classGroupId?: number
}

export const enrollmentsApi = {
  list(params: EnrollmentsQuery) {
    return apiClient.get<PaginatedResult<Enrollment>>('/enrollments', {
      query: {
        studentId: params.studentId,
        classGroupId: params.classGroupId,
        gradeLevel: params.gradeLevel,
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

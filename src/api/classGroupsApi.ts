import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type ClassGroup = {
  classGroupId: number
  schoolYearId: number
  gradeLevel: number
  section: string
  code?: string
  classroomId: number | null
}

export type ClassGroupsQuery = {
  schoolYearId?: number
  page?: number
  pageSize?: number
}

export const classGroupsApi = {
  list(params: ClassGroupsQuery) {
    return apiClient.get<PaginatedResult<ClassGroup>>('/class-groups', {
      query: {
        schoolYearId: params.schoolYearId,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
}

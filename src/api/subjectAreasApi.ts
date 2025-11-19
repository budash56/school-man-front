import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type SubjectArea = {
  areaId: number
  code: string
  name: string
}

export type SubjectAreasQuery = {
  q?: string
  page?: number
  pageSize?: number
}

export const subjectAreasApi = {
  list(params: SubjectAreasQuery = {}) {
    return apiClient.get<PaginatedResult<SubjectArea>>('/subject-areas', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(areaId: number) {
    return apiClient.get<SubjectArea>(`/subject-areas/${areaId}`)
  },
}

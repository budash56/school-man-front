import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'
import { type Subject } from './subjectsApi'

export type SubjectArea = {
  areaId: number
  code: string | null
  name: string
  subjects?: Subject[]
}

export type SubjectAreasQuery = {
  q?: string
  page?: number
  pageSize?: number
  includeSubjects?: boolean
}

export type CreateSubjectAreaPayload = {
  code: string
  name: string
}

export const subjectAreasApi = {
  list(params: SubjectAreasQuery = {}) {
    return apiClient.get<PaginatedResult<SubjectArea>>('/subject-areas', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
        includeSubjects: params.includeSubjects,
      },
    })
  },
  getById(areaId: number) {
    return apiClient.get<SubjectArea>(`/subject-areas/${areaId}`)
  },
  create(payload: CreateSubjectAreaPayload) {
    return apiClient.post<SubjectArea>('/subject-areas', payload)
  },
}

import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Subject = {
  subjectId: number
  subjectCode: string
  name: string
  description: string | null
  areaId?: number
}

export type SubjectsQuery = {
  q?: string
  areaId?: number
  page?: number
  pageSize?: number
}

export type CreateSubjectPayload = {
  areaId: number
  code: string
  name: string
  description?: string
}

export const subjectsApi = {
  list(params: SubjectsQuery = {}) {
    return apiClient.get<PaginatedResult<Subject>>('/subjects', {
      query: {
        q: params.q,
        areaId: params.areaId,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  create(payload: CreateSubjectPayload) {
    return apiClient.post<Subject>('/subjects', payload)
  },
  remove(subjectId: number) {
    return apiClient.del<{ deleted: true }>(`/subjects/${subjectId}`)
  },
}

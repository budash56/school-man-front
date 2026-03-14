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

const normalizeSubject = (subject: Subject): Subject => ({
  ...subject,
  subjectId: Number(subject.subjectId),
  areaId: subject.areaId === undefined ? undefined : Number(subject.areaId),
})

export const subjectsApi = {
  async list(params: SubjectsQuery = {}) {
    const response = await apiClient.get<PaginatedResult<Subject>>('/subjects', {
      query: {
        q: params.q,
        areaId: params.areaId,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
    return {
      ...response,
      data: response.data.map(normalizeSubject),
    }
  },
  async create(payload: CreateSubjectPayload) {
    const response = await apiClient.post<Subject>('/subjects', payload)
    return normalizeSubject(response)
  },
  remove(subjectId: number) {
    return apiClient.del<{ deleted: true }>(`/subjects/${subjectId}`)
  },
}

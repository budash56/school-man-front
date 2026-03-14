import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'
import { type Subject } from './subjectsApi'

export type SubjectArea = {
  areaId: number
  code: string | null
  name: string
  isSpecialization?: boolean
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
  isSpecialization?: boolean
}

export type UpdateSubjectAreaPayload = Partial<CreateSubjectAreaPayload>

const normalizeSubjectArea = (area: SubjectArea): SubjectArea => ({
  ...area,
  areaId: Number(area.areaId),
  subjects: area.subjects?.map((subject) => ({
    ...subject,
    subjectId: Number(subject.subjectId),
    areaId:
      subject.areaId === undefined
        ? Number(area.areaId)
        : Number(subject.areaId),
  })),
})

export const subjectAreasApi = {
  async list(params: SubjectAreasQuery = {}) {
    const response = await apiClient.get<PaginatedResult<SubjectArea>>('/subject-areas', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
        includeSubjects: params.includeSubjects,
      },
    })
    return {
      ...response,
      data: response.data.map(normalizeSubjectArea),
    }
  },
  async getById(areaId: number) {
    const response = await apiClient.get<SubjectArea>(`/subject-areas/${areaId}`)
    return normalizeSubjectArea(response)
  },
  async create(payload: CreateSubjectAreaPayload) {
    const response = await apiClient.post<SubjectArea>('/subject-areas', payload)
    return normalizeSubjectArea(response)
  },
  async update(areaId: number, payload: UpdateSubjectAreaPayload) {
    const response = await apiClient.patch<SubjectArea>(`/subject-areas/${areaId}`, payload)
    return normalizeSubjectArea(response)
  },
}

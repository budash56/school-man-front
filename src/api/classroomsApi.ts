import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Classroom = {
  classroomId: number
  name: string
  buildingId?: number | null
  building?: {
    buildingId: number
    name: string
  } | null
  capacity: number
  createdAt: string | null
}

export type ClassroomsQuery = {
  q?: string
  building?: string
  buildingId?: number
  page?: number
  pageSize?: number
}

export type CreateClassroomPayload = {
  name?: string
  buildingId: number
  capacity: number
}

export type UpdateClassroomPayload = Partial<CreateClassroomPayload>

export const classroomsApi = {
  list(params: ClassroomsQuery = {}) {
    return apiClient.get<PaginatedResult<Classroom>>('/classrooms', {
      query: {
        q: params.q,
        building: params.building,
        buildingId: params.buildingId,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(classroomId: number) {
    return apiClient.get<Classroom>(`/classrooms/${classroomId}`)
  },
  create(payload: CreateClassroomPayload) {
    return apiClient.post<Classroom>('/classrooms', payload)
  },
  update(classroomId: number, payload: UpdateClassroomPayload) {
    return apiClient.patch<Classroom>(`/classrooms/${classroomId}`, payload)
  },
  remove(classroomId: number) {
    return apiClient.del<{ deleted: true }>(`/classrooms/${classroomId}`)
  },
}

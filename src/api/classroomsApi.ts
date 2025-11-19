import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Classroom = {
  classroomId: number
  name: string
  building: string | null
  capacity: number
  createdAt: string | null
}

export type ClassroomsQuery = {
  q?: string
  building?: string
  page?: number
  pageSize?: number
}

export const classroomsApi = {
  list(params: ClassroomsQuery = {}) {
    return apiClient.get<PaginatedResult<Classroom>>('/classrooms', {
      query: {
        q: params.q,
        building: params.building,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(classroomId: number) {
    return apiClient.get<Classroom>(`/classrooms/${classroomId}`)
  },
}

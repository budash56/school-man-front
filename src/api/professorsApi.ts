import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Professor = {
  nationalId: string
  username: string
  role: 'admin' | 'coordinator' | 'registrar' | 'teacher'
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  isActive: boolean | null
}

export type ProfessorsQuery = {
  q?: string
  page?: number
  pageSize?: number
}

export const professorsApi = {
  list(params: ProfessorsQuery = {}) {
    return apiClient.get<PaginatedResult<Professor>>('/users', {
      query: {
        role: 'teacher',
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(nationalId: string) {
    return apiClient.get<Professor>(`/users/${nationalId}`)
  },
}

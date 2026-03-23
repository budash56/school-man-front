import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'
import { type AuthResponse } from './authApi'

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

export type CreateProfessorPayload = {
  nationalId: string
  password: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

export const professorsApi = {
  list(params: ProfessorsQuery = {}) {
    return apiClient.get<PaginatedResult<Professor>>('/users/teachers', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(nationalId: string) {
    return apiClient.get<Professor>(`/users/teachers/${nationalId}`)
  },
  create(payload: CreateProfessorPayload) {
    return apiClient.post<AuthResponse>('/auth/signup', {
      ...payload,
      role: 'teacher',
    })
  },
}

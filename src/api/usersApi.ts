import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'
import { type AuthResponse, type Role } from './authApi'

export type User = {
  nationalId: string
  username: string
  role: Role
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  isActive: boolean | null
}

export type UsersQuery = {
  q?: string
  role?: Role
  isActive?: boolean
  page?: number
  pageSize?: number
}

export type CreateUserPayload = {
  nationalId: string
  password: string
  role: Role
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

export type BulkImportCredential = {
  nationalId: string
  username: string
  tempPassword: string
}

export type BulkImportUsersResult = {
  total: number
  created: number
  skipped: number
  errors: { row: number; message: string }[]
  credentials: BulkImportCredential[]
}

export const usersApi = {
  list(params: UsersQuery = {}) {
    return apiClient.get<PaginatedResult<User>>('/users', {
      query: {
        q: params.q,
        role: params.role,
        isActive: params.isActive,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(nationalId: string) {
    return apiClient.get<User>(`/users/${nationalId}`)
  },
  create(payload: CreateUserPayload) {
    return apiClient.post<AuthResponse>('/auth/signup', payload)
  },
  remove(nationalId: string) {
    return apiClient.delete<{ deleted: true }>(`/users/${nationalId}`)
  },
  bulkImport(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postForm<BulkImportUsersResult>('/users/bulk-import', formData)
  },
}

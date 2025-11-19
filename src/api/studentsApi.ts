import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Student = {
  studentId: number
  nationalId: string
  firstName: string
  lastName: string
  dob: string | null
  address: string | null
  guardianName: string | null
  guardianRelationship: string | null
  guardianPhone: string | null
  isActive: boolean
}

export type StudentsQuery = {
  page?: number
  pageSize?: number
  q?: string
  year?: number
}

export type CreateStudentPayload = {
  nationalId: string
  firstName: string
  lastName: string
  dob: string
  address?: string | null
  guardianName: string
  guardianRelationship: string
  guardianPhone: string
}

export type UpdateStudentPayload = Partial<CreateStudentPayload>

export const studentsApi = {
  list(params: StudentsQuery) {
    return apiClient.get<PaginatedResult<Student>>('/students', {
      query: {
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        year: params.year,
      },
    })
  },
  getById(studentId: number) {
    return apiClient.get<Student>(`/students/${studentId}`)
  },
  create(payload: CreateStudentPayload) {
    return apiClient.post<Student>('/students', payload)
  },
  update(studentId: number, payload: UpdateStudentPayload) {
    return apiClient.patch<Student>(`/students/${studentId}`, payload)
  },
  async searchByNationalId(nationalId: string) {
    const result = await apiClient.get<PaginatedResult<Student>>('/students', {
      query: {
        q: nationalId,
        page: 1,
        pageSize: 1,
      },
    })
    if (!result.data || result.data.length === 0) {
      return null
    }
    return result.data[0]
  },
}

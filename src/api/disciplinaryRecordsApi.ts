import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type DisciplinaryCategory = 'green' | 'yellow' | 'red' | 'last_notice'

export type DisciplinaryRecord = {
  disciplinaryId: number
  studentId: number
  recordedBy: string | null
  dateHappened: string
  category: DisciplinaryCategory
  description: string | null
  expiresAt: string | null
  createdAt: string | null
}

export type DisciplinaryRecordsQuery = {
  studentId?: number
  category?: DisciplinaryCategory
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

export const disciplinaryRecordsApi = {
  list(params: DisciplinaryRecordsQuery) {
    return apiClient.get<PaginatedResult<DisciplinaryRecord>>('/disciplinary-records', {
      query: {
        studentId: params.studentId,
        category: params.category,
        fromDate: params.fromDate,
        toDate: params.toDate,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
}

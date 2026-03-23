import { apiClient } from './apiClient'

export type Term = {
  termId: number
  schoolYearId: number
  name: string
  startDate: string
  endDate: string
  sortOrder: number
  isFinal: boolean
}

export type TermsQuery = {
  active?: boolean
  name?: string
  schoolYearId?: number
}

export const termsApi = {
  list(params: TermsQuery = {}) {
    return apiClient.get<Term[]>('/terms', {
      query: {
        active: params.active,
        name: params.name,
        schoolYearId: params.schoolYearId,
      },
    })
  },
}

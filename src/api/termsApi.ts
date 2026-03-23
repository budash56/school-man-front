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

export type CreateTermPayload = {
  schoolYearId: number
  name: string
  startDate: string
  endDate: string
}

export type UpdateTermPayload = Partial<CreateTermPayload>

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
  create(payload: CreateTermPayload) {
    return apiClient.post<Term>('/terms', payload)
  },
  update(termId: number, payload: UpdateTermPayload) {
    return apiClient.patch<Term>(`/terms/${termId}`, payload)
  },
}

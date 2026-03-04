import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type Building = {
  buildingId: number
  name: string
  isLab?: boolean
  isAuditorium?: boolean
  isComputerRoom?: boolean
  createdAt?: string | null
}

export type BuildingsQuery = {
  q?: string
  page?: number
  pageSize?: number
}

export type CreateBuildingPayload = {
  name: string
  isLab?: boolean
  isAuditorium?: boolean
  isComputerRoom?: boolean
}

export type UpdateBuildingPayload = Partial<CreateBuildingPayload>

export const buildingsApi = {
  list(params: BuildingsQuery = {}) {
    return apiClient.get<PaginatedResult<Building>>('/buildings', {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(buildingId: number) {
    return apiClient.get<Building>(`/buildings/${buildingId}`)
  },
  create(payload: CreateBuildingPayload) {
    return apiClient.post<Building>('/buildings', payload)
  },
  update(buildingId: number, payload: UpdateBuildingPayload) {
    return apiClient.patch<Building>(`/buildings/${buildingId}`, payload)
  },
  remove(buildingId: number) {
    return apiClient.del<{ deleted: true }>(`/buildings/${buildingId}`)
  },
}

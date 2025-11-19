import { useQuery } from '@tanstack/react-query'
import { classGroupsApi, type ClassGroup, type ClassGroupsQuery } from '../../api/classGroupsApi'
import { type PaginatedResult } from '../../types/pagination'

export const useClassGroupsQuery = (params: ClassGroupsQuery) => {
  return useQuery<PaginatedResult<ClassGroup>, Error>({
    queryKey: ['class-groups', params],
    queryFn: () => classGroupsApi.list(params),
    enabled: params.schoolYearId !== undefined,
    staleTime: 60_000,
  })
}

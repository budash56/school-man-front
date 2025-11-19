import { useQuery } from '@tanstack/react-query'
import { schoolYearsApi, type SchoolYear, type SchoolYearsQuery } from '../../api/schoolYearsApi'

export const useSchoolYearsQuery = (params: SchoolYearsQuery = {}) => {
  return useQuery<SchoolYear[], Error>({
    queryKey: ['school-years', params],
    queryFn: () => schoolYearsApi.list(params),
    staleTime: 5 * 60_000,
  })
}

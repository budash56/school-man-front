import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { studentsApi, type Student, type StudentsQuery } from '../../api/studentsApi'
import { type PaginatedResult } from '../../types/pagination'

const defaultPageSize = 25

export const useStudentsQuery = (params: StudentsQuery) => {
  const { page = 1, pageSize = defaultPageSize, q, year } = params

  return useQuery<PaginatedResult<Student>, Error>({
    queryKey: ['students', { page, pageSize, q, year }],
    queryFn: () =>
      studentsApi.list({
        page,
        pageSize,
        q,
        year,
      }),
    placeholderData: keepPreviousData,
  })
}

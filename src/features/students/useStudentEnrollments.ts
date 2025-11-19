import { useQuery } from '@tanstack/react-query'
import { enrollmentsApi, type Enrollment } from '../../api/enrollmentsApi'
import { type PaginatedResult } from '../../types/pagination'

export const useStudentEnrollments = (studentId: number | undefined) => {
  return useQuery<PaginatedResult<Enrollment>, Error>({
    queryKey: ['student-enrollments', studentId],
    queryFn: () => {
      if (studentId === undefined) {
        throw new Error('studentId is required')
      }
      return enrollmentsApi.list({
        studentId,
        page: 1,
        pageSize: 10,
      })
    },
    enabled: studentId !== undefined,
  })
}

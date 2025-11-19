import { useQuery } from '@tanstack/react-query'
import {
  disciplinaryRecordsApi,
  type DisciplinaryRecord,
} from '../../api/disciplinaryRecordsApi'
import { type PaginatedResult } from '../../types/pagination'

export const useStudentDiscipline = (studentId: number | undefined) => {
  return useQuery<PaginatedResult<DisciplinaryRecord>, Error>({
    queryKey: ['student-discipline', studentId],
    queryFn: () => {
      if (studentId === undefined) {
        throw new Error('studentId is required')
      }
      return disciplinaryRecordsApi.list({
        studentId,
        page: 1,
        pageSize: 10,
      })
    },
    enabled: studentId !== undefined,
  })
}

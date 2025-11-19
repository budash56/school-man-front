import { useQuery } from '@tanstack/react-query'
import { studentsApi, type Student } from '../../api/studentsApi'

export const useStudent = (studentId: number | undefined) => {
  return useQuery<Student, Error>({
    queryKey: ['student', studentId],
    queryFn: () => {
      if (studentId === undefined) {
        throw new Error('studentId is required')
      }
      return studentsApi.getById(studentId)
    },
    enabled: studentId !== undefined,
  })
}

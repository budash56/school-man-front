import { useQuery } from '@tanstack/react-query'
import { enrollmentsApi } from '../../api/enrollmentsApi'
import { studentsApi, type Student } from '../../api/studentsApi'

export const useStudentsByClassGroup = (
  schoolYearId: number | undefined,
  classGroupId: number | undefined,
) => {
  return useQuery<Student[], Error>({
    queryKey: ['students-by-class-group', { schoolYearId, classGroupId }],
    queryFn: async () => {
      if (!schoolYearId || !classGroupId) {
        throw new Error('schoolYearId and classGroupId are required')
      }

      const enrollments = await enrollmentsApi.list({
        schoolYearId,
        classGroupId,
        page: 1,
        pageSize: 100,
      })

      const studentIds = Array.from(new Set(enrollments.data.map((e) => e.studentId)))
      const students = await Promise.all(studentIds.map((id) => studentsApi.getById(id)))
      return students
    },
    enabled: Boolean(schoolYearId && classGroupId),
  })
}

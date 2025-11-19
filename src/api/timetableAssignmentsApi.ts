import { apiClient } from './apiClient'
import type { TimetableAssignment } from './timetableGeneratorApi'

export const timetableAssignmentsApi = {
  async listByYear(schoolYearId: number) {
    const response = await apiClient.get<TimetableAssignment[] | { data: TimetableAssignment[] }>(
      '/timetable-assignments',
      {
        query: {
          schoolYearId,
          page: 1,
          pageSize: 100, // TODO: handle pagination when more than 100 assignments exist
        },
      },
    )

    if (Array.isArray(response)) {
      return response
    }

    return response.data ?? []
  },

  deleteById(assignmentId: number | string) {
    return apiClient.del(`/timetable-assignments/${assignmentId}`)
  },

  async deleteAllForYear(schoolYearId: number, classGroupIds?: number[]) {
    const assignments = await this.listByYear(schoolYearId)
    const allowedIds = classGroupIds ? new Set(classGroupIds.map(String)) : null
    const filtered = allowedIds
      ? assignments.filter((assignment) =>
          assignment.classGroupId ? allowedIds.has(assignment.classGroupId) : false,
        )
      : assignments
    const results = await Promise.allSettled(filtered.map((assignment) => this.deleteById(assignment.assignmentId)))
    const hasFailures = results.some((result) => result.status === 'rejected')
    if (hasFailures) {
      throw new Error('Failed to delete some timetable assignments. Please try again.')
    }
  },
}

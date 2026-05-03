import { apiClient } from './apiClient'
import type { ScannedCurriculumScheduleResponse, ScannedTimetableAssignment } from './scannerApi'

export type PreferredShift = 'any' | 'morning' | 'afternoon'

export type TeacherConstraintDto = {
  teacherId: string
  preferredShift?: PreferredShift
  avoidLastSlot?: boolean
}

export type CoursePreferenceDto = {
  courseId: number
  preferredShift?: PreferredShift
  blockLength?: number
  sessionsPerWeek?: number
}

export type Division = 'elementary' | 'secondary' | 'senior'

export type GenerateTimetableDto = {
  schoolYearId: number
  division: Division
  teacherWeeklyHourCap: number
  teacherConstraints?: TeacherConstraintDto[]
  coursePreferences?: CoursePreferenceDto[]
}

export type TimetablePreviewAssignment = {
  courseId: number
  classGroupId: number
  teacherId: string | number | null
  slotId: number
  dayOfWeek: number
  startTime: string
  endTime: string
  shift: Exclude<PreferredShift, 'any'>
  label: string
  reason?: string
}

export type TimetablePreviewUnassigned = {
  courseId: number
  classGroupId: number
  teacherId: string | number | null
  blockLength: number
  reason: string
}

export type TimetablePreviewResponse = {
  assignments: TimetablePreviewAssignment[]
  unassignedSessions: TimetablePreviewUnassigned[]
}

export type TimetableApplyResponse = TimetablePreviewResponse & {
  persistedAssignments: TimetablePreviewAssignment[]
  failedToPersist: TimetablePreviewAssignment[]
}

export type GenerationApplyResult = TimetableApplyResponse

export type TimetableImportApplyResponse = {
  imported: {
    teachers: number
    subjectAreas: number
    subjects: number
    classGroups: number
    curricula: number
    curriculumItems: number
    courseInstances: number
    courses: number
    slots: number
    assignments: number
  }
  skippedAssignments: number
  defaultTeacherPassword: string
  message: string
}

export type TimetableImportConfirmPayload = {
  schoolYearId: number
  scan: {
    assignments: ScannedTimetableAssignment[]
  }
}

export type CurriculumScheduleImportApplyResponse = {
  imported: TimetableImportApplyResponse['imported']
  message: string
}

export type TimetableAssignment = {
  assignmentId: string
  courseId: string
  classGroupId: string | null
  teacherId: string | null
  slotId: string | null
  classroomId: string | null
  slot?: {
    dayOfWeek?: number
    startTime?: string
    endTime?: string
  }
  classroom?: {
    name?: string
  }
}

export const timetableGeneratorApi = {
  async hasTimetableForYear(
    _schoolYearId: number,
    classGroupIds: number[] = [],
    _division?: Division,
  ) {
    if (!classGroupIds.length) {
      return false
    }

    const assignments = await apiClient.get<TimetableAssignment[]>(
      '/timetable-assignments',
    )
    const classGroupLookup = new Set(classGroupIds.map(String))
    return assignments.some((assignment) =>
      assignment.classGroupId
        ? classGroupLookup.has(String(assignment.classGroupId))
        : false,
    )
  },
  preview(payload: GenerateTimetableDto) {
    return apiClient.post<TimetablePreviewResponse>(
      '/timetable-generator/preview',
      payload,
    )
  },
  apply(payload: GenerateTimetableDto) {
    return apiClient.post<TimetableApplyResponse>(
      '/timetable-generator/apply',
      payload,
    )
  },
  getProfessorTimetable(teacherId: string) {
    return apiClient.get<TimetableAssignment[]>('/timetable-assignments', {
      query: { teacherId },
    })
  },
  getClassGroupTimetable(classGroupId: number) {
    return apiClient.get<TimetableAssignment[]>('/timetable-assignments', {
      query: { classGroupId },
    })
  },
  confirmImport(payload: TimetableImportConfirmPayload) {
    return apiClient.post<TimetableImportApplyResponse>('/timetable/import/confirm', payload)
  },
  confirmCurriculumScheduleImport(payload: { scan: ScannedCurriculumScheduleResponse }) {
    return apiClient.post<CurriculumScheduleImportApplyResponse>(
      '/timetable/import/curriculum-schedule/confirm',
      payload,
    )
  },
}

import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type AttendanceStatus = 'P' | 'A' | 'AE'

export type AttendanceRecord = {
  attendanceId: number
  studentId: number
  courseId: number
  slotId: number | null
  date: string
  status: AttendanceStatus
  recordedById: string | null
  reasonNote: string | null
  excusedAt: string | null
}

export type AttendanceListQuery = {
  studentId?: number
  courseId?: number
  status?: AttendanceStatus
  from?: string
  to?: string
  scope?: 'own' | 'group'
  page?: number
  pageSize?: number
}

export type AttendanceSheet = {
  classGroupId: number
  date: string
  students: Array<{
    studentId: number
    firstName: string | null
    lastName: string | null
  }>
}

export type CreateAttendancePayload = {
  studentId: number
  courseId: number
  slotId?: number | null
  date: string
  status: AttendanceStatus
}

export type UpdateAttendancePayload = {
  status?: AttendanceStatus
  reasonNote?: string
  excusedAt?: string
}

export const attendanceApi = {
  list(params: AttendanceListQuery = {}) {
    return apiClient.get<PaginatedResult<AttendanceRecord>>('/attendance', {
      query: {
        studentId: params.studentId,
        courseId: params.courseId,
        status: params.status,
        from: params.from,
        to: params.to,
        scope: params.scope,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  sheet(params: { classGroupId: number; date: string }) {
    return apiClient.get<AttendanceSheet>('/attendance/sheet', {
      query: {
        classGroupId: params.classGroupId,
        date: params.date,
      },
    })
  },
  create(payload: CreateAttendancePayload) {
    return apiClient.post<AttendanceRecord>('/attendance', payload)
  },
  update(attendanceId: number, payload: UpdateAttendancePayload) {
    return apiClient.patch<AttendanceRecord>(`/attendance/${attendanceId}`, payload)
  },
  remove(attendanceId: number) {
    return apiClient.del<{ deleted: true }>(`/attendance/${attendanceId}`)
  },
}

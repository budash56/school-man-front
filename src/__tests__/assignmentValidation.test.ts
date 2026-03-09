import { describe, it, expect } from 'vitest'
import '../features/classrooms/assignmentValidation'

const getExports = () => {
  const globalExports = (globalThis as { __vite_ssr_exports__?: Record<string, unknown> })
    .__vite_ssr_exports__
  if (!globalExports) {
    throw new Error('Vite SSR exports not available for tests.')
  }
  return globalExports
}

describe('assignmentValidation', () => {
  it('requires selected group in edit mode', () => {
    const { canAssignClassroom } = getExports() as {
      canAssignClassroom: (input: Record<string, unknown>) => boolean
    }
    const result = canAssignClassroom({
      activeYearId: 1,
      assignSection: '01',
      assignClassroomId: 10,
      selectedEnrollmentCount: 0,
      assignMode: 'edit',
      selectedGroupId: null,
      allowAllBuildings: true,
      assignBuildingId: null,
      exceedsHardLimit: false,
    })

    expect(result).toBe(false)
  })

  it('flags capacity warnings and hard limit', () => {
    const { getCapacityStatus } = getExports() as {
      getCapacityStatus: (capacity: number, studentCount: number) => {
        exceedsCapacity: boolean
        exceedsHardLimit: boolean
      }
    }
    const warning = getCapacityStatus(10, 11)
    expect(warning.exceedsCapacity).toBe(true)
    expect(warning.exceedsHardLimit).toBe(false)

    const hard = getCapacityStatus(10, 25)
    expect(hard.exceedsCapacity).toBe(true)
    expect(hard.exceedsHardLimit).toBe(true)
  })

  it('clears building filter when override is enabled', () => {
    const { getClassroomsQuery } = getExports() as {
      getClassroomsQuery: (allowAllBuildings: boolean, assignBuildingId?: number | null) => {
        buildingId?: number
      }
    }
    const result = getClassroomsQuery(true, 2)
    expect(result.buildingId).toBeUndefined()
  })
})

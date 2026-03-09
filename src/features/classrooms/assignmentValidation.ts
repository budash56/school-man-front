export type AssignmentMode = 'create' | 'edit'

export type CapacityStatus = {
  exceedsCapacity: boolean
  exceedsHardLimit: boolean
}

export const getCapacityStatus = (capacity: number, studentCount: number): CapacityStatus => {
  if (capacity <= 0) {
    return { exceedsCapacity: false, exceedsHardLimit: false }
  }
  return {
    exceedsCapacity: studentCount > capacity,
    exceedsHardLimit: studentCount > capacity * 2,
  }
}

type AssignValidationInput = {
  activeYearId?: number | null
  assignSection?: string
  assignClassroomId?: number | null
  selectedEnrollmentCount: number
  assignMode: AssignmentMode
  selectedGroupId?: number | null
  allowAllBuildings: boolean
  assignBuildingId?: number | null
  exceedsHardLimit: boolean
}

export const canAssignClassroom = (input: AssignValidationInput) => {
  const {
    activeYearId,
    assignSection,
    assignClassroomId,
    selectedEnrollmentCount,
    assignMode,
    selectedGroupId,
    allowAllBuildings,
    assignBuildingId,
    exceedsHardLimit,
  } = input

  if (!activeYearId || !assignSection || !assignClassroomId) {
    return false
  }

  if (!allowAllBuildings && !assignBuildingId) {
    return false
  }

  if (exceedsHardLimit) {
    return false
  }

  if (assignMode === 'edit') {
    return Boolean(selectedGroupId)
  }

  return selectedEnrollmentCount > 0
}

export const getClassroomsQuery = (
  allowAllBuildings: boolean,
  assignBuildingId?: number | null,
) => ({
  buildingId: allowAllBuildings ? undefined : assignBuildingId ?? undefined,
})

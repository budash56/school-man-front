import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  SvgIcon,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Add as AddIcon, CheckCircle as CheckCircleIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buildingsApi, type Building } from '../../api/buildingsApi'
import {
  classroomsApi,
  type Classroom,
  type CreateClassroomPayload,
} from '../../api/classroomsApi'
import { classGroupsApi, type ManualAssignClassGroupResult } from '../../api/classGroupsApi'
import { enrollmentsApi } from '../../api/enrollmentsApi'
import { schoolYearsApi } from '../../api/schoolYearsApi'
import { canAssignClassroom, getCapacityStatus, getClassroomsQuery } from './assignmentValidation'
import { useAuth } from '../auth/AuthContext'

const useBuildingsQuery = (params: { q: string }) => {
  return useQuery({
    queryKey: ['buildings', params],
    queryFn: () =>
      buildingsApi.list({
        q: params.q || undefined,
        pageSize: 100,
      }),
  })
}

const useClassroomsQuery = (params: { q: string; buildingId: number | null }) => {
  return useQuery({
    queryKey: ['classrooms', params],
    queryFn: () =>
      classroomsApi.list({
        q: params.q || undefined,
        buildingId: params.buildingId ?? undefined,
        pageSize: 200,
      }),
  })
}

type ClassroomFormState = {
  buildingId: number | ''
  capacity: number
}

type BulkClassroomFormState = {
  prefix: string
  quantity: number
  capacity: number
  startNumber: number
}

const sanitizeBuildingName = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '')

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildClassroomName = (buildingName: string, classrooms: Classroom[]) => {
  const rawPrefix = buildingName.trim() || 'Edificio'
  const sanitized = sanitizeBuildingName(rawPrefix)
  const basePrefix = sanitized.length > 0 ? sanitized : 'Edificio'
  const maxPrefixLength = 80 - '_Aula'.length - 2
  const prefix = basePrefix.slice(0, Math.max(1, maxPrefixLength))
  const regex = new RegExp(`^${escapeRegex(prefix)}_Aula(\\d+)$`)
  const used = new Set<number>()

  classrooms.forEach((room) => {
    const match = regex.exec(room.name)
    if (match) {
      const value = Number.parseInt(match[1], 10)
      if (Number.isFinite(value) && value > 0) {
        used.add(value)
      }
    }
  })

  let next = 1
  while (used.has(next)) {
    next += 1
  }

  return `${prefix}_Aula${String(next).padStart(2, '0')}`
}

const buildBulkClassroomNames = ({ prefix, quantity, startNumber }: BulkClassroomFormState) => {
  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0
  const safeStart = Number.isFinite(startNumber) ? Math.max(0, Math.floor(startNumber)) : 0
  return Array.from({ length: safeQuantity }, (_, index) => `${prefix}${safeStart + index}`)
}

const BuildingSvg = () => (
  <SvgIcon viewBox="0 0 64 64" sx={{ fontSize: 58 }}>
    <path
      d="M14 55V15c0-2.2 1.8-4 4-4h28c2.2 0 4 1.8 4 4v40"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path d="M8 55h48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path
      d="M22 21h6M36 21h6M22 31h6M36 31h6M22 41h6M36 41h6"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </SvgIcon>
)

const BuildingCard = ({
  building,
  selected,
  classroomCount,
  onClick,
}: {
  building: Building
  selected: boolean
  classroomCount: number
  onClick: () => void
}) => (
  <Paper
    component="button"
    type="button"
    onClick={onClick}
    variant="outlined"
    sx={(theme) => ({
      position: 'relative',
      minHeight: 190,
      p: 2.25,
      borderRadius: 3,
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? 'primary.main' : 'divider',
      bgcolor: selected
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08)
        : 'background.paper',
      color: selected ? 'primary.main' : 'text.primary',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease, background-color 140ms ease',
      boxShadow: selected ? `0 0 0 4px ${alpha(theme.palette.primary.main, 0.16)}` : 'none',
      '&:hover': {
        transform: 'translateY(-2px)',
        borderColor: 'primary.main',
        boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.32 : 0.12)}`,
      },
    })}
  >
    {selected ? (
      <CheckCircleIcon
        color="primary"
        sx={{ position: 'absolute', top: 12, right: 12, fontSize: 22 }}
      />
    ) : null}
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%' }}>
      <BuildingSvg />
      <Stack spacing={0.5} alignItems="center">
        <Typography variant="h6">{building.name}</Typography>
        <Chip
          size="small"
          color={selected ? 'primary' : 'default'}
          label={`${classroomCount} ${classroomCount === 1 ? 'aula' : 'aulas'}`}
        />
      </Stack>
    </Stack>
  </Paper>
)

const ClassroomCard = ({
  classroom,
  selectedBuildingName,
  canManage,
  onEdit,
  onDelete,
}: {
  classroom: Classroom
  selectedBuildingName?: string
  canManage: boolean
  onEdit: (classroom: Classroom) => void
  onDelete: (classroomId: number) => void
}) => (
  <Paper
    variant="outlined"
    sx={(theme) => ({
      p: 2,
      borderRadius: 3,
      bgcolor: alpha(theme.palette.background.paper, 0.9),
      borderColor: alpha(theme.palette.divider, 0.9),
    })}
  >
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h6" noWrap>
            {classroom.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedBuildingName ?? classroom.building?.name ?? 'Sin edificio'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => onEdit(classroom)} disabled={!canManage}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(classroom.classroomId)}
            disabled={!canManage}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        label={`Capacidad ${classroom.capacity}`}
        sx={{ alignSelf: 'flex-start' }}
      />
    </Stack>
  </Paper>
)

export const ClassroomsPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canManage = user?.role === 'admin' || user?.role === 'coordinator'
  const isTeacher = user?.role === 'teacher'
  const [activeView, setActiveView] = useState<'buildings' | 'assign'>('buildings')
  const [buildingSearch, setBuildingSearch] = useState('')
  const [classroomSearch, setClassroomSearch] = useState('')
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [isBuildingDialogOpen, setIsBuildingDialogOpen] = useState(false)
  const [buildingName, setBuildingName] = useState('')
  const [buildingFlags, setBuildingFlags] = useState({
    isLab: false,
    isAuditorium: false,
    isComputerRoom: false,
  })
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [buildingError, setBuildingError] = useState<string | null>(null)
  const [isClassroomDialogOpen, setIsClassroomDialogOpen] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [classroomForm, setClassroomForm] = useState<ClassroomFormState>({
    buildingId: '',
    capacity: 0,
  })
  const [bulkClassroomForm, setBulkClassroomForm] = useState<BulkClassroomFormState>({
    prefix: 'A-',
    quantity: 5,
    capacity: 30,
    startNumber: 101,
  })
  const [bulkClassroomError, setBulkClassroomError] = useState<string | null>(null)
  const [classroomError, setClassroomError] = useState<string | null>(null)
  const [assignMode, setAssignMode] = useState<'create' | 'edit'>('create')
  const [assignGrade, setAssignGrade] = useState(1)
  const [assignBuildingId, setAssignBuildingId] = useState<number | null>(null)
  const [allowAllBuildings, setAllowAllBuildings] = useState(false)
  const [assignClassroomId, setAssignClassroomId] = useState<number | null>(null)
  const [assignSection, setAssignSection] = useState('')
  const [assignFixedLocation, setAssignFixedLocation] = useState(false)
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<number[]>([])
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [assignmentResult, setAssignmentResult] = useState<ManualAssignClassGroupResult | null>(null)

  const { data: buildingsResult, isLoading: isLoadingBuildings, isError: isBuildingsError, error: buildingsError } =
    useBuildingsQuery({ q: buildingSearch })

  const buildings = useMemo(() => buildingsResult?.data ?? [], [buildingsResult?.data])
  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.buildingId === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  )

  const { data: classroomsResult, isLoading: isLoadingClassrooms, isError: isClassroomsError, error: classroomsError } =
    useClassroomsQuery({ q: classroomSearch, buildingId: selectedBuildingId })

  const classroomList = useMemo(() => classroomsResult?.data ?? [], [classroomsResult?.data])

  const { data: allClassroomsResult } = useClassroomsQuery({ q: '', buildingId: null })
  const allClassrooms = useMemo(() => allClassroomsResult?.data ?? [], [allClassroomsResult?.data])

  const classroomCountsByBuilding = useMemo(() => {
    const counts = new Map<number, number>()
    allClassrooms.forEach((room) => {
      const buildingId = room.buildingId ?? room.building?.buildingId ?? null
      if (buildingId) {
        counts.set(buildingId, (counts.get(buildingId) ?? 0) + 1)
      }
    })
    return counts
  }, [allClassrooms])

  const bulkClassroomPreview = useMemo(
    () => buildBulkClassroomNames(bulkClassroomForm).slice(0, 12),
    [bulkClassroomForm],
  )

  const { data: activeYears } = useQuery({
    queryKey: ['school-years', { active: true }],
    queryFn: () => schoolYearsApi.list({ active: true }),
    enabled: activeView === 'assign',
  })

  const activeYear = activeYears?.[0] ?? null

  const { data: classGroupsResult } = useQuery({
    queryKey: ['class-groups', { schoolYearId: activeYear?.schoolYearId }],
    queryFn: () =>
      classGroupsApi.list({
        schoolYearId: activeYear?.schoolYearId,
        pageSize: 500,
      }),
    enabled: activeView === 'assign' && Boolean(activeYear?.schoolYearId),
  })

  const classGroups = useMemo(() => classGroupsResult?.data ?? [], [classGroupsResult?.data])

  const usedClassroomIds = useMemo(() => {
    const used = new Set<number>()
    classGroups.forEach((group) => {
      if (group.defaultClassroomId) {
        used.add(group.defaultClassroomId)
      }
    })
    return used
  }, [classGroups])

  const usedSections = useMemo(() => {
    const used = new Set<string>()
    classGroups.forEach((group) => {
      if (group.gradeLevel === assignGrade) {
        used.add(group.section)
      }
    })
    return used
  }, [classGroups, assignGrade])

  const existingSections = useMemo(() => Array.from(usedSections).sort(), [usedSections])

  const selectedGroup = useMemo(() => {
    if (assignMode !== 'edit' || !assignSection) {
      return null
    }
    return (
      classGroups.find(
        (group) => group.gradeLevel === assignGrade && group.section === assignSection,
      ) ?? null
    )
  }, [assignMode, assignSection, assignGrade, classGroups])

  const { data: assignBuildingsResult } = useQuery({
    queryKey: ['buildings', 'assign'],
    queryFn: () =>
      buildingsApi.list({
        pageSize: 500,
      }),
    enabled: activeView === 'assign',
  })

  const assignBuildings = assignBuildingsResult?.data ?? buildings

  useEffect(() => {
    if (activeView !== 'assign' || allowAllBuildings) {
      return
    }
    if (assignBuildingId === null && assignBuildings.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssignBuildingId(assignBuildings[0].buildingId)
    }
  }, [activeView, allowAllBuildings, assignBuildingId, assignBuildings])

  const { data: assignClassroomsResult, isLoading: isLoadingAssignClassrooms } = useQuery({
    queryKey: ['classrooms', 'assign', { buildingId: allowAllBuildings ? 'all' : assignBuildingId }],
    queryFn: () =>
      classroomsApi.list({
        ...getClassroomsQuery(allowAllBuildings, assignBuildingId),
        pageSize: 500,
      }),
    enabled:
      activeView === 'assign' &&
      Boolean(activeYear?.schoolYearId) &&
      (allowAllBuildings || assignBuildingId !== null),
  })

  const assignClassrooms = useMemo(() => assignClassroomsResult?.data ?? [], [assignClassroomsResult?.data])

  const availableClassrooms = useMemo(() => {
    if (assignMode === 'edit' && selectedGroup?.defaultClassroomId) {
      return assignClassrooms.filter(
        (room) =>
          !usedClassroomIds.has(room.classroomId) ||
          room.classroomId === selectedGroup.defaultClassroomId,
      )
    }
    return assignClassrooms.filter((room) => !usedClassroomIds.has(room.classroomId))
  }, [assignClassrooms, usedClassroomIds, assignMode, selectedGroup])

  const selectedAssignClassroom = useMemo(
    () => availableClassrooms.find((room) => room.classroomId === assignClassroomId) ?? null,
    [availableClassrooms, assignClassroomId],
  )

  const { data: enrollmentsResult, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['enrollments', 'unassigned', activeYear?.schoolYearId, assignGrade],
    queryFn: () =>
      enrollmentsApi.list({
        schoolYearId: activeYear?.schoolYearId,
        gradeLevel: assignGrade,
        unassigned: true,
        active: true,
        pageSize: 500,
      }),
    enabled: activeView === 'assign' && Boolean(activeYear?.schoolYearId),
  })

  const enrollmentList = useMemo(() => enrollmentsResult?.data ?? [], [enrollmentsResult?.data])
  const unassignedStats = useMemo(() => {
    const stats = {
      total: enrollmentList.length,
      male: 0,
      female: 0,
      unknown: 0,
    }

    enrollmentList.forEach((enrollment) => {
      const raw = enrollment.student?.gender ?? enrollment.student?.sex ?? ''
      const normalized = String(raw).trim().toLowerCase()

      if (['m', 'male', 'masculino', 'hombre', 'masc'].includes(normalized)) {
        stats.male += 1
        return
      }
      if (['f', 'female', 'femenino', 'mujer', 'fem'].includes(normalized)) {
        stats.female += 1
        return
      }
      stats.unknown += 1
    })

    return stats
  }, [enrollmentList])

  const { data: assignedEnrollmentsResult, isLoading: isLoadingAssignedEnrollments } = useQuery({
    queryKey: ['enrollments', 'class-group', selectedGroup?.classGroupId],
    queryFn: () =>
      enrollmentsApi.list({
        classGroupId: selectedGroup?.classGroupId,
        active: true,
        pageSize: 500,
      }),
    enabled:
      activeView === 'assign' &&
      assignMode === 'edit' &&
      Boolean(selectedGroup?.classGroupId),
  })

  const assignedEnrollmentTotal =
    assignedEnrollmentsResult?.total ?? assignedEnrollmentsResult?.data?.length ?? 0

  const sectionOptions = useMemo(
    () => Array.from({ length: 9 }, (_, index) => String(index + 1).padStart(2, '0')),
    [],
  )

  const availableSections = useMemo(
    () => sectionOptions.filter((section) => !usedSections.has(section)),
    [sectionOptions, usedSections],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedEnrollmentIds([])
    setAssignmentError(null)
    setAssignmentResult(null)
  }, [assignGrade, activeYear?.schoolYearId, assignMode])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignClassroomId(null)
  }, [assignBuildingId, allowAllBuildings])

  useEffect(() => {
    const options = assignMode === 'edit' ? existingSections : availableSections
    if (!options.includes(assignSection)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssignSection(options[0] ?? '')
    }
  }, [assignMode, existingSections, availableSections, assignSection])

  useEffect(() => {
    if (assignMode !== 'edit') {
      return
    }
    if (selectedGroup?.defaultClassroomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssignClassroomId(Number(selectedGroup.defaultClassroomId))
    }
  }, [assignMode, selectedGroup])

  const nameBuildingId =
    classroomForm.buildingId === '' ? null : Number(classroomForm.buildingId)

  const shouldFetchNameClassrooms =
    Boolean(isClassroomDialogOpen && nameBuildingId && nameBuildingId !== selectedBuildingId)

  const { data: nameClassroomsResult } = useQuery({
    queryKey: ['classrooms', 'name', nameBuildingId],
    queryFn: () =>
      classroomsApi.list({
        buildingId: nameBuildingId ?? undefined,
        pageSize: 500,
      }),
    enabled: shouldFetchNameClassrooms,
  })

  const classroomsForName = useMemo(() => {
    if (!nameBuildingId) {
      return []
    }
    if (nameBuildingId === selectedBuildingId) {
      return classroomList
    }
    return nameClassroomsResult?.data ?? []
  }, [nameBuildingId, selectedBuildingId, classroomList, nameClassroomsResult])

  const buildingForName = useMemo(
    () => buildings.find((building) => building.buildingId === nameBuildingId) ?? null,
    [buildings, nameBuildingId],
  )

  const classroomNamePreview = useMemo(() => {
    if (!buildingForName) {
      return ''
    }
    if (editingClassroom) {
      const originalBuildingId = editingClassroom.buildingId ?? editingClassroom.building?.buildingId ?? null
      if (originalBuildingId === nameBuildingId) {
        return editingClassroom.name
      }
    }
    return buildClassroomName(buildingForName.name, classroomsForName)
  }, [buildingForName, classroomsForName, editingClassroom, nameBuildingId])

  const createBuildingMutation = useMutation({
    mutationFn: buildingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setIsBuildingDialogOpen(false)
      setBuildingName('')
      setBuildingFlags({ isLab: false, isAuditorium: false, isComputerRoom: false })
      setEditingBuilding(null)
      setBuildingError(null)
    },
    onError: (error) => {
      setBuildingError(error instanceof Error ? error.message : 'No se pudo guardar el edificio.')
    },
  })

  const updateBuildingMutation = useMutation({
    mutationFn: ({
      buildingId,
      payload,
    }: {
      buildingId: number
      payload: { name: string; isLab: boolean; isAuditorium: boolean; isComputerRoom: boolean }
    }) => buildingsApi.update(buildingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setIsBuildingDialogOpen(false)
      setBuildingName('')
      setBuildingFlags({ isLab: false, isAuditorium: false, isComputerRoom: false })
      setEditingBuilding(null)
      setBuildingError(null)
    },
    onError: (error) => {
      setBuildingError(error instanceof Error ? error.message : 'No se pudo actualizar el edificio.')
    },
  })

  const deleteBuildingMutation = useMutation({
    mutationFn: (buildingId: number) => buildingsApi.remove(buildingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setSelectedBuildingId(null)
    },
  })

  const createClassroomMutation = useMutation({
    mutationFn: (payload: CreateClassroomPayload) => classroomsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setIsClassroomDialogOpen(false)
      setEditingClassroom(null)
      setClassroomForm({ buildingId: '', capacity: 0 })
      setClassroomError(null)
    },
    onError: (error) => {
      setClassroomError(error instanceof Error ? error.message : 'No se pudo guardar el aula.')
    },
  })

  const createBulkClassroomsMutation = useMutation({
    mutationFn: async (payloads: CreateClassroomPayload[]) => {
      const created: Classroom[] = []
      for (const payload of payloads) {
        created.push(await classroomsApi.create(payload))
      }
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setBulkClassroomError(null)
    },
    onError: (error) => {
      setBulkClassroomError(error instanceof Error ? error.message : 'No se pudieron generar las aulas.')
    },
  })

  const updateClassroomMutation = useMutation({
    mutationFn: ({ classroomId, payload }: { classroomId: number; payload: Partial<CreateClassroomPayload> }) =>
      classroomsApi.update(classroomId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      setIsClassroomDialogOpen(false)
      setEditingClassroom(null)
      setClassroomForm({ buildingId: '', capacity: 0 })
      setClassroomError(null)
    },
    onError: (error) => {
      setClassroomError(error instanceof Error ? error.message : 'No se pudo actualizar el aula.')
    },
  })

  const deleteClassroomMutation = useMutation({
    mutationFn: (classroomId: number) => classroomsApi.remove(classroomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
    },
  })

  const manualAssignMutation = useMutation({
    mutationFn: (payload: {
      schoolYearId: number
      gradeLevel: number
      section: string
      classroomId: number
      enrollmentIds: number[]
      fixedLocation?: boolean
    }) => classGroupsApi.manualAssign(payload),
    onSuccess: (result) => {
      setAssignmentResult(result)
      setAssignmentError(null)
      setSelectedEnrollmentIds([])
      queryClient.invalidateQueries({ queryKey: ['class-groups'] })
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
    },
    onError: (error) => {
      setAssignmentError(error instanceof Error ? error.message : 'No se pudo asignar el salón.')
    },
  })

  const updateGroupClassroomMutation = useMutation({
    mutationFn: (payload: { classGroupId: number; classroomId: number; fixedLocation?: boolean }) =>
      classGroupsApi.updateClassroom(payload.classGroupId, {
        classroomId: payload.classroomId,
        fixedLocation: payload.fixedLocation,
      }),
    onSuccess: (result) => {
      setAssignmentResult(result)
      setAssignmentError(null)
      queryClient.invalidateQueries({ queryKey: ['class-groups'] })
      queryClient.invalidateQueries({ queryKey: ['classrooms'] })
    },
    onError: (error) => {
      setAssignmentError(error instanceof Error ? error.message : 'No se pudo actualizar el salón.')
    },
  })

  const handleToggleEnrollment = (enrollmentId: number) => {
    setSelectedEnrollmentIds((prev) =>
      prev.includes(enrollmentId) ? prev.filter((id) => id !== enrollmentId) : [...prev, enrollmentId],
    )
  }

  const handleToggleAllEnrollments = () => {
    if (selectedEnrollmentIds.length === enrollmentList.length) {
      setSelectedEnrollmentIds([])
      return
    }
    setSelectedEnrollmentIds(enrollmentList.map((enrollment) => enrollment.enrollmentId))
  }

  const openCreateBuilding = () => {
    setEditingBuilding(null)
    setBuildingName('')
    setBuildingFlags({ isLab: false, isAuditorium: false, isComputerRoom: false })
    setBuildingError(null)
    setIsBuildingDialogOpen(true)
  }

  const openEditBuilding = () => {
    if (!selectedBuilding) {
      return
    }
    setEditingBuilding(selectedBuilding)
    setBuildingName(selectedBuilding.name)
    setBuildingFlags({
      isLab: Boolean(selectedBuilding.isLab),
      isAuditorium: Boolean(selectedBuilding.isAuditorium),
      isComputerRoom: Boolean(selectedBuilding.isComputerRoom),
    })
    setBuildingError(null)
    setIsBuildingDialogOpen(true)
  }

  const handleSaveBuilding = () => {
    const name = buildingName.trim()
    if (!name) {
      setBuildingError('El nombre es obligatorio.')
      return
    }
    if (editingBuilding) {
      updateBuildingMutation.mutate({
        buildingId: editingBuilding.buildingId,
        payload: {
          name,
          isLab: buildingFlags.isLab,
          isAuditorium: buildingFlags.isAuditorium,
          isComputerRoom: buildingFlags.isComputerRoom,
        },
      })
    } else {
      createBuildingMutation.mutate({
        name,
        isLab: buildingFlags.isLab,
        isAuditorium: buildingFlags.isAuditorium,
        isComputerRoom: buildingFlags.isComputerRoom,
      })
    }
  }

  const handleDeleteBuilding = () => {
    if (!selectedBuilding) {
      return
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar este edificio?')
    if (!confirmed) {
      return
    }
    deleteBuildingMutation.mutate(selectedBuilding.buildingId)
  }

  const openCreateClassroom = () => {
    const defaultBuildingId = selectedBuildingId ?? buildings[0]?.buildingId ?? ''
    setEditingClassroom(null)
    setClassroomForm({ buildingId: defaultBuildingId, capacity: 0 })
    setClassroomError(null)
    setIsClassroomDialogOpen(true)
  }

  const openEditClassroom = (classroom: Classroom) => {
    setEditingClassroom(classroom)
    setClassroomForm({
      buildingId: classroom.buildingId ?? classroom.building?.buildingId ?? '',
      capacity: classroom.capacity,
    })
    setClassroomError(null)
    setIsClassroomDialogOpen(true)
  }

  const handleSaveClassroom = () => {
    if (!classroomForm.buildingId) {
      setClassroomError('Selecciona un edificio.')
      return
    }
    if (editingClassroom) {
      updateClassroomMutation.mutate({
        classroomId: editingClassroom.classroomId,
        payload: {
          buildingId: classroomForm.buildingId as number,
          capacity: classroomForm.capacity,
        },
      })
    } else {
      createClassroomMutation.mutate({
        buildingId: classroomForm.buildingId as number,
        capacity: classroomForm.capacity,
      })
    }
  }

  const handleDeleteClassroom = (classroomId: number) => {
    const confirmed = window.confirm('¿Seguro que deseas eliminar este aula?')
    if (!confirmed) {
      return
    }
    deleteClassroomMutation.mutate(classroomId)
  }

  const handleCreateBulkClassrooms = () => {
    if (!selectedBuildingId) {
      setBulkClassroomError('Selecciona un edificio para generar aulas.')
      return
    }
    const prefix = bulkClassroomForm.prefix.trim()
    const quantity = Math.floor(Number(bulkClassroomForm.quantity))
    const capacity = Math.floor(Number(bulkClassroomForm.capacity))
    const startNumber = Math.floor(Number(bulkClassroomForm.startNumber))
    if (!prefix) {
      setBulkClassroomError('El prefijo es obligatorio.')
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setBulkClassroomError('La cantidad debe ser mayor a 0.')
      return
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setBulkClassroomError('La capacidad debe ser mayor a 0.')
      return
    }
    if (!Number.isFinite(startNumber) || startNumber < 0) {
      setBulkClassroomError('El número inicial debe ser válido.')
      return
    }
    const names = buildBulkClassroomNames({ prefix, quantity, capacity, startNumber })
    const existingNames = new Set(classroomList.map((room) => room.name.trim().toLowerCase()))
    const duplicate = names.find((name) => existingNames.has(name.trim().toLowerCase()))
    if (duplicate) {
      setBulkClassroomError(`El aula ${duplicate} ya existe en este edificio.`)
      return
    }
    setBulkClassroomError(null)
    createBulkClassroomsMutation.mutate(
      names.map((name) => ({
        name,
        buildingId: selectedBuildingId,
        capacity,
      })),
    )
  }

  const buildingSelectOptions = buildings.map((building) => (
    <MenuItem key={building.buildingId} value={building.buildingId}>
      {building.name}
    </MenuItem>
  ))

  const isEditMode = assignMode === 'edit'
  const assignSelectedCount = selectedEnrollmentIds.length
  const currentStudentCount = isEditMode ? assignedEnrollmentTotal : assignSelectedCount
  const assignCapacity = selectedAssignClassroom?.capacity ?? 0
  const { exceedsCapacity, exceedsHardLimit } = getCapacityStatus(assignCapacity, currentStudentCount)

  const canAssign = canAssignClassroom({
    activeYearId: activeYear?.schoolYearId,
    assignSection,
    assignClassroomId,
    selectedEnrollmentCount: assignSelectedCount,
    assignMode,
    selectedGroupId: selectedGroup?.classGroupId,
    allowAllBuildings,
    assignBuildingId,
    exceedsHardLimit,
  })

  const handleAssignClassroom = () => {
    if (!activeYear || !assignClassroomId || !assignSection) {
      return
    }
    if (!allowAllBuildings && !assignBuildingId) {
      setAssignmentError('Selecciona un edificio o habilita la opción para usar todos.')
      return
    }
    if (isEditMode) {
      if (!selectedGroup) {
        setAssignmentError('Selecciona un grupo existente para actualizar.')
        return
      }
      updateGroupClassroomMutation.mutate({
        classGroupId: selectedGroup.classGroupId,
        classroomId: assignClassroomId,
        fixedLocation: assignFixedLocation,
      })
      return
    }
    manualAssignMutation.mutate({
      schoolYearId: activeYear.schoolYearId,
      gradeLevel: assignGrade,
      section: assignSection,
      classroomId: assignClassroomId,
      enrollmentIds: selectedEnrollmentIds,
      fixedLocation: assignFixedLocation,
    })
  }

  const viewHeader = (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
      <Typography variant="h4">Aulas</Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Stack direction="row" spacing={1}>
        <Button
          variant={activeView === 'buildings' ? 'contained' : 'outlined'}
          onClick={() => setActiveView('buildings')}
        >
          Edificios
        </Button>
        <Button
          variant={activeView === 'assign' ? 'contained' : 'outlined'}
          onClick={() => setActiveView('assign')}
        >
          Asignar Salones
        </Button>
      </Stack>
    </Stack>
  )

  const sectionOptionsForMode = assignMode === 'edit' ? existingSections : availableSections

  const buildingsView = (
    <Stack spacing={2.5}>
      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5">Áreas / Edificios</Typography>
              <Typography variant="body2" color="text.secondary">
                Selecciona un edificio para ver y crear sus aulas.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateBuilding}
              disabled={!canManage}
            >
              Nuevo
            </Button>
          </Stack>

          <TextField
            label="Buscar edificio"
            value={buildingSearch}
            onChange={(event) => setBuildingSearch(event.target.value)}
            fullWidth
          />

          {isLoadingBuildings ? (
            <Typography color="text.secondary">Cargando edificios…</Typography>
          ) : null}
          {isBuildingsError ? (
            <Alert severity="error">{buildingsError?.message || 'Error cargando edificios.'}</Alert>
          ) : null}

          {buildings.length === 0 && !isLoadingBuildings ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
              <Stack spacing={1.5} alignItems="center">
                <Typography variant="h6">Primero crea un edificio para poder registrar aulas.</Typography>
                <Typography variant="body2" color="text.secondary">
                  Los edificios funcionan como áreas físicas donde se organizan las aulas.
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateBuilding} disabled={!canManage}>
                  Nuevo edificio
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 2,
              }}
            >
              {buildings.map((building) => (
                <BuildingCard
                  key={building.buildingId}
                  building={building}
                  selected={building.buildingId === selectedBuildingId}
                  classroomCount={classroomCountsByBuilding.get(building.buildingId) ?? 0}
                  onClick={() => setSelectedBuildingId(building.buildingId)}
                />
              ))}
            </Box>
          )}
        </Stack>
      </Paper>

      {selectedBuilding ? (
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5">Aulas de {selectedBuilding.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {classroomList.length} {classroomList.length === 1 ? 'aula registrada' : 'aulas registradas'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={openEditBuilding}
                  disabled={!canManage}
                >
                  Editar edificio
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteBuilding}
                  disabled={!canManage}
                >
                  Eliminar
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateClassroom}
                  disabled={!canManage}
                >
                  Crear aula
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {selectedBuilding.isLab ? <Chip size="small" label="Laboratorio" /> : null}
              {selectedBuilding.isAuditorium ? <Chip size="small" label="Auditorio" /> : null}
              {selectedBuilding.isComputerRoom ? <Chip size="small" label="Sala de sistemas" /> : null}
            </Stack>

            <TextField
              label="Buscar aula"
              value={classroomSearch}
              onChange={(event) => setClassroomSearch(event.target.value)}
              fullWidth
            />

            {isLoadingClassrooms ? (
              <Typography color="text.secondary">Cargando aulas…</Typography>
            ) : null}
            {isClassroomsError ? (
              <Alert severity="error">{classroomsError?.message || 'Error cargando aulas.'}</Alert>
            ) : null}

            {classroomList.length === 0 && !isLoadingClassrooms ? (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
                <Stack spacing={1.5} alignItems="center">
                  <Typography variant="h6">Este edificio aún no tiene aulas.</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Crea la primera aula o genera varias en lote.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateClassroom} disabled={!canManage}>
                      Crear aula
                    </Button>
                    <Button variant="outlined" component="a" href="#bulk-classrooms" disabled={!canManage}>
                      Crear en lote
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, minmax(0, 1fr))',
                    xl: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: 1.5,
                }}
              >
                {classroomList.map((room) => (
                  <ClassroomCard
                    key={room.classroomId}
                    classroom={room}
                    selectedBuildingName={selectedBuilding.name}
                    canManage={canManage}
                    onEdit={openEditClassroom}
                    onDelete={handleDeleteClassroom}
                  />
                ))}
              </Box>
            )}

            <Paper id="bulk-classrooms" variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">Crear aulas en lote</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Genera varias aulas para {selectedBuilding.name} usando un prefijo y numeración consecutiva.
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    label="Prefijo"
                    value={bulkClassroomForm.prefix}
                    onChange={(event) =>
                      setBulkClassroomForm((current) => ({ ...current, prefix: event.target.value }))
                    }
                    error={!bulkClassroomForm.prefix.trim()}
                    helperText={!bulkClassroomForm.prefix.trim() ? 'Obligatorio' : 'Ej. A-'}
                  />
                  <TextField
                    label="Número inicial"
                    type="number"
                    value={bulkClassroomForm.startNumber}
                    onChange={(event) =>
                      setBulkClassroomForm((current) => ({ ...current, startNumber: Number(event.target.value) }))
                    }
                    inputProps={{ min: 0 }}
                  />
                  <TextField
                    label="Cantidad"
                    type="number"
                    value={bulkClassroomForm.quantity}
                    onChange={(event) =>
                      setBulkClassroomForm((current) => ({ ...current, quantity: Number(event.target.value) }))
                    }
                    inputProps={{ min: 1 }}
                    error={bulkClassroomForm.quantity <= 0}
                  />
                  <TextField
                    label="Capacidad por aula"
                    type="number"
                    value={bulkClassroomForm.capacity}
                    onChange={(event) =>
                      setBulkClassroomForm((current) => ({ ...current, capacity: Number(event.target.value) }))
                    }
                    inputProps={{ min: 1 }}
                    error={bulkClassroomForm.capacity <= 0}
                  />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {bulkClassroomPreview.map((name) => (
                    <Chip key={name} size="small" label={name} />
                  ))}
                  {bulkClassroomForm.quantity > bulkClassroomPreview.length ? (
                    <Chip size="small" label={`+${bulkClassroomForm.quantity - bulkClassroomPreview.length} más`} />
                  ) : null}
                </Stack>
                {bulkClassroomError ? <Alert severity="error">{bulkClassroomError}</Alert> : null}
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleCreateBulkClassrooms}
                    disabled={
                      !canManage ||
                      !selectedBuildingId ||
                      createBulkClassroomsMutation.isPending ||
                      !bulkClassroomForm.prefix.trim() ||
                      bulkClassroomForm.quantity <= 0 ||
                      bulkClassroomForm.capacity <= 0
                    }
                  >
                    {createBulkClassroomsMutation.isPending ? 'Generando…' : 'Generar aulas'}
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      ) : buildings.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Selecciona un edificio para ver sus aulas.
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  )

  const assignView = (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="h5">Asignar Salones</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            size="small"
            color={activeYear ? 'success' : 'warning'}
            label={activeYear ? `Año activo: ${activeYear.name}` : 'Sin año activo'}
          />
        </Stack>

        {!canManage ? (
          <Alert severity="info">Modo solo lectura para tu rol.</Alert>
        ) : null}

        {!activeYear ? (
          <Alert severity="warning">No hay un año activo. Activa uno para poder asignar salones.</Alert>
        ) : null}

        <Stack direction="row" spacing={1}>
          <Button
            variant={assignMode === 'create' ? 'contained' : 'outlined'}
            onClick={() => setAssignMode('create')}
            disabled={!canManage}
          >
            Crear grupo
          </Button>
          <Button
            variant={assignMode === 'edit' ? 'contained' : 'outlined'}
            onClick={() => setAssignMode('edit')}
            disabled={!canManage}
          >
            Editar aula
          </Button>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <FormControl sx={{ minWidth: 120 }} size="small" disabled={!canManage}>
            <InputLabel id="assign-grade-label">Grado</InputLabel>
            <Select
              labelId="assign-grade-label"
              label="Grado"
              value={assignGrade}
              onChange={(event) => setAssignGrade(Number(event.target.value))}
            >
              {Array.from({ length: 11 }, (_, index) => index + 1).map((grade) => (
                <MenuItem key={grade} value={grade}>
                  {grade}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            sx={{ minWidth: 120 }}
            size="small"
            disabled={!canManage || sectionOptionsForMode.length === 0}
          >
            <InputLabel id="assign-section-label">Sección</InputLabel>
            <Select
              labelId="assign-section-label"
              label="Sección"
              value={assignSection}
              onChange={(event) => setAssignSection(String(event.target.value))}
            >
              {sectionOptionsForMode.length === 0 ? (
                <MenuItem value="" disabled>
                  Sin secciones
                </MenuItem>
              ) : null}
              {sectionOptionsForMode.map((section) => (
                <MenuItem key={section} value={section}>
                  {section}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            sx={{ minWidth: 200 }}
            size="small"
            disabled={!canManage || allowAllBuildings || assignBuildings.length === 0}
          >
            <InputLabel id="assign-building-label">Edificio</InputLabel>
            <Select
              labelId="assign-building-label"
              label="Edificio"
              value={assignBuildingId ?? ''}
              onChange={(event) => setAssignBuildingId(Number(event.target.value))}
            >
              {assignBuildings.map((building) => (
                <MenuItem key={building.buildingId} value={building.buildingId}>
                  {building.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            sx={{ minWidth: 220 }}
            size="small"
            disabled={!canManage || availableClassrooms.length === 0}
          >
            <InputLabel id="assign-classroom-label">Aula</InputLabel>
            <Select
              labelId="assign-classroom-label"
              label="Aula"
              value={assignClassroomId ?? ''}
              onChange={(event) => setAssignClassroomId(Number(event.target.value))}
            >
              {availableClassrooms.length === 0 ? (
                <MenuItem value="" disabled>
                  Sin aulas disponibles
                </MenuItem>
              ) : null}
              {availableClassrooms.map((room) => (
                <MenuItem key={room.classroomId} value={room.classroomId}>
                  {room.name} {room.building?.name ? `· ${room.building.name}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={allowAllBuildings}
                onChange={(event) => setAllowAllBuildings(event.target.checked)}
                disabled={!canManage}
              />
            }
            label="Mostrar todos los edificios"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={assignFixedLocation}
                onChange={(event) => setAssignFixedLocation(event.target.checked)}
                disabled={!canManage}
              />
            }
            label="Guardar ubicación fija"
          />
          {selectedAssignClassroom ? (
            <Typography variant="body2" color="text.secondary">
              Capacidad: {assignCapacity || 'Sin definir'}
            </Typography>
          ) : null}
        </Stack>

        {assignMode === 'edit' ? (
          <Alert severity="info">
            Editar aula solo cambia el salón del grupo actual. Los estudiantes no se modifican.
          </Alert>
        ) : null}

        {assignMode === 'edit' && existingSections.length === 0 ? (
          <Alert severity="info">No hay grupos creados para este grado.</Alert>
        ) : null}

        {assignMode === 'create' ? (
          <>
            <Divider />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1">
                Estudiantes sin grupo {unassignedStats.total}, Masculino {unassignedStats.male}, Femenino{' '}
                {unassignedStats.female}
                {unassignedStats.unknown > 0 ? `, Sin dato ${unassignedStats.unknown}` : ''}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" onClick={handleToggleAllEnrollments} disabled={enrollmentList.length === 0}>
                {assignSelectedCount === enrollmentList.length ? 'Quitar selección' : 'Seleccionar todos'}
              </Button>
            </Stack>
            {isLoadingEnrollments ? (
              <Typography color="text.secondary">Cargando estudiantes…</Typography>
            ) : null}
            {enrollmentList.length === 0 && !isLoadingEnrollments ? (
              <Typography color="text.secondary">Sin estudiantes pendientes.</Typography>
            ) : null}
            <List dense sx={{ maxHeight: 280, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {enrollmentList.map((enrollment) => (
                <ListItemButton
                  key={enrollment.enrollmentId}
                  onClick={() => handleToggleEnrollment(enrollment.enrollmentId)}
                >
                  <Checkbox checked={selectedEnrollmentIds.includes(enrollment.enrollmentId)} />
                  <ListItemText
                    primary={
                      enrollment.student
                        ? `${enrollment.student.firstName} ${enrollment.student.lastName}`
                        : `Estudiante ${enrollment.studentId}`
                    }
                    secondary={enrollment.student?.nationalId ? `ID: ${enrollment.student.nationalId}` : undefined}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        ) : (
          <>
            <Divider />
            {isLoadingAssignedEnrollments ? (
              <Typography color="text.secondary">Cargando estudiantes asignados…</Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              Estudiantes asignados: {currentStudentCount}
            </Typography>
          </>
        )}

        {exceedsHardLimit ? (
          <Alert severity="error">
            Demasiados estudiantes para esta aula. La capacidad es {assignCapacity}, seleccionados/asignados{' '}
            {currentStudentCount}.
          </Alert>
        ) : null}
        {exceedsCapacity && !exceedsHardLimit ? (
          <Alert severity="warning">
            La capacidad del aula es {assignCapacity}. Actualmente hay {currentStudentCount} estudiantes.
          </Alert>
        ) : null}
        {assignmentError ? <Alert severity="error">{assignmentError}</Alert> : null}
        {assignmentResult ? (
          <Alert severity="success">
            {assignMode === 'edit' ? 'Aula actualizada' : 'Asignación completada'} · Grupo{' '}
            {assignmentResult.classGroup.code}
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="contained"
            onClick={handleAssignClassroom}
            disabled={
              !canManage ||
              !canAssign ||
              manualAssignMutation.isPending ||
              updateGroupClassroomMutation.isPending ||
              isLoadingAssignClassrooms
            }
          >
            {assignMode === 'edit' ? 'Actualizar aula' : 'Asignar salón'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setSelectedEnrollmentIds([])
              setAssignmentError(null)
              setAssignmentResult(null)
            }}
          >
            Limpiar selección
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )

  const dialogs = (
    <>
      <Dialog open={isBuildingDialogOpen} onClose={() => setIsBuildingDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingBuilding ? 'Editar edificio' : 'Nuevo edificio'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            value={buildingName}
            onChange={(event) => setBuildingName(event.target.value)}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={buildingFlags.isLab}
                  onChange={(event) =>
                    setBuildingFlags((prev) => ({ ...prev, isLab: event.target.checked }))
                  }
                />
              }
              label="Laboratorio"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={buildingFlags.isAuditorium}
                  onChange={(event) =>
                    setBuildingFlags((prev) => ({ ...prev, isAuditorium: event.target.checked }))
                  }
                />
              }
              label="Auditorio"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={buildingFlags.isComputerRoom}
                  onChange={(event) =>
                    setBuildingFlags((prev) => ({
                      ...prev,
                      isComputerRoom: event.target.checked,
                    }))
                  }
                />
              }
              label="Sala de sistemas"
            />
          </Stack>
          {buildingError ? <Alert severity="error">{buildingError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBuildingDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveBuilding}
            disabled={createBuildingMutation.isPending || updateBuildingMutation.isPending}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isClassroomDialogOpen} onClose={() => setIsClassroomDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingClassroom ? 'Editar aula' : 'Nueva aula'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Nombre generado" value={classroomNamePreview || '—'} disabled />
          <FormControl fullWidth>
            <InputLabel id="classroom-building-label">Edificio</InputLabel>
            <Select
              labelId="classroom-building-label"
              label="Edificio"
              value={classroomForm.buildingId}
              onChange={(event) =>
                setClassroomForm((prev) => ({ ...prev, buildingId: Number(event.target.value) }))
              }
            >
              {buildingSelectOptions}
            </Select>
          </FormControl>
          <TextField
            label="Capacidad"
            type="number"
            inputProps={{ min: 0 }}
            value={classroomForm.capacity}
            onChange={(event) =>
              setClassroomForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))
            }
          />
          {classroomError ? <Alert severity="error">{classroomError}</Alert> : null}
          {buildings.length === 0 ? (
            <Alert severity="info">Primero crea un edificio para registrar aulas.</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsClassroomDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveClassroom}
            disabled={
              createClassroomMutation.isPending ||
              updateClassroomMutation.isPending ||
              buildings.length === 0
            }
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )

  if (isTeacher) {
    return <Alert severity="info">Aulas no están disponibles para docentes.</Alert>
  }

  return (
    <Stack spacing={2}>
      {viewHeader}
      {!canManage ? <Alert severity="info">Modo solo lectura para tu rol.</Alert> : null}
      {activeView === 'assign' ? assignView : buildingsView}
      {dialogs}
    </Stack>
  )
}

export default ClassroomsPage

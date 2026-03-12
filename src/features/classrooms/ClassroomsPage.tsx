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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buildingsApi, type Building } from '../../api/buildingsApi'
import {
  classroomsApi,
  type Classroom,
  type CreateClassroomPayload,
} from '../../api/classroomsApi'
import { classGroupsApi, type ManualAssignClassGroupResult } from '../../api/classGroupsApi'
import { enrollmentsApi, type Enrollment } from '../../api/enrollmentsApi'
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

const sanitizeBuildingName = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '')

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildClassroomName = (buildingName: string, classrooms: Classroom[]) => {
  const rawPrefix = buildingName.trim() || 'Building'
  const sanitized = sanitizeBuildingName(rawPrefix)
  const basePrefix = sanitized.length > 0 ? sanitized : 'Building'
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

export const ClassroomsPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canManage = user?.role === 'admin' || user?.role === 'coordinator'

  if (user?.role === 'teacher') {
    return <Alert severity="info">Aulas no están disponibles para docentes.</Alert>
  }
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

  const buildings = buildingsResult?.data ?? []
  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.buildingId === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  )

  const { data: classroomsResult, isLoading: isLoadingClassrooms, isError: isClassroomsError, error: classroomsError } =
    useClassroomsQuery({ q: classroomSearch, buildingId: selectedBuildingId })

  const classroomList = classroomsResult?.data ?? []

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

  const classGroups = classGroupsResult?.data ?? []

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

  const assignClassrooms = assignClassroomsResult?.data ?? []

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

  const enrollmentList = enrollmentsResult?.data ?? []

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
    setSelectedEnrollmentIds([])
    setAssignmentError(null)
    setAssignmentResult(null)
  }, [assignGrade, activeYear?.schoolYearId, assignMode])

  useEffect(() => {
    setAssignClassroomId(null)
  }, [assignBuildingId, allowAllBuildings])

  useEffect(() => {
    const options = assignMode === 'edit' ? existingSections : availableSections
    if (!options.includes(assignSection)) {
      setAssignSection(options[0] ?? '')
    }
  }, [assignMode, existingSections, availableSections, assignSection])

  useEffect(() => {
    if (assignMode !== 'edit') {
      return
    }
    if (selectedGroup?.defaultClassroomId) {
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
    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
      <Paper sx={{ flexBasis: { md: '32%' }, flexShrink: 0, p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5">Edificios</Typography>
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
          />

          {isLoadingBuildings ? (
            <Typography color="text.secondary">Cargando edificios…</Typography>
          ) : null}
          {isBuildingsError ? (
            <Alert severity="error">{buildingsError?.message || 'Error cargando edificios.'}</Alert>
          ) : null}

          <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <ListItemButton
              selected={selectedBuildingId === null}
              onClick={() => setSelectedBuildingId(null)}
            >
              <ListItemText primary="Todos los edificios" />
            </ListItemButton>
            {buildings.map((building) => (
              <ListItemButton
                key={building.buildingId}
                selected={building.buildingId === selectedBuildingId}
                onClick={() => setSelectedBuildingId(building.buildingId)}
              >
                <ListItemText primary={building.name} />
              </ListItemButton>
            ))}
          </List>
        </Stack>
      </Paper>

      <Paper sx={{ flexGrow: 1, p: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="h5">Aulas</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateClassroom}
              disabled={buildings.length === 0 || !canManage}
            >
              Nueva aula
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {selectedBuilding ? `Edificio: ${selectedBuilding.name}` : 'Edificio: Todos'}
            </Typography>
            {selectedBuilding ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton size="small" onClick={openEditBuilding} disabled={!canManage}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={handleDeleteBuilding} disabled={!canManage}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : null}
          </Stack>
          {selectedBuilding ? (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {selectedBuilding.isLab ? <Chip size="small" label="Lab" /> : null}
              {selectedBuilding.isAuditorium ? <Chip size="small" label="Auditorim" /> : null}
              {selectedBuilding.isComputerRoom ? <Chip size="small" label="Computer Room" /> : null}
            </Stack>
          ) : null}

          <TextField
            label="Buscar aula"
            value={classroomSearch}
            onChange={(event) => setClassroomSearch(event.target.value)}
          />

          {buildings.length === 0 ? (
            <Alert severity="info">Primero crea un edificio para poder registrar aulas.</Alert>
          ) : null}

          {isLoadingClassrooms ? (
            <Typography color="text.secondary">Cargando aulas…</Typography>
          ) : null}
          {isClassroomsError ? (
            <Alert severity="error">{classroomsError?.message || 'Error cargando aulas.'}</Alert>
          ) : null}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Edificio</TableCell>
                  <TableCell>Capacidad</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {classroomList.map((room) => (
                  <TableRow key={room.classroomId} hover>
                    <TableCell>{room.name}</TableCell>
                    <TableCell>{room.building?.name ?? 'N/A'}</TableCell>
                    <TableCell>{room.capacity}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEditClassroom(room)} disabled={!canManage}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClassroom(room.classroomId)}
                        disabled={!canManage}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {classroomList.length === 0 && !isLoadingClassrooms ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color="text.secondary">Sin aulas registradas.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>
    </Box>
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
              <Typography variant="subtitle1">Estudiantes sin grupo</Typography>
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
              label="Lab"
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
              label="Auditorim"
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
              label="Computer Room"
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

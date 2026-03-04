import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  const queryClient = useQueryClient()
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

  return (
    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
      <Paper sx={{ flexBasis: { md: '32%' }, flexShrink: 0, p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5">Edificios</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateBuilding}>
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
              disabled={buildings.length === 0}
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
                <IconButton size="small" onClick={openEditBuilding}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={handleDeleteBuilding}>
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
                      <IconButton size="small" onClick={() => openEditClassroom(room)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteClassroom(room.classroomId)}>
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
    </Box>
  )
}

export default ClassroomsPage

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subjectAreasApi } from '../../api/subjectAreasApi'
import { teacherSubjectsApi } from '../../api/teacherSubjectsApi'
import { usersApi, type BulkImportUsersResult, type CreateUserPayload, type User } from '../../api/usersApi'
import { useAuth } from '../auth/AuthContext'
import { useLocation } from 'react-router-dom'
import { subjectsApi } from '../../api/subjectsApi'
import { coursesApi } from '../../api/coursesApi'
import { type Role } from '../../api/authApi'

const roles = [
  { value: 'teacher', label: 'Profesor' },
  { value: 'coordinator', label: 'Coordinador' },
  { value: 'registrar', label: 'Registro' },
] as const

const allRoleOptions: Array<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'coordinator', label: 'Coordinador' },
  { value: 'registrar', label: 'Registro' },
  { value: 'teacher', label: 'Profesor' },
]

const roleLabel = (role: Role | string) =>
  allRoleOptions.find((option) => option.value === role)?.label ?? role

type RoleValue = (typeof roles)[number]['value']

const emptyUser: CreateUserPayload = {
  nationalId: '',
  password: '',
  role: 'teacher',
  username: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
}

const buildTempPassword = (lastName: string | undefined, nationalId: string | undefined) => {
  const trimmedLastName = lastName?.trim() ?? ''
  const firstLastName = trimmedLastName ? trimmedLastName.split(/\s+/)[0] : ''
  const digits = (nationalId ?? '').replace(/\D/g, '')
  if (!firstLastName || digits.length < 4) {
    return ''
  }
  return `${firstLastName}${digits.slice(-4)}`
}

export const UsersPage = () => {
  const { user } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState<RoleValue>('teacher')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkImportUsersResult | null>(null)
  const [bulkError, setBulkError] = useState('')
  const [draftUser, setDraftUser] = useState<CreateUserPayload>(emptyUser)
  const [selectedAreas, setSelectedAreas] = useState<number[]>([])
  const [selectedCreateSubjectIds, setSelectedCreateSubjectIds] = useState<number[]>([])
  const [areaError, setAreaError] = useState('')
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedAssignAreaId, setSelectedAssignAreaId] = useState<number | ''>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('')
  const [draftRole, setDraftRole] = useState<Role>('teacher')
  const emailIsValid = Boolean(draftUser.email?.trim())
  const tempPassword = useMemo(
    () => buildTempPassword(draftUser.lastName, draftUser.nationalId),
    [draftUser.lastName, draftUser.nationalId],
  )
  const createRoles = useMemo(
    () =>
      user?.role === 'admin'
        ? roles
        : roles.filter((role) => role.value === 'teacher' || role.value === 'registrar'),
    [user?.role],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', selectedRole],
    queryFn: () => usersApi.list({ role: selectedRole, page: 1, pageSize: 100 }),
  })

  const {
    data: selectedUser,
    isLoading: isLoadingSelectedUser,
    isError: isSelectedUserError,
    error: selectedUserError,
  } = useQuery({
    queryKey: ['user', selectedUserId],
    queryFn: () => {
      if (!selectedUserId) {
        throw new Error('userId required')
      }
      return usersApi.getById(selectedUserId)
    },
    enabled: Boolean(selectedUserId),
  })

  const {
    data: teacherSubjects,
    isLoading: isLoadingTeacherSubjects,
    isError: isTeacherSubjectsError,
    error: teacherSubjectsError,
  } = useQuery({
    queryKey: ['teacher-subjects', selectedUserId],
    queryFn: () => {
      if (!selectedUserId) {
        throw new Error('teacherId required')
      }
      return teacherSubjectsApi.list({ teacherId: selectedUserId })
    },
    enabled: Boolean(selectedUserId) && selectedUser?.role === 'teacher',
  })

  const { data: subjectsResult } = useQuery({
    queryKey: ['subjects', 'all'],
    queryFn: () => subjectsApi.list({ pageSize: 100 }),
  })
  const subjects = subjectsResult?.data ?? []

  const {
    data: courses,
    isLoading: isLoadingCourses,
    isError: isCoursesError,
    error: coursesError,
  } = useQuery({
    queryKey: ['teacher-courses', selectedUserId],
    queryFn: () => {
      if (!selectedUserId) {
        throw new Error('teacherId required')
      }
      return coursesApi.list({ teacherId: selectedUserId })
    },
    enabled: Boolean(selectedUserId) && selectedUser?.role === 'teacher',
  })

  const assignedSubjectIds = useMemo(() => {
    return new Set((teacherSubjects ?? []).map((item) => item.subjectId))
  }, [teacherSubjects])

  const availableSubjects = useMemo(() => {
    return subjects.filter((subject) => !assignedSubjectIds.has(subject.subjectId))
  }, [subjects, assignedSubjectIds])

  const homerooms = useMemo(() => {
    if (!courses) {
      return []
    }
    const labels = new Set<string>()
    courses.forEach((course) => {
      labels.add(`${course.gradeLevel}° ${course.section}`)
    })
    return Array.from(labels)
  }, [courses])

  const {
    data: areasResult,
    isLoading: isLoadingAreas,
    isError: isAreasError,
    error: areasError,
  } = useQuery({
    queryKey: ['subject-areas', 'with-subjects'],
    queryFn: () => subjectAreasApi.list({ pageSize: 100, includeSubjects: true }),
  })

  const areas = areasResult?.data ?? []
  const areasById = useMemo(() => new Map(areas.map((area) => [area.areaId, area])), [areas])

  const filteredUsers = useMemo(() => {
    const list = data?.data ?? []
    if (!search.trim()) {
      return list
    }
    const needle = search.trim().toLowerCase()
    return list.filter((entry) => {
      const fullName = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.toLowerCase()
      return (
        fullName.includes(needle) ||
        entry.nationalId.toLowerCase().includes(needle) ||
        entry.username.toLowerCase().includes(needle)
      )
    })
  }, [data, search])

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      setIsCreateOpen(false)
      setDraftUser(emptyUser)
      setSelectedAreas([])
      setAreaError('')
      refetch()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      setIsDeleteOpen(false)
      setSelectedUserId(null)
      refetch()
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ nationalId, role }: { nationalId: string; role: Role }) =>
      usersApi.update(nationalId, { role }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['user', selectedUserId] }),
      ])
    },
  })

  const bulkImportMutation = useMutation({
    mutationFn: (file: File) => usersApi.bulkImport(file),
    onSuccess: (result) => {
      setBulkResult(result)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      setBulkError(error.message || 'Error al importar.')
    },
  })

  const assignSubjectsMutation = useMutation({
    mutationFn: async (payload: { teacherId: string; subjectIds: number[] }) => {
      const unique = Array.from(new Set(payload.subjectIds))
      await Promise.all(
        unique.map((subjectId) =>
          teacherSubjectsApi.create({ teacherId: payload.teacherId, subjectId }),
        ),
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] }),
        queryClient.invalidateQueries({ queryKey: ['area-teacher-subjects'] }),
      ])
    },
  })

  const assignSubjectMutation = useMutation({
    mutationFn: teacherSubjectsApi.create,
    onSuccess: async () => {
      setIsAssignOpen(false)
      setSelectedSubjectId('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] }),
        queryClient.invalidateQueries({ queryKey: ['area-teacher-subjects'] }),
      ])
    },
  })

  const removeSubjectMutation = useMutation({
    mutationFn: teacherSubjectsApi.remove,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] }),
        queryClient.invalidateQueries({ queryKey: ['area-teacher-subjects'] }),
      ])
    },
  })

  useEffect(() => {
    const state = location.state as { userId?: string } | null
    if (state?.userId) {
      setSelectedUserId(state.userId)
    }
  }, [location.state])

  useEffect(() => {
    if (!selectedUser) {
      return
    }
    setDraftRole(selectedUser.role)
  }, [selectedUser])

  if (!user || (user.role !== 'admin' && user.role !== 'coordinator')) {
    return (
      <Alert severity="error">
        Solo administradores y coordinadores pueden gestionar usuarios.
      </Alert>
    )
  }

  const handleOpenCreate = () => {
    const defaultRole =
      createRoles.find((role) => role.value === selectedRole)?.value ?? createRoles[0]?.value ?? 'teacher'
    setDraftUser({ ...emptyUser, role: defaultRole, password: '' })
    setSelectedAreas([])
    setSelectedCreateSubjectIds([])
    setAreaError('')
    setIsCreateOpen(true)
  }

  const handleOpenBulk = () => {
    setBulkFile(null)
    setBulkResult(null)
    setBulkError('')
    setIsBulkOpen(true)
  }

  const handleCloseBulk = () => {
    if (bulkImportMutation.isPending) {
      return
    }
    setIsBulkOpen(false)
    setBulkFile(null)
    setBulkResult(null)
    setBulkError('')
  }

  const handleBulkSubmit = () => {
    if (!bulkFile) {
      setBulkError('Selecciona un archivo CSV o Excel.')
      return
    }
    setBulkError('')
    bulkImportMutation.mutate(bulkFile)
  }

  const handleAreaChange = (value: number[]) => {
    if (value.length > 3) {
      setAreaError('Máximo 3 áreas por profesor')
      return
    }
    setAreaError('')
    setSelectedAreas(value)
    setSelectedCreateSubjectIds((previous) =>
      previous.filter((subjectId) =>
        value.some((areaId) =>
          (areasById.get(areaId)?.subjects ?? []).some((subject) => subject.subjectId === subjectId),
        ),
      ),
    )
  }

  const toggleCreateSubject = (subjectId: number) => {
    setSelectedCreateSubjectIds((previous) =>
      previous.includes(subjectId)
        ? previous.filter((item) => item !== subjectId)
        : [...previous, subjectId],
    )
  }

  const handleCreateUser = async () => {
    if (
      !draftUser.nationalId.trim() ||
      !draftUser.firstName?.trim() ||
      !draftUser.lastName?.trim() ||
      !tempPassword ||
      !draftUser.email?.trim()
    ) {
      return
    }

    const payload: CreateUserPayload = {
      nationalId: draftUser.nationalId.trim(),
      password: tempPassword,
      role: draftUser.role,
      username: draftUser.username?.trim() || undefined,
      firstName: draftUser.firstName?.trim() || undefined,
      lastName: draftUser.lastName?.trim() || undefined,
      email: draftUser.email.trim(),
      phone: draftUser.phone?.trim() || undefined,
    }

    await createMutation.mutateAsync(payload)

    if (payload.role === 'teacher') {
      if (selectedCreateSubjectIds.length > 0) {
        await assignSubjectsMutation.mutateAsync({
          teacherId: payload.nationalId,
          subjectIds: selectedCreateSubjectIds,
        })
      }
    }
  }

  const areaSelectionRequired = draftUser.role === 'teacher'
  const areaIsValid = !areaSelectionRequired || selectedAreas.length > 0
  const subjectSelectionRequired = draftUser.role === 'teacher'
  const subjectsAreValid = !subjectSelectionRequired || selectedCreateSubjectIds.length > 0
  const selectedCreateAreaObjects = useMemo(
    () => areas.filter((area) => selectedAreas.includes(area.areaId)),
    [areas, selectedAreas],
  )
  const assignAreaOptions = useMemo(() => {
    const areaIds = new Set(
      availableSubjects
        .map((subject) => subject.areaId)
        .filter((areaId): areaId is number => typeof areaId === 'number'),
    )
    return areas
      .filter((area) => areaIds.has(area.areaId))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }, [areas, availableSubjects])
  const assignableSubjects = useMemo(() => {
    if (selectedAssignAreaId === '') {
      return availableSubjects
    }
    return availableSubjects.filter((subject) => subject.areaId === selectedAssignAreaId)
  }, [availableSubjects, selectedAssignAreaId])

  if (selectedUserId) {
    return (
      <Box display="flex" flexDirection="column" gap={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="text" onClick={() => setSelectedUserId(null)}>
            ← Volver
          </Button>
          <Box>
            <Typography variant="h5">Perfil de usuario</Typography>
            <Typography variant="body2" color="text.secondary">
              Consulta datos de acceso, rol, asignaturas y cursos asociados.
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {user?.role === 'admin' || user?.role === 'coordinator' ? (
            <Button color="error" variant="outlined" onClick={() => setIsDeleteOpen(true)}>
              Eliminar usuario
            </Button>
          ) : null}
        </Stack>

        {isLoadingSelectedUser ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : null}
        {isSelectedUserError ? (
          <Alert severity="error">
            {selectedUserError?.message || 'Error cargando usuario.'}
          </Alert>
        ) : null}

        {selectedUser ? (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h4">
                {selectedUser.firstName ?? ''} {selectedUser.lastName ?? ''}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Documento: {selectedUser.nationalId} · Usuario: {selectedUser.username}
              </Typography>
              <Typography variant="body1">
                Rol: {roleLabel(selectedUser.role)} · Contacto: {selectedUser.email ?? 'Sin correo'} ·{' '}
                {selectedUser.phone ?? 'Sin teléfono'}
              </Typography>

              {user.role === 'admin' ? (
                <>
                  <Divider />
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                  >
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                      <InputLabel id="change-role-label">Cambiar rol</InputLabel>
                      <Select
                        labelId="change-role-label"
                        label="Cambiar rol"
                        value={draftRole}
                        onChange={(event) => setDraftRole(event.target.value as Role)}
                      >
                        {allRoleOptions.map((role) => (
                          <MenuItem key={role.value} value={role.value}>
                            {role.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (!selectedUserId || draftRole === selectedUser.role) {
                          return
                        }
                        updateRoleMutation.mutate({ nationalId: selectedUserId, role: draftRole })
                      }}
                      disabled={draftRole === selectedUser.role || updateRoleMutation.isPending}
                    >
                      {updateRoleMutation.isPending ? 'Guardando rol...' : 'Guardar rol'}
                    </Button>
                  </Stack>
                  {updateRoleMutation.isError ? (
                    <Alert severity="error">
                      {updateRoleMutation.error instanceof Error
                        ? updateRoleMutation.error.message
                        : 'No se pudo actualizar el rol.'}
                    </Alert>
                  ) : null}
                </>
              ) : null}

              {selectedUser.role === 'teacher' ? (
                <>
                  <Divider />

                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2">Asignaturas habilitadas</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedAssignAreaId('')
                          setSelectedSubjectId('')
                          setIsAssignOpen(true)
                        }}
                        disabled={availableSubjects.length === 0}
                      >
                        Agregar asignatura
                      </Button>
                    </Stack>

                    {isLoadingTeacherSubjects ? (
                      <CircularProgress size={20} />
                    ) : isTeacherSubjectsError ? (
                      <Alert severity="error">
                        {teacherSubjectsError?.message || 'Error cargando asignaturas.'}
                      </Alert>
                    ) : (teacherSubjects ?? []).length > 0 ? (
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {(teacherSubjects ?? []).map((item) => (
                          <Chip
                            key={item.teacherSubjectId}
                            label={item.subject?.name ?? `Asignatura ${item.subjectId}`}
                            onDelete={() => removeSubjectMutation.mutate(item.teacherSubjectId)}
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sin asignaturas habilitadas.
                      </Typography>
                    )}
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Grupos asignados</Typography>
                    {isLoadingCourses ? (
                      <CircularProgress size={20} />
                    ) : isCoursesError ? (
                      <Alert severity="error">
                        {coursesError?.message || 'Error cargando cursos.'}
                      </Alert>
                    ) : homerooms.length > 0 ? (
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {homerooms.map((group) => (
                          <Chip key={group} color="primary" variant="outlined" label={group} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sin grupos principales asignados.
                      </Typography>
                    )}
                  </Stack>
                </>
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        <Dialog open={isAssignOpen} onClose={() => setIsAssignOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Asignar asignatura</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="assign-area-select-label">Área</InputLabel>
                <Select
                  labelId="assign-area-select-label"
                  label="Área"
                  value={selectedAssignAreaId}
                  onChange={(event) => {
                    const value = event.target.value as string | number
                    const nextAreaId = value === '' ? '' : Number(value)
                    setSelectedAssignAreaId(nextAreaId)
                    setSelectedSubjectId('')
                  }}
                >
                <MenuItem value="">Todas las áreas</MenuItem>
                {assignAreaOptions.map((area) => (
                  <MenuItem key={area.areaId} value={area.areaId}>
                    {area.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="subject-select-label">Asignatura</InputLabel>
              <Select
                labelId="subject-select-label"
                label="Asignatura"
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(Number(event.target.value))}
              >
                {assignableSubjects.map((subject) => (
                  <MenuItem key={subject.subjectId} value={subject.subjectId}>
                    {subject.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsAssignOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={() => {
                if (!selectedUserId || selectedSubjectId === '') {
                  return
                }
                assignSubjectMutation.mutate({
                  teacherId: selectedUserId,
                  subjectId: Number(selectedSubjectId),
                })
              }}
              disabled={selectedSubjectId === '' || assignSubjectMutation.isPending}
            >
              Guardar
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Eliminar usuario</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Esta acción eliminará el usuario seleccionado. ¿Deseas continuar?
            </Typography>
            {deleteMutation.isError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : 'No se pudo eliminar el usuario.'}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                if (!selectedUserId) {
                  return
                }
                deleteMutation.mutate(selectedUserId)
              }}
              disabled={deleteMutation.isPending}
            >
              Eliminar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Box>
          <Typography variant="h5">Usuarios</Typography>
          <Typography variant="body2" color="text.secondary">
            Administra cuentas, roles, docentes importados y asignaciones académicas asociadas a cada usuario.
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={handleOpenBulk}>
          Importar docentes
        </Button>
        <Button variant="contained" onClick={handleOpenCreate}>
          Crear usuario
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <TextField
          label="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Documento o nombre"
          sx={{ maxWidth: 320 }}
        />
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="role-select-label">Rol</InputLabel>
          <Select
            labelId="role-select-label"
            label="Rol"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as RoleValue)}
          >
            {roles.map((role) => (
              <MenuItem key={role.value} value={role.value}>
                {role.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : null}
      {isError ? (
        <Alert severity="error">{error?.message || 'Error cargando usuarios.'}</Alert>
      ) : null}

      {filteredUsers.length === 0 && !isLoading ? (
        <Alert severity="info">No hay usuarios registrados para este rol.</Alert>
      ) : null}

      {filteredUsers.length > 0 ? (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
          {filteredUsers.map((entry: User) => (
            <ListItemButton
              key={entry.nationalId}
              divider
              onClick={() => setSelectedUserId(entry.nationalId)}
            >
              <Stack spacing={0.5} sx={{ width: '100%' }}>
                <Typography variant="subtitle1">
                  {entry.firstName ?? ''} {entry.lastName ?? ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Documento: {entry.nationalId} · Usuario: {entry.username}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={entry.role} />
                  <Typography variant="caption">{entry.isActive ? 'Activo' : 'Inactivo'}</Typography>
                </Stack>
              </Stack>
            </ListItemButton>
          ))}
        </List>
      ) : null}

      <Dialog open={isBulkOpen} onClose={handleCloseBulk} fullWidth maxWidth="sm">
        <DialogTitle>Importar docentes</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Archivo CSV o Excel (.xlsx) con columnas: documento, nombres, apellidos, correo. Opcional: usuario, teléfono.
          </Typography>
          <Button variant="outlined" component="label">
            Seleccionar archivo
            <input
              hidden
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setBulkFile(file)
                setBulkResult(null)
                setBulkError('')
              }}
            />
          </Button>
          {bulkFile ? (
            <Typography variant="body2">Archivo seleccionado: {bulkFile.name}</Typography>
          ) : null}
          {bulkError ? <Alert severity="error">{bulkError}</Alert> : null}
          {bulkImportMutation.isPending ? (
            <Box display="flex" alignItems="center" gap={2}>
              <CircularProgress size={20} />
              <Typography variant="body2">Importando...</Typography>
            </Box>
          ) : null}
          {bulkResult ? (
            <Box display="flex" flexDirection="column" gap={2}>
              <Alert severity="success">
                Importación completa. Creados: {bulkResult.created} · Omitidos: {bulkResult.skipped} · Total filas: {bulkResult.total}
              </Alert>
              {bulkResult.credentials.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Credenciales temporales
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      {bulkResult.credentials.map((cred) => (
                        <Typography key={cred.nationalId} variant="body2">
                          {cred.nationalId} · {cred.username} · {cred.tempPassword}
                        </Typography>
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              ) : null}
              {bulkResult.errors.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Errores encontrados
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      {bulkResult.errors.map((item, index) => (
                        <Typography key={`${item.row}-${index}`} variant="body2" color="error">
                          Fila {item.row}: {item.message}
                        </Typography>
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBulk}>Cerrar</Button>
          <Button
            variant="contained"
            onClick={handleBulkSubmit}
            disabled={!bulkFile || bulkImportMutation.isPending}
          >
            Importar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuevo usuario</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Registra una cuenta con rol y datos de contacto. Para docentes, selecciona áreas y asignaturas habilitadas.
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="new-role-label">Rol</InputLabel>
            <Select
              labelId="new-role-label"
              label="Rol"
              value={draftUser.role}
              onChange={(event) =>
                setDraftUser((prev) => ({ ...prev, role: event.target.value as CreateUserPayload['role'] }))
              }
            >
              {createRoles.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Documento"
            value={draftUser.nationalId}
            onChange={(event) => setDraftUser((prev) => ({ ...prev, nationalId: event.target.value }))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nombres"
              value={draftUser.firstName ?? ''}
              onChange={(event) => setDraftUser((prev) => ({ ...prev, firstName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Apellidos"
              value={draftUser.lastName ?? ''}
              onChange={(event) => setDraftUser((prev) => ({ ...prev, lastName: event.target.value }))}
              fullWidth
            />
          </Stack>

          <TextField
            label="Contraseña temporal"
            type="text"
            value={tempPassword}
            InputProps={{ readOnly: true }}
            helperText="Contraseña temporal = primer apellido + 4 últimos dígitos del documento (ej: Medina9335)"
          />

          <TextField
            label="Usuario (opcional)"
            value={draftUser.username ?? ''}
            onChange={(event) => setDraftUser((prev) => ({ ...prev, username: event.target.value }))}
          />
          <TextField
            label="Correo"
            value={draftUser.email ?? ''}
            onChange={(event) => setDraftUser((prev) => ({ ...prev, email: event.target.value }))}
            required
            type="email"
            error={!emailIsValid}
            helperText={!emailIsValid ? 'Obligatorio para pruebas.' : ''}
          />
          <TextField
            label="Teléfono (opcional)"
            value={draftUser.phone ?? ''}
            onChange={(event) => setDraftUser((prev) => ({ ...prev, phone: event.target.value }))}
          />

          {draftUser.role === 'teacher' ? (
            <Stack spacing={1}>
              {isLoadingAreas ? (
                <Typography variant="body2" color="text.secondary">
                  Cargando áreas...
                </Typography>
              ) : null}
              {isAreasError ? (
                <Alert severity="error">
                  {areasError instanceof Error ? areasError.message : 'Error cargando áreas.'}
                </Alert>
              ) : null}
              {!isLoadingAreas && !isAreasError && areas.length === 0 ? (
                <Alert severity="warning">
                  No hay áreas registradas. Crea una en la pestaña Áreas antes de asignar profesores.
                </Alert>
              ) : null}
              <FormControl fullWidth>
                <InputLabel id="areas-label">Áreas (máx. 3)</InputLabel>
                <Select
                  labelId="areas-label"
                  label="Áreas (máx. 3)"
                  multiple
                  value={selectedAreas}
                  onChange={(event) => handleAreaChange(event.target.value as number[])}
                  renderValue={(selected) =>
                    areas
                      .filter((area) => selected.includes(area.areaId))
                      .map((area) => area.name)
                      .join(', ')
                  }
                  disabled={isLoadingAreas || areas.length === 0}
                >
                  {areas.length === 0 ? (
                    <MenuItem disabled>No hay áreas disponibles</MenuItem>
                  ) : (
                    areas.map((area) => (
                      <MenuItem key={area.areaId} value={area.areaId}>
                        {area.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
                {areaError ? (
                  <Typography color="error" variant="caption">
                    {areaError}
                  </Typography>
                ) : null}
              </FormControl>
              {selectedCreateAreaObjects.length > 0 ? (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Asignaturas habilitadas</Typography>
                  {selectedCreateAreaObjects.map((area) => (
                    <Paper key={area.areaId} variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {area.name}
                        </Typography>
                        {(area.subjects ?? []).length > 0 ? (
                          <Stack spacing={0.5}>
                            {(area.subjects ?? []).map((subject) => (
                              <ListItemButton
                                key={subject.subjectId}
                                onClick={() => toggleCreateSubject(subject.subjectId)}
                                sx={{ borderRadius: 1, px: 1 }}
                              >
                                <Checkbox
                                  edge="start"
                                  checked={selectedCreateSubjectIds.includes(subject.subjectId)}
                                  tabIndex={-1}
                                  disableRipple
                                />
                                <Typography variant="body2">{subject.name}</Typography>
                              </ListItemButton>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Esta área no tiene asignaturas registradas.
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                  {!subjectsAreValid ? (
                    <Typography color="error" variant="caption">
                      Selecciona al menos una asignatura para el profesor.
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          ) : null}

          {createMutation.isError ? (
            <Alert severity="error">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'No se pudo crear el usuario.'}
            </Alert>
          ) : null}
          {assignSubjectsMutation.isError ? (
            <Alert severity="warning">
              {assignSubjectsMutation.error instanceof Error
                ? assignSubjectsMutation.error.message
                : 'Usuario creado, pero no se pudieron asignar las áreas.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={
              !draftUser.nationalId.trim() ||
              !draftUser.firstName?.trim() ||
              !draftUser.lastName?.trim() ||
              !tempPassword ||
              !emailIsValid ||
              !areaIsValid ||
              !subjectsAreValid ||
              createMutation.isPending
            }
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UsersPage

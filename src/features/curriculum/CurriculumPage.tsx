import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
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
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { curriculaApi, type CreateCurriculumItemPayload } from '../../api/curriculaApi'
import { subjectsApi, type Subject } from '../../api/subjectsApi'
import { useAuth } from '../auth/AuthContext'

const gradeLevels = Array.from({ length: 11 }, (_, index) => index + 1)

export const CurriculumPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedGrade, setSelectedGrade] = useState<number>(10)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftActive, setDraftActive] = useState(true)
  const [draftItems, setDraftItems] = useState<CreateCurriculumItemPayload[]>([])

  const { data: curricula, isLoading, isError, error } = useQuery({
    queryKey: ['curricula'],
    queryFn: () => curriculaApi.list(),
  })

  const { data: subjectsResult, isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['subjects', 'all'],
    queryFn: () => subjectsApi.list({ pageSize: 500 }),
  })

  const subjects = subjectsResult?.data ?? []

  const selectedCurriculum = useMemo(
    () => curricula?.find((item) => item.gradeLevel === selectedGrade) ?? null,
    [curricula, selectedGrade],
  )

  const createMutation = useMutation({
    mutationFn: curriculaApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curricula'] })
      setIsDialogOpen(false)
    },
  })

  const handleOpenDialog = () => {
    setDraftName(`Currículo grado ${selectedGrade}`)
    setDraftActive(true)
    setDraftItems([])
    setIsDialogOpen(true)
  }

  const handleAddItem = () => {
    if (subjects.length === 0) {
      return
    }

    const selectedIds = new Set(draftItems.map((item) => item.subjectId))
    const nextSubject = subjects.find((subject) => !selectedIds.has(subject.subjectId))

    setDraftItems((prev) => [
      ...prev,
      {
        subjectId: nextSubject?.subjectId ?? subjects[0].subjectId,
        weeklyHours: 0,
        doubleSessionRequired: false,
        notes: '',
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleUpdateItem = (index: number, patch: Partial<CreateCurriculumItemPayload>) => {
    setDraftItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    )
  }

  const handleCreate = () => {
    if (!draftName.trim() || draftItems.length === 0) {
      return
    }

    createMutation.mutate({
      gradeLevel: selectedGrade,
      name: draftName.trim(),
      isActive: draftActive,
      items: draftItems.map((item) => ({
        subjectId: item.subjectId,
        weeklyHours: item.weeklyHours ?? 0,
        doubleSessionRequired: item.doubleSessionRequired ?? false,
        notes: item.notes?.trim() || undefined,
      })),
    })
  }

  const canCreate = draftName.trim().length > 0 && draftItems.length > 0

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} gap={1}>
        <Typography variant="h4">Currículo</Typography>
        <Typography color="text.secondary">
          Configura las asignaturas por grado y define sesiones dobles.
        </Typography>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : null}

      {isError ? (
        <Alert severity="error">{error?.message || 'No se pudo cargar el currículo.'}</Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Grados
          </Typography>
          <List dense>
            {gradeLevels.map((grade) => {
              const curriculum = curricula?.find((item) => item.gradeLevel === grade)
              return (
                <ListItemButton
                  key={grade}
                  selected={grade === selectedGrade}
                  onClick={() => setSelectedGrade(grade)}
                >
                  <ListItemText
                    primary={`Grado ${grade}`}
                    secondary={
                      curriculum
                        ? `${curriculum.items?.length ?? 0} asignaturas`
                        : 'Sin currículo'
                    }
                  />
                </ListItemButton>
              )
            })}
          </List>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box>
              <Typography variant="h5">Grado {selectedGrade}</Typography>
              <Typography color="text.secondary">
                {selectedCurriculum ? selectedCurriculum.name : 'Sin currículo configurado'}
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {user?.role === 'admin' ? (
              <Button variant="contained" onClick={handleOpenDialog} startIcon={<AddIcon />}>
                Crear currículo
              </Button>
            ) : null}
          </Stack>

          <Divider sx={{ my: 2 }} />

          {!selectedCurriculum ? (
            <Alert severity="info">
              Este grado aún no tiene currículo. Crea uno para empezar a planear asignaturas.
            </Alert>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                  color={selectedCurriculum.isActive ? 'success' : 'default'}
                  label={selectedCurriculum.isActive ? 'Activo' : 'Inactivo'}
                />
                <Typography variant="body2" color="text.secondary">
                  {selectedCurriculum.items?.length ?? 0} asignaturas
                </Typography>
              </Stack>

              {selectedCurriculum.items?.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Asignatura</TableCell>
                        <TableCell>Horas/semana</TableCell>
                        <TableCell>Doble sesión</TableCell>
                        <TableCell>Notas</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCurriculum.items.map((item) => (
                        <TableRow key={item.curriculumItemId} hover>
                          <TableCell>
                            {item.subject?.name ?? `Asignatura ${item.subjectId}`}
                          </TableCell>
                          <TableCell>{item.weeklyHours}</TableCell>
                          <TableCell>{item.doubleSessionRequired ? 'Sí' : 'No'}</TableCell>
                          <TableCell>{item.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="warning">
                  Este currículo no tiene asignaturas registradas.
                </Alert>
              )}
            </Stack>
          )}
        </Paper>
      </Box>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nuevo currículo</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Grado" value={selectedGrade} disabled />
          <TextField
            label="Nombre del currículo"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <FormControlLabel
            control={<Switch checked={draftActive} onChange={(event) => setDraftActive(event.target.checked)} />}
            label="Activo"
          />

          <Divider />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Asignaturas</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              disabled={subjects.length === 0}
            >
              Agregar asignatura
            </Button>
          </Stack>

          {isLoadingSubjects ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={20} />
            </Box>
          ) : null}

          {draftItems.length === 0 ? (
            <Alert severity="info">
              Agrega al menos una asignatura para crear el currículo.
            </Alert>
          ) : null}

          <Stack spacing={2}>
            {draftItems.map((item, index) => {
              const selectedIds = new Set(draftItems.map((entry) => entry.subjectId))
              const options = subjects.filter((subject) =>
                subject.subjectId === item.subjectId || !selectedIds.has(subject.subjectId),
              )

              return (
                <Paper key={`${item.subjectId}-${index}`} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id={`subject-label-${index}`}>Asignatura</InputLabel>
                      <Select
                        labelId={`subject-label-${index}`}
                        label="Asignatura"
                        value={item.subjectId}
                        onChange={(event) =>
                          handleUpdateItem(index, { subjectId: Number(event.target.value) })
                        }
                      >
                        {options.map((subject: Subject) => (
                          <MenuItem key={subject.subjectId} value={subject.subjectId}>
                            {subject.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <TextField
                        label="Horas/semana"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={item.weeklyHours ?? 0}
                        onChange={(event) =>
                          handleUpdateItem(index, { weeklyHours: Number(event.target.value) })
                        }
                        sx={{ maxWidth: 160 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(item.doubleSessionRequired)}
                            onChange={(event) =>
                              handleUpdateItem(index, { doubleSessionRequired: event.target.checked })
                            }
                          />
                        }
                        label="Requiere doble sesión"
                      />
                      <Box sx={{ flexGrow: 1 }} />
                      <Button
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleRemoveItem(index)}
                      >
                        Quitar
                      </Button>
                    </Stack>

                    <TextField
                      label="Notas"
                      value={item.notes ?? ''}
                      onChange={(event) => handleUpdateItem(index, { notes: event.target.value })}
                    />
                  </Stack>
                </Paper>
              )
            })}
          </Stack>

          {createMutation.isError ? (
            <Alert severity="error">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'No se pudo crear el currículo.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!canCreate || createMutation.isPending}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CurriculumPage

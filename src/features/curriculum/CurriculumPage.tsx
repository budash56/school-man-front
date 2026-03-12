import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
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
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
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
import { ExpandLess, ExpandMore } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { curriculumItemsApi } from '../../api/curriculumItemsApi'
import { curriculaApi, type CreateCurriculumItemPayload } from '../../api/curriculaApi'
import { subjectAreasApi, type SubjectArea } from '../../api/subjectAreasApi'
import { type Subject } from '../../api/subjectsApi'
import { useAuth } from '../auth/AuthContext'

type GradeSelection = {
  gradeLevel: number
  trackName: string | null
}

type EditableCurriculumItem = {
  curriculumItemId: number
  subjectId: number
  subjectName: string
  weeklyHours: number
  doubleSessionRequired: boolean
  notes: string
}

export const CurriculumPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManageCurriculum = user?.role === 'admin' || user?.role === 'coordinator'

  if (user?.role === 'teacher') {
    return <Alert severity="info">El currículo no está disponible para docentes.</Alert>
  }

  const [selectedGrade, setSelectedGrade] = useState<GradeSelection>({ gradeLevel: 10, trackName: null })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSpecializationOpen, setIsSpecializationOpen] = useState(false)
  const [isLinkAreaOpen, setIsLinkAreaOpen] = useState(false)
  const [linkAreaId, setLinkAreaId] = useState<number | null>(null)
  const [isPrimaryOpen, setIsPrimaryOpen] = useState(false)
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(false)
  const [isSeniorOpen, setIsSeniorOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftTrackName, setDraftTrackName] = useState('')
  const [draftActive, setDraftActive] = useState(true)
  const [draftItems, setDraftItems] = useState<CreateCurriculumItemPayload[]>([])
  const [draftSpecializationAreaId, setDraftSpecializationAreaId] = useState<number | null>(null)
  const [specializationAreaId, setSpecializationAreaId] = useState<number | null>(null)
  const [specializationName, setSpecializationName] = useState('')
  const [editItems, setEditItems] = useState<EditableCurriculumItem[]>([])
  const [editNewItems, setEditNewItems] = useState<CreateCurriculumItemPayload[]>([])
  const [removedItemIds, setRemovedItemIds] = useState<number[]>([])
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const { data: curricula, isLoading, isError, error } = useQuery({
    queryKey: ['curricula'],
    queryFn: () => curriculaApi.list(),
  })

  const { data: subjectAreasResult, isLoading: isLoadingSubjects } = useQuery({
    queryKey: ['subject-areas', 'all'],
    queryFn: () => subjectAreasApi.list({ pageSize: 100, includeSubjects: true }),
  })

  const subjectAreas = subjectAreasResult?.data ?? []
  const subjects = useMemo(() => {
    if (!subjectAreas.length) {
      return []
    }
    const map = new Map<number, Subject>()
    subjectAreas.forEach((area) => {
      area.subjects?.forEach((subject) => {
        map.set(subject.subjectId, subject)
      })
    })
    return Array.from(map.values())
  }, [subjectAreas])
  const toNumber = (value: number | string | null | undefined) =>
    value === null || value === undefined ? null : Number(value)
  const specializationAreas = useMemo(
    () => subjectAreas.filter((area) => area.isSpecialization),
    [subjectAreas],
  )
  const usedSpecializationAreaIds = useMemo(() => {
    const used = new Set<number>()
    ;(curricula ?? []).forEach((curriculum) => {
      if (curriculum.trackName && curriculum.specializationAreaId) {
        const areaId = toNumber(curriculum.specializationAreaId)
        if (areaId !== null) {
          used.add(areaId)
        }
      }
    })
    return used
  }, [curricula])
  const availableSpecializationAreas = useMemo(
    () =>
      specializationAreas.filter((area) => {
        const areaId = toNumber(area.areaId)
        return areaId !== null && !usedSpecializationAreaIds.has(areaId)
      }),
    [specializationAreas, usedSpecializationAreaIds],
  )
  const hasSpecializationAreas = specializationAreas.length > 0
  const hasAvailableSpecializationAreas = availableSpecializationAreas.length > 0
  const specializationAreaIds = useMemo(
    () =>
      new Set(
        specializationAreas
          .map((area) => toNumber(area.areaId))
          .filter((areaId): areaId is number => areaId !== null),
      ),
    [specializationAreas],
  )
  const subjectAreaBySubjectId = useMemo(() => {
    const map = new Map<number, number>()
    subjectAreas.forEach((area) => {
      area.subjects?.forEach((subject) => {
        const subjectId = toNumber(subject.subjectId)
        const areaId = toNumber(area.areaId)
        if (subjectId !== null && areaId !== null) {
          map.set(subjectId, areaId)
        }
      })
    })
    return map
  }, [subjectAreas])

  const resolveSubjectAreaId = (subject: Subject) =>
    toNumber(subject.areaId) ?? subjectAreaBySubjectId.get(Number(subject.subjectId)) ?? null

  const isSpecializationSubject = (subject: Subject) => {
    const areaId = resolveSubjectAreaId(subject)
    return areaId ? specializationAreaIds.has(areaId) : false
  }

  const getVisibleItemsForCurriculum = (curriculum: typeof selectedCurriculum) => {
    if (!curriculum?.items?.length) {
      return []
    }
    if (curriculum.trackName) {
      return curriculum.items
    }
    if (specializationAreaIds.size === 0) {
      return curriculum.items
    }
    const specializationId = curriculum.specializationAreaId
      ? Number(curriculum.specializationAreaId)
      : null
    if (curriculum.trackName && specializationId === null) {
      return curriculum.items
    }
    return curriculum.items.filter((item) => {
      const areaId = subjectAreaBySubjectId.get(Number(item.subjectId)) ?? null
      if (!areaId) {
        return true
      }
      if (!specializationAreaIds.has(areaId)) {
        return true
      }
      if (!curriculum.trackName) {
        return false
      }
      return specializationId !== null && areaId === specializationId
    })
  }

  const specializationGrades = useMemo(
    () => (curricula ?? []).filter((item) => item.trackName),
    [curricula],
  )
  const sortedSpecializations = useMemo(() => {
    return [...specializationGrades].sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) {
        return a.gradeLevel - b.gradeLevel
      }
      return (a.trackName ?? '').localeCompare(b.trackName ?? '')
    })
  }, [specializationGrades])
  const specializationGroups = useMemo(() => {
    const groups = new Map<string, typeof specializationGrades>()
    sortedSpecializations.forEach((curriculum) => {
      const key = curriculum.trackName ?? 'Especialización'
      const list = groups.get(key) ?? []
      list.push(curriculum)
      groups.set(key, list)
    })
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sortedSpecializations, specializationGrades])

  const selectedCurriculum = useMemo(() => {
    const trackName = selectedGrade.trackName ?? null
    return (
      curricula?.find(
        (item) =>
          item.gradeLevel === selectedGrade.gradeLevel &&
          (item.trackName ?? null) === trackName,
      ) ?? null
    )
  }, [curricula, selectedGrade])

  const selectedSpecializationArea = useMemo(() => {
    const specializationId = toNumber(selectedCurriculum?.specializationAreaId)
    if (specializationId === null && !selectedCurriculum?.specializationArea) {
      return null
    }
    const fromList =
      specializationId !== null
        ? subjectAreas.find((area) => toNumber(area.areaId) === specializationId) ?? null
        : null
    return fromList ?? selectedCurriculum?.specializationArea ?? null
  }, [selectedCurriculum, subjectAreas])

  const visibleCurriculumItems = useMemo(() => {
    return getVisibleItemsForCurriculum(selectedCurriculum)
  }, [selectedCurriculum, specializationAreaIds, subjectAreaBySubjectId])

  const draftSpecializationArea = useMemo(() => {
    if (!draftSpecializationAreaId) {
      return null
    }
    return (
      subjectAreas.find((area) => toNumber(area.areaId) === draftSpecializationAreaId) ?? null
    )
  }, [draftSpecializationAreaId, subjectAreas])

  const filterSubjectsForSpecialization = (areaId: number | null) => {
    if (specializationAreaIds.size === 0) {
      return subjects
    }
    return subjects.filter((subject) => {
      const resolvedAreaId = resolveSubjectAreaId(subject)
      if (!resolvedAreaId) {
        return true
      }
      if (!specializationAreaIds.has(resolvedAreaId)) {
        return true
      }
      return areaId !== null && resolvedAreaId === areaId
    })
  }

  const filterSubjectsForBase = () => {
    if (specializationAreaIds.size === 0) {
      return subjects
    }
    return subjects.filter((subject) => !isSpecializationSubject(subject))
  }

  const availableSubjectsForDraft = useMemo(() => {
    if (!selectedGrade.trackName) {
      return filterSubjectsForBase()
    }
    return filterSubjectsForSpecialization(draftSpecializationAreaId)
  }, [
    draftSpecializationAreaId,
    selectedGrade.trackName,
    subjects,
    specializationAreaIds,
    subjectAreaBySubjectId,
  ])

  const availableSubjectsForEdit = useMemo(() => {
    if (!selectedCurriculum?.trackName) {
      return filterSubjectsForBase()
    }
    const specializationId = toNumber(selectedCurriculum.specializationAreaId)
    return filterSubjectsForSpecialization(specializationId)
  }, [selectedCurriculum, subjects, specializationAreaIds, subjectAreaBySubjectId])

  const selectedTotalHours = useMemo(() => {
    if (!visibleCurriculumItems.length) {
      return 0
    }
    return visibleCurriculumItems.reduce((total, item) => total + (item.weeklyHours ?? 0), 0)
  }, [visibleCurriculumItems])

  const selectedGradeLabel = selectedGrade.trackName
    ? `Grado ${selectedGrade.gradeLevel} · ${selectedGrade.trackName}`
    : `Grado ${selectedGrade.gradeLevel}`

  const renderGradeItem = (grade: number) => {
    const curriculum = curricula?.find((item) => item.gradeLevel === grade && !item.trackName)
    const visibleCount = curriculum ? getVisibleItemsForCurriculum(curriculum).length : 0
    return (
      <ListItemButton
        key={grade}
        selected={grade === selectedGrade.gradeLevel && !selectedGrade.trackName}
        onClick={() => setSelectedGrade({ gradeLevel: grade, trackName: null })}
        sx={{ pl: 3 }}
      >
        <ListItemText
          primary={`Grado ${grade}`}
          secondary={curriculum ? `${visibleCount} asignaturas` : 'Sin currículo'}
        />
      </ListItemButton>
    )
  }

  const createMutation = useMutation({
    mutationFn: curriculaApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curricula'] })
      setIsDialogOpen(false)
    },
  })

  const linkAreaMutation = useMutation({
    mutationFn: ({
      curriculumId,
      specializationAreaId,
    }: {
      curriculumId: number
      specializationAreaId: number
    }) => curriculaApi.linkSpecializationArea(curriculumId, specializationAreaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curricula'] })
      setIsLinkAreaOpen(false)
      setLinkAreaId(null)
    },
  })

  const handleOpenDialog = () => {
    if (selectedGrade.trackName) {
      setDraftName(`${selectedGrade.trackName} ${selectedGrade.gradeLevel}`)
    } else {
      setDraftName(`Currículo grado ${selectedGrade.gradeLevel}`)
    }
    setDraftTrackName(selectedGrade.trackName ?? '')
    setDraftActive(true)
    setDraftItems([])
    setDraftSpecializationAreaId(null)
    setIsDialogOpen(true)
  }

  const handleCreateSpecialization = () => {
    const trackName = specializationName.trim()
    if (!trackName) {
      return
    }
    const existing = curricula?.find(
      (item) =>
        item.gradeLevel === 10 &&
        (item.trackName ?? null) === trackName,
    )
    if (existing) {
      setSelectedGrade({ gradeLevel: existing.gradeLevel, trackName })
      setSpecializationName('')
      setIsSpecializationOpen(false)
      return
    }
    if (!specializationAreaId) {
      return
    }
    setSelectedGrade({ gradeLevel: 10, trackName })
    setDraftName(`${trackName} 10`)
    setDraftTrackName(trackName)
    setDraftActive(true)
    setDraftItems([])
    setDraftSpecializationAreaId(specializationAreaId)
    setSpecializationName('')
    setIsSpecializationOpen(false)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = () => {
    if (!selectedCurriculum) {
      return
    }
    setEditItems(
      selectedCurriculum.items.map((item) => ({
        curriculumItemId: Number(item.curriculumItemId),
        subjectId: Number(item.subjectId),
        subjectName: item.subject?.name ?? `Asignatura ${item.subjectId}`,
        weeklyHours: item.weeklyHours,
        doubleSessionRequired: item.doubleSessionRequired,
        notes: item.notes ?? '',
      })),
    )
    setEditNewItems([])
    setRemovedItemIds([])
    setEditError('')
    setIsEditOpen(true)
  }

  const handleOpenLinkArea = () => {
    if (!selectedCurriculum?.trackName) {
      return
    }
    const currentAreaId = toNumber(selectedSpecializationArea?.areaId)
    const fallbackAreaId = toNumber(specializationAreas[0]?.areaId)
    setLinkAreaId(currentAreaId ?? fallbackAreaId)
    setIsLinkAreaOpen(true)
  }

  const handleAddItem = () => {
    if (availableSubjectsForDraft.length === 0) {
      return
    }

    const selectedIds = new Set(draftItems.map((item) => item.subjectId))
    const nextSubject = availableSubjectsForDraft.find(
      (subject) => !selectedIds.has(subject.subjectId),
    )

    setDraftItems((prev) => [
      ...prev,
      {
        subjectId: nextSubject?.subjectId ?? availableSubjectsForDraft[0].subjectId,
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

  const handleAddEditItem = () => {
    if (!selectedCurriculum || availableSubjectsForEdit.length === 0) {
      return
    }
    const selectedIds = new Set([
      ...editItems.map((item) => item.subjectId),
      ...editNewItems.map((item) => item.subjectId),
    ])
    const nextSubject = availableSubjectsForEdit.find(
      (subject) => !selectedIds.has(subject.subjectId),
    )
    if (!nextSubject) {
      return
    }
    setEditNewItems((prev) => [
      ...prev,
      {
        subjectId: nextSubject.subjectId,
        weeklyHours: 0,
        doubleSessionRequired: false,
        notes: '',
      },
    ])
  }

  const handleEditNewItemUpdate = (
    index: number,
    patch: Partial<CreateCurriculumItemPayload>,
  ) => {
    setEditNewItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    )
  }

  const handleEditNewItemRemove = (index: number) => {
    setEditNewItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleEditHoursChange = (curriculumItemId: number, value: number) => {
    const nextValue = Number.isFinite(value) ? Math.max(0, value) : 0
    setEditItems((prev) =>
      prev.map((item) =>
        item.curriculumItemId === curriculumItemId
          ? { ...item, weeklyHours: nextValue }
          : item,
      ),
    )
  }

  const handleEditDoubleSessionChange = (curriculumItemId: number, value: boolean) => {
    setEditItems((prev) =>
      prev.map((item) =>
        item.curriculumItemId === curriculumItemId
          ? { ...item, doubleSessionRequired: value }
          : item,
      ),
    )
  }

  const handleEditRemove = (curriculumItemId: number) => {
    setEditItems((prev) =>
      prev.filter((item) => item.curriculumItemId !== curriculumItemId),
    )
    setRemovedItemIds((prev) =>
      prev.includes(curriculumItemId) ? prev : [...prev, curriculumItemId],
    )
  }

  const handleSaveEdit = async () => {
    if (!selectedCurriculum) {
      return
    }

    const existingSubjectIds = new Set(editItems.map((item) => item.subjectId))
    const newSubjectIds = editNewItems.map((item) => item.subjectId)
    if (new Set(newSubjectIds).size !== newSubjectIds.length) {
      setEditError('Hay asignaturas repetidas en las nuevas adiciones.')
      return
    }
    if (newSubjectIds.some((id) => existingSubjectIds.has(id))) {
      setEditError('Una o más asignaturas ya existen en el currículo.')
      return
    }

    setIsSavingEdit(true)
    setEditError('')
    try {
      const originalMap = new Map(
        selectedCurriculum.items.map((item) => [Number(item.curriculumItemId), item]),
      )
      const updateRequests = editItems
        .map((item) => {
          const original = originalMap.get(item.curriculumItemId)
          if (!original) {
            return null
          }
          if (
            item.weeklyHours !== original.weeklyHours ||
            item.doubleSessionRequired !== original.doubleSessionRequired
          ) {
            return curriculumItemsApi.update(item.curriculumItemId, {
              weeklyHours: item.weeklyHours,
              doubleSessionRequired: item.doubleSessionRequired,
            })
          }
          return null
        })
        .filter(Boolean) as Promise<unknown>[]

      const deleteRequests = removedItemIds.map((id) => curriculumItemsApi.remove(id))

      const createRequests = editNewItems.map((item) =>
        curriculumItemsApi.create({
          curriculumId: selectedCurriculum.curriculumId,
          subjectId: item.subjectId,
          weeklyHours: item.weeklyHours ?? 0,
          doubleSessionRequired: item.doubleSessionRequired ?? false,
          notes: item.notes?.trim() || undefined,
        }),
      )

      await Promise.all([...updateRequests, ...deleteRequests])
      await Promise.all(createRequests)
      await queryClient.invalidateQueries({ queryKey: ['curricula'] })
      setIsEditOpen(false)
      setEditNewItems([])
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : 'No se pudieron guardar los cambios del currículo.',
      )
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleCreate = () => {
    if (!draftName.trim() || draftItems.length === 0) {
      return
    }

    const trackName = draftTrackName.trim()
    createMutation.mutate({
      gradeLevel: selectedGrade.gradeLevel,
      trackName: trackName.length > 0 ? trackName : undefined,
      specializationAreaId:
        trackName.length > 0 && draftSpecializationAreaId
          ? draftSpecializationAreaId
          : undefined,
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

  const requiresTrack = Boolean(selectedGrade.trackName)
  const canCreate =
    draftName.trim().length > 0 &&
    draftItems.length > 0 &&
    (!requiresTrack ||
      (draftTrackName.trim().length > 0 && Boolean(draftSpecializationAreaId)))

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
            <ListItemButton onClick={() => setIsPrimaryOpen((prev) => !prev)}>
              <ListItemText primary="Primaria" secondary="Grados 1° a 5°" />
              {isPrimaryOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={isPrimaryOpen} timeout="auto" unmountOnExit>
              <List dense disablePadding>
                {[1, 2, 3, 4, 5].map((grade) => renderGradeItem(grade))}
              </List>
            </Collapse>

            <ListItemButton onClick={() => setIsSecondaryOpen((prev) => !prev)}>
              <ListItemText primary="Secundaria" secondary="Grados 6° a 9°" />
              {isSecondaryOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={isSecondaryOpen} timeout="auto" unmountOnExit>
              <List dense disablePadding>
                {[6, 7, 8, 9].map((grade) => renderGradeItem(grade))}
              </List>
            </Collapse>

            <ListItemButton onClick={() => setIsSeniorOpen((prev) => !prev)}>
              <ListItemText primary="Senior" secondary="Grados 10° y 11°" />
              {isSeniorOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={isSeniorOpen} timeout="auto" unmountOnExit>
              <List dense disablePadding>
                {[10, 11].map((grade) => renderGradeItem(grade))}
                <Divider sx={{ my: 1 }} />
                {specializationGroups.length > 0 ? (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ px: 3 }}>
                      Especializaciones
                    </Typography>
                    {specializationGroups.map(([trackName, group]) => (
                      <Box key={trackName} sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ px: 3 }}>
                          {trackName}
                        </Typography>
                        {group.map((specialization) => (
                          <ListItemButton
                            key={specialization.curriculumId}
                            selected={
                              selectedGrade.gradeLevel === specialization.gradeLevel &&
                              selectedGrade.trackName === (specialization.trackName ?? null)
                            }
                            onClick={() =>
                              setSelectedGrade({
                                gradeLevel: specialization.gradeLevel,
                                trackName: specialization.trackName ?? null,
                              })
                            }
                            sx={{ pl: 5 }}
                          >
                            <ListItemText
                              primary={`Grado ${specialization.gradeLevel}`}
                              secondary={`${getVisibleItemsForCurriculum(specialization).length} asignaturas`}
                            />
                          </ListItemButton>
                        ))}
                      </Box>
                    ))}
                  </>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ px: 3 }}>
                    Sin especializaciones registradas.
                  </Typography>
                )}
              </List>
            </Collapse>
          </List>
          {canManageCurriculum ? (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSpecializationAreaId(toNumber(availableSpecializationAreas[0]?.areaId))
                setIsSpecializationOpen(true)
              }}
              sx={{ mt: 2 }}
            >
              Nueva especialización
            </Button>
          ) : null}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box>
              <Typography variant="h5">{selectedGradeLabel}</Typography>
              <Typography color="text.secondary">
                {selectedCurriculum ? selectedCurriculum.name : 'Sin currículo configurado'}
              </Typography>
              {selectedCurriculum?.trackName ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Área de especialización:{' '}
                    {selectedSpecializationArea?.name ??
                      (selectedCurriculum?.specializationAreaId
                        ? 'Área vinculada'
                        : 'Sin vincular')}
                  </Typography>
                  {canManageCurriculum ? (
                    <Button size="small" variant="outlined" onClick={handleOpenLinkArea}>
                      {selectedSpecializationArea ? 'Cambiar área' : 'Vincular área'}
                    </Button>
                  ) : null}
                </Stack>
              ) : null}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            {canManageCurriculum ? (
              selectedCurriculum ? (
                <Button variant="outlined" onClick={handleOpenEdit}>
                  Editar currículo
                </Button>
              ) : (
                <Button variant="contained" onClick={handleOpenDialog} startIcon={<AddIcon />}>
                  Crear currículo
                </Button>
              )
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
                  {visibleCurriculumItems.length} asignaturas · {selectedTotalHours} horas/semana
                </Typography>
              </Stack>

              {visibleCurriculumItems.length ? (
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
                      {visibleCurriculumItems.map((item) => (
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

      <Dialog open={isLinkAreaOpen} onClose={() => setIsLinkAreaOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Vincular área de especialización</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Selecciona el área que corresponde a esta especialización.
          </Typography>
          {specializationAreas.length > 0 ? (
            <FormControl fullWidth>
              <InputLabel id="link-area-label">Área de especialización</InputLabel>
              <Select
                labelId="link-area-label"
                label="Área de especialización"
                value={linkAreaId ?? ''}
                onChange={(event) => setLinkAreaId(Number(event.target.value))}
              >
                {specializationAreas.map((area: SubjectArea) => {
                  const areaId = toNumber(area.areaId)
                  if (areaId === null) {
                    return null
                  }
                  return (
                    <MenuItem key={area.areaId} value={areaId}>
                      {area.name}
                    </MenuItem>
                  )
                })}
              </Select>
            </FormControl>
          ) : (
            <Alert severity="info">
              Necesitas crear un área marcada como especialización antes de vincular el currículo.
            </Alert>
          )}
          {specializationAreas.length === 0 ? (
            <Button
              variant="outlined"
              onClick={() => {
                setIsLinkAreaOpen(false)
                navigate('/dashboard/subjects')
              }}
            >
              Crear área de especialización
            </Button>
          ) : null}
          {linkAreaMutation.isError ? (
            <Alert severity="error">
              {linkAreaMutation.error instanceof Error
                ? linkAreaMutation.error.message
                : 'No se pudo vincular el área.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsLinkAreaOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedCurriculum || !linkAreaId) {
                return
              }
              linkAreaMutation.mutate({
                curriculumId: selectedCurriculum.curriculumId,
                specializationAreaId: linkAreaId,
              })
            }}
            disabled={!selectedCurriculum || !linkAreaId || linkAreaMutation.isPending}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isSpecializationOpen} onClose={() => setIsSpecializationOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva especialización</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Las especializaciones se crean para 10° y se extienden automáticamente a 11°.
          </Typography>
          <TextField label="Grado base" value="Grado 10 (se extiende a 11)" disabled />
          {hasAvailableSpecializationAreas ? (
            <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {availableSpecializationAreas.map((area: SubjectArea) => {
                const areaId = toNumber(area.areaId)
                return (
                  <ListItemButton
                    key={area.areaId}
                    selected={areaId !== null && specializationAreaId === areaId}
                    onClick={() => {
                      if (areaId !== null) {
                        setSpecializationAreaId(areaId)
                      }
                    }}
                    disabled={areaId === null}
                  >
                    <ListItemIcon>
                      <Radio
                        edge="start"
                        checked={areaId !== null && specializationAreaId === areaId}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={area.name}
                      secondary="Disponible"
                    />
                  </ListItemButton>
                )
              })}
            </List>
          ) : hasSpecializationAreas ? (
            <Alert severity="info">
              Todas las áreas de especialización ya están asignadas. Crea una nueva área para continuar.
            </Alert>
          ) : (
            <Alert severity="info">
              Necesitas crear un área marcada como especialización antes de crear el currículo.
              Usa el botón “Crear área” en la vista de Áreas para marcarla como especialización.
            </Alert>
          )}
          {!hasAvailableSpecializationAreas ? (
            <Button
              variant="outlined"
              onClick={() => {
                setIsSpecializationOpen(false)
                navigate('/dashboard/subjects')
              }}
            >
              Crear área de especialización
            </Button>
          ) : null}
          <TextField
            label="Nombre de la especialización"
            value={specializationName}
            onChange={(event) => setSpecializationName(event.target.value)}
            placeholder="Ej. Industrial, Ciencias, Informática"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSpecializationOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCreateSpecialization}
            disabled={!specializationName.trim() || !specializationAreaId}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nuevo currículo</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Grado" value={selectedGradeLabel} disabled />
          {selectedGrade.trackName ? (
            <TextField
              label="Especialización"
              value={draftTrackName}
              onChange={(event) => setDraftTrackName(event.target.value)}
            />
          ) : null}
          {selectedGrade.trackName ? (
            <TextField
              label="Área de especialización"
              value={draftSpecializationArea?.name ?? 'Sin área vinculada'}
              disabled
            />
          ) : null}
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
              const options = availableSubjectsForDraft.filter((subject) =>
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
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            disabled={availableSubjectsForDraft.length === 0}
          >
            Agregar asignatura
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={!canCreate || createMutation.isPending}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Editar currículo</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Grado" value={selectedGradeLabel} disabled />
          <Typography color="text.secondary">
            Ajusta las horas por semana o elimina asignaturas del currículo.
          </Typography>

          <Divider />

          {editItems.length === 0 ? (
            <Alert severity="warning">
              Este currículo no tiene asignaturas. Agrega asignaturas abajo.
            </Alert>
          ) : null}

          <Stack spacing={2}>
            {editItems.map((item) => (
              <Paper key={item.curriculumItemId} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">{item.subjectName}</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <TextField
                      label="Horas/semana"
                      type="number"
                      inputProps={{ min: 0 }}
                      value={item.weeklyHours}
                      onChange={(event) =>
                        handleEditHoursChange(item.curriculumItemId, Number(event.target.value))
                      }
                      sx={{ maxWidth: 160 }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(item.doubleSessionRequired)}
                          onChange={(event) =>
                            handleEditDoubleSessionChange(
                              item.curriculumItemId,
                              event.target.checked,
                            )
                          }
                        />
                      }
                      label="Requiere doble sesión"
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleEditRemove(item.curriculumItemId)}
                    >
                      Quitar
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Divider />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Agregar asignaturas</Typography>
          </Stack>

          {editNewItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No hay nuevas asignaturas pendientes.
            </Typography>
          ) : null}

          <Stack spacing={2}>
            {editNewItems.map((item, index) => {
              const selectedIds = new Set(editNewItems.map((entry) => entry.subjectId))
              const options = availableSubjectsForEdit.filter((subject) => {
                if (subject.subjectId === item.subjectId) {
                  return true
                }
                const existsInCurriculum = editItems.some(
                  (existing) => existing.subjectId === subject.subjectId,
                )
                return !existsInCurriculum && !selectedIds.has(subject.subjectId)
              })

              return (
                <Paper key={`${item.subjectId}-${index}`} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id={`edit-subject-label-${index}`}>Asignatura</InputLabel>
                      <Select
                        labelId={`edit-subject-label-${index}`}
                        label="Asignatura"
                        value={item.subjectId}
                        onChange={(event) =>
                          handleEditNewItemUpdate(index, {
                            subjectId: Number(event.target.value),
                          })
                        }
                      >
                        {options.map((subject: Subject) => (
                          <MenuItem key={subject.subjectId} value={subject.subjectId}>
                            {subject.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                    >
                      <TextField
                        label="Horas/semana"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={item.weeklyHours ?? 0}
                        onChange={(event) =>
                          handleEditNewItemUpdate(index, {
                            weeklyHours: Number(event.target.value),
                          })
                        }
                        sx={{ maxWidth: 160 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(item.doubleSessionRequired)}
                            onChange={(event) =>
                              handleEditNewItemUpdate(index, {
                                doubleSessionRequired: event.target.checked,
                              })
                            }
                          />
                        }
                        label="Requiere doble sesión"
                      />
                      <Box sx={{ flexGrow: 1 }} />
                      <Button
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleEditNewItemRemove(index)}
                      >
                        Quitar
                      </Button>
                    </Stack>

                    <TextField
                      label="Notas"
                      value={item.notes ?? ''}
                      onChange={(event) =>
                        handleEditNewItemUpdate(index, { notes: event.target.value })
                      }
                    />
                  </Stack>
                </Paper>
              )
            })}
          </Stack>

          {editError ? <Alert severity="error">{editError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditOpen(false)}>Cancelar</Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddEditItem}
            disabled={
              availableSubjectsForEdit.length === 0 ||
              editItems.length + editNewItems.length >= availableSubjectsForEdit.length
            }
          >
            Agregar asignatura
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={isSavingEdit}
          >
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CurriculumPage

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subjectAreasApi, type SubjectArea } from '../../api/subjectAreasApi'
import { useAuth } from '../auth/AuthContext'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import {
  planillasApi,
  type FinalizePlanillaResult,
  type PlanillaRow,
  type PlanillaSheet,
} from '../../api/planillasApi'

type MetadataDraft = {
  subjectName: string
  teacherName: string
  periodLabel: string
  specializationName: string
  specializationAreaId: number | null
}

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

const isSpecializationGrade = (gradeLevel: number | undefined) =>
  gradeLevel === 10 || gradeLevel === 11

const sanitizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9_]/g, '')

const normalizeInput = (value: string) => {
  if (!value) {
    return ''
  }
  return typeof value.normalize === 'function' ? value.normalize('NFD') : value
}

const buildCodeFromName = (value: string, minLength: number) => {
  const normalized = normalizeInput(value)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()

  if (!normalized) {
    return ''
  }

  const parts = normalized.split(/\s+/).filter(Boolean)
  let code = parts.map((part) => part[0]).join('')

  if (code.length < minLength && parts.length > 0) {
    const first = parts[0]
    code += first.slice(1, minLength - code.length + 1)
  }

  const cleaned = sanitizeCode(code)

  if (cleaned.length < minLength) {
    return ''
  }

  return cleaned
}

const generateAreaCode = (value: string) => buildCodeFromName(value, 2).slice(0, 16)

const buildMetadataDraft = (planilla: PlanillaSheet | undefined): MetadataDraft => ({
  subjectName: String(planilla?.metadata?.subjectName ?? ''),
  teacherName: String(planilla?.metadata?.teacherName ?? ''),
  periodLabel: String(planilla?.metadata?.periodLabel ?? ''),
  specializationName: String(planilla?.metadata?.specializationName ?? ''),
  specializationAreaId: toOptionalNumber(planilla?.metadata?.specializationAreaId),
})

const normalizeDigits = (value: string) => value.replace(/\D+/g, '')

const buildMetadataPayload = (
  draftMetadata: MetadataDraft,
  planilla: PlanillaSheet | null,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    subjectName: draftMetadata.subjectName,
    teacherName: draftMetadata.teacherName,
    periodLabel: draftMetadata.periodLabel,
  }

  if (!planilla || !isSpecializationGrade(planilla.gradeLevel)) {
    return payload
  }

  payload.hasSpecialization = draftMetadata.specializationAreaId !== null
  payload.specializationName =
    draftMetadata.specializationAreaId !== null
      ? draftMetadata.specializationName.trim() || null
      : null
  payload.specializationAreaId = draftMetadata.specializationAreaId

  return payload
}

const buildSummary = (rows: PlanillaRow[]) => {
  return rows.reduce(
    (accumulator, row) => {
      accumulator.total += 1
      if (row.retired) {
        accumulator.retired += 1
      } else if (row.status === 'resolved') {
        accumulator.resolved += 1
      } else {
        accumulator.pending += 1
      }
      return accumulator
    },
    { total: 0, resolved: 0, pending: 0, retired: 0 },
  )
}

type BulkFinalizeSummary = {
  finalizedSheets: number
  resolved: number
  retired: number
  unresolved: string[]
  failedGroups: string[]
}

const PlanillasPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canImport = user?.role === 'admin' || user?.role === 'coordinator'
  const canManageSpecializations = canImport
  const canFinalize = canImport
  const canEditRoster = canImport

  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | ''>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<number | ''>('')
  const [selectedPlanillaId, setSelectedPlanillaId] = useState<number | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftMetadata, setDraftMetadata] = useState<MetadataDraft>({
    subjectName: '',
    teacherName: '',
    periodLabel: '',
    specializationName: '',
    specializationAreaId: null,
  })
  const [draftRows, setDraftRows] = useState<PlanillaRow[]>([])
  const [createdSpecializationAreas, setCreatedSpecializationAreas] = useState<SubjectArea[]>([])
  const [newSpecializationName, setNewSpecializationName] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [pageMessage, setPageMessage] = useState<string | null>(null)
  const [finalizeResult, setFinalizeResult] = useState<BulkFinalizeSummary | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [currentDocumentRowId, setCurrentDocumentRowId] = useState<string | null>(null)

  const {
    data: schoolYears,
    isLoading: isLoadingYears,
    isError: isSchoolYearError,
    error: schoolYearError,
  } = useSchoolYearsQuery()

  useEffect(() => {
    if (!schoolYears || schoolYears.length === 0) {
      return
    }

    if (selectedSchoolYearId === '') {
      const activeYear = schoolYears.find((schoolYear) => schoolYear.isActive) ?? schoolYears[0]
      setSelectedSchoolYearId(activeYear?.schoolYearId ?? '')
    }
  }, [schoolYears, selectedSchoolYearId])

  const {
    data: planillasResult,
    isLoading: isLoadingPlanillas,
    isError: isPlanillasError,
    error: planillasError,
  } = useQuery({
    queryKey: ['planillas', selectedSchoolYearId, groupSearch, user?.nationalId, user?.role],
    queryFn: () =>
      planillasApi.list({
        schoolYearId: selectedSchoolYearId === '' ? undefined : selectedSchoolYearId,
        groupCode: groupSearch.trim() || undefined,
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(selectedSchoolYearId),
  })

  const planillas = planillasResult?.data ?? []

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(planillas.map((planilla) => planilla.gradeLevel)))
        .sort((left, right) => left - right),
    [planillas],
  )

  const planillasByGrade = useMemo(() => {
    return planillas.reduce<Record<number, PlanillaSheet[]>>((accumulator, planilla) => {
      if (!accumulator[planilla.gradeLevel]) {
        accumulator[planilla.gradeLevel] = []
      }
      accumulator[planilla.gradeLevel].push(planilla)
      return accumulator
    }, {})
  }, [planillas])

  const visiblePlanillas = useMemo(() => {
    if (selectedGradeLevel === '') {
      return planillas
    }
    return planillas.filter((planilla) => planilla.gradeLevel === selectedGradeLevel)
  }, [planillas, selectedGradeLevel])

  useEffect(() => {
    if (gradeOptions.length === 0) {
      setSelectedGradeLevel('')
      return
    }

    if (selectedGradeLevel === '' || !gradeOptions.includes(selectedGradeLevel)) {
      setSelectedGradeLevel(gradeOptions[0] ?? '')
    }
  }, [gradeOptions, selectedGradeLevel])

  useEffect(() => {
    if (visiblePlanillas.length === 0) {
      setSelectedPlanillaId(null)
      return
    }

    if (
      !selectedPlanillaId ||
      !visiblePlanillas.some((planilla) => planilla.planillaSheetId === selectedPlanillaId)
    ) {
      setSelectedPlanillaId(visiblePlanillas[0]?.planillaSheetId ?? null)
    }
  }, [selectedPlanillaId, visiblePlanillas])

  const {
    data: selectedPlanilla,
    isLoading: isLoadingSelectedPlanilla,
    isError: isSelectedPlanillaError,
    error: selectedPlanillaError,
  } = useQuery({
    queryKey: ['planilla', selectedPlanillaId],
    queryFn: () => planillasApi.getById(selectedPlanillaId as number),
    enabled: selectedPlanillaId !== null,
  })

  const {
    data: subjectAreasResult,
    error: subjectAreasError,
  } = useQuery({
    queryKey: ['subject-areas', 'planillas-specializations'],
    queryFn: () => subjectAreasApi.list({ pageSize: 100 }),
    enabled: Boolean(selectedPlanilla && isSpecializationGrade(selectedPlanilla.gradeLevel)),
  })

  useEffect(() => {
    if (!selectedPlanilla) {
      return
    }

    setDraftTitle(selectedPlanilla.title)
    setDraftMetadata(buildMetadataDraft(selectedPlanilla))
    setDraftRows(selectedPlanilla.rows)
    setNewSpecializationName(
      toOptionalNumber(selectedPlanilla.metadata?.specializationAreaId) === null
        ? String(selectedPlanilla.metadata?.specializationName ?? '')
        : '',
    )
    setIsDirty(false)
    setFinalizeResult(null)
    setPageMessage(null)
    setCurrentDocumentRowId(
      selectedPlanilla.rows.find((row) => !(row.nationalId ?? '').trim())?.rowId ?? null,
    )
  }, [selectedPlanilla])

  const specializationAreas = useMemo(() => {
    const merged = [...createdSpecializationAreas, ...((subjectAreasResult?.data ?? []).filter((area) => area.isSpecialization))]
    const uniqueAreas = new Map<number, SubjectArea>()
    merged.forEach((area) => {
      uniqueAreas.set(area.areaId, area)
    })
    return Array.from(uniqueAreas.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }, [createdSpecializationAreas, subjectAreasResult?.data])

  const selectedSpecializationArea = useMemo(
    () =>
      specializationAreas.find((area) => area.areaId === draftMetadata.specializationAreaId) ?? null,
    [draftMetadata.specializationAreaId, specializationAreas],
  )

  const pendingDocumentRows = useMemo(
    () => draftRows.filter((row) => !(row.nationalId ?? '').trim()),
    [draftRows],
  )
  const documentReviewRows = useMemo(
    () =>
      draftRows.filter(
        (row) => !(row.nationalId ?? '').trim() || row.rowId === currentDocumentRowId,
      ),
    [currentDocumentRowId, draftRows],
  )
  const currentDocumentIndex = useMemo(
    () =>
      currentDocumentRowId === null
        ? -1
        : documentReviewRows.findIndex((row) => row.rowId === currentDocumentRowId),
    [currentDocumentRowId, documentReviewRows],
  )
  const currentDocumentPosition =
    currentDocumentIndex >= 0 ? currentDocumentIndex : documentReviewRows.length > 0 ? 0 : -1
  const currentDocumentRow =
    currentDocumentPosition >= 0 ? documentReviewRows[currentDocumentPosition] ?? null : null

  useEffect(() => {
    if (draftRows.length === 0) {
      setCurrentDocumentRowId(null)
      return
    }

    const currentStillExists = currentDocumentRowId
      ? draftRows.some((row) => row.rowId === currentDocumentRowId)
      : false

    if (currentStillExists) {
      return
    }

    const firstPendingRow = draftRows.find((row) => !(row.nationalId ?? '').trim()) ?? null
    setCurrentDocumentRowId(firstPendingRow?.rowId ?? null)
  }, [currentDocumentRowId, draftRows])

  useEffect(() => {
    if (pendingDocumentRows.length === 0) {
      return
    }
    if (currentDocumentIndex >= 0) {
      return
    }
    const firstPendingRow = pendingDocumentRows[0]
    if (firstPendingRow) {
      setCurrentDocumentRowId(firstPendingRow.rowId)
    }
  }, [currentDocumentIndex, pendingDocumentRows])

  const goToPreviousDocumentRow = () => {
    if (currentDocumentPosition <= 0) {
      return
    }
    const previousRow = documentReviewRows[currentDocumentPosition - 1]
    if (previousRow) {
      setCurrentDocumentRowId(previousRow.rowId)
    }
  }

  const goToNextDocumentRow = () => {
    if (currentDocumentPosition < 0) {
      const firstRow = documentReviewRows[0]
      if (firstRow) {
        setCurrentDocumentRowId(firstRow.rowId)
      }
      return
    }
    const nextRow = documentReviewRows[currentDocumentPosition + 1]
    if (nextRow) {
      setCurrentDocumentRowId(nextRow.rowId)
    }
  }

  const importMutation = useMutation({
    mutationFn: () => {
      if (!importFile || selectedSchoolYearId === '') {
        throw new Error('Selecciona un año escolar y un archivo Excel.')
      }
      return planillasApi.import({
        schoolYearId: selectedSchoolYearId,
        replaceExisting,
        file: importFile,
      })
    },
    onSuccess: async (result) => {
      setImportSummary(
        `Importadas ${result.imported}, reemplazadas ${result.replaced}, omitidas ${result.skipped}.`,
      )
      setPageMessage(
        result.unmatchedGroups.length > 0
          ? `Grupos sin coincidencia: ${result.unmatchedGroups.join(', ')}`
          : 'Importación completada.',
      )
      setImportFile(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['planillas'] }),
        queryClient.invalidateQueries({ queryKey: ['class-groups'] }),
      ])
      const firstImportedSheet = result.sheets[0]
      if (firstImportedSheet) {
        setSelectedPlanillaId(firstImportedSheet.planillaSheetId)
      }
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo importar la planilla.')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlanillaId) {
        throw new Error('Selecciona una planilla para guardar.')
      }
      return planillasApi.update(selectedPlanillaId, {
        title: draftTitle.trim(),
        metadata: buildMetadataPayload(draftMetadata, activePlanilla),
        rows: draftRows,
      })
    },
    onSuccess: async (result) => {
      setDraftTitle(result.title)
      setDraftMetadata(buildMetadataDraft(result))
      setDraftRows(result.rows)
      setIsDirty(false)
      setPageMessage('Planilla guardada.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['planillas'] }),
        queryClient.invalidateQueries({ queryKey: ['planilla', selectedPlanillaId] }),
      ])
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo guardar la planilla.')
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (planillasForFinalize.length === 0) {
        throw new Error('No hay planillas cargadas para finalizar.')
      }
      if (isDirty) {
        if (!selectedPlanillaId) {
          throw new Error('Selecciona una planilla para guardar los cambios pendientes.')
        }
        await planillasApi.update(selectedPlanillaId, {
          title: draftTitle.trim(),
          metadata: buildMetadataPayload(draftMetadata, activePlanilla),
          rows: draftRows,
        })
      }

      if (finalizeEligiblePlanillas.length === 0) {
        throw new Error('No hay planillas con pendientes 0 para finalizar.')
      }

      const results: FinalizePlanillaResult[] = []
      const failedGroups: string[] = []

      for (const planilla of finalizeEligiblePlanillas) {
        try {
          const result = await planillasApi.finalize(planilla.planillaSheetId, {
            allowPartial: true,
          })
          results.push(result)
        } catch (error) {
          failedGroups.push(planilla.groupCode)
          console.error('Failed to finalize planilla', planilla.planillaSheetId, error)
        }
      }

      if (results.length === 0) {
        throw new Error(
          failedGroups.length > 0
            ? `No se pudo finalizar ninguna planilla. Fallaron: ${failedGroups.join(', ')}`
            : 'No se pudo finalizar ninguna planilla.',
        )
      }

      return {
        finalizedSheets: results.length,
        resolved: results.reduce((total, result) => total + result.resolved, 0),
        retired: results.reduce((total, result) => total + result.retired, 0),
        unresolved: results.flatMap((result) => result.unresolved),
        failedGroups,
      }
    },
    onSuccess: async (result) => {
      setFinalizeResult(result)
      setPageMessage(
        result.failedGroups.length > 0
          ? `Importación aplicada en ${result.finalizedSheets} planillas. Fallaron: ${result.failedGroups.join(', ')}.`
          : `Importación aplicada en ${result.finalizedSheets} planillas listas.`,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['planillas'] }),
        queryClient.invalidateQueries({ queryKey: ['planilla', selectedPlanillaId] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['class-groups'] }),
      ])
    },
    onError: (error) => {
      setPageMessage(error instanceof Error ? error.message : 'No se pudo finalizar la planilla.')
    },
  })

  const createSpecializationCode = generateAreaCode(newSpecializationName)

  const createSpecializationMutation = useMutation({
    mutationFn: () => {
      const name = newSpecializationName.trim()
      if (!name) {
        throw new Error('Escribe el nombre de la especialización.')
      }
      if (!createSpecializationCode) {
        throw new Error('No se pudo generar un código válido para la especialización.')
      }
      return subjectAreasApi.create({
        name,
        code: createSpecializationCode,
        isSpecialization: true,
      })
    },
    onSuccess: async (area) => {
      setCreatedSpecializationAreas((current) => {
        if (current.some((item) => item.areaId === area.areaId)) {
          return current
        }
        return [...current, area]
      })
      setDraftMetadata((current) => ({
        ...current,
        specializationAreaId: area.areaId,
        specializationName: area.name,
      }))
      setNewSpecializationName('')
      setIsDirty(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subject-areas', 'planillas-specializations'] }),
        queryClient.invalidateQueries({ queryKey: ['subject-areas', 'with-subjects'] }),
      ])
    },
  })

  const handleSpecializationAreaChange = (areaId: number | null) => {
    const linkedArea = specializationAreas.find((area) => area.areaId === areaId) ?? null
    setDraftMetadata((current) => ({
      ...current,
      specializationAreaId: areaId,
      specializationName: linkedArea?.name ?? '',
    }))
    setIsDirty(true)
  }

  const handleNationalIdChange = (rowId: string, value: string) => {
    const nationalId = normalizeDigits(value)
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              nationalId,
              status: row.retired ? 'retired' : nationalId ? 'resolved' : 'pending_id',
            }
          : row,
      ),
    )
    setIsDirty(true)
  }

  const loading = isLoadingYears || isLoadingPlanillas || (selectedPlanillaId !== null && isLoadingSelectedPlanilla)
  const activePlanilla = selectedPlanilla ?? null
  const specializationEnabled = Boolean(
    activePlanilla && isSpecializationGrade(activePlanilla.gradeLevel),
  )
  const planillasForFinalize = useMemo(() => {
    return planillas.map((planilla) => {
      if (planilla.planillaSheetId !== selectedPlanillaId || !activePlanilla) {
        return planilla
      }

      return {
        ...planilla,
        rows: draftRows,
      }
    })
  }, [activePlanilla, draftRows, planillas, selectedPlanillaId])
  const finalizeEligiblePlanillas = useMemo(
    () =>
      [...planillasForFinalize]
        .filter((planilla) => buildSummary(planilla.rows).pending === 0)
        .sort((left, right) => {
          if (left.gradeLevel !== right.gradeLevel) {
            return left.gradeLevel - right.gradeLevel
          }
          return left.groupCode.localeCompare(right.groupCode, 'es')
        }),
    [planillasForFinalize],
  )

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">Planillas</Typography>
        <Typography variant="body1" color="text.secondary">
          Importa el formato institucional desde Numbers, completa documentos pendientes y conserva una copia editable en línea.
        </Typography>
      </Stack>

      {pageMessage ? <Alert severity="info">{pageMessage}</Alert> : null}
      {importSummary ? <Alert severity="success">{importSummary}</Alert> : null}
      {finalizeResult ? (
        <Alert severity="success">
          Finalización: planillas {finalizeResult.finalizedSheets}, resueltos {finalizeResult.resolved}, retirados {finalizeResult.retired}, pendientes {finalizeResult.unresolved.length}
          {finalizeResult.failedGroups.length > 0
            ? `, fallidas ${finalizeResult.failedGroups.join(', ')}`
            : ''}.
        </Alert>
      ) : null}
      {isSchoolYearError ? (
        <Alert severity="error">
          {schoolYearError instanceof Error ? schoolYearError.message : 'No se pudieron cargar los años escolares.'}
        </Alert>
      ) : null}
      {isPlanillasError ? (
        <Alert severity="error">
          {planillasError instanceof Error ? planillasError.message : 'No se pudieron cargar las planillas.'}
        </Alert>
      ) : null}
      {isSelectedPlanillaError ? (
        <Alert severity="error">
          {selectedPlanillaError instanceof Error ? selectedPlanillaError.message : 'No se pudo cargar la planilla seleccionada.'}
        </Alert>
      ) : null}

      {canImport ? (
        <Paper sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Importar / reimportar</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="planillas-year-label">Año escolar</InputLabel>
                <Select
                  labelId="planillas-year-label"
                  label="Año escolar"
                  value={selectedSchoolYearId}
                  onChange={(event) => setSelectedSchoolYearId(event.target.value as number)}
                >
                  {(schoolYears ?? []).map((schoolYear) => (
                    <MenuItem key={schoolYear.schoolYearId} value={schoolYear.schoolYearId}>
                      {schoolYear.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" component="label">
                {importFile ? importFile.name : 'Seleccionar archivo Excel'}
                <input
                  hidden
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
              </Button>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={replaceExisting}
                    onChange={(event) => setReplaceExisting(event.target.checked)}
                  />
                }
                label="Reemplazar existentes"
              />
              <Button
                variant="contained"
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || !importFile || selectedSchoolYearId === ''}
              >
                {importMutation.isPending ? 'Importando...' : 'Importar planillas'}
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              La reimportación conserva cédulas y celdas editadas cuando el nombre del estudiante coincide.
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="planillas-filter-year-label">Año escolar</InputLabel>
              <Select
                labelId="planillas-filter-year-label"
                label="Año escolar"
                value={selectedSchoolYearId}
                onChange={(event) => setSelectedSchoolYearId(event.target.value as number)}
              >
                {(schoolYears ?? []).map((schoolYear) => (
                  <MenuItem key={schoolYear.schoolYearId} value={schoolYear.schoolYearId}>
                    {schoolYear.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Grupo"
              placeholder="901"
              value={groupSearch}
              onChange={(event) => setGroupSearch(normalizeDigits(event.target.value))}
              sx={{ maxWidth: 160 }}
            />
          </Stack>

          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress />
            </Stack>
          ) : planillas.length === 0 ? (
            <Alert severity="info">No hay planillas para los filtros seleccionados.</Alert>
          ) : (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                }}
              >
                {gradeOptions.map((gradeLevel) => (
                  <Paper
                    key={gradeLevel}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderColor: selectedGradeLevel === gradeLevel ? 'primary.main' : 'divider',
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">Grado {gradeLevel}</Typography>
                        <Chip
                          size="small"
                          color={selectedGradeLevel === gradeLevel ? 'primary' : 'default'}
                          label={`${(planillasByGrade[gradeLevel] ?? []).length} grupos`}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Selecciona el grupo para registrar documentos.
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {(planillasByGrade[gradeLevel] ?? []).map((planilla) => {
                          const cardSummary = buildSummary(planilla.rows)
                          const isSelected = planilla.planillaSheetId === selectedPlanillaId
                          return (
                            <Chip
                              key={planilla.planillaSheetId}
                              clickable
                              color={isSelected ? 'primary' : 'default'}
                              variant={isSelected ? 'filled' : 'outlined'}
                              label={`${planilla.groupCode} · Pend ${cardSummary.pending}`}
                              onClick={() => {
                                setSelectedGradeLevel(gradeLevel)
                                setSelectedPlanillaId(planilla.planillaSheetId)
                              }}
                            />
                          )
                        })}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>

              {activePlanilla && canEditRoster ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                      <Stack spacing={0.5}>
                        <Typography variant="h6">
                          Grado: {activePlanilla.gradeLevel} · Grupo: {activePlanilla.groupCode}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Registro inicial de documentos. Solo se solicita documento antes de guardar y finalizar.
                        </Typography>
                      </Stack>
                      <Chip
                        color={pendingDocumentRows.length > 0 ? 'warning' : 'success'}
                        label={
                          pendingDocumentRows.length > 0
                            ? `Pendientes ${pendingDocumentRows.length}`
                            : 'Todos los documentos completos'
                        }
                      />
                    </Stack>

                    {pendingDocumentRows.length > 0 && canFinalize ? (
                      <Alert severity="warning">
                        Faltan {pendingDocumentRows.length} documentos. Al finalizar, solo se importarán los estudiantes con documento completo.
                      </Alert>
                    ) : null}

                    {specializationEnabled ? (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            justifyContent="space-between"
                            spacing={2}
                          >
                            <Stack spacing={0.5}>
                              <Typography variant="h6">Especialización</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Para 10° y 11° selecciona la especialización del grupo o créala aquí mismo.
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip
                                label={
                                  selectedSpecializationArea
                                    ? `Área ${selectedSpecializationArea.name}`
                                    : 'Sin especialización'
                                }
                                color={selectedSpecializationArea ? 'primary' : 'default'}
                              />
                            </Stack>
                          </Stack>

                          {subjectAreasError instanceof Error ? (
                            <Alert severity="error">{subjectAreasError.message}</Alert>
                          ) : null}

                          {createSpecializationMutation.isError ? (
                            <Alert severity="error">
                              {createSpecializationMutation.error instanceof Error
                                ? createSpecializationMutation.error.message
                                : 'No se pudo crear la especialización.'}
                            </Alert>
                          ) : null}

                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                            <FormControl size="small" sx={{ minWidth: 260 }}>
                              <InputLabel id="planilla-specialization-area-label">
                                Especialización
                              </InputLabel>
                              <Select
                                labelId="planilla-specialization-area-label"
                                label="Especialización"
                                value={draftMetadata.specializationAreaId ?? ''}
                                onChange={(event) => {
                                  const rawValue = String(event.target.value)
                                  handleSpecializationAreaChange(
                                    rawValue === '' ? null : Number(rawValue),
                                  )
                                }}
                                disabled={!canEditRoster}
                              >
                                <MenuItem value="">Sin especialización</MenuItem>
                                {specializationAreas.map((area: SubjectArea) => (
                                  <MenuItem key={area.areaId} value={area.areaId}>
                                    {area.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            {canManageSpecializations ? (
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flex: 1 }}>
                                <TextField
                                  size="small"
                                  label="Nueva especialización"
                                  value={newSpecializationName}
                                  onChange={(event) => setNewSpecializationName(event.target.value)}
                                  placeholder="Ej. Sistemas"
                                  disabled={createSpecializationMutation.isPending}
                                  fullWidth
                                />
                                <Button
                                  variant="outlined"
                                  onClick={() => createSpecializationMutation.mutate()}
                                  disabled={
                                    createSpecializationMutation.isPending ||
                                    !newSpecializationName.trim() ||
                                    !createSpecializationCode
                                  }
                                >
                                  {createSpecializationMutation.isPending ? 'Creando...' : 'Crear'}
                                </Button>
                              </Stack>
                            ) : null}
                          </Stack>

                          <Typography variant="body2" color="text.secondary">
                            {specializationAreas.length > 0
                              ? 'Si no aparece en la lista, créala y quedará seleccionada de inmediato.'
                              : canManageSpecializations
                                ? 'Aún no hay especializaciones registradas. Crea la primera desde este formulario.'
                                : 'No hay especializaciones registradas. Un coordinador o administrador debe crearla primero.'}
                          </Typography>
                        </Stack>
                      </Paper>
                    ) : null}

                    {pendingDocumentRows.length === 0 || !currentDocumentRow ? (
                      <Alert severity="success">Esta planilla ya tiene todos los documentos diligenciados.</Alert>
                    ) : (
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Button
                            startIcon={<ArrowBackIosNewIcon />}
                            onClick={goToPreviousDocumentRow}
                            disabled={currentDocumentPosition <= 0}
                          >
                            Anterior
                          </Button>
                          <Typography variant="body2" color="text.secondary">
                            Estudiante {currentDocumentPosition + 1} de {documentReviewRows.length}
                          </Typography>
                          <Button
                            endIcon={<ArrowForwardIosIcon />}
                            onClick={goToNextDocumentRow}
                            disabled={currentDocumentPosition < 0 || currentDocumentPosition >= documentReviewRows.length - 1}
                          >
                            Siguiente
                          </Button>
                        </Stack>

                        <Card variant="outlined">
                          <CardContent>
                            <Stack spacing={2}>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={`Grupo ${activePlanilla.groupCode}`} />
                                {currentDocumentRow.retired ? <Chip color="warning" label="RET" /> : null}
                              </Stack>
                              <Typography variant="h6">{currentDocumentRow.studentName}</Typography>
                              <TextField
                                label="Documento"
                                value={currentDocumentRow.nationalId ?? ''}
                                onChange={(event) => handleNationalIdChange(currentDocumentRow.rowId, event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    goToNextDocumentRow()
                                  }
                                }}
                                inputProps={{ inputMode: 'numeric' }}
                                autoFocus
                                sx={{ maxWidth: 260 }}
                              />
                              <Typography variant="body2" color="text.secondary">
                                {currentDocumentRow.note ?? 'Sin observaciones'}
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Stack>
                    )}

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ xs: 'stretch', md: 'center' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Los estudiantes con RET se crearán o actualizarán como inactivos al finalizar la importación.
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="contained"
                          onClick={() => saveMutation.mutate()}
                          disabled={!canEditRoster || !isDirty || saveMutation.isPending}
                        >
                          {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                        {canFinalize ? (
                          <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => finalizeMutation.mutate()}
                            disabled={
                              finalizeMutation.isPending || finalizeEligiblePlanillas.length === 0
                            }
                          >
                            {finalizeMutation.isPending
                              ? 'Aplicando...'
                              : finalizeEligiblePlanillas.length > 1
                                ? `Finalizar listas (${finalizeEligiblePlanillas.length})`
                                : 'Finalizar importación'}
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          )}
        </Stack>
      </Paper>

      {!activePlanilla && !loading ? (
        <Alert severity="info">Selecciona una planilla para revisar el detalle.</Alert>
      ) : null}
    </Stack>
  )
}

export default PlanillasPage

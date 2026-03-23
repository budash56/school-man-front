import { memo, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subjectAreasApi, type SubjectArea } from '../../api/subjectAreasApi'
import { termsApi, type Term } from '../../api/termsApi'
import { useAuth } from '../auth/AuthContext'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import {
  planillasApi,
  type FinalizePlanillaResult,
  type PlanillaRow,
  type PlanillaSheet,
  type PlanillaSheetSummary,
  type PlanillaSummary,
} from '../../api/planillasApi'

type MetadataDraft = {
  subjectName: string
  teacherName: string
  periodLabel: string
  specializationName: string
  specializationAreaId: number | null
}

type ProfessorPeriodState = {
  editable: boolean
  label: string
  color: 'default' | 'success' | 'warning'
  helperText: string
}

type ProfessorPeriodColumn = {
  key: string
  label: string
  shortLabel: string
}

type ProfessorPeriodDefinition = {
  period: number
  columns: ProfessorPeriodColumn[]
}

type ProfessorVisibleColumn = ProfessorPeriodColumn & {
  period: number
  editable: boolean
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

const PROFESSOR_PERIODS: ProfessorPeriodDefinition[] = [
  {
    period: 1,
    columns: [
      { key: 'cog_1', label: 'Cognitivo', shortLabel: 'Cog.' },
      { key: 'proc_1', label: 'Procedimental', shortLabel: 'Proc.' },
      { key: 'act_1', label: 'Actitudinal', shortLabel: 'Act.' },
    ],
  },
  {
    period: 2,
    columns: [
      { key: 'cog_2', label: 'Cognitivo', shortLabel: 'Cog.' },
      { key: 'proc_2', label: 'Procedimental', shortLabel: 'Proc.' },
      { key: 'act_2', label: 'Actitudinal', shortLabel: 'Act.' },
    ],
  },
  {
    period: 3,
    columns: [
      { key: 'cog_3', label: 'Cognitivo', shortLabel: 'Cog.' },
      { key: 'proc_3', label: 'Procedimental', shortLabel: 'Proc.' },
      { key: 'act_3', label: 'Actitudinal', shortLabel: 'Act.' },
    ],
  },
  {
    period: 4,
    columns: [
      { key: 'cog_4', label: 'Cognitivo', shortLabel: 'Cog.' },
      { key: 'proc_4', label: 'Procedimental', shortLabel: 'Proc.' },
      { key: 'act_4', label: 'Actitudinal', shortLabel: 'Act.' },
    ],
  },
]

const PROFESSOR_GRADE_CELL_KEYS = new Set(
  PROFESSOR_PERIODS.flatMap(({ columns }) => columns.map((column) => column.key)),
)

const normalizeLetterMark = (value: string) => {
  const normalized = value.trim().toUpperCase()
  return ['S', 'A', 'B', 'J'].includes(normalized) ? normalized : ''
}

const LETTER_MARK_OPTIONS = ['', 'S', 'A', 'B', 'J'] as const
const RANDOM_LETTER_MARKS = ['S', 'A', 'B', 'J'] as const
const RANDOM_NATIONAL_ID_MIN = 100_000_000
const RANDOM_NATIONAL_ID_RANGE = 900_000_000

const professorGradeSelectBaseStyle: CSSProperties = {
  width: '100%',
  minWidth: '72px',
  padding: '6px 8px',
  borderRadius: '8px',
  border: '1px solid var(--planilla-grade-cell-border)',
  backgroundColor: 'var(--planilla-grade-cell-bg)',
  color: 'var(--planilla-grade-cell-text)',
  font: 'inherit',
  textAlign: 'center',
  textTransform: 'uppercase',
  colorScheme: 'var(--planilla-grade-cell-color-scheme)',
}

const professorGradeSelectDisabledStyle: CSSProperties = {
  ...professorGradeSelectBaseStyle,
  backgroundColor: 'var(--planilla-grade-cell-bg-disabled)',
  color: 'var(--planilla-grade-cell-text)',
}

type ProfessorGridRowProps = {
  row: PlanillaRow
  columns: ProfessorVisibleColumn[]
  onCellChange: (rowId: string, key: string, value: string) => void
}

const ProfessorGridRow = memo(
  function ProfessorGridRow({ row, columns, onCellChange }: ProfessorGridRowProps) {
    return (
      <TableRow hover>
        <TableCell>
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.studentName}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {row.retired ? <Chip size="small" color="warning" label="RET" /> : null}
              {row.note ? (
                <Typography variant="caption" color="text.secondary">
                  {row.note}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </TableCell>
        {columns.map((column) => (
          <TableCell key={`${row.rowId}-${column.key}`} align="center" sx={{ p: 0.75 }}>
            <select
              aria-label={`${row.studentName} ${column.label} periodo ${column.period}`}
              disabled={!column.editable}
              onChange={(event) => onCellChange(row.rowId, column.key, event.target.value)}
              onKeyDown={(event) => {
                if (!column.editable) {
                  return
                }

                const key = event.key

                if (key === 'Backspace' || key === 'Delete') {
                  event.preventDefault()
                  onCellChange(row.rowId, column.key, '')
                  return
                }

                if (
                  key === 'Tab' ||
                  key === 'Shift' ||
                  key === 'ArrowLeft' ||
                  key === 'ArrowRight' ||
                  key === 'ArrowUp' ||
                  key === 'ArrowDown' ||
                  key === 'Home' ||
                  key === 'End' ||
                  key === 'Enter' ||
                  key === ' '
                ) {
                  return
                }

                const normalizedKey = normalizeLetterMark(key)
                if (!normalizedKey) {
                  event.preventDefault()
                  return
                }

                event.preventDefault()
                onCellChange(row.rowId, column.key, normalizedKey)
              }}
              style={
                column.editable
                  ? professorGradeSelectBaseStyle
                  : professorGradeSelectDisabledStyle
              }
              value={normalizeLetterMark(row.cells[column.key] ?? '')}
            >
              {LETTER_MARK_OPTIONS.map((option) => (
                <option key={option || 'empty'} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </TableCell>
        ))}
      </TableRow>
    )
  },
  (previousProps, nextProps) =>
    previousProps.row === nextProps.row && previousProps.columns === nextProps.columns,
)

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
  }).format(parsed)
}

const buildProfessorPeriodState = (
  period: number,
  term: Term | undefined,
  todayKey: string,
  enableFallbackEditing: boolean,
): ProfessorPeriodState => {
  if (!term) {
    return enableFallbackEditing
      ? {
          editable: true,
          label: 'Abierto',
          color: 'success',
          helperText: 'Sin calendario configurado',
        }
      : {
          editable: false,
          label: 'Sin fecha',
          color: 'default',
          helperText: `Periodo ${period} sin fechas configuradas`,
        }
  }

  if (todayKey < term.startDate) {
    return {
      editable: false,
      label: 'Próximo',
      color: 'warning',
      helperText: `Abre ${formatDateLabel(term.startDate)}`,
    }
  }

  if (todayKey > term.endDate) {
    return {
      editable: false,
      label: 'Cerrado',
      color: 'default',
      helperText: `Cerró ${formatDateLabel(term.endDate)}`,
    }
  }

  return {
    editable: true,
    label: 'Abierto',
    color: 'success',
    helperText: `${formatDateLabel(term.startDate)} - ${formatDateLabel(term.endDate)}`,
  }
}

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

const buildSummary = (rows: PlanillaRow[]): PlanillaSummary => {
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
  finalizedPlanillaIds: number[]
  finalizedSheets: number
  resolved: number
  retired: number
  unresolved: string[]
  failedGroups: string[]
}

const PLANILLAS_LIST_STALE_TIME = 5 * 60_000
const PLANILLA_DETAIL_STALE_TIME = 2 * 60_000
const PLANILLA_DETAIL_GC_TIME = 15 * 60_000

const PlanillasPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isTeacherView = user?.role === 'teacher'
  const canImport = user?.role === 'admin' || user?.role === 'coordinator'
  const canManageSpecializations = canImport
  const canFinalize = canImport
  const canEditRoster = canImport

  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<number | ''>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<number | ''>('')
  const [selectedPlanillaId, setSelectedPlanillaId] = useState<number | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const deferredGroupSearch = useDeferredValue(groupSearch.trim())
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importInputKey, setImportInputKey] = useState(0)
  const [dismissedImportPlanillaIds, setDismissedImportPlanillaIds] = useState<number[]>([])
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
  const [visibleProfessorPeriods, setVisibleProfessorPeriods] = useState<number[]>(
    PROFESSOR_PERIODS.map(({ period }) => period),
  )

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
    isFetching: isFetchingPlanillas,
    isError: isPlanillasError,
    error: planillasError,
  } = useQuery({
    queryKey: ['planillas', selectedSchoolYearId, deferredGroupSearch, user?.nationalId, user?.role],
    queryFn: () =>
      planillasApi.list({
        schoolYearId: selectedSchoolYearId === '' ? undefined : selectedSchoolYearId,
        groupCode: deferredGroupSearch || undefined,
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(selectedSchoolYearId),
    staleTime: PLANILLAS_LIST_STALE_TIME,
    gcTime: PLANILLA_DETAIL_GC_TIME,
    placeholderData: keepPreviousData,
  })

  const {
    data: terms = [],
    isError: isTermsError,
    error: termsError,
  } = useQuery({
    queryKey: ['terms', selectedSchoolYearId],
    queryFn: () =>
      termsApi.list({
        schoolYearId: selectedSchoolYearId === '' ? undefined : selectedSchoolYearId,
      }),
    enabled: Boolean(selectedSchoolYearId),
  })

  const planillas = planillasResult?.data ?? []
  const dismissedImportPlanillaIdSet = useMemo(
    () => new Set(dismissedImportPlanillaIds),
    [dismissedImportPlanillaIds],
  )
  const importWorkflowPlanillas = useMemo(
    () =>
      isTeacherView
        ? planillas
        : planillas.filter(
            (planilla) => !dismissedImportPlanillaIdSet.has(planilla.planillaSheetId),
          ),
    [dismissedImportPlanillaIdSet, isTeacherView, planillas],
  )
  const pendingImportPlanillas = useMemo(
    () =>
      isTeacherView
        ? planillas
        : importWorkflowPlanillas.filter((planilla) => planilla.summary.pending > 0),
    [importWorkflowPlanillas, isTeacherView, planillas],
  )
  const readyImportPlanillas = useMemo(
    () =>
      isTeacherView
        ? []
        : importWorkflowPlanillas.filter((planilla) => planilla.summary.pending === 0),
    [importWorkflowPlanillas, isTeacherView],
  )

  const resetImportSelection = () => {
    setImportFile(null)
    setImportInputKey((current) => current + 1)
  }

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(pendingImportPlanillas.map((planilla) => planilla.gradeLevel)))
        .sort((left, right) => left - right),
    [pendingImportPlanillas],
  )

  const planillasByGrade = useMemo(() => {
    return pendingImportPlanillas.reduce<Record<number, PlanillaSheetSummary[]>>((accumulator, planilla) => {
      if (!accumulator[planilla.gradeLevel]) {
        accumulator[planilla.gradeLevel] = []
      }
      accumulator[planilla.gradeLevel].push(planilla)
      return accumulator
    }, {})
  }, [pendingImportPlanillas])

  const visiblePlanillas = useMemo(() => {
    if (selectedGradeLevel === '') {
      return pendingImportPlanillas
    }
    return pendingImportPlanillas.filter((planilla) => planilla.gradeLevel === selectedGradeLevel)
  }, [pendingImportPlanillas, selectedGradeLevel])

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
    staleTime: PLANILLA_DETAIL_STALE_TIME,
    gcTime: PLANILLA_DETAIL_GC_TIME,
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

  useEffect(() => {
    const candidatePlanillaId = selectedPlanillaId ?? visiblePlanillas[0]?.planillaSheetId ?? null
    if (candidatePlanillaId === null) {
      return
    }

    void queryClient.prefetchQuery({
      queryKey: ['planilla', candidatePlanillaId],
      queryFn: () => planillasApi.getById(candidatePlanillaId),
      staleTime: PLANILLA_DETAIL_STALE_TIME,
      gcTime: PLANILLA_DETAIL_GC_TIME,
    })
  }, [queryClient, selectedPlanillaId, visiblePlanillas])

  useEffect(() => {
    if (isTeacherView) {
      return
    }

    const completedPlanillaIds = planillas
      .filter(
        (planilla) =>
          planilla.summary.pending === 0 && planilla.planillaSheetId !== selectedPlanillaId,
      )
      .map((planilla) => planilla.planillaSheetId)

    completedPlanillaIds.forEach((planillaSheetId) => {
      queryClient.removeQueries({
        queryKey: ['planilla', planillaSheetId],
        exact: true,
      })
    })
  }, [isTeacherView, planillas, queryClient, selectedPlanillaId])

  useEffect(() => {
    if (isTeacherView) {
      return
    }

    if (pendingImportPlanillas.length > 0) {
      return
    }

    if (importWorkflowPlanillas.length > 0) {
      return
    }

    resetImportSelection()
    setDismissedImportPlanillaIds([])
    setSelectedGradeLevel('')
    setSelectedPlanillaId(null)
    setDraftTitle('')
    setDraftMetadata({
      subjectName: '',
      teacherName: '',
      periodLabel: '',
      specializationName: '',
      specializationAreaId: null,
    })
    setDraftRows([])
    setNewSpecializationName('')
    setIsDirty(false)
    setCurrentDocumentRowId(null)
    setImportSummary(null)
    setFinalizeResult(null)
    setPageMessage(null)
  }, [importWorkflowPlanillas.length, isTeacherView, pendingImportPlanillas.length])

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
      resetImportSelection()
      setDismissedImportPlanillaIds((current) => {
        const importedSheetIds = new Set(result.sheets.map((sheet) => sheet.planillaSheetId))
        return current.filter((planillaSheetId) => !importedSheetIds.has(planillaSheetId))
      })
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
      const finalizedPlanillaIds: number[] = []
      const failedGroups: string[] = []

      for (const planilla of finalizeEligiblePlanillas) {
        try {
          const result = await planillasApi.finalize(planilla.planillaSheetId, {
            allowPartial: true,
          })
          results.push(result)
          finalizedPlanillaIds.push(planilla.planillaSheetId)
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
        finalizedPlanillaIds,
        finalizedSheets: results.length,
        resolved: results.reduce((total, result) => total + result.resolved, 0),
        retired: results.reduce((total, result) => total + result.retired, 0),
        unresolved: results.flatMap((result) => result.unresolved),
        failedGroups,
      }
    },
    onSuccess: async (result) => {
      setFinalizeResult(result)
      setDismissedImportPlanillaIds((current) =>
        Array.from(new Set([...current, ...result.finalizedPlanillaIds])),
      )
      result.finalizedPlanillaIds.forEach((planillaSheetId) => {
        queryClient.removeQueries({
          queryKey: ['planilla', planillaSheetId],
          exact: true,
        })
      })
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

  const handlePlanillaCellChange = (rowId: string, key: string, value: string) => {
    const nextValue = PROFESSOR_GRADE_CELL_KEYS.has(key)
      ? normalizeLetterMark(value)
      : value
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [key]: nextValue,
              },
            }
          : row,
      ),
    )
    setIsDirty(true)
  }

  const handleProfessorPeriodToggle = (period: number) => {
    setVisibleProfessorPeriods((current) => {
      if (current.includes(period)) {
        return current.length > 1 ? current.filter((value) => value !== period) : current
      }
      return [...current, period].sort((left, right) => left - right)
    })
  }

  const showAllProfessorPeriods = () => {
    setVisibleProfessorPeriods(PROFESSOR_PERIODS.map(({ period }) => period))
  }

  const loading = (isLoadingYears && !schoolYears) || (isLoadingPlanillas && !planillasResult)
  const detailLoading = selectedPlanillaId !== null && isLoadingSelectedPlanilla && !selectedPlanilla
  const activePlanilla = selectedPlanilla ?? null
  const specializationEnabled = Boolean(
    activePlanilla && isSpecializationGrade(activePlanilla.gradeLevel),
  )
  const displayRows = useMemo(
    () => [...draftRows].sort((left, right) => left.order - right.order),
    [draftRows],
  )
  const configuredProfessorTerms = useMemo(
    () =>
      terms
        .filter((term) => /^P[1-4]$/.test(term.name))
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [terms],
  )
  const enableProfessorFallbackEditing = isTermsError || configuredProfessorTerms.length === 0
  const todayKey = toDateKey(new Date())
  const professorPeriodStates = useMemo(() => {
    const termsByName = new Map(configuredProfessorTerms.map((term) => [term.name, term]))
    return Object.fromEntries(
      PROFESSOR_PERIODS.map(({ period }) => [
        period,
        buildProfessorPeriodState(
          period,
          termsByName.get(`P${period}`),
          todayKey,
          enableProfessorFallbackEditing,
        ),
      ]),
    ) as Record<number, ProfessorPeriodState>
  }, [configuredProfessorTerms, enableProfessorFallbackEditing, todayKey])
  const professorPeriodsToRender = useMemo(
    () =>
      PROFESSOR_PERIODS.filter(({ period }) => visibleProfessorPeriods.includes(period)),
    [visibleProfessorPeriods],
  )
  const professorVisibleColumns = useMemo<ProfessorVisibleColumn[]>(
    () =>
      professorPeriodsToRender.flatMap(({ period, columns }) =>
        columns.map((column) => ({
          ...column,
          period,
          editable: professorPeriodStates[period].editable,
        })),
      ),
    [professorPeriodStates, professorPeriodsToRender],
  )
  const visibleEditableProfessorColumnKeys = useMemo(
    () =>
      professorVisibleColumns
        .filter((column) => column.editable)
        .map((column) => column.key),
    [professorVisibleColumns],
  )
  const professorTableMinWidth = 320 + professorVisibleColumns.length * 92
  const planillasForFinalize = useMemo<PlanillaSheetSummary[]>(() => {
    return importWorkflowPlanillas.map((planilla) => {
      if (planilla.planillaSheetId !== selectedPlanillaId || !activePlanilla) {
        return planilla
      }

      return {
        ...planilla,
        summary: buildSummary(draftRows),
      }
    })
  }, [activePlanilla, draftRows, importWorkflowPlanillas, selectedPlanillaId])
  const finalizeEligiblePlanillas = useMemo(
    () =>
      [...planillasForFinalize]
        .filter((planilla) => planilla.summary.pending === 0)
        .sort((left, right) => {
          if (left.gradeLevel !== right.gradeLevel) {
            return left.gradeLevel - right.gradeLevel
          }
          return left.groupCode.localeCompare(right.groupCode, 'es')
        }),
    [planillasForFinalize],
  )
  const adminImportWorkflowCompleted =
    !isTeacherView &&
    importWorkflowPlanillas.length > 0 &&
    pendingImportPlanillas.length === 0 &&
    readyImportPlanillas.length > 0

  const fillVisibleProfessorPeriodsWithRandomGrades = () => {
    if (visibleEditableProfessorColumnKeys.length === 0) {
      return
    }

    setDraftRows((current) =>
      current.map((row) => ({
        ...row,
        cells: {
          ...row.cells,
          ...Object.fromEntries(
            visibleEditableProfessorColumnKeys.map((key) => [
              key,
              RANDOM_LETTER_MARKS[Math.floor(Math.random() * RANDOM_LETTER_MARKS.length)],
            ]),
          ),
        },
      })),
    )
    setIsDirty(true)
  }

  // Testing-only helper to populate the current imported sheet with unique fake IDs.
  const fillImportRowsWithRandomNationalIds = () => {
    if (draftRows.length === 0) {
      return
    }

    const usedNationalIds = new Set<string>()
    const nextRows: PlanillaRow[] = draftRows.map((row) => {
      let nationalId = ''

      do {
        nationalId = String(
          RANDOM_NATIONAL_ID_MIN + Math.floor(Math.random() * RANDOM_NATIONAL_ID_RANGE),
        )
      } while (usedNationalIds.has(nationalId))

      usedNationalIds.add(nationalId)

      return {
        ...row,
        nationalId,
        status: row.retired ? 'retired' : 'resolved',
      }
    })

    setDraftRows(nextRows)
    setIsDirty(true)
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">Planillas</Typography>
        <Typography variant="body1" color="text.secondary">
          {isTeacherView
            ? 'Consulta tu grupo, visualiza los estudiantes y diligencia las valoraciones por periodo.'
            : 'Importa el formato institucional desde Excel, completa documentos pendientes y conserva una copia editable en línea.'}
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
      {isTeacherView && isTermsError ? (
        <Alert severity="warning">
          {termsError instanceof Error
            ? `${termsError.message} Se habilitan temporalmente todos los periodos.`
            : 'No se pudo cargar el calendario de periodos. Se habilitan temporalmente todos los periodos.'}
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
                  key={importInputKey}
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
            {isFetchingPlanillas && !loading ? (
              <Typography variant="caption" color="text.secondary">
                Actualizando planillas...
              </Typography>
            ) : null}
          </Stack>

          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress />
            </Stack>
          ) : planillas.length === 0 ? (
            <Alert severity="info">No hay planillas para los filtros seleccionados.</Alert>
          ) : adminImportWorkflowCompleted ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="h6">Importación lista para cerrar</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Todas las planillas importadas ya tienen pendientes 0. Se limpió el detalle en memoria y solo queda finalizar la importación.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    color="success"
                    label={`Listas ${finalizeEligiblePlanillas.length}`}
                  />
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
            </Paper>
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
                        {isTeacherView
                          ? 'Selecciona el grupo para diligenciar valoraciones.'
                          : 'Selecciona el grupo para registrar documentos.'}
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {(planillasByGrade[gradeLevel] ?? []).map((planilla) => {
                          const cardSummary = planilla.summary
                          const isSelected = planilla.planillaSheetId === selectedPlanillaId
                          return (
                            <Chip
                              key={planilla.planillaSheetId}
                              clickable
                              color={isSelected ? 'primary' : 'default'}
                              variant={isSelected ? 'filled' : 'outlined'}
                              label={
                                isTeacherView
                                  ? `${planilla.groupCode} · ${planilla.summary.total} est.`
                                  : `${planilla.groupCode} · Pend ${cardSummary.pending}`
                              }
                              onClick={() => {
                                setSelectedGradeLevel(gradeLevel)
                                setSelectedPlanillaId(planilla.planillaSheetId)
                              }}
                              onMouseEnter={() => {
                                void queryClient.prefetchQuery({
                                  queryKey: ['planilla', planilla.planillaSheetId],
                                  queryFn: () => planillasApi.getById(planilla.planillaSheetId),
                                  staleTime: PLANILLA_DETAIL_STALE_TIME,
                                  gcTime: PLANILLA_DETAIL_GC_TIME,
                                })
                              }}
                              onFocus={() => {
                                void queryClient.prefetchQuery({
                                  queryKey: ['planilla', planilla.planillaSheetId],
                                  queryFn: () => planillasApi.getById(planilla.planillaSheetId),
                                  staleTime: PLANILLA_DETAIL_STALE_TIME,
                                  gcTime: PLANILLA_DETAIL_GC_TIME,
                                })
                              }}
                            />
                          )
                        })}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>

              {detailLoading ? (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Stack alignItems="center" spacing={1.5}>
                    <CircularProgress size={28} />
                    <Typography variant="body2" color="text.secondary">
                      Cargando detalle de la planilla...
                    </Typography>
                  </Stack>
                </Paper>
              ) : null}

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
                      <Stack spacing={0.25}>
                        <Typography variant="body2" color="text.secondary">
                          Los estudiantes con RET se crearán o actualizarán como inactivos al finalizar la importación.
                        </Typography>
                        <Typography variant="caption" color="warning.main">
                          Test feature: genera documentos aleatorios únicos para toda la importación actual.
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={fillImportRowsWithRandomNationalIds}
                          disabled={!canEditRoster || saveMutation.isPending || draftRows.length === 0}
                        >
                          IDs aleatorios
                        </Button>
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
              ) : activePlanilla && isTeacherView ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="h6">
                          {String(activePlanilla.metadata.subjectName ?? '').trim() || activePlanilla.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {`Grado ${activePlanilla.gradeLevel} · Grupo ${activePlanilla.groupCode}`}
                          {String(activePlanilla.metadata.teacherName ?? '').trim()
                            ? ` · Profesor ${String(activePlanilla.metadata.teacherName)}`
                            : ''}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label={`${displayRows.length} estudiantes`} />
                        <Chip
                          color={isDirty ? 'warning' : 'success'}
                          label={isDirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}
                        />
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {PROFESSOR_PERIODS.map(({ period }) => {
                        const state = professorPeriodStates[period]
                        return (
                          <Chip
                            key={period}
                            color={state.color}
                            label={`Periodo ${period} · ${state.label}`}
                            variant={state.editable ? 'filled' : 'outlined'}
                          />
                        )
                      })}
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Periodos visibles
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          clickable
                          label="Todos"
                          color={
                            visibleProfessorPeriods.length === PROFESSOR_PERIODS.length
                              ? 'primary'
                              : 'default'
                          }
                          variant={
                            visibleProfessorPeriods.length === PROFESSOR_PERIODS.length
                              ? 'filled'
                              : 'outlined'
                          }
                          onClick={showAllProfessorPeriods}
                        />
                        {PROFESSOR_PERIODS.map(({ period }) => {
                          const isVisible = visibleProfessorPeriods.includes(period)
                          return (
                            <Chip
                              key={`toggle-period-${period}`}
                              clickable
                              label={`P${period}`}
                              color={isVisible ? 'primary' : 'default'}
                              variant={isVisible ? 'filled' : 'outlined'}
                              onClick={() => handleProfessorPeriodToggle(period)}
                              disabled={isVisible && visibleProfessorPeriods.length === 1}
                            />
                          )
                        })}
                      </Stack>
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      {enableProfessorFallbackEditing
                        ? 'Todavía no hay fechas de periodos configuradas para este año escolar. Por ahora todas las casillas están habilitadas.'
                        : 'Solo el periodo cuya fecha esté activa queda habilitado para edición; los demás se muestran en modo lectura.'}
                    </Typography>

                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{
                        maxWidth: '100%',
                        overflowX: 'auto',
                        '--planilla-grade-cell-bg': (theme) => theme.palette.background.paper,
                        '--planilla-grade-cell-bg-disabled': (theme) => theme.palette.action.hover,
                        '--planilla-grade-cell-border': (theme) => theme.palette.divider,
                        '--planilla-grade-cell-text': (theme) => theme.palette.text.primary,
                        '--planilla-grade-cell-color-scheme': (theme) => theme.palette.mode,
                      }}
                    >
                      <Table
                        size="small"
                        stickyHeader
                        sx={{
                          minWidth: professorTableMinWidth,
                          '& .MuiTableCell-head': {
                            whiteSpace: 'nowrap',
                          },
                        }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell rowSpan={2} sx={{ minWidth: 280 }}>
                              Estudiante
                            </TableCell>
                            {professorPeriodsToRender.map(({ period }) => {
                              const state = professorPeriodStates[period]
                              return (
                                <TableCell
                                  key={period}
                                  align="center"
                                  colSpan={3}
                                  sx={{
                                    backgroundColor: state.editable
                                      ? 'rgba(46, 125, 50, 0.08)'
                                      : undefined,
                                  }}
                                >
                                  <Stack spacing={0.25} alignItems="center">
                                    <Typography variant="subtitle2">{`Periodo ${period}`}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {state.helperText}
                                    </Typography>
                                  </Stack>
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          <TableRow>
                            {professorPeriodsToRender.flatMap(({ period, columns }) =>
                              columns.map((column) => (
                                <TableCell key={`${period}-${column.key}`} align="center">
                                  {column.shortLabel}
                                </TableCell>
                              )),
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {displayRows.map((row) => (
                            <ProfessorGridRow
                              key={row.rowId}
                              row={row}
                              columns={professorVisibleColumns}
                              onCellChange={handlePlanillaCellChange}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ xs: 'stretch', md: 'center' }}
                    >
                      <Stack spacing={0.25}>
                        <Typography variant="body2" color="text.secondary">
                          Guarda la planilla para conservar los avances por estudiante y por periodo.
                        </Typography>
                        <Typography variant="caption" color="warning.main">
                          Test feature: llena con notas aleatorias solo los periodos visibles.
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={fillVisibleProfessorPeriodsWithRandomGrades}
                          disabled={
                            saveMutation.isPending || visibleEditableProfessorColumnKeys.length === 0
                          }
                        >
                          Notas aleatorias
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => saveMutation.mutate()}
                          disabled={!isDirty || saveMutation.isPending}
                        >
                          {saveMutation.isPending ? 'Guardando...' : 'Guardar valoraciones'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          )}
        </Stack>
      </Paper>

      {!activePlanilla && !loading && !detailLoading && !adminImportWorkflowCompleted ? (
        <Alert severity="info">Selecciona una planilla para revisar el detalle.</Alert>
      ) : null}
    </Stack>
  )
}

export default PlanillasPage

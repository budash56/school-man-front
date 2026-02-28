import { useState, useMemo, type ChangeEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { useClassGroupsQuery } from '../classGroups/useClassGroupsQuery'
import {
  studentsApi,
  type Student,
  type CreateStudentPayload,
  type UpdateStudentPayload,
} from '../../api/studentsApi'
import { enrollmentsApi, type CreateEnrollmentPayload, type Enrollment } from '../../api/enrollmentsApi'

const createEmptyStudentForm = (): CreateStudentPayload => ({
  nationalId: '',
  firstName: '',
  lastName: '',
  dob: '',
  address: '',
  guardianName: '',
  guardianRelationship: '',
  guardianPhone: '',
})

type WizardMode = 'idle' | 'existing' | 'new'

const formatExistingField = (value: string | null) => value ?? ''

const getDateInputValue = (value: string | null) => {
  if (!value) {
    return ''
  }
  return value.split('T')[0] ?? value
}

const getErrorMessage = (error: unknown, fallback = 'Ocurrió un error') => {
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

const gradeOptions = Array.from({ length: 11 }, (_, index) => index + 1)

const EnrollmentWizardPage = () => {
  const navigate = useNavigate()

  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState('')
  const [selectedClassGroupId, setSelectedClassGroupId] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [mode, setMode] = useState<WizardMode>('idle')
  const [existingStudent, setExistingStudent] = useState<Student | null>(null)
  const [isEditingStudent, setIsEditingStudent] = useState(false)
  const [editStudentForm, setEditStudentForm] = useState<UpdateStudentPayload | null>(null)
  const [newStudentForm, setNewStudentForm] = useState<CreateStudentPayload>(createEmptyStudentForm)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [lastEnrollment, setLastEnrollment] = useState<Enrollment | null>(null)
  const [lastEnrollmentError, setLastEnrollmentError] = useState<string | null>(null)

  const schoolYearId = selectedYearId ? Number(selectedYearId) || undefined : undefined
  const gradeLevel = selectedGradeLevel ? Number(selectedGradeLevel) || undefined : undefined
  const classGroupId = selectedClassGroupId ? Number(selectedClassGroupId) || undefined : undefined

  const {
    data: schoolYears,
    isLoading: isLoadingYears,
    isError: isYearError,
    error: yearError,
  } = useSchoolYearsQuery({ active: true })

  const classGroupQueryParams = useMemo(
    () => ({
      schoolYearId,
      page: 1,
      pageSize: 100,
    }),
    [schoolYearId],
  )

  const {
    data: classGroups,
    isLoading: isLoadingClassGroups,
    isError: isClassGroupError,
    error: classGroupError,
  } = useClassGroupsQuery(classGroupQueryParams)

  const createStudentMutation = useMutation({
    mutationFn: (payload: CreateStudentPayload) => studentsApi.create(payload),
  })

  const updateStudentMutation = useMutation({
    mutationFn: (vars: { studentId: number; payload: UpdateStudentPayload }) =>
      studentsApi.update(vars.studentId, vars.payload),
  })

  const createEnrollmentMutation = useMutation({
    mutationFn: (payload: CreateEnrollmentPayload) => enrollmentsApi.create(payload),
  })

  const classGroupOptions = classGroups?.data ?? []
  const filteredClassGroupOptions = useMemo(() => {
    if (!gradeLevel) {
      return []
    }
    return classGroupOptions.filter((group) => group.gradeLevel === gradeLevel)
  }, [classGroupOptions, gradeLevel])
  const classGroupHelperText = isClassGroupError
    ? getErrorMessage(classGroupError)
    : gradeLevel && !isLoadingClassGroups && filteredClassGroupOptions.length === 0
      ? 'No hay secciones registradas para este grado.'
      : undefined
  const lastEnrollmentGroup = useMemo(() => {
    if (!lastEnrollment) {
      return null
    }
    return classGroupOptions.find((group) => group.classGroupId === lastEnrollment.classGroupId) ?? null
  }, [lastEnrollment, classGroupOptions])
  const isCheckDisabled = !nationalId.trim() || isSearching
  const canConfirmExisting = Boolean(existingStudent && schoolYearId && classGroupId && !createEnrollmentMutation.isPending)
  const isNewFormValid = useMemo(() => {
    return Boolean(
      newStudentForm.nationalId.trim() &&
        newStudentForm.firstName.trim() &&
        newStudentForm.lastName.trim() &&
        newStudentForm.dob &&
        newStudentForm.guardianName.trim() &&
        newStudentForm.guardianRelationship.trim() &&
        newStudentForm.guardianPhone.trim() &&
        schoolYearId &&
        classGroupId,
    )
  }, [newStudentForm, schoolYearId, classGroupId])

  const resetWizardState = () => {
    setMode('idle')
    setExistingStudent(null)
    setIsEditingStudent(false)
    setEditStudentForm(null)
    setNewStudentForm(createEmptyStudentForm())
    setSearchError(null)
    setLastEnrollment(null)
    setLastEnrollmentError(null)
    setSelectedYearId('')
    setSelectedGradeLevel('')
    setSelectedClassGroupId('')
  }

  const handleYearChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedYearId(event.target.value)
    setSelectedGradeLevel('')
    setSelectedClassGroupId('')
  }

  const handleGradeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedGradeLevel(event.target.value)
    setSelectedClassGroupId('')
  }

  const handleClassGroupChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedClassGroupId(event.target.value)
  }

  const handleNationalIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNationalId(event.target.value)
  }

  const handleCheckStudent = async () => {
    if (!nationalId.trim()) {
      return
    }
    setSearchError(null)
    setIsSearching(true)
    try {
      const student = await studentsApi.searchByNationalId(nationalId.trim())
      if (student) {
        setExistingStudent(student)
        setMode('existing')
        setIsEditingStudent(false)
        setEditStudentForm(null)
        try {
          const recentEnrollment = await enrollmentsApi.list({ studentId: student.studentId, page: 1, pageSize: 1 })
          setLastEnrollment(recentEnrollment.data?.[0] ?? null)
          setLastEnrollmentError(null)
        } catch (error) {
          console.error('Error loading last enrollment', error)
          setLastEnrollment(null)
          setLastEnrollmentError(getErrorMessage(error, 'No se pudo obtener la última matrícula.'))
        }
      } else {
        setExistingStudent(null)
        setMode('new')
        setNewStudentForm({
          ...createEmptyStudentForm(),
          nationalId: nationalId.trim(),
        })
        setLastEnrollment(null)
        setLastEnrollmentError(null)
      }
    } catch (error) {
      console.error('Error searching student', error)
      setSearchError(getErrorMessage(error, 'No se pudo buscar el estudiante.'))
    } finally {
      setIsSearching(false)
    }
  }

  const handleExistingEditToggle = () => {
    if (!existingStudent) {
      return
    }
    if (isEditingStudent) {
      setIsEditingStudent(false)
      setEditStudentForm(null)
    } else {
      setIsEditingStudent(true)
      setEditStudentForm({
        nationalId: existingStudent.nationalId,
        firstName: existingStudent.firstName,
        lastName: existingStudent.lastName,
        dob: getDateInputValue(existingStudent.dob),
        address: formatExistingField(existingStudent.address),
        guardianName: formatExistingField(existingStudent.guardianName),
        guardianRelationship: formatExistingField(existingStudent.guardianRelationship),
        guardianPhone: formatExistingField(existingStudent.guardianPhone),
      })
    }
  }

  const handleExistingFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!editStudentForm) {
      return
    }
    const { name, value } = event.target
    setEditStudentForm((prev) => (prev ? { ...prev, [name]: value } : prev))
  }

  const handleExistingSaveChanges = async () => {
    if (!existingStudent || !editStudentForm) {
      return
    }
    const payload: UpdateStudentPayload = { ...editStudentForm }
    if (payload.dob === '') {
      delete payload.dob
    }
    try {
      const updated = await updateStudentMutation.mutateAsync({
        studentId: existingStudent.studentId,
        payload,
      })
      setExistingStudent(updated)
      setIsEditingStudent(false)
      setEditStudentForm(null)
    } catch (error) {
      console.error('Error updating student', error)
    }
  }

  const handleNewStudentFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setNewStudentForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleExistingConfirmEnrollment = async () => {
    if (!existingStudent || !schoolYearId || !classGroupId) {
      return
    }
    try {
      await createEnrollmentMutation.mutateAsync({
        studentId: existingStudent.studentId,
        schoolYearId,
        classGroupId,
      })
      navigate('/dashboard/enrollments')
    } catch (error) {
      console.error('Error creating enrollment', error)
    }
  }

  const handleCreateStudentAndEnroll = async () => {
    if (!schoolYearId || !classGroupId) {
      return
    }
    try {
      const created = await createStudentMutation.mutateAsync({
        ...newStudentForm,
        nationalId: newStudentForm.nationalId.trim(),
      })
      await createEnrollmentMutation.mutateAsync({
        studentId: created.studentId,
        schoolYearId,
        classGroupId,
      })
      navigate('/dashboard/enrollments')
    } catch (error) {
      console.error('Error creating student/enrollment', error)
    }
  }

  const handleCancel = () => {
    resetWizardState()
    setNationalId('')
  }

  const renderYearGroupSelectors = () => (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField
        select
        fullWidth
        label="Año escolar"
        value={selectedYearId}
        onChange={handleYearChange}
        disabled={isLoadingYears}
        helperText={isYearError ? getErrorMessage(yearError) : undefined}
      >
        <MenuItem value="">Selecciona un año</MenuItem>
        {schoolYears?.map((year) => (
          <MenuItem key={year.schoolYearId} value={String(year.schoolYearId)}>
            {year.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        label="Grado"
        value={selectedGradeLevel}
        onChange={handleGradeChange}
        disabled={!schoolYearId}
      >
        <MenuItem value="">Selecciona un grado</MenuItem>
        {gradeOptions.map((grade) => (
          <MenuItem key={grade} value={String(grade)}>
            Grado {grade}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        label="Sección"
        value={selectedClassGroupId}
        onChange={handleClassGroupChange}
        disabled={!schoolYearId || !gradeLevel || isLoadingClassGroups}
        helperText={classGroupHelperText}
      >
        <MenuItem value="">Selecciona una sección</MenuItem>
        {filteredClassGroupOptions.map((group) => (
          <MenuItem key={group.classGroupId} value={String(group.classGroupId)}>
            {group.gradeLevel} {group.section}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  )

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="h4" component="h1">
        Iniciar matrícula
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Paso 1. Busca al estudiante</Typography>
          <TextField
            fullWidth
            label="Documento del estudiante"
            value={nationalId}
            onChange={handleNationalIdChange}
          />
          {searchError ? <Alert severity="error">{searchError}</Alert> : null}
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" onClick={handleCheckStudent} disabled={isCheckDisabled}>
              {isSearching ? 'Buscando...' : 'Buscar estudiante'}
            </Button>
            {isSearching ? <CircularProgress size={20} aria-label="Buscando estudiante" /> : null}
            <Typography color="text.secondary">
              {mode === 'existing'
                ? 'Estudiante encontrado. Completa la matrícula.'
                : mode === 'new'
                  ? 'No se encontró estudiante. Registra uno nuevo.'
                  : 'Ingresa el documento y presiona buscar.'}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {mode === 'existing' && existingStudent ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Estudiante existente</Typography>
            {updateStudentMutation.isError ? (
              <Alert severity="error">{getErrorMessage(updateStudentMutation.error, 'Error al actualizar el estudiante.')}</Alert>
            ) : null}
            {createEnrollmentMutation.isError ? (
              <Alert severity="error">{getErrorMessage(createEnrollmentMutation.error, 'Error al crear la matrícula.')}</Alert>
            ) : null}
            {renderYearGroupSelectors()}
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Documento"
                  name="nationalId"
                  value={isEditingStudent ? editStudentForm?.nationalId ?? '' : existingStudent.nationalId}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
                <TextField
                  fullWidth
                  label="Fecha de nacimiento"
                  type="date"
                  name="dob"
                  value={isEditingStudent ? editStudentForm?.dob ?? '' : getDateInputValue(existingStudent.dob)}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Nombres"
                  name="firstName"
                  value={isEditingStudent ? editStudentForm?.firstName ?? '' : existingStudent.firstName}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
                <TextField
                  fullWidth
                  label="Apellidos"
                  name="lastName"
                  value={isEditingStudent ? editStudentForm?.lastName ?? '' : existingStudent.lastName}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
              </Stack>
              <TextField
                fullWidth
                label="Dirección"
                name="address"
                value={isEditingStudent ? editStudentForm?.address ?? '' : formatExistingField(existingStudent.address)}
                InputProps={{ readOnly: !isEditingStudent }}
                onChange={handleExistingFieldChange}
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Acudiente"
                  name="guardianName"
                  value={isEditingStudent ? editStudentForm?.guardianName ?? '' : formatExistingField(existingStudent.guardianName)}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
                <TextField
                  fullWidth
                  label="Parentesco"
                  name="guardianRelationship"
                  value={isEditingStudent ? editStudentForm?.guardianRelationship ?? '' : formatExistingField(existingStudent.guardianRelationship)}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
                <TextField
                  fullWidth
                  label="Teléfono"
                  name="guardianPhone"
                  value={isEditingStudent ? editStudentForm?.guardianPhone ?? '' : formatExistingField(existingStudent.guardianPhone)}
                  InputProps={{ readOnly: !isEditingStudent }}
                  onChange={handleExistingFieldChange}
                />
              </Stack>
            </Stack>
            {lastEnrollment ? (
              <Typography color="text.secondary">
                Última matrícula: Año {lastEnrollment.schoolYearId} ·{' '}
                {lastEnrollmentGroup
                  ? `Grado ${lastEnrollmentGroup.gradeLevel} · Sección ${lastEnrollmentGroup.section}`
                  : `Sección ${lastEnrollment.classGroupId}`}
              </Typography>
            ) : lastEnrollmentError ? (
              <Alert severity="warning">{lastEnrollmentError}</Alert>
            ) : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="contained" onClick={handleExistingConfirmEnrollment} disabled={!canConfirmExisting}>
                {createEnrollmentMutation.isPending ? 'Guardando...' : 'Confirmar matrícula'}
              </Button>
              <Button variant="outlined" onClick={handleExistingEditToggle}>
                {isEditingStudent ? 'Cancelar edición' : 'Editar datos'}
              </Button>
              {isEditingStudent ? (
                <Button variant="outlined" onClick={handleExistingSaveChanges} disabled={updateStudentMutation.isPending}>
                  {updateStudentMutation.isPending ? 'Guardando cambios...' : 'Guardar cambios'}
                </Button>
              ) : null}
              <Button onClick={handleCancel}>Cancelar</Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {mode === 'new' ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Registrar nuevo estudiante</Typography>
            {createStudentMutation.isError ? (
              <Alert severity="error">{getErrorMessage(createStudentMutation.error, 'Error al crear el estudiante.')}</Alert>
            ) : null}
            {createEnrollmentMutation.isError ? (
              <Alert severity="error">{getErrorMessage(createEnrollmentMutation.error, 'Error al crear la matrícula.')}</Alert>
            ) : null}
            {renderYearGroupSelectors()}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Documento"
                name="nationalId"
                value={newStudentForm.nationalId}
                onChange={handleNewStudentFieldChange}
              />
              <TextField
                fullWidth
                label="Fecha de nacimiento"
                type="date"
                name="dob"
                value={newStudentForm.dob}
                onChange={handleNewStudentFieldChange}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Nombres"
                name="firstName"
                value={newStudentForm.firstName}
                onChange={handleNewStudentFieldChange}
              />
              <TextField
                fullWidth
                label="Apellidos"
                name="lastName"
                value={newStudentForm.lastName}
                onChange={handleNewStudentFieldChange}
              />
            </Stack>
            <TextField
              fullWidth
              label="Dirección"
              name="address"
              value={newStudentForm.address ?? ''}
              onChange={handleNewStudentFieldChange}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Acudiente"
                name="guardianName"
                value={newStudentForm.guardianName}
                onChange={handleNewStudentFieldChange}
              />
              <TextField
                fullWidth
                label="Parentesco"
                name="guardianRelationship"
                value={newStudentForm.guardianRelationship}
                onChange={handleNewStudentFieldChange}
              />
              <TextField
                fullWidth
                label="Teléfono"
                name="guardianPhone"
                value={newStudentForm.guardianPhone}
                onChange={handleNewStudentFieldChange}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                onClick={handleCreateStudentAndEnroll}
                disabled={!isNewFormValid || createStudentMutation.isPending || createEnrollmentMutation.isPending}
              >
                {createStudentMutation.isPending || createEnrollmentMutation.isPending
                  ? 'Guardando...'
                  : 'Crear estudiante y matricular'}
              </Button>
              <Button onClick={handleCancel}>Cancelar</Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Box>
  )
}

export default EnrollmentWizardPage

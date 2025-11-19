import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
import { useMutation, useQuery } from '@tanstack/react-query'
import { subjectAreasApi, type SubjectArea } from '../../api/subjectAreasApi'
import { courseInstancesApi, type CourseInstance, type CreateCourseInstancePayload } from '../../api/courseInstancesApi'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { subjectsApi } from '../../api/subjectsApi'

const useSubjectAreas = () => {
  return useQuery({
    queryKey: ['subject-areas'],
    queryFn: () => subjectAreasApi.list({ pageSize: 100 }),
  })
}

const useAreaCourseInstances = (area?: SubjectArea | null) => {
  return useQuery({
    queryKey: ['course-instances', area?.code],
    queryFn: async () => {
      if (!area) {
        return [] as CourseInstance[]
      }
      const instances = await courseInstancesApi.list()
      return instances.filter((instance) => instance.subjectAreaCode === area.code)
    },
    enabled: Boolean(area),
  })
}

const useSubjectsInArea = (areaId?: number | null) => {
  return useQuery({
    queryKey: ['subjects', areaId],
    queryFn: () => subjectsApi.list({ areaId: areaId!, pageSize: 100 }),
    enabled: Boolean(areaId),
  })
}

export const SubjectsPage = () => {
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<CourseInstance | null>(null)
  const [newCourse, setNewCourse] = useState<CreateCourseInstancePayload>({
    subjectId: 0,
    gradeLevel: 1,
    schoolYearId: 0,
    courseName: '',
    weeklyHours: 0,
  })

  const { data: areaResult, isLoading, isError, error } = useSubjectAreas()
  const areas = areaResult?.data ?? []
  const selectedArea = areas.find((area) => area.areaId === selectedAreaId) ?? null

  const { data: courseInstances, isLoading: isLoadingInstances, isError: isInstancesError, error: instancesError, refetch: refetchInstances } = useAreaCourseInstances(selectedArea)

  const { data: areaSubjects } = useSubjectsInArea(selectedAreaId ?? undefined)
  const subjects = areaSubjects?.data ?? []

  const { data: schoolYears } = useSchoolYearsQuery({})

  const filteredInstances = useMemo(() => {
    if (!courseInstances) {
      return []
    }
    if (!search.trim()) {
      return courseInstances
    }
    const keyword = search.trim().toLowerCase()
    return courseInstances.filter((instance) =>
      instance.courseName.toLowerCase().includes(keyword) ||
      instance.courseCode.toLowerCase().includes(keyword),
    )
  }, [courseInstances, search])

  const createMutation = useMutation({
    mutationFn: courseInstancesApi.create,
    onSuccess: () => {
      setIsAddDialogOpen(false)
      refetchInstances()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (courseInstanceId: number) => courseInstancesApi.remove(courseInstanceId),
    onSuccess: () => {
      setRemoveTarget(null)
      refetchInstances()
    },
  })

  const handleOpenArea = (area: SubjectArea) => {
    setSelectedAreaId(area.areaId)
    setSearch('')
  }

  const handleBackToAreas = () => {
    setSelectedAreaId(null)
    setSearch('')
  }

  const handleCreateCourse = () => {
    if (!selectedAreaId) {
      setIsAddDialogOpen(false)
      return
    }
    createMutation.mutate(newCourse)
  }

  const handleStartAddCourse = () => {
    if (!subjects.length || !schoolYears || schoolYears.length === 0) {
      setIsAddDialogOpen(true)
      return
    }
    setNewCourse({
      subjectId: subjects[0].subjectId,
      gradeLevel: 1,
      schoolYearId: schoolYears[0].schoolYearId,
      courseName: '',
      weeklyHours: 0,
    })
    setIsAddDialogOpen(true)
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Typography variant="h5">Subjects</Typography>
        {selectedArea ? (
          <TextField
            label="Search courses (TODO: server-side filtering)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 280 }}
          />
        ) : null}
      </Stack>

      {!selectedArea ? (
        <>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : null}
          {isError ? (
            <Alert severity="error">{error?.message || 'Error loading subject areas.'}</Alert>
          ) : null}
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
            {areas.map((area) => (
              <Paper
                key={area.areaId}
                sx={{ p: 3, textAlign: 'center', cursor: 'pointer', borderRadius: 3 }}
                onClick={() => handleOpenArea(area)}
              >
                <Typography variant="h6">{area.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {area.code}
                </Typography>
              </Paper>
            ))}
          </Box>
        </>
      ) : (
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Button variant="text" onClick={handleBackToAreas}>
              ← Back to areas
            </Button>
            <Typography variant="subtitle1">Área: {selectedArea.name}</Typography>
          </Stack>

          {isLoadingInstances ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress />
            </Box>
          ) : null}
          {isInstancesError ? (
            <Alert severity="error">{instancesError?.message || 'Error loading course instances.'}</Alert>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" onClick={handleStartAddCourse}>
              Add course instance
            </Button>
            <Button
              variant="outlined"
              disabled={!filteredInstances.length}
              onClick={() => {
                // TODO: improve edit behaviour (currently only removal)
              }}
            >
              Edit course instance
            </Button>
          </Stack>

          {filteredInstances.length === 0 && !isLoadingInstances ? (
            <Alert severity="info">No course instances configured for esta área.</Alert>
          ) : null}

          {filteredInstances.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Course</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Hours/week</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInstances.map((instance) => (
                    <TableRow key={instance.courseInstanceId} hover>
                      <TableCell>{instance.courseName}</TableCell>
                      <TableCell>{instance.gradeLevel}</TableCell>
                      <TableCell>{instance.courseCode}</TableCell>
                      <TableCell>{instance.weeklyHours}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setRemoveTarget(instance)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </Paper>
      )}

      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New course instance</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="subject-select-label">Subject</InputLabel>
            <Select
              labelId="subject-select-label"
              label="Subject"
              value={newCourse.subjectId || ''}
              onChange={(event) =>
                setNewCourse((prev) => ({ ...prev, subjectId: Number(event.target.value) }))
              }
            >
              {subjects.map((subject) => (
                <MenuItem key={subject.subjectId} value={subject.subjectId}>
                  {subject.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Course name"
            value={newCourse.courseName}
            onChange={(event) => setNewCourse((prev) => ({ ...prev, courseName: event.target.value }))}
          />
          <TextField
            label="Course code"
            value={newCourse.courseCode ?? ''}
            onChange={(event) => setNewCourse((prev) => ({ ...prev, courseCode: event.target.value }))}
          />
          <TextField
            label="Grade level"
            type="number"
            inputProps={{ min: 1, max: 11 }}
            value={newCourse.gradeLevel}
            onChange={(event) => setNewCourse((prev) => ({ ...prev, gradeLevel: Number(event.target.value) }))}
          />
          <FormControl fullWidth>
            <InputLabel id="school-year-select-label">School year</InputLabel>
            <Select
              labelId="school-year-select-label"
              label="School year"
              value={newCourse.schoolYearId || ''}
              onChange={(event) =>
                setNewCourse((prev) => ({ ...prev, schoolYearId: Number(event.target.value) }))
              }
            >
              {(schoolYears ?? []).map((year) => (
                <MenuItem key={year.schoolYearId} value={year.schoolYearId}>
                  {year.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Weekly hours"
            type="number"
            value={newCourse.weeklyHours ?? 0}
            onChange={(event) =>
              setNewCourse((prev) => ({ ...prev, weeklyHours: Number(event.target.value) }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCourse} disabled={createMutation.isPending}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)}>
        <DialogTitle>Remove course instance?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove “{removeTarget?.courseName} ({removeTarget?.courseCode})”? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              if (removeTarget) {
                removeMutation.mutate(removeTarget.courseInstanceId)
              }
            }}
            disabled={removeMutation.isPending}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default SubjectsPage

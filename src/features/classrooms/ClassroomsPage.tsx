import { useState } from 'react'
import {
  Alert,
  Box,
  Paper,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { classroomsApi } from '../../api/classroomsApi'

const useClassroomsQuery = (params: { q: string; building: string }) => {
  return useQuery({
    queryKey: ['classrooms', params],
    queryFn: () =>
      classroomsApi.list({
        q: params.q || undefined,
        building: params.building || undefined,
        pageSize: 50,
      }),
  })
}

const useClassroomQuery = (classroomId: number | null) => {
  return useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => {
      if (!classroomId) {
        throw new Error('classroomId required')
      }
      return classroomsApi.getById(classroomId)
    },
    enabled: Boolean(classroomId),
  })
}

export const ClassroomsPage = () => {
  const [search, setSearch] = useState('')
  const [building, setBuilding] = useState('')
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null)

  const { data, isLoading, isError, error } = useClassroomsQuery({ q: search, building })
  const {
    data: classroom,
    isLoading: isLoadingClassroom,
    isError: isClassroomError,
    error: classroomError,
  } = useClassroomQuery(selectedClassroomId)

  const classroomList = data?.data ?? []

  return (
    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
      <Paper sx={{ flexBasis: { md: '35%' }, flexShrink: 0, p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Classrooms</Typography>
          <TextField
            label="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <TextField
            label="Building"
            value={building}
            onChange={(event) => setBuilding(event.target.value)}
          />
          {isLoading ? (
            <Typography color="text.secondary">Loading classrooms…</Typography>
          ) : null}
          {isError ? (
            <Alert severity="error">{error?.message || 'Error loading classrooms.'}</Alert>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Building</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {classroomList.map((room) => (
                  <TableRow
                    key={room.classroomId}
                    hover
                    selected={room.classroomId === selectedClassroomId || false}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedClassroomId(room.classroomId)}
                  >
                    <TableCell>{room.classroomId}</TableCell>
                    <TableCell>{room.name}</TableCell>
                    <TableCell>{room.building ?? 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>
      <Paper sx={{ flexGrow: 1, p: 3 }}>
        {!selectedClassroomId ? (
          <Typography color="text.secondary">Select a classroom to see its details.</Typography>
        ) : (
          <Stack spacing={2}>
            {isLoadingClassroom ? (
              <Typography color="text.secondary">Loading classroom…</Typography>
            ) : null}
            {isClassroomError ? (
              <Alert severity="error">{classroomError?.message || 'Error loading classroom.'}</Alert>
            ) : null}
            {classroom ? (
              <>
                <Typography variant="h5">{classroom.name}</Typography>
                <Typography variant="body1" color="text.secondary">
                  Building: {classroom.building ?? 'N/A'} · Capacity: {classroom.capacity}
                </Typography>
                <Typography variant="body2">
                  Classroom ID: {classroom.classroomId}
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2">Reserved slots</Typography>
                  <Typography variant="body2" color="text.secondary">
                    TODO: load timetable assignments referencing this classroom.
                  </Typography>
                </Paper>
              </>
            ) : null}
          </Stack>
        )}
      </Paper>
    </Box>
  )
}

export default ClassroomsPage

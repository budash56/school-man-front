import { Box, Typography } from '@mui/material'

export const ClassGroupsPage = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h4">Class Groups</Typography>
      <Typography>
        Configure grade levels, sections, and classroom assignments. This view will guide yearly setup before scheduling and grades open.
      </Typography>
    </Box>
  )
}

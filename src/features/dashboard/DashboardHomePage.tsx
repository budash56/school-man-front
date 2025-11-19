import { Box, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'

export const DashboardHomePage = () => {
  const { user } = useAuth()
  const displayName = user?.firstName || user?.username || 'coordinator'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h4">
        Welcome, {displayName}
      </Typography>
      <Typography variant="subtitle1">
        Role: {user?.role ?? 'N/A'}
      </Typography>
      <Typography>
        Coordinators and teachers are the primary users of this dashboard. Soon we will extend dedicated views for registrar and admin roles with deeper insights.
      </Typography>
      <Typography>
        Use the navigation menu to review students, enrollments, class groups, and discipline records. Additional widgets and alerts will land here as the SchoolMan project grows.
      </Typography>
    </Box>
  )
}

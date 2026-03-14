import { useMemo, useState, type ReactNode } from 'react'
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import {
  Class as ClassIcon,
  Dashboard as DashboardIcon,
  DarkMode as DarkModeIcon,
  Gavel as GavelIcon,
  LightMode as LightModeIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  MenuBook as MenuBookIcon,
  MeetingRoom as MeetingRoomIcon,
  AutoStories as AutoStoriesIcon,
  ManageAccounts as ManageAccountsIcon,
  Work as WorkIcon,
} from '@mui/icons-material'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '../features/auth/AuthContext'
import { useColorMode } from '../theme/ColorModeProvider'

const drawerWidth = 240

type NavItem = {
  label: string
  path: string
  icon: ReactNode
}

export const DashboardLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const { mode, toggleColorMode } = useColorMode()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev)
  }

  const handleNavigate = (path: string) => {
    navigate(path)
    if (!isDesktop) {
      setMobileOpen(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { label: 'Students', path: '/dashboard/students', icon: <PeopleIcon /> },
      { label: 'Enrollments', path: '/dashboard/enrollments', icon: <SchoolIcon /> },
      { label: 'Currículo', path: '/dashboard/curriculum', icon: <AutoStoriesIcon /> },
      { label: 'School years', path: '/dashboard/class-groups', icon: <ClassIcon /> },
      { label: 'Discipline', path: '/dashboard/discipline', icon: <GavelIcon /> },
      { label: 'Áreas', path: '/dashboard/subjects', icon: <MenuBookIcon /> },
      { label: 'Classrooms', path: '/dashboard/classrooms', icon: <MeetingRoomIcon /> },
      // Future version: enable timetable generator when ready.
    ]

    if (user?.role === 'teacher') {
      return items.filter(
        (item) =>
          ![
            '/dashboard/enrollments',
            '/dashboard/curriculum',
            '/dashboard/class-groups',
            '/dashboard/classrooms',
            '/dashboard/workload',
          ].includes(item.path),
      )
    }

    if (user?.role === 'admin' || user?.role === 'coordinator') {
      items.push({ label: 'WorkLoad', path: '/dashboard/workload', icon: <WorkIcon /> })
    }

    if (user?.role === 'admin') {
      items.splice(3, 0, { label: 'Usuarios', path: '/dashboard/users', icon: <ManageAccountsIcon /> })
    }

    return items
  }, [user?.role])

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          SchoolMan
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <ListItemButton
              key={item.path}
              selected={isActive}
              onClick={() => handleNavigate(item.path)}
            >
              <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          )
        })}
      </List>
    </div>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              SchoolMan {user?.role ? `· ${user.role}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Coordinator dashboard shell
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={toggleColorMode} sx={{ mr: 1 }}>
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
          <Box sx={{ textAlign: 'right', mr: 2 }}>
            <Typography variant="subtitle2">
              {user?.firstName || user?.username || 'User'}
            </Typography>
            <Typography variant="caption">
              {user?.role ?? 'role'}
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation links"
      >
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop || mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}

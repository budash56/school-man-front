import { useMemo, useState, type ReactNode } from 'react'
import {
  AppBar,
  Box,
  Collapse,
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
  EventAvailable as EventAvailableIcon,
  CalendarMonth as CalendarMonthIcon,
  TableChart as TableChartIcon,
  ViewWeek as ViewWeekIcon,
  Print as PrintIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '../features/auth/AuthContext'
import { useColorMode } from '../theme/ColorModeProvider'

const desktopDrawerWidth = 240

type NavItem = {
  label: string
  path: string
  icon: ReactNode
}

type NavGroup = {
  key: string
  label: string
  icon: ReactNode
  items: NavItem[]
  defaultOpen?: boolean
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  coordinator: 'Coordinador',
  registrar: 'Registro',
  teacher: 'Profesor',
}

export const DashboardLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const { mode, toggleColorMode } = useColorMode()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const isMobile = !isDesktop

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

  const navGroups = useMemo<NavGroup[]>(() => {
    const role = user?.role
    const groups: NavGroup[] = [
      {
        key: 'inicio',
        label: 'Inicio',
        icon: <DashboardIcon />,
        defaultOpen: true,
        items: [{ label: 'Panel principal', path: '/dashboard', icon: <DashboardIcon /> }],
      },
    ]

    if (role === 'admin' || role === 'coordinator') {
      groups.push(
        {
          key: 'academico',
          label: 'Académico',
          icon: <SchoolIcon />,
          items: [
            { label: 'Estudiantes', path: '/dashboard/students', icon: <PeopleIcon /> },
            { label: 'Matrículas', path: '/dashboard/enrollments', icon: <SchoolIcon /> },
            { label: 'Planillas', path: '/dashboard/planillas', icon: <TableChartIcon /> },
            { label: 'Currículo', path: '/dashboard/curriculum', icon: <AutoStoriesIcon /> },
            { label: 'Áreas y asignaturas', path: '/dashboard/subjects', icon: <MenuBookIcon /> },
          ],
        },
        {
          key: 'operacion',
          label: 'Operación escolar',
          icon: <CalendarMonthIcon />,
          items: [
            { label: 'Calendario', path: '/dashboard/calendar', icon: <CalendarMonthIcon /> },
            { label: 'Asistencia', path: '/dashboard/attendance', icon: <EventAvailableIcon /> },
            { label: 'Convivencia', path: '/dashboard/discipline', icon: <GavelIcon /> },
            { label: 'Documentos', path: '/dashboard/documents', icon: <PrintIcon /> },
          ],
        },
        {
          key: 'planeacion',
          label: 'Planeación',
          icon: <ViewWeekIcon />,
          items: [
            { label: 'Horarios', path: '/dashboard/timetable', icon: <ViewWeekIcon /> },
            { label: 'Carga docente', path: '/dashboard/workload', icon: <WorkIcon /> },
            { label: 'Años y grupos', path: '/dashboard/class-groups', icon: <ClassIcon /> },
            { label: 'Aulas', path: '/dashboard/classrooms', icon: <MeetingRoomIcon /> },
          ],
        },
      )
      if (role === 'admin') {
        groups.push({
          key: 'administracion',
          label: 'Administración',
          icon: <ManageAccountsIcon />,
          items: [{ label: 'Usuarios', path: '/dashboard/users', icon: <ManageAccountsIcon /> }],
        })
      }
      return groups
    }

    if (role === 'registrar') {
      groups.push({
        key: 'registro',
        label: 'Registro académico',
        icon: <PrintIcon />,
        defaultOpen: true,
        items: [
          { label: 'Calendario', path: '/dashboard/calendar', icon: <CalendarMonthIcon /> },
          { label: 'Documentos', path: '/dashboard/documents', icon: <PrintIcon /> },
          { label: 'Estudiantes', path: '/dashboard/students', icon: <PeopleIcon /> },
          { label: 'Asistencia', path: '/dashboard/attendance', icon: <EventAvailableIcon /> },
          { label: 'Planillas', path: '/dashboard/planillas', icon: <TableChartIcon /> },
        ],
      })
      return groups
    }

    if (role === 'teacher') {
      groups.push({
        key: 'docente',
        label: 'Docencia',
        icon: <MenuBookIcon />,
        defaultOpen: true,
        items: [
          { label: 'Estudiantes', path: '/dashboard/students', icon: <PeopleIcon /> },
          { label: 'Asistencia', path: '/dashboard/attendance', icon: <EventAvailableIcon /> },
          { label: 'Planillas', path: '/dashboard/planillas', icon: <TableChartIcon /> },
          { label: 'Convivencia', path: '/dashboard/discipline', icon: <GavelIcon /> },
          { label: 'Área', path: '/dashboard/subjects', icon: <MenuBookIcon /> },
        ],
      })
      return groups
    }

    return groups
  }, [user?.role])

  const isItemActive = (item: NavItem) =>
    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)

  const isGroupOpen = (group: NavGroup) =>
    openGroups[group.key] ?? (Boolean(group.defaultOpen) || group.items.some(isItemActive))

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          SchoolMan
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navGroups.map((group) => {
          const groupOpen = isGroupOpen(group)
          return (
            <Box key={group.key}>
              <ListItemButton
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.key]: !groupOpen,
                  }))
                }
                sx={{ py: 1.1 }}
              >
                <ListItemIcon>{group.icon}</ListItemIcon>
                <ListItemText primary={group.label} />
                {groupOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              <Collapse in={groupOpen} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {group.items.map((item) => {
                    const isActive = isItemActive(item)
                    return (
                      <ListItemButton
                        key={item.path}
                        selected={isActive}
                        onClick={() => handleNavigate(item.path)}
                        sx={{ pl: 4.5, py: 0.9 }}
                      >
                        <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'inherit', minWidth: 36 }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} />
                      </ListItemButton>
                    )
                  })}
                </List>
              </Collapse>
            </Box>
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
          width: { md: `calc(100% - ${desktopDrawerWidth}px)` },
          ml: { md: `${desktopDrawerWidth}px` },
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 64, sm: 72 },
            px: { xs: 1.5, sm: 2 },
            gap: 1,
            alignItems: 'center',
          }}
        >
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant={isMobile ? 'subtitle1' : 'h6'}
              component="div"
              noWrap
            >
              SchoolMan {user?.role ? `· ${roleLabels[user.role] ?? user.role}` : ''}
            </Typography>
            <Typography
              variant="body2"
              sx={{ opacity: 0.8, display: { xs: 'none', sm: 'block' } }}
              noWrap
            >
              Panel de gestión escolar
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={toggleColorMode} sx={{ mr: { xs: 0, sm: 1 } }}>
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
          <Box
            sx={{
              textAlign: 'right',
              mr: { xs: 0.5, sm: 2 },
              minWidth: 0,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            <Typography variant="subtitle2" noWrap>
              {user?.firstName || user?.username || 'Usuario'}
            </Typography>
            <Typography variant="caption" noWrap>
              {user?.role ? roleLabels[user.role] ?? user.role : 'Rol'}
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: desktopDrawerWidth }, flexShrink: { md: 0 } }}
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
              width: { xs: 'min(88vw, 320px)', md: desktopDrawerWidth },
              boxSizing: 'border-box',
              overflowY: 'auto',
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
          p: { xs: 1.5, sm: 2, md: 3 },
          width: { md: `calc(100% - ${desktopDrawerWidth}px)` },
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

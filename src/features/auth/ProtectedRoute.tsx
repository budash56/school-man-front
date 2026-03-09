import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../../api/authApi'
import { useAuth } from './AuthContext'

type ProtectedRouteProps = {
  allowedRoles?: Role[]
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, accessToken, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="route-loading-state">
        Loading...
      </div>
    )
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.mustChangePassword && user.role !== 'admin' && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

import { apiClient } from './apiClient'

export type Role = 'admin' | 'registrar' | 'teacher' | 'coordinator'

export type SanitizedUser = {
  nationalId: string
  username: string
  role: Role
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  mustChangePassword: boolean
}

export type AuthResponse = {
  accessToken: string
  user: SanitizedUser
}

export type LoginPayload = {
  nationalId: string
  password: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
}

export const authApi = {
  login(payload: LoginPayload) {
    return apiClient.post<AuthResponse>('/auth/login', payload)
  },
  me() {
    return apiClient.get<SanitizedUser>('/auth/me')
  },
  changePassword(payload: ChangePasswordPayload) {
    return apiClient.post<{ updated: true }>('/auth/change-password', payload)
  },
}

import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DashboardHomePage } from './features/dashboard/DashboardHomePage'
import { StudentsPage } from './features/students/StudentsPage'
import StudentDetailPage from './features/students/StudentDetailPage'
import { EnrollmentsPage } from './features/enrollments/EnrollmentsPage'
import EnrollmentWizardPage from './features/enrollments/EnrollmentWizardPage'
import SchoolYearsStaticPage from './features/schoolYears/SchoolYearsStaticPage'
import { DisciplinePage } from './features/discipline/DisciplinePage'
import SubjectsPage from './features/subjects/SubjectsPage'
import ClassroomsPage from './features/classrooms/ClassroomsPage'
import CurriculumPage from './features/curriculum/CurriculumPage'
import UsersPage from './features/users/UsersPage'
import WorkLoadPage from './features/workload/WorkLoadPage'
import AttendancePage from './features/attendance/AttendancePage'
import PlanillasPage from './features/planillas/PlanillasPage'
import { useAuth } from './features/auth/AuthContext'

function DashboardIndexPage() {
  const { user } = useAuth()

  if (user?.role === 'registrar') {
    return <Navigate to="/dashboard/students" replace />
  }

  return <DashboardHomePage />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardIndexPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="planillas" element={<PlanillasPage />} />
          <Route element={<ProtectedRoute allowedRoles={['admin', 'coordinator', 'teacher']} />}>
            <Route path="discipline" element={<DisciplinePage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['admin', 'coordinator']} />}>
            <Route path="enrollments" element={<EnrollmentsPage />} />
            <Route path="enrollments/new" element={<EnrollmentWizardPage />} />
            <Route path="curriculum" element={<CurriculumPage />} />
            <Route path="class-groups" element={<SchoolYearsStaticPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="classrooms" element={<ClassroomsPage />} />
            <Route path="workload" element={<WorkLoadPage />} />
            {/* Future version: timetable generator route */}
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App

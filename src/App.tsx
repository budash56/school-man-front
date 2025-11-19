import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DashboardHomePage } from './features/dashboard/DashboardHomePage'
import { StudentsPage } from './features/students/StudentsPage'
import StudentDetailPage from './features/students/StudentDetailPage'
import { EnrollmentsPage } from './features/enrollments/EnrollmentsPage'
import EnrollmentWizardPage from './features/enrollments/EnrollmentWizardPage'
import SchoolYearsStaticPage from './features/schoolYears/SchoolYearsStaticPage'
import { DisciplinePage } from './features/discipline/DisciplinePage'
import ProfessorsPage from './features/professors/ProfessorsPage'
import SubjectsPage from './features/subjects/SubjectsPage'
import ClassroomsPage from './features/classrooms/ClassroomsPage'
import TimetableGeneratorPage from './features/timetable/TimetableGeneratorPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHomePage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />
          <Route path="enrollments" element={<EnrollmentsPage />} />
          <Route path="enrollments/new" element={<EnrollmentWizardPage />} />
          <Route path="class-groups" element={<SchoolYearsStaticPage />} />
          <Route path="discipline" element={<DisciplinePage />} />
          <Route path="professors" element={<ProfessorsPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="classrooms" element={<ClassroomsPage />} />
          <Route path="timetable-generator" element={<TimetableGeneratorPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App

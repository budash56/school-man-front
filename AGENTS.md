# SchoolMan Frontend Agent

You are helping build the **SchoolMan** frontend.

SchoolMan is a LAN-only intranet for a Colombian secondary school.  
The backend is a NestJS + TypeORM + PostgreSQL REST API, and this repo is the **React + Vite + TypeScript** client.

The goal of this file is to teach you:

- How this frontend is structured and how to keep it consistent.
- How the backend API is named and how data is shaped.
- How to write React + TypeScript code that talks cleanly to the API and respects roles/permissions.

Whenever you modify or create code, follow the rules and structures defined here.

---

## 1. Tech Stack & Tooling

- **Runtime:** Node `22.11.0` via `nvm`.
- **Frontend:** React (18/19), Vite, TypeScript.
- **Tooling:**
  - `npm install` – installs React, Vite, ESLint, TypeScript, etc.
  - `npm run dev` – start Vite dev server (HMR) on `http://localhost:5173`.
  - `npm run build` – TypeScript build + optimized bundle to `dist/`.
  - `npm run preview` – serve `dist/` locally to validate production build.
  - `npm run lint` – run ESLint (flat config) over the repo.

When generating commands, assume **npm** and these scripts exist.

---

## 2. Project Structure & Module Organization

The React client lives in `src/`:

- `src/main.tsx` – Vite entry; mounts `App`.
- `src/App.tsx` – root application shell (layout, router, providers).
- `src/index.css` (and/or `App.css`) – global styles.
- `src/assets/` – images, icons, logos, static assets.
- `public/` – files copied verbatim at build (favicons, manifest, etc.).
- Tooling config at repo root: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`.

**When adding features:**

- Prefer **feature folders** inside `src/`:

  - `src/features/students/`
  - `src/features/enrollments/`
  - `src/features/grades/`
  - `src/features/attendance/`
  - `src/features/class-groups/`
  - `src/features/timetable/`
  - `src/features/discipline/`
  - `src/features/reports/`
  - `src/features/dashboards/`
  - `src/features/auth/`
  - `src/features/settings/` (e.g. grade schemes, subject areas, etc.)

- Each feature can contain:
  - `components/` – UI components.
  - `hooks/` – data fetching and state hooks.
  - `types.ts` – feature-specific types if not shared.
  - `api.ts` – feature-specific API calls (or re-export from central `src/api/*`).

### Shared API & Types

Create and use a shared API layer and types:

- `src/api/apiClient.ts` – base HTTP client wrapper around `fetch`:
  - Base URL from `import.meta.env.VITE_API_BASE_URL`.
  - Automatically attaches `Authorization: Bearer <token>` when logged in.
  - Handles JSON parse + basic error mapping.

- `src/api/*.ts` – per-domain clients:
  - `students.api.ts`
  - `enrollments.api.ts`
  - `grades.api.ts`
  - `attendance.api.ts`
  - `classGroups.api.ts`
  - `timetable.api.ts` (slots, assignments)
  - `discipline.api.ts` (disciplinary records + observations if exposed)
  - `notifications.api.ts`
  - `reports.api.ts` (reports/grades + reports/certificates)
  - `dashboards.api.ts`
  - `auth.api.ts`
  - `settings.api.ts` (subjects, subject areas, grade schemes, grade scheme values, school-years, terms, classrooms, users)

- `src/types/` – shared domain types mirroring backend DTOs/entities where possible:
  - `auth.ts`, `students.ts`, `enrollments.ts`, `grades.ts`, etc.

Always prefer **feature-based structure** and small, focused components.

---

## 3. Coding Style & Naming Conventions

- **Style:**
  - 2-space indentation, **no semicolons**.
  - ES modules with TypeScript.
  - Functional components only, using React hooks (`useState`, `useEffect`, `useReducer`, custom hooks).

- **Naming:**
  - Components: `PascalCase` (`EnrollmentCard.tsx`).
  - Hooks & utilities: `camelCase` (`useStudents`, `formatDate`).
  - Types/interfaces: `PascalCase` (`Student`, `EnrollmentResponse`).
  - Keep frontend names aligned with backend fields:
    - `studentId`, `classGroupId`, `schoolYearId`, `termId`, `courseId`, etc.

- **State management:**
  - Local UI state: `useState` / `useReducer`.
  - Server data:
    - Prefer custom hooks like `useStudentsQuery`, `useGradesQuery`, etc.
    - If React Query/TanStack Query is added, integrate it via a top-level provider.

- **Routing:**
  - Use React Router if present.
  - Suggested routes:
    - `/login`
    - `/dashboard`
    - `/students`
    - `/students/:studentId`
    - `/class-groups`
    - `/class-groups/:classGroupId`
    - `/attendance`
    - `/grades`
    - `/timetable`
    - `/discipline`
    - `/reports/term-grades`
    - `/reports/final-grades`
    - `/reports/certificates`
    - `/settings/*` (subjects, grade schemes, school years, users…)

---

## 4. Backend API Overview (What You’re Talking To)

All calls go to `VITE_API_BASE_URL`, a NestJS REST API using TypeORM entities.

Core tables/entities (simplified):

- `students`
- `school_years`
- `terms`
- `class_groups`
- `classrooms`
- `subjects`
- `subject_areas`
- `course_instances`
- `courses`
- `enrollments`
- `grades`
- `attendance`
- `disciplinary_records`
- `notifications`
- `timetable_slots`
- `timetable_assignments`
- `audit_logs`
- `users`
- `grade_schemes`
- `grade_scheme_values`

---

### 4.1 Auth & Users

**Base path:** `/auth`

**Endpoints** (from `auth.controller.ts`):

- `POST /auth/login`
  - Body:  
    ```ts
    type LoginDto = {
      username: string
      password: string
    }
    ```
  - Response:  
    ```ts
    type Role = 'admin' | 'coordinator' | 'registrar' | 'teacher'

    type SanitizedUser = {
      nationalId: string
      username: string
      role: Role
      firstName: string | null
      lastName: string | null
      email: string | null
      phone: string | null
    }

    type AuthResponse = {
      accessToken: string
      user: SanitizedUser
    }
    ```
  - Frontend: store `accessToken` (e.g. in memory + `localStorage` if you decide to persist) and `user`.

- `POST /auth/signup`
  - Used to create users; typically for admin flows.

- `GET /auth/me`
  - Returns `SanitizedUser` for the current token.
  - Use on app startup to restore the session.

**Users & roles:**

- `/users` controller uses the `Users` entity with:
  - `nationalId`, `username`, `passwordHash`, `role`, `firstName`, `lastName`, `email`, `phone`, `isActive`.
- Valid `role` values:
  - `'admin' | 'coordinator' | 'registrar' | 'teacher'`

Role helpers (from `roles.decorator.ts`):

- `READ_ROLES`: all roles.
- `WRITE_ROLES`: `'admin' | 'coordinator'`.
- `ATTENDANCE_MUTATE_ROLES`: `'admin' | 'coordinator' | 'teacher'`.
- `ATTENDANCE_DELETE_ROLES`: `'admin' | 'coordinator'`.
- `GRADE_MUTATE_ROLES`: `'admin' | 'teacher'`.

**Frontend RBAC:** Use `user.role` to hide/show buttons and gate routes consistent with these arrays.

---

### 4.2 Common REST Pattern & Pagination

Many controllers (students, enrollments, grades, attendance, users, subjects, `subject_areas`, classrooms, notifications, `class_groups`, `audit_logs`) follow this pattern:

- `GET /resource` – list with filtering and pagination.
- `GET /resource/:id` – single item.
- `POST /resource` – create.
- `PATCH /resource/:id` – update.
- `DELETE /resource/:id` – delete or soft-delete (depends on entity).

**List endpoints** typically accept:

- `page` (optional number)
- `pageSize` (optional number)
- Extra filters depending on module (`q`, `year`, `studentId`, `courseId`, `termId`, `schoolYearId`, etc.).

They return a shared `PaginatedResult<T>` (see `shared/pagination.ts`):

```ts
export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}
```

Create a shared type:

```ts
export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}
```

Use it in API calls, e.g.:

```ts
async function listStudents(
  params: StudentsQuery
): Promise<PaginatedResult<Student>> {
  return apiClient.get('/students', { params })
}
```

---

### 4.3 Students & Enrollments

#### Students

**Base path:** `/students`

**Query params** (`StudentsQueryDto`):

- `page`, `pageSize`
- `q` – keyword search over `nationalId`, `firstName`, `lastName`
- `year` – filter by school year (students enrolled in a given `school_year_id`)

`GET /students` returns `PaginatedResult<Students>`, where `Students` has at least:

- `studentId`, `nationalId`, `firstName`, `lastName`, `dob`, `address`,
  `guardianName`, `guardianRelationship`, `guardianPhone`, `isActive`, timestamps.

**Actions:**

- `POST /students` – create (admin + coordinator).
- `PATCH /students/:id` – update (admin + coordinator).
- `DELETE /students/:id` – soft-delete.
- `PATCH /students/:id/restore?year=...` – custom restore for a `school_year_id`.

#### Enrollments

**Base path:** `/enrollments`

Represents: `student` ↔ `class_group` ↔ `school_year`.

`EnrollmentsQueryDto` includes filters like:

- `studentId`, `classGroupId`, `schoolYearId`, maybe `active`.

Pagination: `page`, `pageSize`.

`EnrollmentsService` exposes:

```ts
type EnrollmentResponse = {
  enrollmentId: number
  studentId: number
  classGroupId: number
  schoolYearId: number
  active: boolean
  enrolledAt: Date | null
}
```

**Frontend should:**

Provide UI to:

- Show students in a class group for a school year.
- Enroll/unenroll students (admin/coordinator only).
- Filter by year/grade/section.

---

### 4.4 Academic Structure: School Years, Terms, Class Groups, Courses

#### School Years

**Base path:** `/school-years`

Represents academic year with fields like:

- `name`, `year_start`, `year_end`, `isActive`.

#### Terms

**Base path:** `/terms`

Terms (periods) are linked to school years with:

- `name`, `start_date`, `end_date`, `sort_order`, `is_final`.

Used by grades and reports.

#### Class Groups

**Base path:** `/class-groups`

Fields:

- `classGroupId`, `schoolYearId`, `gradeLevel`, `section`, `classroomId`.

Unique per `(schoolYearId, gradeLevel, section)`.

#### Subjects & Subject Areas

- `/subject-areas` – high-level areas (e.g. *Ciencias Naturales*).
- `/subjects` – concrete subjects with:
  - `subject_code`, `name`, `area_id`.

#### Course Instances & Courses

- `/course-instances`
  - Defines a subject taught in a given grade and school year:
    - `subjectId`, `gradeLevel`, `schoolYearId`, `courseCode`, `courseName`, `weeklyHours`, `isActive`.
- `/courses`
  - Actual teaching assignment:
    - `courseInstanceId`, `classGroupId`, `teacherId`.
  - Unique `(courseInstanceId, classGroupId, teacherId)`.

**Frontend should:**

Allow configuration flows:

- Set up school year → terms → class groups → subjects → course instances → courses (teacher assignments).
- Represent courses consistently by `courseId`.

---

### 4.5 Grades & Grade Schemes

#### Grades

**Base path:** `/grades`

**Query params** (`GradesQueryDto`):

- `studentId`, `courseId`, `termId`, `schoolYearId`…
- Pagination: `page`, `pageSize`.

`GradesService` exposes:

```ts
type LetterMark = 'S' | 'A' | 'B' | 'J' // implied from mark mapping

type GradeResponse = {
  gradeId: number
  studentId: number
  courseId: number
  termId: number
  schoolYearId: number | null
  mark: LetterMark
  comment: string | null
}
```

Internally, `grades.mark` is numeric with domain:

- `5 = S`, `4 = A`, `3 = B`, `1 = J` (`2` and `0` unused).

#### Grade Schemes

- `/grade-schemes`
  - Plain CRUD for different grading schemes (e.g. SABJ).
- `/grade-scheme-values`
  - For each scheme, values with fields like:
    - `code`, `label`, `sortOrder`, `isPassing`.

**Frontend:**

Use grade scheme values to drive:

- Allowed grade options (e.g. dropdown with `S / A / B / J`).
- Passing vs failing status.

Teacher/Coordinator flows:

- Bulk entry of grades per class group & course.
- Read-only historical view; editing limited to current year/term when allowed by backend.

---

### 4.6 Attendance

#### Attendance

**Base path:** `/attendance`

Fields include:

- `attendanceId`, `studentId`, `courseId`, `date`, `status`, `reasonNote`,
  `recordedBy`, `recordedAt`, `excusedBy`, `excusedAt`, `slotId`.

Status enum (from `attendance.entity.ts`):

```ts
export type AttendanceStatus = 'P' | 'A' | 'AE' // Present, Absent, Absent Excused
```

**Uniqueness:**

- Legacy: one record per `(studentId, courseId, date)` when no `slotId`.
- Modern: one per `(studentId, courseId, date, slotId)`.

**Frontend:**

Daily attendance sheet per class group, filtered by:

- Date, course, and optionally slot.

Valid transitions and actions gated by roles:

- Marking attendance: `ATTENDANCE_MUTATE_ROLES` (admin, coordinator, teacher).
- Deleting: `ATTENDANCE_DELETE_ROLES` (admin, coordinator).

---

### 4.7 Discipline, Notifications & Audit

#### Disciplinary Records

**Base path:** `/disciplinary-records`

Enum for category:

```ts
export type DisciplinaryCategory = 'green' | 'yellow' | 'red' | 'last_notice'
```

Fields:

- `disciplinaryId`, `studentId`, `dateHappened`, `category`,
  `description`, `recordedBy`, `createdAt`, `expiresAt`, `deletedAt`.

**Frontend:**

- Show per-student discipline timeline.
- Filter by date/category.
- Show whether a record has expired.

#### Notifications

**Base path:** `/notifications`

Fields:

- `notificationId`, `title`, `message`, `category`, `studentId?`, `isActive`, timestamps.

Use to show:

- Global announcements.
- Student-targeted notifications (e.g. risk alerts).

#### Audit Logs

**Base path:** `/audit-logs`

Fields:

- `auditId`, `entityName`, `entityId`, `action`, `payload`, `performedBy`, `performedAt`.

**Frontend:**

- Read-only audit list with filters:
  - By entity
  - By user
  - By date range

---

### 4.8 Timetable

#### Timetable Slots

**Base path:** `/timetable-slots`

Fields:

- `slotId`, `dayOfWeek`, `startTime`, `endTime`, `durationMinutes`.

#### Timetable Assignments

**Base path:** `/timetable-assignments`

Fields:

- `assignmentId`, `courseId`, `slotId`, `classroomId`, `teacherId`, `classGroupId`.

Attendance may reference `(courseId, slotId)` assignments.

**Frontend:**

Weekly timetable views:

- Per class group.
- Per teacher.

Use `dayOfWeek` and `startTime` to build the grid.

---

### 4.9 Dashboards & Reports

#### Dashboards

**Base path:** `/dashboards` (admin + coordinator only).

Endpoints include:

- `GET /dashboards/attendance/weekly`
  - Returns buckets by week with counts of `P`, `A`, `AE`.
- `GET /dashboards/failing-rate`
  - Returns total vs failing students and failing rate.
- `GET /dashboards/discipline/heatmap`
- `GET /dashboards/teacher-workload`

**Frontend:**

Use for charts and metrics.

Each endpoint uses query DTOs (`AttendanceWeeklyQueryDto`, `FailingRateQueryDto`, etc.) with filters like:

- `schoolYearId`
- `grade`
- `subjectId`
- `termId`

#### Reports

**Base path:** `/reports`

- `/reports/grades/term`
  - Query: `studentId`, `courseId`, `termId`.
  - Returns grades for a student in a course during one term, plus context.
- `/reports/grades/final`
  - Query: `studentId`, `schoolYearId`.
  - Returns final grade aggregation for a student in a year.
- `/reports/certificates`:
  - `POST /reports/certificates/active-student`
    - Body:  
      ```ts
      {
        studentId: number
        schoolYearId: number
      }
      ```
    - Returns data for an “active student” certificate (plus print ID, if implemented).

**Frontend:**

- Provide “Download/Print” flows built on these endpoints.
- Use report IDs or “print IDs” where the backend exposes them.

---

## 5. Shared Frontend Types (Summary)

Define and reuse these TS types (adapt/extend from backend DTOs):

```ts
// auth.ts
export type Role = 'admin' | 'coordinator' | 'registrar' | 'teacher'

export type SanitizedUser = {
  nationalId: string
  username: string
  role: Role
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

export type AuthResponse = {
  accessToken: string
  user: SanitizedUser
}
```

```ts
// shared/pagination.ts
export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}
```

```ts
// attendance.ts
export type AttendanceStatus = 'P' | 'A' | 'AE'
```

```ts
// discipline.ts
export type DisciplinaryCategory = 'green' | 'yellow' | 'red' | 'last_notice'
```

For each module (students, enrollments, grades, etc.), mirror the backend’s response types when present.

---

## 6. UI, Language & Validation

- **Language:** UI text, labels, and messages should be in Spanish (Colombian school context). Code stays in English.
- **Dates:** Display as `dd/mm/yyyy` to users; keep ISO strings in API.

**Validation:**

- Use clear, concise Spanish messages.
- Respect backend constraints:
  - Non-empty names.
  - Unique national ID and username where enforced.
  - Valid ranges for grade marks.

**Error handling:**

- Show user-friendly messages (e.g., `Error al guardar la asistencia. Intenta de nuevo.`).
- Log technical details to `console.error` rather than surfacing them in the UI.

---

## 7. Testing Guidelines

No runner is configured yet; when adding tests:

- Use **Vitest** + **React Testing Library**.

Place specs as:

- `src/__tests__/ComponentName.test.tsx`, or
- Colocated `ComponentName.test.tsx` next to the component.

**Test:**

- Core business logic in hooks (e.g. grade entry, attendance toggles).
- Critical forms and flows (login, enrollment, grading, certificates).
- Mock API calls and document any manual QA steps in PR descriptions until `npm run test` is wired.

---

## 8. Git & PR Guidelines

Use **Conventional Commits**, for example:

- `feat: add student list page`
- `fix: handle expired session on /auth/me`
- `chore: configure Vitest`

Keep commits focused.

**PRs should:**

- Explain the intent and scope.
- List commands executed locally (`npm run lint`, tests).
- Include screenshots or short clips for visual changes.

---

## 9. Security & Configuration

**Environment:**

- Use `.env.local` / `.env.development` for local overrides.
- Only variables prefixed with `VITE_` are exposed to the client.
- Example:  
  `VITE_API_BASE_URL=http://localhost:3000`

**Secrets:**

- Never commit `.env*` files or credentials.
- Never hard-code tokens or passwords.

**Auth token handling:**

- Store JWT access token where needed (memory + persistent if desired).
- Always send `Authorization: Bearer <token>` on protected endpoints.
- On `401`, prompt for login and/or redirect to `/login`.

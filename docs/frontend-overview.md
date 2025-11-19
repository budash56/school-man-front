# SchoolMan Frontend — Project Overview

This document describes the current behaviour of the SchoolMan frontend codebase (`school-man-front`) as of the latest update.

## At a Glance
- **Stack:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) powered by [Vite](https://vitejs.dev/), UI built with [MUI 7](https://mui.com/), data fetching via [TanStack Query 5](https://tanstack.com/query/latest) and the native `fetch` API.
- **Entry point:** `src/main.tsx` wires the React root with routing (`BrowserRouter`), theming (`ColorModeProvider`), authentication context, and TanStack Query’s `QueryClientProvider`.
- **Routing:** `react-router-dom@6` handles public `/login` and protected `/dashboard/*` routes. `ProtectedRoute` ensures users are authenticated before visiting any dashboard page.
- **API Access:** `src/api/apiClient.ts` centralizes fetch logic, attaches JWT tokens, serializes query params, and converts server errors into typed `ApiError`s that UI components can surface.
- **State & Theming:** Local component state + TanStack Query for server-cache, `ColorModeProvider` wraps MUI’s `ThemeProvider` with a persisted light/dark toggle.
- **UI Scope:** Coordinator-facing intranet for managing students, enrollments, class groups, discipline, school years, and related dashboards. Recent work added a fully data-driven “School years” explorer and an enrollment wizard.

## Repository Layout

| Path | Description |
| ---- | ----------- |
| `src/main.tsx` | Bootstraps React root with Router, QueryClientProvider, AuthProvider, and ColorModeProvider. |
| `src/App.tsx` | Declares all app routes (`/login`, `/dashboard/*`) and guards protected sections. |
| `src/layouts/DashboardLayout.tsx` | Shell with sidebar navigation, top app bar, role display, color-mode toggle, and logout handling. |
| `src/features/auth/` | Login page, context (`AuthProvider`), hook (`useAuth`), and `ProtectedRoute`. Handles login, logout, token persistence, and session restore via `/auth/me`. |
| `src/api/` | Typed API helpers (`apiClient`, `authApi`, `studentsApi`, `enrollmentsApi`, `schoolYearsApi`, `classGroupsApi`, `disciplinaryRecordsApi`, etc.). |
| `src/features/*` | Feature folders (students, enrollments, classGroups, discipline, dashboard, schoolYears). Each folder contains pages, hooks, and components for that domain. |
| `src/theme/` | `ColorModeProvider` and shared theme configuration (persistent light/dark toggle). |
| `docs/` | Project documentation (`frontend-overview.md`). |

## Runtime Architecture

### Application Shell & Navigation
- **DashboardLayout:** Houses the persistent sidebar and app bar. It lists nav items (“Dashboard”, “Students”, “Enrollments”, “School years”, “Discipline”), highlights the active path, and exposes logout + color-mode controls. The user’s name and role are shown using `useAuth()`.
- **ProtectedRoute:** Wraps all `/dashboard/*` routes. If `useAuth()` reports no user, it redirects to `/login`, optionally preserving the desired destination.
- **ColorModeProvider:** Keeps a light/dark preference in `localStorage` and feeds MUI’s `ThemeProvider`.

### Data Access & Caching
- **apiClient:** Builds URLs from `import.meta.env.VITE_API_BASE_URL` (default `/api`), attaches Bearer tokens through a getter registered by `AuthProvider`, handles JSON parsing, and throws `ApiError` with status/message.
- **AuthProvider:** Stores `accessToken` + `user`, syncs tokens to `localStorage`, and exposes `login`, `logout`, and `refreshUser`. Login persists the token then routes coordinators into `/dashboard`.
- **TanStack Query:** Configured via `src/app/queryClient.ts` with `staleTime = 60s`, `retry = 1`, and disabled window refetching. Feature hooks (e.g., `useStudentsQuery`, `useSchoolYearsQuery`, `useClassGroupsQuery`, `useStudentsByClassGroup`) use descriptive query keys so caches remain isolated.

## Feature Modules

### Authentication (`/login`)
- **LoginPage:** Coordinator/teacher login form styled with MUI. Uses `useAuth().login`. Displays server errors via `ApiError.message`.
- **Session Restore:** On mount, `AuthProvider` checks `localStorage`; if a token exists it calls `/auth/me`. Failures clear storage and return the user to `/login`.

### Students
- **`studentsApi`** provides `list`, `getById`, `create`, `update`, and `searchByNationalId` helpers mirroring backend DTOs.
- **`useStudentsQuery`** fetches paginated student lists with keyword (`q`), page, and year filters; uses `placeholderData: keepPreviousData` to maintain smooth pagination.
- **StudentsPage (/dashboard/students):**
  - Search by document/name, filter by school year (populated via real `/school-years`), manual refresh, and paginated MUI table.
  - Rows are clickable and route to StudentDetailPage via `useNavigate`.
- **StudentDetailPage:**
  - Uses `useParams` + `useStudent`, `useStudentEnrollments`, and `useStudentDiscipline` hooks to load detailed info, latest enrollments, and recent disciplinary records.
  - Displays guardian info, status chip, and two cards with lists for enrollments and discipline. Each list handles loading/error states independently.

### Enrollment Flow
- **EnrollmentWizardPage (/dashboard/enrollments/new):**
  - Step 1: minimal form prompting for national ID. A “Comenzar” splash was removed; the wizard now jumps straight into the lookup flow.
  - Uses `studentsApi.searchByNationalId` to differentiate existing vs new students.
  - Existing student mode shows current data, optional edit (with `studentsApi.update`), and confirm enrollment via `enrollmentsApi.create`. Automatically fetches the last enrollment for context.
  - New student mode collects guardian info, creates the student, then creates the enrollment.
  - Year/class group selectors are populated using live `/school-years` and `/class-groups` queries; no mock grade lists.
- **EnrollmentsPage (/dashboard/enrollments):**
  - Simplified to a CTA (“Iniciar matrícula”) explaining that the full flow lives in the wizard.

### School Years Explorer (/dashboard/class-groups)
- **Data-driven chips:** `useSchoolYearsQuery` populates the year chips; selecting a year triggers `useClassGroupsQuery({ schoolYearId })` with real backend data. Static “1..11 / K0n” placeholders were removed.
- **Grade grouping:** Class groups are reduced into grade-level cards (one Paper per `gradeLevel`). Each card shows clickable chips labelled with the real `section`/`code` from the backend.
- **Mode switching:**
  - When no class group is selected, the lower Paper shows the grade cards.
  - Selecting a chip sets `selectedClassGroupId` and the Paper morphs into the students view.
  - Students view displays a “Volver a grupos” button, uses `useStudentsByClassGroup` (which calls `/enrollments` + `/students/:id`), and renders a two-column table (`group section` | `student full name`). Rows link to the student detail page.
- **Hooks:** `useStudentsByClassGroup` fetches enrollments for the current year/group (pageSize 200) and resolves each student via `studentsApi.getById`. Enabled only when both IDs are defined.

### Discipline, Dashboards, and Other Routes
- Placeholder pages exist for “Discipline” and “Dashboard” while backend endpoints are rolled out. They reuse the layout and will be wired next.

## Data Fetching Helpers

| Hook | Purpose |
| ---- | ------- |
| `useSchoolYearsQuery` | Loads `/school-years` (supporting `active` filter). Returns typed `SchoolYear[]`. |
| `useClassGroupsQuery` | Fetches `/class-groups` with optional `schoolYearId`, `page`, `pageSize`; returns paginated data. |
| `useStudentsQuery` | Lists students with pagination, keyword, and year filters. |
| `useStudent`, `useStudentEnrollments`, `useStudentDiscipline` | Load a single student, their latest enrollments, and discipline history for detail pages. |
| `useStudentsByClassGroup` | Aggregates `/enrollments` + `/students/:id` to provide the roster for a given school year & class group. |

All hooks follow the same pattern: descriptive `queryKey`, early return/`enabled` guards, and explicit error surfaces for the UI.

## Auth & RBAC in the UI
- Components rely on `useAuth().user.role` to tailor messaging, but the backend enforces all real RBAC rules. The frontend focuses on surfacing or hiding coordinator-only actions (e.g., enrollment wizard access, edit buttons) while trusting HTTP 403s for final enforcement.

## Error & Loading Patterns
- Every major section (lists, tables, cards) shows:
  - `CircularProgress` when `isLoading && !data`.
  - `Alert` for `isError` with the `error.message` from `ApiError` or `Error` objects.
  - Empty states (info alerts or placeholder text) when `data` is empty post-load.

## Development Workflow
1. **Install deps:** `npm install`
2. **Configure API base URL:** set `VITE_API_BASE_URL` (defaults to `/api`, relying on Vite dev proxy configured in `vite.config.ts`).
3. **Run dev server:** `npm run dev` (Vite at `http://localhost:5173`).
4. **Build:** `npm run build` (TypeScript build + Vite bundle). Vite warns if Node version is < 22.12; use Node 22.12+ for best compatibility.
5. **Lint:** `npm run lint`

> **Proxy note:** `vite.config.ts` proxies `/api/*` to `VITE_DEV_API_PROXY_TARGET` (defaults to `http://localhost:3000`) so local dev hits the NestJS backend without CORS issues.

## Recent Enhancements
- **Data-driven School Years page:** Replaced static grade/group placeholders with live `/school-years` + `/class-groups` data, including student rosters retrieved via real enrollments.
- **Enrollment Wizard:** Streamlined entry point, added last enrollment context, edit-in-place for existing students, and ensured all selectors are populated from the backend.
- **Students Page:** Added filters for keyword/year, MUI search field, and error handling; rows now navigate to the detail view.
- **Student Detail View:** Completely wired to per-student hooks, showing profile, enrollments, and discipline records with loading/error states.

## Future Work
- Flesh out the dashboard widgets once the backend dashboards endpoints are exposed to the frontend.
- Wire “Discipline” page and additional settings pages using the existing API layer structure.
- Add optimistic updates or inline editing patterns for frequently edited entities (students, enrollments) using TanStack Query mutations.
- Improve bundle size with dynamic imports for less-used sections (Vite currently warns about >500 kB bundles).

---
This document should be updated whenever major frontend architecture or feature changes are introduced (new routes, global providers, data-fetching patterns, etc.).

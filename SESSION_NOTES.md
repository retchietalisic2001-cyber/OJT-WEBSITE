# OJTConnect — Session Memory

## Environment
- Root: `C:\Users\RETCHIE TALISIC\source\repos\OJTConnect`
- Backend: Express + MySQL (also supports SQLite). Frontend: React/Vite.
- Dev running: client http://localhost:5173, API http://localhost:3001, MySQL `localhost:3306/ojtconnect` (DB_MODE=mysql). Logs in `dev2.log` at root. `node --watch` auto-restarts server on file change.
- Verify: `node --check server/<file>` from root; `npm run build` in `client/`.
- ONLY admin account exists (sample users removed): `admin@demo.com` / `demo123`. `server/seed.js` no longer seeds demo data — `seedDatabase()` wipes sample tables but KEEPS all `role='admin'` rows, and `ensureAdmin()` creates a default admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD` env or `admin@ojtconnect.com`/`admin123`) if none exists. Run via `npm run seed`. To test other roles, create a company/school via Admin Dashboard (auto-`is_verified`) and register applicants through the signup form.

## Feature Status (all VERIFIED, test data cleaned up)

### School tracking: Course → Room + Student ID placement (COMPLETED, VERIFIED)
- New tables `school_courses`, `school_rooms`, `enrollments` (SQLite+MySQL, auto-migrated). New `applicant_profiles.student_id` column. `enrollments` has a GLOBAL unique on `student_id` + FK cascades.
- School routes (`/api/schools`): courses CRUD, rooms CRUD, `enrollments` add (by Student ID — immediate place if matching registered applicant, else `invited` and auto-placed when they register/set that ID), `enrollments/place` (assign unassigned/legacy), `enrollments/:id` DELETE (untrack), grouped `GET /enrollments` (courses→rooms→students + legacy + unassigned), `GET /my-placement` for applicants.
- Duplicate blocking: same Student ID cannot be invited/placed by a second school (400 with school name). Auto-place via `matchEnrollmentByStudentId()` runs on register + profile save (auth.js imports it from schools.js — no circular import).
- Clients: AuthPage + ProfilePage student ID field; SchoolHome rewritten (course+room management, add-by-ID form, grouped lists, unassigned assign, untrack, invited badges); StudentDetail placement card + untrack; ApplicantHome "Placed by your school" banner.
- E2E verified: invite→auto-place, immediate place, cross-school 400, grouping. Build + node --check pass. CADENCE: seed wipes new tables too.

### Browse map: locate + range circle (COMPLETED, client-only)
- "📍 Locate me instantly" geolocates → centers map + draws radius circle immediately and auto-searches.
- New address box: geocodes via OpenStreetMap Nominatim (`countrycodes=ph`) → "Locate address" instantly re-centers + circle + auto-search.
- City dropdown now searches instantly and recenters map+circle on city center.
- Live note under map: "Circle = your search range. Showing openings within N km of <label>." Radius slider updates the circle live. Geo abilities kept client-only (no server change).

### 0. Profile picture + logos (COMPLETED)
- `users.avatar` column + `PUT /api/auth/avatar` (all roles); `PUT /api/auth/logo` (company/school only) → writes `company_profiles.logo` or shared `schools.logo`. Both return updated `profileFor`.
- `profileFor` returns `avatar` (base) and `logo` (company profile spread / school profile). Old uploaded files are unlinked on replace.
- `postings.js` GET `/` and `/:id` select `c.logo AS company_logo`.
- Client: ProfilePage avatar picker (all roles) + logo picker (company/school, preview 64px); Layout topbar avatar shows photo; JobCard & PostingDetail hero show company logo; SchoolHome header shows school logo.
- Year-level dropdown on signup limited to 3rd/4th Year (AuthPage only).

### 1. Account request / support widget
- `account_requests` has `file2_*` columns in both DB modes; `support.js` uses `requestUpload.array('file', 2)`; multi-file client UI with per-file 20MB checks; admin `RequestCard` shows both documents.
- Retry flow for unsupported/oversize files: client-side type validation, upload keeps active on error.
- Post-submission copy: "Please allow 1–2 days for the account verification."

### 2. Admin dashboard 401 bug — fixed
- `AdminDashboard.jsx` never sent auth token → all admin endpoints 401. Threaded `useAuth().token` into all 14 admin calls (CompanyForm, SchoolForm, load, remove, setRequestStatus, deleteRequest, approveRequest, declineRequest, deleteUser, reviewVerification, deleteVerification, UserRow, RequestCard).

### 3. Confirmation popups everywhere
- `client/src/confirm.jsx` (ConfirmProvider + useConfirm, default export) mounted in `App.jsx`; `.modal-actions` CSS.
- Replaced all `window.confirm` across Layout, SupportWidget, VerificationPanel, ProfilePage, ResumeBuilder, PostingDetail, ApplicationDetail, CompanyHome, PostingForm, CompanyApplicationDetail, AdminDashboard controls. Build passes.

### 4. Top bar profile + sign out
- `Layout.jsx` PROFILE_PATH map per role; topbar (upper-right) with profile (avatar+name+subtitle) and Sign out; removed `sidebar-foot`.

### 5. Auto-attach resume on apply (COMPLETED)
- `server/routes/resume.js`: exported shared `attachResumeToApplication({ applicationId, applicantId, app })` → loads app ctx, checks resume has content, generates PDF via `server/services/pdf.js` `generateResumePdf`, inserts `messages` row (sender_role `applicant`, category `pdf`), emits socket `message:new`. Manual `POST /resume/applications/:applicationId/attach-resume` now uses the helper.
- `server/routes/applications.js` `POST /`: auto-attaches resume, responds `resume_attached` / `resume_missing`. Missing resume doesn't block apply.
- `PostingDetail.jsx` apply modal/toast reflect automatic attach.

### 6. Company views resume + declines w/ required reason (COMPLETED)
- `GET /applications/:id` now returns `resume_path` / `resume_name` (latest `Resume_%` PDF message in application chat). `CompanyApplicationDetail.jsx` shows a **📄 Resume** card (sidebar) with a View button (target=_blank) or a hint if none.
- Decline requires a reason (client `window.prompt` dialog, cancel/empty aborts) AND server: `PUT /applications/:id/status` → `400 "Please provide a reason when declining an application"` when status `rejected` and note empty. Reason stored in `status_history`, visible to applicant timeline.

### 7. Admin-approval = verified (COMPLETED)
- Added `users.is_verified` column (both DB modes via `NEW_USER_COLUMNS` in db.js; also added to SQLite recreated users table). Backfill in `migrateSchema`: `UPDATE users SET is_verified = 1 WHERE role IN ('company','school')` — all existing companies/schools are now verified.
- `verify.js` `isVerified()` + `GET /verify/status`: verified if `users.is_verified = 1` OR an approved verification document exists. Applicants remain unverified (no banner for them).
- `admin.js` create company/school sets `is_verified = 1`. `support.js` on request `approved` flips matching email to verified. `seed.js` seeds company/school users verified (fresh installs).
- `schools.js` `canTrackStudents` = `isVerified()` OR pending doc. Posting gate (postings.js) already used `isVerified()`.

## Important gotchas / conventions
- Client `api()` helper prefixes `/api`. Server mounts: `/api/schools`, `/api/applications`, `/api/verify`, etc. Don't test `/school/stats` — use `/schools/stats`.
- DB helpers in server/db.js: `run`, `get`, `all`. MySQL `run()` returns insertId. `node --check` for server; no server lint/test runner.
- Tests done inline via temp `.mjs` scripts from root using `fetch('http://localhost:3001/api/...')`; ALWAYS delete test rows + uploaded PDFs afterward.
- Keep changes minimal; no comments in code unless asked.

## Not done / future ideas
- Resume is auto-attached on apply; ApplicationDetail still has an "Attach resume" button (goes through same helper).
- VerificationPanel still exists as doc-upload panel (shown as Verified for admin-created accounts).
- Chat, applications, posting creation, admin verifications flows were left unchanged.
- To test company/school flows, create accounts via Admin Dashboard (they're auto-verified) and register applicants via signup.
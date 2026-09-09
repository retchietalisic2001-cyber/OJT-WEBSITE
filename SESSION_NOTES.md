# OJTConnect — Session Memory

## Environment
- Root: `C:\Users\RETCHIE TALISIC\source\repos\OJTConnect`
- Backend: Express + MySQL (also supports SQLite). Frontend: React/Vite.
- Dev running: client http://localhost:5173, API http://localhost:3001, MySQL `localhost:3306/ojtconnect` (DB_MODE=mysql). Logs in `dev2.log` at root. `node --watch` auto-restarts server on file change.
- Verify: `node --check server/<file>` from root; `npm run build` in `client/`.
- Test logins (seed PASSWORD = `demo123`): admin `admin@demo.com`, company `company@demo.com` / `company2@demo.com`, school `school@demo.com`, applicant `applicant@demo.com` (+ applicant2/3).

## Feature Status (all VERIFIED, test data cleaned up)

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
- Testing of the actual seeded company `company@demo.com` vs `company2@demo.com` — both verified.
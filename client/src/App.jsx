import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth, roleHome } from './store.jsx'
import { ConfirmProvider } from './confirm.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Layout from './components/Layout.jsx'
import SupportWidget from './components/SupportWidget.jsx'
import { startAdminPresence } from './socket.js'

import ApplicantHome from './pages/applicant/ApplicantHome.jsx'
import Browse from './pages/applicant/Browse.jsx'
import PostingDetail from './pages/applicant/PostingDetail.jsx'
import MyApplications from './pages/applicant/MyApplications.jsx'
import ApplicationDetail from './pages/applicant/ApplicationDetail.jsx'
import Messages from './pages/applicant/Messages.jsx'
import ResumeBuilder from './pages/applicant/ResumeBuilder.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ChangePassword from './pages/ChangePassword.jsx'

import CompanyHome from './pages/company/CompanyHome.jsx'
import PostingForm from './pages/company/PostingForm.jsx'
import CompanyPostingDetail from './pages/company/CompanyPostingDetail.jsx'
import CompanyApplicationDetail from './pages/company/CompanyApplicationDetail.jsx'
import CompanyApplications from './pages/company/CompanyApplications.jsx'
import AcceptedInterns from './pages/company/AcceptedInterns.jsx'

import SchoolHome from './pages/school/SchoolHome.jsx'
import StudentDetail from './pages/school/StudentDetail.jsx'
import SchoolMessages from './pages/school/SchoolMessages.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'

function Guard({ role, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="page-loading">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />
  return children
}

function RequirePasswordChange({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="page-loading">Loading…</div>
  if (user?.must_change_password && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}

function HomeRedirect() {
  const { user, ready } = useAuth()
  if (!ready) return <div className="page-loading">Loading…</div>
  if (user?.must_change_password) return <Navigate to="/change-password" replace />
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />
}

function AdminPresence() {
  const { user, token } = useAuth()
  useEffect(() => {
    if (user?.role === 'admin' && token) startAdminPresence(token)
  }, [user?.role, token])
  return null
}

export default function App() {
  const { user } = useAuth()
  return (
    <ConfirmProvider>
      <AdminPresence />
      <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/change-password" element={<Guard><ChangePassword /></Guard>} />

      <Route path="/app" element={<Guard role="applicant"><RequirePasswordChange><Layout /></RequirePasswordChange></Guard>}>
        <Route index element={<ApplicantHome />} />
        <Route path="browse" element={<Browse />} />
        <Route path="postings/:id" element={<PostingDetail />} />
        <Route path="applications" element={<MyApplications />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="messages" element={<Messages />} />
        <Route path="resume" element={<ResumeBuilder />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="/company" element={<Guard role="company"><RequirePasswordChange><Layout /></RequirePasswordChange></Guard>}>
        <Route index element={<CompanyHome />} />
        <Route path="postings/new" element={<PostingForm />} />
        <Route path="postings/:id" element={<CompanyPostingDetail />} />
        <Route path="postings/:id/edit" element={<PostingForm />} />
        <Route path="applications" element={<CompanyApplications />} />
        <Route path="applications/:id" element={<CompanyApplicationDetail />} />
        <Route path="accepted" element={<AcceptedInterns />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="/school" element={<Guard role="school"><RequirePasswordChange><Layout /></RequirePasswordChange></Guard>}>
        <Route index element={<SchoolHome />} />
        <Route path="messages" element={<SchoolMessages />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="/admin" element={<Guard role="admin"><RequirePasswordChange><Layout /></RequirePasswordChange></Guard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!user && <SupportWidget />}
    </ConfirmProvider>
  )
}
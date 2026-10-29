import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';

import Landing from './pages/public/Landing';
import RouteFinder from './pages/public/RouteFinder';
import RouteDetail from './pages/public/RouteDetail';
import Terminals from './pages/public/Terminals';
import TerminalDetail from './pages/public/TerminalDetail';
import TransportCategory from './pages/public/TransportCategory';
import FareGuide from './pages/public/FareGuide';
import Advisories from './pages/public/Advisories';
import InfoPage from './pages/public/InfoPage';
import NotFound from './pages/public/NotFound';

import Login from './pages/auth/Login';
import RegisterCommuter from './pages/auth/RegisterCommuter';
import RegisterDriver from './pages/auth/RegisterDriver';
import { ForgotPassword, ResetPassword, VerifyEmail } from './pages/auth/PasswordPages';

import Notifications from './pages/shared/Notifications';
import AccountSecurity from './pages/shared/AccountSecurity';

import CommuterDashboard from './pages/commuter/CommuterDashboard';
import CommuterProfile from './pages/commuter/CommuterProfile';
import MyReports from './pages/commuter/MyReports';
import ReportNew from './pages/commuter/ReportNew';
import ReportDetail from './pages/commuter/ReportDetail';

import DriverPending from './pages/driver/DriverPending';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverVehicles from './pages/driver/DriverVehicles';
import DriverAssignments from './pages/driver/DriverAssignments';
import DriverUpdateRequests from './pages/driver/DriverUpdateRequests';
import DriverProfile from './pages/driver/DriverProfile';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTerminals from './pages/admin/AdminTerminals';
import AdminRoutes from './pages/admin/AdminRoutes';
import AdminFares from './pages/admin/AdminFares';
import AdminVehicles from './pages/admin/AdminVehicles';
import AdminAssignments from './pages/admin/AdminAssignments';
import AdminDrivers from './pages/admin/AdminDrivers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUpdateRequests from './pages/admin/AdminUpdateRequests';
import AdminReports from './pages/admin/AdminReports';
import AdminReportDetail from './pages/admin/AdminReportDetail';
import AdminObstructions from './pages/admin/AdminObstructions';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';

export default function App() {
  return (
    <Routes>
      {/* Public — no login required */}
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="routes" element={<RouteFinder />} />
        <Route path="routes/:id" element={<RouteDetail />} />
        <Route path="terminals" element={<Terminals />} />
        <Route path="terminals/:id" element={<TerminalDetail />} />
        <Route path="transport/:type" element={<TransportCategory />} />
        <Route path="fares" element={<FareGuide />} />
        <Route path="advisories" element={<Advisories />} />
        <Route path="about" element={<InfoPage page="about" />} />
        <Route path="contact" element={<InfoPage page="contact" />} />
        <Route path="privacy" element={<InfoPage page="privacy" />} />
        <Route path="terms" element={<InfoPage page="terms" />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<RegisterCommuter />} />
        <Route path="register/driver" element={<RegisterDriver />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route element={<ProtectedRoute roles={['driver']} />}>
          <Route path="driver/pending" element={<DriverPending />} />
        </Route>
      </Route>

      {/* Authenticated dashboards */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['commuter']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="commuter/dashboard" element={<CommuterDashboard />} />
          <Route path="commuter/profile" element={<CommuterProfile />} />
          <Route path="commuter/reports" element={<MyReports />} />
          <Route path="commuter/reports/new" element={<ReportNew />} />
          <Route path="commuter/reports/:id" element={<ReportDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['driver']} requireApproved />}>
        <Route element={<DashboardLayout />}>
          <Route path="driver/dashboard" element={<DriverDashboard />} />
          <Route path="driver/vehicles" element={<DriverVehicles />} />
          <Route path="driver/assignments" element={<DriverAssignments />} />
          <Route path="driver/update-requests" element={<DriverUpdateRequests />} />
          <Route path="driver/profile" element={<DriverProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="admin/dashboard" element={<AdminDashboard />} />
          <Route path="admin/terminals" element={<AdminTerminals />} />
          <Route path="admin/routes" element={<AdminRoutes />} />
          <Route path="admin/fares" element={<AdminFares />} />
          <Route path="admin/vehicles" element={<AdminVehicles />} />
          <Route path="admin/assignments" element={<AdminAssignments />} />
          <Route path="admin/drivers" element={<AdminDrivers />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/update-requests" element={<AdminUpdateRequests />} />
          <Route path="admin/reports" element={<AdminReports />} />
          <Route path="admin/reports/:id" element={<AdminReportDetail />} />
          <Route path="admin/obstructions" element={<AdminObstructions />} />
          <Route path="admin/analytics" element={<AdminAnalytics />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogs />} />
          <Route path="admin/profile" element={<AccountSecurity />} />
        </Route>
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import TenantList from "./screens/Tenants/TenantList";
import TenantDetail from "./screens/Tenants/TenantDetail";
import LicenseList from "./screens/Licenses/LicenseList";
import TicketList from "./screens/Support/TicketList";
import TicketDetail from "./screens/Support/TicketDetail";
import AnnouncementList from "./screens/Announcements/AnnouncementList";
import Health from "./screens/Health";
import AdminUserList from "./screens/AdminUsers/AdminUserList";
import AuditLog from "./screens/AdminUsers/AuditLog";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tenants" element={<TenantList />} />
          <Route path="tenants/:id" element={<TenantDetail />} />
          <Route path="licenses" element={<LicenseList />} />
          <Route path="support" element={<TicketList />} />
          <Route path="support/:id" element={<TicketDetail />} />
          <Route path="announcements" element={<AnnouncementList />} />
          <Route path="health" element={<Health />} />
          <Route path="users" element={<AdminUserList />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

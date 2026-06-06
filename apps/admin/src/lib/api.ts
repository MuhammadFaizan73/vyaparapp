import axios from "axios";
import { getToken, clearToken } from "./auth";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

const http = axios.create({ baseURL: BASE });

http.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const adminLogin = (email: string, password: string) =>
  http.post("/admin/auth/login", { email, password }).then((r) => r.data);

export const adminMe = () =>
  http.get("/admin/auth/me").then((r) => r.data);

export const impersonate = (tenantId: string) =>
  http.post(`/admin/auth/impersonate/${tenantId}`).then((r) => r.data);

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const tenantStats = () =>
  http.get("/admin/tenants/stats").then((r) => r.data);

// ── Tenants ──────────────────────────────────────────────────────────────────
export const listTenants = (params?: Record<string, string | number>) =>
  http.get("/admin/tenants", { params }).then((r) => r.data);

export const getTenant = (id: string) =>
  http.get(`/admin/tenants/${id}`).then((r) => r.data);

export const getTenantActivity = (id: string) =>
  http.get(`/admin/tenants/${id}/activity`).then((r) => r.data);

export const setTenantActive = (id: string, isActive: boolean) =>
  http.patch(`/admin/tenants/${id}/active`, { isActive }).then((r) => r.data);

// ── Licenses ─────────────────────────────────────────────────────────────────
export const listLicenses = (params?: Record<string, string | number>) =>
  http.get("/admin/licenses", { params }).then((r) => r.data);

export const expiringSoon = (days = 30) =>
  http.get("/admin/licenses/expiring", { params: { days } }).then((r) => r.data);

export const generateLicenses = (data: { count: number; platform: string; plan: string; daysValid: number }) =>
  http.post("/admin/licenses/generate", data).then((r) => r.data);

export const extendLicense = (id: string, days: number) =>
  http.patch(`/admin/licenses/${id}/extend`, { days }).then((r) => r.data);

export const revokeLicense = (id: string) =>
  http.patch(`/admin/licenses/${id}/revoke`).then((r) => r.data);

// ── Support ──────────────────────────────────────────────────────────────────
export const listTickets = (params?: Record<string, string | number>) =>
  http.get("/admin/support/tickets", { params }).then((r) => r.data);

export const getTicket = (id: string) =>
  http.get(`/admin/support/tickets/${id}`).then((r) => r.data);

export const replyTicket = (id: string, body: string, isInternal = false) =>
  http.post(`/admin/support/tickets/${id}/reply`, { body, isInternal }).then((r) => r.data);

export const updateTicketStatus = (id: string, status: string, assignedToId?: string) =>
  http.patch(`/admin/support/tickets/${id}/status`, { status, assignedToId }).then((r) => r.data);

// ── Announcements ─────────────────────────────────────────────────────────────
export const listAnnouncements = () =>
  http.get("/admin/announcements").then((r) => r.data);

export const createAnnouncement = (data: unknown) =>
  http.post("/admin/announcements", data).then((r) => r.data);

// ── Health ────────────────────────────────────────────────────────────────────
export const healthStats = () =>
  http.get("/admin/health").then((r) => r.data);

export const healthChart = () =>
  http.get("/admin/health/chart").then((r) => r.data);

// ── Admin Users ───────────────────────────────────────────────────────────────
export const listAdminUsers = () =>
  http.get("/admin/users").then((r) => r.data);

export const createAdminUser = (data: unknown) =>
  http.post("/admin/users", data).then((r) => r.data);

export const updateAdminRole = (id: string, role: string) =>
  http.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data);

export const setAdminActive = (id: string, isActive: boolean) =>
  http.patch(`/admin/users/${id}/active`, { isActive }).then((r) => r.data);

export const auditLog = (params?: Record<string, string | number>) =>
  http.get("/admin/users/audit-log", { params }).then((r) => r.data);

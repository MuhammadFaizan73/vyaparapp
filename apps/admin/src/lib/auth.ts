const KEY = "admin_token";
const ADMIN_KEY = "admin_user";

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token: string, admin: unknown) {
  localStorage.setItem(KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearToken() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function getAdmin() {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as { id: string; name: string; email: string; role: string }; }
  catch { return null; }
}

export function isLoggedIn() {
  return !!getToken();
}

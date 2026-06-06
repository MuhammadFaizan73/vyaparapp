import { VyaparApiClient } from "@vyapar/api-client";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export const api = new VyaparApiClient(BASE_URL);

const TOKEN_KEY = "vyapar.token";
const TENANT_KEY = "vyapar.tenant";

export function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  api.setToken(token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  api.clearToken();
}

export function saveTenant(tenant: unknown) {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function loadTenant<T = unknown>(): T | null {
  const raw = localStorage.getItem(TENANT_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Decode JWT payload (no verification — UI only) and return the role claim. */
export function loadRole(): string {
  const token = loadToken();
  if (!token) return "owner";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.role as string) ?? "owner";
  } catch {
    return "owner";
  }
}

const existing = loadToken();
if (existing) api.setToken(existing);

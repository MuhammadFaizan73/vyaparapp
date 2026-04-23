import { VyaparApiClient } from "@vyapar/api-client";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

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

const existing = loadToken();
if (existing) api.setToken(existing);

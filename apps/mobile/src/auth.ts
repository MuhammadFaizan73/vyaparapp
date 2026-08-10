import * as SecureStore from "expo-secure-store";
import { VyaparApiClient } from "@vyapar/api-client";

const TOKEN_KEY = "vyapar_jwt";
// The JWT itself only carries memberId/role/permissions, not a display identity (see
// getMemberId below) — the staff member's name/contact are only ever returned once, in
// the staff-login/accept-invite response body, so they're saved here at that moment for
// the Home screen to show instead of the tenant's own phone/company identity.
const STAFF_NAME_KEY = "vyapar_staff_name";
const STAFF_CONTACT_KEY = "vyapar_staff_contact";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://63dfc27578ffa4d0-125-62-88-237.serveousercontent.com/api";

export const api = new VyaparApiClient(API_BASE);

// JWT uses base64url (- and _ instead of + and /). atob() needs standard base64.
function decodeJwtPayload(token: string): Record<string, any> {
  const part = token.split(".")[1] ?? "";
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function loadToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) api.setToken(token);
  return token;
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  // Every login (owner or staff) starts from a clean slate — staff-login/accept-invite
  // call saveStaffIdentity() right after this, so an owner login on a device previously
  // used by staff doesn't keep showing that staff member's identity on the Home screen.
  await SecureStore.deleteItemAsync(STAFF_NAME_KEY);
  await SecureStore.deleteItemAsync(STAFF_CONTACT_KEY);
  api.setToken(token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(STAFF_NAME_KEY);
  await SecureStore.deleteItemAsync(STAFF_CONTACT_KEY);
  api.clearToken();
}

export async function saveStaffIdentity(name: string, contact?: string | null) {
  await SecureStore.setItemAsync(STAFF_NAME_KEY, name);
  if (contact) await SecureStore.setItemAsync(STAFF_CONTACT_KEY, contact);
}

export async function getStaffName(): Promise<string | null> {
  return SecureStore.getItemAsync(STAFF_NAME_KEY);
}

export async function getStaffContact(): Promise<string | null> {
  return SecureStore.getItemAsync(STAFF_CONTACT_KEY);
}

export async function getRole(): Promise<string> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return "owner";
  try {
    const payload = decodeJwtPayload(token);
    return (payload.role as string) ?? "owner";
  } catch {
    return "owner";
  }
}

// Returns null     → owner JWT or old JWT without permissions field → role-based fallback
// Returns string[] → member with assigned permissions (empty = no access to perm-gated items)
export async function getPermissions(): Promise<string[] | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token);
    if (!("permissions" in payload)) return null;
    return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : null;
  } catch {
    return null;
  }
}

// Returns null for an owner JWT (no team-member row, nothing to assign) or on any error.
export async function getMemberId(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token);
    return typeof payload.memberId === "string" ? payload.memberId : null;
  } catch {
    return null;
  }
}

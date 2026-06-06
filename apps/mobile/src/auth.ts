import * as SecureStore from "expo-secure-store";
import { VyaparApiClient } from "@vyapar/api-client";

const TOKEN_KEY = "vyapar_jwt";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://mhs_l1u-anonymous-3001.exp.direct/api";

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
  api.setToken(token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  api.clearToken();
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

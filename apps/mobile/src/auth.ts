import * as SecureStore from "expo-secure-store";
import { VyaparApiClient } from "@vyapar/api-client";

const TOKEN_KEY = "vyapar_jwt";
// Duplicated from useSelectedCompany.tsx rather than imported — that module imports
// from this one, and importing back would create a cycle. These three must be cleared
// on every login/logout: they're SecureStore-persisted (survives across accounts on
// the same device), and without clearing them a new phone number logging in on a
// device previously used by a different tenant would start pre-selected onto that
// tenant's company until the async company-list validation effect happened to catch it.
const SELECTED_DISTRIBUTOR_KEY = "vyapar_selected_distributor_id";
const SELECTED_BRANCH_KEY = "vyapar_selected_branch_id";
const SELECTED_COMPANY_KEY = "vyapar_selected_company_id";
// The JWT itself only carries memberId/role/permissions, not a display identity (see
// getMemberId below) — the staff member's name/contact are only ever returned once, in
// the staff-login/accept-invite response body, so they're saved here at that moment for
// the Home screen to show instead of the tenant's own phone/company identity.
const STAFF_NAME_KEY = "vyapar_staff_name";
const STAFF_CONTACT_KEY = "vyapar_staff_contact";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://63dfc27578ffa4d0-125-62-88-237.serveousercontent.com/api";

export const api = new VyaparApiClient(API_BASE);

// SelectedCompanyProvider mounts once at the app root and otherwise never re-fetches —
// without this, switching accounts within the same running app session (not force-
// quitting between logins, as happens during QA when testing several phone numbers in
// a row) leaves its in-memory company list and selection from the PREVIOUS tenant in
// place, so the new login can show someone else's company until the app is killed and
// reopened. Every saveToken/clearToken notifies listeners so that provider can reset.
type AuthListener = () => void;
const authListeners = new Set<AuthListener>();
export function onAuthChange(fn: AuthListener): () => void {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}
function notifyAuthChange() {
  authListeners.forEach((fn) => fn());
}

// JWT uses base64url (- and _ instead of + and /). atob() needs standard base64.
function decodeJwtPayload(token: string): Record<string, any> {
  const part = token.split(".")[1] ?? "";
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

// getRole/getPermissions/getMemberId/getAllowedReports below used to each do their own
// independent SecureStore.getItemAsync(TOKEN_KEY) call. On a cold app launch, app/index.tsx
// already reads and caches the token via loadToken() before anything else mounts — but the
// Home screen's own useEffect (app/(tabs)/index.tsx) fires a SEPARATE getRole() read
// straight after that. On some devices this second, concurrent SecureStore read raced with
// the OS keychain right after process launch and intermittently came back empty, which
// getRole() treats identically to "logged out" and silently falls back to "owner" — showing
// a staff/salesman login's header as the tenant's own owner identity (companyName/phone)
// instead of their staff name, even though the persisted token was never actually an owner's.
// Caching the decoded payload here, populated once by loadToken()/saveToken(), means every
// getter after boot reads the same in-memory value instead of re-reading+re-decoding
// SecureStore on every call.
let cachedPayload: Record<string, any> | null = null;
let cacheInitialized = false;

function setCachedToken(token: string | null) {
  cacheInitialized = true;
  try {
    cachedPayload = token ? decodeJwtPayload(token) : null;
  } catch {
    cachedPayload = null;
  }
}

// Only re-reads SecureStore if nothing has called loadToken()/saveToken() yet this
// process — after boot, every caller shares the one decode from whichever of those ran.
async function getCachedPayload(): Promise<Record<string, any> | null> {
  if (!cacheInitialized) setCachedToken(await SecureStore.getItemAsync(TOKEN_KEY));
  return cachedPayload;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function loadToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  setCachedToken(token);
  if (token) api.setToken(token);
  return token;
}

export async function saveToken(token: string) {
  setCachedToken(token);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  // Every login (owner or staff) starts from a clean slate — staff-login/accept-invite
  // call saveStaffIdentity() right after this, so an owner login on a device previously
  // used by staff doesn't keep showing that staff member's identity on the Home screen.
  // Same reasoning for the selected distributor/branch/company: a device previously
  // used by a different tenant must not start this login pre-selected onto their company.
  await SecureStore.deleteItemAsync(STAFF_NAME_KEY);
  await SecureStore.deleteItemAsync(STAFF_CONTACT_KEY);
  await SecureStore.deleteItemAsync(SELECTED_DISTRIBUTOR_KEY);
  await SecureStore.deleteItemAsync(SELECTED_BRANCH_KEY);
  await SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
  api.setToken(token);
  notifyAuthChange();
}

export async function clearToken() {
  setCachedToken(null);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(STAFF_NAME_KEY);
  await SecureStore.deleteItemAsync(STAFF_CONTACT_KEY);
  await SecureStore.deleteItemAsync(SELECTED_DISTRIBUTOR_KEY);
  await SecureStore.deleteItemAsync(SELECTED_BRANCH_KEY);
  await SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
  api.clearToken();
  notifyAuthChange();
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
  const payload = await getCachedPayload();
  if (!payload) return "owner";
  return (payload.role as string) ?? "owner";
}

// Returns null     → owner JWT or old JWT without permissions field → role-based fallback
// Returns string[] → member with assigned permissions (empty = no access to perm-gated items)
export async function getPermissions(): Promise<string[] | null> {
  const payload = await getCachedPayload();
  if (!payload || !("permissions" in payload)) return null;
  return Array.isArray(payload.permissions) ? (payload.permissions as string[]) : null;
}

// Empty array = no extra restriction beyond reports_view itself (every report it allows
// stays visible) — only a non-empty array narrows the Reports list down further.
export async function getAllowedReports(): Promise<string[]> {
  const payload = await getCachedPayload();
  if (!payload) return [];
  return Array.isArray(payload.allowedReports) ? (payload.allowedReports as string[]) : [];
}

// Returns null for an owner JWT (no team-member row, nothing to assign) or on any error.
export async function getMemberId(): Promise<string | null> {
  const payload = await getCachedPayload();
  if (!payload) return null;
  return typeof payload.memberId === "string" ? payload.memberId : null;
}

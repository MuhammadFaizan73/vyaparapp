import { loadToken } from "./api";

// Mirrors the backend's assertCanTouchSale (apps/backend/src/transactions/transactions.service.ts)
// and mobile's canEditSale (apps/mobile/src/permissions.ts) exactly, so all three agree on who
// can touch a given sale — this is UI-only convenience; the backend is the actual enforcement.

function decodeJwtPayload(token: string): Record<string, any> {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

export function loadMemberId(): string | null {
  const token = loadToken();
  if (!token) return null;
  return decodeJwtPayload(token).memberId ?? null;
}

// null = owner/legacy token → unrestricted, matching the client/server convention elsewhere.
export function loadPermissions(): string[] | null {
  const token = loadToken();
  if (!token) return null;
  const perms = decodeJwtPayload(token).permissions;
  return Array.isArray(perms) ? perms : null;
}

export function canEditSale(
  txn: { bookerId?: string | null; date: string },
  permissions: string[] | null,
  memberId: string | null,
): boolean {
  if (permissions === null) return true;
  const canAll = permissions.includes("sale_edit_all");
  const canOwn = permissions.includes("sale_edit_own") && !!memberId && txn.bookerId === memberId;
  if (!canAll && !canOwn) return false;
  if (permissions.includes("sale_edit_today_only")) {
    const today = new Date().toISOString().slice(0, 10);
    const txnDate = new Date(txn.date).toISOString().slice(0, 10);
    if (txnDate !== today) return false;
  }
  return true;
}

export function canDeleteSale(permissions: string[] | null): boolean {
  if (permissions === null) return true;
  return permissions.includes("sale_delete");
}

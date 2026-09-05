import { ForbiddenException } from "@nestjs/common";

// The company filter selected in the topbar can resolve to more than one company
// once Distributor/Branch rollups are picked (e.g. "all companies under Branch X"),
// so every companyId filter accepts either a single id or a comma-separated list of
// ids from the client.
export function parseCompanyIds(companyId?: string | string[]): string[] {
  if (!companyId) return [];
  return Array.isArray(companyId) ? companyId : companyId.split(",").map((s) => s.trim()).filter(Boolean);
}

// Builds the matching Prisma where-clause fragment for either a single id or a list.
export function companyIdWhere(companyId?: string | string[]): { companyId?: string | { in: string[] } } {
  const ids = parseCompanyIds(companyId);
  if (ids.length === 0) return {};
  return { companyId: ids.length === 1 ? ids[0] : { in: ids } };
}

// Never a real Company.id (always a uuid) — a safe "matches nothing" value. Returning
// undefined/"" here instead would make companyIdWhere(...) fall through to `{}` (no
// filter, i.e. every company), turning "not allowed" into "allowed everywhere".
export const NO_COMPANY_ACCESS = "__no_company_access__";

// A team member restricted to specific companies (JWT-carried allowedCompanyIds, null =
// unrestricted) can never see outside that set, regardless of what companyId they pass in.
export function restrictCompanyIds(
  requestedCompanyId: string | string[] | undefined,
  allowedCompanyIds: string[] | null | undefined,
): string | undefined {
  if (!allowedCompanyIds || allowedCompanyIds.length === 0) {
    return Array.isArray(requestedCompanyId) ? requestedCompanyId.join(",") : requestedCompanyId;
  }
  const requested = parseCompanyIds(requestedCompanyId);
  if (requested.length === 0) return allowedCompanyIds.join(",");
  const allowedSet = new Set(allowedCompanyIds);
  const intersection = requested.filter((id) => allowedSet.has(id));
  return intersection.length === 0 ? NO_COMPANY_ACCESS : intersection.join(",");
}

// For writes that target one specific company (e.g. bulk-import), where there's no where-
// clause to narrow — just reject outright if the caller isn't allowed to write there.
export function assertCompanyAllowed(companyId: string | null | undefined, allowedCompanyIds: string[] | null | undefined): void {
  if (!companyId || !allowedCompanyIds || allowedCompanyIds.length === 0) return;
  if (!allowedCompanyIds.includes(companyId)) {
    throw new ForbiddenException("You don't have access to this company.");
  }
}

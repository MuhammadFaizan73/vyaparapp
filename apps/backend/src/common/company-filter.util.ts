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

// Local calendar date, NOT toISOString() — that converts to UTC, which rolls local
// midnight back to the previous day for any timezone ahead of UTC (e.g. Pakistan,
// UTC+5), which could wrongly fail "today only" for a sale made earlier that same day.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Mirrors the backend's assertCanTouchSale (transactions.service.ts) exactly, so the UI
// hides/disables Edit in the same cases the server would actually reject — a staff member
// should never tap Edit, fill out a form, and only then discover it was never allowed.
// The server remains the real enforcement point; this is UX, not the security boundary.
export function canEditSale(
  txn: { bookerId?: string | null; date: string },
  permissions: string[] | null,
  memberId: string | null,
): boolean {
  if (permissions === null) return true; // owner/legacy token — unrestricted
  const canAll = permissions.includes("sale_edit_all");
  const canOwn = permissions.includes("sale_edit_own") && !!memberId && txn.bookerId === memberId;
  if (!canAll && !canOwn) return false;
  if (permissions.includes("sale_edit_today_only")) {
    const today = localDateStr(new Date());
    const txnDate = localDateStr(new Date(txn.date));
    if (txnDate !== today) return false;
  }
  return true;
}

// Empty allowedReports = no extra restriction beyond reports_view itself.
export function canViewReport(reportKey: string, permissions: string[] | null, allowedReports: string[]): boolean {
  if (permissions === null) return true;
  if (!permissions.includes("reports_view")) return false;
  if (allowedReports.length === 0) return true;
  return allowedReports.includes(reportKey);
}

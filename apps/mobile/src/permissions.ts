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
    const today = new Date().toISOString().slice(0, 10);
    const txnDate = new Date(txn.date).toISOString().slice(0, 10);
    if (txnDate !== today) return false;
  }
  return true;
}

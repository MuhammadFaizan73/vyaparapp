// Shared helpers for the real-data Expense screens (list, category drill-down, and the
// create/edit form). An expense Transaction's `notes` column holds JSON shaped like
// `{ category, paymentType, items: [] }` — confirmed against both the bulk-import path
// (apps/backend/src/bulk-import/bulk-import.service.ts) and the legacy .vyb importer
// (apps/backend/scripts/import-vyapar-backup.js's `expense_by_category` bucket). `items`
// is always `[]` for an expense (it has no line items), kept only so this shape matches
// every other transaction type's `notes` convention closely enough for shared tooling.
export type ExpenseNotes = { category: string; paymentType: string; note: string };

const UNCATEGORIZED = "Uncategorized";

/** Parses just the category out of an expense transaction's `notes`, tolerating a
 * missing/malformed/legacy value instead of throwing. */
export function parseExpenseCategory(notes: string | null | undefined): string {
  if (!notes) return UNCATEGORIZED;
  try {
    const parsed = JSON.parse(notes);
    const category = typeof parsed?.category === "string" ? parsed.category.trim() : "";
    return category || UNCATEGORIZED;
  } catch {
    return UNCATEGORIZED;
  }
}

/** Parses the full set of fields the expense create/edit form round-trips through
 * `notes` — used when loading a transaction back into that form for editing. */
export function parseExpenseNotes(notes: string | null | undefined): ExpenseNotes {
  const fallback: ExpenseNotes = { category: "", paymentType: "Cash", note: "" };
  if (!notes) return fallback;
  try {
    const parsed = JSON.parse(notes);
    return {
      category: typeof parsed?.category === "string" ? parsed.category.trim() : "",
      paymentType: typeof parsed?.paymentType === "string" && parsed.paymentType ? parsed.paymentType : "Cash",
      note: typeof parsed?.note === "string" ? parsed.note : "",
    };
  } catch {
    return fallback;
  }
}

export type CategoryStyle = { icon: string; tint: string; fg: string };

// Carried over from the old hardcoded CATEGORIES grid on the Expense list so the handful
// of categories a real shopkeeper is most likely to type (or that bulk-imported .vyb data
// already uses) keep looking exactly the way they used to. Keyed lowercase so matching is
// case-insensitive.
const KNOWN_CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "office rent": { icon: "🏢", tint: "#dbeafe", fg: "#1d4ed8" },
  "rent": { icon: "🏢", tint: "#dbeafe", fg: "#1d4ed8" },
  "salaries": { icon: "👥", tint: "#fce7f3", fg: "#be185d" },
  "salary": { icon: "👥", tint: "#fce7f3", fg: "#be185d" },
  "utilities": { icon: "⚡", tint: "#fef3c7", fg: "#b45309" },
  "travel & fuel": { icon: "🚗", tint: "#dcfce7", fg: "#15803d" },
  "travel": { icon: "🚗", tint: "#dcfce7", fg: "#15803d" },
  "transport": { icon: "🚗", tint: "#dcfce7", fg: "#15803d" },
  "fuel": { icon: "🚗", tint: "#dcfce7", fg: "#15803d" },
  "manufacturing": { icon: "🏭", tint: "#e0f2fe", fg: "#0369a1" },
  "marketing": { icon: "📣", tint: "#ede9fe", fg: "#6d28d9" },
  "misc": { icon: "📦", tint: "#e0e7ff", fg: "#4338ca" },
  "other": { icon: "📦", tint: "#e0e7ff", fg: "#4338ca" },
  [UNCATEGORIZED.toLowerCase()]: { icon: "❔", tint: "#f1f5f9", fg: "#475569" },
};

// Deterministic fallback palette for any free-text category a shopkeeper typed that isn't
// one of the known names above — picked by hashing the name, so the same custom category
// always lands on the same icon/tint instead of looking randomly different every render.
const FALLBACK_PALETTE: CategoryStyle[] = [
  { icon: "🧾", tint: "#fee2e2", fg: "#b91c1c" },
  { icon: "🛠️", tint: "#e0f2fe", fg: "#0369a1" },
  { icon: "🧰", tint: "#fef9c3", fg: "#854d0e" },
  { icon: "🧺", tint: "#f3e8ff", fg: "#7e22ce" },
  { icon: "🚚", tint: "#d1fae5", fg: "#047857" },
  { icon: "💡", tint: "#ffedd5", fg: "#c2410c" },
  { icon: "🧵", tint: "#e0e7ff", fg: "#4338ca" },
  { icon: "📐", tint: "#cffafe", fg: "#0e7490" },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function styleForCategory(name: string): CategoryStyle {
  const key = name.trim().toLowerCase();
  return KNOWN_CATEGORY_STYLES[key] ?? FALLBACK_PALETTE[hashStr(key) % FALLBACK_PALETTE.length];
}

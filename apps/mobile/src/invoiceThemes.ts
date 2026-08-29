// Mirrors packages/ui/src/screens/InvoicePreviewModal.tsx's THEME_MAP — same theme
// names and flags, so the two platforms conceptually match even though desktop renders
// React/CSS and mobile renders an HTML string (buildInvoiceHtml) via expo-print, plus a
// separate native preview (InvoicePreviewNative) since there's no WebView here to share
// one renderer between "live preview" and "what actually prints."
export type ThemeConfig = {
  headerBand: boolean; colorTitle: boolean; colorTableHead: boolean;
  colorSectionHead: boolean; thermal: boolean;
  bordered?: boolean; taxSummaryTable?: boolean; bannerRounded?: boolean; amountsBesideTable?: boolean;
};

export const THEME_MAP: Record<string, ThemeConfig> = {
  "Classic":           { headerBand: false, colorTitle: false, colorTableHead: false, colorSectionHead: false, thermal: false },
  "Tally Theme":       { headerBand: false, colorTitle: false, colorTableHead: false, colorSectionHead: false, thermal: false, bordered: true },
  "Landscape Theme 1": { headerBand: false, colorTitle: false, colorTableHead: false, colorSectionHead: false, thermal: false, bordered: true, taxSummaryTable: true },
  "Landscape Theme 2": { headerBand: false, colorTitle: false, colorTableHead: true,  colorSectionHead: true,  thermal: false, bordered: true, taxSummaryTable: true },
  "Tax Theme 1":       { headerBand: false, colorTitle: false, colorTableHead: false, colorSectionHead: false, thermal: false, bordered: true, taxSummaryTable: true },
  "Tax Theme 2":       { headerBand: true,  colorTitle: true,  colorTableHead: true,  colorSectionHead: true,  thermal: false },
  "Tax Theme 3":       { headerBand: false, colorTitle: true,  colorTableHead: true,  colorSectionHead: true,  thermal: false, bordered: true, taxSummaryTable: true },
  "Tax Theme 4":       { headerBand: true,  colorTitle: false, colorTableHead: true,  colorSectionHead: false, thermal: false },
  "Tax Theme 5":       { headerBand: false, colorTitle: true,  colorTableHead: true,  colorSectionHead: true,  thermal: false },
  "Tax Theme 6":       { headerBand: false, colorTitle: false, colorTableHead: true,  colorSectionHead: false, thermal: false },
  "Double Divine":     { headerBand: true,  colorTitle: false, colorTableHead: true,  colorSectionHead: false, thermal: false, bannerRounded: true, amountsBesideTable: true },
  "French Elite":      { headerBand: true,  colorTitle: false, colorTableHead: true,  colorSectionHead: false, thermal: false, bannerRounded: true },
  "Theme 1":           { headerBand: true,  colorTitle: true,  colorTableHead: true,  colorSectionHead: false, thermal: false },
  "Theme 2":           { headerBand: true,  colorTitle: false, colorTableHead: true,  colorSectionHead: true,  thermal: false },
  "Theme 3":           { headerBand: true,  colorTitle: true,  colorTableHead: true,  colorSectionHead: true,  thermal: false },
  "Theme 4":           { headerBand: true,  colorTitle: true,  colorTableHead: false, colorSectionHead: true,  thermal: false },
  "Thermal Theme 1":   { headerBand: false, colorTitle: false, colorTableHead: false, colorSectionHead: false, thermal: true },
  "Thermal Theme 2":   { headerBand: false, colorTitle: true,  colorTableHead: false, colorSectionHead: false, thermal: true },
  "Thermal Theme 3":   { headerBand: true,  colorTitle: false, colorTableHead: true,  colorSectionHead: false, thermal: true },
  "Thermal Theme 4":   { headerBand: false, colorTitle: false, colorTableHead: false, colorSectionHead: true,  thermal: true },
  "Thermal Theme 5":   { headerBand: true,  colorTitle: true,  colorTableHead: false, colorSectionHead: true,  thermal: true },
};

export const REGULAR_THEMES = [
  "Tally Theme", "Landscape Theme 1", "Landscape Theme 2",
  "Tax Theme 1", "Tax Theme 2", "Tax Theme 3", "Tax Theme 4", "Tax Theme 5", "Tax Theme 6",
  "Double Divine", "French Elite",
  "Theme 1", "Theme 2", "Theme 3", "Theme 4",
];
export const THERMAL_THEMES = ["Thermal Theme 1", "Thermal Theme 2", "Thermal Theme 3", "Thermal Theme 4", "Thermal Theme 5"];

export const COLOR_SWATCHES = [
  "#a78bfa", "#3b82f6", "#9ca3af", "#78716c", "#a3e635",
  "#1d4ed8", "#06b6d4", "#16a34a", "#d97706", "#78350f",
  "#7c3aed", "#6d28d9", "#92400e", "#a16207", "#9333ea",
  "#db2777", "#b45309", "#9f1239", "#dc2626", "#7f1d1d",
  "#f97316", "#eab308", "#ef4444", "#b91c1c", "#000000",
  "#fb923c", "#fbbf24", "#f43f5e", "#111827", "#ffffff",
];

export function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

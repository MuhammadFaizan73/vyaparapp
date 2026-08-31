import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as XLSX from "xlsx";

export type PickedWorkbook = { fileName: string; workbook: XLSX.WorkBook };

// Reads a picked .xls/.xlsx file into a SheetJS workbook. RN has no FileReader/File
// APIs (the read path the desktop importers use), so this reads the picked file's
// cache URI as base64 via expo-file-system instead — the same approach already
// proven in app/party/import.tsx.
export async function pickWorkbook(): Promise<PickedWorkbook | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "*/*",
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" as any });
  const workbook = XLSX.read(b64, { type: "base64" });
  return { fileName: asset.name ?? "file", workbook };
}

// Matches the mixed date-serial / "DD/MM/YYYY" text convention used across every
// legacy-export importer (desktop's ImportSaleHistoryPage etc.) — both must parse
// to the same date.
export function parseSheetDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const s = v.trim();
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const [, dd, mm, yyyy] = dmy;
      const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

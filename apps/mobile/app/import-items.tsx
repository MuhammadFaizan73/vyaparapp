import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as XLSX from "xlsx";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import { useSelectedCompany } from "../src/useSelectedCompany";
import { pickWorkbook } from "../src/xlsxImport";

type TargetKey =
  | "name" | "sku" | "companyTag" | "category"
  | "mrp" | "salePrice" | "purchasePrice"
  | "discountType" | "discount"
  | "openingStock" | "minStock" | "itemLocation"
  | "taxRate" | "inclusiveOfTax"
  | "tertiaryUnit" | "unit" | "secondaryUnit" | "conversionRate" | "tertiaryConversionRate";

type FieldDef = { key: TargetKey; label: string; required?: boolean };

// Same field set + order as packages/ui/src/screens/ImportItemsPage.tsx (TARGET_FIELDS),
// so a file exported from the source system's own Item template maps identically here.
const TARGET_FIELDS: FieldDef[] = [
  { key: "name", label: "Item Name*", required: true },
  { key: "sku", label: "Item Code" },
  { key: "companyTag", label: "Company Name" },
  { key: "category", label: "Category" },
  { key: "mrp", label: "MRP" },
  { key: "salePrice", label: "Sale Price" },
  { key: "purchasePrice", label: "Purchase Price" },
  { key: "discountType", label: "Discount Type" },
  { key: "discount", label: "Sale Discount" },
  { key: "openingStock", label: "Opening Stock Quantity" },
  { key: "minStock", label: "Minimum Stock Quantity" },
  { key: "itemLocation", label: "Item Location" },
  { key: "taxRate", label: "Tax Rate" },
  { key: "inclusiveOfTax", label: "Inclusive Of Tax" },
  { key: "tertiaryUnit", label: "Top Pack Unit" },
  { key: "unit", label: "Unit" },
  { key: "secondaryUnit", label: "Pieces" },
  { key: "conversionRate", label: "Conversion Rate (Unit = n Pieces)" },
  { key: "tertiaryConversionRate", label: "Top Pack Conversion Rate (Top Unit = n Unit)" },
];

// Same synonym table as ImportItemsPage.tsx's FIELD_SYNONYMS — smart column-to-field
// auto-mapping so a user rarely has to touch the mapping step at all.
const FIELD_SYNONYMS: Record<TargetKey, string[]> = {
  name: ["itemname", "name", "productname", "item", "description", "productitemname"],
  sku: ["itemcode", "code", "sku", "itemsku", "productcode", "barcode"],
  companyTag: ["companyname", "company", "companytag", "firm", "firmname"],
  category: ["category", "itemcategory", "productcategory"],
  unit: ["unit", "baseunit", "primaryunit", "uom"],
  secondaryUnit: ["secondaryunit", "secunit", "pieces", "pcs"],
  conversionRate: ["conversionrate", "conversion", "convrate"],
  tertiaryUnit: ["tertiaryunit", "toppackunit", "topunit", "cartonunit"],
  tertiaryConversionRate: ["tertiaryconversionrate", "toppackconversionrate", "topconversion", "cartonconversion"],
  mrp: ["mrp", "defaultmrp", "maxretailprice"],
  salePrice: ["saleprice", "sellingprice", "price", "retailprice"],
  purchasePrice: ["purchaseprice", "costprice", "buyprice", "purchaserate"],
  discount: ["saliscount", "discount", "salediscount", "discountpercent", "discountamount"],
  discountType: ["discounttype"],
  openingStock: ["openingstockquantity", "openingstock", "stock", "qty", "quantity", "openingqty"],
  minStock: ["minimumstockquantity", "minstock", "minimumstock", "minqty", "reorderlevel"],
  itemLocation: ["itemlocation", "location", "storelocation"],
  taxRate: ["taxrate", "tax", "gstrate"],
  inclusiveOfTax: ["inclusiveoftax", "taxinclusive"],
};

const NO_MAP = "__none__";

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMapHeaders(headers: string[]): Record<TargetKey, string> {
  const used = new Set<string>();
  const mapping = {} as Record<TargetKey, string>;
  for (const field of TARGET_FIELDS) {
    const synonyms = FIELD_SYNONYMS[field.key];
    let match = headers.find((h) => !used.has(h) && synonyms.includes(normalizeHeader(h)));
    if (!match) match = headers.find((h) => !used.has(h) && synonyms.some((s) => s.length >= 3 && normalizeHeader(h).includes(s)));
    mapping[field.key] = match ?? NO_MAP;
    if (match) used.add(match);
  }
  return mapping;
}

type ParsedRow = {
  name: string; sku: string; companyTag: string; category: string;
  unit: string; secondaryUnit: string; conversionRate: string;
  tertiaryUnit: string; tertiaryConversionRate: string;
  mrp?: number; salePrice?: number; purchasePrice?: number;
  discountType: string; discount?: number;
  openingStock?: number; minStock?: number; itemLocation: string;
  taxRate?: number; inclusiveOfTax: string;
  errors: string[];
};

type Stage = "upload" | "mapping" | "preview" | "done";

export default function ImportItemsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { companies, selectedCompanyId, selectedCompany } = useSelectedCompany();

  const [stage, setStage] = useState<Stage>("upload");
  const [picking, setPicking] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, string>>({} as Record<TargetKey, string>);
  const [pickerField, setPickerField] = useState<FieldDef | null>(null);

  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [reviewTab, setReviewTab] = useState<"valid" | "errors">("valid");

  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  async function handlePickFile() {
    setPicking(true);
    setParseError(null);
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      setFileName(picked.fileName);
      const ws = picked.workbook.Sheets[picked.workbook.SheetNames[0]!];
      if (!ws) { setParseError("This file has no readable sheet."); return; }
      const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []) as unknown[];
      const cleanHeaders = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
      if (!cleanHeaders.length) { setParseError("Couldn't find a header row in this file."); return; }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      setHeaders(cleanHeaders);
      setRawRows(raw);
      setMapping(autoMapHeaders(cleanHeaders));
      setStage("mapping");
    } catch (err: any) {
      setParseError(err?.message ?? "Couldn't read this file. Make sure it's a valid .xls or .xlsx file.");
    } finally {
      setPicking(false);
    }
  }

  function buildPreview() {
    const rows: ParsedRow[] = rawRows.map((r) => {
      const get = (key: TargetKey): unknown => {
        const h = mapping[key];
        return h && h !== NO_MAP ? r[h] : undefined;
      };
      const num = (v: unknown): number | undefined => {
        const s = String(v ?? "").trim();
        if (!s) return undefined;
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const name = String(get("name") ?? "").trim();
      const errors: string[] = [];
      if (!name) errors.push("Item Name is required");
      return {
        name,
        sku: String(get("sku") ?? "").trim(),
        companyTag: String(get("companyTag") ?? "").trim(),
        category: String(get("category") ?? "").trim(),
        unit: String(get("unit") ?? "").trim(),
        secondaryUnit: String(get("secondaryUnit") ?? "").trim(),
        conversionRate: String(get("conversionRate") ?? "").trim(),
        tertiaryUnit: String(get("tertiaryUnit") ?? "").trim(),
        tertiaryConversionRate: String(get("tertiaryConversionRate") ?? "").trim(),
        mrp: num(get("mrp")),
        salePrice: num(get("salePrice")),
        purchasePrice: num(get("purchasePrice")),
        discountType: String(get("discountType") ?? "").trim(),
        discount: num(get("discount")),
        openingStock: num(get("openingStock")),
        minStock: num(get("minStock")),
        itemLocation: String(get("itemLocation") ?? "").trim(),
        taxRate: num(get("taxRate")),
        inclusiveOfTax: String(get("inclusiveOfTax") ?? "").trim(),
        errors,
      };
    });
    setPreviewRows(rows);
    setReviewTab(rows.some((r) => r.errors.length) ? "errors" : "valid");
    setStage("preview");
  }

  const validRows = previewRows.filter((r) => r.errors.length === 0);
  const errorRows = previewRows.filter((r) => r.errors.length > 0);
  const displayRows = reviewTab === "valid" ? validRows : errorRows;

  async function handleImport() {
    if (!validRows.length) return;
    setImporting(true);
    setImportedCount(0);
    setFailedCount(0);
    let ok = 0, fail = 0;
    for (const r of validRows) {
      try {
        await api.createItem({
          name: r.name,
          sku: r.sku || undefined,
          category: r.category || undefined,
          unit: r.unit || undefined,
          secondaryUnit: r.secondaryUnit || undefined,
          conversionRate: r.conversionRate || undefined,
          tertiaryUnit: r.tertiaryUnit || undefined,
          tertiaryConversionRate: r.tertiaryConversionRate || undefined,
          mrp: r.mrp,
          salePrice: r.salePrice,
          purchasePrice: r.purchasePrice,
          discountType: r.discountType || undefined,
          discount: r.discount,
          openingStock: r.openingStock,
          minStock: r.minStock,
          itemLocation: r.itemLocation || undefined,
          taxRate: r.taxRate,
          inclusiveOfTax: r.inclusiveOfTax || undefined,
          companyTag: r.companyTag || selectedCompany?.name || undefined,
          companyId: (r.companyTag
            ? companies.find((c) => c.name.toLowerCase() === r.companyTag.trim().toLowerCase())?.id
            : selectedCompanyId) || undefined,
        });
        ok++;
      } catch {
        fail++;
      }
      setImportedCount(ok);
      setFailedCount(fail);
    }
    setImporting(false);
    setStage("done");
  }

  function resetAll() {
    setStage("upload"); setFileName(""); setParseError(null);
    setHeaders([]); setRawRows([]); setMapping({} as Record<TargetKey, string>);
    setPreviewRows([]); setImportedCount(0); setFailedCount(0);
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Import Items</Text>
      </View>

      {stage === "upload" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <View style={s.guideCard}>
            <Text style={s.guideTitle}>📋  Upload your Items Excel file</Text>
            <Text style={s.guideText}>Any column order — you'll map columns to fields next. Only Item Name is required.</Text>
          </View>

          <TouchableOpacity style={[s.pickBtn, picking && s.disabled]} onPress={handlePickFile} disabled={picking}>
            {picking ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cloud-upload-outline" size={20} color="#fff" /><Text style={s.pickTxt}>Choose Excel File</Text></>}
          </TouchableOpacity>
          {fileName ? <Text style={s.fileNameTxt}>📄 {fileName}</Text> : null}
          {parseError && <View style={s.errorBanner}><Text style={s.errorTxt}>{parseError}</Text></View>}
        </ScrollView>
      )}

      {stage === "mapping" && (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <Text style={s.fileBadge}>{fileName}</Text>
            <Text style={s.sectionTitle}>Map your columns to Vyapar's fields</Text>
            {TARGET_FIELDS.map((f) => {
              const mapped = mapping[f.key];
              return (
                <TouchableOpacity key={f.key} style={s.mapRow} onPress={() => setPickerField(f)}>
                  <Text style={[s.mapLabel, f.required && s.mapLabelRequired]} numberOfLines={1}>{f.label}</Text>
                  <View style={s.mapValueBox}>
                    <Text style={s.mapValueTxt} numberOfLines={1}>{!mapped || mapped === NO_MAP ? "— Don't import —" : mapped}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={[s.footerRow, { paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={s.outlineBtn} onPress={() => setStage("upload")}><Text style={s.outlineTxt}>Back</Text></TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, (!mapping.name || mapping.name === NO_MAP) && s.disabled]}
              onPress={buildPreview}
              disabled={!mapping.name || mapping.name === NO_MAP}
            >
              <Text style={s.primaryTxt}>Proceed</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={!!pickerField} transparent animationType="fade" onRequestClose={() => setPickerField(null)}>
            <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setPickerField(null)}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{pickerField?.label}</Text>
                <FlatList
                  data={[NO_MAP, ...headers]}
                  keyExtractor={(h) => h}
                  style={{ maxHeight: 360 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={s.modalRow}
                      onPress={() => {
                        if (pickerField) setMapping((prev) => ({ ...prev, [pickerField.key]: item }));
                        setPickerField(null);
                      }}
                    >
                      <Text style={s.modalRowTxt}>{item === NO_MAP ? "— Don't import —" : item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}

      {stage === "preview" && (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <View style={s.tabsRow}>
              <TouchableOpacity style={[s.tabBtn, reviewTab === "valid" && s.tabBtnActive]} onPress={() => setReviewTab("valid")}>
                <Text style={[s.tabTxt, reviewTab === "valid" && s.tabTxtActive]}>✓ Valid: {validRows.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tabBtn, reviewTab === "errors" && s.tabBtnActive]} onPress={() => setReviewTab("errors")}>
                <Text style={[s.tabTxt, reviewTab === "errors" && s.tabTxtActive]}>⚠ Errors: {errorRows.length}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.previewCard}>
              {displayRows.slice(0, 100).map((row, i) => (
                <View key={i} style={s.previewRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.previewName, row.errors.length > 0 && { color: "#dc2626" }]} numberOfLines={1}>{row.name || "(no name)"}</Text>
                    <Text style={s.previewSub} numberOfLines={1}>
                      {row.errors.length ? row.errors.join(", ") : [row.category, row.unit, row.salePrice ? `Rs ${row.salePrice}` : null].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </View>
              ))}
              {displayRows.length === 0 && <Text style={s.moreTxt}>No {reviewTab} rows</Text>}
              {displayRows.length > 100 && <Text style={s.moreTxt}>+ {displayRows.length - 100} more rows</Text>}
            </View>
          </ScrollView>
          <View style={[s.footerRow, { paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={s.outlineBtn} onPress={() => setStage("mapping")} disabled={importing}><Text style={s.outlineTxt}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, (!validRows.length || importing) && s.disabled]} onPress={() => void handleImport()} disabled={!validRows.length || importing}>
              {importing
                ? <Text style={s.primaryTxt}>Importing {importedCount}/{validRows.length}…</Text>
                : <Text style={s.primaryTxt}>Import {validRows.length} Item{validRows.length !== 1 ? "s" : ""}</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}

      {stage === "done" && (
        <View style={s.centerBox}>
          <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
          <Text style={s.doneTitle}>{importedCount} item{importedCount !== 1 ? "s" : ""} imported</Text>
          {failedCount > 0 && <Text style={s.footNote}>{failedCount} item{failedCount !== 1 ? "s" : ""} failed to import.</Text>}
          <TouchableOpacity style={[s.primaryBtn, { marginTop: 20 }]} onPress={() => router.back()}>
            <Text style={s.primaryTxt}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetAll}><Text style={[s.outlineTxt, { marginTop: 12 }]}>Import More</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  guideCard: { backgroundColor: "#fffbeb", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fde68a", marginBottom: 16 },
  guideTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 8 },
  guideText: { fontSize: 13, color: "#78350f" },
  pickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, gap: 10 },
  disabled: { opacity: 0.6 },
  pickTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  fileNameTxt: { fontSize: 13, color: colors.primary, fontWeight: "600", marginTop: 10, textAlign: "center" },
  fileBadge: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  errorBanner: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 12, marginTop: 12 },
  errorTxt: { fontSize: 13, color: "#b91c1c" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 12 },
  mapRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  mapLabel: { flex: 1, fontSize: 13, color: colors.text },
  mapLabelRequired: { fontWeight: "700" },
  mapValueBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 170 },
  mapValueTxt: { fontSize: 12, color: colors.text, maxWidth: 140 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, maxHeight: 460 },
  modalTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  modalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowTxt: { fontSize: 14, color: colors.text },
  tabsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, backgroundColor: "#f1f5f9" },
  tabBtnActive: { backgroundColor: colors.primary },
  tabTxt: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTxtActive: { color: "#fff" },
  previewCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  previewRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewName: { fontSize: 13, fontWeight: "600", color: colors.text },
  previewSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  moreTxt: { fontSize: 12, color: colors.textMuted, textAlign: "center", padding: 10, fontStyle: "italic" },
  footNote: { fontSize: 12, color: colors.textMuted, marginTop: 12, textAlign: "center" },
  footerRow: { flexDirection: "row", gap: 12 },
  outlineBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 100, borderWidth: 1, borderColor: colors.border },
  outlineTxt: { fontSize: 14, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
  primaryBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 13, alignItems: "center" },
  primaryTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  doneTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 12, marginBottom: 8, textAlign: "center" },
});

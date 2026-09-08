import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert, TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../../src/theme";
import { api, getPermissions, getMemberId } from "../../src/auth";
import { canEditSale } from "../../src/permissions";
import { setHandoffTxn } from "../../src/txnHandoff";
import { buildInvoiceHtml, fmt, formatDate } from "../../src/invoiceHtml";
import { useInvoiceHtmlOptions } from "../../src/useSettings";
import { DateRangeFilterBar, type DateRange, getRange, isWithinRange } from "../../src/components/DateRangeFilter";
import { SalesmanFilter } from "../../src/components/SalesmanFilter";
import type { Transaction, Party } from "@vyapar/api-client";

type SaleRow = Transaction & { partyName: string };

const FILTERS = ["All", "Unpaid", "Paid"];
const PAGE_SIZE = 50;

const PARTY_COLORS: Record<string, { tint: string; fg: string }> = {};
const TINTS = [
  { tint: "#dcfce7", fg: "#15803d" },
  { tint: "#fef3c7", fg: "#b45309" },
  { tint: "#ede9fe", fg: "#6d28d9" },
  { tint: "#fce7f3", fg: "#be185d" },
  { tint: "#fff1e6", fg: "#c2410c" },
];
let colorIdx = 0;

function partyHue(name: string) {
  if (!PARTY_COLORS[name]) { PARTY_COLORS[name] = TINTS[colorIdx % TINTS.length]; colorIdx++; }
  return PARTY_COLORS[name];
}

export default function SaleListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState(0);
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // Pagination — a tenant with a very large sale history (e.g. from bulk Excel import) would
  // otherwise have its entire history fetched and rendered in one go, which is what caused the
  // stuck spinner + crash this replaces. partyMap is kept in state (not refetched per page) since
  // it only needs to be loaded once.
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partyMap, setPartyMap] = useState<Record<string, string>>({});
  const [canCreate, setCanCreate] = useState(true);
  const invoiceHtmlOpts = useInvoiceHtmlOptions();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(true);

  // Share sheet state
  const [shareTarget, setShareTarget] = useState<{ sale: SaleRow; idx: number } | null>(null);
  const [shareDefault, setShareDefault] = useState(false);

  // More menu state
  const [menuTarget, setMenuTarget] = useState<{ sale: SaleRow; idx: number } | null>(null);

  // Search — simple toggleable inline bar, same pattern as purchase/index.tsx.
  const [search, setSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Fresh load of the first page — resets pagination and refetches parties. Used on initial
  // mount, screen focus, and pull-to-refresh.
  async function fetchSales() {
    try {
      // A hard JS-level backstop in addition to the API client's own axios timeout — if
      // the request hangs in a way that timeout doesn't catch (seen on some devices),
      // this still guarantees the spinner clears instead of spinning forever with no
      // way to recover short of leaving the screen.
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Sale list load timed out")), 15000);
      });
      const [txns, parties] = await Promise.race([
        Promise.all([
          api.getTransactionsByType("sale", { take: PAGE_SIZE, skip: 0 }),
          api.getParties(),
        ]),
        timeout,
      ]);
      const map: Record<string, string> = {};
      parties.forEach((p: Party) => { map[p.id] = p.name; });
      setPartyMap(map);
      setSales(txns.map((t) => ({ ...t, partyName: map[t.partyId] ?? "Unknown" })));
      setPage(0);
      setHasMore(txns.length === PAGE_SIZE);
      setError("");
    } catch {
      setError("Could not load sales. Pull down to retry.");
    }
  }

  // Fetches the next page and appends it — triggered by scrolling to the end of the list.
  async function loadMoreSales() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      // Same hard JS-level backstop as fetchSales — without it, a hung request left the
      // footer spinner stuck indefinitely with no way to recover short of leaving the screen.
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Sale list load-more timed out")), 15000);
      });
      const nextPage = page + 1;
      const txns = await Promise.race([
        api.getTransactionsByType("sale", { take: PAGE_SIZE, skip: nextPage * PAGE_SIZE }),
        timeout,
      ]);
      setSales((prev) => [...prev, ...txns.map((t) => ({ ...t, partyName: partyMap[t.partyId] ?? "Unknown" }))]);
      setPage(nextPage);
      setHasMore(txns.length === PAGE_SIZE);
    } catch {
      // Leave hasMore as-is — the user can scroll again to retry; the already-loaded pages stay intact.
    } finally {
      setLoadingMore(false);
    }
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchSales().finally(() => setLoading(false));
    getPermissions().then(perms => {
      setCanCreate(perms === null || perms.includes("sale_create"));
      setPermissions(perms);
      setCanDelete(perms === null || perms.includes("sale_delete"));
    });
    getMemberId().then(setMemberId);
  }, []));

  async function onRefresh() {
    setRefreshing(true);
    await fetchSales();
    setRefreshing(false);
  }

  async function handlePrint(sale: SaleRow, idx: number) {
    try {
      await Print.printAsync({ html: buildInvoiceHtml(sale, idx + 1, invoiceHtmlOpts) });
    } catch {
      Alert.alert("Print failed", "Could not open printer.");
    }
  }

  async function handleSharePdf(sale: SaleRow, idx: number) {
    try {
      const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml(sale, idx + 1, invoiceHtmlOpts) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Invoice" });
    } catch {
      Alert.alert("Error", "Could not generate PDF.");
    }
  }

  function toggleSearch() {
    setSearch((v) => !v);
    setSearchText("");
  }

  async function handleExportAllPdf() {
    if (filtered.length === 0) { Alert.alert("No data", "No sales to export."); return; }
    try {
      const pages = filtered.map((s, i) => buildInvoiceHtml(s, i + 1, invoiceHtmlOpts)).join('<div style="page-break-after:always"></div>');
      const { uri } = await Print.printToFileAsync({ html: pages });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export Sales" });
    } catch {
      Alert.alert("Error", "Could not generate PDF.");
    }
  }

  async function handleDuplicate(sale: SaleRow) {
    try {
      await api.createTransaction({
        partyId: sale.partyId,
        type: "sale",
        date: new Date().toISOString(),
        total: sale.total,
        balance: sale.total,
        notes: sale.notes ?? undefined,
        companyId: sale.companyId ?? undefined,
      });
      await fetchSales();
      Alert.alert("Duplicated", "Sale has been duplicated successfully.");
    } catch {
      Alert.alert("Error", "Could not duplicate sale.");
    }
  }

  function handleView(sale: SaleRow) {
    setHandoffTxn(sale);
    router.push(`/txn/${sale.id}` as never);
  }

  function handleEdit(sale: SaleRow) {
    setHandoffTxn(sale);
    router.push({ pathname: "/sale/new", params: { editId: sale.id } } as never);
  }

  function handleDelete(sale: SaleRow) {
    Alert.alert(
      "Delete sale?",
      `This will permanently delete this sale for ${sale.partyName}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            try {
              await api.deleteTransaction(sale.id);
              await fetchSales();
            } catch {
              Alert.alert("Error", "Could not delete this sale.");
            }
          },
        },
      ],
    );
  }

  // Apply status chip filter + date range + party-name search — note this only searches/filters
  // over the pages of `sales` already loaded, not the tenant's entire history, since that's
  // fetched a page at a time now (see fetchSales/loadMoreSales above).
  const filtered = sales.filter((s) => {
    if (!isWithinRange(s.date, range)) return false;
    if (activeFilter === 1 && s.balance <= 0) return false;
    if (activeFilter === 2 && s.balance > 0) return false;
    if (salesmanFilter && s.bookerId !== salesmanFilter) return false;
    if (searchText.trim() && !s.partyName.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const totalSale = filtered.reduce((s, i) => s + i.total, 0);
  const totalPending = filtered.filter((s) => s.balance > 0).reduce((s, i) => s + i.balance, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Sale list</Text>
        <View style={styles.appBarRight}>
          <TouchableOpacity hitSlop={8} onPress={toggleSearch}>
            <Ionicons name="search-outline" size={20} color={search ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfBtn} hitSlop={8} onPress={handleExportAllPdf}>
            <Text style={styles.pdfBtnTxt}>Pdf</Text>
          </TouchableOpacity>
        </View>
      </View>

      <DateRangeFilterBar range={range} onChange={setRange} datesOnly />

      {/* Search bar */}
      {search && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={searchText} onChangeText={setSearchText}
            placeholder="Search by party name…" placeholderTextColor={colors.textLight} autoFocus />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.chipsBar} contentContainerStyle={styles.chipsContent}>
        {FILTERS.map((f, i) => (
          <TouchableOpacity key={f}
            style={[styles.chip, i === activeFilter && styles.chipActive]}
            onPress={() => setActiveFilter(i)}>
            <Text style={[styles.chipTxt, i === activeFilter && styles.chipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}

        <SalesmanFilter value={salesmanFilter} onChange={setSalesmanFilter} />
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textLight} />
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(sale) => sale.id}
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMoreSales}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Sale</Text>
                <Text style={styles.summaryValue}>Rs {fmt(totalSale)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Balance Due</Text>
                <Text style={[styles.summaryValue, { color: colors.orange }]}>Rs {fmt(totalPending)}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTxt}>
                {searchText.trim() ? `No results for "${searchText.trim()}"` : "No sales yet"}
              </Text>
              <Text style={styles.emptySub}>
                {searchText.trim()
                  ? "Try a different name or clear the search"
                  : "Tap + Add Sale to create your first invoice"}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listFooter}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item: sale, index: idx }) => {
            const isPaid = sale.balance === 0;
            const isPartial = sale.balance > 0 && sale.balance < sale.total;
            const statusStyle = isPaid ? styles.statusPaid : isPartial ? styles.statusPartial : styles.statusUnpaid;
            const statusTxtStyle = isPaid ? styles.statusTxtPaid : isPartial ? styles.statusTxtPartial : styles.statusTxtUnpaid;
            const statusLabel = isPaid ? "PAID" : isPartial ? "PARTIAL" : "UNPAID";
            return (
              <TouchableOpacity style={styles.saleCard} activeOpacity={0.8} onPress={() => handleView(sale)}>
                <View style={styles.saleTop}>
                  <View style={styles.saleMid}>
                    <View style={styles.saleNameRow}>
                      <Text style={styles.partyName}>{sale.partyName}</Text>
                      <View style={[styles.statusBadge, statusStyle]}>
                        <Text style={[styles.statusTxt, statusTxtStyle]}>{statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.saleAmount}>Rs {fmt(sale.total)}</Text>
                  </View>
                  <View style={styles.saleRight}>
                    <Text style={styles.saleNumber}>Sale #{idx + 1}</Text>
                    <Text style={styles.saleDate}>{formatDate(sale.date)}</Text>
                  </View>
                </View>

                <View style={styles.saleBottom}>
                  <Text style={styles.balanceTxt}>
                    Balance: Rs {fmt(sale.balance)}
                  </Text>
                  <View style={styles.saleActions}>
                    <TouchableOpacity hitSlop={8} onPress={() => handlePrint(sale, idx)}>
                      <Ionicons name="print-outline" size={18} color={colors.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => setShareTarget({ sale, idx })}>
                      <Ionicons name="share-social-outline" size={18} color={colors.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => setMenuTarget({ sale, idx })}>
                      <Ionicons name="ellipsis-vertical" size={18} color={colors.textLight} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FAB — only visible if user has sale_create permission */}
      {canCreate && (
        <View style={[styles.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
          <TouchableOpacity style={styles.fab} onPress={() => router.push("/sale/new")}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.fabTxt}>Add Sale</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Share Transaction bottom sheet ── */}
      <Modal
        visible={!!shareTarget}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShareTarget(null)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShareTarget(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Share transaction</Text>
            <View style={styles.shareRow}>
              <TouchableOpacity
                style={styles.shareImgBtn}
                onPress={async () => {
                  setShareTarget(null);
                  if (shareTarget) await handleSharePdf(shareTarget.sale, shareTarget.idx);
                }}
              >
                <Ionicons name="image-outline" size={24} color="#fff" />
                <Text style={styles.shareImgTxt}>Share as Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sharePdfBtn}
                onPress={async () => {
                  setShareTarget(null);
                  if (shareTarget) await handleSharePdf(shareTarget.sale, shareTarget.idx);
                }}
              >
                <View style={styles.sharePdfIcon}>
                  <Text style={styles.sharePdfIconTxt}>Pdf</Text>
                </View>
                <Text style={styles.sharePdfTxt}>Share as PDF</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.defaultRow}
              onPress={() => setShareDefault(!shareDefault)}
            >
              <View style={[styles.checkbox, shareDefault && styles.checkboxOn]}>
                {shareDefault && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <View>
                <Text style={styles.defaultLabel}>Make this as default</Text>
                <Text style={styles.defaultSub}>To change later go to transaction settings*</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── More Menu bottom sheet ── */}
      <Modal
        visible={!!menuTarget}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuTarget(null)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuTarget(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {[
              { label: "View", icon: "eye-outline" as const, show: true, action: () => { if (menuTarget) { setMenuTarget(null); handleView(menuTarget.sale); } } },
              { label: "Edit", icon: "create-outline" as const, show: !!menuTarget && canEditSale(menuTarget.sale, permissions, memberId), action: () => { if (menuTarget) { setMenuTarget(null); handleEdit(menuTarget.sale); } } },
              { label: "Duplicate", icon: "copy-outline" as const, show: true, action: async () => { if (menuTarget) { setMenuTarget(null); await handleDuplicate(menuTarget.sale); } } },
              { label: "Receive Payment", icon: "cash-outline" as const, show: true, action: () => {
                if (!menuTarget) return;
                setMenuTarget(null);
                router.push({
                  pathname: "/payment-in/new",
                  params: {
                    prefillPartyId: menuTarget.sale.partyId,
                    prefillPartyName: menuTarget.sale.partyName,
                    prefillAmount: String(menuTarget.sale.balance > 0 ? menuTarget.sale.balance : menuTarget.sale.total),
                    prefillSaleId: menuTarget.sale.id,
                  },
                } as never);
              } },
              { label: "Return", icon: "return-down-back-outline" as const, show: true, action: () => { setMenuTarget(null); Alert.alert("Return", "Coming soon."); } },
              { label: "Delivery Note", icon: "document-text-outline" as const, show: true, action: () => { setMenuTarget(null); Alert.alert("Delivery Note", "Coming soon."); } },
              { label: "Share as PDF", icon: "share-outline" as const, show: true, action: async () => { if (menuTarget) { setMenuTarget(null); await handleSharePdf(menuTarget.sale, menuTarget.idx); } } },
              { label: "Delete", icon: "trash-outline" as const, show: canDelete, danger: true, action: () => { if (menuTarget) { setMenuTarget(null); handleDelete(menuTarget.sale); } } },
            ].filter((item) => item.show).map(({ label, icon, action, danger }, i, arr) => (
              <TouchableOpacity
                key={label}
                style={[styles.menuRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={action}
              >
                <Ionicons name={icon as any} size={20} color={danger ? "#dc2626" : colors.text} />
                <Text style={[styles.menuLabel, danger && { color: "#dc2626" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  pdfBtn: { backgroundColor: colors.redLight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pdfBtnTxt: { fontSize: 11, fontWeight: "700", color: colors.red },

  searchBar: {
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  chipsBar: { flexGrow: 0, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  chipsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  errorTxt: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  body: { padding: 16, paddingBottom: 110, gap: 10 },
  listFooter: { paddingVertical: 16, alignItems: "center" },

  summaryCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", overflow: "hidden" },
  summaryItem: { flex: 1, padding: 16 },
  summaryLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "500", marginBottom: 4 },
  summaryValue: { fontSize: 17, fontWeight: "700", color: colors.text },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: "center" },

  saleCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  saleTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  partyAvatar: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  partyAvatarTxt: { fontSize: 16, fontWeight: "700" },
  saleMid: { flex: 1, gap: 4 },
  saleNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  partyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  saleAmount: { fontSize: 15, fontWeight: "700", color: colors.text },
  saleRight: { alignItems: "flex-end", gap: 2 },
  saleNumber: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  saleDate: { fontSize: 11.5, color: colors.textLight },
  statusBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  statusPaid: { backgroundColor: colors.greenLight },
  statusUnpaid: { backgroundColor: "#fff3e0" },
  statusPartial: { backgroundColor: colors.blueLight },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  statusTxtPaid: { color: colors.green },
  statusTxtUnpaid: { color: colors.amber },
  statusTxtPartial: { color: colors.blue },
  saleBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f4f6fa" },
  balanceTxt: { fontSize: 12.5, color: colors.textMuted },
  saleActions: { flexDirection: "row", gap: 16, alignItems: "center" },

  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.red, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 13, shadowColor: colors.red, shadowOpacity: 0.3, shadowRadius: 16, elevation: 7 },
  fabTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },

  // Bottom sheet shared
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

  // Share sheet
  shareRow: { flexDirection: "row", gap: 12 },
  shareImgBtn: { flex: 1, backgroundColor: colors.red, borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  shareImgTxt: { color: "#fff", fontWeight: "600", fontSize: 14 },
  sharePdfBtn: { flex: 1, backgroundColor: "#f1f5f9", borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  sharePdfIcon: { backgroundColor: colors.redLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sharePdfIconTxt: { fontSize: 11, fontWeight: "700", color: colors.red },
  sharePdfTxt: { color: colors.text, fontWeight: "600", fontSize: 14 },
  defaultRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  defaultLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  defaultSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  // More menu
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuLabel: { fontSize: 15, fontWeight: "500", color: colors.text },
});

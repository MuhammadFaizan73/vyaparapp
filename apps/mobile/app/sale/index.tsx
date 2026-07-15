import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert, Animated, TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
let Voice: any = null;
try { Voice = require("@react-native-voice/voice").default; } catch { /* not available in Expo Go */ }
import { colors } from "../../src/theme";
import { api, getPermissions } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type SaleRow = Transaction & { partyName: string };

interface VoiceFilter {
  partySearch?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: "paid" | "unpaid";
  label: string;
}

const FILTERS = ["All", "Unpaid", "Paid"];

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

function fmt(n: number) { return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}

function numberToWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  return numberToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numberToWords(n % 100000) : "");
}

// Parse spoken text into structured filters.
// Supports: party names, date ranges (today/this week/last week/this month/last month),
// and payment status (paid/unpaid).
function parseVoiceCommand(text: string): VoiceFilter | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase().trim();
  const now = new Date();
  const filter: VoiceFilter = { label: text.trim() };

  // Status
  if (/\b(unpaid|pending|due|outstanding|baki|baqi)\b/.test(lower)) {
    filter.status = "unpaid";
  } else if (/\b(paid|cleared|settled|received|ada)\b/.test(lower)) {
    filter.status = "paid";
  }

  // Date ranges
  if (/\btoday\b|\baj\b/.test(lower)) {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    const e = new Date(now); e.setHours(23, 59, 59, 999);
    filter.dateFrom = s; filter.dateTo = e;
  } else if (/\bthis week\b/.test(lower)) {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
    filter.dateFrom = s; filter.dateTo = new Date();
  } else if (/\blast week\b/.test(lower)) {
    const e = new Date(now); e.setDate(now.getDate() - now.getDay() - 1); e.setHours(23, 59, 59, 999);
    const s = new Date(e); s.setDate(e.getDate() - 6); s.setHours(0, 0, 0, 0);
    filter.dateFrom = s; filter.dateTo = e;
  } else if (/\bthis month\b/.test(lower)) {
    filter.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    filter.dateTo = new Date();
  } else if (/\blast month\b/.test(lower)) {
    filter.dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    filter.dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  // Extract party name: strip all known keyword tokens and keep what remains
  const nameText = lower
    .replace(/\b(show|find|search|display|all|invoices?|bills?|sales?|for|from|of|customer|party|the|a|an|me|my|and|in|with|that|are|is)\b/g, "")
    .replace(/\b(paid|unpaid|pending|due|cleared|settled|received|outstanding|baki|baqi|ada)\b/g, "")
    .replace(/\b(today|aj|this|last|week|month|year)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (nameText.length > 1) filter.partySearch = nameText;

  // Fallback: whole text is probably a name
  if (!filter.status && !filter.dateFrom && !filter.partySearch) {
    filter.partySearch = text.trim();
  }

  return filter;
}

function buildInvoiceHtml(sale: SaleRow, idx: number): string {
  const received = sale.total - sale.balance;
  const amountWords = numberToWords(Math.round(sale.total)) + " Rupees only";
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 20px; }
  .company { font-weight: bold; font-size: 14px; }
  .phone { color: #555; font-size: 10px; margin-bottom: 4px; }
  hr { border: none; border-top: 1px solid #aaa; margin: 6px 0; }
  .title { text-align: center; color: #6366f1; font-size: 15px; font-weight: bold; margin: 8px 0; }
  .two-col { display: flex; justify-content: space-between; margin: 8px 0; }
  .bill-to { font-weight: bold; }
  .inv-details { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  thead tr { background: #6366f1; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-size: 10px; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; }
  .summary { display: flex; justify-content: space-between; margin-top: 10px; }
  .words { flex: 1; }
  .amounts { text-align: right; min-width: 200px; }
  .amounts table { margin: 0; }
  .amounts td { padding: 2px 6px; }
  .highlight { background: #6366f1; color: #fff; font-weight: bold; }
  .footer-sig { text-align: right; margin-top: 40px; font-weight: bold; }
  .footer-brand { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; color: #6366f1; font-size: 10px; }
</style></head><body>
  <div class="company">Godigi</div>
  <div class="phone">Phone no.: ${sale.partyName}</div>
  <hr/>
  <div class="title">Invoice</div>
  <div class="two-col">
    <div>
      <div style="font-size:10px;color:#555;">Bill To</div>
      <div class="bill-to">${sale.partyName}</div>
    </div>
    <div class="inv-details">
      <div style="font-size:10px;color:#555;">Invoice Details</div>
      <div>Invoice No.: ${idx + 1}</div>
      <div>Date: ${formatDate(sale.date)}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Item name</th><th>Quantity</th><th>Unit</th><th>Price/ Unit</th><th>Amount</th>
    </tr></thead>
    <tbody>
      <tr><td>1</td><td>—</td><td>1</td><td>—</td><td>Rs ${fmt(sale.total)}</td><td>Rs ${fmt(sale.total)}</td></tr>
      <tr class="total-row"><td colspan="3"><strong>Total</strong></td><td>1</td><td></td><td><strong>Rs ${fmt(sale.total)}</strong></td></tr>
    </tbody>
  </table>
  <div class="summary">
    <div class="words">
      <div><strong>Invoice Amount In Words</strong></div>
      <div>${amountWords}</div>
      <br/>
      <div><strong>Terms And Conditions</strong></div>
      <div>Thanks for doing business with us!</div>
    </div>
    <div class="amounts">
      <table>
        <tr><td>Sub Total</td><td>Rs ${fmt(sale.total)}</td></tr>
        <tr class="highlight"><td>Total</td><td>Rs ${fmt(sale.total)}</td></tr>
        <tr><td>Received</td><td>Rs ${fmt(received)}</td></tr>
        <tr><td>Balance</td><td>Rs ${fmt(sale.balance)}</td></tr>
      </table>
    </div>
  </div>
  <div class="footer-sig">For: Godigi<br/><br/><br/>Authorized Signatory</div>
  <div class="footer-brand"><span>▼ Godigi</span></div>
</body></html>`;
}

export default function SaleListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState(0);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [canCreate, setCanCreate] = useState(true);

  // Share sheet state
  const [shareTarget, setShareTarget] = useState<{ sale: SaleRow; idx: number } | null>(null);
  const [shareDefault, setShareDefault] = useState(false);

  // More menu state
  const [menuTarget, setMenuTarget] = useState<{ sale: SaleRow; idx: number } | null>(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [voicePartial, setVoicePartial] = useState("");
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Text search fallback (used when native voice module isn't available)
  const [showTextSearch, setShowTextSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Wire up voice recognition callbacks
  useEffect(() => {
    try {
      Voice.onSpeechEnd = () => {
        pulseLoop.current?.stop();
        pulseAnim.setValue(1);
        setIsListening(false);
      };

      Voice.onSpeechPartialResults = (e) => {
        if (e.value?.[0]) setVoicePartial(e.value[0]);
      };

      Voice.onSpeechResults = (e) => {
        const text = e.value?.[0] ?? "";
        if (text) {
          const f = parseVoiceCommand(text);
          if (f) setVoiceFilter(f);
        }
        setVoicePartial("");
        pulseLoop.current?.stop();
        pulseAnim.setValue(1);
        setIsListening(false);
      };

      Voice.onSpeechError = () => {
        pulseLoop.current?.stop();
        pulseAnim.setValue(1);
        setIsListening(false);
        setVoicePartial("");
      };
    } catch {
      // Native module unavailable — callbacks won't fire, fallback handles it
    }

    return () => {
      try {
        Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
      } catch {
        // Native module unavailable — skip cleanup
      }
    };
  }, [pulseAnim]);

  async function startListening() {
    try {
      const available = await Voice.isAvailable();
      if (!available) {
        setSearchText("");
        setShowTextSearch(true);
        return;
      }
      setVoicePartial("");
      await Voice.start("en-US");
      setIsListening(true);
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } catch {
      // Native voice module not available — fall back to text search
      setSearchText("");
      setShowTextSearch(true);
    }
  }

  function submitTextSearch() {
    const text = searchText.trim();
    if (text) {
      const f = parseVoiceCommand(text);
      if (f) setVoiceFilter(f);
    }
    setShowTextSearch(false);
    setSearchText("");
  }

  async function stopListening() {
    try { await Voice.stop(); } catch { /* ignore */ }
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setIsListening(false);
    setVoicePartial("");
  }

  async function fetchSales() {
    try {
      const [txns, parties] = await Promise.all([
        api.getTransactionsByType("sale"),
        api.getParties(),
      ]);
      const partyMap: Record<string, string> = {};
      parties.forEach((p: Party) => { partyMap[p.id] = p.name; });
      setSales(txns.map((t) => ({ ...t, partyName: partyMap[t.partyId] ?? "Unknown" })));
      setError("");
    } catch {
      setError("Could not load sales. Pull down to retry.");
    }
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchSales().finally(() => setLoading(false));
    getPermissions().then(perms => {
      setCanCreate(perms === null || perms.includes("sale_create"));
    });
  }, []));

  async function onRefresh() {
    setRefreshing(true);
    await fetchSales();
    setRefreshing(false);
  }

  async function handlePrint(sale: SaleRow, idx: number) {
    try {
      await Print.printAsync({ html: buildInvoiceHtml(sale, idx) });
    } catch {
      Alert.alert("Print failed", "Could not open printer.");
    }
  }

  async function handleSharePdf(sale: SaleRow, idx: number) {
    try {
      const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml(sale, idx) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Invoice" });
    } catch {
      Alert.alert("Error", "Could not generate PDF.");
    }
  }

  function toggleSearch() {
    if (showTextSearch) {
      setShowTextSearch(false);
      setSearchText("");
    } else {
      setSearchText("");
      setShowTextSearch(true);
    }
  }

  async function handleExportAllPdf() {
    if (filtered.length === 0) { Alert.alert("No data", "No sales to export."); return; }
    try {
      const pages = filtered.map((s, i) => buildInvoiceHtml(s, i + 1)).join('<div style="page-break-after:always"></div>');
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
      });
      await fetchSales();
      Alert.alert("Duplicated", "Sale has been duplicated successfully.");
    } catch {
      Alert.alert("Error", "Could not duplicate sale.");
    }
  }

  // Apply status chip filter + voice filter
  const filtered = sales.filter((s) => {
    if (activeFilter === 1 && s.balance <= 0) return false;
    if (activeFilter === 2 && s.balance > 0) return false;
    if (voiceFilter) {
      if (voiceFilter.status === "paid" && s.balance !== 0) return false;
      if (voiceFilter.status === "unpaid" && s.balance === 0) return false;
      if (voiceFilter.partySearch &&
        !s.partyName.toLowerCase().includes(voiceFilter.partySearch.toLowerCase())) return false;
      if (voiceFilter.dateFrom && new Date(s.date) < voiceFilter.dateFrom) return false;
      if (voiceFilter.dateTo && new Date(s.date) > voiceFilter.dateTo) return false;
    }
    return true;
  });

  const totalSale = sales.reduce((s, i) => s + i.total, 0);
  const totalPending = sales.filter((s) => s.balance > 0).reduce((s, i) => s + i.balance, 0);

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
            <Ionicons name="search-outline" size={20} color={showTextSearch ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
          {/* Voice AI mic button */}
          <TouchableOpacity
            hitSlop={8}
            onPress={isListening ? stopListening : startListening}
            style={[styles.micBtn, isListening && styles.micBtnActive]}
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={20}
              color={isListening ? "#fff" : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfBtn} hitSlop={8} onPress={handleExportAllPdf}>
            <Text style={styles.pdfBtnTxt}>Pdf</Text>
          </TouchableOpacity>
        </View>
      </View>

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

        {/* Voice filter dismissible chip */}
        {voiceFilter && (
          <View style={styles.voiceChip}>
            <Ionicons name="mic" size={12} color={colors.primary} />
            <Text style={styles.voiceChipTxt} numberOfLines={1}>{voiceFilter.label}</Text>
            <TouchableOpacity hitSlop={8} onPress={() => setVoiceFilter(null)}>
              <Ionicons name="close-circle" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textLight} />
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Summary */}
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

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyTxt}>
                {voiceFilter ? `No results for "${voiceFilter.label}"` : "No sales yet"}
              </Text>
              <Text style={styles.emptySub}>
                {voiceFilter
                  ? "Try a different voice command or clear the filter"
                  : "Tap + Add Sale to create your first invoice"}
              </Text>
              {voiceFilter && (
                <TouchableOpacity style={styles.clearVoiceBtn} onPress={() => setVoiceFilter(null)}>
                  <Text style={styles.clearVoiceBtnTxt}>Clear voice filter</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((sale, idx) => {
              const isPaid = sale.balance === 0;
              const isPartial = sale.balance > 0 && sale.balance < sale.total;
              const statusStyle = isPaid ? styles.statusPaid : isPartial ? styles.statusPartial : styles.statusUnpaid;
              const statusTxtStyle = isPaid ? styles.statusTxtPaid : isPartial ? styles.statusTxtPartial : styles.statusTxtUnpaid;
              const statusLabel = isPaid ? "PAID" : isPartial ? "PARTIAL" : "UNPAID";
              return (
                <View key={sale.id} style={styles.saleCard}>
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
                </View>
              );
            })
          )}
        </ScrollView>
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

      {/* ── Text search fallback (Expo Go / no native voice module) ── */}
      <Modal
        visible={showTextSearch}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowTextSearch(false)}
      >
        <TouchableOpacity style={styles.voiceOverlay} activeOpacity={1} onPress={() => setShowTextSearch(false)}>
          <View style={styles.voiceSheet}>
            <View style={styles.textSearchHeader}>
              <Ionicons name="mic-outline" size={22} color={colors.primary} />
              <Text style={styles.textSearchTitle}>Voice Search</Text>
            </View>

            <TextInput
              style={styles.textSearchInput}
              placeholder='e.g. "Ali Ahmed" or "unpaid this month"'
              placeholderTextColor={colors.textLight}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={submitTextSearch}
            />

            <View style={styles.voiceExamples}>
              {["Show Ali Ahmed", "Unpaid this month", "Last week paid", "Today"].map((ex) => (
                <TouchableOpacity
                  key={ex}
                  style={styles.voiceExampleChip}
                  onPress={() => { setSearchText(ex); }}
                >
                  <Text style={styles.voiceExampleItem}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.textSearchBtn} onPress={submitTextSearch}>
              <Text style={styles.textSearchBtnTxt}>Search</Text>
            </TouchableOpacity>

            <Text style={styles.voiceTapCancel}>Tap outside to cancel</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Voice Listening overlay ── */}
      <Modal
        visible={isListening}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={stopListening}
      >
        <TouchableOpacity style={styles.voiceOverlay} activeOpacity={1} onPress={stopListening}>
          <View style={styles.voiceSheet}>
            <Animated.View style={[styles.voicePulseRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.voiceMicCircle}>
                <Ionicons name="mic" size={34} color="#fff" />
              </View>
            </Animated.View>

            <Text style={styles.voiceListeningTxt}>Listening…</Text>

            {voicePartial ? (
              <Text style={styles.voicePartialTxt}>"{voicePartial}"</Text>
            ) : (
              <Text style={styles.voiceHintTxt}>Say a customer name, date, or status</Text>
            )}

            <View style={styles.voiceExamples}>
              {['"Show Ali Ahmed"', '"Unpaid this month"', '"Last week paid"'].map((ex) => (
                <View key={ex} style={styles.voiceExampleChip}>
                  <Text style={styles.voiceExampleItem}>{ex}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.voiceTapCancel}>Tap anywhere to cancel</Text>
          </View>
        </TouchableOpacity>
      </Modal>

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
              { label: "Duplicate", icon: "copy-outline", action: async () => { if (menuTarget) { setMenuTarget(null); await handleDuplicate(menuTarget.sale); } } },
              { label: "Receive Payment", icon: "cash-outline", action: () => {
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
              { label: "Return", icon: "return-down-back-outline", action: () => { setMenuTarget(null); Alert.alert("Return", "Coming soon."); } },
              { label: "Delivery Note", icon: "document-text-outline", action: () => { setMenuTarget(null); Alert.alert("Delivery Note", "Coming soon."); } },
              { label: "Share as PDF", icon: "share-outline", action: async () => { if (menuTarget) { setMenuTarget(null); await handleSharePdf(menuTarget.sale, menuTarget.idx); } } },
            ].map(({ label, icon, action }, i, arr) => (
              <TouchableOpacity
                key={label}
                style={[styles.menuRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={action}
              >
                <Ionicons name={icon as any} size={20} color={colors.text} />
                <Text style={styles.menuLabel}>{label}</Text>
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

  micBtn: { padding: 4, borderRadius: 8 },
  micBtnActive: { backgroundColor: colors.primary, padding: 6, borderRadius: 8 },

  chipsBar: { flexGrow: 0, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  chipsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  // Voice filter chip (in the chips bar)
  voiceChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: "#eff6ff", maxWidth: 200,
  },
  voiceChipTxt: { fontSize: 12, fontWeight: "600", color: colors.primary, flexShrink: 1 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  errorTxt: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  body: { padding: 16, paddingBottom: 110, gap: 10 },

  summaryCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", overflow: "hidden" },
  summaryItem: { flex: 1, padding: 16 },
  summaryLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "500", marginBottom: 4 },
  summaryValue: { fontSize: 17, fontWeight: "700", color: colors.text },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  clearVoiceBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#eff6ff", borderRadius: 100, borderWidth: 1, borderColor: colors.primary },
  clearVoiceBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.primary },

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

  // Text search fallback styles
  textSearchHeader: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  textSearchTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  textSearchInput: {
    width: "100%", borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: colors.text,
    backgroundColor: "#f8faff",
  },
  voiceExampleChip: { backgroundColor: "#f1f5f9", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  textSearchBtn: {
    width: "100%", backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  textSearchBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Voice listening overlay
  voiceOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "flex-end" },
  voiceSheet: {
    width: "100%", backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 40, paddingBottom: 48, paddingHorizontal: 28, alignItems: "center", gap: 14,
  },
  voicePulseRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${colors.primary}22`,
    alignItems: "center", justifyContent: "center",
  },
  voiceMicCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  voiceListeningTxt: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 4 },
  voicePartialTxt: {
    fontSize: 15, color: colors.primary, fontWeight: "500", textAlign: "center",
    fontStyle: "italic", paddingHorizontal: 16,
  },
  voiceHintTxt: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  voiceExamples: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4, width: "100%" },
  voiceExampleItem: { fontSize: 11.5, color: colors.textMuted },
  voiceTapCancel: { fontSize: 12, color: colors.textLight, marginTop: 8 },

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

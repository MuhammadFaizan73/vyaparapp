import { useState, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, ScrollView, Modal, Pressable, Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../../src/theme";
import { api, getPermissions, getRole, getStaffName, getStaffContact, getMemberId } from "../../src/auth";
import { canEditSale } from "../../src/permissions";
import { setHandoffTxn } from "../../src/txnHandoff";
import { buildInvoiceHtml } from "../../src/invoiceHtml";
import { useInvoiceHtmlOptions, useSettings } from "../../src/useSettings";
import { getItems as getCachedItems, loadItems, subscribeItems, type Item } from "../../src/itemsStore";
import type { Party, Transaction } from "@vyapar/api-client";

export default function HomeScreen() {
  const { settings, loaded } = useSettings();
  if (!loaded) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (settings.appTheme === "trending") return <TrendingHome />;
  if (settings.appTheme === "modern") return <ModernHome />;
  return <StandardHome />;
}

/* ══════════════════════════════ Standard ══════════════════════════════ */

type GridItem = { label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; route: string };

const GRID_ITEMS: GridItem[] = [
  { label: "Sale list",     icon: "document-text-outline", route: "/sale" },
  { label: "Purchase List", icon: "cart-outline",           route: "/purchase" },
  { label: "Stock Items",   icon: "list-outline",           route: "/items" },
  { label: "Parties",       icon: "people-outline",         route: "/party" },
];

function StandardHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setParties(await api.getParties());
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Same reduce logic as packages/ui/src/screens/HomeScreen.tsx's Total Receivable/Payable
  // cards — positive party balance = they owe us, negative = we owe them.
  const receivable = parties.filter((p) => (p.balance ?? 0) > 0).reduce((sum, p) => sum + (p.balance ?? 0), 0);
  const payable = parties.filter((p) => (p.balance ?? 0) < 0).reduce((sum, p) => sum + Math.abs(p.balance ?? 0), 0);

  const q = search.toLowerCase();
  const filteredParties = q
    ? parties.filter((p) => p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q))
    : [];

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/menu" as never)} hitSlop={8}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.iconBtn} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-redo-outline" size={21} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textLight} />
        <TextInput
          style={s.searchInput}
          placeholder="Search parties by name or phone"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : q ? (
        <FlatList
          data={filteredParties}
          keyExtractor={(p) => p.id}
          contentContainerStyle={s.searchList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={s.searchRow} onPress={() => router.push(`/party/${item.id}` as never)} activeOpacity={0.8}>
              <View style={s.searchAvatar}>
                <Text style={s.searchAvatarTxt}>{item.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.searchRowTitle} numberOfLines={1}>{item.name}</Text>
                {item.phone ? <Text style={s.searchRowSub}>{item.phone}</Text> : null}
              </View>
              <Text style={[s.searchRowAmt, { color: (item.balance ?? 0) > 0 ? colors.red : colors.green }]}>
                Rs {Math.abs(item.balance ?? 0).toLocaleString("en-PK")}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="people-outline" size={52} color={colors.border} />
              <Text style={s.emptyTitle}>No matching records</Text>
              <Text style={s.emptySub}>Try a different name or phone number</Text>
            </View>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* To Receive / To Pay */}
          <View style={s.balanceRow}>
            <View style={[s.balanceCard, { backgroundColor: colors.greenBg }]}>
              <Text style={s.balanceLabel}>To Receive</Text>
              <Text style={[s.balanceAmt, { color: colors.green }]}>Rs {receivable.toLocaleString("en-PK")}</Text>
            </View>
            <View style={[s.balanceCard, { backgroundColor: "#fdeaea" }]}>
              <Text style={s.balanceLabel}>To Pay</Text>
              <Text style={[s.balanceAmt, { color: colors.red }]}>Rs {payable.toLocaleString("en-PK")}</Text>
            </View>
          </View>

          {/* 2x2 shortcut grid */}
          <View style={s.grid}>
            {GRID_ITEMS.map((item) => (
              <TouchableOpacity key={item.label} style={s.gridItem} onPress={() => router.push(item.route as never)} activeOpacity={0.8}>
                <View style={s.gridIconWrap}>
                  <Ionicons name={item.icon} size={26} color={colors.primary} />
                </View>
                <Text style={s.gridLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* ══════════════════════════════ Trending ══════════════════════════════ */

type TrendingTab = "parties" | "transactions" | "items";
type TxnRow = Transaction & { partyName: string };

const TRENDING_TABS: { key: TrendingTab; label: string }[] = [
  { key: "parties", label: "Parties" },
  { key: "transactions", label: "Transactions" },
  { key: "items", label: "Items" },
];

function trendingAddLabel(tab: TrendingTab): string {
  return tab === "parties" ? "+ New Party" : tab === "items" ? "+ New Item" : "+ New Sale";
}

// Current-calendar-month total for a txn type plus % change vs the prior month
// (null when there's no prior-month total to compare against).
function monthChange(txns: TxnRow[], type: string): { current: number; pct: number | null } {
  const now = new Date();
  const curM = now.getMonth(), curY = now.getFullYear();
  const prevRef = new Date(curY, curM - 1, 1);
  const prevM = prevRef.getMonth(), prevY = prevRef.getFullYear();
  let current = 0, prev = 0;
  for (const txn of txns) {
    if (txn.type !== type) continue;
    const d = new Date(txn.date);
    if (d.getFullYear() === curY && d.getMonth() === curM) current += txn.total;
    else if (d.getFullYear() === prevY && d.getMonth() === prevM) prev += txn.total;
  }
  return { current, pct: prev > 0 ? ((current - prev) / prev) * 100 : null };
}

function StatCard({ icon, iconColor, bgColor, label, amount, pct, width }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  bgColor: string;
  label: string;
  amount: number;
  pct?: number | null;
  width: number;
}) {
  return (
    <View style={[t.statCard, { width, backgroundColor: bgColor }]}>
      <View style={t.statTop}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={t.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[t.statAmt, { color: iconColor }]} numberOfLines={1}>Rs {amount.toLocaleString("en-PK")}</Text>
      {pct != null ? (
        <View style={t.statPctRow}>
          <Ionicons name={pct < 0 ? "arrow-down" : "arrow-up"} size={11} color={pct < 0 ? colors.red : colors.green} />
          <Text style={[t.statPct, { color: pct < 0 ? colors.red : colors.green }]}>{Math.abs(pct).toFixed(2)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

function TrendingHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  // ~2.2 cards visible at once, so the next card always peeks in rather than
  // getting hard-clipped flush at the screen edge.
  const statCardWidth = Math.round((screenWidth - 12 * 2 - 10) / 2.2);

  const [tab, setTab] = useState<TrendingTab>("parties");
  const [companyName, setCompanyName] = useState("My Company");
  const [parties, setParties] = useState<Party[]>([]);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [items, setItems] = useState<Item[]>(getCachedItems());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allParties, allTxns, tenant] = await Promise.all([
        api.getParties(),
        api.getAllTransactions(),
        api.getTenant(),
      ]);
      const map: Record<string, string> = {};
      allParties.forEach((p) => { map[p.id] = p.name; });
      setParties(allParties);
      setTxns(allTxns.map((t) => ({ ...t, partyName: map[t.partyId] ?? "–" })));
      setCompanyName(tenant.companyName || tenant.phone || "My Company");
      await loadItems();
      setItems(getCachedItems());
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  // itemsStore is a shared cache — pick up edits made from the Items tab without
  // re-fetching from the network.
  useFocusEffect(useCallback(() => subscribeItems(() => setItems(getCachedItems())), []));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleAddPress() {
    if (tab === "parties") router.push("/party/new" as never);
    else if (tab === "items") router.push("/items/new" as never);
    else router.push("/sale/new" as never);
  }

  // Same receivable/payable split as StandardHome's To Receive/To Pay cards.
  const youllGet = parties.filter((p) => (p.balance ?? 0) > 0).reduce((sum, p) => sum + (p.balance ?? 0), 0);
  const youllGive = parties.filter((p) => (p.balance ?? 0) < 0).reduce((sum, p) => sum + Math.abs(p.balance ?? 0), 0);
  const sale = monthChange(txns, "sale");
  const purchase = monthChange(txns, "purchase");
  const monthLabel = new Date().toLocaleString("en", { month: "short" });

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={t.appBar}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/menu" as never)} hitSlop={8}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={t.companyName} numberOfLines={1}>{companyName}</Text>
        <TouchableOpacity style={s.iconBtn} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-redo-outline" size={21} color={colors.red} />
        </TouchableOpacity>
      </View>

      {/* Swipeable stat cards: You'll Get, Sale (month), You'll Give, Purchase (month) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={t.statScroll}
        contentContainerStyle={t.statScrollContent}
      >
        <StatCard icon="arrow-down-circle" iconColor={colors.green} bgColor={colors.greenBg} label="You'll Get" amount={youllGet} width={statCardWidth} />
        <StatCard icon="document-text" iconColor={colors.blue} bgColor={colors.blueLight} label={`Sale (${monthLabel})`} amount={sale.current} pct={sale.pct} width={statCardWidth} />
        <StatCard icon="arrow-up-circle" iconColor={colors.orange} bgColor={colors.orangeLight} label="You'll Give" amount={youllGive} width={statCardWidth} />
        <StatCard icon="cart" iconColor={colors.purple} bgColor={colors.purpleLight} label={`Purchase (${monthLabel})`} amount={purchase.current} pct={purchase.pct} width={statCardWidth} />
      </ScrollView>

      {/* Tabs + New button */}
      <View style={t.tabRow}>
        {TRENDING_TABS.map((tb) => (
          <TouchableOpacity
            key={tb.key}
            style={[t.tabPill, tab === tb.key && t.tabPillActive]}
            onPress={() => setTab(tb.key)}
          >
            <Text style={[t.tabTxt, tab === tb.key && t.tabTxtActive]}>{tb.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={t.newBtnRow}>
        <TouchableOpacity style={t.newBtn} onPress={handleAddPress}>
          <Text style={t.newBtnTxt}>{trendingAddLabel(tab)}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : tab === "parties" ? (
        <FlatList
          data={parties}
          keyExtractor={(p) => p.id}
          contentContainerStyle={t.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={t.row} onPress={() => router.push(`/party/${item.id}` as never)}>
              <View style={t.rowAvatar}><Text style={t.rowAvatarTxt}>{item.name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={t.rowTitle} numberOfLines={1}>{item.name}</Text>
                {item.phone ? <Text style={t.rowSub}>{item.phone}</Text> : null}
              </View>
              <Text style={[t.rowAmt, { color: (item.balance ?? 0) > 0 ? colors.red : colors.green }]}>
                Rs {Math.abs(item.balance ?? 0).toLocaleString("en-PK")}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Add Parties" sub="Add customers (parties) of your business" />}
        />
      ) : tab === "transactions" ? (
        <FlatList
          data={txns}
          keyExtractor={(r) => r.id}
          contentContainerStyle={t.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={t.row} onPress={() => router.push(`/txn/${item.id}` as never)}>
              <View style={{ flex: 1 }}>
                <Text style={t.rowTitle} numberOfLines={1}>{item.partyName}</Text>
                <Text style={t.rowSub}>{item.type.replace(/_/g, " ")}</Text>
              </View>
              <Text style={[t.rowAmt, { color: item.balance > 0 ? colors.red : colors.textMuted }]}>
                Rs {item.total.toLocaleString("en-PK")}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="Add Transactions" sub="Record sales, purchases and payments" />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={t.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={t.row} onPress={() => router.push(`/items/${item.id}` as never)}>
              <View style={{ flex: 1 }}>
                <Text style={t.rowTitle} numberOfLines={1}>{item.name}</Text>
                {item.sku ? <Text style={t.rowSub}>{item.sku}</Text> : null}
              </View>
              <Text style={t.rowAmt}>{item.totalStock ?? item.openingStock ?? 0} {item.unit ?? ""}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="Add Items" sub="Add products/services you sell or stock" />}
        />
      )}
    </View>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; sub: string }) {
  return (
    <View style={t.emptyWrap}>
      <Ionicons name={icon} size={52} color={colors.border} />
      <Text style={t.emptyTitle}>{title}</Text>
      <Text style={t.emptySub}>{sub}</Text>
    </View>
  );
}

/* ══════════════════════════════ Modern ══════════════════════════════
   The app's original Home screen design (Transaction/Party toggle, Quick Links,
   search, transaction/party list, floating "Add New Sale" FAB), kept as a selectable
   theme rather than replaced. ── */

type ModernTab = "txn" | "party";
type BadgeCfg = { label: string; bg: string; fg: string };

function getBadge(type: string, balance: number): BadgeCfg {
  switch (type) {
    case "sale":             return balance > 0 ? { label: "SALE: UNPAID", bg: "#fef3c7", fg: "#b45309" } : { label: "SALE: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "purchase":         return balance > 0 ? { label: "PURCHASE: DUE", bg: "#fef3c7", fg: "#b45309" } : { label: "PURCHASE: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "expense":          return { label: "EXPENSE", bg: "#ede9fe", fg: "#6d28d9" };
    case "delivery_challan": return balance > 0 ? { label: "DN: UNPAID", bg: "#fef3c7", fg: "#b45309" } : { label: "DN: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "purchase_order":   return balance > 0 ? { label: "PO: OPEN", bg: "#fef3c7", fg: "#b45309" } : { label: "PO: CLOSED", bg: "#dcfce7", fg: "#15803d" };
    case "credit_note":      return { label: "CREDIT NOTE", bg: "#fee2e2", fg: "#dc2626" };
    case "payment_in":       return { label: "PAYMENT IN", bg: "#dcfce7", fg: "#15803d" };
    case "payment_out":      return { label: "PAYMENT OUT", bg: "#fee2e2", fg: "#dc2626" };
    case "estimate":         return { label: "ESTIMATE", bg: "#dbeafe", fg: "#1d4ed8" };
    default:                 return { label: type.replace(/_/g, " ").toUpperCase(), bg: "#f3f4f6", fg: "#374151" };
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}, ${String(d.getFullYear()).slice(2)}`;
}

function fmtAmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// sale/payment_in have mobile creation/edit screens today — other types can still be
// viewed and exported, but editing stays a desktop-only action until those screens exist
// on mobile too. Matches app/txn/[id].tsx's own EDITABLE_TYPES.
const MODERN_EDITABLE_TYPES = new Set(["sale", "payment_in"]);

// Hoisted to module scope (not defined inside ModernHome) — a component redefined on every
// render of its parent gets a new function identity each time, so React treats it as a
// different component type and remounts every visible FlatList row on each keystroke in the
// search box instead of diffing them normally.
function ModernTxnCard({ item, permissions, memberId, canDelete, onChanged }: {
  item: TxnRow; permissions: string[] | null; memberId: string | null; canDelete: boolean; onChanged: () => void;
}) {
  const router = useRouter();
  const canEdit = canEditSale(item, permissions, memberId);
  const badge = getBadge(item.type, item.balance);
  const [busy, setBusy] = useState<"download" | "share" | "delete" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const invoiceHtmlOpts = useInvoiceHtmlOptions();

  function openDetail() {
    setHandoffTxn(item);
    router.push(`/txn/${item.id}` as never);
  }

  async function handleDownload() {
    setBusy("download");
    try {
      await Print.printAsync({ html: buildInvoiceHtml(item, item.number ?? item.id.slice(0, 8), invoiceHtmlOpts) });
    } catch {
      Alert.alert("Error", "Could not open printer.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    try {
      const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml(item, item.number ?? item.id.slice(0, 8), invoiceHtmlOpts) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Invoice" });
    } catch {
      Alert.alert("Error", "Could not generate PDF.");
    } finally {
      setBusy(null);
    }
  }

  function handleEdit() {
    setMenuOpen(false);
    setHandoffTxn(item);
    router.push({ pathname: "/sale/new", params: { editId: item.id } } as never);
  }

  function handleDelete() {
    setMenuOpen(false);
    Alert.alert(
      "Delete transaction?",
      `This will permanently delete this ${item.type.replace(/_/g, " ")} for ${item.partyName}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            setBusy("delete");
            try {
              await api.deleteTransaction(item.id);
              onChanged();
            } catch {
              Alert.alert("Error", "Could not delete this transaction.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <TouchableOpacity style={m.card} onPress={openDetail} activeOpacity={0.8}>
      <View style={m.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={m.cardParty} numberOfLines={1}>{item.partyName}</Text>
          <View style={[m.badge, { backgroundColor: badge.bg }]}>
            <Text style={[m.badgeTxt, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {item.number ? <Text style={m.cardNum}>#{item.number}</Text> : null}
          <Text style={m.cardDate}>{fmtDate(item.date)}</Text>
        </View>
      </View>
      <View style={m.cardMid}>
        <View>
          <Text style={m.amtLbl}>Total</Text>
          <Text style={m.amtVal}>Rs {fmtAmt(item.total)}</Text>
        </View>
        <View>
          <Text style={m.amtLbl}>Balance</Text>
          <Text style={[m.amtVal, item.balance > 0 && { color: "#dc2626" }]}>
            Rs {fmtAmt(item.balance)}
          </Text>
        </View>
        <View style={m.cardActions}>
          <TouchableOpacity style={m.actionBtn} hitSlop={8} onPress={handleDownload} disabled={busy !== null}>
            {busy === "download" ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Ionicons name="print-outline" size={18} color={colors.textMuted} />}
          </TouchableOpacity>
          <TouchableOpacity style={m.actionBtn} hitSlop={8} onPress={handleShare} disabled={busy !== null}>
            {busy === "share" ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Ionicons name="share-outline" size={18} color={colors.textMuted} />}
          </TouchableOpacity>
          <TouchableOpacity style={m.actionBtn} hitSlop={8} onPress={() => setMenuOpen(true)} disabled={busy !== null}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={m.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={m.menuSheet}>
            <TouchableOpacity style={m.menuRow} onPress={() => { setMenuOpen(false); openDetail(); }}>
              <Ionicons name="eye-outline" size={19} color={colors.text} />
              <Text style={m.menuLabel}>View</Text>
            </TouchableOpacity>
            {canEdit && MODERN_EDITABLE_TYPES.has(item.type) && (
              <TouchableOpacity style={m.menuRow} onPress={handleEdit}>
                <Ionicons name="create-outline" size={19} color={colors.text} />
                <Text style={m.menuLabel}>Edit</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity style={m.menuRow} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={19} color="#dc2626" />
                <Text style={[m.menuLabel, { color: "#dc2626" }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
}

function ModernPartyCard({ item, onPress }: { item: Party; onPress: () => void }) {
  const bal = item.balance ?? 0;
  return (
    <TouchableOpacity style={m.card} onPress={onPress} activeOpacity={0.8}>
      <View style={m.partyRow}>
        <View style={m.partyAvatar}>
          <Text style={m.partyAvatarTxt}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={m.partyName}>{item.name}</Text>
          {item.phone ? <Text style={m.partyPhone}>{item.phone}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[m.partyBal, { color: bal > 0 ? "#dc2626" : bal < 0 ? "#16a34a" : colors.textMuted }]}>
            Rs {Math.abs(bal).toLocaleString("en-PK")}
          </Text>
          <Text style={m.partyBalLbl}>{bal > 0 ? "You'll receive" : bal < 0 ? "You'll pay" : "Settled"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

type ModernTxnTypeItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route?: string;
  iconBg: string;
};

const MODERN_TXN_SECTIONS: Array<{ title: string; items: ModernTxnTypeItem[] }> = [
  {
    title: "Sale Transactions",
    items: [
      { label: "Payment-In",         icon: "arrow-down-circle-outline",  route: "/payment-in/new",    iconBg: "#dbeafe" },
      { label: "Sale Return",        icon: "return-down-back-outline",   route: "/sale-return/new",   iconBg: "#fee2e2" },
      { label: "Delivery Note",      icon: "car-outline",                route: "/delivery-note/new", iconBg: "#dbeafe" },
      { label: "Estimate/Quotation", icon: "calculator-outline",         route: undefined,            iconBg: "#dbeafe" },
      { label: "Proforma Invoice",   icon: "document-text-outline",      route: undefined,            iconBg: "#dbeafe" },
      { label: "Sale Order",         icon: "bag-outline",                route: undefined,            iconBg: "#dbeafe" },
      { label: "Sale Invoice",       icon: "receipt-outline",            route: "/sale/new",          iconBg: "#dbeafe" },
    ],
  },
  {
    title: "Purchase Transactions",
    items: [
      // Purchase/Payment-Out were previously stubbed ("Soon") even though these screens
      // already existed — wired here the same way Standard/Trending's shared Add sheet was.
      { label: "Purchase",          icon: "cart-outline",               route: "/purchase/new",    iconBg: "#dcfce7" },
      { label: "Payment-Out",       icon: "arrow-up-circle-outline",    route: "/payment-out/new", iconBg: "#fee2e2" },
      { label: "Purchase Return",   icon: "return-up-back-outline",     route: undefined,          iconBg: "#dcfce7" },
      { label: "Purchase Order",    icon: "clipboard-outline",          route: undefined,          iconBg: "#dcfce7" },
    ],
  },
  {
    title: "Other Transactions",
    items: [
      { label: "Expenses",     icon: "wallet-outline",           route: "/expense/new", iconBg: "#ede9fe" },
      { label: "P2P Transfer", icon: "swap-horizontal-outline",  route: undefined,      iconBg: "#fef3c7" },
    ],
  },
];

type ModernMoreOption = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route?: string;
  premium?: boolean;
};

const MODERN_MORE_OPTIONS: ModernMoreOption[] = [
  { label: "Bank Accounts",   icon: "business-outline",        route: "/cash-bank" },
  { label: "Day Book",        icon: "book-outline",            route: "/reports/day-book" },
  { label: "All Txns Report", icon: "document-text-outline",   route: "/reports" },
  { label: "Profit & Loss",   icon: "trending-up-outline",     premium: true },
  { label: "Balance Sheet",   icon: "bar-chart-outline",       premium: true },
  { label: "Billwise PnL",    icon: "receipt-outline",         premium: true },
  { label: "Print Settings",  icon: "print-outline" },
];

function ModernHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<ModernTab>("txn");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [companyName, setCompanyName] = useState("My Company");
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [canDeleteSale, setCanDeleteSale] = useState(true);
  // The header shows the TENANT's identity (companyName/phone) by default — that's the
  // owner's own business, so it's correct for an owner login. A staff/salesman login
  // shares that same tenant, so without this override they'd see the owner's info at the
  // top instead of confirmation of which staff account they're actually logged in as.
  const [staffLabel, setStaffLabel] = useState<string | null>(null);

  useEffect(() => {
    getPermissions().then((perms) => {
      setPermissions(perms);
      setCanDeleteSale(perms === null || perms.includes("sale_delete"));
    });
    getMemberId().then(setMemberId);
    getRole().then(async (role) => {
      if (role === "owner") { setStaffLabel(null); return; }
      const [name, contact] = await Promise.all([getStaffName(), getStaffContact()]);
      if (name) setStaffLabel(contact ? `${name} · ${contact}` : name);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [allTxns, allParties, tenant] = await Promise.all([
        api.getAllTransactions(),
        api.getParties(),
        api.getTenant(),
      ]);
      const map: Record<string, string> = {};
      allParties.forEach((p) => { map[p.id] = p.name; });
      setTxns(allTxns.map((t) => ({ ...t, partyName: map[t.partyId] ?? "–" })));
      setParties(allParties);
      setCompanyName(tenant.companyName || tenant.phone || "My Company");
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleTxnTypePress(item: ModernTxnTypeItem) {
    setShowAddTxn(false);
    if (item.route) {
      router.push(item.route as never);
    }
  }

  const q = search.toLowerCase();
  const filteredTxns = txns.filter((t) =>
    !q || t.partyName.toLowerCase().includes(q) || t.type.includes(q) || (t.number ?? "").includes(q)
  );
  const filteredParties = parties.filter((p) =>
    !q || p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q)
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={m.appBar}>
        <View style={m.appBarLeft}>
          <View style={m.avatar}>
            <Text style={m.avatarTxt}>{(staffLabel ?? companyName)[0]?.toUpperCase()}</Text>
          </View>
          <Text style={m.companyName} numberOfLines={1}>{staffLabel ?? companyName}</Text>
        </View>
        <View style={m.appBarRight}>
          <TouchableOpacity style={m.filterBtn}>
            <Ionicons name="funnel" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={m.iconBtn} onPress={() => router.push("/menu" as never)}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={m.iconBtn} onPress={() => router.push("/settings" as never)}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={m.tabRow}>
        <TouchableOpacity
          style={[m.tabBtn, tab === "txn" && m.tabBtnActive]}
          onPress={() => setTab("txn")}
        >
          <Text style={[m.tabTxt, tab === "txn" && m.tabTxtActive]}>Transaction Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[m.tabBtn, tab === "party" && m.tabBtnActive]}
          onPress={() => setTab("party")}
        >
          <Text style={[m.tabTxt, tab === "party" && m.tabTxtActive]}>Party Details</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Links */}
      <View style={m.quickLinks}>
        <Text style={m.quickLinksTitle}>Quick Links</Text>
        <View style={m.quickLinksRow}>
          <TouchableOpacity style={m.quickItem} onPress={() => setShowAddTxn(true)}>
            <View style={[m.quickIconBox, { backgroundColor: "#ff3d5a" }]}>
              <Ionicons name="receipt-outline" size={24} color="#fff" />
              <View style={m.quickAddBadge}><Ionicons name="add" size={10} color="#fff" /></View>
            </View>
            <Text style={m.quickLabel}>Add Txn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={m.quickItem} onPress={() => router.push("/party" as never)}>
            <View style={[m.quickIconBox, { backgroundColor: "#0f5a72" }]}>
              <Ionicons name="people-outline" size={24} color="#fff" />
            </View>
            <Text style={m.quickLabel}>Parties</Text>
          </TouchableOpacity>
          <TouchableOpacity style={m.quickItem} onPress={() => router.push("/reports/sale" as never)}>
            <View style={[m.quickIconBox, { backgroundColor: "#4a9fd4" }]}>
              <Ionicons name="document-text-outline" size={22} color="#fff" />
              <Ionicons name="stats-chart" size={12} color="#fff" style={{ position: "absolute", bottom: 8, right: 8 }} />
            </View>
            <Text style={m.quickLabel}>Sale Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={m.quickItem} onPress={() => setShowMoreOptions(true)}>
            <View style={[m.quickIconBox, { backgroundColor: "#4a9fd4" }]}>
              <View style={m.quickArrowCircle}>
                <Ionicons name="chevron-forward" size={20} color="#4a9fd4" />
              </View>
            </View>
            <Text style={m.quickLabel}>Show All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={m.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={m.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search for a transaction"
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="filter-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : tab === "txn" ? (
        <FlatList
          data={filteredTxns}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[m.list, filteredTxns.length === 0 && m.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <ModernTxnCard item={item} permissions={permissions} memberId={memberId} canDelete={canDeleteSale} onChanged={load} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={m.emptyWrap}>
              <Ionicons name="receipt-outline" size={52} color={colors.border} />
              <Text style={m.emptyTxt}>No transactions yet.</Text>
              <TouchableOpacity style={m.emptyBtn} onPress={() => router.push("/sale/new" as never)}>
                <Text style={m.emptyBtnTxt}>Add First Sale</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredParties}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[m.list, filteredParties.length === 0 && m.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => <ModernPartyCard item={item} onPress={() => router.push(`/party/${item.id}` as never)} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={m.emptyWrap}>
              <Ionicons name="people-outline" size={52} color={colors.border} />
              <Text style={m.emptyTxt}>No parties yet.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[m.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowAddTxn(true)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={m.fabTxt}>Add New Sale</Text>
      </TouchableOpacity>

      {/* ── More Options bottom sheet ── */}
      <Modal
        visible={showMoreOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMoreOptions(false)}
      >
        <View style={m.modalContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowMoreOptions(false)} />
          <View style={[m.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={m.sheetHandle} />
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>More Options</Text>
              <TouchableOpacity onPress={() => setShowMoreOptions(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={m.moreGrid}>
              {MODERN_MORE_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={m.moreItem}
                  onPress={() => { setShowMoreOptions(false); if (item.route) router.push(item.route as never); }}
                  activeOpacity={0.7}
                >
                  <View style={m.moreIconWrap}>
                    <View style={m.moreIcon}>
                      <Ionicons name={item.icon} size={28} color="#4a9fd4" />
                    </View>
                    {item.premium && (
                      <View style={m.crownBadge}>
                        <Ionicons name="diamond" size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={m.moreLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Transaction bottom sheet ── */}
      <Modal
        visible={showAddTxn}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddTxn(false)}
      >
        <View style={m.modalContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAddTxn(false)} />
          <View style={[m.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={m.sheetHandle} />
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>Sale Transactions</Text>
              <TouchableOpacity onPress={() => setShowAddTxn(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {MODERN_TXN_SECTIONS.map((section) => (
                <View key={section.title} style={m.sheetSection}>
                  <Text style={m.sheetSectionTitle}>{section.title}</Text>
                  <View style={m.sheetGrid}>
                    {section.items.map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        style={m.sheetItem}
                        onPress={() => handleTxnTypePress(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[m.sheetIcon, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={26} color={item.route ? colors.primary : colors.textMuted} />
                        </View>
                        <Text style={[m.sheetItemLabel, !item.route && { color: colors.textLight }]}>
                          {item.label}
                        </Text>
                        {!item.route && (
                          <View style={m.soonBadge}>
                            <Text style={m.soonTxt}>Soon</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f2f5" },

  appBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 10,
  },
  iconBtn: { padding: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  body: { padding: 16, paddingBottom: 32 },

  searchList: { padding: 12, flexGrow: 1 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e8ecf0",
    padding: 14, marginBottom: 8,
  },
  searchAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  searchAvatarTxt: { fontSize: 15, fontWeight: "700", color: colors.primary },
  searchRowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  searchRowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  searchRowAmt: { fontSize: 13.5, fontWeight: "700" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 18 },

  balanceRow: { flexDirection: "row", gap: 12 },
  balanceCard: { flex: 1, borderRadius: 12, padding: 16 },
  balanceLabel: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  balanceAmt: { fontSize: 19, fontWeight: "700" },

  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    marginTop: 16,
  },
  gridItem: {
    width: "47%", backgroundColor: "#fff", borderRadius: 12,
    paddingVertical: 22, alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: "#e8ecf0",
  },
  gridIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primaryLight + "22",
    alignItems: "center", justifyContent: "center",
  },
  gridLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text },
});

const t = StyleSheet.create({
  appBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  companyName: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },

  statScroll: {
    backgroundColor: "#f0f2f5",
  },
  // alignItems: "flex-start" — without it, a horizontal ScrollView's row defaults to
  // stretch, forcing every card to the same height as its tallest sibling (the pct-row
  // cards); combined with statCard's overflow:hidden that silently clipped the amount/pct
  // text of whichever card that stretch got wrong instead of letting each size to its
  // own content.
  statScrollContent: { paddingHorizontal: 12, paddingVertical: 14, gap: 12, alignItems: "flex-start" },
  statCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    shadowColor: "#0f172a", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
    elevation: 2,
  },
  statTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  statLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.text },
  statAmt: { fontSize: 16.5, fontWeight: "700", color: colors.text, flexShrink: 1, width: "100%" },
  statPctRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  statPct: { fontSize: 11.5, fontWeight: "700" },

  tabRow: {
    flexDirection: "row", gap: 10,
    backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100,
    borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  tabPillActive: { borderColor: colors.red, backgroundColor: colors.red + "10" },
  tabTxt: { fontSize: 13.5, fontWeight: "600", color: colors.textMuted },
  tabTxtActive: { color: colors.red },

  newBtnRow: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 12,
    alignItems: "flex-end",
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  newBtn: {
    backgroundColor: colors.primaryLight + "22", borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  newBtnTxt: { fontSize: 13.5, fontWeight: "700", color: colors.primary },

  list: { padding: 12, flexGrow: 1 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e8ecf0",
    padding: 14, marginBottom: 8,
  },
  rowAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  rowAvatarTxt: { fontSize: 15, fontWeight: "700", color: colors.primary },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowAmt: { fontSize: 13.5, fontWeight: "700", color: colors.text },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
});

const m = StyleSheet.create({
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  menuSheet: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingVertical: 8, paddingBottom: 24 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f2f5" },
  menuLabel: { fontSize: 14.5, fontWeight: "500", color: colors.text },

  appBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  appBarLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.primary + "40",
  },
  avatarTxt: { fontSize: 16, fontWeight: "700", color: colors.primary },
  companyName: { fontSize: 17, fontWeight: "700", color: colors.text, flex: 1 },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  filterBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
  iconBtn: { padding: 6 },

  tabRow: {
    flexDirection: "row", backgroundColor: "#fff",
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8, gap: 10,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#e0e7ef",
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  tabTxt: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTxtActive: { color: "#fff" },

  quickLinks: {
    backgroundColor: "#fff", paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  quickLinksTitle: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 12 },
  quickLinksRow: { flexDirection: "row", justifyContent: "space-between" },
  quickItem: { alignItems: "center", gap: 7, flex: 1 },
  quickIconBox: {
    width: 58, height: 62, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  quickAddBadge: {
    position: "absolute", top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center",
  },
  quickArrowCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  quickLabel: { fontSize: 11, color: colors.text, fontWeight: "500", textAlign: "center" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", marginHorizontal: 12, marginVertical: 10,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: "#e0e7ef",
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  list: { paddingHorizontal: 12, paddingBottom: 120 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#e8ecf0",
    paddingHorizontal: 14, paddingTop: 13, paddingBottom: 11,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  cardParty: { fontSize: 14.5, fontWeight: "700", color: colors.text, marginBottom: 5 },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  cardNum: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginBottom: 2 },
  cardDate: { fontSize: 11.5, color: colors.textMuted },
  cardMid: { flexDirection: "row", alignItems: "center", gap: 20 },
  amtLbl: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  amtVal: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  cardActions: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  actionBtn: { padding: 6 },

  partyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  partyAvatar: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  partyAvatarTxt: { fontSize: 16, fontWeight: "700", color: colors.primary },
  partyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  partyPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  partyBal: { fontSize: 13.5, fontWeight: "700" },
  partyBalLbl: { fontSize: 10.5, color: colors.textMuted, marginTop: 2 },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, marginTop: 60 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },

  fab: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.red, borderRadius: 100,
    paddingHorizontal: 28, paddingVertical: 15,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  /* ── Bottom sheet ── */
  modalContainer: {
    flex: 1, justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10,
    maxHeight: "88%",
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

  sheetSection: { marginBottom: 20 },
  sheetSectionTitle: {
    fontSize: 13, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 14, paddingLeft: 2,
  },
  sheetGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
  },
  sheetItem: {
    width: "29%", alignItems: "center", gap: 8,
  },
  sheetIcon: {
    width: 64, height: 64, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  sheetItemLabel: {
    fontSize: 11.5, fontWeight: "500", color: colors.text,
    textAlign: "center", lineHeight: 16,
  },
  soonBadge: {
    backgroundColor: "#fef3c7", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: -2,
  },
  soonTxt: { fontSize: 9.5, fontWeight: "700", color: "#b45309" },

  /* ── More Options sheet ── */
  moreGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingTop: 4, paddingBottom: 8,
  },
  moreItem: {
    width: "33.33%", alignItems: "center",
    paddingVertical: 16, gap: 10,
  },
  moreIconWrap: { position: "relative" },
  moreIcon: {
    width: 68, height: 68, borderRadius: 16,
    backgroundColor: "#e8f4fd",
    alignItems: "center", justifyContent: "center",
  },
  crownBadge: {
    position: "absolute", top: -4, right: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#7c3aed",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  moreLabel: {
    fontSize: 12, fontWeight: "500", color: colors.text,
    textAlign: "center", lineHeight: 16,
  },
});

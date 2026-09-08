import { useState, useEffect } from "react";
import { Tabs, router } from "expo-router";
import { View, StyleSheet, Text, TouchableOpacity, Modal, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { getRole, getPermissions } from "../../src/auth";
import { useDevice } from "../../src/useDeviceSession";
import { useSettings } from "../../src/useSettings";
import { CompanySwitcherBar } from "../../src/components/CompanySwitcher";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// null = owner/legacy JWT → always show tab
function hasPerm(permissions: string[] | null, perm: string): boolean {
  if (permissions === null) return true;
  return permissions.includes(perm);
}

function ReadOnlyBanner() {
  const { isReadOnly } = useDevice();
  const insets = useSafeAreaInsets();
  if (!isReadOnly) return null;
  return (
    <TouchableOpacity
      style={[styles.readOnlyBanner, { paddingTop: insets.top + 7 }]}
      onPress={() => router.push("/manage-devices")}
      activeOpacity={0.85}
    >
      <Ionicons name="eye-outline" size={14} color="#fff" />
      <Text style={styles.readOnlyText}>
        View-only mode · Tap to activate this device
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#fff" />
    </TouchableOpacity>
  );
}

/* ── Add Transaction bottom-sheet — moved here from (tabs)/index.tsx: the center Add
   button now lives in the bottom nav itself (below), reachable from every tab, not just
   Home. ── */
type TxnTypeItem = { label: string; icon: IoniconsName; route?: string; iconBg: string };

const TXN_SECTIONS: Array<{ title: string; items: TxnTypeItem[] }> = [
  {
    title: "Sale Transactions",
    items: [
      { label: "Payment-In",         icon: "arrow-down-circle-outline",  route: "/payment-in/new",         iconBg: "#dbeafe" },
      { label: "Sale Return",        icon: "return-down-back-outline",   route: "/sale-return/new",        iconBg: "#fee2e2" },
      { label: "Delivery Note",      icon: "car-outline",                route: "/delivery-note/new",      iconBg: "#dbeafe" },
      { label: "Estimate/Quotation", icon: "calculator-outline",         route: "/estimate/new",           iconBg: "#dbeafe" },
      { label: "Proforma Invoice",   icon: "document-text-outline",      route: "/proforma-invoice/new",   iconBg: "#dbeafe" },
      { label: "Sale Order",         icon: "bag-outline",                route: "/sale-order/new",         iconBg: "#dbeafe" },
      { label: "Sale Invoice",       icon: "receipt-outline",            route: "/sale/new",               iconBg: "#dbeafe" },
    ],
  },
  {
    title: "Purchase Transactions",
    items: [
      { label: "Purchase",          icon: "cart-outline",               route: "/purchase/new",         iconBg: "#dcfce7" },
      { label: "Payment-Out",       icon: "arrow-up-circle-outline",    route: "/payment-out/new",      iconBg: "#fee2e2" },
      { label: "Purchase Return",   icon: "return-up-back-outline",     route: "/purchase-return/new",  iconBg: "#dcfce7" },
      { label: "Purchase Order",    icon: "clipboard-outline",          route: "/purchase-order/new",   iconBg: "#dcfce7" },
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

function AddTransactionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  function handlePress(item: TxnTypeItem) {
    onClose();
    if (item.route) router.push(item.route as never);
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.modalContainer}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={sheetStyles.sheetHandle} />
          <View style={sheetStyles.sheetHeader}>
            <Text style={sheetStyles.sheetTitle}>Add Transaction</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {TXN_SECTIONS.map((section) => (
              <View key={section.title} style={sheetStyles.sheetSection}>
                <Text style={sheetStyles.sheetSectionTitle}>{section.title}</Text>
                <View style={sheetStyles.sheetGrid}>
                  {section.items.map((item) => (
                    <TouchableOpacity key={item.label} style={sheetStyles.sheetItem} onPress={() => handlePress(item)} activeOpacity={0.7}>
                      <View style={[sheetStyles.sheetIcon, { backgroundColor: item.iconBg }]}>
                        <Ionicons name={item.icon} size={26} color={item.route ? colors.primary : colors.textMuted} />
                      </View>
                      <Text style={[sheetStyles.sheetItemLabel, !item.route && { color: colors.textLight }]}>
                        {item.label}
                      </Text>
                      {!item.route && (
                        <View style={sheetStyles.soonBadge}><Text style={sheetStyles.soonTxt}>Soon</Text></View>
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
  );
}

/* ── Custom bottom nav: Sale / Pay-In / Purchase / Pay-Out around a center Add button,
   matching the reference "Standard" theme screenshot. Replaces the previous per-screen
   icon tab bar entirely — the four destinations are stack routes outside the (tabs)
   group, so they're plain router.push() rather than native tab screens. Home/Dashboard/
   Items/Menu/Premium stay registered <Tabs.Screen>s underneath (unchanged), reached now
   via the Home screen's hamburger/grid instead of bottom-bar buttons. ── */
function CustomTabBar({ theme, onAddPress }: { theme: string; onAddPress: () => void }) {
  const insets = useSafeAreaInsets();
  // Capped rather than the raw safe-area value — some Android gesture-nav devices report
  // a much larger inset than this bar's own compact content needs, which read as a big
  // dead gap under the buttons.
  const bottomPad = Math.min(insets.bottom, 12) || 8;

  if (theme === "trending") {
    return (
      <View style={[styles.customBar, styles.trendingBar, { paddingBottom: bottomPad }]}>
        <TouchableOpacity style={[styles.trendingPill, { backgroundColor: colors.primary }]} onPress={() => router.push("/purchase/new" as never)}>
          <Text style={styles.trendingPillTxt}>Add Purchase</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.trendingAddBtn} onPress={onAddPress} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.trendingPill, { backgroundColor: colors.red }]} onPress={() => router.push("/sale/new" as never)}>
          <Text style={styles.trendingPillTxt}>Add Sale</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const left: { label: string; icon: IoniconsName; route: string }[] = [
    { label: "Sale",   icon: "document-text-outline",     route: "/sale" },
    { label: "Pay-In", icon: "arrow-down-circle-outline", route: "/payment-in" },
  ];
  const right: { label: string; icon: IoniconsName; route: string }[] = [
    { label: "Purchase", icon: "cart-outline",            route: "/purchase" },
    { label: "Pay-Out",  icon: "arrow-up-circle-outline", route: "/payment-out" },
  ];
  return (
    <View style={[styles.customBar, { paddingBottom: bottomPad }]}>
      {left.map((it) => (
        <TouchableOpacity key={it.label} style={styles.customBarItem} onPress={() => router.push(it.route as never)}>
          <Ionicons name={it.icon} size={22} color={colors.textMuted} />
          <Text style={styles.customBarLabel}>{it.label}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.centerAddWrap}>
        <TouchableOpacity style={styles.centerAddBtn} onPress={onAddPress} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      {right.map((it) => (
        <TouchableOpacity key={it.label} style={styles.customBarItem} onPress={() => router.push(it.route as never)}>
          <Ionicons name={it.icon} size={22} color={colors.textMuted} />
          <Text style={styles.customBarLabel}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function TabLayout() {
  const [role, setRole] = useState("owner");
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  // The native bar's height/padding used to be hardcoded per-platform, which didn't account
  // for the device's real bottom safe-area inset (gesture nav / home indicator) — on phones
  // with a taller inset than that guess, the tappable icon row sat partly under the system
  // nav area and became unreachable. Size it off the actual inset instead.
  const nativeTabBarStyle = [
    styles.tabBar,
    { height: 50 + insets.bottom, paddingBottom: insets.bottom + 6 },
  ];

  useEffect(() => {
    const load = () => {
      getRole().then(setRole);
      getPermissions().then(setPermissions);
    };
    load();
    // Re-check whenever the app comes to foreground after a sign-in
    const { AppState } = require("react-native");
    const sub = AppState.addEventListener("change", (s: string) => { if (s === "active") load(); });
    return () => sub.remove();
  }, []);

  const isOwner = role === "owner";
  const showItems = hasPerm(permissions, "items_view");
  const showDashboard = hasPerm(permissions, "reports_view");

  return (
    <>
      <ReadOnlyBanner />
      <CompanySwitcherBar />
      <Tabs
        // "modern" keeps the app's original native per-screen tab bar (icons/labels driven
        // by each <Tabs.Screen>'s own options below) — only Standard/Trending get the
        // custom Sale/Pay-In/Purchase/Pay-Out (or Add Purchase/Add Sale) bar.
        tabBar={settings.appTheme === "modern" ? undefined : () => <CustomTabBar theme={settings.appTheme} onAddPress={() => setShowAddTxn(true)} />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: nativeTabBarStyle,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.textLight,
          tabBarLabelStyle: styles.label,
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: "HOME",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? "home" : ("home-outline" as IoniconsName)}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "DASHBOARD",
          tabBarItemStyle: showDashboard ? undefined : { display: "none" },
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? "bar-chart" : ("bar-chart-outline" as IoniconsName)}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "ITEMS",
          tabBarItemStyle: showItems ? undefined : { display: "none" },
          tabBarIcon: ({ color }) => (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={"package-variant-closed" as MCIName}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "MENU",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? "menu" : ("menu-outline" as IoniconsName)}
                size={23}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="premium"
        options={{
          title: "GET PREMIUM",
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: "#334155",
          tabBarItemStyle: isOwner ? undefined : { display: "none" },
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapGold]}>
              <Ionicons name="diamond" size={20} color={colors.gold} />
            </View>
          ),
        }}
      />
    </Tabs>
      <AddTransactionSheet visible={showAddTxn} onClose={() => setShowAddTxn(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#fff",
    borderTopColor: "#e7edf3",
    borderTopWidth: 1,
    // height/paddingBottom are set responsively at render time — see nativeTabBarStyle above.
    paddingTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginTop: 1,
  },
  iconWrap: {
    width: 38,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  iconWrapActive: {
    backgroundColor: "#e8f4fd",
  },
  iconWrapGold: {
    backgroundColor: "#fef9c3",
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d97706",
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
  },
  readOnlyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },

  customBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopColor: "#e7edf3",
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  customBarItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  customBarLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textMuted,
  },
  centerAddWrap: {
    flex: 1,
    alignItems: "center",
  },
  centerAddBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: "#fff",
  },

  trendingBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
    justifyContent: "space-between",
  },
  trendingPill: {
    flex: 1,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
  },
  trendingPillTxt: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#fff",
  },
  trendingAddBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});

const sheetStyles = StyleSheet.create({
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
});

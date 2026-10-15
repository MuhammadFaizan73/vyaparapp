import { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Modal, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { useSettings } from "../useSettings";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// Every list/detail screen outside the (tabs) group (Purchase List, Sale List,
// Payment-In, reports, party/item detail, ...) is its own top-level Stack route, not
// nested inside the Tabs navigator — so the bottom bar rendered via (tabs)/_layout.tsx's
// `tabBar` prop only ever showed on the 5 actual tab screens (Home/Dashboard/Items/Menu/
// Premium) and vanished the moment a user navigated anywhere else, which read as the
// whole app losing its nav chrome. This is the same "Sale/Pay-In/+/Purchase/Pay-Out"
// bar, lifted out of the Tabs-only render path so it can be mounted at the root level
// and shown on every list/view screen regardless of which stack it lives in — see
// app/_layout.tsx for the pathname-based show/hide logic that decides when to render it.
// Deliberately NOT used for the "modern" theme (which keeps Expo Router's own native
// 5-icon Tabs bar) — this component only renders the "standard"/"trending" custom bar.

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

function CustomBar({ theme, onAddPress }: { theme: string; onAddPress: () => void }) {
  const insets = useSafeAreaInsets();
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

export function PersistentBottomBar() {
  const { settings } = useSettings();
  const [showAddTxn, setShowAddTxn] = useState(false);
  // "modern" theme keeps Expo Router's own native tab bar while on an actual tab screen;
  // outside the tabs group there's nothing else to fall back to, so still show this bar
  // rather than leave those screens with no bottom nav at all.
  const theme = settings.appTheme === "modern" ? "standard" : settings.appTheme;
  return (
    <>
      <CustomBar theme={theme} onAddPress={() => setShowAddTxn(true)} />
      <AddTransactionSheet visible={showAddTxn} onClose={() => setShowAddTxn(false)} />
    </>
  );
}

const styles = StyleSheet.create({
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

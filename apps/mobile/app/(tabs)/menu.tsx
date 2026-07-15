import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { clearToken, getRole, getPermissions } from "../../src/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type ExpandedSection = "sale" | "purchase" | null;

interface SubItem {
  label: string;
  icon: IoniconsName;
  route?: string;
}

const SALE_ITEMS: SubItem[] = [
  { label: "Sale Invoice",              icon: "receipt-outline",            route: "/sale" },
  { label: "Payment-In",               icon: "arrow-down-circle-outline",  route: "/payment-in" },
  { label: "Sale Return (Credit Note)", icon: "return-down-back-outline",  route: "/credit-note" },
  { label: "Estimate/Quotation",        icon: "calculator-outline",         route: "/estimate" },
  { label: "Proforma Invoice",          icon: "document-text-outline",      route: "/proforma-invoice" },
  { label: "Sale Order",                icon: "bag-outline",                route: "/sale-order" },
  { label: "Delivery Note",             icon: "car-outline",                route: "/delivery-note" },
];

const PURCHASE_ITEMS: SubItem[] = [
  { label: "Purchase Invoice",  icon: "cart-outline",            route: "/purchase" },
  { label: "Payment-Out",       icon: "arrow-up-circle-outline", route: "/payment-out" },
  { label: "Purchase Return",   icon: "return-up-back-outline",  route: "/purchase-return" },
  { label: "Purchase Order",    icon: "clipboard-outline",       route: "/purchase-order" },
  { label: "Debit Note",        icon: "document-outline",        route: "/debit-note" },
];

interface MenuRow {
  label: string;
  sub?: string;
  icon: IoniconsName;
  tint: string;
  fg: string;
  badge?: string;
  route?: string;
  allow?: string[];
  memberOnly?: boolean;
  requirePerm?: string;
}

const TOOLS: MenuRow[] = [
  { label: "Office Location",    sub: "Set check-in zone for salesmen", icon: "business-outline",      tint: "#e6f3f7", fg: colors.primary,  route: "/office-location",      allow: ["secondary_admin"] },
  { label: "Salesman Tracking",  sub: "Live map & attendance",          icon: "map-outline",            tint: "#dbeafe", fg: "#1d4ed8",        route: "/salesman-tracking",    allow: ["secondary_admin"] },
  { label: "My Attendance",      sub: "Check in / out at office",       icon: "finger-print-outline",   tint: "#f0fdf4", fg: "#15803d",        route: "/my-visits",            allow: ["salesman", "biller_salesman"] },
  { label: "User Management",    sub: "Team members & roles",           icon: "people-outline",         tint: "#fce7f3", fg: "#be185d",        route: "/user-management",      allow: ["secondary_admin"],   requirePerm: "team_manage" },
  { label: "Backup & Sync",      sub: "Last sync · 2 min ago",         icon: "cloud-upload-outline",   tint: "#dcfce7", fg: "#15803d",        route: "/sync-share",           allow: ["secondary_admin"],   badge: "Auto" },
  { label: "Manage Devices",    sub: "Control active device access",   icon: "phone-portrait-outline", tint: "#e0f2fe", fg: "#0369a1",        route: "/manage-devices",       allow: ["secondary_admin"] },
  { label: "Print Settings",     sub: "Thermal & A4",                   icon: "print-outline",          tint: "#fef3c7", fg: "#b45309",        allow: ["secondary_admin"] },
  { label: "Manage Companies",   sub: "Switch or add company",          icon: "layers-outline",         tint: "#e0e7ff", fg: "#4338ca",        route: "/manage-companies",     allow: [] },
  { label: "Transaction Settings", sub: "Invoice, tax, prefixes",       icon: "document-text-outline",  tint: "#e0f2fe", fg: "#0369a1",        route: "/transaction-settings", allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit", "biller", "biller_salesman"] },
  { label: "Tax Settings",       sub: "GST & rates",                    icon: "receipt-outline",        tint: "#fef3c7", fg: "#b45309",        allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit", "biller", "biller_salesman"] },
  { label: "Join with Invite Code", sub: "Enter code from your employer", icon: "key-outline",         tint: "#f0fdf4", fg: "#15803d",        route: "/accept-invite",        memberOnly: true },
  { label: "Plans & Pricing",    sub: "Upgrade your plan",              icon: "diamond-outline",        tint: "#fef3c7", fg: "#b45309",        route: "/plans-pricing",        allow: ["secondary_admin"] },
  { label: "Help & Support",     sub: "Tutorials & FAQs",               icon: "help-circle-outline",    tint: "#e0e7ff", fg: "#4338ca" },
];

const REPORTS: MenuRow[] = [
  { label: "Reports",    sub: "GST · P&L · Stock",   icon: "bar-chart-outline", tint: "#ede9fe", fg: "#6d28d9", route: "/reports",            allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit"], requirePerm: "reports_view" },
  { label: "Day Book",   sub: "Today's transactions", icon: "book-outline",      tint: "#dbeafe", fg: "#1d4ed8", route: "/reports/day-book",   allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit", "biller", "biller_salesman"], requirePerm: "reports_view" },
  { label: "Cash & Bank", sub: "Accounts & balances", icon: "wallet-outline",   tint: "#dcfce7", fg: "#15803d", route: "/cash-bank",          allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit"] },
];

const ROLE_LABELS: Record<string, string> = {
  secondary_admin: "Secondary Admin",
  salesman: "Salesman",
  biller: "Biller",
  biller_salesman: "Biller & Salesman",
  stock_keeper: "Stock Keeper",
  ca_accountant: "CA / Accountant",
  ca_accountant_edit: "CA / Accountant (Edit)",
};

function isVisible(item: MenuRow, role: string, permissions: string[] | null): boolean {
  if (role === "owner") return !item.memberOnly;
  if (item.memberOnly) return true;
  if (permissions !== null && item.requirePerm) return permissions.includes(item.requirePerm);
  if (!item.allow) return true;
  return item.allow.includes(role);
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [role, setRole] = useState("owner");
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState<ExpandedSection>("sale");

  useFocusEffect(useCallback(() => {
    getRole().then(setRole);
    getPermissions().then(setPermissions);
  }, []));

  const visibleTools = TOOLS.filter(i => isVisible(i, role, permissions));
  const visibleReports = REPORTS.filter(i => isVisible(i, role, permissions));

  function toggle(section: ExpandedSection) {
    setExpanded(prev => prev === section ? null : section);
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive", onPress: async () => {
          await clearToken();
          router.replace("/onboarding" as never);
        },
      },
    ]);
  }

  function renderMenuRow(item: MenuRow, last = false) {
    return (
      <TouchableOpacity
        key={item.label}
        style={[styles.row, last && styles.rowLast]}
        onPress={() => item.route && router.push(item.route as never)}
        activeOpacity={item.route ? 0.7 : 1}
      >
        <View style={[styles.rowIcon, { backgroundColor: item.tint }]}>
          <Ionicons name={item.icon} size={18} color={item.fg} />
        </View>
        <View style={styles.rowMid}>
          <View style={styles.rowLabelRow}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            {item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{item.badge}</Text>
              </View>
            )}
          </View>
          {item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
      </TouchableOpacity>
    );
  }

  function renderExpandableSection(
    id: ExpandedSection,
    label: string,
    icon: IoniconsName,
    tint: string,
    fg: string,
    items: SubItem[]
  ) {
    const open = expanded === id;
    return (
      <View key={id} style={styles.expandSection}>
        <TouchableOpacity
          style={styles.expandHeader}
          onPress={() => toggle(id)}
          activeOpacity={0.8}
        >
          <View style={[styles.expandIcon, { backgroundColor: tint }]}>
            <Ionicons name={icon} size={19} color={fg} />
          </View>
          <Text style={styles.expandLabel}>{label}</Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textLight}
          />
        </TouchableOpacity>

        {open && (
          <View style={styles.subList}>
            {items.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.subRow, i === items.length - 1 && styles.subRowLast]}
                onPress={() => item.route && router.push(item.route as never)}
                activeOpacity={0.7}
              >
                <View style={styles.subDot} />
                <Ionicons name={item.icon} size={16} color={colors.textMuted} style={styles.subIcon} />
                <Text style={styles.subLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.border} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Menu</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarTxt}>V</Text>
          </View>
          <View style={styles.profileMid}>
            <Text style={styles.profileName}>Godigi</Text>
            <Text style={styles.profileSub}>
              {role === "owner" ? "Free Plan · 5 invoices left" : ROLE_LABELS[role] ?? role}
            </Text>
          </View>
          {role === "owner" && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push("/plans-pricing" as never)}
            >
              <Text style={styles.upgradeBtnTxt}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* My Business */}
        <Text style={styles.sectionHeader}>My Business</Text>
        <View style={styles.group}>
          {renderExpandableSection("sale", "Sale", "receipt-outline", "#fff0f4", "#e11d48", SALE_ITEMS)}
          {renderExpandableSection("purchase", "Purchase", "cart-outline", "#f0fdf4", "#15803d", PURCHASE_ITEMS)}

          {/* Expenses */}
          <TouchableOpacity style={styles.row} onPress={() => router.push("/expense" as never)} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: "#ede9fe" }]}>
              <Ionicons name="wallet-outline" size={18} color="#6d28d9" />
            </View>
            <View style={styles.rowMid}>
              <Text style={styles.rowLabel}>Expenses</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Reports & Finance */}
        {visibleReports.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Reports & Finance</Text>
            <View style={styles.group}>
              {visibleReports.map((item, i) => renderMenuRow(item, i === visibleReports.length - 1))}
            </View>
          </>
        )}

        {/* Tools */}
        {visibleTools.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Tools</Text>
            <View style={styles.group}>
              {visibleTools.map((item, i) => renderMenuRow(item, i === visibleTools.length - 1))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={16} color={colors.red} />
            <Text style={styles.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.versionTxt}>Godigi · v24.1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  body: { paddingBottom: 110 },

  profileCard: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  profileAvatarTxt: { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  profileMid: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: "700", color: colors.text },
  profileSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  upgradeBtn: {
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  upgradeBtnTxt: { fontSize: 11.5, fontWeight: "600", color: "#fff" },

  sectionHeader: {
    fontSize: 13, fontWeight: "600", color: colors.text,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },

  group: {
    backgroundColor: "#fff", marginHorizontal: 16,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },

  // Normal menu row
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowMid: { flex: 1 },
  rowLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  badge: { backgroundColor: colors.greenLight, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 9, fontWeight: "700", color: colors.green, letterSpacing: 0.4 },

  // Expandable section
  expandSection: { borderBottomWidth: 1, borderBottomColor: "#f4f6fa" },
  expandHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  expandIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  expandLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },

  subList: { backgroundColor: "#fafbfc", borderTopWidth: 1, borderTopColor: "#f0f2f5" },
  subRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: "#f0f2f5",
  },
  subRowLast: { borderBottomWidth: 0 },
  subDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border, marginRight: 10 },
  subIcon: { marginRight: 10 },
  subLabel: { flex: 1, fontSize: 13.5, color: colors.text },

  // Footer
  footer: { alignItems: "center", paddingVertical: 28, gap: 12 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: colors.red,
    borderRadius: 100, paddingHorizontal: 24, paddingVertical: 10,
  },
  signOutTxt: { fontSize: 14, fontWeight: "600", color: colors.red },
  versionTxt: { fontSize: 11, color: colors.textLight },
});

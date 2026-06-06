import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { clearToken, getRole, getPermissions } from "../../src/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface MenuRow {
  label: string;
  sub?: string;
  icon: IoniconsName;
  tint: string;
  fg: string;
  badge?: string;
  route?: string;
  allow?: string[];     // role-based: only these roles + owner can see it
  memberOnly?: boolean; // only non-owner roles see it
  requirePerm?: string; // permission-based: if user has a custom permissions list, they need this perm
}

const BUSINESS: MenuRow[] = [
  { label: "Company Profile", sub: "Logo, address, GSTIN", icon: "business-outline", tint: "#dbeafe", fg: "#1d4ed8", allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit"] },
  { label: "Parties", sub: "Customers & suppliers", icon: "people-outline", tint: "#fce7f3", fg: "#be185d", route: "/party", allow: ["secondary_admin", "salesman", "biller", "biller_salesman", "ca_accountant", "ca_accountant_edit"], requirePerm: "parties_view" },
  { label: "Items", sub: "Inventory & stock", icon: "cube-outline", tint: "#dcfce7", fg: "#15803d", route: "/(tabs)/items", allow: ["secondary_admin", "biller_salesman", "salesman", "stock_keeper", "ca_accountant", "ca_accountant_edit"], requirePerm: "items_view" },
  { label: "Tax Settings", sub: "GST & rates", icon: "receipt-outline", tint: "#fef3c7", fg: "#b45309", allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit", "biller", "biller_salesman"] },
];

const REPORTS: MenuRow[] = [
  { label: "Reports", sub: "GST · P&L · Stock", icon: "bar-chart-outline", tint: "#ede9fe", fg: "#6d28d9", route: "/reports", allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit"], requirePerm: "reports_view" },
  { label: "Cashflow", sub: "Daily & monthly", icon: "cash-outline", tint: "#fff1e6", fg: "#c2410c", route: "/reports/cash-flow", allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit"], requirePerm: "cash_view" },
  { label: "Day Book", sub: "Today's transactions", icon: "book-outline", tint: "#dbeafe", fg: "#1d4ed8", route: "/reports/day-book", allow: ["secondary_admin", "ca_accountant", "ca_accountant_edit", "biller", "biller_salesman"], requirePerm: "reports_view" },
];

const TOOLS: MenuRow[] = [
  { label: "Office Location", sub: "Set check-in zone for salesmen", icon: "business-outline", tint: "#e6f3f7", fg: colors.primary, route: "/office-location", allow: ["secondary_admin"] },
  { label: "Salesman Tracking", sub: "Live map & attendance", icon: "map-outline", tint: "#dbeafe", fg: "#1d4ed8", route: "/salesman-tracking", allow: ["secondary_admin"] },
  { label: "My Attendance", sub: "Check in / out at office", icon: "finger-print-outline", tint: "#f0fdf4", fg: "#15803d", route: "/my-visits", allow: ["salesman", "biller_salesman"] },
  { label: "User Management", sub: "Team members & roles", icon: "people-outline", tint: "#fce7f3", fg: "#be185d", route: "/user-management", allow: ["secondary_admin"], requirePerm: "team_manage" },
  { label: "Backup & Sync", sub: "Last sync · 2 min ago", icon: "cloud-upload-outline", tint: "#dcfce7", fg: "#15803d", badge: "Auto", route: "/sync-share", allow: ["secondary_admin"] },
  { label: "Print Settings", sub: "Thermal & A4", icon: "print-outline", tint: "#fef3c7", fg: "#b45309", allow: ["secondary_admin"] },
  { label: "Manage Companies", sub: "Switch or add company", icon: "layers-outline", tint: "#e0e7ff", fg: "#4338ca", route: "/manage-companies", allow: [] },
  { label: "Join with Invite Code", sub: "Enter code from your employer", icon: "key-outline", tint: "#f0fdf4", fg: "#15803d", route: "/accept-invite", memberOnly: true },
  { label: "Plans & Pricing", sub: "Upgrade your plan", icon: "diamond-outline", tint: "#fef3c7", fg: "#b45309", route: "/plans-pricing", allow: ["secondary_admin"] },
  { label: "Help & Support", sub: "Tutorials & FAQs", icon: "help-circle-outline", tint: "#e0e7ff", fg: "#4338ca" },
];

// permissions=null → old JWT or owner → role-based fallback
// permissions=string[] → member with assigned permissions; requirePerm is enforced strictly
function isVisible(item: MenuRow, role: string, permissions: string[] | null): boolean {
  if (role === "owner") return !item.memberOnly;
  if (item.memberOnly) return true;

  if (permissions !== null && item.requirePerm) {
    return permissions.includes(item.requirePerm);
  }

  if (!item.allow) return true;
  return item.allow.includes(role);
}

const ROLE_LABELS: Record<string, string> = {
  secondary_admin: "Secondary Admin",
  salesman: "Salesman",
  biller: "Biller",
  biller_salesman: "Biller & Salesman",
  stock_keeper: "Stock Keeper",
  ca_accountant: "CA / Accountant",
  ca_accountant_edit: "CA / Accountant (Edit)",
};

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [role, setRole] = useState("owner");
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useFocusEffect(useCallback(() => {
    getRole().then(setRole);
    getPermissions().then(setPermissions);
  }, []));

  const visibleBusiness = BUSINESS.filter(i => isVisible(i, role, permissions));
  const visibleReports = REPORTS.filter(i => isVisible(i, role, permissions));
  const visibleTools = TOOLS.filter(i => isVisible(i, role, permissions));

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

  function renderRow(item: MenuRow, last = false) {
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
            <Text style={styles.profileName}>Vyapar Pakistan</Text>
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

        {/* Business */}
        {visibleBusiness.length > 0 && (
          <>
            <SectionHeader title="Business" />
            <View style={styles.group}>
              {visibleBusiness.map((item, i) => renderRow(item, i === visibleBusiness.length - 1))}
            </View>
          </>
        )}

        {/* Reports */}
        {visibleReports.length > 0 && (
          <>
            <View style={styles.group}>
              {visibleReports.map((item, i) => renderRow(item, i === visibleReports.length - 1))}
            </View>
          </>
        )}

        {/* Tools */}
        {visibleTools.length > 0 && (
          <>
            <SectionHeader title="Tools" />
            <View style={styles.group}>
              {visibleTools.map((item, i) => renderRow(item, i === visibleTools.length - 1))}
            </View>
          </>
        )}

        {/* Version & signout */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={16} color={colors.red} />
            <Text style={styles.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.versionTxt}>Vyapar Pakistan · v24.1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
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

  // Profile
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

  // Section header
  sectionHeader: {
    fontSize: 13, fontWeight: "600", color: colors.text,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },

  // Group
  group: {
    backgroundColor: "#fff", marginHorizontal: 16,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
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
  badge: {
    backgroundColor: colors.greenLight, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeTxt: { fontSize: 9, fontWeight: "700", color: colors.green, letterSpacing: 0.4 },

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

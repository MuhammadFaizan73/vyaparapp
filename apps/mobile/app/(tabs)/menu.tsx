import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "../../src/theme";
import { clearToken } from "../../src/auth";

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  iconBg: string;
  sub?: string[];
  badge?: string;
  toggle?: boolean;
  subLabel?: string;
};

const MY_BUSINESS: MenuItem[] = [
  {
    key: "sale",
    label: "Sale",
    icon: "🧾",
    iconBg: "#dbeafe",
    sub: [
      "Sale Invoice",
      "Payment-In",
      "Sale Return (Credit Note)",
      "Estimate/Quotation",
      "Proforma Invoice",
      "Sale Order",
      "Delivery Note",
    ],
  },
  { key: "purchase", label: "Purchase", icon: "🛒", iconBg: "#e0f2fe" },
  { key: "expenses", label: "Expenses", icon: "💰", iconBg: "#dcfce7" },
  { key: "store", label: "My Online Store", icon: "🏪", iconBg: "#fef9c3" },
  { key: "reports", label: "Reports", icon: "📈", iconBg: "#ede9fe" },
];

const CASH_BANK: MenuItem[] = [
  { key: "bank", label: "Bank Accounts", icon: "🏦", iconBg: "#dbeafe" },
  { key: "cash", label: "Cash In-Hand", icon: "👛", iconBg: "#dcfce7" },
  { key: "cheques", label: "Cheques", icon: "📋", iconBg: "#e0f2fe" },
  { key: "loan", label: "Loan Accounts", icon: "💳", iconBg: "#fce7f3" },
];

const UTILITIES: MenuItem[] = [
  {
    key: "sync",
    label: "Sync & Share",
    icon: "🔄",
    iconBg: "#dbeafe",
    toggle: true,
    subLabel: "3159200720",
  },
  { key: "companies", label: "Manage Companies", icon: "🏢", iconBg: "#e0f2fe" },
  { key: "backup", label: "Backup/Restore", icon: "💾", iconBg: "#fef9c3" },
  { key: "utilities", label: "Utilities", icon: "🔧", iconBg: "#ede9fe", badge: "New" },
];

const OTHERS: MenuItem[] = [
  { key: "plans", label: "Plans & Pricing", icon: "💎", iconBg: "#fce7f3" },
  { key: "desktop", label: "Get Desktop Billing Software", icon: "🖥️", iconBg: "#dbeafe" },
  { key: "grow", label: "Grow Your Business", icon: "📊", iconBg: "#dcfce7" },
  { key: "settings", label: "Settings", icon: "⚙️", iconBg: "#f1f5f9", badge: "New" },
  { key: "help", label: "Help & Support", icon: "🎧", iconBg: "#e0f2fe" },
  { key: "rate", label: "Rate this app", icon: "⭐", iconBg: "#fef9c3" },
];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sale: true });
  const [syncOn, setSyncOn] = useState(true);

  function toggle(key: string) {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  }

  function renderItem(item: MenuItem, isLast = false) {
    const hasChildren = !!item.sub;
    const isExpanded = expanded[item.key];

    return (
      <View key={item.key}>
        <TouchableOpacity
          style={[styles.menuItem, isLast && styles.menuItemLast]}
          onPress={() => (hasChildren ? toggle(item.key) : null)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={styles.menuItemCenter}>
            <Text style={styles.menuItemLabel}>{item.label}</Text>
            {item.subLabel && (
              <Text style={styles.menuItemSub}>{item.subLabel}</Text>
            )}
          </View>
          <View style={styles.menuItemRight}>
            {item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            {item.toggle ? (
              <Switch
                value={syncOn}
                onValueChange={setSyncOn}
                trackColor={{ true: colors.green, false: colors.border }}
                thumbColor="#fff"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            ) : null}
            <Text style={styles.chevron}>
              {hasChildren ? (isExpanded ? "∧" : "∨") : "›"}
            </Text>
          </View>
        </TouchableOpacity>

        {hasChildren && isExpanded && item.sub?.map((sub, i) => (
          <TouchableOpacity
            key={sub}
            style={[styles.subItem, i === item.sub!.length - 1 && styles.subItemLast]}
            activeOpacity={0.7}
          >
            <Text style={styles.subItemLabel}>{sub}</Text>
            <Text style={styles.chevronSub}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>⊡</Text>
        </View>
        <Text style={styles.headerTitle}>Rootocloud</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* My Business */}
        <Text style={styles.sectionLabel}>My Business</Text>
        <View style={styles.section}>
          {MY_BUSINESS.map((item, i) =>
            renderItem(item, i === MY_BUSINESS.length - 1)
          )}
        </View>

        {/* Cash & Bank */}
        <Text style={styles.sectionLabel}>Cash &amp; Bank</Text>
        <View style={styles.section}>
          {CASH_BANK.map((item, i) =>
            renderItem(item, i === CASH_BANK.length - 1)
          )}
        </View>

        {/* Important Utilities */}
        <Text style={styles.sectionLabel}>Important Utilities</Text>
        <View style={styles.section}>
          {UTILITIES.map((item, i) =>
            renderItem(item, i === UTILITIES.length - 1)
          )}
        </View>

        {/* Others */}
        <Text style={styles.sectionLabel}>Others</Text>
        <View style={styles.section}>
          {OTHERS.map((item, i) =>
            renderItem(item, i === OTHERS.length - 1)
          )}
        </View>

        {/* App Version */}
        <Text style={styles.sectionLabel}>App Version</Text>
        <View style={styles.section}>
          <View style={styles.versionRow}>
            <Text style={styles.versionText}>24.1.0</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => Alert.alert("Sign Out", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: async () => {
                await clearToken();
                router.replace("/onboarding" as never);
              }},
            ])}
          >
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.privacyLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <View style={styles.footerBrand}>
            <Text style={styles.footerBrandText}>▼ Vyapar</Text>
            <Text style={styles.footerCaption}>Crafted by Simply Vyapar Apps Pvt Ltd.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#bae6fd",
  },
  logoIcon: { fontSize: 18 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  headerIcons: { flexDirection: "row", gap: 8 },
  headerIconBtn: { padding: 6 },
  headerIconText: { fontSize: 18 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.sectionLabel,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  section: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  menuItemLast: { borderBottomWidth: 0 },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconText: { fontSize: 16 },
  menuItemCenter: { flex: 1 },
  menuItemLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  menuItemSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  menuItemRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  chevron: { fontSize: 16, color: colors.textMuted, fontWeight: "600" },

  badge: {
    backgroundColor: colors.red,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },

  subItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 62,
    paddingRight: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: "#fafcfe",
  },
  subItemLast: { borderBottomWidth: 0 },
  subItemLabel: { fontSize: 13.5, color: colors.text },
  chevronSub: { fontSize: 16, color: colors.textMuted },

  versionRow: { paddingHorizontal: 14, paddingVertical: 13 },
  versionText: { fontSize: 14, color: colors.textMuted },

  footer: { alignItems: "center", paddingVertical: 24, gap: 12 },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  logoutText: { fontSize: 14, fontWeight: "600", color: colors.red },
  privacyLink: { fontSize: 13, color: colors.primary },
  footerBrand: { alignItems: "center", gap: 4 },
  footerBrandText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
  footerCaption: { fontSize: 11, color: colors.textLight },
});

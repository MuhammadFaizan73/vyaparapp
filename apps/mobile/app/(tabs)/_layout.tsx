import { useState, useEffect, useCallback } from "react";
import { Tabs, router } from "expo-router";
import { Platform, View, StyleSheet, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Distributor, Branch } from "@vyapar/api-client";
import { colors } from "../../src/theme";
import { getRole, getPermissions } from "../../src/auth";
import { useDevice } from "../../src/useDeviceSession";
import { useSelectedCompany } from "../../src/useSelectedCompany";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// null = owner/legacy JWT → always show tab
function hasPerm(permissions: string[] | null, perm: string): boolean {
  if (permissions === null) return true;
  return permissions.includes(perm);
}

function ReadOnlyBanner() {
  const { isReadOnly } = useDevice();
  if (!isReadOnly) return null;
  return (
    <TouchableOpacity
      style={styles.readOnlyBanner}
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

// Drill-down state for the switch-company sheet: root (Distributors + any
// unassigned Companies) -> a Distributor's Branches -> a Branch's Companies.
type CompanyView =
  | { level: "root" }
  | { level: "distributor"; distributor: Distributor }
  | { level: "branch"; distributor: Distributor; branch: Branch };

function CompanyBanner() {
  const {
    distributors, branches, companies,
    selectedDistributorId, selectedBranchId, selectedCompanyId,
    filterLabel,
    setSelectedDistributorId, setSelectedBranchId, setSelectedCompanyId,
  } = useSelectedCompany();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CompanyView>({ level: "root" });
  // Desktop's equivalent dropdown is always visible, even for a single-company tenant —
  // it's the only way to confirm/select that company. Only hide here if there's truly
  // nothing to pick (a brand-new tenant whose default Company row hasn't loaded yet).
  if (companies.length === 0 && distributors.length === 0) return null;

  function pick(fn: () => void) {
    fn();
    setOpen(false);
    setView({ level: "root" });
  }

  const unassigned = companies.filter((c) => !c.branchId);
  const branchesOf = (distributorId: string) => branches.filter((b) => b.distributorId === distributorId);
  const companiesOf = (branchId: string) => companies.filter((c) => c.branchId === branchId);

  return (
    <>
      <TouchableOpacity style={styles.companyBanner} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Ionicons name="business-outline" size={14} color={colors.primary} />
        <Text style={styles.companyBannerText} numberOfLines={1}>{filterLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.primary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => { setOpen(false); setView({ level: "root" }); }}
      >
        <TouchableOpacity
          style={styles.companySheetBackdrop}
          onPress={() => { setOpen(false); setView({ level: "root" }); }}
          activeOpacity={1}
        >
          <View style={styles.companySheet} onStartShouldSetResponder={() => true}>
            <View style={styles.companySheetHandle} />
            <Text style={styles.companySheetTitle}>Switch Company</Text>
            <ScrollView style={{ maxHeight: "100%" }}>
              <TouchableOpacity
                style={styles.companySheetRow}
                onPress={() => pick(() => setSelectedDistributorId(null))}
              >
                <Text style={styles.companySheetRowText}>All Companies</Text>
                {!selectedDistributorId && !selectedBranchId && !selectedCompanyId && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>

              {view.level === "root" && (
                <>
                  {distributors.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.companySheetRow}
                      onPress={() => setView({ level: "distributor", distributor: d })}
                    >
                      <Text style={styles.companySheetRowText}>{d.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ))}
                  {unassigned.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.companySheetRow}
                      onPress={() => pick(() => setSelectedCompanyId(c.id))}
                    >
                      <Text style={styles.companySheetRowText}>{c.name}</Text>
                      {selectedCompanyId === c.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {view.level === "distributor" && (
                <>
                  <TouchableOpacity style={styles.companySheetBack} onPress={() => setView({ level: "root" })}>
                    <Ionicons name="chevron-back" size={16} color="#64748b" />
                    <Text style={styles.companySheetBackText}>All Distributors</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.companySheetRow}
                    onPress={() => pick(() => setSelectedDistributorId(view.distributor.id))}
                  >
                    <Text style={styles.companySheetRowText}>All of {view.distributor.name}</Text>
                    {selectedDistributorId === view.distributor.id && !selectedBranchId && !selectedCompanyId && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  {branchesOf(view.distributor.id).map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={styles.companySheetRow}
                      onPress={() => setView({ level: "branch", distributor: view.distributor, branch: b })}
                    >
                      <Text style={styles.companySheetRowText}>{b.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {view.level === "branch" && (
                <>
                  <TouchableOpacity
                    style={styles.companySheetBack}
                    onPress={() => setView({ level: "distributor", distributor: view.distributor })}
                  >
                    <Ionicons name="chevron-back" size={16} color="#64748b" />
                    <Text style={styles.companySheetBackText}>{view.distributor.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.companySheetRow}
                    onPress={() => pick(() => setSelectedBranchId(view.branch.id))}
                  >
                    <Text style={styles.companySheetRowText}>All of {view.branch.name}</Text>
                    {selectedBranchId === view.branch.id && !selectedCompanyId && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  {companiesOf(view.branch.id).map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.companySheetRow}
                      onPress={() => pick(() => setSelectedCompanyId(c.id))}
                    >
                      <Text style={styles.companySheetRowText}>{c.name}</Text>
                      {selectedCompanyId === c.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function TabLayout() {
  const [role, setRole] = useState("owner");
  const [permissions, setPermissions] = useState<string[] | null>(null);

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
      <CompanyBanner />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#fff",
    borderTopColor: "#e7edf3",
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 82 : 66,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
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
  companyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e7ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  companyBannerText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "700",
    maxWidth: 220,
  },
  companySheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  companySheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: "60%",
  },
  companySheetHandle: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: "#dde0e7",
    alignSelf: "center", marginBottom: 14,
  },
  companySheetTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  companySheetRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f0f2f5",
  },
  companySheetRowText: { fontSize: 14, color: "#0f172a" },
  companySheetBack: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 10,
  },
  companySheetBackText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
});

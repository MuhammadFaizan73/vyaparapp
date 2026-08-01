import { useState, useEffect, useCallback } from "react";
import { Tabs, router } from "expo-router";
import { Platform, View, StyleSheet, Text, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

function CompanyBanner() {
  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId } = useSelectedCompany();
  const [open, setOpen] = useState(false);
  if (companies.length < 2) return null;

  return (
    <>
      <TouchableOpacity style={styles.companyBanner} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Ionicons name="business-outline" size={14} color={colors.primary} />
        <Text style={styles.companyBannerText} numberOfLines={1}>
          {selectedCompany?.name ?? "All Companies"}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.primary} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.companySheetBackdrop} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={styles.companySheet} onStartShouldSetResponder={() => true}>
            <View style={styles.companySheetHandle} />
            <Text style={styles.companySheetTitle}>Switch Company</Text>
            <FlatList
              data={[{ id: null as string | null, name: "All Companies" }, ...companies]}
              keyExtractor={(item) => item.id ?? "__all__"}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.companySheetRow}
                  onPress={() => { setSelectedCompanyId(item.id); setOpen(false); }}
                >
                  <Text style={styles.companySheetRowText}>{item.name}</Text>
                  {selectedCompanyId === item.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
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
});

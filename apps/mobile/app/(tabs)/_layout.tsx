import { useState, useEffect } from "react";
import { Tabs, router } from "expo-router";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { getRole, getPermissions } from "../../src/auth";
import { useDevice } from "../../src/useDeviceSession";
import { useSettings } from "../../src/useSettings";
import { CompanySwitcherBar } from "../../src/components/CompanySwitcher";
import { PersistentBottomBar } from "../../src/components/PersistentBottomBar";

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
    // A loud solid band bleeding into the status bar read as an error state, not a
    // gentle heads-up, and didn't match how every other amber/warning indicator in this
    // app (party balances, unpaid badges, team-member status) is styled — a light tint
    // with amber text/icon, never a full-bleed solid color. The status-bar area itself
    // stays the app's own background so the banner reads as "a notice within the app",
    // not as if the OS status bar changed color.
    <View style={{ paddingTop: insets.top, backgroundColor: colors.card }}>
      <TouchableOpacity
        style={styles.readOnlyBanner}
        onPress={() => router.push("/manage-devices")}
        activeOpacity={0.8}
      >
        <View style={styles.readOnlyIconWrap}>
          <Ionicons name="eye-outline" size={18} color={colors.amber} />
        </View>
        <View style={styles.readOnlyTextWrap}>
          <Text style={styles.readOnlyTitle}>View-only mode</Text>
          <Text style={styles.readOnlyText}>Activate this device to create entries</Text>
        </View>
        <View style={styles.readOnlyBtn}>
          <Text style={styles.readOnlyBtnTxt}>Activate</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  const [role, setRole] = useState("owner");
  const [permissions, setPermissions] = useState<string[] | null>(null);
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
        tabBar={settings.appTheme === "modern" ? undefined : () => <PersistentBottomBar />}
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
    backgroundColor: colors.amberLight,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  readOnlyIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#fde68a",
    alignItems: "center", justifyContent: "center",
  },
  readOnlyTextWrap: { flex: 1 },
  readOnlyTitle: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "700",
  },
  readOnlyText: {
    color: colors.amber,
    fontSize: 11.5,
    marginTop: 2,
  },
  readOnlyBtn: {
    backgroundColor: colors.amber,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  readOnlyBtnTxt: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "700",
  },
});

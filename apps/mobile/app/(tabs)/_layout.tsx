import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ icon, focused, gold }: { icon: string; focused: boolean; gold?: boolean }) {
  const color = gold ? colors.gold : focused ? colors.primary : colors.textLight;
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

function TabLabel({ label, focused, gold }: { label: string; focused: boolean; gold?: boolean }) {
  const color = gold ? colors.gold : focused ? colors.primary : colors.textLight;
  return <Text style={{ fontSize: 10, fontWeight: "600", color, marginTop: 2 }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon icon="🏠" focused={focused} />
              <TabLabel label="HOME" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon icon="📊" focused={focused} />
              <TabLabel label="DASHBOARD" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon icon="📦" focused={focused} />
              <TabLabel label="ITEMS" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon icon="☰" focused={focused} />
              <TabLabel label="MENU" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="premium"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon icon="💎" focused={focused} gold />
              <TabLabel label="GET PREMIUM" focused={focused} gold />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    height: 60,
    paddingBottom: 4,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
});

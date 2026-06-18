import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../src/auth";
import { useDevice } from "../src/useDeviceSession";
import type { DeviceSession } from "@vyapar/api-client";

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const TEAL = "#0f5a72";

function deviceIcon(type: string): MCIName {
  if (type === "mobile") return "cellphone";
  if (type === "web") return "web";
  return "monitor";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ManageDevicesScreen() {
  const { sessionId, deviceId, refresh: refreshDevice } = useDevice();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getDevices();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (session: DeviceSession) => {
    if (session.isActive) return;
    Alert.alert(
      "Activate Device",
      `Make "${session.deviceName}" the active device? All other devices will switch to view-only mode.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate",
          onPress: async () => {
            setActivating(session.id);
            try {
              await api.activateDevice(session.id);
              await load();
              await refreshDevice();
            } catch {
              Alert.alert("Error", "Could not activate device.");
            } finally {
              setActivating(null);
            }
          },
        },
      ],
    );
  };

  const handleRemove = async (session: DeviceSession) => {
    const isMe = session.id === sessionId;
    Alert.alert(
      "Remove Device",
      isMe
        ? "Remove this device? You will be switched to view-only mode or logged out."
        : `Remove "${session.deviceName}" from your account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.removeDevice(session.id);
              await load();
              if (isMe) await refreshDevice();
            } catch {
              Alert.alert("Error", "Could not remove device.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Devices</Text>
      </View>

      <Text style={styles.subtitle}>
        Only the <Text style={{ fontWeight: "700" }}>active</Text> device can add or edit data.
        Tap a device to activate it.
      </Text>

      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TEAL} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const isMe = item.id === sessionId || item.deviceId === undefined;
          const isBusy = activating === item.id;
          return (
            <View style={[styles.card, item.isActive && styles.cardActive]}>
              <View style={styles.cardLeft}>
                <MaterialCommunityIcons
                  name={deviceIcon(item.deviceType)}
                  size={30}
                  color={item.isActive ? TEAL : "#94a3b8"}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.deviceName} numberOfLines={1}>
                    {item.deviceName}
                    {isMe ? " (this device)" : ""}
                  </Text>
                  {item.isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  ) : (
                    <View style={styles.readonlyBadge}>
                      <Text style={styles.readonlyBadgeText}>VIEW ONLY</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.lastSeen}>
                  {item.deviceType} · last seen {timeAgo(item.lastSeenAt)}
                </Text>
              </View>
              <View style={styles.cardActions}>
                {!item.isActive && (
                  <TouchableOpacity
                    style={styles.activateBtn}
                    onPress={() => handleActivate(item)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={TEAL} />
                    ) : (
                      <Text style={styles.activateBtnText}>Activate</Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleRemove(item)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="devices" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No devices found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL,
    paddingTop: Platform.OS === "ios" ? 52 : 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  back: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  subtitle: {
    margin: 16,
    marginBottom: 4,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: { borderColor: TEAL, backgroundColor: "#f0f9ff" },
  cardLeft: { width: 40, alignItems: "center" },
  cardBody: { flex: 1, gap: 4 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  deviceName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0f172a" },
  lastSeen: { fontSize: 12, color: "#94a3b8" },
  activeBadge: {
    backgroundColor: "#d1fae5",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 10, fontWeight: "700", color: "#059669" },
  readonlyBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  readonlyBadgeText: { fontSize: 10, fontWeight: "700", color: "#d97706" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  activateBtn: {
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: "center",
  },
  activateBtnText: { fontSize: 12, fontWeight: "700", color: TEAL },
  removeBtn: { padding: 6 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
});

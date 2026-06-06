import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import type { ShopVisit, LocationPingPoint } from "@vyapar/api-client";

type LiveEntry = {
  member: { id: string; name: string; contact: string; role: string };
  lastSeen: string | null;
  latitude: number | null;
  longitude: number | null;
  currentVisit: any | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtAgo(iso: string | null) {
  if (!iso) return "Never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function SalesmanTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [tab, setTab] = useState<"map" | "visits">("map");
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [visits, setVisits] = useState<ShopVisit[]>([]);
  const [pings, setPings] = useState<LocationPingPoint[]>([]);
  const [officeLoc, setOfficeLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const loadLive = useCallback(async () => {
    try {
      const data = await api.getLiveLocations();
      setLive(data as LiveEntry[]);
    } catch { /* ignore */ }
    finally { setLiveLoading(false); }
  }, []);

  useEffect(() => {
    void loadLive();
    const id = setInterval(() => void loadLive(), 30_000);
    return () => clearInterval(id);
  }, [loadLive]);

  async function selectMember(memberId: string) {
    setSelected(memberId);
    setRouteLoading(true);
    try {
      const [visitData, pingData, officeData] = await Promise.all([
        api.getAdminSalesmanRoute(memberId, today),
        api.getAdminSalesmanPings(memberId, today),
        api.getOfficeLocation(),
      ]);
      setVisits(visitData);
      setPings(pingData);
      const office = officeData.lat != null
        ? { latitude: officeData.lat, longitude: officeData.lng! }
        : null;
      setOfficeLoc(office);

      // Fit map to show entire route: office + all shop coords
      const shopPoints = visitData
        .filter(v => v.latitude != null && v.longitude != null)
        .map(v => ({ latitude: v.latitude!, longitude: v.longitude! }));
      const allPoints = [...(office ? [office] : []), ...shopPoints];

      if (allPoints.length >= 2) {
        mapRef.current?.fitToCoordinates(allPoints, {
          edgePadding: { top: 80, right: 60, bottom: 220, left: 60 },
          animated: true,
        });
      } else if (allPoints.length === 1) {
        mapRef.current?.animateToRegion(
          { ...allPoints[0], latitudeDelta: 0.015, longitudeDelta: 0.015 },
          400
        );
      }
    } catch { /* ignore */ }
    finally { setRouteLoading(false); }
  }

  const selectedMember = live.find(e => e.member.id === selected);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Salesman Tracking</Text>
        <TouchableOpacity onPress={loadLive} hitSlop={8}>
          <Ionicons name="refresh-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(["map", "visits"] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Ionicons name={t === "map" ? "map-outline" : "list-outline"} size={15} color={tab === t ? colors.primary : colors.textMuted} />
            <Text style={[s.tabBtnTxt, tab === t && s.tabBtnTxtActive]}>{t === "map" ? "Live Map" : "Visit Log"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "map" ? (
        <View style={{ flex: 1 }}>
          {liveLoading ? (
            <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={{ latitude: 30.3753, longitude: 69.3451, latitudeDelta: 8, longitudeDelta: 8 }}
              showsUserLocation
            >
              {/* Actual GPS ping trail — dashed gray background line */}
              {selected && pings.length > 1 && (
                <Polyline
                  coordinates={pings.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
                  strokeColor="#cbd5e1"
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              )}

              {/* Green route: office → shops in chronological order */}
              {selected && (() => {
                const shopCoords = visits
                  .filter(v => v.latitude != null && v.longitude != null)
                  .map(v => ({ latitude: v.latitude!, longitude: v.longitude! }));
                const routeCoords = officeLoc
                  ? [officeLoc, ...shopCoords]
                  : shopCoords;
                return routeCoords.length > 1 ? (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#16a34a"
                    strokeWidth={3.5}
                  />
                ) : null;
              })()}

              {/* Office / head office marker */}
              {selected && officeLoc && (
                <Marker coordinate={officeLoc} tracksViewChanges={false}>
                  <View style={s.officeMarker}>
                    <Ionicons name="business" size={15} color="#fff" />
                  </View>
                  <Callout>
                    <View style={s.shopCallout}>
                      <Text style={s.shopCalloutName}>Head Office</Text>
                      <Text style={s.shopCalloutTime}>Route starting point</Text>
                    </View>
                  </Callout>
                </Marker>
              )}

              {/* Numbered shop visit markers for selected salesman */}
              {selected && visits
                .filter(v => v.latitude != null && v.longitude != null)
                .map((v, i) => {
                  const active = v.checkedOutAt === null;
                  return (
                    <Marker
                      key={v.id}
                      coordinate={{ latitude: v.latitude!, longitude: v.longitude! }}
                      tracksViewChanges={false}
                    >
                      <View style={[s.shopNumBubble, { backgroundColor: active ? colors.primary : colors.green }]}>
                        <Text style={s.shopNumTxt}>{i + 1}</Text>
                      </View>
                      <Callout>
                        <View style={s.shopCallout}>
                          <Text style={s.shopCalloutName}>{v.partyName ?? "Shop"}</Text>
                          <Text style={s.shopCalloutTime}>
                            In: {fmtTime(v.checkedInAt)}
                            {v.checkedOutAt ? `  Out: ${fmtTime(v.checkedOutAt)}` : "  · Active"}
                          </Text>
                          {v.durationMin != null && (
                            <Text style={s.shopCalloutDuration}>{v.durationMin} min spent</Text>
                          )}
                        </View>
                      </Callout>
                    </Marker>
                  );
                })
              }

              {/* Live salesman markers */}
              {live
                .filter(e => e.latitude != null && e.longitude != null)
                .map(e => (
                  <Marker
                    key={e.member.id}
                    coordinate={{ latitude: e.latitude!, longitude: e.longitude! }}
                    tracksViewChanges={false}
                    onPress={() => selectMember(e.member.id)}
                  >
                    <View style={[s.salesmanDot, selected === e.member.id && s.salesmanDotSelected]}>
                      <Text style={s.salesmanDotInitial}>{e.member.name[0]?.toUpperCase()}</Text>
                    </View>
                    <Callout>
                      <View style={s.memberCallout}>
                        <Text style={s.memberCalloutName}>{e.member.name}</Text>
                        <Text style={s.memberCalloutSub}>
                          {e.currentVisit ? `At: ${e.currentVisit.partyName ?? "Shop"}` : "No active visit"}
                        </Text>
                        <Text style={s.memberCalloutTime}>Last seen {fmtAgo(e.lastSeen)}</Text>
                      </View>
                    </Callout>
                  </Marker>
                ))
              }
            </MapView>
          )}

          {/* Bottom sheet: salesman list */}
          <View style={[s.bottomSheet, { paddingBottom: insets.bottom + 8 }]}>
            {routeLoading && (
              <View style={s.routeLoadingBar}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.routeLoadingTxt}>Loading route…</Text>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.memberChips}>
              {live.map(e => (
                <TouchableOpacity
                  key={e.member.id}
                  style={[s.memberChip, selected === e.member.id && s.memberChipActive]}
                  onPress={() => selectMember(e.member.id)}
                >
                  <View style={[s.chipAvatar, selected === e.member.id && s.chipAvatarActive]}>
                    <Text style={s.chipAvatarTxt}>{e.member.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={[s.chipName, selected === e.member.id && s.chipNameActive]} numberOfLines={1}>
                      {e.member.name}
                    </Text>
                    <Text style={s.chipSub}>
                      {e.latitude ? fmtAgo(e.lastSeen) : "No location"}
                      {selected === e.member.id && visits.length > 0 ? ` · ${visits.length} shops` : ""}
                    </Text>
                  </View>
                  {e.currentVisit && (
                    <View style={s.activeIndicator} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : (
        /* === Visits tab === */
        <ScrollView contentContainerStyle={s.visitList}>
          {live.length === 0 ? (
            <View style={s.center}><Text style={s.emptyTxt}>No team members yet</Text></View>
          ) : !selected ? (
            <View style={s.center}>
              <Ionicons name="people-outline" size={48} color={colors.border} />
              <Text style={s.emptyTxt}>Select a salesman from the Map tab</Text>
            </View>
          ) : routeLoading ? (
            <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
          ) : visits.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="storefront-outline" size={48} color={colors.border} />
              <Text style={s.emptyTxt}>No shop visits today</Text>
              <Text style={s.emptySub}>for {selectedMember?.member.name}</Text>
            </View>
          ) : (
            <>
              <Text style={s.visitListHeader}>{selectedMember?.member.name} — Today's Route</Text>
              {officeLoc && (
                <View style={s.officeRouteStart}>
                  <View style={s.officeRouteIcon}>
                    <Ionicons name="business" size={14} color="#fff" />
                  </View>
                  <Text style={s.officeRouteLabel}>Head Office → Route Start</Text>
                </View>
              )}
              {visits.map((v, i) => {
                const active = v.checkedOutAt === null;
                return (
                  <View key={v.id} style={s.visitCard}>
                    <View style={[s.visitNum, { backgroundColor: active ? colors.primary : colors.green }]}>
                      <Text style={s.visitNumTxt}>{i + 1}</Text>
                    </View>
                    <View style={s.visitInfo}>
                      <Text style={s.visitShopName}>{v.partyName ?? "Unknown Shop"}</Text>
                      <Text style={s.visitTime}>
                        In: {fmtTime(v.checkedInAt)}
                        {v.checkedOutAt ? `   Out: ${fmtTime(v.checkedOutAt)}` : "   · Active now"}
                      </Text>
                      {v.notes ? <Text style={s.visitNotes}>{v.notes}</Text> : null}
                    </View>
                    <View style={s.visitDurationWrap}>
                      {active ? (
                        <View style={s.activePill}>
                          <Text style={s.activePillTxt}>Active</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={s.visitDuration}>{v.durationMin ?? 0}</Text>
                          <Text style={s.visitDurationLabel}>min</Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabBtnTxtActive: { color: colors.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyTxt: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted },

  // Map markers
  officeMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", elevation: 6 },
  salesmanDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", elevation: 5 },
  salesmanDotSelected: { width: 46, height: 46, borderRadius: 23, borderColor: colors.teal, borderWidth: 4 },
  salesmanDotInitial: { fontSize: 15, fontWeight: "800", color: "#fff" },
  shopNumBubble: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#fff", elevation: 5 },
  shopNumTxt: { fontSize: 12, fontWeight: "800", color: "#fff" },

  memberCallout: { padding: 6, minWidth: 140 },
  memberCalloutName: { fontSize: 13, fontWeight: "700", color: colors.text },
  memberCalloutSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  memberCalloutTime: { fontSize: 10, color: colors.textLight, marginTop: 2 },
  shopCallout: { padding: 6, minWidth: 130 },
  shopCalloutName: { fontSize: 13, fontWeight: "700", color: colors.text },
  shopCalloutTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  shopCalloutDuration: { fontSize: 11, fontWeight: "700", color: colors.green, marginTop: 2 },

  // Bottom sheet
  bottomSheet: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  routeLoadingBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  routeLoadingTxt: { fontSize: 12, color: colors.textMuted },
  memberChips: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  memberChip: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", minWidth: 140, maxWidth: 200 },
  memberChipActive: { borderColor: colors.primary, backgroundColor: "#e6f3f7" },
  chipAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#e6f3f7", alignItems: "center", justifyContent: "center" },
  chipAvatarActive: { backgroundColor: colors.primary },
  chipAvatarTxt: { fontSize: 14, fontWeight: "700", color: colors.primary },
  chipName: { fontSize: 13, fontWeight: "600", color: colors.text, maxWidth: 110 },
  chipNameActive: { color: colors.primary },
  chipSub: { fontSize: 10, color: colors.textLight, marginTop: 1 },
  activeIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, position: "absolute", top: 8, right: 8 },

  // Visit log
  officeRouteStart: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  officeRouteIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" },
  officeRouteLabel: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  visitList: { padding: 16, gap: 10, paddingBottom: 60 },
  visitListHeader: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  visitCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  visitNum: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  visitNumTxt: { fontSize: 13, fontWeight: "800", color: "#fff" },
  visitInfo: { flex: 1, gap: 3 },
  visitShopName: { fontSize: 14, fontWeight: "700", color: colors.text },
  visitTime: { fontSize: 11, color: colors.textMuted },
  visitNotes: { fontSize: 11, color: colors.textLight, fontStyle: "italic" },
  visitDurationWrap: { alignItems: "center" },
  visitDuration: { fontSize: 18, fontWeight: "800", color: colors.primary },
  visitDurationLabel: { fontSize: 10, color: colors.textMuted },
  activePill: { backgroundColor: "#e6f3f7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  activePillTxt: { fontSize: 10, fontWeight: "700", color: colors.primary },
});

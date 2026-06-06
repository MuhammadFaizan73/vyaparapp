import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";
import { useShopRoute } from "../../src/useShopRoute";
import { api } from "../../src/auth";
import { AssignModal } from "./assign-modal";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

const FILTERS = ["All", "Customers", "Suppliers", "Receivable", "Payable"];

const TINTS = [
  { tint: "#dbeafe", fg: "#1d4ed8" },
  { tint: "#dcfce7", fg: "#15803d" },
  { tint: "#fef3c7", fg: "#b45309" },
  { tint: "#ede9fe", fg: "#6d28d9" },
  { tint: "#fce7f3", fg: "#be185d" },
  { tint: "#fff1e6", fg: "#c2410c" },
];
const hueCache: Record<string, { tint: string; fg: string }> = {};
let hueIdx = 0;
function partyHue(name: string) {
  if (!hueCache[name]) { hueCache[name] = TINTS[hueIdx++ % TINTS.length]; }
  return hueCache[name];
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 0 });
}

export default function PartyListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties, loading, reload, todayPartyIds, isSalesman } = useParties();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(0);
  const [mapView, setMapView] = useState(false);
  const mapRef = useRef<MapView>(null);

  const mapReadyRef = useRef(false);

  function fitMapToParties() {
    if (mappedParties.length === 0) return;
    if (mappedParties.length === 1) {
      mapRef.current?.animateToRegion(
        { latitude: mappedParties[0].latitude!, longitude: mappedParties[0].longitude!, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600
      );
    } else {
      mapRef.current?.fitToCoordinates(
        mappedParties.map((p) => ({ latitude: p.latitude!, longitude: p.longitude! })),
        { edgePadding: { top: 100, right: 80, bottom: 180, left: 80 }, animated: true }
      );
    }
  }

  useEffect(() => {
    if (!mapView) { mapReadyRef.current = false; return; }
    const timer = setTimeout(() => {
      if (mapReadyRef.current) fitMapToParties();
    }, 800);
    return () => clearTimeout(timer);
  }, [mapView]);

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{ visible: boolean; partyId: string; partyName: string }>({
    visible: false,
    partyId: "",
    partyName: "",
  });

  // Current location for distance display
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!isSalesman) return;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        .catch(() => {});
    });
  }, [isSalesman]);

  // Shop route / check-in state
  const { route, reload: reloadRoute, openVisitByPartyId, completedVisitByPartyId } = useShopRoute();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isSalesman) return;
    const id = setInterval(() => {
      setTick(t => t + 1);
      void reloadRoute(); // re-fetch visit status every 30s so check-out shows automatically
    }, 30_000);
    return () => clearInterval(id);
  }, [isSalesman, reloadRoute]);
  void tick;

  const filtered = parties.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? "").includes(search);
    const matchFilter =
      activeFilter === 0 ||
      (activeFilter === 1 && (p.partyType === "customer" || p.partyType === "both")) ||
      (activeFilter === 2 && (p.partyType === "supplier" || p.partyType === "both")) ||
      (activeFilter === 3 && p.balance > 0) ||
      (activeFilter === 4 && p.balance < 0);
    return matchSearch && matchFilter;
  });

  // Salesman sees only today's assigned shops; admin/owner sees all
  const todayParties = isSalesman ? filtered.filter((p) => todayPartyIds.has(p.id)) : [];
  const otherParties = isSalesman ? [] : filtered;

  const totalReceivable = parties
    .filter((p) => p.balance > 0)
    .reduce((s, p) => s + p.balance, 0);
  const totalPayable = parties
    .filter((p) => p.balance < 0)
    .reduce((s, p) => s + Math.abs(p.balance), 0);

  // Parties that have a location set
  const mappedParties = filtered.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  function openLocationPicker(partyId: string, partyName: string, lat?: number | null, lng?: number | null) {
    let qs = `partyId=${encodeURIComponent(partyId)}&partyName=${encodeURIComponent(partyName)}`;
    if (lat != null) qs += `&initLat=${lat}`;
    if (lng != null) qs += `&initLng=${lng}`;
    router.push(`/party/location-picker?${qs}` as never);
  }

  function openAssignModal(partyId: string, partyName: string) {
    setAssignModal({ visible: true, partyId, partyName });
  }

  function elapsedText(checkedInAt: string): string {
    const min = Math.round((Date.now() - new Date(checkedInAt).getTime()) / 60000);
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  function renderPartyCard(p: (typeof parties)[0], isToday = false) {
    const hue = partyHue(p.name);
    const balance = p.balance ?? 0;
    const hasLocation = p.latitude != null && p.longitude != null;
    const openVisit = openVisitByPartyId.get(p.id);
    const doneMin = completedVisitByPartyId.get(p.id);
    const distKm = myLoc && hasLocation
      ? haversineKm(myLoc.lat, myLoc.lng, p.latitude!, p.longitude!)
      : null;
    const distStr = distKm != null ? fmtDist(distKm) : null;

    return (
      <View key={p.id} style={[s.card, isToday && s.cardToday]}>
        {isToday && <View style={s.todayBar} />}
        <TouchableOpacity
          activeOpacity={0.7}
          style={s.cardInner}
          onPress={() => router.push(`/party/statement?partyId=${p.id}` as never)}
        >
          <View style={[s.avatar, { backgroundColor: hue.tint }]}>
            <Text style={[s.avatarTxt, { color: hue.fg }]}>{p.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={s.cardMid}>
            <View style={s.nameRow}>
              <Text style={s.partyName}>{p.name}</Text>
              {!p.isSystem && (
                <View
                  style={[
                    s.typeBadge,
                    {
                      backgroundColor:
                        p.partyType === "customer"
                          ? "#dbeafe"
                          : p.partyType === "supplier"
                          ? "#fef3c7"
                          : "#ede9fe",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.typeBadgeTxt,
                      {
                        color:
                          p.partyType === "customer"
                            ? "#1d4ed8"
                            : p.partyType === "supplier"
                            ? "#b45309"
                            : "#6d28d9",
                      },
                    ]}
                  >
                    {p.partyType === "customer"
                      ? "C"
                      : p.partyType === "supplier"
                      ? "S"
                      : "B"}
                  </Text>
                </View>
              )}
              {isToday && (
                <View style={s.todayBadge}>
                  <Text style={s.todayBadgeTxt}>Today</Text>
                </View>
              )}
            </View>
            {p.phone ? (
              <Text style={s.partySub}>{p.phone}</Text>
            ) : p.email ? (
              <Text style={s.partySub}>{p.email}</Text>
            ) : null}
          </View>
          <View style={s.cardRight}>
            {balance !== 0 ? (
              <>
                <Text
                  style={[
                    s.balanceAmt,
                    { color: balance > 0 ? colors.green : colors.red },
                  ]}
                >
                  Rs {fmt(balance)}
                </Text>
                <Text
                  style={[
                    s.balanceLabel,
                    { color: balance > 0 ? colors.green : colors.red },
                  ]}
                >
                  {balance > 0 ? "You'll Get" : "You'll Give"}
                </Text>
              </>
            ) : (
              <Text style={s.balanceNil}>Settled</Text>
            )}
            {!p.isSystem && (
              <TouchableOpacity
                style={[s.pinBtn, hasLocation && s.pinBtnActive]}
                hitSlop={4}
                onPress={() =>
                  openLocationPicker(
                    p.id,
                    p.name,
                    p.latitude,
                    p.longitude
                  )
                }
              >
                <Ionicons
                  name={hasLocation ? "location" : "location-outline"}
                  size={13}
                  color={hasLocation ? colors.primary : colors.textLight}
                />
              </TouchableOpacity>
            )}
            {!p.isSystem && !isSalesman && (
              <TouchableOpacity
                style={s.assignBtn}
                hitSlop={4}
                onPress={() => openAssignModal(p.id, p.name)}
              >
                <Ionicons name="person-add-outline" size={13} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* Auto visit status row — salesman today's parties only */}
        {isSalesman && isToday && (
          <View style={s.visitActionRow}>
            {openVisit ? (
              <>
                <View style={s.activeVisitDot} />
                <Text style={s.activeVisitTxt}>In shop · {elapsedText(openVisit.checkedInAt)}</Text>
                <View style={s.autoBadge}>
                  <Ionicons name="radio-outline" size={11} color={colors.primary} />
                  <Text style={s.autoBadgeTxt}>Auto</Text>
                </View>
              </>
            ) : doneMin !== undefined ? (
              <>
                <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                <Text style={s.doneBadgeTxt}>Visited · {doneMin} min</Text>
              </>
            ) : (
              <>
                <Ionicons name="navigate-outline" size={13} color={distStr ? colors.primary : colors.textLight} />
                <Text style={[s.autoHintTxt, distStr && { color: colors.primary, fontWeight: "600" }]}>
                  {hasLocation
                    ? distStr ? `${distStr} away` : "Auto check-in within 10 m"
                    : "No location set"}
                </Text>
                {distStr && hasLocation && (
                  <View style={s.distBadge}>
                    <Text style={s.distBadgeTxt}>Auto</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Distance row for non-today parties with a location */}
        {isSalesman && !isToday && hasLocation && distStr && (
          <View style={s.distRow}>
            <Ionicons name="navigate-circle-outline" size={13} color={colors.textMuted} />
            <Text style={s.distRowTxt}>{distStr} away</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Parties</Text>
        <TouchableOpacity
          onPress={() => setMapView((v) => !v)}
          hitSlop={8}
          style={[s.viewToggle, mapView && s.viewToggleActive]}
        >
          <Ionicons
            name={mapView ? "list-outline" : "map-outline"}
            size={20}
            color={mapView ? colors.primary : colors.textMuted}
          />
          <Text style={[s.viewToggleTxt, mapView && s.viewToggleTxtActive]}>
            {mapView ? "List" : "Map"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/party/import" as never)}
          hitSlop={8}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Search bar (list view only) */}
      {!mapView && (
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textLight} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or phone"
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter chips (list view only) */}
      {!mapView && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipsBar}
          contentContainerStyle={s.chipsContent}
        >
          {FILTERS.map((f, i) => (
            <TouchableOpacity
              key={f}
              style={[s.chip, i === activeFilter && s.chipActive]}
              onPress={() => setActiveFilter(i)}
            >
              <Text style={[s.chipTxt, i === activeFilter && s.chipTxtActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Summary row (list view only) */}
      {!mapView && parties.length > 0 && (
        <View style={s.summaryRow}>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>You'll Get</Text>
            <Text style={[s.summaryAmt, { color: colors.green }]}>
              Rs {fmt(totalReceivable)}
            </Text>
          </View>
          <View style={s.summaryDiv} />
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>You'll Give</Text>
            <Text style={[s.summaryAmt, { color: colors.red }]}>
              Rs {fmt(totalPayable)}
            </Text>
          </View>
        </View>
      )}

      {/* === MAP VIEW === */}
      {mapView ? (
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : mappedParties.length === 0 ? (
            /* No parties have location yet — show guidance */
            <View style={s.center}>
              <Ionicons name="map-outline" size={52} color={colors.border} />
              <Text style={s.emptyTitle}>No locations set yet</Text>
              <Text style={s.emptySub}>
                Switch to List view and tap the pin icon on any party to set its shop location
              </Text>
              <TouchableOpacity
                style={s.switchListBtn}
                onPress={() => setMapView(false)}
              >
                <Ionicons name="list-outline" size={16} color={colors.primary} />
                <Text style={s.switchListTxt}>Switch to List View</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                showsUserLocation
                onMapReady={() => {
                  mapReadyRef.current = true;
                  setTimeout(() => fitMapToParties(), 300);
                }}
              >
                {mappedParties.map((p) => {
                  const markerColor =
                    p.partyType === "customer" ? "#1d4ed8"
                    : p.partyType === "supplier" ? "#b45309"
                    : colors.primary;
                  return (
                    <Marker
                      key={p.id}
                      coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
                      tracksViewChanges={false}
                    >
                      {/* Custom shop pin */}
                      <View style={{ alignItems: "center", width: 120 }}>
                        <View style={[s.shopPinBubble, { backgroundColor: markerColor }]}>
                          <Ionicons name="storefront" size={18} color="#fff" />
                        </View>
                        <View style={[s.shopPinTail, { borderTopColor: markerColor }]} />
                        <View style={s.shopLabel}>
                          <Text style={s.shopLabelTxt} numberOfLines={1}>{p.name}</Text>
                        </View>
                      </View>

                      <Callout
                        onPress={() =>
                          openLocationPicker(p.id, p.name, p.latitude, p.longitude)
                        }
                      >
                        <View style={s.callout}>
                          <Text style={s.calloutName}>{p.name}</Text>
                          {p.phone ? (
                            <Text style={s.calloutSub}>{p.phone}</Text>
                          ) : null}
                          <Text style={s.calloutAction}>Tap to update location</Text>
                        </View>
                      </Callout>
                    </Marker>
                  );
                })}
              </MapView>

              {/* Map legend */}
              <View style={[s.mapLegend, { bottom: insets.bottom + 90 }]}>
                <View style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: "#1d4ed8" }]} />
                  <Text style={s.legendTxt}>Customer</Text>
                </View>
                <View style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: "#b45309" }]} />
                  <Text style={s.legendTxt}>Supplier</Text>
                </View>
                <View style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={s.legendTxt}>Both</Text>
                </View>
              </View>

              {/* Unlocated count badge */}
              {filtered.length - mappedParties.length > 0 && (
                <View style={s.unmappedBadge}>
                  <Ionicons name="warning-outline" size={13} color={colors.amber} />
                  <Text style={s.unmappedTxt}>
                    {filtered.length - mappedParties.length} parties without location
                  </Text>
                </View>
              )}
            </>
          )}

          {/* FAB for map view */}
          <View style={[s.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
            <TouchableOpacity
              style={s.fab}
              onPress={() => router.push("/party/new" as never)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.fabTxt}>Add Party</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* === LIST VIEW === */
        <>
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : isSalesman && todayParties.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="calendar-outline" size={52} color={colors.border} />
              <Text style={s.emptyTitle}>No shops assigned today</Text>
              <Text style={s.emptySub}>Your admin hasn't scheduled any shop visits for today</Text>
            </View>
          ) : !isSalesman && filtered.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="people-outline" size={52} color={colors.border} />
              <Text style={s.emptyTitle}>
                {search ? "No parties found" : "No parties yet"}
              </Text>
              <Text style={s.emptySub}>
                {search ? "Try a different search" : "Add your first customer or supplier"}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.list}>
              {/* Salesman: today's shops only */}
              {isSalesman ? (
                <>
                  <View style={s.sectionHeader}>
                    <Ionicons name="today-outline" size={14} color={colors.primary} />
                    <Text style={s.sectionHeaderTxt}>Today's Shops</Text>
                    <View style={s.sectionBadge}>
                      <Text style={s.sectionBadgeTxt}>{todayParties.length}</Text>
                    </View>
                  </View>
                  {todayParties.map((p) => renderPartyCard(p, true))}
                </>
              ) : (
                otherParties.map((p) => renderPartyCard(p, false))
              )}
            </ScrollView>
          )}

          {/* FAB */}
          <View style={[s.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
            <TouchableOpacity
              style={s.fab}
              onPress={() => router.push("/party/new" as never)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.fabTxt}>Add Party</Text>
            </TouchableOpacity>
          </View>
        </>
      )}


      {/* Assign Modal */}
      <AssignModal
        visible={assignModal.visible}
        partyId={assignModal.partyId}
        partyName={assignModal.partyName}
        onClose={() => setAssignModal((s) => ({ ...s, visible: false }))}
        onSaved={() => {
          setAssignModal((s) => ({ ...s, visible: false }));
          void reload();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  viewToggleActive: {
    borderColor: colors.primary,
    backgroundColor: "#e6f3f7",
  },
  viewToggleTxt: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  viewToggleTxtActive: { color: colors.primary },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  chipsBar: {
    flexGrow: 0,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 16 },
  summaryDiv: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  summaryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 2 },
  summaryAmt: { fontSize: 15, fontWeight: "700" },

  list: { padding: 16, gap: 10, paddingBottom: 100 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 2,
    marginTop: 4,
  },
  sectionHeaderTxt: { fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    overflow: "hidden",
  },
  cardToday: {
    borderColor: colors.primary,
    borderLeftWidth: 3,
  },
  todayBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  todayBadge: {
    backgroundColor: "#e6f3f7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayBadgeTxt: { fontSize: 9, fontWeight: "700", color: colors.primary },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 18, fontWeight: "700" },
  cardMid: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  partyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  partySub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  typeBadge: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadgeTxt: { fontSize: 9, fontWeight: "800" },
  cardRight: { alignItems: "flex-end", gap: 4 },
  balanceAmt: { fontSize: 13, fontWeight: "700" },
  balanceLabel: { fontSize: 10, fontWeight: "500" },
  balanceNil: { fontSize: 12, color: colors.textLight },
  pinBtn: {
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pinBtnActive: { borderColor: colors.primary, backgroundColor: "#e6f3f7" },
  assignBtn: {
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Card inner row layout
  cardInner: { flexDirection: "row", alignItems: "center", gap: 12 },

  // Shop check-in action row
  visitActionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  activeVisitDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green },
  activeVisitTxt: { flex: 1, fontSize: 11, fontWeight: "600", color: colors.green },
  doneBadgeTxt: { fontSize: 11, fontWeight: "600", color: colors.green },
  autoBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#e6f3f7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  autoBadgeTxt: { fontSize: 10, fontWeight: "700", color: colors.primary },
  autoHintTxt: { fontSize: 11, color: colors.textLight },
  distBadge: { marginLeft: "auto", backgroundColor: "#e6f3f7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  distBadgeTxt: { fontSize: 10, fontWeight: "700", color: colors.primary },
  distRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.borderLight },
  distRowTxt: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },

  // Custom shop map marker
  shopPinBubble: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
    elevation: 6,
  },
  shopPinTail: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
  shopLabel: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
    marginTop: 4,
    elevation: 2,
    alignSelf: "center",
  },
  shopLabelTxt: { fontSize: 11, fontWeight: "700", color: colors.text },

  // Map view
  callout: { minWidth: 160, maxWidth: 220, padding: 4 },
  calloutName: { fontSize: 14, fontWeight: "700", color: colors.text },
  calloutSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  calloutAction: { fontSize: 11, color: colors.primary, marginTop: 6, fontWeight: "600" },

  mapLegend: {
    position: "absolute",
    right: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },

  unmappedBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  unmappedTxt: { fontSize: 12, color: colors.amber, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  switchListBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary,
  },
  switchListTxt: { fontSize: 13.5, fontWeight: "600", color: colors.primary },

  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingHorizontal: 24,
    paddingVertical: 13,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 7,
  },
  fabTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

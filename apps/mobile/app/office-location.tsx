import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, FlatList, KeyboardAvoidingView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";

type SearchResult = { display_name: string; lat: string; lon: string };

export default function OfficeLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const hasFlown = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState("");
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState("");

  useEffect(() => {
    api.getOfficeLocation()
      .then((loc) => {
        if (loc.lat != null && loc.lng != null) {
          const coord = { latitude: loc.lat, longitude: loc.lng };
          setMarker(coord);
          hasFlown.current = true;
          setLabel(loc.label ?? "");
          setAddressLabel(loc.label ?? "");
          reverseGeocode(loc.lat, loc.lng);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=pk`;
      const res = await fetch(url, { headers: { "User-Agent": "VyaparPakistan/1.0" } });
      const json = await res.json();
      setResults(Array.isArray(json) ? json : []);
      if (!Array.isArray(json) || json.length === 0) Alert.alert("No results", "Try a different search.");
    } catch {
      Alert.alert("Search failed", "Check internet connection.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(item: SearchResult) {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const coord = { latitude: lat, longitude: lng };
    setMarker(coord);
    setResults([]);
    const short = item.display_name.split(",").slice(0, 3).join(",").trim();
    setQuery(short);
    if (!label) setLabel(short);
    setAddressLabel(item.display_name);
    mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
  }

  async function useMyLocation() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Enable location permission to use your current location.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      const coord = { latitude, longitude };
      setMarker(coord);
      setResults([]);
      reverseGeocode(latitude, longitude);
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
    } catch {
      Alert.alert("Error", "Could not get your location. Make sure GPS is on.");
    } finally {
      setGpsLoading(false);
    }
  }

  function onMapPress(e: any) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    setResults([]);
    reverseGeocode(latitude, longitude);
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, { headers: { "User-Agent": "VyaparPakistan/1.0" } });
      const json = await res.json();
      if (json.display_name) {
        setAddressLabel(json.display_name);
        if (!label) setLabel(json.display_name.split(",").slice(0, 2).join(",").trim());
      }
    } catch {}
  }

  async function save() {
    if (!marker) {
      Alert.alert("No location", "Search or tap on the map to set the office location.");
      return;
    }
    setSaving(true);
    try {
      await api.setOfficeLocation(marker.latitude, marker.longitude, label.trim() || undefined);
      Alert.alert("Saved", "Office location has been saved. Salesmen must be within 120 m to check in.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Save failed", "Could not save office location.");
    } finally {
      setSaving(false);
    }
  }

  async function clearOffice() {
    Alert.alert("Remove Office Location", "Salesmen will be able to check in from anywhere if you remove this.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            // Save with null by calling patch directly — set lat/lng to 0 won't work
            // We'll use the api directly
            await (api as any).http?.patch("/location/office", { lat: null, lng: null });
          } catch {}
          setMarker(null);
          setLabel("");
          setAddressLabel("");
          setSaving(false);
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        {/* App bar */}
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appBarTitle}>Office / Branch Location</Text>
            <Text style={s.appBarSub}>Salesmen must be within 120 m to check in</Text>
          </View>
          {marker && (
            <TouchableOpacity onPress={clearOffice} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.red} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : (
          <>
            {/* Search + Use My Location */}
            <View style={s.searchWrap}>
              {/* Use Current Location button */}
              <TouchableOpacity
                style={s.gpsBtn}
                onPress={useMyLocation}
                disabled={gpsLoading}
                activeOpacity={0.8}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="locate" size={16} color="#fff" />
                )}
                <Text style={s.gpsBtnTxt}>
                  {gpsLoading ? "Getting location…" : "Use My Current Location"}
                </Text>
              </TouchableOpacity>

              <View style={s.orRow}>
                <View style={s.orLine} />
                <Text style={s.orTxt}>or search by address</Text>
                <View style={s.orLine} />
              </View>

              <View style={s.searchRow}>
                <Ionicons name="search-outline" size={16} color={colors.textLight} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search office address..."
                  placeholderTextColor={colors.textLight}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                />
                {searching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <TouchableOpacity onPress={runSearch} hitSlop={8}>
                    <Ionicons name="arrow-forward-circle" size={22} color={query.trim() ? colors.primary : colors.border} />
                  </TouchableOpacity>
                )}
              </View>
              {results.length > 0 && (
                <FlatList
                  data={results}
                  keyExtractor={(_, i) => String(i)}
                  style={s.resultsList}
                  keyboardShouldPersistTaps="handled"
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 40 }} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={s.resultItem} onPress={() => selectResult(item)}>
                      <Ionicons name="business-outline" size={15} color={colors.primary} />
                      <Text style={s.resultTxt} numberOfLines={2}>{item.display_name}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>

            {/* Map */}
            <View style={{ flex: 1 }}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={
                  marker
                    ? { latitude: marker.latitude, longitude: marker.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }
                    : undefined
                }
                onPress={onMapPress}
                showsUserLocation
                showsMyLocationButton
                onUserLocationChange={(e) => {
                  if (hasFlown.current) return;
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  hasFlown.current = true;
                  mapRef.current?.animateToRegion(
                    { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
                    500
                  );
                }}
              >
                {marker && (
                  <Marker
                    coordinate={marker}
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      setMarker({ latitude, longitude });
                      reverseGeocode(latitude, longitude);
                    }}
                    title="Office / Branch"
                    description="Check-in zone: 120 m radius"
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <View style={s.markerWrap}>
                      {/* Pin head */}
                      <View style={s.pinHead}>
                        <View style={s.pinInner}>
                          <Ionicons name="business" size={22} color="#fff" />
                        </View>
                      </View>
                      {/* Pin tail */}
                      <View style={s.pinTail} />
                      <View style={s.pinDot} />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* 120 m radius visual hint */}
              {marker && (
                <View style={s.radiusHint} pointerEvents="none">
                  <View style={s.radiusHintBubble}>
                    <Ionicons name="radio-outline" size={14} color={colors.primary} />
                    <Text style={s.radiusHintTxt}>120 m check-in zone around pin</Text>
                  </View>
                </View>
              )}

              {!marker && (
                <View style={s.hint} pointerEvents="none">
                  <View style={s.hintBubble}>
                    <Ionicons name="finger-print-outline" size={15} color={colors.textMuted} />
                    <Text style={s.hintTxt}>Search or tap map to set office location</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Bottom */}
            <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
              {marker && (
                <View style={s.labelRow}>
                  <Ionicons name="business-outline" size={14} color={colors.primary} />
                  <TextInput
                    style={s.labelInput}
                    placeholder="Office name / label (optional)"
                    placeholderTextColor={colors.textLight}
                    value={label}
                    onChangeText={setLabel}
                  />
                </View>
              )}
              {marker && addressLabel ? (
                <Text style={s.addressTxt} numberOfLines={2}>{addressLabel}</Text>
              ) : null}
              <TouchableOpacity
                style={[s.saveBtn, !marker && s.saveBtnDisabled]}
                onPress={save}
                disabled={!marker || saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={s.saveBtnTxt}>Save Office Location</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  markerWrap: { alignItems: "center" },
  pinHead: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8,
    borderWidth: 3, borderColor: "#fff",
  },
  pinInner: { alignItems: "center", justifyContent: "center" },
  pinTail: {
    width: 4, height: 16,
    backgroundColor: colors.primary,
    marginTop: -2,
  },
  pinDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: -1,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  appBarSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  searchWrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border, zIndex: 10 },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, paddingVertical: 13,
  },
  gpsBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginVertical: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orTxt: { fontSize: 12, color: colors.textLight, fontWeight: "500" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  resultsList: { maxHeight: 220, backgroundColor: "#fff" },
  resultItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  resultTxt: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  hint: { position: "absolute", top: 16, left: 0, right: 0, alignItems: "center" },
  hintBubble: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.93)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  hintTxt: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  radiusHint: { position: "absolute", top: 16, left: 0, right: 0, alignItems: "center" },
  radiusHintBubble: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.93)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  radiusHintTxt: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  bottomBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
  },
  labelRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  labelInput: { flex: 1, fontSize: 13, color: colors.text },
  addressTxt: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  saveBtnDisabled: { backgroundColor: colors.border },
  saveBtnTxt: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

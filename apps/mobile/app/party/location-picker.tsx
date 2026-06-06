import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";

type SearchResult = { display_name: string; lat: string; lon: string };

export default function LocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partyId, partyName, initLat, initLng } = useLocalSearchParams<{
    partyId: string;
    partyName: string;
    initLat?: string;
    initLng?: string;
  }>();

  const mapRef = useRef<MapView>(null);
  const hasFlown = useRef(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const initLat_ = initLat ? parseFloat(initLat) : null;
  const initLng_ = initLng ? parseFloat(initLng) : null;

  const [markerCoord, setMarkerCoord] = useState<{ latitude: number; longitude: number } | null>(
    initLat_ && initLng_ ? { latitude: initLat_, longitude: initLng_ } : null
  );
  const [addressLabel, setAddressLabel] = useState("");

  const initialRegion =
    initLat_ && initLng_
      ? { latitude: initLat_, longitude: initLng_, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : undefined;

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=pk`;
      const res = await fetch(url, {
        headers: { "User-Agent": "VyaparPakistan/1.0" },
      });
      const json = await res.json();
      setResults(Array.isArray(json) ? json : []);
      if (!Array.isArray(json) || json.length === 0) {
        Alert.alert("No results", "No locations found. Try a different search.");
      }
    } catch (e) {
      Alert.alert("Search failed", "Could not reach geocoding service. Check internet.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(item: SearchResult) {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const coord = { latitude: lat, longitude: lng };
    setMarkerCoord(coord);
    setAddressLabel(item.display_name);
    setResults([]);
    setQuery(item.display_name.split(",").slice(0, 2).join(",").trim());
    // Use initialRegion+animateToRegion — the ONLY correct way to move the map
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      500
    );
  }

  function onMapPress(e: any) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    setResults([]);
    reverseGeocode(latitude, longitude);
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, { headers: { "User-Agent": "VyaparPakistan/1.0" } });
      const json = await res.json();
      if (json.display_name) setAddressLabel(json.display_name);
    } catch {
      setAddressLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }

  async function confirmLocation() {
    if (!markerCoord) {
      Alert.alert("No location", "Search an address or tap on the map to pin a location.");
      return;
    }
    setSaving(true);
    try {
      await api.updateParty(partyId, {
        latitude: markerCoord.latitude,
        longitude: markerCoord.longitude,
      });
      router.back();
    } catch {
      Alert.alert("Save failed", "Could not save location. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function clearLocation() {
    Alert.alert("Remove Location", `Remove pinned location for ${partyName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await api.updateParty(partyId, { latitude: undefined, longitude: undefined });
            router.back();
          } catch {
            Alert.alert("Error", "Could not remove location.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.screen, { paddingTop: insets.top }]}>
        {/* App bar */}
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appBarTitle}>Set Shop Location</Text>
            <Text style={s.appBarSub} numberOfLines={1}>{partyName}</Text>
          </View>
          {markerCoord && (
            <TouchableOpacity onPress={clearLocation} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.red} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        <View style={s.searchWrap}>
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textLight} />
            <TextInput
              style={s.searchInput}
              placeholder="Search street, area, city..."
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
                <Ionicons
                  name="arrow-forward-circle"
                  size={22}
                  color={query.trim() ? colors.primary : colors.border}
                />
              </TouchableOpacity>
            )}
          </View>

          {results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              style={s.resultsList}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={s.resultSep} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.resultItem} onPress={() => selectResult(item)}>
                  <Ionicons name="location-outline" size={15} color={colors.primary} />
                  <Text style={s.resultTxt} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Map — uses initialRegion (uncontrolled), moves only via animateToRegion */}
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={initialRegion}
            onPress={onMapPress}
            showsUserLocation
            showsMyLocationButton
            onUserLocationChange={(e) => {
              if (hasFlown.current || initLat_) return;
              const { latitude, longitude } = e.nativeEvent.coordinate;
              hasFlown.current = true;
              mapRef.current?.animateToRegion(
                { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
                500
              );
            }}
          >
            {markerCoord && (
              <Marker
                coordinate={markerCoord}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setMarkerCoord({ latitude, longitude });
                  reverseGeocode(latitude, longitude);
                }}
                pinColor={colors.primary}
                title={partyName}
                description="Drag to fine-tune"
              />
            )}
          </MapView>

          {!markerCoord && (
            <View style={s.hint} pointerEvents="none">
              <View style={s.hintBubble}>
                <Ionicons name="finger-print-outline" size={15} color={colors.textMuted} />
                <Text style={s.hintTxt}>Search above or tap map to pin</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom bar */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          {markerCoord && addressLabel ? (
            <View style={s.addressRow}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={s.addressTxt} numberOfLines={2}>
                {addressLabel}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[s.confirmBtn, !markerCoord && s.confirmBtnDisabled]}
            onPress={confirmLocation}
            disabled={!markerCoord || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.confirmBtnTxt}>Confirm Location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appBarTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  appBarSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  searchWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  resultsList: { maxHeight: 240, backgroundColor: "#fff" },
  resultSep: { height: 1, backgroundColor: colors.border, marginLeft: 40 },
  resultItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultTxt: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },

  hint: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.93)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  hintTxt: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },

  bottomBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  addressTxt: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmBtnDisabled: { backgroundColor: colors.border },
  confirmBtnTxt: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

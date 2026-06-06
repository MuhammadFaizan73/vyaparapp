import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, ScrollView, Modal, TextInput,
} from "react-native";
import * as Location from "expo-location";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";

const RADIUS_M = 120;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDuration(checkedInAt: string, checkedOutAt?: string | null) {
  const from = new Date(checkedInAt).getTime();
  const to = checkedOutAt ? new Date(checkedOutAt).getTime() : Date.now();
  const min = Math.round((to - from) / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

type Visit = {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationMin: number | null;
  notes: string | null;
};

type LocStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "ok"; lat: number; lng: number };

export default function MyVisitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [officeLat, setOfficeLat] = useState<number | null>(null);
  const [officeLng, setOfficeLng] = useState<number | null>(null);
  const [officeLabel, setOfficeLabel] = useState<string | null>(null);
  const [officeLoading, setOfficeLoading] = useState(true);

  const [locStatus, setLocStatus] = useState<LocStatus>({ kind: "idle" });
  const [distance, setDistance] = useState<number | null>(null);

  const [openVisit, setOpenVisit] = useState<Visit | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  const [notesModal, setNotesModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [tooFarModal, setTooFarModal] = useState(false);

  // ---- Data loading ----
  const loadData = useCallback(async () => {
    setVisitsLoading(true);
    try {
      const [loc, myVisits] = await Promise.all([
        api.getOfficeLocation(),
        api.getMyVisits(),
      ]);

      if (loc.lat != null && loc.lng != null) {
        setOfficeLat(loc.lat);
        setOfficeLng(loc.lng);
        setOfficeLabel(loc.label);
      } else {
        setOfficeLat(null);
        setOfficeLng(null);
      }

      const open = (myVisits as Visit[]).find((v) => !v.checkedOutAt) ?? null;
      setOpenVisit(open);
      setVisits(
        (myVisits as Visit[]).sort(
          (a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()
        )
      );
    } catch {
      /* ignore */
    } finally {
      setOfficeLoading(false);
      setVisitsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  // ---- Location ----
  async function fetchLocation() {
    setLocStatus({ kind: "loading" });
    setDistance(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocStatus({ kind: "denied" }); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      setLocStatus({ kind: "ok", lat: latitude, lng: longitude });
    } catch {
      setLocStatus({ kind: "error" });
    }
  }

  useEffect(() => { void fetchLocation(); }, []);

  // Recalculate distance whenever location or office changes
  useEffect(() => {
    if (locStatus.kind === "ok" && officeLat != null && officeLng != null) {
      setDistance(haversineMeters(locStatus.lat, locStatus.lng, officeLat, officeLng));
    } else {
      setDistance(null);
    }
  }, [locStatus, officeLat, officeLng]);

  const withinRadius = distance != null && distance <= RADIUS_M;
  const officeSet = officeLat != null && officeLng != null;

  // ---- Check-in ----
  async function doCheckIn() {
    if (locStatus.kind !== "ok") {
      Alert.alert("Location unavailable", "Enable GPS and try again.");
      return;
    }
    // Client-side gate
    if (officeSet && !withinRadius) {
      setTooFarModal(true);
      return;
    }
    setBusy(true);
    try {
      const visit = await api.checkIn({
        latitude: locStatus.lat,
        longitude: locStatus.lng,
        notes: notes.trim() || undefined,
      });
      setOpenVisit(visit);
      setNotes("");
      setNotesModal(false);
      await loadData();
      Alert.alert("Checked In ✓", `Welcome! You checked in at ${fmtTime(visit.checkedInAt)}.`);
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? "Check-in failed. Try again.";
      if (msg.includes("away from")) {
        setNotesModal(false);
        setTooFarModal(true);
      } else {
        Alert.alert("Error", Array.isArray(msg) ? msg.join("\n") : msg);
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- Check-out ----
  async function doCheckOut() {
    if (!openVisit) return;
    setBusy(true);
    try {
      await api.checkOut(openVisit.id, notes.trim() || undefined);
      setNotes("");
      setNotesModal(false);
      await loadData();
      Alert.alert("Checked Out ✓", "Your attendance has been recorded. Have a good day!");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Check-out failed. Try again.";
      Alert.alert("Error", Array.isArray(msg) ? msg.join("\n") : msg);
    } finally {
      setBusy(false);
    }
  }

  // ---- Distance text ----
  const distText = distance == null
    ? "Calculating distance…"
    : distance < 1000
    ? `${Math.round(distance)} m from office`
    : `${(distance / 1000).toFixed(1)} km from office`;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>My Attendance</Text>
        <TouchableOpacity
          onPress={() => { void fetchLocation(); void loadData(); }}
          hitSlop={8}
        >
          <Ionicons name="refresh-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── Office card ── */}
        {officeLoading ? (
          <View style={s.card}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !officeSet ? (
          <View style={s.warnCard}>
            <Ionicons name="warning-outline" size={22} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={s.warnTitle}>Office location not configured</Text>
              <Text style={s.warnSub}>Ask your admin to set the office location. You can still check in.</Text>
            </View>
          </View>
        ) : (
          <View style={s.officeCard}>
            <View style={s.officeRow}>
              <View style={s.officeIcon}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.officeTitle}>{officeLabel ?? "Company Office"}</Text>
                <Text style={s.officeSub}>Check-in zone: {RADIUS_M} m radius</Text>
              </View>
            </View>

            {/* Distance indicator */}
            {locStatus.kind === "loading" ? (
              <View style={[s.distRow, { backgroundColor: "#f8fafc" }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.distTxt}>Getting your location…</Text>
              </View>
            ) : locStatus.kind === "denied" || locStatus.kind === "error" ? (
              <View style={[s.distRow, { backgroundColor: "#fef2f2" }]}>
                <Ionicons name="alert-circle" size={16} color={colors.red} />
                <Text style={[s.distTxt, { color: colors.red, flex: 1 }]}>
                  {locStatus.kind === "denied" ? "Location permission denied" : "Could not get your location"}
                </Text>
                <TouchableOpacity onPress={fetchLocation} hitSlop={8}>
                  <Text style={s.retryTxt}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.distRow, { backgroundColor: withinRadius ? "#f0fdf4" : "#fffbeb" }]}>
                <Ionicons
                  name={withinRadius ? "checkmark-circle" : "location-outline"}
                  size={16}
                  color={withinRadius ? colors.green : colors.amber}
                />
                <Text style={[s.distTxt, { color: withinRadius ? colors.green : colors.amber, flex: 1 }]}>
                  {distText}
                </Text>
                {withinRadius && <Text style={{ fontSize: 11, color: colors.green, fontWeight: "600" }}>✓ In range</Text>}
              </View>
            )}
          </View>
        )}

        {/* ── Check-in / Check-out button ── */}
        {openVisit ? (
          <View style={s.activeCard}>
            <View style={s.activeHeader}>
              <View style={s.activeDot} />
              <Text style={s.activeTitle}>Currently Checked In</Text>
            </View>
            <Text style={s.activeTime}>
              Since {fmtTime(openVisit.checkedInAt)} · {fmtDuration(openVisit.checkedInAt)}
            </Text>
            <TouchableOpacity
              style={[s.checkOutBtn, busy && { opacity: 0.7 }]}
              onPress={() => { setNotes(""); setNotesModal(true); }}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#fff" />
                  <Text style={s.actionBtnTxt}>Check Out</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              s.checkInBtn,
              (locStatus.kind === "loading" || busy) && s.checkInBtnDisabled,
            ]}
            onPress={() => { setNotes(""); setNotesModal(true); }}
            disabled={locStatus.kind === "loading" || busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={22} color="#fff" />
                <Text style={s.actionBtnTxt}>Check In</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Visit history ── */}
        <Text style={s.sectionTitle}>Attendance History</Text>

        {visitsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : visits.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.border} />
            <Text style={s.emptyTxt}>No attendance records yet</Text>
          </View>
        ) : (
          visits.map((v) => (
            <View key={v.id} style={s.histCard}>
              <View style={[s.histBar, { backgroundColor: v.checkedOutAt ? colors.green : colors.primary }]} />
              <View style={{ flex: 1, paddingLeft: 14 }}>
                <View style={s.histTop}>
                  <Text style={s.histDate}>{fmtDate(v.checkedInAt)}</Text>
                  <View style={[s.histBadge, { backgroundColor: v.checkedOutAt ? "#dcfce7" : "#dbeafe" }]}>
                    <Text style={[s.histBadgeTxt, { color: v.checkedOutAt ? colors.green : colors.primary }]}>
                      {v.checkedOutAt ? "Complete" : "Active"}
                    </Text>
                  </View>
                </View>
                <Text style={s.histTime}>
                  {fmtTime(v.checkedInAt)}
                  {v.checkedOutAt ? ` → ${fmtTime(v.checkedOutAt)}` : " → now"}
                  {"   "}
                  <Text style={{ fontWeight: "700" }}>{fmtDuration(v.checkedInAt, v.checkedOutAt)}</Text>
                </Text>
                {v.notes ? <Text style={s.histNotes}>{v.notes}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Notes / Confirm modal ── */}
      <Modal
        visible={notesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNotesModal(false)}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setNotesModal(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{openVisit ? "Check Out" : "Check In"}</Text>
          <Text style={s.sheetSub}>
            {openVisit
              ? `Duration so far: ${fmtDuration(openVisit.checkedInAt)}`
              : officeSet
              ? `Office: ${officeLabel ?? "Company Office"}`
              : "No office location configured"}
          </Text>
          <TextInput
            style={s.notesInput}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textLight}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={200}
          />
          <TouchableOpacity
            style={[s.sheetBtn, { backgroundColor: openVisit ? colors.red : colors.primary }, busy && { opacity: 0.7 }]}
            onPress={openVisit ? doCheckOut : doCheckIn}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.sheetBtnTxt}>{openVisit ? "Confirm Check Out" : "Confirm Check In"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Too-far modal ── */}
      <Modal
        visible={tooFarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setTooFarModal(false)}
      >
        <View style={s.tooFarOverlay}>
          <View style={s.tooFarCard}>
            <View style={s.tooFarIcon}>
              <Ionicons name="location-outline" size={40} color={colors.red} />
            </View>
            <Text style={s.tooFarTitle}>You're Not at the Office</Text>
            <Text style={s.tooFarBody}>
              You are{" "}
              <Text style={{ fontWeight: "800", color: colors.red }}>
                {distance != null ? `${Math.round(distance)} m` : "too far"}
              </Text>{" "}
              away. You must be within{" "}
              <Text style={{ fontWeight: "800" }}>{RADIUS_M} m</Text>{" "}
              of the office to check in.
            </Text>
            <Text style={s.tooFarSub}>Please come to the office and try again.</Text>
            <TouchableOpacity
              style={s.tooFarRefreshBtn}
              onPress={() => { setTooFarModal(false); void fetchLocation(); }}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={s.tooFarRefreshTxt}>Refresh My Location</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTooFarModal(false)} style={{ paddingTop: 4 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  scroll: { padding: 16, gap: 14, paddingBottom: 60 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },

  warnCard: {
    backgroundColor: "#fffbeb", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#fef3c7",
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  warnTitle: { fontSize: 14, fontWeight: "700", color: colors.amber },
  warnSub: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },

  officeCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  officeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  officeIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#e6f3f7",
    alignItems: "center", justifyContent: "center",
  },
  officeTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  officeSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  distRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  distTxt: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  retryTxt: { fontSize: 12, color: colors.primary, fontWeight: "700" },

  checkInBtn: {
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 16, elevation: 7,
  },
  checkInBtnDisabled: { backgroundColor: "#94a3b8", shadowOpacity: 0 },

  activeCard: {
    backgroundColor: "#f0fdf4", borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: "#bbf7d0", gap: 10,
  },
  activeHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  activeTitle: { fontSize: 15, fontWeight: "700", color: colors.green },
  activeTime: { fontSize: 13, color: colors.textMuted },
  checkOutBtn: {
    backgroundColor: colors.red, borderRadius: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  actionBtnTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },

  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.7, marginTop: 4,
  },

  empty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },

  histCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "stretch",
  },
  histBar: { width: 3, borderRadius: 2 },
  histTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  histDate: { fontSize: 13, fontWeight: "700", color: colors.text },
  histBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  histBadgeTxt: { fontSize: 11, fontWeight: "700" },
  histTime: { fontSize: 12, color: colors.textMuted },
  histNotes: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontStyle: "italic" },

  // Modals
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginBottom: 4,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  sheetSub: { fontSize: 13, color: colors.textMuted },
  notesInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: colors.text,
    minHeight: 80, textAlignVertical: "top",
  },
  sheetBtn: {
    borderRadius: 12, paddingVertical: 16, alignItems: "center",
  },
  sheetBtnTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  tooFarOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  tooFarCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28,
    alignItems: "center", gap: 10, width: "100%", maxWidth: 340,
  },
  tooFarIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#fef2f2",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  tooFarTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  tooFarBody: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
  tooFarSub: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  tooFarRefreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  tooFarRefreshTxt: { fontSize: 14, fontWeight: "700", color: colors.primary },
});

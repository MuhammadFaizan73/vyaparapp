import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "./auth";

export const GEO_FENCE_TASK = "vyapar-shop-geofence";
const RADIUS_M = 10;
const PARTY_STORE_KEY = "vyapar_geo_parties";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://192.168.1.5:3001/api";

export type GeoParty = { id: string; name: string };

export async function storeGeoParties(parties: GeoParty[]) {
  await AsyncStorage.setItem(PARTY_STORE_KEY, JSON.stringify(parties));
}

TaskManager.defineTask(GEO_FENCE_TASK, async ({ data, error }: any) => {
  if (error) { console.log("[GeoFence] Task error:", error); return; }
  const { eventType, region } = data as {
    eventType: Location.LocationGeofencingEventType;
    region: Location.LocationRegion;
  };
  console.log("[GeoFence] Event:", eventType === Location.LocationGeofencingEventType.Enter ? "ENTER" : "EXIT", "region:", region.identifier);

  const token = await getToken();
  if (!token) return;

  const raw = await AsyncStorage.getItem(PARTY_STORE_KEY).catch(() => null);
  const parties: GeoParty[] = raw ? JSON.parse(raw) : [];
  const party = parties.find((p) => p.id === region.identifier);
  if (!party) return;

  if (eventType === Location.LocationGeofencingEventType.Enter) {
    // Enforce office check-in before auto shop check-in
    const officeRes = await fetch(`${API_BASE}/location/office-checkin-today`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (officeRes?.ok) {
      const { checkedIn } = await officeRes.json().catch(() => ({ checkedIn: false }));
      if (!checkedIn) {
        console.log("[GeoFence] No office check-in today — skipping auto shop check-in for", party.name);
        return;
      }
    }

    // Auto check-in when entering shop zone
    await fetch(`${API_BASE}/location/shop-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        partyId: party.id,
        partyName: party.name,
        latitude: region.latitude,
        longitude: region.longitude,
      }),
    }).catch(() => {});
  } else if (eventType === Location.LocationGeofencingEventType.Exit) {
    // Auto check-out when leaving shop zone
    const res = await fetch(`${API_BASE}/location/my-route`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res?.ok) return;
    const visits: any[] = await res.json().catch(() => []);
    const open = visits.find((v) => v.partyId === party.id && !v.checkedOutAt);
    if (open) {
      await fetch(`${API_BASE}/location/check-out/${open.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }
});

export async function registerShopGeoFences(
  parties: { id: string; name: string; latitude: number; longitude: number }[]
) {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    console.log("[GeoFence] Background location permission status:", status);
    if (status !== "granted") return false;

    // Store party names so background task can look them up
    await storeGeoParties(parties.map((p) => ({ id: p.id, name: p.name })));

    // Stop existing fences before re-registering
    const running = await Location.hasStartedGeofencingAsync(GEO_FENCE_TASK).catch(() => false);
    if (running) await Location.stopGeofencingAsync(GEO_FENCE_TASK).catch(() => {});

    if (parties.length === 0) return true;

    await Location.startGeofencingAsync(
      GEO_FENCE_TASK,
      parties.map((p) => ({
        identifier: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        radius: RADIUS_M,
        notifyOnEnter: true,
        notifyOnExit: true,
      }))
    );
    return true;
  } catch {
    return false;
  }
}

export async function stopShopGeoFences() {
  const running = await Location.hasStartedGeofencingAsync(GEO_FENCE_TASK).catch(() => false);
  if (running) await Location.stopGeofencingAsync(GEO_FENCE_TASK).catch(() => {});
}

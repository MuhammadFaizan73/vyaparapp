import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { getToken } from "./auth";

export const LOCATION_TASK = "vyapar-location-ping";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://192.168.1.5:3001/api";

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations: Location.LocationObject[] = data?.locations ?? [];
  if (!locations.length) return;

  const token = await getToken();
  if (!token) return;

  const loc = locations[locations.length - 1];
  try {
    await fetch(`${API_BASE}/location/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
      }),
    });
  } catch {
    // silently discard — will retry on next ping
  }
});

export async function startLocationTracking() {
  const token = await getToken();
  if (token) {
    const res = await fetch(`${API_BASE}/location/office-checkin-today`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const { checkedIn } = await res.json().catch(() => ({ checkedIn: false }));
      if (!checkedIn) return false;
    }
  }

  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") return false;

  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000, // 5 minutes
    distanceInterval: 100,        // or every 100 m, whichever comes first
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Godigi",
      notificationBody: "Recording your field route",
    },
  });
  return true;
}

export async function stopLocationTracking() {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function isTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
}

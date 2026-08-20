import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { Platform, AppState } from "react-native";
import { router } from "expo-router";
import { api, loadToken, clearToken } from "./auth";
import type { DeviceSession } from "@vyapar/api-client";

// A mobile license is single-device: logging in on a new phone deletes this phone's
// session server-side (see DevicesService.register). Poll for that instead of waiting
// for the user to notice — checked on an interval and whenever the app is foregrounded,
// since there's no push channel to notify this device the moment it's kicked.
const KICK_CHECK_INTERVAL_MS = 30_000;

const DEVICE_ID_KEY = "vyapar_device_id";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

function getDeviceName(): string {
  if (Device.deviceName) return Device.deviceName;
  return Platform.OS === "ios" ? "iPhone" : "Android Device";
}

type DeviceContextValue = {
  isReadOnly: boolean;
  sessionId: string | null;
  deviceId: string | null;
  refresh: () => Promise<void>;
};

const DeviceContext = createContext<DeviceContextValue>({
  isReadOnly: false,
  sessionId: null,
  deviceId: null,
  refresh: async () => {},
});

export function useDevice() {
  return useContext(DeviceContext);
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const register = useCallback(async () => {
    const token = await loadToken();
    if (!token) return;
    try {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      deviceIdRef.current = id;
      const session = await api.registerDevice(id, getDeviceName(), "mobile");
      setSessionId(session.id);
      setIsReadOnly(!session.isActive);
    } catch {
      // Network error — keep previous state
    }
  }, []);

  // If another phone has since logged into this same license, our own DeviceSession
  // row was deleted server-side — getDevices() coming back without our deviceId is
  // the signal. Log out locally rather than leaving the app silently unusable.
  const checkKicked = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    const token = await loadToken();
    if (!token) return;
    try {
      const sessions = await api.getDevices();
      const stillThere = sessions.some((s) => s.deviceId === id);
      if (!stillThere) {
        await clearToken();
        router.replace("/onboarding" as never);
      }
    } catch {
      // Network error — don't log out over a flaky connection
    }
  }, []);

  useEffect(() => {
    register();
  }, [register]);

  useEffect(() => {
    const interval = setInterval(checkKicked, KICK_CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkKicked();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [checkKicked]);

  return (
    // @ts-ignore — React 19 JSX
    <DeviceContext.Provider value={{ isReadOnly, sessionId, deviceId, refresh: register }}>
      {children}
    </DeviceContext.Provider>
  );
}

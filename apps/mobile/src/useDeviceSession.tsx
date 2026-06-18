import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api, loadToken } from "./auth";
import type { DeviceSession } from "@vyapar/api-client";

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

  const register = useCallback(async () => {
    const token = await loadToken();
    if (!token) return;
    try {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      const session = await api.registerDevice(id, getDeviceName(), "mobile");
      setSessionId(session.id);
      setIsReadOnly(!session.isActive);
    } catch {
      // Network error — keep previous state
    }
  }, []);

  useEffect(() => {
    register();
  }, [register]);

  return (
    // @ts-ignore — React 19 JSX
    <DeviceContext.Provider value={{ isReadOnly, sessionId, deviceId, refresh: register }}>
      {children}
    </DeviceContext.Provider>
  );
}

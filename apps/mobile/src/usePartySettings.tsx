import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

const SETTINGS_KEY = "vyapar_party_settings";

export type PartySettings = {
  tinNumber: boolean;
  shippingAddress: boolean;
  printShippingAddress: boolean;
  partyGrouping: boolean;
  additionalField1: boolean;
  additionalField2: boolean;
  additionalField3: boolean;
  dateField: boolean;
  inviteParties: boolean;
};

export const DEFAULT_PARTY_SETTINGS: PartySettings = {
  tinNumber: true,
  shippingAddress: true,
  printShippingAddress: false,
  partyGrouping: true,
  additionalField1: false,
  additionalField2: false,
  additionalField3: false,
  dateField: false,
  inviteParties: true,
};

type Ctx = {
  settings: PartySettings;
  toggle: (key: keyof PartySettings) => void;
  save: () => Promise<void>;
};

export const PartySettingsContext = createContext<Ctx>({
  settings: DEFAULT_PARTY_SETTINGS,
  toggle: () => {},
  save: async () => {},
});

export function PartySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PartySettings>(DEFAULT_PARTY_SETTINGS);

  useEffect(() => {
    SecureStore.getItemAsync(SETTINGS_KEY).then((raw) => {
      if (raw) {
        try { setSettings({ ...DEFAULT_PARTY_SETTINGS, ...JSON.parse(raw) }); } catch {}
      }
    });
  }, []);

  function toggle(key: keyof PartySettings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
  }

  return (
    <PartySettingsContext.Provider value={{ settings, toggle, save }}>
      {children}
    </PartySettingsContext.Provider>
  );
}

export function usePartySettings() {
  return useContext(PartySettingsContext);
}

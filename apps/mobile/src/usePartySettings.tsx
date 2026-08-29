import type { ReactNode } from "react";
import { useSettings, type MobileSettings } from "./useSettings";

// Compatibility shim: this used to be its own Context + expo-secure-store, now it's a
// thin projection over the single unified store in useSettings.ts. Kept so existing
// consumers (party/new.tsx, party/settings.tsx) don't need to change their imports.
export type PartySettings = Pick<
  MobileSettings,
  "tinNumber" | "shippingAddress" | "printShippingAddress" | "partyGrouping"
  | "additionalField1" | "additionalField2" | "additionalField3" | "dateField"
  | "inviteParties" | "showOpeningBalance"
>;

export function PartySettingsProvider({ children }: { children: ReactNode }) {
  return children as JSX.Element;
}

export function usePartySettings() {
  const { settings, toggle, update } = useSettings();
  return {
    settings: settings as PartySettings,
    toggle: (key: keyof PartySettings) => toggle(key),
    save: async () => { /* useSettings() persists on every toggle already */ },
    update,
  };
}

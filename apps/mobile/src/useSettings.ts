import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const OLD_TXN_KEY = "vyapar_txn_settings";
const OLD_PARTY_KEY = "vyapar_party_settings";
const KEY = "vyapar_mobile_settings";

export type MobileSettings = {
  // General
  enablePasscode: boolean;
  currency: string;
  amountDecimals: number;
  // Transaction
  invoiceBillNumber: boolean;
  cashSaleByDefault: boolean;
  billingNameOfParties: boolean;
  poDetails: boolean;
  addTimeOnTransactions: boolean;
  allowInclusiveExclusiveTax: boolean;
  displayPurchasePrice: boolean;
  showLast5SalePrice: boolean;
  freeItemQuantity: boolean;
  count: boolean;
  barcodeScanningForItems: boolean;
  transactionWiseTax: boolean;
  transactionWiseDiscount: boolean;
  roundOffTransactionAmount: boolean;
  roundOffNearest: string;
  roundOffTo: string;
  shareTransactionAs: string;
  passcodeForEditDelete: boolean;
  discountDuringPayment: boolean;
  linkPaymentsToInvoices: boolean;
  enableInvoicePreview: boolean;
  termsAndConditions: boolean;
  showProfitWhileMakingSale: boolean;
  prefixSaleInvoices: string;
  prefixCreditNote: string;
  prefixSaleOrder: string;
  prefixPurchaseOrder: string;
  prefixEstimate: string;
  prefixProformaInvoice: string;
  prefixDeliveryNote: string;
  prefixPaymentIn: string;
  // Print
  printThemeName: string;
  printColor: string;
  thermalThemeName: string;
  companyName: string;
  companyPhone: string;
  companyLogo: boolean;
  printOriginalDuplicate: boolean;
  paperSize: string;
  // Party
  tinNumber: boolean;
  shippingAddress: boolean;
  printShippingAddress: boolean;
  partyGrouping: boolean;
  additionalField1: boolean;
  additionalField2: boolean;
  additionalField3: boolean;
  dateField: boolean;
  inviteParties: boolean;
  showOpeningBalance: boolean;
};

export const DEFAULT_SETTINGS: MobileSettings = {
  enablePasscode: false,
  currency: "Rs",
  amountDecimals: 2,
  invoiceBillNumber: true,
  cashSaleByDefault: false,
  billingNameOfParties: false,
  poDetails: false,
  addTimeOnTransactions: false,
  allowInclusiveExclusiveTax: true,
  displayPurchasePrice: true,
  showLast5SalePrice: false,
  freeItemQuantity: false,
  count: false,
  barcodeScanningForItems: false,
  transactionWiseTax: true,
  transactionWiseDiscount: true,
  roundOffTransactionAmount: true,
  roundOffNearest: "Nearest",
  roundOffTo: "1",
  shareTransactionAs: "Ask me Everytime",
  passcodeForEditDelete: false,
  discountDuringPayment: false,
  linkPaymentsToInvoices: true,
  enableInvoicePreview: true,
  termsAndConditions: true,
  showProfitWhileMakingSale: false,
  prefixSaleInvoices: "None",
  prefixCreditNote: "None",
  prefixSaleOrder: "None",
  prefixPurchaseOrder: "None",
  prefixEstimate: "None",
  prefixProformaInvoice: "None",
  prefixDeliveryNote: "None",
  prefixPaymentIn: "None",
  printThemeName: "Tally Theme",
  printColor: "#3b82f6",
  thermalThemeName: "Thermal Theme 1",
  companyName: "Godigi",
  companyPhone: "",
  companyLogo: true,
  printOriginalDuplicate: false,
  paperSize: "A4",
  tinNumber: true,
  shippingAddress: true,
  printShippingAddress: false,
  partyGrouping: true,
  additionalField1: false,
  additionalField2: false,
  additionalField3: false,
  dateField: false,
  inviteParties: true,
  showOpeningBalance: true,
};

// Singleton in-memory cache + subscriber list so every screen using useSettings() shares
// one AsyncStorage-backed source of truth instead of drifting copies — a toggle saved on
// one screen must be visible immediately on another without navigating away and back.
let cached: MobileSettings | null = null;
let loadingPromise: Promise<MobileSettings> | null = null;
const subscribers = new Set<(s: MobileSettings) => void>();

async function loadOnce(): Promise<MobileSettings> {
  if (cached) return cached;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let merged = { ...DEFAULT_SETTINGS };

    // One-time absorb of the two old, separately-stored settings screens' data, so
    // existing users don't lose prefs they already saved before this unified store existed.
    try {
      const [rawNew, rawOldTxn, rawOldParty] = await Promise.all([
        AsyncStorage.getItem(KEY),
        AsyncStorage.getItem(OLD_TXN_KEY),
        SecureStore.getItemAsync(OLD_PARTY_KEY).catch(() => null),
      ]);
      if (rawOldTxn) merged = { ...merged, ...JSON.parse(rawOldTxn) };
      if (rawOldParty) merged = { ...merged, ...JSON.parse(rawOldParty) };
      if (rawNew) merged = { ...merged, ...JSON.parse(rawNew) };
    } catch { /* fall back to defaults */ }

    cached = merged;
    return merged;
  })();

  return loadingPromise;
}

async function persist(next: MobileSettings) {
  cached = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  subscribers.forEach((fn) => fn(next));
}

export function useSettings() {
  const [settings, setSettings] = useState<MobileSettings>(cached ?? DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(cached !== null);

  useEffect(() => {
    let alive = true;
    loadOnce().then((s) => { if (alive) { setSettings(s); setLoaded(true); } });
    const sub = (s: MobileSettings) => { if (alive) setSettings(s); };
    subscribers.add(sub);
    return () => { alive = false; subscribers.delete(sub); };
  }, []);

  const update = useCallback(async (patch: Partial<MobileSettings>) => {
    const base = cached ?? (await loadOnce());
    const next = { ...base, ...patch };
    await persist(next);
  }, []);

  const toggle = useCallback((key: keyof MobileSettings) => {
    const base = cached ?? settings;
    void update({ [key]: !base[key] } as Partial<MobileSettings>);
  }, [settings, update]);

  return { settings, update, toggle, loaded };
}

// Convenience projection for buildInvoiceHtml() call sites — avoids repeating the same
// field pluck at every print/share/export button.
export function useInvoiceHtmlOptions() {
  const { settings } = useSettings();
  return {
    themeName: settings.printThemeName,
    color: settings.printColor,
    companyName: settings.companyName,
    companyPhone: settings.companyPhone,
  };
}

import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TransactionSettings = {
  /* Transaction Header */
  invoiceBillNumber: boolean;
  cashSaleByDefault: boolean;
  billingNameOfParties: boolean;
  poDetails: boolean;
  addTimeOnTransactions: boolean;
  /* Items Table */
  allowInclusiveExclusiveTax: boolean;
  displayPurchasePrice: boolean;
  showLast5SalePrice: boolean;
  freeItemQuantity: boolean;
  count: boolean;
  barcodeScanningForItems: boolean;
  /* Taxes, Discount & Total */
  transactionWiseTax: boolean;
  transactionWiseDiscount: boolean;
  roundOffTransactionAmount: boolean;
  roundOffNearest: string;
  roundOffTo: string;
  /* More Transaction Features */
  shareTransactionAs: string;
  passcodeForEditDelete: boolean;
  discountDuringPayment: boolean;
  linkPaymentsToInvoices: boolean;
  enableInvoicePreview: boolean;
  termsAndConditions: boolean;
  showProfitWhileMakingSale: boolean;
  /* Prefixes */
  prefixSaleInvoices: string;
  prefixCreditNote: string;
  prefixSaleOrder: string;
  prefixPurchaseOrder: string;
  prefixEstimate: string;
  prefixProformaInvoice: string;
  prefixDeliveryNote: string;
  prefixPaymentIn: string;
};

const DEFAULTS: TransactionSettings = {
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
};

const KEY = "vyapar_txn_settings";

export function useTransactionSettings() {
  const [settings, setSettings] = useState<TransactionSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try { setSettings({ ...DEFAULTS, ...JSON.parse(raw) }); } catch { /* use defaults */ }
      }
      setLoaded(true);
    });
  }, []);

  async function update(patch: Partial<TransactionSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  return { settings, update, loaded };
}

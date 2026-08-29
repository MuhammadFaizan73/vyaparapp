import { useSettings, type MobileSettings } from "./useSettings";

// Compatibility shim: this used to be its own AsyncStorage-backed hook, now it's a thin
// projection over the single unified store in useSettings.ts. Kept so existing consumers
// (sale/new.tsx, delivery-note/new.tsx, transaction-settings.tsx) don't need to change.
export type TransactionSettings = Pick<
  MobileSettings,
  "invoiceBillNumber" | "cashSaleByDefault" | "billingNameOfParties" | "poDetails"
  | "addTimeOnTransactions" | "allowInclusiveExclusiveTax" | "displayPurchasePrice"
  | "showLast5SalePrice" | "freeItemQuantity" | "count" | "barcodeScanningForItems"
  | "transactionWiseTax" | "transactionWiseDiscount" | "roundOffTransactionAmount"
  | "roundOffNearest" | "roundOffTo" | "shareTransactionAs" | "passcodeForEditDelete"
  | "discountDuringPayment" | "linkPaymentsToInvoices" | "enableInvoicePreview"
  | "termsAndConditions" | "showProfitWhileMakingSale" | "prefixSaleInvoices"
  | "prefixCreditNote" | "prefixSaleOrder" | "prefixPurchaseOrder" | "prefixEstimate"
  | "prefixProformaInvoice" | "prefixDeliveryNote" | "prefixPaymentIn"
>;

export function useTransactionSettings() {
  const { settings, update, loaded } = useSettings();
  return {
    settings: settings as TransactionSettings,
    update: (patch: Partial<TransactionSettings>) => update(patch),
    loaded,
  };
}

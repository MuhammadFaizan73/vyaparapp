import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { useTransactionSettings } from "../src/useTransactionSettings";

const PREFIX_OPTIONS = ["None", "INV", "BILL", "TXN", "EST", "PRO", "ORD", "DEL", "PAY"];

export default function TransactionSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update, loaded } = useTransactionSettings();

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  function Row({
    label, info, value, onToggle, premium, chevron, dot,
  }: {
    label: string; info?: boolean; value?: boolean;
    onToggle?: (v: boolean) => void;
    premium?: boolean; chevron?: boolean; dot?: boolean;
  }) {
    return (
      <TouchableOpacity
        style={s.row}
        activeOpacity={chevron ? 0.7 : 1}
        onPress={chevron ? () => {} : undefined}
      >
        <View style={s.rowLeft}>
          <Text style={s.rowLabel}>{label}</Text>
          {info && (
            <View style={s.infoIcon}>
              <Text style={s.infoTxt}>i</Text>
            </View>
          )}
          {premium && (
            <View style={s.premiumBadge}>
              <Text style={s.premiumTxt}>👑</Text>
            </View>
          )}
          {dot && <View style={s.redDot} />}
        </View>
        {chevron ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        ) : (
          <Switch
            value={value ?? false}
            onValueChange={onToggle}
            trackColor={{ false: "#d1d5db", true: colors.primary + "80" }}
            thumbColor={value ? colors.primary : "#9ca3af"}
            disabled={premium}
          />
        )}
      </TouchableOpacity>
    );
  }

  function SectionHeader({ title }: { title: string }) {
    return (
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderTxt}>{title}</Text>
      </View>
    );
  }

  function PrefixRow({ label, value, field }: { label: string; value: string; field: keyof typeof settings }) {
    return (
      <View style={s.prefixField}>
        <Text style={s.prefixLabel}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.prefixScroll}>
          {PREFIX_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[s.prefixChip, value === opt && s.prefixChipActive]}
              onPress={() => update({ [field]: opt } as any)}
            >
              <Text style={[s.prefixChipTxt, value === opt && s.prefixChipTxtActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Transaction</Text>
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="search-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* Transaction Header */}
        <SectionHeader title="Transaction Header" />
        <View style={s.group}>
          <Row label="Invoice/Bill Number" info value={settings.invoiceBillNumber}
            onToggle={(v) => update({ invoiceBillNumber: v })} />
          <View style={s.divider} />
          <Row label="Cash Sale by default" info value={settings.cashSaleByDefault}
            onToggle={(v) => update({ cashSaleByDefault: v })} />
          <View style={s.divider} />
          <Row label="Billing name of Parties" info value={settings.billingNameOfParties}
            onToggle={(v) => update({ billingNameOfParties: v })} />
          <View style={s.divider} />
          <Row label="PO Details (of customer)" info value={settings.poDetails}
            onToggle={(v) => update({ poDetails: v })} />
          <View style={s.divider} />
          <Row label="Add Time On Transactions" info value={settings.addTimeOnTransactions}
            onToggle={(v) => update({ addTimeOnTransactions: v })} />
        </View>

        {/* Items Table */}
        <SectionHeader title="Items Table" />
        <View style={s.group}>
          <Row label="Allow Inclusive/Exclusive tax on Rate (Price/unit)" info
            value={settings.allowInclusiveExclusiveTax}
            onToggle={(v) => update({ allowInclusiveExclusiveTax: v })} />
          <View style={s.divider} />
          <Row label="Display Purchase Price" info value={settings.displayPurchasePrice}
            onToggle={(v) => update({ displayPurchasePrice: v })} />
          <View style={s.divider} />
          <Row label="Show Last 5 Sale Price of Items" info value={settings.showLast5SalePrice}
            onToggle={(v) => update({ showLast5SalePrice: v })} />
          <View style={s.divider} />
          <Row label="Free Item quantity" info value={settings.freeItemQuantity}
            onToggle={(v) => update({ freeItemQuantity: v })} />
          <View style={s.divider} />
          <Row label="Count" info value={settings.count}
            onToggle={(v) => update({ count: v })} />
          <View style={s.divider} />
          <Row label="Barcode scanning for items" info value={settings.barcodeScanningForItems}
            onToggle={(v) => update({ barcodeScanningForItems: v })} />
        </View>

        {/* Taxes, Discount & Total */}
        <SectionHeader title="Taxes, Discount & Total" />
        <View style={s.group}>
          <Row label="Transaction wise Tax" info value={settings.transactionWiseTax}
            onToggle={(v) => update({ transactionWiseTax: v })} />
        </View>

        {/* Other settings */}
        <View style={s.group}>
          <Row label="Link Payments to Invoices" info value={settings.linkPaymentsToInvoices}
            onToggle={(v) => update({ linkPaymentsToInvoices: v })} />
          <View style={s.divider} />
          <Row label="Due Dates and Payment terms" info chevron />
          <View style={s.divider} />
          <Row label="Enable Invoice Preview" info value={settings.enableInvoicePreview}
            onToggle={(v) => update({ enableInvoicePreview: v })} />
          <View style={s.divider} />
          <Row label="Additional Fields" info chevron />
          <View style={s.divider} />
          <Row label="Transportation Details" info chevron />
          <View style={s.divider} />
          <Row label="Additional Charges" info chevron dot />
          <View style={s.divider} />
          <Row label="Show Profit while making Sale Invoice" info premium
            value={settings.showProfitWhileMakingSale}
            onToggle={(v) => update({ showProfitWhileMakingSale: v })} />
        </View>

        {/* Transaction Prefixes */}
        <SectionHeader title="Transaction Prefixes" />
        <View style={s.prefixCard}>
          <Text style={s.prefixFirmLabel}>Firm</Text>
          <View style={s.prefixFirmBox}>
            <Text style={s.prefixFirmTxt}>Rootocloud</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textLight} />
          </View>

          <View style={s.prefixGrid}>
            <PrefixRow label="Sale Invoices" value={settings.prefixSaleInvoices} field="prefixSaleInvoices" />
            <PrefixRow label="Credit Note" value={settings.prefixCreditNote} field="prefixCreditNote" />
            <PrefixRow label="Sale Order" value={settings.prefixSaleOrder} field="prefixSaleOrder" />
            <PrefixRow label="Purchase Order" value={settings.prefixPurchaseOrder} field="prefixPurchaseOrder" />
            <PrefixRow label="Estimate" value={settings.prefixEstimate} field="prefixEstimate" />
            <PrefixRow label="Proforma Invoice" value={settings.prefixProformaInvoice} field="prefixProformaInvoice" />
            <PrefixRow label="Delivery Note" value={settings.prefixDeliveryNote} field="prefixDeliveryNote" />
            <PrefixRow label="Payment-In" value={settings.prefixPaymentIn} field="prefixPaymentIn" />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f2f5" },
  appBar: {
    backgroundColor: "#0f5a72", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#fff" },

  sectionHeader: {
    backgroundColor: "#dce8f5", paddingHorizontal: 16, paddingVertical: 10,
    marginTop: 2,
  },
  sectionHeaderTxt: { fontSize: 13.5, fontWeight: "700", color: colors.primary },

  group: { backgroundColor: "#fff", marginBottom: 2 },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 16, gap: 10,
  },
  rowLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowLabel: { fontSize: 14, color: colors.text, flexShrink: 1 },
  infoIcon: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center",
  },
  infoTxt: { fontSize: 10, fontWeight: "700", color: "#6b7280" },
  premiumBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  premiumTxt: { fontSize: 11 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 16 },

  prefixCard: { backgroundColor: "#fff", padding: 16, gap: 14 },
  prefixFirmLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
  prefixFirmBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  prefixFirmTxt: { fontSize: 14, fontWeight: "500", color: colors.text },
  prefixGrid: { gap: 14 },
  prefixField: { gap: 6 },
  prefixLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  prefixScroll: { flexGrow: 0 },
  prefixChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 8,
    borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff",
  },
  prefixChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  prefixChipTxt: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  prefixChipTxtActive: { color: "#fff", fontWeight: "600" },
});

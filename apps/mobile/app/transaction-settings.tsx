import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, ActivityIndicator, Modal, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { useTransactionSettings } from "../src/useTransactionSettings";

const PREFIX_OPTIONS = ["None", "INV", "BILL", "TXN", "EST", "PRO", "ORD", "DEL", "PAY"];
const SHARE_OPTIONS = ["Ask me Everytime", "WhatsApp", "SMS", "Email", "PDF", "Don't Share"];
const NEAREST_OPTIONS = ["Nearest", "Round Up", "Round Down"];
const ROUND_TO_OPTIONS = ["0.01", "0.1", "1", "5", "10", "50", "100"];

export default function TransactionSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update, loaded } = useTransactionSettings();

  const [dropdown, setDropdown] = useState<{
    field: string; options: string[]; value: string; title: string;
  } | null>(null);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  function openDropdown(field: string, options: string[], value: string, title: string) {
    setDropdown({ field, options, value, title });
  }

  function selectDropdown(val: string) {
    if (!dropdown) return;
    update({ [dropdown.field]: val } as any);
    setDropdown(null);
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
          {info && <View style={s.infoIcon}><Text style={s.infoTxt}>i</Text></View>}
          {dot && <View style={s.redDot} />}
          {premium && <View style={s.premiumBadge}><Text style={s.premiumTxt}>👑</Text></View>}
        </View>
        {chevron ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        ) : (
          <Switch
            value={value ?? false}
            onValueChange={onToggle}
            trackColor={{ false: "#d1d5db", true: colors.primary + "99" }}
            thumbColor={value ? colors.primary : "#9ca3af"}
            disabled={premium}
          />
        )}
      </TouchableOpacity>
    );
  }

  function DropdownRow({
    label, info, field, value, options, title,
  }: {
    label: string; info?: boolean; field: string;
    value: string; options: string[]; title: string;
  }) {
    return (
      <TouchableOpacity style={s.row} onPress={() => openDropdown(field, options, value, title)}>
        <View style={s.rowLeft}>
          <Text style={s.rowLabel}>{label}</Text>
          {info && <View style={s.infoIcon}><Text style={s.infoTxt}>i</Text></View>}
        </View>
        <View style={s.dropdownBox}>
          <Text style={s.dropdownVal}>{value}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textLight} />
        </View>
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

  function PrefixDropdown({ label, field, value }: { label: string; field: string; value: string }) {
    return (
      <View style={s.prefixRow}>
        <View style={s.prefixLabelWrap}>
          <Text style={s.prefixLabel}>{label}</Text>
        </View>
        <TouchableOpacity
          style={s.prefixDropdown}
          onPress={() => openDropdown(field, PREFIX_OPTIONS, value, label)}
        >
          <Text style={s.prefixDropdownTxt}>{value}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textLight} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Transaction</Text>
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="search-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Transaction Header ── */}
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

        {/* ── Items Table ── */}
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

        {/* ── Taxes, Discount & Total ── */}
        <SectionHeader title="Taxes, Discount & Total" />
        <View style={s.group}>
          <Row label="Transaction wise Tax" info value={settings.transactionWiseTax}
            onToggle={(v) => update({ transactionWiseTax: v })} />
          <View style={s.divider} />
          <Row label="Transaction wise Discount" info value={settings.transactionWiseDiscount}
            onToggle={(v) => update({ transactionWiseDiscount: v })} />
          <View style={s.divider} />
          <Row label="Round Off Transaction amount" info value={settings.roundOffTransactionAmount}
            onToggle={(v) => update({ roundOffTransactionAmount: v })} />
          {settings.roundOffTransactionAmount && (
            <View style={s.roundOffRow}>
              <TouchableOpacity
                style={s.roundOffDropdown}
                onPress={() => openDropdown("roundOffNearest", NEAREST_OPTIONS, settings.roundOffNearest, "Round Off")}
              >
                <Text style={s.roundOffTxt}>{settings.roundOffNearest}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textLight} />
              </TouchableOpacity>
              <Text style={s.roundOffTo}>To</Text>
              <TouchableOpacity
                style={s.roundOffDropdown}
                onPress={() => openDropdown("roundOffTo", ROUND_TO_OPTIONS, settings.roundOffTo, "Round To")}
              >
                <Text style={s.roundOffTxt}>{settings.roundOffTo}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── More Transaction Features ── */}
        <SectionHeader title="More Transaction Features" />
        <View style={s.group}>
          <DropdownRow label="Share Transaction as" info field="shareTransactionAs"
            value={settings.shareTransactionAs} options={SHARE_OPTIONS} title="Share Transaction as" />
          <View style={s.divider} />
          <Row label="Passcode for edit/delete" info value={settings.passcodeForEditDelete}
            onToggle={(v) => update({ passcodeForEditDelete: v })} />
          <View style={s.divider} />
          <Row label="Discount during Payment" info value={settings.discountDuringPayment}
            onToggle={(v) => update({ discountDuringPayment: v })} />
          <View style={s.divider} />
          <Row label="Link Payments to Invoices" info value={settings.linkPaymentsToInvoices}
            onToggle={(v) => update({ linkPaymentsToInvoices: v })} />
          <View style={s.divider} />
          <Row label="Due Dates and Payment terms" info chevron />
          <View style={s.divider} />
          <Row label="Enable Invoice Preview" info value={settings.enableInvoicePreview}
            onToggle={(v) => update({ enableInvoicePreview: v })} />
          <View style={s.divider} />
          <Row label="Terms & Conditions" info value={settings.termsAndConditions}
            onToggle={(v) => update({ termsAndConditions: v })} />
          <View style={s.divider} />
          <Row label="Set Terms & Conditions" info chevron />
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

        {/* ── Transaction Prefixes ── */}
        <SectionHeader title="Transaction Prefixes" />
        <View style={s.prefixCard}>
          <View style={s.prefixFirmWrap}>
            <Text style={s.prefixFirmFloatLabel}>Firm</Text>
            <View style={s.prefixFirmBox}>
              <Text style={s.prefixFirmTxt}>My Company</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textLight} />
            </View>
          </View>

          <View style={s.prefixGrid}>
            <View style={s.prefixGridRow}>
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Sale invoices" field="prefixSaleInvoices" value={settings.prefixSaleInvoices} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Credit Note" field="prefixCreditNote" value={settings.prefixCreditNote} />
              </View>
            </View>
            <View style={s.prefixGridRow}>
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Sale Order" field="prefixSaleOrder" value={settings.prefixSaleOrder} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Purchase Order" field="prefixPurchaseOrder" value={settings.prefixPurchaseOrder} />
              </View>
            </View>
            <View style={s.prefixGridRow}>
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Estimate" field="prefixEstimate" value={settings.prefixEstimate} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Proforma Invoice" field="prefixProformaInvoice" value={settings.prefixProformaInvoice} />
              </View>
            </View>
            <View style={s.prefixGridRow}>
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Delivery Note" field="prefixDeliveryNote" value={settings.prefixDeliveryNote} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <PrefixDropdown label="Payment-In" field="prefixPaymentIn" value={settings.prefixPaymentIn} />
              </View>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* ── Dropdown Modal ── */}
      <Modal visible={!!dropdown} transparent animationType="fade" onRequestClose={() => setDropdown(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setDropdown(null)}>
          <Pressable style={s.modalBox}>
            <Text style={s.modalTitle}>{dropdown?.title}</Text>
            <View style={s.modalDivider} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {dropdown?.options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={s.modalOption}
                  onPress={() => selectDropdown(opt)}
                >
                  <Text style={[s.modalOptionTxt, opt === dropdown?.value && s.modalOptionActive]}>
                    {opt}
                  </Text>
                  {opt === dropdown?.value && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f2f5" },
  appBar: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#fff" },

  sectionHeader: {
    backgroundColor: "#dce8f5", paddingHorizontal: 16, paddingVertical: 10, marginTop: 2,
  },
  sectionHeaderTxt: { fontSize: 13.5, fontWeight: "700", color: colors.primary },

  group: { backgroundColor: "#fff", marginBottom: 2 },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 15, gap: 10,
  },
  rowLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  rowLabel: { fontSize: 14, color: "#1a1a2e", flexShrink: 1 },
  infoIcon: {
    width: 17, height: 17, borderRadius: 9, backgroundColor: "#e5e7eb",
    alignItems: "center", justifyContent: "center",
  },
  infoTxt: { fontSize: 9, fontWeight: "700", color: "#6b7280" },
  premiumBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#ede9fe",
    alignItems: "center", justifyContent: "center",
  },
  premiumTxt: { fontSize: 11 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 16 },

  dropdownBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#f9fafb",
  },
  dropdownVal: { fontSize: 13, color: colors.text },

  roundOffRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  roundOffDropdown: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f9fafb",
  },
  roundOffTxt: { fontSize: 13, color: colors.text },
  roundOffTo: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },

  prefixCard: { backgroundColor: "#fff", padding: 16, gap: 16 },
  prefixFirmWrap: { gap: 4 },
  prefixFirmFloatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 2 },
  prefixFirmBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  prefixFirmTxt: { fontSize: 14, fontWeight: "500", color: colors.text },

  prefixGrid: { gap: 12 },
  prefixGridRow: { flexDirection: "row" },
  prefixRow: { gap: 4 },
  prefixLabelWrap: {},
  prefixLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 4 },
  prefixDropdown: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff",
  },
  prefixDropdownTxt: { fontSize: 13, color: colors.text },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", padding: 32,
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 14, width: "100%",
    maxHeight: 380, overflow: "hidden",
  },
  modalTitle: {
    fontSize: 15, fontWeight: "700", color: colors.text,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
  },
  modalDivider: { height: 1, backgroundColor: "#f0f0f0" },
  modalOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  modalOptionTxt: { fontSize: 14, color: colors.text },
  modalOptionActive: { color: colors.primary, fontWeight: "600" },
});

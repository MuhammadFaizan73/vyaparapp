import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Distributor, Branch } from "@vyapar/api-client";
import { colors } from "../theme";
import { useSelectedCompany } from "../useSelectedCompany";
import { useDevice } from "../useDeviceSession";

// Shared by the tab bar (every tab screen) and any stack screen that creates/edits a
// record tied to a specific Company — e.g. Add Sale — since the tab-bar banner doesn't
// render on stack routes pushed outside the Tabs layout, leaving no way to see or change
// which company a new invoice will be tagged with from that screen.

type CompanyView =
  | { level: "root" }
  | { level: "distributor"; distributor: Distributor }
  | { level: "branch"; distributor: Distributor; branch: Branch };

// skipTopInset: pass true when the screen that renders this bar has already applied
// insets.top to its own root padding (every "new"/"add" stack screen does) — otherwise
// the inset gets added twice, showing up as a band of blank space above the bar.
export function CompanySwitcherBar({ skipTopInset = false }: { skipTopInset?: boolean } = {}) {
  const {
    distributors, branches, companies,
    selectedDistributorId, selectedBranchId, selectedCompanyId,
    filterLabel, companiesError, loading,
    setSelectedDistributorId, setSelectedBranchId, setSelectedCompanyId,
    refreshCompanies,
  } = useSelectedCompany();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CompanyView>({ level: "root" });
  const insets = useSafeAreaInsets();
  // ReadOnlyBanner (rendered above this in (tabs)/_layout.tsx) already accounts for the
  // status bar when it's visible — only add our own top inset when we're the first thing
  // painted, otherwise the two would stack and push everything down twice as far.
  const { isReadOnly } = useDevice();
  const topInset = skipTopInset || isReadOnly ? 0 : insets.top;

  // Desktop's equivalent dropdown is always visible, even for a single-company tenant —
  // it's the only way to confirm/select that company. Only hide here if there's truly
  // nothing to pick (a brand-new tenant whose default Company row hasn't loaded yet).
  if (companies.length === 0 && distributors.length === 0) {
    // Reported as "there is no option to select the company at all" — that's this branch
    // silently returning null on a failed fetch. Surface the real reason and a manual
    // retry instead, since we haven't yet reproduced why the fetch itself is failing.
    if (companiesError) {
      return (
        <TouchableOpacity
          style={[s.errorBanner, { paddingTop: topInset + 8 }]}
          onPress={() => void refreshCompanies()}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Ionicons name="alert-circle-outline" size={14} color="#b91c1c" />
          <Text style={s.errorBannerText} numberOfLines={2}>
            Couldn't load companies ({companiesError}) — tap to retry
          </Text>
          <Ionicons name="refresh" size={14} color="#b91c1c" />
        </TouchableOpacity>
      );
    }
    // Fetch actually succeeded but came back with zero companies — the backend now
    // always backfills a default company, so this shouldn't happen anymore, but show
    // a retry affordance instead of nothing rather than assume that guarantee holds.
    if (!loading) {
      return (
        <TouchableOpacity style={[s.errorBanner, { paddingTop: topInset + 8 }]} onPress={() => void refreshCompanies()} activeOpacity={0.85}>
          <Ionicons name="alert-circle-outline" size={14} color="#b91c1c" />
          <Text style={s.errorBannerText} numberOfLines={2}>No companies found — tap to retry</Text>
          <Ionicons name="refresh" size={14} color="#b91c1c" />
        </TouchableOpacity>
      );
    }
    return null;
  }

  function pick(fn: () => void) {
    fn();
    setOpen(false);
    setView({ level: "root" });
  }

  const unassigned = companies.filter((c) => !c.branchId);
  const branchesOf = (distributorId: string) => branches.filter((b) => b.distributorId === distributorId);
  const companiesOf = (branchId: string) => companies.filter((c) => c.branchId === branchId);

  return (
    <>
      <TouchableOpacity style={[s.banner, { paddingTop: topInset + 8 }]} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Ionicons name="business-outline" size={14} color={colors.primary} />
        <Text style={s.bannerText} numberOfLines={1}>{filterLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.primary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => { setOpen(false); setView({ level: "root" }); }}
      >
        <TouchableOpacity
          style={s.sheetBackdrop}
          onPress={() => { setOpen(false); setView({ level: "root" }); }}
          activeOpacity={1}
        >
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Switch Company</Text>
            <ScrollView style={{ maxHeight: "100%" }}>
              <TouchableOpacity
                style={s.sheetRow}
                onPress={() => pick(() => setSelectedDistributorId(null))}
              >
                <Text style={s.sheetRowText}>All Companies</Text>
                {!selectedDistributorId && !selectedBranchId && !selectedCompanyId && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>

              {view.level === "root" && (
                <>
                  {distributors.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={s.sheetRow}
                      onPress={() => setView({ level: "distributor", distributor: d })}
                    >
                      <Text style={s.sheetRowText}>{d.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ))}
                  {unassigned.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={s.sheetRow}
                      onPress={() => pick(() => setSelectedCompanyId(c.id))}
                    >
                      <Text style={s.sheetRowText}>{c.name}</Text>
                      {selectedCompanyId === c.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {view.level === "distributor" && (
                <>
                  <TouchableOpacity style={s.sheetBack} onPress={() => setView({ level: "root" })}>
                    <Ionicons name="chevron-back" size={16} color="#64748b" />
                    <Text style={s.sheetBackText}>All Distributors</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.sheetRow}
                    onPress={() => pick(() => setSelectedDistributorId(view.distributor.id))}
                  >
                    <Text style={s.sheetRowText}>All of {view.distributor.name}</Text>
                    {selectedDistributorId === view.distributor.id && !selectedBranchId && !selectedCompanyId && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  {branchesOf(view.distributor.id).map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={s.sheetRow}
                      onPress={() => setView({ level: "branch", distributor: view.distributor, branch: b })}
                    >
                      <Text style={s.sheetRowText}>{b.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {view.level === "branch" && (
                <>
                  <TouchableOpacity
                    style={s.sheetBack}
                    onPress={() => setView({ level: "distributor", distributor: view.distributor })}
                  >
                    <Ionicons name="chevron-back" size={16} color="#64748b" />
                    <Text style={s.sheetBackText}>{view.distributor.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.sheetRow}
                    onPress={() => pick(() => setSelectedBranchId(view.branch.id))}
                  >
                    <Text style={s.sheetRowText}>All of {view.branch.name}</Text>
                    {selectedBranchId === view.branch.id && !selectedCompanyId && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  {companiesOf(view.branch.id).map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={s.sheetRow}
                      onPress={() => pick(() => setSelectedCompanyId(c.id))}
                    >
                      <Text style={s.sheetRowText}>{c.name}</Text>
                      {selectedCompanyId === c.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  errorBannerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e7ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  bannerText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "700",
    maxWidth: 220,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: "60%",
  },
  sheetHandle: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: "#dde0e7",
    alignSelf: "center", marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  sheetRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f0f2f5",
  },
  sheetRowText: { fontSize: 14, color: "#0f172a" },
  sheetBack: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 10,
  },
  sheetBackText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
});

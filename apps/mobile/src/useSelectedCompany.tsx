import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import type { Company, Distributor, Branch } from "@vyapar/api-client";
import { api, loadToken, getToken } from "./auth";

const SELECTED_DISTRIBUTOR_KEY = "vyapar_selected_distributor_id";
const SELECTED_BRANCH_KEY = "vyapar_selected_branch_id";
const SELECTED_COMPANY_KEY = "vyapar_selected_company_id";

type Ctx = {
  distributors: Distributor[];
  branches: Branch[];
  companies: Company[];
  loading: boolean;
  selectedDistributorId: string | null;
  selectedBranchId: string | null;
  // The one specific Company chosen at the bottom level, if any — every "tag this new
  // item/sale/party" call site defaults to this, since a new record belongs to exactly one.
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  // What every READ/list-filter query should filter by — a single id, a comma-joined
  // list (a Distributor/Branch rollup), or null ("All Companies").
  companyFilter: string | null;
  filterLabel: string;
  // Set only when the last refreshCompanies() call actually failed, so the switcher
  // can show the real reason and a retry button instead of just silently vanishing —
  // this was reported as "no option to select the company" with no clue why.
  companiesError: string | null;
  setSelectedDistributorId: (id: string | null) => void;
  setSelectedBranchId: (id: string | null) => void;
  setSelectedCompanyId: (id: string | null) => void;
  refreshCompanies: () => Promise<void>;
};

const SelectedCompanyContext = createContext<Ctx>({
  distributors: [],
  branches: [],
  companies: [],
  loading: true,
  selectedDistributorId: null,
  selectedBranchId: null,
  selectedCompanyId: null,
  selectedCompany: null,
  companyFilter: null,
  filterLabel: "All Companies",
  companiesError: null,
  setSelectedDistributorId: () => {},
  setSelectedBranchId: () => {},
  setSelectedCompanyId: () => {},
  refreshCompanies: async () => {},
});

export function SelectedCompanyProvider({ children }: { children: ReactNode }) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [selectedDistributorId, setSelectedDistributorIdState] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(SELECTED_DISTRIBUTOR_KEY),
      SecureStore.getItemAsync(SELECTED_BRANCH_KEY),
      SecureStore.getItemAsync(SELECTED_COMPANY_KEY),
    ]).then(([d, b, c]) => {
      if (d) setSelectedDistributorIdState(d);
      if (b) setSelectedBranchIdState(b);
      if (c) setSelectedCompanyIdState(c);
    });
  }, []);

  const refreshCompanies = useCallback(async () => {
    setLoading(true);
    try {
      // This provider mounts alongside app/index.tsx's own token bootstrap, and both
      // read the same SecureStore key independently — without this, getCompanies() can
      // fire before that other load finishes setting the auth header, fail with 401
      // (it has no .catch, so the whole Promise.all below rejects), and leave `companies`
      // stuck at [] for the rest of the app session since this effect never re-runs.
      // loadToken() is idempotent, so calling it again here is harmless.
      await loadToken();
      const [d, b, c] = await Promise.all([
        api.getDistributors().catch(() => []),
        api.getBranches().catch(() => []),
        api.getCompanies(),
      ]);
      setDistributors(d);
      setBranches(b);
      setCompanies(c);
      setCompaniesError(null);
    } catch (err: any) {
      setCompanies([]);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      setCompaniesError(
        status ? `HTTP ${status}${serverMsg ? `: ${String(serverMsg)}` : ""}` : (err?.message ?? "Unknown error"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // This provider mounts once at the app root, before the user has necessarily
    // logged in yet (e.g. fresh install, or a session that starts on the onboarding
    // screen) — firing refreshCompanies() immediately at that point fetches with no
    // token at all, and since this effect never runs again, a login completed later
    // in the same app session was never picked up: companies stayed [] until the app
    // was fully restarted. Poll for a token to actually exist before the first fetch.
    let cancelled = false;
    async function waitForTokenThenLoad() {
      const deadline = Date.now() + 15000;
      while (!cancelled) {
        let token: string | null = null;
        try {
          token = await getToken();
        } catch (err: any) {
          // A SecureStore read throwing (seen on some Android devices when the OS
          // invalidates Keystore-backed values) would otherwise die here as an
          // unhandled rejection — loading never clears, and no error ever surfaces,
          // so the switcher looks identical to a device that's still polling normally.
          setCompaniesError(`Couldn't read saved login (${err?.message ?? "unknown error"})`);
          setLoading(false);
          return;
        }
        if (token) {
          await refreshCompanies();
          return;
        }
        if (Date.now() > deadline) {
          setCompaniesError("No login token found after 15s — try logging in again");
          setLoading(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    void waitForTokenThenLoad().catch((err: any) => {
      setCompaniesError(`Unexpected error waiting for login (${err?.message ?? String(err)})`);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshCompanies]);

  // Every tenant gets at least one Company row at registration, but nothing ever
  // auto-selected it here — combined with the switcher being hidden below 2 companies
  // (see CompanyBanner), a single-company tenant had no way to ever set
  // selectedCompanyId on mobile, so every Sale/Party/Item save requiring a company
  // failed. Auto-pick the sole company the same way a user would if they could.
  useEffect(() => {
    if (loading) return;
    if (companies.length === 1 && !selectedCompanyId && !selectedBranchId && !selectedDistributorId) {
      setSelectedCompanyId(companies[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, loading]);

  // If a previously-selected Distributor/Branch/Company was deleted, fall back to
  // "All" at that level instead of silently filtering everything down to zero rows.
  useEffect(() => {
    if (loading) return;
    if (selectedDistributorId && !distributors.some((d) => d.id === selectedDistributorId)) {
      setSelectedDistributorId(null);
    }
  }, [distributors, loading, selectedDistributorId]);

  useEffect(() => {
    if (loading) return;
    if (selectedBranchId && !branches.some((b) => b.id === selectedBranchId)) {
      setSelectedBranchId(null);
    }
  }, [branches, loading, selectedBranchId]);

  useEffect(() => {
    if (loading) return;
    if (selectedCompanyId && !companies.some((c) => c.id === selectedCompanyId)) {
      setSelectedCompanyIdState(null);
      void SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
    }
  }, [companies, loading, selectedCompanyId]);

  function setSelectedDistributorId(id: string | null) {
    setSelectedDistributorIdState(id);
    if (id) void SecureStore.setItemAsync(SELECTED_DISTRIBUTOR_KEY, id);
    else void SecureStore.deleteItemAsync(SELECTED_DISTRIBUTOR_KEY);
    setSelectedBranchIdState(null);
    void SecureStore.deleteItemAsync(SELECTED_BRANCH_KEY);
    setSelectedCompanyIdState(null);
    void SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
  }

  function setSelectedBranchId(id: string | null) {
    setSelectedBranchIdState(id);
    if (id) void SecureStore.setItemAsync(SELECTED_BRANCH_KEY, id);
    else void SecureStore.deleteItemAsync(SELECTED_BRANCH_KEY);
    setSelectedCompanyIdState(null);
    void SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
  }

  function setSelectedCompanyId(id: string | null) {
    setSelectedCompanyIdState(id);
    if (id) void SecureStore.setItemAsync(SELECTED_COMPANY_KEY, id);
    else void SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;

  const companyFilter = useMemo(() => {
    if (selectedCompanyId) return selectedCompanyId;
    if (selectedBranchId) {
      const ids = companies.filter((c) => c.branchId === selectedBranchId).map((c) => c.id);
      return ids.length ? ids.join(",") : null;
    }
    if (selectedDistributorId) {
      const branchIds = new Set(branches.filter((b) => b.distributorId === selectedDistributorId).map((b) => b.id));
      const ids = companies.filter((c) => c.branchId && branchIds.has(c.branchId)).map((c) => c.id);
      return ids.length ? ids.join(",") : null;
    }
    return null;
  }, [selectedCompanyId, selectedBranchId, selectedDistributorId, companies, branches]);

  const filterLabel = useMemo(() => {
    if (selectedCompany) return selectedCompany.name;
    if (selectedBranchId) {
      const b = branches.find((x) => x.id === selectedBranchId);
      return b ? b.name : "All Companies";
    }
    if (selectedDistributorId) {
      const d = distributors.find((x) => x.id === selectedDistributorId);
      return d ? d.name : "All Companies";
    }
    return "All Companies";
  }, [selectedCompany, selectedBranchId, selectedDistributorId, branches, distributors]);

  return (
    <SelectedCompanyContext.Provider
      value={{
        distributors,
        branches,
        companies,
        loading,
        selectedDistributorId,
        selectedBranchId,
        selectedCompanyId,
        selectedCompany,
        companyFilter,
        filterLabel,
        companiesError,
        setSelectedDistributorId,
        setSelectedBranchId,
        setSelectedCompanyId,
        refreshCompanies,
      }}
    >
      {children}
    </SelectedCompanyContext.Provider>
  );
}

export function useSelectedCompany() {
  return useContext(SelectedCompanyContext);
}

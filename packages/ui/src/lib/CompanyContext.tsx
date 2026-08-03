import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Company, Distributor, Branch } from "@vyapar/api-client";
import { api } from "./api";

const SELECTED_DISTRIBUTOR_KEY = "vyapar.selectedDistributorId";
const SELECTED_BRANCH_KEY = "vyapar.selectedBranchId";
const SELECTED_COMPANY_KEY = "vyapar.selectedCompanyId";

type CompanyContextValue = {
  distributors: Distributor[];
  branches: Branch[];
  companies: Company[];
  loading: boolean;
  selectedDistributorId: string | null;
  selectedBranchId: string | null;
  // The one specific Company chosen at the bottom level, if any. Kept single-valued
  // on purpose — every "tag this new item/invoice/party" call site defaults to this,
  // and a new record can only ever belong to exactly one Company.
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  // What every READ/report query should filter by. Resolves to a single id (a Company
  // is directly selected), a comma-joined list of ids (a Distributor/Branch rollup —
  // every Company beneath it), or null ("All Companies").
  companyFilter: string | null;
  filterLabel: string;
  setSelectedDistributorId: (id: string | null) => void;
  setSelectedBranchId: (id: string | null) => void;
  setSelectedCompanyId: (id: string | null) => void;
  refreshCompanies: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDistributorId, setSelectedDistributorIdState] = useState<string | null>(
    () => localStorage.getItem(SELECTED_DISTRIBUTOR_KEY),
  );
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    () => localStorage.getItem(SELECTED_BRANCH_KEY),
  );
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(
    () => localStorage.getItem(SELECTED_COMPANY_KEY),
  );

  const refreshCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const [d, b, c] = await Promise.all([
        api.getDistributors().catch(() => []),
        api.getBranches().catch(() => []),
        api.getCompanies(),
      ]);
      setDistributors(d);
      setBranches(b);
      setCompanies(c);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  // If a previously-selected Distributor/Branch/Company was deleted (or belongs to a
  // different tenant after a logout/login), fall back to "All" at that level instead
  // of silently filtering everything down to zero rows.
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
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  }, [companies, loading, selectedCompanyId]);

  function setSelectedDistributorId(id: string | null) {
    setSelectedDistributorIdState(id);
    if (id) localStorage.setItem(SELECTED_DISTRIBUTOR_KEY, id);
    else localStorage.removeItem(SELECTED_DISTRIBUTOR_KEY);
    // Picking a distributor resets any more-specific selection beneath it.
    setSelectedBranchIdState(null);
    localStorage.removeItem(SELECTED_BRANCH_KEY);
    setSelectedCompanyIdState(null);
    localStorage.removeItem(SELECTED_COMPANY_KEY);
  }

  function setSelectedBranchId(id: string | null) {
    setSelectedBranchIdState(id);
    if (id) localStorage.setItem(SELECTED_BRANCH_KEY, id);
    else localStorage.removeItem(SELECTED_BRANCH_KEY);
    setSelectedCompanyIdState(null);
    localStorage.removeItem(SELECTED_COMPANY_KEY);
  }

  function setSelectedCompanyId(id: string | null) {
    setSelectedCompanyIdState(id);
    if (id) localStorage.setItem(SELECTED_COMPANY_KEY, id);
    else localStorage.removeItem(SELECTED_COMPANY_KEY);
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
    <CompanyContext.Provider
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
        setSelectedDistributorId,
        setSelectedBranchId,
        setSelectedCompanyId,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within a CompanyProvider");
  return ctx;
}

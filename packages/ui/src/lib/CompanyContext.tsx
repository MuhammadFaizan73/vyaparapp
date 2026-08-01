import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Company } from "@vyapar/api-client";
import { api } from "./api";

const SELECTED_COMPANY_KEY = "vyapar.selectedCompanyId";

type CompanyContextValue = {
  companies: Company[];
  loading: boolean;
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  setSelectedCompanyId: (id: string | null) => void;
  refreshCompanies: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(
    () => localStorage.getItem(SELECTED_COMPANY_KEY),
  );

  const refreshCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCompanies();
      setCompanies(data);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  // If the previously-selected company was deleted (or belongs to a different
  // tenant after a logout/login), fall back to "All Companies" instead of
  // silently filtering everything down to zero rows.
  useEffect(() => {
    if (loading) return;
    if (selectedCompanyId && !companies.some((c) => c.id === selectedCompanyId)) {
      setSelectedCompanyIdState(null);
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  }, [companies, loading, selectedCompanyId]);

  function setSelectedCompanyId(id: string | null) {
    setSelectedCompanyIdState(id);
    if (id) localStorage.setItem(SELECTED_COMPANY_KEY, id);
    else localStorage.removeItem(SELECTED_COMPANY_KEY);
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;

  return (
    <CompanyContext.Provider
      value={{ companies, loading, selectedCompanyId, selectedCompany, setSelectedCompanyId, refreshCompanies }}
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

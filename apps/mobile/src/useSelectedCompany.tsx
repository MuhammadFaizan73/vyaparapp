import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import type { Company } from "@vyapar/api-client";
import { api } from "./auth";

const SELECTED_COMPANY_KEY = "vyapar_selected_company_id";

type Ctx = {
  companies: Company[];
  loading: boolean;
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  setSelectedCompanyId: (id: string | null) => void;
  refreshCompanies: () => Promise<void>;
};

const SelectedCompanyContext = createContext<Ctx>({
  companies: [],
  loading: true,
  selectedCompanyId: null,
  selectedCompany: null,
  setSelectedCompanyId: () => {},
  refreshCompanies: async () => {},
});

export function SelectedCompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(SELECTED_COMPANY_KEY).then((id) => {
      if (id) setSelectedCompanyIdState(id);
    });
  }, []);

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

  // If the previously-selected company was deleted, fall back to "All Companies"
  // instead of silently filtering everything down to zero rows.
  useEffect(() => {
    if (loading) return;
    if (selectedCompanyId && !companies.some((c) => c.id === selectedCompanyId)) {
      setSelectedCompanyIdState(null);
      void SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
    }
  }, [companies, loading, selectedCompanyId]);

  function setSelectedCompanyId(id: string | null) {
    setSelectedCompanyIdState(id);
    if (id) void SecureStore.setItemAsync(SELECTED_COMPANY_KEY, id);
    else void SecureStore.deleteItemAsync(SELECTED_COMPANY_KEY);
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;

  return (
    <SelectedCompanyContext.Provider
      value={{ companies, loading, selectedCompanyId, selectedCompany, setSelectedCompanyId, refreshCompanies }}
    >
      {children}
    </SelectedCompanyContext.Provider>
  );
}

export function useSelectedCompany() {
  return useContext(SelectedCompanyContext);
}

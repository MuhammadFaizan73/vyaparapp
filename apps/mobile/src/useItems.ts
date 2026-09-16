import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { Item } from "@vyapar/api-client";
import { api } from "./auth";
import { useSelectedCompany } from "./useSelectedCompany";

// Every screen that uses this hook (Purchase, Purchase Order, Sale Order, Estimate,
// Proforma Invoice, Credit Note) creates one transaction tagged to exactly one company —
// unlike itemsStore's shared cross-screen cache, there's no other screen relying on this
// hook returning every company's items, so it's scoped directly here. Without this, a
// salesman under one company saw every other company's items in the picker too.
export function useItems() {
  const { selectedCompanyId } = useSelectedCompany();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getItems(selectedCompanyId ? { companyId: selectedCompanyId } : undefined);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return { items, loading, reload: load };
}

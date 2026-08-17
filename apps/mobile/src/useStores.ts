import { useCallback, useEffect, useState } from "react";
import type { Store } from "@vyapar/api-client";
import { api } from "./auth";

// Re-fetches whenever companyId changes — a Store always belongs to exactly one
// Company, so there's nothing meaningful to show without one.
export function useStores(companyId: string | null | undefined) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setStores([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.getStores({ companyId });
      setStores(rows);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stores, loading, refresh };
}

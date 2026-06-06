import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { ShopVisit } from "@vyapar/api-client";
import { api } from "./auth";

export function useShopRoute() {
  const [route, setRoute] = useState<ShopVisit[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMyRoute();
      setRoute(data);
    } catch {
      setRoute([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const openVisitByPartyId = new Map<string, ShopVisit>(
    route
      .filter(v => v.checkedOutAt === null && v.partyId !== null)
      .map(v => [v.partyId!, v])
  );

  const completedVisitByPartyId = new Map<string, number>(
    route
      .filter(v => v.checkedOutAt !== null && v.partyId !== null && v.durationMin !== null)
      .map(v => [v.partyId!, v.durationMin!])
  );

  return { route, loading, reload, openVisitByPartyId, completedVisitByPartyId };
}

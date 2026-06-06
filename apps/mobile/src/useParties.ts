import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { Party } from "@vyapar/api-client";
import { api, getRole } from "./auth";
import { registerShopGeoFences } from "./geoFenceTask";

export function useParties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayPartyIds, setTodayPartyIds] = useState<Set<string>>(new Set());
  const [isSalesman, setIsSalesman] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const role = await getRole();
      const salesmanRoles = ["salesman", "biller_salesman"];
      const userIsSalesman = salesmanRoles.includes(role);
      setIsSalesman(userIsSalesman);

      if (userIsSalesman) {
        // Salesman: load only their assigned parties
        const [allParties, assignments] = await Promise.all([
          api.getParties(),
          api.getMyAssignments(),
        ]);

        // Today's day abbreviation: "Mon", "Tue", etc.
        const today = new Date().toLocaleDateString("en-US", { weekday: "short" });

        const assignedPartyIds = new Set(assignments.map((a) => a.partyId));
        const todayIds = new Set(
          assignments
            .filter((a) => a.visitDays.split(",").includes(today))
            .map((a) => a.partyId),
        );

        const filtered = allParties.filter((p) => assignedPartyIds.has(p.id));
        setTodayPartyIds(todayIds);
        setParties(filtered);

        // Register geo-fences for today's parties that have a saved location
        const geoParties = filtered.filter(
          (p) => todayIds.has(p.id) && p.latitude != null && p.longitude != null
        ).map((p) => ({ id: p.id, name: p.name, latitude: p.latitude!, longitude: p.longitude! }));
        console.log("[GeoFence] Registering fences for", geoParties.length, "parties:", geoParties.map(p => p.name));
        const ok = await registerShopGeoFences(geoParties);
        console.log("[GeoFence] Registration result:", ok);
      } else {
        // Owner/admin: load all parties
        const data = await api.getParties();
        setParties(data);
        setTodayPartyIds(new Set());
      }
    } catch {
      setParties([]);
      setTodayPartyIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return { parties, loading, reload: load, todayPartyIds, isSalesman };
}

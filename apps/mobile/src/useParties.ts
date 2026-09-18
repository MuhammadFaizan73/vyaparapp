import { useState, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import type { Party } from "@vyapar/api-client";
import { api, getRole } from "./auth";
import { registerShopGeoFences } from "./geoFenceTask";
import { useSelectedCompany } from "./useSelectedCompany";

export function useParties() {
  const { companyFilter } = useSelectedCompany();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayPartyIds, setTodayPartyIds] = useState<Set<string>>(new Set());
  const [isSalesman, setIsSalesman] = useState(false);
  // Surfaced so a screen can show "couldn't refresh" instead of silently keeping a stale
  // list with no indication anything went wrong — see the catch block below.
  const [error, setError] = useState<string | null>(null);
  // load() can fire more than once in quick succession — once from useFocusEffect when
  // this screen regains focus (e.g. returning from "Add Party"), and again from an
  // explicit reload() call (e.g. tapping the customer field). Neither call is cancelled
  // if a newer one starts first, so whichever HTTP response happens to arrive LAST wins
  // — if that's the older, slower call (started before a party was created), its stale
  // response overwrites the newer call's already-correct result. Every call gets a
  // ticket; only the response matching the CURRENT latest ticket is ever applied.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const myRequestId = ++requestId.current;
    setLoading(true);
    try {
      const role = await getRole();
      const salesmanRoles = ["salesman", "biller_salesman"];
      const userIsSalesman = salesmanRoles.includes(role);

      let nextParties: Party[];
      let nextTodayIds: Set<string>;

      if (userIsSalesman) {
        // Salesman: load only their assigned parties
        const [allParties, assignments] = await Promise.all([
          api.getParties({ companyId: companyFilter ?? undefined }),
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

        nextParties = allParties.filter((p) => assignedPartyIds.has(p.id));
        nextTodayIds = todayIds;
      } else {
        // Owner/admin: load parties for the active company filter ("All Companies" = null
        // still returns everyone, same as desktop's PartiesScreen).
        nextParties = await api.getParties({ companyId: companyFilter ?? undefined });
        nextTodayIds = new Set();
      }

      // load() can fire more than once in quick succession — once from useFocusEffect
      // when this screen regains focus (e.g. returning from "Add Party"), and again from
      // an explicit reload() call (e.g. tapping the customer field). Neither request is
      // cancelled if a newer one starts first, so whichever response happens to arrive
      // LAST used to win — if that was the older, slower call (started before a party
      // was created), its stale result overwrote the newer call's already-correct one,
      // even though the newer fetch had already succeeded. Only ever commit the result
      // that belongs to the most recently started call.
      if (myRequestId !== requestId.current) return;

      setIsSalesman(userIsSalesman);
      setParties(nextParties);
      setTodayPartyIds(nextTodayIds);
      setError(null);

      if (userIsSalesman) {
        // Register geo-fences for today's parties that have a saved location
        const geoParties = nextParties.filter(
          (p) => nextTodayIds.has(p.id) && p.latitude != null && p.longitude != null
        ).map((p) => ({ id: p.id, name: p.name, latitude: p.latitude!, longitude: p.longitude! }));
        console.log("[GeoFence] Registering fences for", geoParties.length, "parties:", geoParties.map(p => p.name));
        const ok = await registerShopGeoFences(geoParties);
        console.log("[GeoFence] Registration result:", ok);
      }
    } catch (err: any) {
      if (myRequestId !== requestId.current) return;
      // A transient network hiccup on a re-fetch (e.g. re-focusing the screen, or
      // companyFilter resolving to a new value moments after the party list already
      // loaded once) used to wipe an already-good `parties` list down to empty — making
      // the picker look like every customer had vanished, when really just this one
      // re-fetch failed. Keep whatever was already loaded; only a genuinely empty first
      // load ever shows as empty. But don't stay silent about it either — on a slow
      // connection this request can time out well after the payload's grown past a
      // couple hundred parties, and a party added moments ago then looked "missing" with
      // no indication the refresh itself had failed. Surface it instead.
      setTodayPartyIds(new Set());
      setError(
        err?.code === "ECONNABORTED" || err?.message?.includes("timeout")
          ? "Couldn't refresh — connection too slow. Showing the last loaded list."
          : "Couldn't refresh customer list. Showing the last loaded list."
      );
    } finally {
      if (myRequestId === requestId.current) setLoading(false);
    }
  }, [companyFilter]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return { parties, loading, error, reload: load, todayPartyIds, isSalesman };
}

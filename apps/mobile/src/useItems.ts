import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { Item } from "@vyapar/api-client";
import { api } from "./auth";

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getItems();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return { items, loading, reload: load };
}

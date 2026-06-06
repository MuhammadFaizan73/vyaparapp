import * as FileSystem from "expo-file-system/legacy";
import { api } from "./auth";
import type { Item } from "@vyapar/api-client";

const LEGACY_FILE = FileSystem.documentDirectory + "vyapar_items.json";

export type { Item };

// In-memory cache
let items: Item[] = [];
let loaded = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

async function migrateLegacyFile(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(LEGACY_FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(LEGACY_FILE);
    const localItems: Array<Record<string, string>> = JSON.parse(raw);
    for (const it of localItems) {
      try {
        await api.createItem({
          name: it.name,
          sku: it.sku || undefined,
          unit: it.unit || undefined,
          secondaryUnit: it.secondaryUnit || undefined,
          conversionRate: it.conversionRate || undefined,
          mrp: it.mrp ? Number(it.mrp) : undefined,
          salePrice: it.salePrice ? Number(it.salePrice) : undefined,
          purchasePrice: it.purchasePrice ? Number(it.purchasePrice) : undefined,
          openingStock: it.openingStock ? Number(it.openingStock) : 0,
          minStock: it.minStock ? Number(it.minStock) : 0,
        });
      } catch { /* skip items that fail */ }
    }
    await FileSystem.deleteAsync(LEGACY_FILE, { idempotent: true });
  } catch { /* file missing or malformed — ignore */ }
}

export async function loadItems(): Promise<void> {
  try {
    await migrateLegacyFile();
    items = await api.getItems();
    loaded = true;
    notify();
  } catch {
    // Offline or unauthenticated — keep whatever is cached
  }
}

export function getItems(): Item[] {
  return [...items];
}

export function getItem(id: string): Item | undefined {
  return items.find((i) => i.id === id);
}

export async function addItem(body: {
  name: string; sku: string; unit: string; secondaryUnit: string;
  conversionRate: string; mrp: string; salePrice: string;
  purchasePrice: string; openingStock: string; minStock: string;
  companyTag?: string;
}): Promise<Item> {
  const item = await api.createItem({
    name: body.name,
    sku: body.sku || undefined,
    unit: body.unit || undefined,
    secondaryUnit: body.secondaryUnit || undefined,
    conversionRate: body.conversionRate || undefined,
    mrp: body.mrp ? Number(body.mrp) : undefined,
    salePrice: body.salePrice ? Number(body.salePrice) : undefined,
    purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : undefined,
    openingStock: body.openingStock ? Number(body.openingStock) : 0,
    minStock: body.minStock ? Number(body.minStock) : 0,
    companyTag: body.companyTag || undefined,
  });
  items.unshift(item);
  notify();
  return item;
}

export async function updateItem(id: string, body: {
  name?: string; sku?: string; unit?: string; secondaryUnit?: string;
  conversionRate?: string; mrp?: string; salePrice?: string;
  purchasePrice?: string; openingStock?: string; minStock?: string;
}): Promise<void> {
  const updated = await api.updateItem(id, {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.sku !== undefined && { sku: body.sku || undefined }),
    ...(body.unit !== undefined && { unit: body.unit || undefined }),
    ...(body.secondaryUnit !== undefined && { secondaryUnit: body.secondaryUnit || undefined }),
    ...(body.conversionRate !== undefined && { conversionRate: body.conversionRate || undefined }),
    ...(body.mrp !== undefined && { mrp: body.mrp ? Number(body.mrp) : undefined }),
    ...(body.salePrice !== undefined && { salePrice: body.salePrice ? Number(body.salePrice) : undefined }),
    ...(body.purchasePrice !== undefined && { purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : undefined }),
    ...(body.openingStock !== undefined && { openingStock: Number(body.openingStock) || 0 }),
    ...(body.minStock !== undefined && { minStock: Number(body.minStock) || 0 }),
  });
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1) items[idx] = updated;
  notify();
}

export async function deleteItem(id: string): Promise<void> {
  await api.deleteItem(id);
  items = items.filter((i) => i.id !== id);
  notify();
}

export function subscribeItems(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Unit selection bridge between new/edit screens and unit screen
export const pendingUnit = { primary: "", secondary: "", rate: "", ready: false };

export function setPendingUnit(primary: string, secondary: string, rate: string) {
  pendingUnit.primary = primary;
  pendingUnit.secondary = secondary;
  pendingUnit.rate = rate;
  pendingUnit.ready = true;
}

export function consumePendingUnit() {
  const copy = { ...pendingUnit };
  pendingUnit.ready = false;
  return copy;
}

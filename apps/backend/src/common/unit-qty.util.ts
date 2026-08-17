export type ItemUnitInfo = {
  unit?: string | null; secondaryUnit?: string | null; conversionRate?: string | null;
  tertiaryUnit?: string | null; tertiaryConversionRate?: string | null;
};

// Converts a recorded line-item quantity (in whatever unit it was actually sold/bought in)
// into the item's base-unit (Item.unit) equivalent — so "2 Carton" and "40 Piece" of the
// same item can be summed correctly instead of blended into a meaningless raw total.
// Shared by reports.service.ts (valuation replay) and StockService (real stock movement) —
// keep both in sync by importing this rather than reimplementing the conversion.
export function toBaseQty(qty: number, unit: string | undefined, item: ItemUnitInfo): number {
  const u = (unit ?? '').trim().toLowerCase();
  if (item.tertiaryUnit && u === item.tertiaryUnit.trim().toLowerCase()) {
    return qty * (parseFloat(item.tertiaryConversionRate ?? '') || 1);
  }
  if (item.secondaryUnit && u === item.secondaryUnit.trim().toLowerCase()) {
    const rate = parseFloat(item.conversionRate ?? '') || 1;
    return rate ? qty / rate : qty;
  }
  return qty;
}

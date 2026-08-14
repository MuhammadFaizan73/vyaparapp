// Splits a raw stock quantity (denominated in `unit`, the item's normal stocking unit)
// into "X Carton Y Box Z Pcs". Hierarchy is biggest to smallest: tertiaryUnit (Carton) >
// unit (Box) > secondaryUnit (Pieces) — 1 tertiaryUnit = tertiaryConversionRate unit, and
// 1 unit = conversionRate secondaryUnit. Falls back a tier at a time when not configured.
export function formatStockQty(
  qty: number,
  unit: string,
  secondaryUnit: string | null,
  conversionRate: number | null,
  tertiaryUnit?: string | null,
  tertiaryConversionRate?: number | null,
): string {
  if (!unit) return String(qty);
  const sign = qty < 0 ? "-" : "";
  const abs = Math.abs(qty);

  if (tertiaryUnit && tertiaryConversionRate && tertiaryConversionRate > 0) {
    const tertiaryCount = Math.floor(abs / tertiaryConversionRate);
    const unitRemainder = abs % tertiaryConversionRate;
    if (secondaryUnit && conversionRate && conversionRate > 0) {
      const wholeUnit = Math.floor(unitRemainder);
      const secondaryCount = Math.round((unitRemainder - wholeUnit) * conversionRate);
      return `${sign}${tertiaryCount} ${tertiaryUnit} ${wholeUnit} ${unit} ${secondaryCount} ${secondaryUnit}`;
    }
    return `${sign}${tertiaryCount} ${tertiaryUnit} ${unitRemainder} ${unit}`;
  }

  if (secondaryUnit && conversionRate && conversionRate > 0) {
    const wholeUnit = Math.floor(abs);
    const secondaryCount = Math.round((abs - wholeUnit) * conversionRate);
    return `${sign}${wholeUnit} ${unit} ${secondaryCount} ${secondaryUnit}`;
  }

  return `${sign}${abs} ${unit}`;
}

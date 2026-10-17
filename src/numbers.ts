export type NumberStyle = "latn" | "arab";

/** Number style is a per-company setting, independent of the UI language (Q56). */
export function formatAmount(value: string | number, style: NumberStyle) {
  return new Intl.NumberFormat(style === "arab" ? "ar" : "en", {
    numberingSystem: style,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatInt(value: number, style: NumberStyle) {
  return new Intl.NumberFormat(style === "arab" ? "ar" : "en", { numberingSystem: style }).format(value);
}

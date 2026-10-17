/** Prices across the site: whole kyats with thousands separators and the MMK suffix, e.g. "90,000 MMK". */
export function formatMmk(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)} MMK`
}

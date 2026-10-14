/* v3 line 863. Amounts always use Western digits, in English and Arabic alike. */
export const fmt = (n: number | null | undefined) =>
  "SAR " + (Math.round((n || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* v3 rounds with `+x.toFixed(2)` everywhere; the goldens depend on exactly that behaviour */
export const round2 = (x: number) => +x.toFixed(2);

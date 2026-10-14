import { round2 } from "./money";

/* v3 lines 900–913: what the patient actually hands over — Saudi notes and coins */
export const NOTES = [500, 200, 100, 50, 10, 5, 1, 0.5];
export const noteLabel = (n: number) => (n >= 1 ? `SAR ${n}` : `${n * 100} halala`);

/* the fewest notes that cover the amount — what a cashier would expect to be handed */
export function suggestNotes(amount: number) {
  const out: Record<number, number> = {};
  let left = Math.ceil(amount * 2) / 2; /* the patient cannot pay less than half a riyal */
  NOTES.forEach((n) => {
    const k = Math.floor((left + 1e-9) / n);
    if (k > 0) {
      out[n] = k;
      left = round2(left - k * n);
    }
  });
  if (left > 0.001) out[0.5] = (out[0.5] || 0) + 1; /* round the last few halalas up */
  return out;
}
export const notesTotal = (notes: Record<number, number> | null | undefined) =>
  round2(Object.entries(notes || {}).reduce((a, [n, k]) => a + +n * k, 0));

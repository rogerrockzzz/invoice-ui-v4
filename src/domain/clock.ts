/* Injectable clock: v3 reads `new Date()` directly; tests freeze it here. */
let fixed: Date | null = null;

export const setClock = (d: Date | null) => {
  fixed = d ? new Date(d) : null;
};
export const today = () => (fixed ? new Date(fixed) : new Date());
/* v3 `now()`: "HH:MM" */
export const now = () => today().toTimeString().slice(0, 5);

import { PAYER_DIRECTORY } from "../data/seed";

/* v3 lines 1032–1036: the directory is only ever searched — never listed in full */
export function searchPayers(f: { group?: string; contract?: string; policy?: string }) {
  const has = (v: string | undefined, q: string | undefined) => !q || String(v || "").toLowerCase().includes(q.trim().toLowerCase());
  /* the group field also matches the payer's name */
  return PAYER_DIRECTORY.filter((x) => (has(x.label, f.group) || has(x.group, f.group)) && has(x.contract, f.contract) && has(x.policy, f.policy));
}

import { createSeed } from "./seed";
import { resetIds } from "../domain/ids";
import { numberSeedLedger } from "../domain/ledger";
import type { World } from "../domain/types";

/* A fresh v3 world: the seed, default settings, and the wallet documents for the ledger on file
   (v3 numbers them once at load, lines 5925–5926). */
export function createWorld(): World {
  resetIds();
  const w: World = { ...createSeed(), settings: { autoSend: true, branch: "AL Hamra Hospital" } };
  numberSeedLedger(w);
  return w;
}

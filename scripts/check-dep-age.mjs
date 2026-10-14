/* Supply-chain policy: every installed package version must be at least 7 days old.
   Reads package-lock.json, asks the npm registry when each version was published, lists the ones too new.
   Fix offenders by pinning an older version (direct deps) or adding an `overrides` entry (transitive). */
import fs from "node:fs";

const MIN_AGE_DAYS = 7;
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const pkgs = Object.entries(lock.packages)
  .filter(([k, v]) => k && v.version && !v.link)
  .map(([k, v]) => [k.split("node_modules/").pop(), v.version]);
const uniq = [...new Map(pkgs.map(([n, v]) => [`${n}@${v}`, [n, v]])).values()];
const cutoff = Date.now() - MIN_AGE_DAYS * 864e5;
const bad = [];
let i = 0;
async function worker() {
  while (i < uniq.length) {
    const [n, v] = uniq[i++];
    try {
      const j = await (await fetch(`https://registry.npmjs.org/${n.replace("/", "%2F")}`)).json();
      const t = Date.parse(j.time?.[v]);
      if (!(t < cutoff)) bad.push(`${n}@${v}  published ${j.time?.[v] || "?"}`);
    } catch (e) {
      bad.push(`${n}@${v}  lookup failed: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
console.log(`checked ${uniq.length} packages; younger than ${MIN_AGE_DAYS} days: ${bad.length}`);
bad.sort().forEach((b) => console.log("  " + b));
process.exit(bad.length ? 1 : 0);

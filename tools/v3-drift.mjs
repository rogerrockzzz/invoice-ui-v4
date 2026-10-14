/* v3 drift check (docs/PLAN-v4-M1.md §6.3).
   Compares the live v3 prototype with docs/v3-baseline.html function by function and reports what was
   added, removed or changed, with line numbers in the live file.
     npm run drift              report only
     npm run drift -- --accept  after porting: copy live v3 over the baseline and print the new sha256 */
import { readFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const LIVE = "docs/Devin Invoice UI/journey-opd-v3.html";
const BASE = "docs/v3-baseline.html";
const sha = (s) => createHash("sha256").update(s).digest("hex");

/* top-level declarations start at column 0: `function name(`, `const NAME =`, `let name =` */
function blocks(src) {
  const lines = src.split("\n");
  const start = /^(?:async\s+)?function\s+([\w$]+)|^(?:const|let|var)\s+([\w$]+)\s*=/;
  const out = new Map();
  let cur = null;
  lines.forEach((l, i) => {
    const m = start.exec(l);
    if (m) {
      cur = { name: m[1] || m[2], line: i + 1, body: [] };
      /* a name declared twice keeps both bodies, so a moved/duplicated block still shows */
      const key = out.has(cur.name) ? `${cur.name}#${i + 1}` : cur.name;
      out.set(key, cur);
    } else if (/^(?:\/\*|<\/script>)/.test(l)) {
      cur = null; /* a column-0 comment or the end of the script closes the block */
    }
    if (cur) cur.body.push(l);
  });
  for (const b of out.values()) b.hash = sha(b.body.join("\n").replace(/\s+/g, " "));
  return out;
}

const [live, base] = await Promise.all([readFile(LIVE, "utf8"), readFile(BASE, "utf8")]);
if (process.argv.includes("--accept")) {
  await copyFile(LIVE, BASE);
  console.log(`Baseline updated. sha256 ${sha(live)} — record it in docs/PARITY.md.`);
  process.exit(0);
}
console.log(`live     ${LIVE}\n         sha256 ${sha(live)}\nbaseline ${BASE}\n         sha256 ${sha(base)}`);
if (sha(live) === sha(base)) {
  console.log("No drift: v3 is identical to the baseline.");
  process.exit(0);
}
const L = blocks(live), B = blocks(base);
const added = [...L.keys()].filter((k) => !B.has(k));
const removed = [...B.keys()].filter((k) => !L.has(k));
const changed = [...L.keys()].filter((k) => B.has(k) && B.get(k).hash !== L.get(k).hash);
const show = (title, keys, map) => {
  if (!keys.length) return;
  console.log(`\n${title} (${keys.length})`);
  keys.forEach((k) => console.log(`  ${k.padEnd(28)} line ${map.get(k).line}`));
};
show("CHANGED", changed, L);
show("ADDED", added, L);
show("REMOVED", removed, B);
if (!added.length && !removed.length && !changed.length) console.log("\nOnly CSS / markup / comments changed — check the visual parity by eye.");
console.log("\nMark each name `drift` in docs/PARITY.md, port it, then run `npm run drift -- --accept` and `npm run golden`.");

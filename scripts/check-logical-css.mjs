/* RTL guard (docs/PLAN-v4-M1.md §5.3): Arabic is coming, so layout uses logical utilities only —
   ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const BANNED = /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right)-[\w[\].\/-]+|text-(?:left|right)|border-[lr](?:-[\w/[\].-]+)?|rounded-[lr](?:-[\w[\].-]+)?|rounded-(?:tl|tr|bl|br)(?:-[\w[\].-]+)?|float-(?:left|right))(?![\w-])/g;

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(tsx|ts|css)$/.test(e.name)) yield p;
  }
}

const hits = [];
for await (const f of files("src")) {
  const lines = (await readFile(f, "utf8")).split("\n");
  lines.forEach((line, i) => {
    /* only class strings: className="…", class lists in template literals, @apply */
    const classy = line.match(/className=(?:"[^"]*"|\{`[^`]*`\})|@apply[^;]*/g) || [];
    for (const chunk of classy) for (const m of chunk.matchAll(BANNED)) hits.push(`${f}:${i + 1}  ${m[0]}`);
  });
}
if (hits.length) {
  console.error("Physical-direction utilities found — use logical ones (ms/me/ps/pe/start/end/text-start/text-end/border-s/border-e):");
  hits.forEach((h) => console.error("  " + h));
  process.exit(1);
}
console.log("logical-css: ok");

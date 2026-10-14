/* Regenerates src/domain/__golden__/v3.json from the v3 prototype (docs/PLAN-v4-M1.md §6.2).
   Serves the project root on a temporary port, runs tools/v3-golden/extract.html in headless Chrome,
   and writes the JSON it prints. Review the git diff of v3.json after every regeneration. */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/tools/v3-golden/extract.html`;

const dom = await new Promise((resolve, reject) =>
  execFile("google-chrome",
    ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=15000", "--dump-dom", url],
    { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 },
    (err, stdout) => (err ? reject(err) : resolve(stdout))),
);
server.close();

const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
const text = m ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : "";
if (!text.startsWith("{")) {
  console.error("Extractor failed:", text.slice(0, 2000) || "(no output)");
  process.exit(1);
}
const data = JSON.parse(text);
data.build = String(data.build).split(" · ")[0]; /* v3 appends today's date — keep the file stable */
await mkdir(join(root, "src/domain/__golden__"), { recursive: true });
await writeFile(join(root, "src/domain/__golden__/v3.json"), JSON.stringify(data, null, 1) + "\n");
console.log(`v3.json written: ${data.calc.length} calcLine cases, ${data.visits.length} visits, ${data.patients.length} patients (v3 build "${data.build}")`);

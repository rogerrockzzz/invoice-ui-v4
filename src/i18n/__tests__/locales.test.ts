import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import ar from "../../locales/ar.json";
import i18n from "..";

type Tree = { [k: string]: string | string[] | Tree };
const PLURAL = /_(zero|one|two|few|many|other)$/;

/* key → text, with plural forms folded onto their base key (Arabic has six forms, English two) */
function flat(t: Tree, pre = "", out = new Map<string, string[]>()) {
  for (const [k, v] of Object.entries(t)) {
    const key = pre + k;
    if (typeof v === "string") {
      const base = key.replace(PLURAL, "");
      out.set(base, [...(out.get(base) || []), v]);
    } else if (Array.isArray(v)) v.forEach((s, i) => out.set(`${key}.${i}`, [s]));
    else flat(v, key + ".", out);
  }
  return out;
}
const params = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?(b|inv)>/g)].map((m) => m[0]).sort();

describe("ar.json", () => {
  const E = flat(en as Tree), A = flat(ar as Tree);

  it("has exactly the keys of en.json", () => {
    expect([...A.keys()].filter((k) => !E.has(k))).toEqual([]);
    expect([...E.keys()].filter((k) => !A.has(k))).toEqual([]);
  });

  it("keeps every param and <b> / <inv> tag of the English text", () => {
    const bad: string[] = [];
    for (const [k, es] of E) {
      const as = A.get(k);
      if (!as) continue;
      const want = new Set(es.flatMap(params));
      for (const a of as) {
        /* a dual / singular form may spell the number out instead of using {{count}} */
        const got = params(a).filter((p) => p !== "count");
        if ([...want].filter((p) => p !== "count").sort().join() !== [...new Set(got)].sort().join()) bad.push(`${k} params: ${a}`);
        if (tags(a).join() !== tags(es[0]!).join()) bad.push(`${k} tags: ${a}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("is what i18next serves when the language is Arabic", async () => {
    await i18n.changeLanguage("ar");
    expect(i18n.t("tabs.home")).toBe("الرئيسية");
    expect(i18n.t("hist.eligibility", { count: 2 })).toContain("وثيقتان");
    expect(i18n.t("hist.eligibility", { count: 5 })).toContain("5 وثائق");
    await i18n.changeLanguage("en");
    expect(i18n.t("tabs.home")).toBe("Home");
  });
});

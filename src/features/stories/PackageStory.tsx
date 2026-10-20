import { Button, Card, Checkbox, Chip, Disclosure, Link } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CLINICS, DOCTORS } from "../../domain/constants";
import { packageItemsLeft, type PkgItem } from "../../domain/replace";
import type { PkgStory, Visit } from "../../domain/types";
import { useW } from "../../store/hooks";
import { bookPackageStory, pkgChosen, pkgStoryDo, pkgStoryOf } from "../../store/package";
import { useWorld } from "../../store/world";
import { InvoiceLink } from "../../ui/InvoiceLink";
import { PickSelect } from "../../ui/PickSelect";
import { T } from "../../ui/Rich";

/* v3 renderPackageStory() (line 2907): choose procedures, then clinic and doctor, then the visit exists */
export function PackageStory({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const left = packageItemsLeft(w, c.mrn);
  const ps = pkgStoryOf(w, c);
  const chosen = pkgChosen(w, c.mrn, ps.sel);
  const upd = (fn: (s: PkgStory) => void) => act(c.id, (dw, dc) => pkgStoryDo(dw, dc, fn));
  const names = chosen.map((x) => x.child.name).join(", ");
  const tag = <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.package.title")}</Chip>;

  if (ps.stage === 2) return (
    <Card className="gap-3 border-s-4 bg-linear-to-br from-blue-50 to-white border-s-accent p-5" data-testid="step-card" data-step="PKG_WHERE">
      {top}
      {tag}
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t("pkg.whereQ")}</h2>
      <p className="text-sm text-muted">
        {names} · <Link className="cursor-pointer text-sm" onPress={() => upd((s) => { s.stage = 1; })}>{t("pkg.change")}</Link>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <PickSelect label={t("pkg.clinic")} value={ps.clinic} options={CLINICS} onChange={(v) => upd((s) => { s.clinic = v; })} />
        <PickSelect label={t("pkg.doctor")} value={ps.doctor} options={DOCTORS} onChange={(v) => upd((s) => { s.doctor = v; })} />
      </div>
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant="primary" className="bg-success text-success-foreground" onPress={() => act(c.id, bookPackageStory)}>{t("pkg.go")}</Button>
      </div>
    </Card>
  );

  return (
    <Card className="gap-3 border-s-4 bg-linear-to-br from-blue-50 to-white border-s-accent p-5" data-testid="step-card" data-step="PKG_CHOOSE">
      {top}
      {tag}
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">
        {chosen.length === 1 ? t("pkg.q1", { name: chosen[0]!.child.name }) : chosen.length ? t("pkg.qN", { count: chosen.length }) : t("pkg.q0")}
      </h2>
      <p className="text-sm text-muted" data-testid="step-sub">
        {chosen.length ? <T k="pkg.sub" p={{ names, parent: chosen[0]!.parent.name }} /> : t("pkg.sub0")}
      </p>
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant="primary" className="bg-success text-success-foreground" isDisabled={!chosen.length} onPress={() => upd((s) => { s.stage = 2; })}>
          {t(chosen.length === 1 ? "pkg.yesIt" : "pkg.yesThem")}
        </Button>
      </div>
      <Disclosure isExpanded={ps.listOpen} onExpandedChange={(o) => upd((s) => { s.listOpen = o; })} className="rounded-xl border border-border bg-white dark:bg-transparent">
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-3 py-2 text-start text-sm font-semibold text-vida-navy">
            {t("pkg.others", { count: left.length })}
            <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          {ps.listOpen && (
            <PkgList items={left} sel={ps.sel} line={(x) => <>{t("pkg.paidOn", { code: x.child.code, parent: x.parent.name })}<InvoiceLink id={x.inv.id} /></>}
              onToggle={(code, on) => upd((s) => { if (on) s.sel[code] = true; else delete s.sel[code]; })} />
          )}
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

/* the procedures still to book, each with a tick (the story's list and the profile's pop-up) */
export function PkgList({ items, sel, line, onToggle }: {
  items: PkgItem[]; sel: Record<string, boolean>; line: (x: PkgItem) => ReactNode; onToggle: (code: string, on: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col divide-y divide-border border-t border-border" data-testid="pkg-list">
      {items.map((x) => {
        const on = !!sel[x.child.code];
        return (
          <li key={`${x.inv.id}-${x.child.code}`} className={`flex items-center gap-3 px-3 py-2 ${on ? "bg-accent/5" : ""}`} data-testid="pkg-row" data-code={x.child.code}>
            <Checkbox variant="secondary" isSelected={on} aria-label={t("pkg.tick", { name: x.child.name })} onChange={(v) => onToggle(x.child.code, v)}>
              <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
            </Checkbox>
            <span className="min-w-0 flex-1 leading-tight">
              <b className="block text-sm">{x.child.name}</b>
              <span className="text-xs text-muted">{line(x)}</span>
            </span>
            <span className="text-xs font-semibold text-success">{t("pkg.noCharge")}</span>
          </li>
        );
      })}
    </ul>
  );
}

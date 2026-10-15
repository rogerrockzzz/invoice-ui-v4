import { Button, Drawer, Label, NumberField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { ADV_CATS, DESK_MODES } from "../../domain/constants";
import { fmt } from "../../domain/money";
import type { AdvCat } from "../../domain/types";
import { useW } from "../../store/hooks";
import { useUi, walletDo } from "../../store/ui";
import { addAdvance } from "../../store/wallet";
import { useWorld } from "../../store/world";
import { useNarrow } from "../drawer/PaymentDrawer";

/* v3 renderAdvanceDrawer() (line 4306): the money for Add advance — which pot, how it was received, how much */
export function AdvanceDrawer() {
  const { t } = useTranslation();
  const w = useW();
  const { adv: d, upd, set } = useUi();
  const actW = useWorld((s) => s.actW);
  const narrow = useNarrow();
  if (!d) return null;
  const p = w.patients[d.mrn]!, wal = p.wallet;
  const total = ADV_CATS.reduce((a, k) => a + wal.advance[k], 0);
  const amt = d.amount || 0;
  const close = () => set({ adv: null });
  const go = () => {
    if (!(amt > 0)) return;
    const done = actW((dw, fx) => addAdvance(dw, d.mrn, d.caseId, d.cat, d.mode, amt, fx));
    if (d.fromWallet) walletDo(d.mrn, (x) => { x.flow = null; x.done = done; });
    set({ adv: null });
  };
  const title = t("advDrawer.title", { name: p.name });
  return (
    <Drawer.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Drawer.Content placement={narrow ? "bottom" : "right"}>
        <Drawer.Dialog aria-label={title} data-testid="adv-drawer" className={narrow ? "max-h-[92vh]" : "sm:w-[420px]"}>
          {narrow && <Drawer.Handle />}
          <Drawer.CloseTrigger />
          <Drawer.Header className="-mx-6 -mt-6 bg-accent/10 px-6 pb-4 pt-6">
            <Drawer.Heading className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</Drawer.Heading>
            <div className="text-2xl font-bold tabular-nums text-vida-navy">{fmt(amt)}</div>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            <Group label={t("advDrawer.type")}>
              <ToggleButtonGroup aria-label={t("advDrawer.type")} selectionMode="single" disallowEmptySelection selectedKeys={[d.cat]}
                onSelectionChange={(k) => { const id = [...k][0]; if (id) upd((s) => { s.adv!.cat = id as AdvCat; }); }} className="flex flex-wrap justify-start gap-2">
                {ADV_CATS.map((k) => (
                  <ToggleButton key={k} id={k} className="h-auto min-h-11 flex-col items-start gap-0 rounded-xl px-3 py-1.5">
                    <span className="text-sm">{k}</span>
                    <span className="text-[10px] font-normal text-muted">{t("wallet.now", { amount: fmt(wal.advance[k]) })}</span>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Group>
            <Group label={t("advDrawer.receivedBy")}>
              <ToggleButtonGroup aria-label={t("advDrawer.receivedBy")} selectionMode="single" disallowEmptySelection selectedKeys={[d.mode]}
                onSelectionChange={(k) => { const id = [...k][0]; if (id) upd((s) => { s.adv!.mode = String(id); }); }} className="flex flex-wrap justify-start gap-2">
                {DESK_MODES.map((m) => <ToggleButton key={m} id={m} className="min-h-11 rounded-xl px-3">{m}</ToggleButton>)}
              </ToggleButtonGroup>
            </Group>
            <NumberField value={d.amount ?? NaN} minValue={0} step={0.01} formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
              onChange={(v) => upd((s) => { s.adv!.amount = Number.isNaN(v) ? null : v; })}>
              <Label>{t("wallet.amount")}</Label>
              <NumberField.Group><NumberField.Input placeholder="0.00" data-testid="adv-amount" /></NumberField.Group>
            </NumberField>
            <p className="text-xs text-muted">{t("advDrawer.hint")}</p>
          </Drawer.Body>
          <Drawer.Footer className="flex-col items-stretch gap-3 border-t border-border">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{t("advDrawer.after")}</span>
              <span className="ms-auto text-lg font-bold tabular-nums">{fmt(total + amt)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onPress={close}>{t("drawer.cancel")}</Button>
              <Button variant="primary" className="flex-1" isDisabled={!(amt > 0)} onPress={go}>{t("advDrawer.go")}</Button>
            </div>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><span className="text-xs font-semibold text-muted">{label}</span>{children}</div>;
}

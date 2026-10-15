import { Button, Card, Checkbox, Input, Label, NumberField, Tabs, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Undo2, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ADV_CATS } from "../../domain/constants";
import { creditInvoices, creditOf, creditTotal } from "../../domain/lines";
import { fmt, round2 } from "../../domain/money";
import { STORIES, type StagePos } from "../../domain/stories";
import type { AdvCat, Invoice, Visit } from "../../domain/types";
import { notify } from "../../store/toasts";
import { useW } from "../../store/hooks";
import { useUi, walletDo, walletOn, type WalletUi } from "../../store/ui";
import { walletCreditLink } from "../../store/wallet";
import { useWorld } from "../../store/world";
import { InvoiceLink } from "../../ui/InvoiceLink";
import { StoryStepper } from "../../ui/StoryStepper";
import { LedgerTable } from "./LedgerTable";

/* when an invoice was raised: a seed invoice carries its date, a fresh one only its time */
export const invWhen = (c: Visit, inv: Invoice) => (/\d{1,2} \w{3}/.test(inv.at) ? inv.at : `${c.date || ""} ${inv.at}`);

/* v3 renderWalletSection() (line 4171): advance and credit as a section with its own stories — balances at a glance,
   the statement on demand, and add advance / refund advance / settle credit, whose money moves in the slide-in */
export function WalletSection({ mrn, caseId }: { mrn: string; caseId: number | null }) {
  const { t } = useTranslation();
  const w = useW();
  const ui = useUi();
  const ws = walletOn(ui, mrn);
  const p = w.patients[mrn]!, wal = p.wallet;
  const adv = ADV_CATS.reduce((a, k) => a + wal.advance[k], 0), credit = creditTotal(w, mrn);
  const upd = (fn: (x: WalletUi) => void) => walletDo(mrn, fn);
  const back = () => upd((x) => { x.flow = null; x.done = null; x.sel = null; });
  const pickTab = (k: string) => {
    if (k === ws.tab) return;
    if (ws.flow) { notify("warn", t("toast.finishFirst"), t("toast.finishFirstSub")); return; }
    upd((x) => { x.tab = k as WalletUi["tab"]; x.stmt = false; });
  };

  let body: ReactNode;
  if (ws.done) {
    const id = ws.done.story;
    body = (
      <div className="flex flex-col gap-3" data-testid="wallet-done">
        <StoryStepper id={id} pos={{ index: STORIES[id].stages - 1, skipped: [], complete: true }} />
        <h2 className="text-lg font-bold text-vida-navy">{ws.done.title}</h2>
        <p className="text-sm text-muted">{ws.done.sub}</p>
        <div><Button variant="primary" onPress={back}>{t("wallet.doneBtn")}</Button></div>
      </div>
    );
  } else if (ws.tab === "ADV") body = ws.flow === "add" ? <AddAdvance mrn={mrn} caseId={caseId} ws={ws} />
    : ws.flow === "refund" ? <RefundAdvance mrn={mrn} caseId={caseId} ws={ws} />
    : (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2" data-testid="wallet-pots">
          {ADV_CATS.map((k) => (
            <div key={k} className={`rounded-xl px-3 py-2 ${wal.advance[k] > 0 ? "bg-accent/10" : "bg-default/50"}`}>
              <div className="text-[11px] text-muted">{t("wallet.pot", { pot: k })}</div>
              <b className={`tabular-nums ${wal.advance[k] > 0 ? "" : "text-muted"}`}>{fmt(wal.advance[k])}</b>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onPress={() => upd((x) => { x.flow = "add"; x.cat = "Open"; x.amount = null; })}><Plus className="size-4" />{t("wallet.addAdvance")}</Button>
          <Button variant="outline" isDisabled={!(adv > 0)}
            onPress={() => upd((x) => { x.flow = "refund"; x.cat = ADV_CATS.find((k) => wal.advance[k] > 0)!; x.amount = null; x.reason = ""; })}>
            <Undo2 className="size-4" />{t("wallet.refundAdvance")}
          </Button>
          <StatementToggle ws={ws} label={t("wallet.advanceStatement")} onPress={() => upd((x) => { x.stmt = !x.stmt; })} />
        </div>
      </div>
    );
  else if (ws.flow === "settle") body = <SettleCredit mrn={mrn} caseId={caseId} ws={ws} />;
  else {
    const crList = creditInvoices(w, mrn);
    body = (
      <div className="flex flex-col gap-3">
        {crList.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border" aria-label={t("wallet.onCredit")}>
            {crList.map((x) => (
              <li key={x.inv.id}>
                <Button variant="ghost" className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none px-3 py-2 text-start font-normal"
                  onPress={() => ui.set({ invPop: x.inv.id })}>
                  <span className="min-w-0 flex-1"><b>{x.inv.id}</b>
                    <span className="block text-xs text-muted">{invWhen(x.c, x.inv)} · {x.c.clinic} · {x.inv.rows.map((r) => r.name).join(", ")}</span></span>
                  <b className="tabular-nums text-danger">{fmt(creditOf(x.inv))}</b>
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">{t("wallet.nothingOnCredit")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" isDisabled={!(credit > 0)} onPress={() => upd((x) => { x.flow = "settle"; x.sel = null; })}>
            {credit > 0 ? t("wallet.settleAmt", { amount: fmt(credit) }) : t("wallet.settle")}
          </Button>
          <StatementToggle ws={ws} label={t("wallet.creditStatement")} onPress={() => upd((x) => { x.stmt = !x.stmt; })} />
        </div>
      </div>
    );
  }

  return (
    <Card className="gap-3 border-s-4 border-s-vida-red p-4" data-testid="wallet-section">
      <div className="flex flex-wrap items-center gap-3">
        <b className="flex items-center gap-2 text-vida-navy"><Wallet className="size-4 text-vida-red" />{t("wallet.title")}</b>
        <span className="text-sm text-muted">
          {t("wallet.advance")} <b className="text-foreground tabular-nums">{fmt(adv)}</b> · {t("wallet.credit")} <b className={`tabular-nums ${credit > 0 ? "text-danger" : "text-foreground"}`}>{fmt(credit)}</b>
        </span>
        <Button size="sm" variant="ghost" className="ms-auto" onPress={() => ui.set({ walletOpen: false })}>{t("wallet.close")} <ChevronUp className="size-4" /></Button>
      </div>
      <Tabs selectedKey={ws.tab} onSelectionChange={(k) => pickTab(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("wallet.title")}>
            <Tabs.Tab id="ADV">{t("wallet.advance")}<b className="ms-2 tabular-nums">{fmt(adv)}</b><Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="CREDIT">{t("wallet.credit")}<b className={`ms-2 tabular-nums ${credit > 0 ? "text-danger" : ""}`}>{fmt(credit)}</b><Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        {(["ADV", "CREDIT"] as const).map((k) => (
          <Tabs.Panel key={k} id={k} className="flex flex-col gap-4 pt-3">
            {k === ws.tab && <>{body}{ws.stmt && !ws.done && <LedgerTable mrn={mrn} kind={k} />}</>}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Card>
  );
}

function StatementToggle({ ws, label, onPress }: { ws: WalletUi; label: string; onPress: () => void }) {
  return (
    <Button variant="ghost" aria-expanded={ws.stmt} onPress={onPress}>
      {ws.stmt ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4 rtl:rotate-180" />}{label}
    </Button>
  );
}

function PotPicker({ mrn, value, onPick, sub, offEmpty }: { mrn: string; value: AdvCat; onPick: (k: AdvCat) => void; sub: (amt: string) => string; offEmpty?: boolean }) {
  const { t } = useTranslation();
  const w = useW();
  const wal = w.patients[mrn]!.wallet;
  return (
    <ToggleButtonGroup aria-label={t("wallet.potLabel")} selectionMode="single" disallowEmptySelection selectedKeys={[value]}
      onSelectionChange={(k) => { const id = [...k][0]; if (id) onPick(id as AdvCat); }} className="flex flex-wrap justify-start gap-2">
      {ADV_CATS.map((k) => (
        <ToggleButton key={k} id={k} isDisabled={offEmpty && !(wal.advance[k] > 0)} className="h-auto min-h-11 flex-col items-start gap-0 rounded-xl px-3 py-1.5">
          <span className="text-sm">{k}</span>
          <span className="text-[10px] font-normal text-muted">{sub(fmt(wal.advance[k]))}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
function AmountField({ label, value, onChange, placeholder, testId }: { label: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; testId: string }) {
  return (
    <NumberField className="max-w-64" value={value ?? NaN} minValue={0} step={0.01} formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
      onChange={(v) => onChange(Number.isNaN(v) ? null : v)}>
      <Label>{label}</Label>
      <NumberField.Group><NumberField.Input placeholder={placeholder || "0.00"} data-testid={testId} /></NumberField.Group>
    </NumberField>
  );
}

/* add advance: pot and amount here, the money in the slide-in (v3 lines 4199–4215) */
function AddAdvance({ mrn, caseId, ws }: { mrn: string; caseId: number | null; ws: WalletUi }) {
  const { t } = useTranslation();
  const w = useW();
  const { adv, set } = useUi();
  const p = w.patients[mrn]!;
  const amt = ws.amount || 0;
  const upd = (fn: (x: WalletUi) => void) => walletDo(mrn, fn);
  return (
    <div className="flex flex-col gap-3" data-testid="wallet-add">
      <StoryStepper id="advadd" pos={{ index: adv ? 1 : 0, skipped: [] }} />
      <h2 className="text-lg font-bold text-vida-navy">{t("wallet.addQ", { first: p.name.split(" ")[0] })}</h2>
      <PotPicker mrn={mrn} value={ws.cat} onPick={(k) => upd((x) => { x.cat = k; })} sub={(a) => t("wallet.now", { amount: a })} />
      <AmountField label={t("wallet.amount")} value={ws.amount} onChange={(v) => upd((x) => { x.amount = v; })} testId="wallet-amount" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" className="bg-success text-success-foreground" isDisabled={!(amt > 0)}
          onPress={() => set({ adv: { caseId, mrn, cat: ws.cat, amount: amt, mode: "Cash", fromWallet: true } })}>
          {t("wallet.takePayment", { amount: fmt(amt) })}
        </Button>
        <Button variant="ghost" onPress={() => upd((x) => { x.flow = null; x.done = null; })}>{t("wallet.cancel")}</Button>
      </div>
    </div>
  );
}

/* refund advance: pot, amount and reason here, the refund mode in the slide-in (v3 lines 4217–4247) */
function RefundAdvance({ mrn, caseId, ws }: { mrn: string; caseId: number | null; ws: WalletUi }) {
  const { t } = useTranslation();
  const w = useW();
  const { drawer, openDrawer } = useUi();
  const p = w.patients[mrn]!;
  const amt = ws.amount || 0, max = p.wallet.advance[ws.cat] || 0;
  const ok = amt > 0 && amt <= max + 0.001 && ws.reason.trim().length > 2;
  const pos: StagePos = { index: drawer && drawer.advRefund ? 2 : amt > 0 && amt <= max ? 1 : 0, skipped: [] };
  const upd = (fn: (x: WalletUi) => void) => walletDo(mrn, fn);
  return (
    <div className="flex flex-col gap-3" data-testid="wallet-refund">
      <StoryStepper id="advrefund" pos={pos} />
      <h2 className="text-lg font-bold text-vida-navy">{t("wallet.refundQ", { first: p.name.split(" ")[0] })}</h2>
      <PotPicker mrn={mrn} value={ws.cat} offEmpty onPick={(k) => upd((x) => { x.cat = k; x.amount = null; })} sub={(a) => t("wallet.available", { amount: a })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <AmountField label={t("wallet.amount")} value={ws.amount} onChange={(v) => upd((x) => { x.amount = v; })} placeholder={t("wallet.upTo", { amount: fmt(max) })} testId="wallet-amount" />
        <TextField value={ws.reason} onChange={(v) => upd((x) => { x.reason = v; })} isRequired>
          <Label>{t("wallet.reason")}</Label>
          <Input placeholder={t("wallet.reasonPh")} />
        </TextField>
      </div>
      <div className="flex items-baseline gap-2" data-testid="wallet-refund-amt">
        <span className="text-2xl font-bold tabular-nums text-danger">{fmt(Math.min(amt, max))}</span>
        <small className="text-xs text-muted">{amt > max + 0.001 ? t("wallet.onlyAvailable", { amount: fmt(max), pot: ws.cat }) : t("wallet.backFrom", { pot: ws.cat })}</small>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="danger" isDisabled={!ok} onPress={() => openDrawer(caseId, mrn, round2(amt), { advRefund: { cat: ws.cat, reason: ws.reason.trim() } })}>
          {t("wallet.yesRefund", { amount: fmt(amt) })}
        </Button>
        <Button variant="ghost" size="sm" onPress={() => upd((x) => { x.amount = max; })}>{t("wallet.refundAll", { amount: fmt(max) })}</Button>
        <Button variant="ghost" onPress={() => upd((x) => { x.flow = null; x.done = null; })}>{t("wallet.cancel")}</Button>
      </div>
    </div>
  );
}

/* settle credit: choose the invoices here, the payment in the slide-in (v3 lines 4259–4288) */
function SettleCredit({ mrn, caseId, ws }: { mrn: string; caseId: number | null; ws: WalletUi }) {
  const { t } = useTranslation();
  const w = useW();
  const { drawer, openDrawer } = useUi();
  const actW = useWorld((s) => s.actW);
  const crList = creditInvoices(w, mrn);
  const sel = ws.sel || Object.fromEntries(crList.map((x) => [x.inv.id, true]));
  const chosen = crList.filter((x) => sel[x.inv.id]);
  const amt = round2(chosen.reduce((a, x) => a + creditOf(x.inv), 0));
  const upd = (fn: (x: WalletUi) => void) => walletDo(mrn, fn);
  const ids = chosen.map((x) => x.inv.id);
  const link = () => {
    const done = actW((dw, fx) => walletCreditLink(dw, mrn, caseId, ids, fx));
    upd((x) => { x.flow = null; x.sel = null; x.done = done; });
  };
  return (
    <div className="flex flex-col gap-3" data-testid="wallet-settle">
      <StoryStepper id="credit" pos={{ index: drawer && drawer.credit && drawer.credit.fromWallet ? 1 : 0, skipped: [] }} />
      <h2 className="text-lg font-bold text-vida-navy">{t("wallet.settleQ", { amount: fmt(amt) })}</h2>
      <p className="text-sm text-muted">{t("wallet.settleSub", { chosen: chosen.length, count: crList.length })}</p>
      <CreditList list={crList} sel={sel} onToggle={(id, on) => upd((x) => { const s = { ...sel }; if (on) s[id] = true; else delete s[id]; x.sel = s; })} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" className="bg-success text-success-foreground" isDisabled={!amt}
          onPress={() => openDrawer(caseId, mrn, amt, { credit: { ids, fromWallet: true } })}>{t("step.act.takePaymentAtDesk")}</Button>
        <Button variant="outline" isDisabled={!amt} onPress={link}>{t("step.act.sendPaymentLink")}</Button>
        <Button variant="ghost" onPress={() => upd((x) => { x.flow = null; x.sel = null; x.done = null; })}>{t("wallet.cancel")}</Button>
      </div>
    </div>
  );
}

/* the credit invoices with a tick each (shared by the wallet and the visit's Credit settlement story) */
export function CreditList({ list, sel, onToggle, onView }: {
  list: { c: Visit; inv: Invoice }[]; sel: Record<string, boolean>; onToggle: (id: string, on: boolean) => void; onView?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border" aria-label={t("wallet.onCredit")}>
      {list.map((x) => (
        <li key={x.inv.id} className={`flex items-center gap-3 px-3 py-2 ${sel[x.inv.id] ? "bg-accent/5" : ""}`} data-testid="credit-row">
          <Checkbox isSelected={!!sel[x.inv.id]} onChange={(on) => onToggle(x.inv.id, on)} aria-label={t("wallet.settleInv", { id: x.inv.id })}>
            <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
          </Checkbox>
          <span className="min-w-0 flex-1">
            <InvoiceLink id={x.inv.id} />
            <span className="block text-xs text-muted">{invWhen(x.c, x.inv)} · {x.c.clinic} · {x.inv.rows.map((r) => r.name).join(", ")}</span>
          </span>
          <b className="tabular-nums">{fmt(creditOf(x.inv))}</b>
          {onView && <Button size="sm" variant="ghost" onPress={() => onView(x.inv.id)}>{t("event.view")}</Button>}
        </li>
      ))}
    </ul>
  );
}

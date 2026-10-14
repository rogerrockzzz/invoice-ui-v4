import { Alert, Button, CloseButton, Drawer, Dropdown, Input, Label, NumberField, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Banknote, Check, CreditCard, Ellipsis, Hospital, Minus, ReceiptText, Wallet } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { modeLabel, payMode, type PayMode } from "../../domain/constants";
import { NOTES, noteLabel } from "../../domain/cash";
import * as D from "../../domain/drawer";
import { creditTotal } from "../../domain/lines";
import { pt, walletOf } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import { resolveMsg } from "../../i18n/msg";
import { payAll } from "../../store/actions";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";

const ICON = { card: CreditCard, cash: Banknote, wallet: Wallet, hospital: Hospital, receipt: ReceiptText };
const ModeIcon = ({ m }: { m: PayMode }) => { const I = ICON[m.icon]; return <I className="size-4 shrink-0" aria-hidden />; };

/* a bottom sheet below 768px, a side drawer above (docs/PLAN-v4-M1.md §5.1) */
const narrowQ = "(max-width: 767px)";
const subscribe = (cb: () => void) => { const m = window.matchMedia(narrowQ); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useNarrow = () => useSyncExternalStore(subscribe, () => window.matchMedia(narrowQ).matches, () => false);

/* v3 renderDrawer() (line 5525), the payment branch: pick the mode(s) and complete the payment here */
export function PaymentDrawer() {
  const { t } = useTranslation();
  const w = useW();
  const { drawer: d, drawerDo, set } = useUi();
  const act = useWorld((s) => s.act);
  const narrow = useNarrow();
  const c = d ? w.cases.find((x) => x.id === d.caseId) : null;
  if (!d || !c) return null;
  const v = D.drawerView(w, c, d);
  const wal = walletOf(w, c);
  const close = () => set({ drawer: null });
  const confirm = () => {
    if (!v.canConfirm) return;
    const { mode, detail, parts } = D.drawerConfirm(d);
    set({ drawer: null });
    act(c.id, (dw, dc, fx) => { payAll(dw, dc, mode, fx, detail, parts); });
  };
  const ref = payMode(d.mode).ref;
  const credit = d.mode === "Credit";
  const modeSub = (m: PayMode) => m.advance ? t("drawer.available", { amount: fmt(wal.advance[m.advance]) }) : m.note ? t(`drawer.note.${m.id}`) : "";

  return (
    <Drawer.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      {/* "right" is the inline end (the panel is laid out with justify-end), so it follows RTL */}
      <Drawer.Content placement={narrow ? "bottom" : "right"}>
        <Drawer.Dialog aria-label={t("drawer.title", { name: pt(w, c).name })} data-testid="drawer" className={narrow ? "max-h-[92vh]" : "sm:w-[460px]"}>
          {narrow && <Drawer.Handle />}
          <Drawer.CloseTrigger />
          <Drawer.Header className={`-mx-6 -mt-6 px-6 pb-4 pt-6 ${credit ? "bg-warning/10" : "bg-success/10"}`}>
            <Drawer.Heading className="text-xs font-semibold uppercase tracking-wide text-muted">{t("drawer.title", { name: pt(w, c).name })}</Drawer.Heading>
            <div className="text-2xl font-bold tabular-nums text-vida-navy" data-testid="drawer-amount">{fmt(d.amount)}</div>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            {v.taken.length > 0 && (
              <section className="rounded-xl border border-border p-3" aria-label={t("drawer.takenSoFar")}>
                <div className="mb-2 flex text-xs font-semibold text-muted">
                  {t("drawer.takenSoFar")}<span className="ms-auto tabular-nums">{t("drawer.ofTotal", { taken: fmt(D.payAllocated(d)), total: fmt(d.amount) })}</span>
                </div>
                {v.taken.map((tp, i) => (
                  <div key={i} className="flex items-center gap-1" data-testid="taken-part">
                    <Button variant="ghost" className="h-auto flex-1 justify-start gap-2 py-1.5 text-start" aria-label={t("drawer.editPart", { mode: modeLabel(tp.mode) })}
                      onPress={() => drawerDo((dd) => D.editPart(dd, i))}>
                      <Check className="size-4 text-success" /><ModeIcon m={payMode(tp.mode)} />
                      <span className="flex-1 leading-tight"><b className="block text-sm">{modeLabel(tp.mode)}</b>
                        <span className="text-[11px] font-normal text-muted">{[tp.ref2, tp.ref].filter(Boolean).join(" · ") || t("drawer.clickToChange")}</span></span>
                      <span className="font-semibold tabular-nums">{fmt(tp.amount)}</span>
                    </Button>
                    <CloseButton aria-label={t("drawer.removePart", { mode: modeLabel(tp.mode) })} onPress={() => drawerDo((dd) => D.removePart(dd, i))} />
                  </div>
                ))}
                <div className="mt-1 text-xs" data-testid="still-to-pay">
                  {v.left > 0.004 ? <><b>{fmt(v.left)}</b> {t("drawer.stillToPay")}</> : <b>{t("drawer.fullyAllocated")}</b>}
                </div>
              </section>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted">
                {d.editing ? t("drawer.changing", { mode: modeLabel(d.editing).toLowerCase() }) : v.taken.length ? t("drawer.howRemaining", { amount: fmt(v.left) }) : t("drawer.mode")}
              </span>
              <div className="flex flex-wrap gap-2">
                <ToggleButtonGroup aria-label={t("drawer.mode")} selectionMode="single" disallowEmptySelection selectedKeys={v.restOn ? [] : [d.mode]}
                  onSelectionChange={(k) => { const id = [...k][0]; if (id) drawerDo((dd, dw, dc) => D.pickMode(dw, dc, dd, String(id))); }}
                  className="flex flex-wrap justify-start gap-2">
                  {v.shown.map((m) => (
                    <ToggleButton key={m.id} id={m.id} data-mode={m.id} className="h-auto min-h-11 flex-col items-start gap-0 rounded-xl px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-sm"><ModeIcon m={m} />{modeLabel(m.id)}</span>
                      {modeSub(m) && <span className="text-[10px] font-normal text-muted">{modeSub(m)}</span>}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {v.rest.length > 0 && (
                  <Dropdown>
                    <Button variant={v.restOn ? "primary" : "outline"} className="h-auto min-h-11 flex-col items-start gap-0 rounded-xl px-3 py-1.5" data-testid="more-modes">
                      <span className="flex items-center gap-1.5 text-sm"><Ellipsis className="size-4" />{v.restOn ? modeLabel(d.mode) : t("drawer.moreModes")}</span>
                      <span className="text-[10px] font-normal opacity-80">{t("drawer.nMore", { count: v.rest.length })}</span>
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu aria-label={t("drawer.moreModes")} onAction={(k) => drawerDo((dd, dw, dc) => D.pickMode(dw, dc, dd, String(k)))}>
                        {v.rest.map((m) => (
                          <Dropdown.Item key={m.id} id={m.id} textValue={modeLabel(m.id)}>
                            <ModeIcon m={m} />
                            <Label>{modeLabel(m.id)}</Label>
                            {m.advance && <span className="ms-auto text-xs font-semibold tabular-nums">{fmt(wal.advance[m.advance])}</span>}
                            {d.mode === m.id && <Dropdown.ItemIndicator />}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                )}
              </div>
            </div>

            {d.mode === "Cash" && <CashBox d={d} v={v} />}

            {credit && (
              <Alert status="warning" data-testid="credit-box">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t("drawer.leftUnsettled")}</Alert.Title>
                  <Alert.Description>
                    <Row k={t("drawer.putOnCreditNow")} v={fmt(v.activeAmt)} />
                    <Row k={t("drawer.creditAfter")} v={fmt(creditTotal(w, c.mrn) + v.activeAmt)} strong />
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {d.mode !== "Cash" && (
              <NumberField
                value={v.activeAmt}
                minValue={0}
                step={0.01}
                formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                onChange={(x) => drawerDo((dd) => D.setPartAmount(dd, x ?? 0))}
              >
                <Label>{credit ? t("drawer.amountCredit") : v.taken.length ? t("drawer.amountOn", { mode: modeLabel(d.mode).toLowerCase() }) : t("drawer.amountThis")}</Label>
                <NumberField.Group><NumberField.Input data-testid="part-amount" /></NumberField.Group>
                <span className="text-xs text-muted" data-testid="part-hint">
                  {v.unallocated > 0.004 ? <span className="text-danger"><b>{fmt(v.unallocated)}</b> {t("drawer.stillUnpaid")}</span> : t("drawer.coversAll")}
                </span>
              </NumberField>
            )}

            {v.unallocated > 0.004 && (
              <Button size="sm" variant="primary" className="self-start" onPress={() => drawerDo((dd, dw, dc) => D.addPart(dw, dc, dd))}>
                {t("drawer.addPart", { amount: fmt(v.activeAmt) })}
              </Button>
            )}

            {ref === "card" && (
              <div className="grid grid-cols-2 gap-3">
                <RefField label={t("drawer.approvalNo")} placeholder="e.g. 884120" value={d.ref} onChange={(x) => drawerDo((dd) => { dd.ref = x; })} />
                <RefField label={t("drawer.last4")} placeholder="4417" value={d.ref2} onChange={(x) => drawerDo((dd) => { dd.ref2 = x; })} />
              </div>
            )}
            {ref === "referral" && (
              <div className="grid grid-cols-2 gap-3">
                <RefField label={t("drawer.referringCompany")} placeholder="e.g. AL TAKHASSUSI" value={d.ref2} onChange={(x) => drawerDo((dd) => { dd.ref2 = x; })} />
                <RefField label={t("drawer.referralNo")} placeholder="ICR-40182" value={d.ref} onChange={(x) => drawerDo((dd) => { dd.ref = x; })} />
              </div>
            )}
            {ref === "finance" && (
              <RefField label={t("drawer.voucherNo")} placeholder="FIN-2291" value={d.ref} onChange={(x) => drawerDo((dd) => { dd.ref = x; })} />
            )}

            {v.advParts.length > 0 && (
              <Alert status={v.shortAdv ? "danger" : "success"} data-testid="advance-box" data-short={v.shortAdv ? "" : undefined}>
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t(v.shortAdv ? "drawer.notEnough" : "drawer.drawn")}</Alert.Title>
                  <Alert.Description>
                    {v.shortAdv
                      ? t("drawer.shortBy", { list: v.short.map((x) => t("drawer.holds", { pot: x.cat.toLowerCase(), has: fmt(x.has), want: fmt(x.want) })).join(" · ") })
                      : <>
                          {v.advParts.map((p, i) => <Row key={i} k={t("drawer.potAdvance", { pot: payMode(p.mode).advance })} v={fmt(p.amount)} />)}
                          <Row k={t("drawer.walletAfter")} v={fmt(v.walletAfter)} strong />
                        </>}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Drawer.Body>
          <Drawer.Footer className="flex-col items-stretch gap-3 border-t border-border">
            <div className="flex items-baseline gap-2" data-testid="drawer-total">
              <span className="text-sm font-semibold">{t(`drawer.total.${v.totalLabel}`)}</span>
              {v.parts.length > 1 && <span className="text-xs text-muted">{v.parts.map((p) => `${modeLabel(p.mode)} ${fmt(p.amount)}`).join(" + ")}</span>}
              <span className="ms-auto text-lg font-bold tabular-nums">{fmt(d.amount)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onPress={close}>{t("drawer.cancel")}</Button>
              <Button variant="primary" className={`flex-1 ${credit ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}`}
                isDisabled={!v.canConfirm} onPress={confirm} data-testid="drawer-go">
                {resolveMsg(t, v.goLabel)}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex gap-4 ${strong ? "mt-1 border-t border-current/20 pt-1 font-semibold" : ""}`}><span>{k}</span><b className="ms-auto tabular-nums">{v}</b></div>;
}
function RefField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <TextField value={value} onChange={onChange}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
    </TextField>
  );
}

/* cash: what is handed over, in notes, and the change (v3 lines 5608–5634) */
function CashBox({ d, v }: { d: D.DrawerState; v: ReturnType<typeof D.drawerView> }) {
  const { t } = useTranslation();
  const drawerDo = useUi((s) => s.drawerDo);
  const notes = d.notes || {};
  const short = v.unallocated > 0.004;
  return (
    <div className="flex flex-col gap-3" data-testid="cash-box">
      <div className="grid grid-cols-3 gap-3">
        <ReadOnly label={v.taken.length ? t("drawer.stillToPayLabel") : t("drawer.amountToPay")} value={v.left.toFixed(2)} />
        <NumberField value={v.tendered} minValue={0} step={0.01} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          onChange={(x) => drawerDo((dd) => D.setTendered(dd, String(x ?? 0)))}>
          <Label>{t("drawer.handedOver")}</Label>
          <NumberField.Group><NumberField.Input data-testid="tendered" /></NumberField.Group>
        </NumberField>
        <ReadOnly label={short ? t("drawer.stillToAllocate") : t("drawer.change")} value={(short ? v.unallocated : v.change).toFixed(2)}
          tone={short ? "text-danger" : v.change > 0.004 ? "text-success" : ""} testId="change" />
      </div>
      <div>
        <span className="text-xs font-semibold text-muted">{t("drawer.notesHanded")}</span>
        <div className="mt-1 grid grid-cols-4 gap-2" role="group" aria-label={t("drawer.notesHanded")}>
          {NOTES.map((n) => {
            const k = notes[n] || 0;
            return (
              <div key={n} className="flex items-stretch">
                <Button variant={k ? "primary" : "outline"} className="h-auto min-h-11 flex-1 flex-col gap-0 px-2 py-1" aria-label={t("drawer.addNote", { note: noteLabel(n) })}
                  onPress={() => drawerDo((dd) => D.addNote(dd, n))} data-note={n}>
                  <span className="text-xs">{noteLabel(n)}</span>
                  <span className="text-[11px] font-normal opacity-80">{k ? `× ${k}` : "–"}</span>
                </Button>
                {k > 0 && (
                  <Button isIconOnly size="sm" variant="ghost" className="h-auto min-h-11 w-7 min-w-0" aria-label={t("drawer.lessNote", { note: noteLabel(n) })}
                    onPress={() => drawerDo((dd) => D.lessNote(dd, n))}>
                    <Minus className="size-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => drawerDo((dd) => D.usualNotes(dd))}>{t("drawer.usualNotes", { amount: fmt(v.left) })}</Button>
          <Button size="sm" variant="outline" onPress={() => drawerDo((dd) => D.clearNotes(dd))}>{t("drawer.clear")}</Button>
        </div>
        {d.tenderManual != null && <p className="mt-1 text-xs text-muted"><b>{t("drawer.typedByHand")}</b> {t("drawer.notesNotCounted")}</p>}
      </div>
    </div>
  );
}
function ReadOnly({ label, value, tone, testId }: { label: string; value: string; tone?: string; testId?: string }) {
  return (
    <TextField isReadOnly value={value}>
      <Label>{label}</Label>
      <Input className={`font-semibold tabular-nums ${tone || ""}`} data-testid={testId} />
    </TextField>
  );
}

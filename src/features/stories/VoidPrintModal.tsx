import { Alert, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { pt } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import { useW } from "../../store/hooks";
import { voidPrint } from "../../store/package";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";
import { T } from "../../ui/Rich";

/* v3 renderVoidPop() (line 4953): undoing a printed package invoice — nothing was charged, so it is voided and the
   procedure can be printed again */
export function VoidPrintModal() {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const { voidPop: d, set, upd } = useUi();
  const c = d ? w.cases.find((x) => x.id === d.caseId) : null;
  const inv = c && d ? c.invoices.find((i) => i.id === d.invId) : null;
  if (!d || !c || !inv) return null;
  const close = () => set({ voidPop: null });
  const ok = d.reason.trim().length > 2;
  const go = () => { act(c.id, (dw, dc, fx) => voidPrint(dw, dc, inv.id, d.reason.trim(), fx)); close(); };
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="md">
        <Modal.Dialog aria-label={t("pkg.void.title", { id: inv.id })}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t("pkg.void.title", { id: inv.id })}</Modal.Heading>
            <p className="text-sm text-muted">{t("pkg.void.sub", { name: pt(w, c).name, type: c.visitType, clinic: c.clinic, at: inv.at })}</p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t("pkg.void.noMoney")}</Alert.Title>
                <Alert.Description><T k="pkg.void.what" p={{ id: inv.id }} /></Alert.Description>
              </Alert.Content>
            </Alert>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border" data-testid="void-lines">
              {inv.rows.map((r) => (
                <li key={r.code} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 leading-tight">
                    <b className="block text-sm">{r.name}</b>
                    <span className="text-xs text-muted">{t("pkg.void.line", { code: r.code })}</span>
                  </span>
                  <span className="text-sm tabular-nums">{fmt(0)}</span>
                </li>
              ))}
            </ul>
            <TextField value={d.reason} onChange={(v) => upd((s) => { if (s.voidPop) s.voidPop.reason = v; })} isRequired>
              <Label>{t("pkg.void.reason")}</Label>
              <Input placeholder={t("pkg.void.reasonPh")} />
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={close}>{t("pkg.void.keep")}</Button>
            <Button variant="danger" isDisabled={!ok} onPress={go}>{t("pkg.void.go")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

import { Alert, Button, Label, Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { LWBS_REASONS } from "../../domain/constants";
import { liveInvoices, refundable } from "../../domain/lines";
import { firstName, pt } from "../../domain/lookup";
import { markLwbs } from "../../store/actions";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";

/* v3 renderLwbsPop() (line 1841): why did the patient leave before the doctor saw them? */
export function LwbsModal() {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const { lwbsPop: d, set, upd } = useUi();
  const c = d ? w.cases.find((x) => x.id === d.caseId) : null;
  if (!d || !c) return null;
  const close = () => set({ lwbsPop: null });
  const go = () => { act(c.id, (dw, dc, fx) => markLwbs(dw, dc, d.reason, fx)); close(); };
  const p = pt(w, c);
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="md">
        <Modal.Dialog aria-label={t("lwbs.title", { first: firstName(w, c) })}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t("lwbs.title", { first: firstName(w, c) })}</Modal.Heading>
            <p className="text-sm text-muted">{t("lwbs.sub", { name: p.name, type: c.visitType, clinic: c.clinic })}</p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t("lwbs.reason")}</Label>
              <ToggleButtonGroup aria-label={t("lwbs.reason")} selectionMode="single" disallowEmptySelection
                selectedKeys={d.reason ? [d.reason] : []} className="flex flex-wrap justify-start gap-2"
                onSelectionChange={(k) => { const id = [...k][0]; if (id) upd((s) => { if (s.lwbsPop) s.lwbsPop.reason = String(id); }); }}>
                {LWBS_REASONS.map((r, i) => <ToggleButton key={r} id={r} className="min-h-11 rounded-xl px-3">{t(`lwbs.reasons.${i}`)}</ToggleButton>)}
              </ToggleButtonGroup>
            </div>
            {liveInvoices(c).some((i) => refundable(w, i)) && (
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content><Alert.Description>{t("lwbs.hint")}</Alert.Description></Alert.Content>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={close}>{t("lwbs.keep")}</Button>
            <Button variant="danger" onPress={go}>{t("lwbs.go")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

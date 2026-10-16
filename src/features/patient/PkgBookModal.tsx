import { Button, Link, Modal } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { CLINICS, DOCTORS } from "../../domain/constants";
import { packageItems, packageItemsLeft } from "../../domain/replace";
import { useW } from "../../store/hooks";
import { pkgChosen } from "../../store/package";
import { confirmPkgBook, useUi } from "../../store/ui";
import { PickSelect } from "../../ui/PickSelect";
import { T } from "../../ui/Rich";
import { PkgList } from "../stories/PackageStory";

/* v3 renderPkgBookPop() (line 5108): book package procedures as their own visit, from the patient profile */
export function PkgBookModal() {
  const { t } = useTranslation();
  const w = useW();
  const { pkgBook: d, set, upd } = useUi();
  if (!d) return null;
  const p = w.patients[d.mrn]!;
  const left = packageItemsLeft(w, d.mrn);
  const chosen = pkgChosen(w, d.mrn, d.sel);
  const booked = packageItems(w, d.mrn).filter((x) => x.child.visitId).length;
  const close = () => set({ pkgBook: null });
  const edit = (fn: (x: NonNullable<typeof d>) => void) => upd((s) => { if (s.pkgBook) fn(s.pkgBook); });
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={t("pkg.pop.title")}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t("pkg.pop.title")}</Modal.Heading>
            <p className="text-sm text-muted"><T k="pkg.pop.sub" p={{ name: p.name, mrn: p.mrn }} /></p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <div className="rounded-xl border border-border [&>ul]:border-t-0">
              <PkgList items={left} sel={d.sel} onToggle={(code, on) => edit((x) => { if (on) x.sel[code] = true; else delete x.sel[code]; })}
                line={(x) => <><T k="pkg.pop.from" p={{ code: x.child.code, parent: x.parent.name, at: x.inv.at }} />
                  <Link className="cursor-pointer font-semibold text-accent" onPress={() => set({ pkgBook: null, invPop: x.inv.id })}>{x.inv.id}</Link></>} />
            </div>
            {booked > 0 && <p className="text-xs text-muted">{t("pkg.pop.hidden", { count: booked })}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <PickSelect label={t("pkg.clinic")} value={d.clinic} options={CLINICS} onChange={(v) => edit((x) => { x.clinic = v; })} />
              <PickSelect label={t("pkg.doctor")} value={d.doctor} options={DOCTORS} onChange={(v) => edit((x) => { x.doctor = v; })} />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={close}>{t("pkg.pop.cancel")}</Button>
            <Button variant="primary" className="bg-success text-success-foreground" isDisabled={!chosen.length} onPress={confirmPkgBook}>
              {t("pkg.pop.go", { count: chosen.length })}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

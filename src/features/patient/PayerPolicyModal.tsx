import { Button, Modal } from "@heroui/react";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { fmt } from "../../domain/money";
import { hisDate, policyOf } from "../../domain/policy";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";

/* The profile's "Payer Policy" pop-up (v4 only): the payer's policy as the HIS holds it, read-only.
   Changing the payer stays with the separate "Change" button on the profile. */
export function PayerPolicyModal() {
  const { t } = useTranslation();
  const w = useW();
  const { policyPop: d, set } = useUi();
  const payer = d ? w.patients[d.mrn]?.payers.find((x) => x.id === d.payerId) : undefined;
  const pol = payer ? policyOf(payer) : null;
  if (!d || !payer || !pol) return null;
  const close = () => set({ policyPop: null });
  const yn = (b: boolean) => t(b ? "tob.yes" : "tob.no");
  const dash = t("tob.dash");
  const num = (n: number | null) => (n == null ? dash : String(n));

  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog aria-label={t("policy.title")} data-testid="policy-pop" className="sm:max-w-3xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t("policy.title")}</Modal.Heading>
            <p className="text-sm text-muted">{payer.label}</p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-default/50 p-3 sm:grid-cols-4">
              <Head k={t("policy.group")} v={pol.groupName} />
              <Head k={t("policy.contract")} v={pol.contract || dash} />
              <Head k={t("policy.contact")} v={pol.contactPerson || dash} />
              <Head k={t("policy.expiry")} v={pol.contractExpiry ? hisDate(pol.contractExpiry) : dash} />
            </dl>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field k={t("policy.description")} v={pol.description} />
              <Field k={t("policy.descriptionAr")} v={<span lang="ar">{pol.descriptionAr || dash}</span>} />
              <Field k={t("policy.validFrom")} v={pol.validFrom ? hisDate(pol.validFrom) : dash} />
              <Field k={t("policy.validTo")} v={pol.validTo ? hisDate(pol.validTo) : dash} />
              <Field k={t("policy.approvalRequired")} v={yn(pol.approvalRequired)} />
              <Field k={t("policy.approvalValidDays")} v={num(pol.approvalValidDays)} />
              <div className="flex flex-col gap-1.5">
                <Field k={t("policy.hospitalLimit")} v={pol.hospitalVisitLimit == null ? dash : fmt(pol.hospitalVisitLimit)} />
                <Flag on={pol.includeMedicine} label={t("policy.includeMedicine")} />
                <Flag on={pol.excludeConsultation} label={t("policy.excludeConsultation")} />
              </div>
              <Field k={t("policy.pharmacyLimit")} v={pol.pharmacyVisitLimit == null ? dash : fmt(pol.pharmacyVisitLimit)} />
              <Field k={t("policy.followUpDays")} v={num(pol.followUpDays)} />
              <Field k={t("policy.extendedFollowUpDays")} v={num(pol.extendedFollowUpDays)} />
            </div>

            <section className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-bold text-accent">{t("policy.cchi")}</h3>
              <span className="text-sm">{pol.cchiPolicy || dash}</span>
            </section>

            <section className="grid grid-cols-2 gap-3 rounded-xl bg-default/50 p-3 sm:grid-cols-4">
              <Field k={t("policy.deductible")} v={yn(pol.deductible)} />
              <Field k={t("policy.deductibleType")} v={pol.deductibleType} />
              <Field k={t("policy.shareType")} v={pol.shareType} />
              <Field k={t("policy.visitCap")} v={fmt(pol.visitCap)} />
              <Field k={t("policy.outpatientShare")} v={t("tob.pct", { pct: pol.outpatientShare })} testId="policy-op-share" />
              <Field k={t("policy.inpatientShare")} v={t("tob.pct", { pct: pol.inpatientShare })} />
              <Field k={t("policy.pharmacyShare")} v={t("tob.pct", { pct: pol.pharmacyShare })} />
              <Field k={t("policy.discount")} v={t("tob.pct", { pct: pol.discountPct })} />
              <Field k={t("policy.taxable")} v={yn(pol.taxable)} />
              <Field k={t("policy.taxPct")} v={t("tob.pct", { pct: pol.taxPct })} />
              <Field k={t("policy.interCompany")} v={pol.interCompanyHospital || dash} />
              <div className="flex items-end pb-2"><Flag on={pol.active} label={t("policy.active")} /></div>
            </section>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={close}>{t("policy.close")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Head({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
      <dd className="truncate text-sm font-bold text-accent" title={v}><bdi>{v}</bdi></dd>
    </div>
  );
}

function Field({ k, v, testId }: { k: string; v: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-muted">{k}</span>
      <span className="min-h-9 truncate rounded-lg border border-border bg-default/60 px-2.5 py-1.5 text-sm tabular-nums" data-testid={testId}><bdi>{v}</bdi></span>
    </div>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" data-on={on}>
      <span className={`flex size-4 items-center justify-center rounded border ${on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-default/60"}`} aria-hidden>
        {on ? <Check className="size-3" /> : <Minus className="size-3 opacity-40" />}
      </span>
      {label}
      <span className="sr-only">{on ? t("tob.yes") : t("tob.no")}</span>
    </span>
  );
}

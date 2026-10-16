import { Button, ButtonGroup } from "@heroui/react";
import { ChevronDown, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmt } from "../domain/money";
import { policyOf } from "../domain/policy";
import type { Payer } from "../domain/types";
import { useUi } from "../store/ui";

/* The payer, as a split button: the payer itself opens its policy (PayerPolicyModal); the attached arrow changes it.
   Used on the profile and on the visit. `onChange` null = the payer is fixed here (shown with a lock). */
export function PayerButton({ mrn, payer, onChange, changeLabel, lockedLabel, testId }: {
  mrn: string; payer: Payer; onChange: (() => void) | null; changeLabel: string; lockedLabel?: string; testId: string;
}) {
  const { t } = useTranslation();
  const set = useUi((s) => s.set);
  const plan = payer.plan;
  const hasPolicy = !!policyOf(payer);
  return (
    <ButtonGroup variant="outline" className="h-auto">
      <Button aria-label={t("patient.policyTitle", { payer: payer.label })} isDisabled={!hasPolicy}
        className="h-auto bg-surface px-3 py-1.5 disabled:opacity-100" onPress={() => set({ policyPop: { mrn, payerId: payer.id } })}>
        <span className="text-end leading-tight" data-testid={testId}>
          <b className="block text-sm text-accent">{payer.label}</b>
          <span className="text-[11px] text-muted">
            {plan
              ? t("patient.planLine", { ded: Math.round(plan.deductiblePct * 100), cap: fmt(Math.min(plan.visitCap, plan.annualLeft)) }) +
                (plan.discountPct ? t("patient.planDiscount", { pct: Math.round(plan.discountPct * 100) }) : "")
              : t("patient.noPolicy")}
          </span>
        </span>
      </Button>
      {onChange ? (
        <Button isIconOnly aria-label={changeLabel} className="h-auto self-stretch bg-surface" onPress={onChange} data-testid={`${testId}-change`}>
          <ButtonGroup.Separator />
          <ChevronDown className="size-4" />
        </Button>
      ) : (
        <Button isIconOnly isDisabled aria-label={lockedLabel} className="h-auto self-stretch bg-surface disabled:opacity-100">
          <ButtonGroup.Separator />
          <Lock className="size-4 text-muted" />
        </Button>
      )}
    </ButtonGroup>
  );
}

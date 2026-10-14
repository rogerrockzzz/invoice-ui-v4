import { Button } from "@heroui/react";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ADV_CATS } from "../domain/constants";
import { creditTotal } from "../domain/lines";
import { fmt } from "../domain/money";
import { useW } from "../store/hooks";
import { useUi } from "../store/ui";

/* v3 walletChipHtml() (line 4159): the one place advance and credit balances show in a header */
export function WalletChip({ mrn }: { mrn: string }) {
  const { t } = useTranslation();
  const w = useW();
  const open = useUi((s) => s.walletOpen);
  const set = useUi((s) => s.set);
  const wal = w.patients[mrn]!.wallet;
  const adv = ADV_CATS.reduce((a, k) => a + wal.advance[k], 0);
  const credit = creditTotal(w, mrn);
  return (
    <Button
      variant="outline"
      className={`h-auto gap-3 rounded-full px-4 py-1.5 ${credit > 0 ? "border-danger/40" : ""}`}
      aria-expanded={open}
      aria-label={t("wallet.open")}
      onPress={() => set({ walletOpen: !open })}
      data-testid="wallet-chip"
    >
      <Wallet className="size-5 text-vida-red" />
      <span className="text-start leading-tight">
        <small className="block text-[10px] font-semibold uppercase tracking-wide text-muted">{t("wallet.advance")}</small>
        <b className="tabular-nums" data-testid="wallet-advance">{fmt(adv)}</b>
      </span>
      <span className="text-start leading-tight">
        <small className={`block text-[10px] font-semibold uppercase tracking-wide ${credit > 0 ? "text-danger" : "text-muted"}`}>{t("wallet.credit")}</small>
        <b className={`tabular-nums ${credit > 0 ? "text-danger" : ""}`} data-testid="wallet-credit">{fmt(credit)}</b>
      </span>
      {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
    </Button>
  );
}

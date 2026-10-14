import { CreditCard, FlaskConical, Package, Plus, ReceiptText, Replace, ShieldCheck, Undo2, Wallet, type LucideProps } from "lucide-react";
import { STORIES, type StoryId } from "../domain/stories";

/* v3's story emoji, as lucide icons */
const ICONS = { receipt: ReceiptText, flask: FlaskConical, package: Package, replace: Replace, card: CreditCard, shield: ShieldCheck, plus: Plus, wallet: Wallet, undo: Undo2 };
export function StoryIcon({ id, ...p }: { id: StoryId } & LucideProps) {
  const Icon = ICONS[STORIES[id].icon];
  return <Icon aria-hidden {...p} />;
}

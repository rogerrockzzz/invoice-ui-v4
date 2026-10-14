import { toast } from "@heroui/react";

/* v3 toast(kind, title, sub): "ok" | "warn" | "" (info). Newest on top, at most three, gone after ~4.2 s. */
export type ToastKind = "ok" | "warn" | "";
export function notify(kind: ToastKind, title: string, sub?: string) {
  const opts = { description: sub || undefined, timeout: 4200 };
  if (kind === "ok") return toast.success(title, opts);
  if (kind === "warn") return toast.warning(title, opts);
  return toast.info(title, opts);
}

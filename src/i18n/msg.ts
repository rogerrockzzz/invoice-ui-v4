import type { TFunction } from "i18next";
import type { Msg } from "../domain/types";

const isMsg = (v: unknown): v is Msg => !!v && typeof v === "object" && "k" in (v as object);

/* A Msg's params may themselves be Msgs (translated first) or "" for an absent part of the sentence. */
export function resolveMsg(t: TFunction, msg: Msg | string | null | undefined): string {
  if (msg == null) return "";
  if (typeof msg === "string") return msg;
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(msg.p || {})) p[k] = isMsg(v) ? resolveMsg(t, v) : v;
  return t(msg.k, p) as string;
}

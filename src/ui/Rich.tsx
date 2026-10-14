import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Msg } from "../domain/types";
import { resolveMsg } from "../i18n/msg";

/* v3 texts carry light markup: <b>…</b> for emphasis and <inv>…</inv> for an invoice number.
   They are parsed into React nodes here — nothing is ever injected as HTML. */
const TAG = /<(b|inv)>([\s\S]*?)<\/\1>/g;

export function rich(text: string, renderInvoice?: (id: string) => ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index! > last) out.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    const inner = m[2]!;
    out.push(
      m[1] === "b" ? <strong key={i++} className="font-semibold">{inner}</strong>
        : <Fragment key={i++}>{renderInvoice ? renderInvoice(inner) : inner}</Fragment>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={i}>{text.slice(last)}</Fragment>);
  return out;
}

/* A translated message (key + params, params may nest), rendered with its light markup */
export function M({ msg, renderInvoice }: { msg: Msg | string | null | undefined; renderInvoice?: (id: string) => ReactNode }) {
  const { t } = useTranslation();
  return <>{rich(resolveMsg(t, msg), renderInvoice)}</>;
}

/* A translation key with its light markup */
export function T({ k, p }: { k: string; p?: Msg["p"] }) {
  return <M msg={{ k, p }} />;
}

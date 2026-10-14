import { Button, Card, Checkbox, Chip, Disclosure, TextArea } from "@heroui/react";
import { AlertTriangle, ChevronDown, ChevronRight, CircleCheck, Info, MessageSquare, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { storyOfEvent } from "../../domain/stories";
import type { HistoryEvent, Visit } from "../../domain/types";
import { togglePin } from "../../store/actions";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";
import { invLink } from "../../ui/InvoiceLink";
import { M } from "../../ui/Rich";

const plain = (s: string) => s.replace(/<[^>]+>/g, "");
/* any invoice number in the line becomes its own link to the preview */
const linkInvoices = (s: string) => s.replace(/((?:INV|RFD)-\d+)/g, "<inv>$1</inv>");
const ICON = { i: Info, w: AlertTriangle, c: MessageSquare } as Record<string, typeof Info>;
const ICON_TONE: Record<string, string> = { i: "bg-accent/15 text-accent", w: "bg-warning/15 text-warning", c: "bg-default text-muted", "": "bg-success/15 text-success" };

/* v3 renderHistory() (line 4363): what has happened on this visit, newest first */
export function VisitTimeline({ c }: { c: Visit }) {
  const { t } = useTranslation();
  const { histOpen, comment, set } = useUi();
  const act = useWorld((s) => s.act);
  const addComment = useWorld((s) => s.addComment);
  const last = c.history[0];
  const draft = comment && comment.cid === c.id ? comment : null;
  const pinned = c.history.map((h, i) => ({ h, i })).filter((x) => x.h.type === "COMMENT" && x.h.important);
  const pin = (i: number) => act(c.id, (w, dc, fx) => togglePin(w, dc, i, fx));
  const save = () => {
    if (!draft || !draft.text.trim()) return;
    addComment(c.id, draft.text, draft.important);
    set({ comment: null });
  };

  return (
    <Card className="gap-0 p-0" data-testid="timeline">
      <Disclosure isExpanded={histOpen} onExpandedChange={(v) => set({ histOpen: v })}>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-4 py-3 text-start">
            <h2 className="text-xs font-bold uppercase tracking-wider text-vida-navy">{t("timeline.title")}</h2>
            {pinned.length > 0 && <Chip size="sm" variant="soft" color="warning"><Pin className="size-3" /> {t("timeline.important", { count: pinned.length })}</Chip>}
            <span className="ms-auto text-xs text-muted">
              {histOpen ? t("timeline.hint") : `${t("timeline.events", { count: c.history.length })}${last ? t("timeline.last", { tx: plain(last.tx), at: last.at }) : ""}`}
            </span>
            <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <div className="flex flex-col gap-2 px-4 pb-4">
            {/* the way in to a comment sits where the reading starts */}
            {!draft ? (
              <Button variant="outline" className="justify-start text-muted" onPress={() => set({ comment: { cid: c.id, text: "", important: false } })}>
                <MessageSquare className="size-4" /> {t("timeline.leave")}
              </Button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <TextArea
                  autoFocus
                  aria-label={t("timeline.commentLabel")}
                  rows={2}
                  placeholder={t("timeline.commentLabel")}
                  value={draft.text}
                  onChange={(e) => set({ comment: { ...draft, text: e.target.value } })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Checkbox isSelected={draft.important} onChange={(v) => set({ comment: { ...draft, important: v } })}>
                    <Checkbox.Content>
                      <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                      {t("timeline.markImportant")}
                    </Checkbox.Content>
                  </Checkbox>
                  <div className="flex-1" />
                  <Button size="sm" variant="secondary" onPress={() => set({ comment: null })}>{t("timeline.cancel")}</Button>
                  <Button size="sm" variant="primary" isDisabled={!draft.text.trim()} onPress={save}>{t("timeline.save")}</Button>
                </div>
              </div>
            )}

            {/* important comments stay on top, whatever happens after them */}
            {pinned.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3" data-testid="pinned">
                <div className="mb-1 flex items-center gap-1 text-xs font-bold text-warning"><Pin className="size-3" /> {t("timeline.importantHead")}</div>
                {pinned.map(({ h, i }) => (
                  <div key={i} className="flex items-start gap-2 py-1 text-sm">
                    <div className="flex-1">{h.tx}<div className="text-xs text-muted">{h.by} · {h.at}</div></div>
                    <Button size="sm" variant="ghost" onPress={() => pin(i)}>{t("timeline.unpin")}</Button>
                  </div>
                ))}
              </div>
            )}

            {!c.history.length && <p className="text-sm text-muted">{t("timeline.empty")}</p>}
            <ol className="flex flex-col divide-y divide-border" aria-label={t("timeline.title")}>
              {c.history.map((h, i) => <EventRow key={`${c.history.length - i}`} h={h} i={i} c={c} onPin={() => pin(i)} />)}
            </ol>
          </div>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

function EventRow({ h, i, c, onPin }: { h: HistoryEvent; i: number; c: Visit; onPin: () => void }) {
  const { t } = useTranslation();
  const set = useUi((s) => s.set);
  const Icon = ICON[h.ic] || CircleCheck;
  const tone = ICON_TONE[h.ic] ?? ICON_TONE[""];
  if (h.type === "COMMENT")
    return (
      <li className={`flex items-start gap-3 py-2 ${h.important ? "bg-warning/5" : ""}`} data-testid="event">
        <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="size-3.5" /></span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="whitespace-pre-wrap">{h.tx}</div>
          <div className="text-xs text-muted">{h.by}{h.important ? t("timeline.markedImportant") : ""}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Chip size="sm" variant="soft">{t(h.important ? "timeline.importantChip" : "timeline.comment")}</Chip>{h.at}
          <Button size="sm" variant="ghost" onPress={onPin}>{h.important ? t("timeline.unpin") : <><Pin className="size-3" /> {t("timeline.pin")}</>}</Button>
        </div>
      </li>
    );
  const story = storyOfEvent(h);
  const open = () => set({ eventPop: { caseId: c.id, i } });
  return (
    <li className="flex cursor-pointer items-start gap-3 py-2 hover:bg-default/40" data-testid="event" onClick={open}>
      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="size-3.5" /></span>
      <div className="min-w-0 flex-1 text-sm" onClick={(e) => { if ((e.target as HTMLElement).closest("a,[role=link]")) e.stopPropagation(); }}>
        <div><M msg={h.tx} /></div>
        {h.sub && <div className="text-xs text-muted"><M msg={linkInvoices(h.sub)} renderInvoice={invLink} /></div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
        <Chip size="sm" variant="soft">{t(`story.${story}.title`)}</Chip>
        <span className="tabular-nums">{h.at}</span>
        <Button size="sm" variant="ghost" aria-label={t("timeline.detailOf", { tx: plain(h.tx) })} onPress={open}>
          {t("timeline.detail")} <ChevronRight className="size-3 rtl:rotate-180" />
        </Button>
      </div>
    </li>
  );
}

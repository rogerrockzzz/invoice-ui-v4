# Devin Invoice UI — working notes

## Files
- `journey-opd-v3.html` — **active** prototype (all new changes go here).
- `journey-opd-v2.html` — frozen snapshot of the flow before the technical-team review. Do not edit.
- `billing-ui-revamp-mockup-v4.html`, `journey-opd-v1.html` — older prototypes, untouched.
- `_smoke_journey3.html` — test suite for v3 (loads `journey-opd-v3.html` in an iframe).
- `_smoke_journey2.html` — test suite for the frozen v2.
- `_shot_*.html` — throwaway screenshot drivers.

## Serve
```
cd "/home/roger/Documents/Roger_BK/Devin Invoice UI" && python3 -m http.server 8765 --bind 127.0.0.1
```
The server dies on reboot; restart it if pages give ERR_CONNECTION_REFUSED.

## Test
```
timeout 90 google-chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=15000 \
  --dump-dom "http://127.0.0.1:8765/_smoke_journey3.html"
```
Read the `<pre id="out">` block; first line is `### RESULT: ALL N CHECKS PASSED ###`.
A result of just `…` means the test script has a syntax error.

## Stories (v3)
- A visit is a set of stories defined in `STORIES` (fixed stages + events). `visitStories(c)` decides
  which appear; `storyStage(c,id)` maps state to a stage; `renderStoryCard(c)` draws the active one.
- Invoicing steps carry billing actions only — refund, replace, package booking and credit settlement
  live in their own stories. Tests switch with the `story(id)` helper.

## Editing tips
- When cutting a function out by text, end the cut at an exact unique marker, then diff the
  function list against v2 — a loose `"\n/* "` marker once swallowed `renderHistory`.
- When batch-editing with a Python script, collect failed replacements and still write the
  file, then report the failures — never raise before the write (lost edits twice this way).
- Click step buttons by label in tests, not by index; button order changes often.

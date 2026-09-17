# 04 — The passport is a constant, the address is written late

Source: report §2.8 and §7 step 4. Depends on: 02 (only after a click costs tens of milliseconds do these
4 ms become a visible share). Low risk. State: **done** (2026-09-17) — what it is in code, what was measured
and how the acceptance answered are at the end of this file.

## What is wrong today

`appWrite()` runs on every click and does three things:

1. `appPassport()` — FNV-1a over the tool's name, the data schema, the artifact's path, the title and 263
   column labels. It is a constant of the report: it depends on nothing the reader can change.
2. `localStorage.setItem` — must stay immediate: it is what survives a closing.
3. `history.replaceState` — rewrites the address with the whole choice, which is where the `#size-report=…`
   link comes from.

Measured: 4.0 ms per click, of which the serialisation of the record twice (`appRecord()` is built twice
today — once for the memory and once for the address) and the passport are the parts that repeat.

## What to build

- **`appPassport()` memoised** in the page's state chapter: computed once per document. It is a constant of
  the report, so a second computation is a second answer waiting to happen.
- **One record per click, two destinations.** Build `appRecord()` once and hand the same object to the
  memory and to the address.
- **The address is debounced by 150–300 ms** — a reader who clicks five switches gets one `replaceState`,
  and the browser is spared the history and the URL parse that follow it. `localStorage` stays immediate.
  A debounce timer that fires after unload writes nothing useful, so the delay is short and the memory
  write already happened.

## Acceptance

- A click that changes nothing else writes the address once per burst, not once per click (measured in
  jsdom by counting `history.replaceState` calls).
- The link is still the reader's whole choice after the burst (read the address back and apply it).
- The record in the memory is written on the very click (a page reload after a click keeps the choice).
- `test/page-choice.test.js` and `test/page-view.test.js` green; `pnpm run verify:fast` green.

## What it is in code

- `src/page/state.js` — the passport is counted once per document (`appPassportValue` guards it), one `JSON.stringify`
  per click serves both destinations, and the address is written by `appAddressLater` after `APP_ADDRESS_DELAY` (200 ms,
  inside the 150–300 the step allowed) while the memory is written on the click itself. `appAddressDrop` cancels a write
  that has not been made yet.
- `src/page/app.js` — the `hashchange` handler drops the pending write **before** it reads the address that came in: an
  address from outside wins over one this page was still holding. A refusal arms nothing to replace it, so without the
  drop the choice left behind would land on someone else's address a fifth of a second later.
- `tools/page-harness.js` — `ADDRESS_DELAY` is read out of the chapter that sets it and `settled(dom)` waits it out, so
  the checks that read the address do not carry a copy of the number.
- `eslint.config.js` — the page's shared names gain the three switches the panel calls (`appSwitch`, `appSwitchGroup`,
  `appSwitchMetric`): step 02 left four `no-undef` warnings behind, and the tree is expected to yield zero findings.

## Acceptance answered

- **A burst of switches is one write** ✓ — a new check counts `history.replaceState`: three clicks give 0 calls while the
  burst lasts and exactly 1 after the delay; a later burst is one write again.
- **The link is the whole choice** ✓ — the record in the address is compared with the record in the memory
  (byte for byte), and a page opened from the address shows the same set of columns and the same total.
- **The memory is written on the click** ✓ — read immediately after a click and a visit opened from what is stored comes
  back with the same choice.
- **An address that arrives during the delay wins** ✓ — the reader’s own armed write must not land on it; this is the
  check the risk section asked for, and it is what made the `appAddressDrop` call necessary (without it the check is red:
  the address kept the reader’s previous choice instead of the link that had just been applied).
- **`test/page-choice.test.js` and `test/page-view.test.js` green; `pnpm run verify:fast` green** ✓ — 76 checks of 181,
  and `pnpm run verify` through its 8 steps.
- **The passport’s value did not move** ✓ — the checks that two reports do not see each other’s choice, that a record
  with a foreign passport is ignored and that the record’s key names the passport all stay green; what the passport now
  saves is its own recounting (measured below).

## What was measured (2026-09-17)

Chrome, the artifact of this repository (the same file both sides: the page program of the artifact at HEAD against the one
rebuilt from this tree), `appWrite` and `appRecord` called directly, plus real clicks:

| | before | after |
|---|---:|---:|
| `appRecord()`, 50 calls | 0.062 ms | 0.014 ms |
| `appWrite()`, 20 calls | 2.88 ms | 0.095 ms |
| `history.replaceState` calls from those 20 writes | 20 (immediately) | 0 during, 1 after the delay |
| a burst of 5 real clicks | 5 writes, 9 134 ms (the table was rebuilt per click) | 0 writes during, 1 after; 23 ms |
| `localStorage.setItem` of the record (1 223 B) | 0.010 ms | 0.010 ms — it stays on the click |
| `history.replaceState` of the same record | 2.335 ms | 2.335 ms — once per burst now, not per click |

Read honestly: of the ~2.9 ms a click spent in the write, **2.34 ms was the address call itself** and it is now off the
click path and once per burst; the memory write that has to stay costs 0.010 ms; the passport’s memoisation is worth
0.05 ms per call (real, but the smallest of the three). The plan’s "4.0 ms per click" came from jsdom, where every DOM and
browser call is dearer; in Chrome the same work is 2.9 ms, and the conclusion — which part to move — is the same.

Watched by hand on the artifact: on a click the memory already names the file the reader switched off while the address is
still the old one; ~300 ms later the address carries the click and is byte-equal to the memory record.

## Risks

- **A link copied in the first 150 ms after a click** could carry the previous choice. Tried as the risk section asked —
  and it is not the copy that catches the page, it is an address that *arrives* during the delay: a write armed by the
  reader’s click would land on the link that had just been applied (a refused link arms nothing of its own, so nothing
  replaces it). The fix is the drop, not a zero delay; the check that shows it is in `test/page-choice.test.js`.
- **The passport’s key** is what ties a record to a report, so memoising it must not change its value: the existing checks
  (two reports do not see each other’s choice; a foreign passport is ignored; the record’s key names the passport) stay
  green, and the passport is counted once — from the same data, so it cannot drift.

## Second pass: the sensor, the two guards, the numbers (2026-09-17)

The step’s first pass left one sensor red: the burst check had grown to 40 statements and the metrics sensor stopped it
(`max-statements`, limit 30). It was fixed where it was wrong — the check was split in two and the shared
`countingPage()` helper now carries the counter — not by raising the limit.

What the two checks catch, shown by probes rather than asserted:

- `the address is written once per burst, the memory on the click` — a write that lands during the burst, or a burst that
  is not one write, reddens it (removing the drop inside `appAddressLater` does exactly that).
- `a link: an address that arrives during the delay wins over the pending write` — a stale record written after a link
  arrived reddens it («задержанная запись читателя легла поверх присланной ссылки»), which is the step’s named risk. It is
  not the check that catches a missing `appAddressDrop` in the `hashchange` handler on its own: the paint that applies the
  link re-arms a write of the applied record, so the address ends up right anyway. The refused address is what the drop is
  needed for, and that is the existing check in `a link: a change of address on an open page is applied too` — it reddens
  with the drop removed and names the pending write.
- The rebuild guard the step has to keep working: putting `appPanel()` back into the write path reddens 14 checks across
  the three page suites — the node count on a metric switch («переключение «метрика» создало 100 узлов (предел 0)»), the
  panel’s identity («панель собрана заново: список файлов стал другим узлом»), the focus, the scroll of the list, the
  drift guard of the panel’s fields and the totals the address carries.
- **The rebuild inside the *deferred* write was not caught by anything** — the page suite watches a click up to its end,
  so it never saw what the timer does 200 ms later (24 of 24 checks stayed green with the probe). The guard added for it is
  `the write of the address, once it comes, builds nothing` in `test/page-choice.test.js`: after the click the counter of
  appended nodes is zeroed, the delay is waited out, and the panel, its list and tree and the table’s rows and cells are
  required to be the very same objects. Probes: rebuilding the panel in the timer → «отложенная запись адреса создала 100
  узлов: разметку пересобирает таймер»; rebuilding the table in the timer → «…создала 537 узлов» plus the wrong columns
  from the checks that read the table afterwards.

Chrome, this repository’s artifact built twice from the same tree (once as it is, once with the step’s three mechanisms
undone in the write chapter), `file://`, so the compared pages differ in this step alone:

| | before | after |
|---|---:|---:|
| `appPassport()`, 200 calls | 0.0435 ms | 0.002 ms |
| `appRecord()`, 50 calls | 0.038 ms | 0.016 ms |
| `appWrite()`, 20 calls | 2.095 ms | 0.05 ms |
| `history.replaceState` from those calls | 21, at once | 0 during, 1 after the delay |
| one `history.replaceState` measured alone | 2.23 ms | 2.41 ms (the same call, now once per burst) |
| a burst of 5 real clicks, warmed page | 41.5 / 41.3 / 49.5 ms, 5 writes | 14.1 / 15.2 / 26.8 ms, 0 writes during and 1 after |
| the same burst on a cold page (first interaction after load) | 278 ms | 40 ms |

By hand on the artifact: on the click the memory already names the file just switched off (241) while the address still
carries the previous choice (240); a fifth of a second later the address carries 241 and its record is byte-equal to the
memory’s. The cold-burst pair is quoted for completeness only — a first interaction after load pays for work that has
nothing to do with this step, so the conclusion rests on the warm bursts.

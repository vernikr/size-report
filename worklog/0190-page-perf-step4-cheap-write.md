# 0190 — step 4: the passport once, the address once per burst

Requested: step 04 of `plans/2026-09-17-page-perf/` exactly by its acceptance criteria and risk
section, keeping in mind that since steps 02–03 a click writes nodes in place and the panel has a drift
guard — which must catch it if the state writing starts rebuilding again. Nothing committed, step 05 not
started.

## What changed

- `src/page/state.js` — the passport is counted once per document (it is a constant of the report, and a
  second count would be a second answer); one `JSON.stringify` per click serves both destinations; the
  address is written 200 ms after the last switch (`APP_ADDRESS_DELAY`), the memory on the click itself.
- `src/page/app.js` — the `hashchange` handler drops a write the page was still holding before it reads
  the address that came in: an address from outside wins, and a refused link arms nothing to replace the
  pending write (this is the fix the step's risk section names).
- `tools/page-harness.js` — `ADDRESS_DELAY` is read from the chapter that sets it, `settled(dom)` waits
  it out — the checks that read the address do not carry a copy of the number.
- `eslint.config.js` — the page's shared names gain the three switches the panel calls; step 02 had left
  four `no-undef` warnings, and the tree is expected to yield zero findings (`eslint .` is silent again).

## Measured (2026-09-17, Chrome, this repository's artifact — “before” is the page program of the artifact
at HEAD, so these numbers carry steps 01–03 as well; the isolated pair is in the second pass below)

| | before | after |
|---|---:|---:|
| `appRecord()`, 50 calls | 0.062 ms | 0.014 ms |
| `appWrite()`, 20 calls | 2.88 ms | 0.095 ms |
| `replaceState` calls from those 20 writes | 20, immediately | 0 during, 1 after the delay |
| a burst of 5 real clicks | 5 writes, 9 134 ms | 0 during, 1 after; 23 ms |
| `localStorage.setItem` of the 1 223 B record | 0.010 ms | 0.010 ms (stays on the click) |
| `history.replaceState` of the same record | 2.335 ms | 2.335 ms, once per burst now |

So of the ~2.9 ms a click spent in the write, 2.34 ms was the address call and it is off the click path;
the memory write costs 0.010 ms and must stay; the passport's memoisation is worth 0.05 ms per call. The
plan's “4.0 ms per click” was a jsdom number; in Chrome the same work is 2.9 ms and the conclusion is the
same. Watched by hand: on a click the memory names the switched-off file while the address is still the
old one; ~300 ms later the address carries the click and is byte-equal to the memory record.

## Checks

One check added (`test/page-choice.test.js`): the address is written once per burst — three clicks give 0
calls during the burst and 1 after the delay, a later burst one write again and it carries the newest
choice; the record in the address is compared with the record in the memory byte for byte and a page
opened from it shows the same columns and total; the memory is read immediately after the click, and a
visit from what is stored comes back with the same choice. The existing link checks now wait the delay out
(`settled`), and the “change of address on an open page” check asserts the refused address survives the
moment a pending write would have taken — which is where the check went red before `appAddressDrop`.

Probes rather than assumptions: taking `appDirsOf` out of `appPanelState` reddens the drift guard and
names the folder; putting `appPanel()` back into `appWrite` (a rebuild inside the write) reddens five
checks — the append count on a metric switch says «создало 100 узлов (предел 0)», the panel's identity and
the focus go with it, and the drift guard notices that the fields it read are no longer the panel's. Both
probes were reverted.

`verify:fast` green (5 steps, 75 checks of 180), `pnpm run verify` green (8 steps). The artifact grew by
2 043 B (1 440 325 → 1 442 368) — the two helpers and their comments.

## Second pass: the sensor, the two guards, the numbers

The first pass left one sensor red: the burst check had grown to 40 statements and the metrics sensor
stopped it (`max-statements`, limit 30). Fixed where it was wrong — the check is split into two and the
shared `countingPage()` helper carries the counter; no threshold, no baseline. `test/page-choice.test.js`
now has 8 checks, hence 75 of 180 in the documentation (the two numbers in `README.md` moved with it).

What the two checks catch, probed rather than assumed:

- removing the drop inside `appAddressLater` reddens the burst check (a burst stops being one write);
- removing the drop in the `hashchange` handler does **not** redden the new check — the paint that applies
  an incoming link re-arms a write of the applied record, so the address ends up right anyway. What that
  drop is needed for is the *refused* address, and the check that reddens without it (naming the pending
  write) was already there: `a link: a change of address on an open page is applied too`. The new check
  reddens with its own message («задержанная запись читателя легла поверх присланной ссылки») only when
  neither drop is present — it guards the outcome, not the drop alone, and says so;
- putting `appPanel()` back into the write path reddens five checks: the node count on a metric switch
  («создало 100 узлов (предел 0)»), the panel's identity, the panel's focus, the scroll of the list and the
  drift guard that compares every folder and category field with the leaves below it. Probes reverted.

Chrome, the artifact built twice from the same tree — as it stands, and with the step's three mechanisms
undone in the write chapter — so the two pages differ in this step alone:

| | before | after |
|---|---:|---:|
| `appPassport()`, 200 calls | 0.0435 ms | 0.002 ms |
| `appRecord()`, 50 calls | 0.038 ms | 0.016 ms |
| `appWrite()`, 20 calls | 2.095 ms | 0.05 ms |
| `replaceState` from those calls | 21, at once | 0 during, 1 after the delay |
| `replaceState` measured alone | 2.23 ms | 2.41 ms (once per burst now) |
| a warmed burst of 5 real clicks | 41.5 / 41.3 / 49.5 ms, 5 writes | 14.1 / 15.2 / 26.8 ms, 0 during, 1 after |
| the same burst cold (first interaction after load) | 278 ms | 40 ms |

By hand: on the click the memory already names the file just switched off (241) while the address still
carries the old choice (240); 260 ms later the address carries 241 and its record is byte-equal to the
memory's. The cold pair is quoted only for completeness — the first interaction after load pays for things
this step did not change — so the conclusion rests on the warmed bursts.

## Third pass: the guard over the deferred write

The requirement that the state write must not be able to rebuild the page was only half covered: the page suite watches
a click up to its end, so a rebuild that happens 200 ms later, in the timer that writes the address, was caught by
nothing — all 24 checks stayed green with `appPanel()` planted in that timer.

The guard added is one check, `the write of the address, once it comes, builds nothing` (`test/page-choice.test.js`): the
append counter is zeroed after the click, the delay is waited out, and the panel, its list and tree plus the table's rows
and cells are required to be the very same objects.

| probe (reverted, sources byte-identical afterwards) | what went red |
|---|---|
| `appPanel()` inside the write path of a click | 14 checks: «переключение «метрика» создало 100 узлов (предел 0)», «панель собрана заново: список файлов стал другим узлом», the focus, the list's scroll, the drift guard of the panel's fields |
| `appPanel()` inside the timer | the new check: «отложенная запись адреса создала 100 узлов: разметку пересобирает таймер» |
| `appTable(...)` inside the timer | the new check: «…создала 537 узлов», plus «ссылка несёт не тот набор колонок» in the checks that read the table afterwards |

`verify:fast` green (5 steps, 76 checks of 181), `pnpm run verify` green (8 steps); the artifact is byte-identical
(`docs/size-report.html` rebuilt by `--write`, md5 `cc06caae0ee94751cbcccfcb65318d50`).

Left open: step 05 (the sparse model) — and the release, which stays the user's decision.

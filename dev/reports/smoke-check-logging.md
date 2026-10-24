# Risk-based smoke + `[LIES-CHECK]` logging (2026-10-24)

Two short runs, not the full backlog. Focus is what changed since the last
working build and what can actually break gameplay.

## Why only two runs

Since the last tested build (`75914d2`), these runtime changes landed:

- `4d0b358`: phalanx announcement/endless only when `_spawn_in_group` returns
  a group; `[LIES-CHECK]` phalanx logs added.
- `9dec81a`: H-03 (unused 6th spawn-search argument dropped), H-04 (`max_dis`
  filter), H-05 (dead recon sweep deleted).
- Current logging build: `[LIES-CHECK]` events only.

H-03 has no live effect (no caller passes that argument), H-04 has no live
effect (all callers pass `nil`), H-05 removed uncalled code. So the only new
runtime risk is phalanx. The older pending items are covered by one normal
loud run.

## Run 1 — normal loud, one shield+bag map

Suggested: Bank Heist: Gold, Death Wish or above. Five to ten minutes.

1. Trigger the alarm and fight normally for 3–5 minutes.
2. Let a shield approach and reposition at least once.
3. Secure one bag.
4. If a taser shows up, let it attempt a charge from the same floor.

What should appear in `mods\logs\` (in addition to prior LIES lines):

| Log line | Meaning | Player check |
|---|---|---|
| `[LIES-CHECK] tweak setup complete hhtacs=... phalanx_respawn=...` | HHTACS setup finished; respawn key readable | No setup error; hhtacs state matches menu |
| `[LIES-CHECK] suppression deny unit=...` | Suppression gate rejected an assignment | Cops under fire stay in cover instead of teleporting to a new assignment |
| `[LIES-CHECK] shield reservation set unit=...` or `shield reservation fallback` | 248.2 reservation split ran | Shields advance/reposition without freezing or `LEAKING POS RESERVATION` |
| `[LIES-CHECK] bag steal SO registered ...` | Bag steal objective registered | Cops can pick up/secure a bag; no broken objective |
| `[LIES-CHECK] taser charge allowed vertical=...` or `blocked vertical=...` | Taser vertical gate ran | Taser does not tase through floors; same-floor charge still works |
| `[LIES-CHECK] marshal marksman attack=CopLogicAttack` | LIES marshal mapping loaded | Only meaningful on a marshal heist |
| `[LIES-CHECK] door watch raw position used` | AI-01 raw-door branch reached | Optional; cops pre-aim at doorways |

Absence of shield/taser/bag lines is not a failure if that unit or bag did not
appear. Send the log either way; we check the events that did occur.

## Run 2 — hhtacs phalanx, DW+

Enable Hyper Taktikz, load any loud heist, trigger an assault, and wait for the
phalanx VIP.

Expected sequence:

1. `[LIES-CHECK] phalanx spawn group type=Phalanx ...`
2. `[LIES-CHECK] phalanx group created units=0` (units spawn on later AI ticks)
3. `[LIES-CHECK] phalanx spawned units=3` (or more)
4. `[LIES-CHECK] phalanx buff enabled value=...`
5. `[LIES-CHECK] phalanx buff increased value=...` over time
6. `[LIES-CHECK] phalanx buff disabled` after the VIP dies/leaves

Player checks: announcement, VIP visibly present, damage-reduction icon
appears and clears. If the announcement plays but no spawned line appears,
`phalanx pending after 15s units=...` tells us the group was queued but units
were rejected; send that log.

## Deliberately skipped

- **Marshal behaviour:** only test if the chosen heist naturally has marshal
  marksmen. The load-time mapping line proves the LIES mapping; stuck-marksman
  risk only exists on marshal heists.
- **H-01 holdout/skirmish:** only if you play a holdout. The setup line reports
  `skirmish_groups=true/false`; no `_LIES_setup` error is the main check.
- **H-03/H-04/H-05:** no live behaviour; covered by static gates and source
  regression tests.
- **Nav/Nav-B and level-change:** passed on the prior build; no nav code changed.
- **H-09 area bookkeeping:** subtle force-accounting only; not worth a dedicated
  run.
- **AI-02 nav-link crash:** phalanx Run 2 covers the reachable route.

## Results — 2026-10-24, build `70ec89f`

Two games, one log (`2026_10_24_log.txt`). Counts from `[LIES-CHECK]`:

| Check | Evidence | Result |
|---|---|---|
| HHTACS setup | `tweak setup complete` x2; `hhtacs=true`; respawn `1200` / `300000` | Pass (difficulty-dependent key behaved as expected) |
| Suppression gate | `suppression deny` x128 across normal cops/SWAT/FBI/sniper | Pass; no crash or stuck-assignment symptom reported |
| Shield reservation | `shield reservation set` x53; `fallback` x4 | Pass; both branches exercised |
| Bag steal SO | `registered` x12; `deferred` x13; `skipped: enemy loot drop area` x5 | Pass; registration and expected skip paths exercised |
| Taser vertical gate | `allowed` x14; `blocked` x7 (1000/830/400 units) | Pass; same-floor allowed, cross-floor blocked |
| Phalanx | `spawn group` x1; `group created` x1; `spawned units=11` x1; `pending` x0; `buff enabled` x1; `buff disabled` x1; `buff increased` x0 | Pass for spawn/buff lifecycle; no increase because the VIP died before the 15 s tick |
| Raw-door aim | `door watch raw position used` x2 | Pass (branch reached) |
| Marshal | load-time mapping x2 | Mapping confirmed; marksman behaviour not exercised |

No new `crash.txt` timestamp (still 2026-10-23 17:35). Only BeardLib
`ModAssetsModule.lua:156 attempt to compare number with nil` appears; no LIES
error, no `LEAKING POS RESERVATION`, no `FATAL ERROR`.

Partial/unverified: marshal marksman movement (no marshal heist), holdout
skirmish (`skirmish_groups=false` in both loads; guard prevented a crash, but
holdout was not played), and phalanx buff increase (VIP died too quickly).
These are not regressions from this build.

## New audit-fix events (build after `8e7ec60`)

These prove the Group AI/periphery fixes actually executed:

| Log line | Meaning |
|---|---|
| `[LIES-CHECK] hrt tactic active group=...` | HRT branch reached on a hostage heist |
| `[LIES-CHECK] sabotage tactic active group=...` | Drill-sabotage branch reached |
| `[LIES-CHECK] recon path truncated before unsafe seg=...` | Recon re-target truncation ran without nil-index |
| `[LIES-CHECK] hostage task drained` | Hostage timer stopped instead of re-arming forever |
| `[LIES-CHECK] retreat announcement expired group=...` | Retreat retry hit its 3 s bound |
| `[LIES-CHECK] camera LOS reveal camera=...` / `camera LOS blocked camera=...` | Camera raycast actually allowed/blocked a reveal |
| `[LIES-CHECK] team AI hold blocked walk unit=...` | Bot hold-position guard restored |
| `[LIES-CHECK] civilian follow target unavailable ...` | Civilian follow fallback hit instead of nil-index |
| `[LIES-CHECK] drill sabotage skipped: no nav tracker ...` | Drill tracker guard hit |
| `[LIES-CHECK] mission obstacle list initialized element=...` | PAL obstacle init guard ran |
| `[LIES-CHECK] difficulty on_executed cleared element=...` | Pent 101606 removal path ran |

Missing lines mean the corresponding event did not occur; they are not failures by
themselves. Send the log after one normal loud run, plus HRT/drill if they occur
naturally.

## Log collection

Send the newest `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\*.txt`.
Useful filters: `[LIES-CHECK]`, `[LIES-TEST] ERROR`, `FATAL ERROR`, `attempt to`,
`LEAKING POS RESERVATION`.

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
| `door_raw` watch counter (producer `lies_upd_expected_pos`) | The aim pass took a raw door position as the watch position; surfaced in the digest as `dw_raw_hit`, priced by `dw_ray` | Cops pre-aim at a doorway in the target's segment; `dw_raw_hit > 0` in one digest is the proof |

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
| Raw-door aim | `door_raw` counter (producer restored in V8.79: `lies_upd_expected_pos`); observed as `dw_raw_hit` in the digest. Not yet observed in game | Pending — no V8.79 test play yet |
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

## Door-watch logging (V8.79)

The restore is only claimable from a log, so a door-watch test play needs
`watch_log`:

- `"watch_log": true` in `mods\saves\LittleIntelligenceEnhancementS.txt` (game
  closed) — required. Without it there is no header and no digest.
- `"debug_log": true` — optional, for the `[LIES-CHECK]` detail lines.
- `trace` is on by default and produces the breadcrumbs below.

What the new lines prove, not yet observed in game:

| Line / field | Meaning | What it proves |
|---|---|---|
| `[LIES-WATCH] … evt=header … door_watch=true highperformance=false` | Settings snapshot at heist start (`tostring(boolean)`: `true`/`false`, not the menu's `on`/`off`; the report tool normalises both) | The feature was armed; with `highperformance=true` the same header must be paired with all calls in `dw_gate_off` |
| `[LIES-WATCH] … evt=door_watch_first src=raw\|expected seg=… u=… tweak=…` | One line per session, the first derived watch position and its source | The probe reached a real position and which branch produced it |
| `[LIES-TRACE] … phase=door_watch … src=… seg=… dis=… cached=… height=…` | Breadcrumb for a derived (not cached) position, one per unit per 2.5 s | Which branch ran for which unit, and whether the height gate let it through (`height=1`) |
| `[LIES-TRACE] … phase=watch_aim … src=… door_seg=… my_seg=… dis=… dot=… verified=… nearly=… react=…` | Adoption breadcrumb: a cop turned its attention to a watch position, one per unit per 1 s. `src=raw`/`src=expected` is a position derived on that pass, `src=cached` one the helper returned from its cache. `dot` is the flat facing dot at that moment (1 = already facing the doorway, 0 = looking at a wall, negative = a turn past 90°), or `n/a` when a flattened vector had no length and no facing could be measured (such a sample is not averaged in); `my_seg` the cop's own nav segment | A cop adopted a doorway position **while the target was unseen** (`verified=0 nearly=0`), and how far off its facing it was. `verified=1` / `nearly=1` means it adopted one while it could see the enemy, which cannot help the feature — the digest separates those as `watch_aim_verified` |
| `[LIES-WATCH] … evt=alarm name=door_outcome_gap …` | A call returned without exactly one outcome | Accounting bug, not a gameplay result |
| `[LIES-WATCH] … evt=alarm name=door_contract_violation …` | A non-`Vector3` door position reached a caller | `find_segment_doors` contract break |

Digest groups in `[LIES-WATCH] … evt=digest` (per-minute deltas):

| Group | Fields | What it proves |
|---|---|---|
| outcome set | `dw_call`, `dw_gate_off`, `dw_stale_bail`, `dw_outer_gate_skip`, `dw_no_my_tracker`, `dw_hit`, `dw_none`, `dw_gap` | Every call landed in exactly one of the six outcomes; `dw_gap` must be 0. `dw_stale_bail > 0` is the enemy-tracker guard working, `dw_no_my_tracker > 0` the cop's own tracker being absent |
| branch detail | `dw_cadence_skip`, `dw_advancing_skip`, `dw_cached_reuse`, `dw_cached_unsighted`, `dw_height_skip`, `dw_seg_same`, `dw_path_prestep`, `dw_path_prestep_hit`, `dw_raw_hit`, `dw_expected_pos_hit`, `dw_vanilla_call`, `dw_path_kick`, `dw_ray` | Which path ran: raw door hit, expected-position fallback, cadence/height skips, and whether the cached position survived its re-test. `dw_cached_reuse` means the 0.2/1.5 s window had not elapsed and the saved position was reused as-is (no re-test, no probe on that call). `dw_cadence_skip` is the window-closed arm; `dw_advancing_skip` is implied by it at the only call site (the helper is reached only while running), so it adds no information on its own. `dw_path_prestep` counts armed coarse paths, i.e. an attempt, not a produced position; `dw_path_prestep_hit` counts the positions that pre-step did produce (it runs only inside the window and only when nothing is saved). `dw_ray` is the door-ray count |
| cost | `dw_us`, `dw_us_max` | Average and high-water time of the armed path (`os.clock`, ~1 ms granularity — read as an average) |
| watch adoption | `watch_aim_adopted`, `watch_aim_cached`, `watch_aim_verified`, `watch_aim_dot` | The watch position actually became a cop's attention target (`watch_aim_adopted`, fresh or cached), the cached subset (`watch_aim_cached`), the subset adopted while the enemy was visible (`watch_aim_verified` — an adoption the cop could already see cannot help), and the mean flat facing dot at adoption (`watch_aim_dot`; a per-window mean, so the session figure is weighted by each window's adoptions). Adoption gates on the cop reaching `_upd_aim` while running and not aiming, so zero adoptions means **no adoption of a watch position was counted** for that run — a cop in `travel` may simply never have entered the pass. A pre-V8.85 log has no `watch_aim_*` field at all, which is a different thing from a counted zero |
| `find_segment_doors` | `fsd_call_2arg`, `fsd_call_center`, `fsd_no_from_seg`, `fsd_neighbour_missing`, `fsd_disabled`, `fsd_raw`, `fsd_door_dead`, `fsd_door_obstructed`, `fsd_nil_element`, `fsd_nil_position`, `fsd_nil_tracker`, `fsd_nil_end_pos`, `fsd_navlink_seg_ok`, `fsd_navlink_seg_mismatch`, `fsd_tracker_created`, `fsd_tracker_destroyed`, `fsd_bad_shape` | Why the door list shrank, whether nav-link doors were included (`fsd_navlink_seg_ok`), and that the `Vector3` contract held (`fsd_bad_shape=0`). A map with no nav-link doors legitimately shows 0 |
| reaction | `react_hold`, `react_allow`, `react_level` | The V8.78 `enemy_reaction_level` delay actually held (or did not) frames |
| near-visible probe | `near_vis_probe`, `near_vis_h_max` | The V8.80 merge is live: the vertical fallback probe ran (`near_vis_probe` counts it, so it is 0 on a play with no covered targets) and `near_vis_h_max` is the tallest probe height the window saw — ≈ 100 at contact range, not the pre-merge 30. A value stuck at 30 would be the pre-merge fixed probe; 0 with `near_vis_probe > 0` would be a broken gauge. `LIES:Gauge` keeps only the window **maximum**, so the taper to ≈ 10 near 2000 units is not observable in the digest: one contact-range probe pins the value near 100, and ≈ 10 only appears on a play whose covered targets were all far away |

Read a play with:

```powershell
node dev\tools\door-watch-report.mjs "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_02_log.txt" `
  --ab "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_03_log.txt" `
  --out dev\reports\door-watch-run-a.md --json dev\reports\door-watch-run-a.json
```

Exit 0 = PASS, 1 = FAIL, 2 = INCOMPLETE (no header, or the header shows the
feature disarmed), 3 = usage error (unknown flag, unreadable log). Claim ->
counter mapping and the run procedure:
`dev/reports/door-watch-port.md` §5-§6.

## Log collection

Send the newest `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\*.txt`.
Useful filters: `[LIES-CHECK]`, `[LIES-TEST] ERROR`, `FATAL ERROR`, `attempt to`,
`LEAKING POS RESERVATION`.

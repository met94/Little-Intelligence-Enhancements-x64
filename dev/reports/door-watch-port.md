# Door watching restored in `_upd_aim` (V8.79)

Investigation report for the V8.79 door-watch restore. Status: code, tests and
static gates are green; **not yet observed in game** — §6 is the procedure that
produces the evidence, and `dev/tools/door-watch-report.mjs` is the reader that
adjudicates it.

- **Blocks:** `dev/reports/aim-port-behaviour-ledger.md` #1 (cached-tracker aim
  path), #2 (door probing), #4 (expected-position machinery).
- **Pre-port body:** `git show bbb30fa^:lua/coplogics/coplogicattack.lua`.
- **Target:** game 248.2 (`e3a8b616`), LIES `feat/ai-suite-compat`.
- **Mod Lua edited:** yes — `lua/coplogics/coplogicattack.lua`,
  `lua/managers/navigationmanager.lua`, `menumanager.lua` (restore + counters).

## 1. What was restored, and why

V8.75 (`bbb30fa`) replaced `CopLogicAttack._upd_aim` with the 248.2 vanilla
body. That was the fix for the 2026-10-31 freed-nav-tracker crash
(`dev/reports/aim-stale-nav-tracker-crash.md`), but the replacement body took
three author behaviours with it, because they lived inline in `_upd_aim`:

1. **Block #1, cached watch position.** The last good `my_data.expected_pos`
   was re-tested with an `ai_vision` raycast on a 0.2 s / 1.5 s cadence (0.2 s
   for `data.important` units), and dropped when the line was broken.
2. **Block #2, door probing.** When the target sat in a different nav segment,
   the enemy segment's doors were fetched and each door position (raised by
   140 units) was raycast; the first visible one became the watch position.
3. **Block #4, expected-position machinery.** `_get_expected_pos`, its
   `my_data.expected_pos*` state and the coaching of vanilla's coarse path.
   The pre-port body also read an armed `expected_pos_path` before issuing a
   new search, so the watch position came from a path the cop already had.

Why it matters in play: vanilla's `_get_expected_attention_position` watches
the door on the *path* to the target, filtered by `_chk_is_right_segment`, i.e.
mostly the door the cop is walking through. The author's layer watches the
doors of the segment the *target* is in, including animated nav-link doors
that vanilla's raw-position branch skips (`handoff-2026-11-01.md` §8). That is
the "cops never predict a target through a doorway" behaviour the port lost.

Block #3 (lateral `find_walls_across_pos` sight search) was **not** restored:
it writes `focus_enemy.last_verified_*` from the movement-driven pass, and
those fields are read by the boss throwable, travel and idle code. It stays
`RETIRE` in the ledger, recorded there as deferred future work under the same
door-watch umbrella.

## 2. Provenance

| Commit | Date | Author | What it added |
|---|---|---|---|
| `46a93f2` | 2025-10-22 | fugsystem (8.49 cycle) | The door loop, the cached-position cadence, `_get_expected_pos` and its call sites inside `_upd_aim` |
| `78dab8a` | 2026-10-23 | met94 | AI-01/AI-02: `_upd_aim` handles raw `Vector3` doors; `find_segment_doors`' default branch returns raw `nav_link_end_pos()`, `center_only` keeps tables. Removes the vanilla phalanx `mvec3_set` type-error route |
| `4a80b5f` | 2026-10-26 | met94 | The `door_raw` watch counter |
| `bbb30fa` | V8.75 | fork | Ported `_upd_aim` to the vanilla 248.2 body; blocks #1/#2/#4 stopped running |
| `a9bfba0` | 2026-11-01 | this work | `find_segment_doors` returns early instead of indexing a nil nav-link tracker (`fsd_nil_tracker`), and guards `fsd_bad_shape` |
| `0edc8bc` | 2026-11-01 | this work | The `door_watch` setting (default on) and its menu toggle; honoured only while High Performance Mode is off |
| `e389d5e` | 2026-11-01 | this work | The restore itself: `lies_upd_expected_pos` helper, per-branch counters, watch-channel fields |
| `189a053` | 2026-11-01 | this work | Reachability fix (the probe was gated on `not advancing`, which is always false at the call site, so every door counter was dead), tracker check before the feature gate, author's `expected_pos_path` pre-step, same-segment skip, timing |
| release commit | V8.79 | this work | `dev/tools/door-watch-report.mjs`, these docs, release metadata |

## 3. Shape of the restore

`lies_upd_expected_pos(data, my_data, time_since_verification)` is a local
helper in `lua/coplogics/coplogicattack.lua`, placed after `lies_enemy_tracker`
and before `CopLogicAttack.enter`. `_upd_aim` calls it from the REACT_AIM
`if not aim` arm, so the call site is unchanged; the `reaction < REACT_AIM`
arm still calls vanilla directly.

Order inside the helper, and why:

1. `dw_call` — before any work, so the denominator counts every entry.
2. Tracker liveness (`lies_enemy_tracker`). A stale attention object returns
   `nil` here → `dw_stale_bail` and no vanilla call. This runs **before** the
   feature gate because vanilla `_get_expected_attention_position`
   (`248.2:1508/1516`) dereferences `attention_obj.nav_tracker` unguarded: with
   the feature off, handing it a freed tracker is exactly the V8.68 crash.
3. Feature gate `door_watch and not highperformance` → `dw_gate_off`, then
   vanilla.
4. Author's outer gate (target not `lost_track`, or same segment) →
   `dw_outer_gate_skip`, then vanilla.
5. `expected_pos_path` pre-step → `dw_path_prestep`; a returned position is
   `src=expected`.
6. Cached re-test (visible → dropped; invisible → `dw_cached_unsighted`),
   gated on `not advancing`.
7. Probe, cadence only: height gate, `find_segment_doors(enemy_seg)`, per-door
   ray at `door.z + 140` (`dw_ray`), first visible → `dw_raw_hit` + `door_raw`,
   `src=raw`.
8. Cross-segment fallback to `_get_expected_pos` when neither tracker reports
   `obstructed()` → `dw_expected_pos_hit`, `src=expected`.
9. Outcome: `dw_hit` (position found, cached or derived) or `dw_none` plus the
   vanilla call and `dw_vanilla_call`.

The five outcomes are disjoint by construction, so
`menumanager.lua` can compute `dw_gap = dw_call - (gate_off + stale_bail +
outer_gate_skip + hit + none)` and alarm `door_outcome_gap` on any non-zero
window.

### Why a layer and not a method override

`BossLogicAttack:694` calls the vanilla `CopLogicAttack._upd_aim`, and the
overridden method is already LIES' own ported body. Restoring the watch as a
call target inside that body keeps every caller (attack family, team-AI
assault, bosses) on one path, and keeps `highperformance`/`door_watch` a
per-call decision instead of a code-branch substitution. Recorded in
`dev/reports/port-decisions.md`.

## 4. Deliberate deviations from the pre-port body

1. **Tracker-free height gate.** The pre-port door gate read
   `managers.navigation._nav_segments[enemy_nav_seg].pos`. At 248.2 the table is
   keyed by **string** (`_load_nav_data` does `tostring(nav_seg.id)`), the field
   is private, and the value was derived from the enemy tracker. The restore
   uses `focus_enemy.m_pos.z` (the attention object's last known position),
   falling back to the cop's own `data.m_pos.z`, and keeps the author's
   conditions: coprime Z at or above the target, or within 250 units, or target
   distance ≥ 2000. No nav segment table, no engine pointer, same intent.
2. **Same segment delegates to vanilla.** `my_seg == enemy_seg` now increments
   `dw_seg_same` and lets vanilla handle it (`m_pos + 140`), instead of running
   `_get_expected_pos`, whose `search_coarse` requires
   `i_to_seg ~= i_from_seg` and can therefore never produce a position for a
   self-to-self search. Pre-port paid a search per cadence window for nothing.
3. **2-arg `find_segment_doors`.** The helper calls
   `nav:find_segment_doors(enemy_seg)` with no `approve_clbk` and no
   `center_only`, so nav-link doors arrive as raw `Vector3`
   `nav_link_end_pos()` values (AI-02 shape) and the `if door.x` test in the
   probe accepts them. The `center_only` table shape stays for the vanilla and
   phalanx callers that still ask for it.
4. **Tracker check before the gate.** A safety term the pre-port body did not
   need (it ran only inside the logic update). See §3 step 2.
5. **Probe is not gated on `advancing`.** Only the cached re-test is. The
   pre-port body gated both, but the only caller context reaches `if not aim`
   while `my_data.advancing` is true, so the shared gate made the probe
   unreachable — the bug `189a053` fixed.

Everything else — the 0.2/1.5 s cadence, the `+140` door offset, the
`expected_pos_path` pre-step, the obstructed-tracker condition on the fallback
— is the pre-port expression.

## 5. Claim → evidence

Every design claim has one counter, digest field or log line that can refute
it. The report tool turns this table into PASS/FAIL
(`dev/tools/door-watch-report.mjs`).

| Claim | Evidence | A FAIL means |
|---|---|---|
| the mod loaded | `Setting up mod 'LIES'` | not installed, or the loader aborted |
| the right build ran | `[LIES-WATCH] evt=header version=…`, `[LIES-TRACE] v=…` | the log is from another build; counters cannot be compared |
| the feature was armed | header `door_watch=on highperformance=off` | the run proved nothing about the feature |
| the probe produced a position | digest `dw_raw_hit + dw_expected_pos_hit + dw_path_prestep > 0`; `[LIES-WATCH] evt=door_watch_first src=… seg=…`; `[LIES-TRACE] phase=door_watch src=raw\|expected` | no run reached the door branch: bad map, no cross-segment loss of sight, or a regression |
| the gate is honest | with `highperformance=on` or `door_watch=off`: `dw_gate_off == dw_call` and every sub-event 0 | the feature ran while disabled |
| outcome accounting | `dw_gap` summed over digests == 0 | a call returned without an outcome: a `return` path lost its counter |
| tracker safety | `dw_stale_bail` (informational) plus 0 FATAL / 0 LIES Lua errors | a freed tracker reached engine code |
| nav-link doors are handled | `fsd_navlink_seg_ok`, `fsd_navlink_seg_mismatch`, `fsd_nil_element`, `fsd_nil_tracker` (INFO only) | — (a map without nav-link doors shows 0) |
| door positions are `Vector3` | `fsd_bad_shape == 0` | a non-`Vector3` was handed to `mvec3_set`/distance |
| cost is bounded | `dw_us` average, `dw_us_max`, `dw_ray` per minute | — (INFO; compare with `--ab`) |
| reaction level still works | header/digest `react_level` + `react_hold`/`react_allow`, `[LIES-EVENT] kind=reaction_hold level=…` | the delay is inert or firing when it should not |
| no door alarm | no `evt=alarm name=door_outcome_gap` / `door_contract_violation` | a gap or a contract failure happened in play |
| the session survived | 0 FATAL, 0 LIES-attributable Lua errors | crash class regression |

Watch digest fields that back the table, by group:

- `dw_call`, `dw_gate_off`, `dw_stale_bail`, `dw_outer_gate_skip`, `dw_hit`,
  `dw_none`, `dw_gap` — the outcome set.
- `dw_cadence_skip`, `dw_advancing_skip`, `dw_cached_reuse`,
  `dw_cached_unsighted`, `dw_height_skip`, `dw_seg_same`, `dw_path_prestep`,
  `dw_raw_hit`, `dw_expected_pos_hit`, `dw_vanilla_call`, `dw_path_kick`,
  `dw_ray` — sub-events; they explain the outcome, they never replace it.
- `dw_us`, `dw_us_max` — timing (average of per-window averages, high-water
  max).
- `fsd_call_2arg`, `fsd_call_center`, `fsd_no_from_seg`,
  `fsd_neighbour_missing`, `fsd_disabled`, `fsd_raw`, `fsd_door_dead`,
  `fsd_door_obstructed`, `fsd_nil_element`, `fsd_nil_position`,
  `fsd_nil_tracker`, `fsd_nil_end_pos`, `fsd_navlink_seg_ok`,
  `fsd_navlink_seg_mismatch`, `fsd_tracker_created`, `fsd_tracker_destroyed`,
  `fsd_bad_shape` — why the door list shrank, and the `Vector3` contract.
- `react_hold`, `react_allow`, `react_level` — the V8.78 delay.

`fsd_tracker_created` / `fsd_tracker_destroyed` are incremented in the same
unconditional block, so a balance check would be zero by construction; the
leak invariant is the harness test
`dev/test-harness/test/find_segment_doors.lua`.

## 6. Test-play procedure

Nothing below has been run in game yet.

Settings (game closed), `mods\saves\LittleIntelligenceEnhancementS.txt`:

- `"watch_log": true` — **required**; without it there is no header and the
  digest, and the report verdict is `INCOMPLETE`.
- `"debug_log": true` — optional; gives the per-event `[LIES-CHECK]` lines
  (`door_raw`, nav guards).
- `"trace": true` — on by default; gives `[LIES-TRACE] phase=door_watch`.

Run A — armed. `door_watch` on, High Performance Mode off, `enemy_reaction_level`
at 1 (SLOW) so the reaction counters are exercised too. Bank-style heist with
doorways and nav-links (Bank Heist: Gold or similar), loud, 8–10 minutes:

1. Fight from the street side, then break line of sight and move through a
   different segment: cops should watch a doorway you are *not* walking through.
2. Use at least one door whose far side is another nav segment, and one
   animated nav-link door (vault/laser-cage style).
3. Let cops lose and re-acquire you at least once, so the 0.2/1.5 s cadence
   runs both the visible and the invisible re-test.

Run B — gate. Same map, High Performance Mode **on**. Every `dw_call` must land
in `dw_gate_off`; the report expects `gate respected` PASS and
`watch positions produced` INFO.

Run C — control (`--ab` only). `door_watch` off, otherwise identical to Run A,
same duration. The cost claim prints this log's `dw_us`/`dw_ray` next to Run A.

Then:

```powershell
node dev\tools\door-watch-report.mjs "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_02_log.txt" `
  --ab "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_03_log.txt" `
  --out dev\reports\door-watch-run-a.md --json dev\reports\door-watch-run-a.json
```

Exit code 0 is PASS, 1 is FAIL, 2 is INCOMPLETE (the message names the setting
to enable). The markdown/JSON are the artifacts to attach to the next session.

## 7. Open questions

1. **Frequency and cost of the armed-path pre-step.** `dw_path_prestep` counts
   calls where `my_data.expected_pos_path` was already set, and
   `CopLogicAttack._get_expected_pos` on that path can reach an engine coarse
   search. `dw_us`/`dw_us_max` price it but cannot separate it from
   `find_segment_doors`; `dw_path_prestep / dw_call` per window is the number to
   watch on a populated map. Not measured in game.
2. **Should `dw_cached_reuse` be split from pre-step frames?** In practice the
   counter fires on every cadence window where the cached re-test did not run,
   which includes both "the cop is advancing with a saved position" and "there
   was no saved position, so the probe below runs instead"; a pre-step frame
   with a saved position takes the re-test branch and increments neither. It is
   therefore not a count of reuses, and it does not isolate pre-step work. The
   likely split is `dw_cached_held` (advancing, saved position kept) vs
   `dw_no_position` (the probe path), and the report's `positions` sum already
   counts `dw_path_prestep`, so the split would not change the verdict. Deferred
   until a real log shows the ratio matters.
3. **Does vanilla's same-segment `+140` actually look through a doorway?** The
   restore deliberately delegates that case; only a log with
   `dw_seg_same > 0` and no `dw_raw_hit` on those units can tell whether the
   delegation loses the author's intent.
4. **Nav-link door volume.** `fsd_navlink_seg_ok` vs `fsd_raw` says how often
   the LIES door list contains doors vanilla would skip; if the ratio is
   ~0 the restore's extra value is only the cross-segment watch position.
5. **Per-door tracker churn.** `find_segment_doors` creates and destroys one
   nav tracker per nav-link door per call (`fsd_tracker_created`). Accepted by
   the author in a ~1.5 s cadence path; precomputing door segments per nav
   build is the obvious optimisation if `--ab` shows real cost.

## 8. Player POV

Cops that have lost sight of you now keep aiming at the doorway you are about
to come through, not only the one they happen to be walking through — so
stepping into a room can meet a cop who is already on the door instead of one
still turning. Nothing changes when High Performance Mode is on, and nothing
changes on a map without nav-link doors.

## 9. Decision & artifacts

**Decision.** Restore ledger blocks #1/#2/#4 as a LIES layer around the vanilla
`_get_expected_attention_position`, gated by `door_watch and not
highperformance`, with the five deviations in §4. Retire block #3 (lateral
sight search) and record it as deferred under this umbrella. The tracker
liveness gate stays ahead of everything, so the crash fix from V8.75 is not
reopened.

**Artifacts.**

- `a9bfba0` — `find_segment_doors` guards (`fsd_nil_tracker`, `fsd_bad_shape`)
  plus the harness test for the tracker balance.
- `0edc8bc` — `door_watch` setting and menu toggle.
- `e389d5e` — the restore, `lies_upd_expected_pos`, `dw_*`/`fsd_*`/`react_*`
  digest fields, `[LIES-TRACE] phase=door_watch`.
- `189a053` — reachability and tracker-safety fix; `dw_gap` alarm delta
  snapshot when the digest is off.
- V8.79 release commit — `dev/tools/door-watch-report.mjs`,
  `dev/tools/test/door-watch-report.test.mjs`, this report, ledger/status/
  decisions/smoke-check/menu docs, release metadata.
- Tests: `dev/tools/test/door-watch.test.mjs` (source pins),
  `dev/test-harness/test/find_segment_doors.lua` (tracker balance, raw
  `Vector3` contract, nav-link segment filter),
  `dev/tools/test/door-watch-report.test.mjs` (every claim, both verdicts).

**Not verified.** No in-game play; nothing in §5 is observed yet. The report
tool is validated against synthetic logs only. Perf numbers, nav-link door
volume, the same-segment delegation and the `dw_cached_reuse` split are all
open (§7). The user deploys; this worktree contains no game install.

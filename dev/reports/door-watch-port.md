# Door watching restored in `_upd_aim` (8.57.23)

Investigation report for the 8.57.23 door-watch restore. Status: code, tests and
static gates are green, and the armed and gated paths **were observed in game on
2026-11-01** (level `auc`, deployed `8.57.23`). §6 is the procedure that
produced the evidence, `dev/tools/door-watch-report.mjs` is the reader that
adjudicates it, and §10 records what the two runs showed.

- **Blocks:** `dev/reports/aim-port-behaviour-ledger.md` #1 (cached-tracker aim
  path), #2 (door probing), #4 (expected-position machinery).
- **Pre-port body:** `git show bbb30fa^:lua/coplogics/coplogicattack.lua`.
- **Target:** game 248.2 (`e3a8b616`), LIES `feat/ai-suite-compat`.
- **Mod Lua edited:** yes — `lua/coplogics/coplogicattack.lua`,
  `lua/managers/navigationmanager.lua`, `menumanager.lua` (restore + counters).

## 1. What was restored, and why

8.57.19 (`bbb30fa`) replaced `CopLogicAttack._upd_aim` with the 248.2 vanilla
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
| `bbb30fa` | 8.57.19 | fork | Ported `_upd_aim` to the vanilla 248.2 body; blocks #1/#2/#4 stopped running |
| `a9bfba0` | 2026-11-01 | this work | `find_segment_doors` returns early instead of indexing a nil nav-link tracker (`fsd_nil_tracker`), and guards `fsd_bad_shape` |
| `0edc8bc` | 2026-11-01 | this work | The `door_watch` setting (default on) and its menu toggle; honoured only while High Performance Mode is off |
| `e389d5e` | 2026-11-01 | this work | The restore itself: `lies_upd_expected_pos` helper, per-branch counters, watch-channel fields |
| `189a053` | 2026-11-01 | this work | Reachability fix: the cached re-test was gated on `not advancing` (copied from the pre-port body at `bbb30fa^:1213`, unreachable here because the only call site runs while advancing, so the watch position was never refreshed or cleared); the probe itself was never gated on advancing. Plus tracker check before the feature gate, author's `expected_pos_path` pre-step, same-segment skip, timing |
| `10fa632` | 2026-11-01 | this work | 8.57.23 release commit: `dev/tools/door-watch-report.mjs` and its tests, these docs, release metadata. Follow-up in the same unreleased revision: cadence made real (re-test on the window, no `advancing` gate), cop-tracker guard (`dw_no_my_tracker`, six outcomes), timing sampled once per armed call, `door.x`/`end_pos.x` nil tests, in-code version `8.57.23` pinned by `compat.test.mjs`, report tool reads `true`/`false` headers and treats a disarmed run as INCOMPLETE |

## 3. Shape of the restore

`lies_upd_expected_pos(data, my_data, time_since_verification)` is a local
helper in `lua/coplogics/coplogicattack.lua`, placed after `lies_enemy_tracker`
and before `CopLogicAttack.enter`. `_upd_aim` calls it from the REACT_AIM
`if not aim` arm, so the call site is unchanged; the `reaction < REACT_AIM`
arm still calls vanilla directly.

Order inside the helper, and why:

1. `dw_call` — before any work, so the denominator counts every entry.
2. Enemy tracker liveness (`lies_enemy_tracker`). A stale attention object
   returns `nil` here → `dw_stale_bail` and no vanilla call. This runs **before**
   the feature gate because vanilla `_get_expected_attention_position`
   (`248.2:1508/1516`) dereferences `attention_obj.nav_tracker` unguarded: with
   the feature off, handing it a freed tracker is exactly the 8.57.12 crash.
3. Feature gate `door_watch and not highperformance` → `dw_gate_off`, then
   vanilla.
4. The cop's own tracker (`data.unit:movement():nav_tracker()`). Vanilla
   dereferences it unguarded too, and so does this helper, so a nil is its own
   outcome: `dw_no_my_tracker`, return `nil`, no vanilla call.
5. Author's outer gate (target not `lost_track`, or same segment) →
   `dw_outer_gate_skip`, then vanilla.
6. Cadence block, entered when the 0.2 s / 1.5 s window is open:
   a. cached re-test — a blocked `ai_vision` ray clears the cache
      (`dw_cached_unsighted`), a clear ray keeps it;
   b. `expected_pos_path` pre-step, only when the re-test left no position
      (`dw_path_prestep`, and `dw_path_prestep_hit` plus `src=expected` when it
      returns one). It sits inside the window because it can reach an engine
      coarse search, `find_segment_doors` and one nav tracker per nav-link door;
   c. probe when still no position is held: height gate,
      `find_segment_doors(enemy_seg)`, per-door ray at `door.z + 140` (`dw_ray`),
      first visible → `dw_raw_hit` + `door_raw`, `src=raw`;
   d. cross-segment fallback to `_get_expected_pos` when neither tracker reports
      `obstructed()` → `dw_expected_pos_hit`, `src=expected`;
   e. `my_data.expected_pos_last_check_t = data.t`, which re-arms the window.
   With the window closed the arm counts `dw_cadence_skip` (+
   `dw_advancing_skip` while running, which is implied by the cadence skip at
   this call site) and `dw_cached_reuse` when the saved position is reused as-is.
   The pre-step cannot run there, so a window-closed `dw_cached_reuse` is always
   the cache.
7. Timing: `dw_us`/`dw_us_max` are sampled once per armed call, after the
   cadence block, so one sample prices the pre-step, the re-test ray and the
   door probe together.
8. Outcome: `dw_hit` (position found, cached or derived) or `dw_none` plus the
   vanilla call and `dw_vanilla_call`.

The six outcomes are disjoint by construction, so `menumanager.lua` can compute
`dw_gap = dw_call - (gate_off + stale_bail + outer_gate_skip + no_my_tracker +
hit + none)` and alarm `door_outcome_gap` on any non-zero window.

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
   `nav_link_end_pos()` values (AI-02 shape), and the door loop checks
   `door.x ~= nil` before `door:with_z(...)`. That nil test is explicit intent,
   **not** a behaviour fix: Lua has no falsy `0`, so `if door.x` accepts and
   rejects exactly the same doors. The `center_only` table shape stays for the
   vanilla and phalanx callers that still ask for it. The behaviour change in
   `a9bfba0` is the `fsd_bad_shape` rejection of a non-`Vector3` end position.
4. **Tracker checks before the gate.** Two safety terms the pre-port body did not
   need (it ran only inside the logic update): the enemy tracker (already in
   `189a053`) and now the cop's own tracker, which vanilla
   `_get_expected_attention_position` dereferences unguarded as well. A nil cop
   tracker is `dw_no_my_tracker` — a **sixth outcome**, so the outcome set stays
   disjoint and `dw_gap` stays meaningful. See §3 steps 2 and 4.
5. **Cadence re-test is not gated on `advancing`.** This is the deviation that
   makes the watch work at all. Pre-port, the re-test read
   `if test_for_sight and expected_pos and not my_data.advancing` (`bbb30fa^:1213`)
   while the probe read only `if not expected_pos and test_for_sight`
   (`bbb30fa^:1223`). The restore at `e389d5e` copied the re-test gate, but the
   only call site (the `if not aim` arm of the `reaction >= REACT_AIM` branch) is
   reached only while running, and running requires `my_data.advancing` — so the
   re-test never ran, `dw_cached_unsighted` never fired, the cache was never
   cleared and the cop kept aiming at the same stale doorway for the whole
   engagement. 8.57.23 keeps the author's cadence (re-test inside the same window
   as the probe, then stamp `expected_pos_last_check_t`) and drops the
   `advancing` term: a running cop now re-tests on the next window instead of
   never.
6. **The armed-path pre-step is cadence-gated.** At `e389d5e`/`189a053` the
   pre-step ran on every armed call — before the cadence block — and doing
   `_get_expected_pos` means `find_segment_doors`, one nav tracker per nav-link
   door and per-door rays. It now sits inside the window, after the cached
   re-test, and only when that re-test left no position. Two consequences are
   part of the design: the pre-step cannot discard a held position with a nil
   result (it only runs when there is nothing to discard), and
   `dw_path_prestep_hit` counts the positions it does produce. Cost per cop drops
   from per-frame to at most once per 0.2 s / 1.5 s window.
7. **`dw_path_prestep_hit` exists because the attempt counter cannot prove a
   position.** `dw_path_prestep` increments before `_get_expected_pos` runs, so
   it stays INFO in the report; the hit counter is what the `positions` claim
   reads. Without it, a healthy armed run whose watch positions all came from
   the pre-step would have FAILED the report.
8. **`_get_expected_pos` drops a dead armed path.** The door retry read
   `if not #found_doors == 0 then`, which Lua parses as
   `(not #found_doors) == 0` — always false — so an empty door list after the
   retry never cleared `my_data.expected_pos_path` and the same dead path was
   re-walked on every cadence window. It now reads `if #found_doors == 0 then`
   (drop the path, return). With the pre-step on the cadence path this is what
   makes the new per-window cost bounded instead of a repeated search for a path
   that can never yield a door.

Everything else — the 0.2/1.5 s window, the `+140` door offset, the
`expected_pos_path` pre-step body (its placement is deviation 6), the
obstructed-tracker condition on the fallback, the outer gate
`(time_since_verification and not focus_enemy.lost_track) or
my_seg == enemy_seg` (`bbb30fa^:1099`, verbatim) — is the pre-port expression.

## 5. Claim → evidence

Every design claim has one counter, digest field or log line that can refute
it. The report tool turns this table into PASS/FAIL
(`dev/tools/door-watch-report.mjs`).

| Claim | Evidence | A FAIL means |
|---|---|---|
| the mod loaded | `Setting up mod 'LIES'` | not installed, or the loader aborted |
| the right build ran | `[LIES-WATCH] evt=header version=…`, `[LIES-TRACE] v=…` | the log is from another build; counters cannot be compared |
| the feature was armed | header `door_watch=true highperformance=false` (the reader normalises `true`/`on`/`1` and `false`/`off`/`0`) | the run proved nothing about the feature, and the tool returns INCOMPLETE |
| the probe produced a position | digest `dw_raw_hit + dw_expected_pos_hit + dw_path_prestep_hit > 0`; `[LIES-WATCH] evt=door_watch_first src=… seg=…` | no run reached the door branch: bad map, no cross-segment loss of sight, or a regression. `dw_path_prestep` does **not** count here: it increments before `_get_expected_pos`, so it proves an attempt, not a position. `[LIES-TRACE] phase=door_watch src=…` is supporting evidence (it names which branch ran for which unit) and never an input to this claim — a run can pass with the trace off |
| a cop adopted the watch position | digest `watch_aim_adopted - watch_aim_verified > 0`, `watch_aim_cached`, `watch_aim_dot`, `watch_aim_dot_n`; `[LIES-TRACE] phase=watch_aim src=… dot=…` | — (INFO, never FAIL: zero counted adoptions, or every adoption made while the target was visible. The adoption dot is always off-target because the adoption starts the turn) |
| the cop's settled facing was measured | digest `watch_aim_settled_dot_n > 0` (the measured dots; its `watch_aim_settled` counterpart also counts `dot=n/a` samples), `watch_aim_settled_square`, `watch_aim_settled_dot`; `[LIES-TRACE] phase=watch_aim_settle dot=… age=…` | — (the claim is about the measurement, reported as `square=<n>/<measured> (<pct>%)`: a run where every measured settle faces away reads `0/<n> (0%)`, which is visibly not a success. INFO when no sample had a measurable facing, or a pre-8.57.30 digest without the field. A settled sample above the adoption total fails `aim accounting`, not this claim) |
| the gate is honest | with `highperformance=true` or `door_watch=false`: `dw_gate_off + dw_stale_bail + dw_no_my_tracker == dw_call` and every work counter 0; the evidence also prints the stale-bail share | the feature ran while disabled, or a call did not end in a termination |
| tracker bails | `dw_stale_bail` / `dw_call` share (INFO, printed for armed runs too) | — (an enemy dying between the attention update and the door branch trips the guard; a share near 100 % would mean it is misclassifying live trackers) |
| outcome accounting | `dw_gap` summed over digests == 0 | a call returned without an outcome: a `return` path lost its counter |
| tracker safety | `dw_stale_bail` and `dw_no_my_tracker` (informational) plus 0 FATAL / 0 LIES Lua errors | a freed or nil tracker reached engine code |
| nav-link doors are handled | `fsd_navlink_seg_ok`, `fsd_navlink_seg_mismatch`, `fsd_nil_element`, `fsd_nil_tracker` (INFO only) | — (a map without nav-link doors shows 0) |
| door positions are `Vector3` | `fsd_bad_shape == 0` | a non-`Vector3` was handed to `mvec3_set`/distance |
| cost is bounded | `dw_us` average, `dw_us_max`, `dw_ray` per minute | — (INFO; compare with `--ab`) |
| reaction level still works | header/digest `react_delay` (seconds), `react_level`, `react_hold`/`react_allow`, `react_arm`/`react_blocked`, `[LIES-EVENT] kind=reaction_hold level=…` | the delay is inert, firing when it should not, or holding passes without ever clearing a fire decision (`react_blocked == 0` on an instrumented log) |
| no door alarm | no `evt=alarm name=door_outcome_gap` / `door_contract_violation` | a gap or a contract failure happened in play |
| the session survived | 0 FATAL, 0 LIES-attributable Lua errors | crash class regression |
| the near-visible probe merge is live | digest `near_vis_probe > 0` (the vertical fallback ran) plus `near_vis_h_max` (the 8.57.24 probe height, ≈ 100 at worst case, not the pre-merge 30) | — (this claim never FAILs: PASS when the probe fired, INFO `no near-visible probe fired in these windows` when it did not, INFO `digest has no near_vis_* fields: pre-8.57.24 log` when the field is missing — a mis-wired counter cannot read as a clean play) |

Watch digest fields that back the table, by group:

- `dw_call`, `dw_gate_off`, `dw_stale_bail`, `dw_outer_gate_skip`,
  `dw_no_my_tracker`, `dw_hit`, `dw_none`, `dw_gap` — the six outcomes plus the
  denominator and the derived gap.
- `dw_cadence_skip`, `dw_advancing_skip`, `dw_cached_reuse`,
  `dw_cached_unsighted`, `dw_height_skip`, `dw_seg_same`, `dw_path_prestep`,
  `dw_path_prestep_hit`, `dw_raw_hit`, `dw_expected_pos_hit`,
  `dw_vanilla_call`, `dw_path_kick`, `dw_ray` — sub-events; they explain the
  outcome, they never replace it. `dw_cached_reuse` is the window-closed arm: a
  saved position reused as-is (the pre-step cannot run there).
  `dw_advancing_skip` is implied by `dw_cadence_skip` at the only call site.
  `dw_raw_hit`, `dw_expected_pos_hit` and `dw_path_prestep_hit` are the three
  position counters the `positions` claim sums; `dw_path_prestep` alone is the
  attempt.
- `dw_us`, `dw_us_max` — timing (average of per-window averages, high-water
  max).
- `fsd_call_2arg`, `fsd_call_center`, `fsd_no_from_seg`,
  `fsd_neighbour_missing`, `fsd_disabled`, `fsd_raw`, `fsd_door_dead`,
  `fsd_door_obstructed`, `fsd_nil_element`, `fsd_nil_position`,
  `fsd_nil_tracker`, `fsd_nil_end_pos`, `fsd_navlink_seg_ok`,
  `fsd_navlink_seg_mismatch`, `fsd_tracker_created`, `fsd_tracker_destroyed`,
  `fsd_bad_shape` — why the door list shrank, and the `Vector3` contract.
- `react_hold`, `react_allow`, `react_arm`, `react_blocked`, `react_level`, `react_delay` - the 8.57.22 delay; the first two count passes inside/outside the hold window, the next two count timer arms and the held passes that cleared a real fire decision, and `react_delay` is the hold in seconds (0 = ULTRA-VIOLENCE, authoritative from 8.57.32).
- `near_vis_probe`, `near_vis_h_max` — the 8.57.24 near-visible probe: the first is
  a per-window delta and is summed, the second is a high-water gauge and is
  aggregated as a maximum (summing it would report a height no probe used).

`fsd_tracker_created` / `fsd_tracker_destroyed` are incremented in the same
unconditional block, so a balance check would be zero by construction; the
leak invariant is the harness test
`dev/test-harness/test/find_segment_doors.lua`.

## 6. Test-play procedure

Runs A and B below were executed on 2026-11-01 (level `auc`, deployed
`8.57.23`); §10 is what they showed. Run C — the `--ab` cost control — has not
been run, so the cost figure is still one-sided. Keep the procedure as written
for the repeat: a longer armed run on the same map as its control.

Settings (game closed), `mods\saves\LittleIntelligenceEnhancementS.txt`:

- `"watch_log": true` — **required**; without it there is no header and the
  digest, and the report verdict is `INCOMPLETE`.
- `"debug_log": true` — optional; gives the per-event `[LIES-CHECK]` lines
  (`door_raw`, nav guards).
- `"trace": true` — opt-in; gives `[LIES-TRACE] phase=door_watch`.

Run A — armed. `door_watch` on, High Performance Mode off, `enemy_reaction_level`
at 1 (SLOW) so the reaction counters are exercised too. Bank-style heist with
doorways and nav-links (Bank Heist: Gold or similar), loud, 8–10 minutes:

1. Fight from the street side, then break line of sight and move through a
   different segment: cops should watch a doorway you are *not* walking through.
2. Use at least one door whose far side is another nav segment, and one
   animated nav-link door (vault/laser-cage style).

A cached position that stays visible is not counted anywhere: `dw_cached_reuse`
counts only the window-closed arm (a saved position reused as-is), and
`dw_cached_unsighted` only fires when the re-test ray is blocked. So the log
proves the re-test via `dw_cached_unsighted` (or not at all); there is no
"visible re-test" counter to look for.

Run B — gate. Same map, High Performance Mode **on**. Every `dw_call` must end
in `dw_stale_bail`, `dw_gate_off` or `dw_no_my_tracker` (the liveness guard runs
before the gate, so a run with dying enemies splits the calls between the first
two and is still correctly gated); no work counter may move. The report expects
`gate respected` PASS and the overall verdict `INCOMPLETE` (the run cannot prove
the feature by construction).

Run C — control (`--ab` only). `door_watch` off, otherwise identical to Run A,
same duration, with `watch_log` on so the control has digest windows. The cost
claim prints this log's `dw_us`/`dw_ray` next to Run A; a control without digest
windows is reported as `control unusable` instead of as deltas.

Then:

```powershell
node dev\tools\door-watch-report.mjs "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_02_log.txt" `
  --ab "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_03_log.txt" `
  --out dev\reports\door-watch-run-a.md --json dev\reports\door-watch-run-a.json
```

A SuperBLT log file can hold more than one play (the header is written at each
level load), so the report reads one **game session** at a time and the header
block names what it read:

- A session starts at each `[LIES-WATCH] evt=header`. The header also repeats
  after a level change, which the tool treats as a new session segment: a new
  level starts its own digest windows, and mixing two levels is the same
  mistake as mixing two launches. Lines before the first header are a
  pre-session segment and only feed the "mod loaded" claim.
- `--session last` (the default) reads the highest-numbered session, i.e. the
  newest launch — the armed play after a settings change, never the control
  launch that preceded it.
- `--session all` merges every session (counters summed, the last header wins)
  and says `merged N of M sessions`. Do not read a verdict out of it: an armed
  launch merged with a gated one fails the gate claim by construction.
- `--session <n>` reads the 1-based session `n`; an index outside the log is a
  usage error (exit 3).
- `--ab` applies the same selection to the control log, so both sides of the
  cost delta come from the same launch number.
- A log with no header at all (`watch_log` off) is one session holding
  everything, and the verdict stays `INCOMPLETE` with the settings hint.

Exit code 0 is PASS, 1 is FAIL, 2 is INCOMPLETE (no header, or the header shows
the feature disarmed), 3 is a usage error (unknown flag, unreadable log, session
index out of range). The markdown/JSON are the artifacts to attach to the next
session.

## 7. Open questions

1. **Frequency and cost of the armed-path pre-step.** `dw_path_prestep` counts
   cadence windows (not frames) in which `my_data.expected_pos_path` was already
   set and no saved position was held, and `CopLogicAttack._get_expected_pos` on
   that path can reach an engine coarse search. `dw_us`/`dw_us_max` price it but
   cannot separate it from `find_segment_doors`; `dw_path_prestep / dw_call` per
   window is the number to watch on a populated map, together with
   `dw_path_prestep_hit / dw_path_prestep` (how often the read actually yields a
   position). First measured in Run A (§10): 68 pre-steps out of 23 966 calls,
   4 of them returning a position — too short a run to characterise frequency on
   a populated map. `dw_path_prestep` is INFO in the report for this reason: it
   is an attempt, not a produced position.
2. **`dw_cached_reuse` is a reuse count.** It fires only in the window-closed
   arm, i.e. exactly "the 0.2/1.5 s window had not elapsed and the saved position
   was reused as-is" — after deviation 6 the pre-step cannot produce a position
   there, so no other case can reach it. It no longer fires on probe frames
   (those have no saved position by definition). The earlier worry that it
   conflated "advancing with a saved position" and "no saved position" was a
   symptom of the dead re-test, not of the counter shape. Re-open only if a real
   log shows `dw_cached_reuse` dominating `dw_call` without `dw_hit`/`dw_none`
   moving.
3. **Does vanilla's same-segment `+140` actually look through a doorway?** The
   restore deliberately delegates that case; only a log with
   `dw_seg_same > 0` and no `dw_raw_hit` on those units can tell whether the
   delegation loses the author's intent.
4. **The outer gate skips cross-segment probing while `lost_track` is set.**
   `if time_since_verification and not focus_enemy.lost_track or my_seg ==
   enemy_seg` is verbatim pre-port (`bbb30fa^:1099`), so a cop that has *lost*
   the target and stands in another segment does not probe the target's segment
   at all — exactly the case the door watch was written for. Kept because it is
   author behaviour and the review confirmed the expression is the pre-port one;
   whether it should be relaxed (e.g. `lost_track` no longer disqualifying once a
   position was ever verified) needs a play test that counts
   `dw_outer_gate_skip` against observable cop behaviour.
5. **Nav-link door volume.** `fsd_navlink_seg_ok` vs `fsd_raw` says how often
   the LIES door list contains doors vanilla would skip; if the ratio is
   ~0 the restore's extra value is only the cross-segment watch position.
   Run A: 158 nav-link doors accepted out of 5396 raw doors on `auc` (~2.9 %),
   so nav-link doors are a real but small slice of the list — one map, two
   minutes, no vanilla comparison.
6. **Per-door tracker churn.** `find_segment_doors` creates and destroys one
   nav tracker per nav-link door per call (`fsd_tracker_created`). The probe and
   the pre-step that reach it now run only inside the 0.2 s / 1.5 s cadence
   window (and the pre-step only when nothing is saved), so the churn is bounded
   by the window rather than by the frame rate; precomputing door segments per
   nav build is the obvious optimisation if `--ab` shows real cost.
7. **The watch position is rarely invalidated.** Run A saw
   `dw_cached_reuse=1733` against `dw_cached_unsighted=28`: the saved position
   was reused far more often than the re-test ray broke it.
   `dw_cached_unsighted` counts only blocked re-tests — a visible re-test is
   counted nowhere — so 28 is invalidations observed, not opportunities. Is the
   ratio right for play feel — a cop that keeps the same doorway through most of
   an engagement instead of re-picking one as the player moves? The question is
   whether cops visibly keep aiming at a doorway the player has left.
8. **The outer gate skipped 81 % of armed calls.** Run A:
   `dw_outer_gate_skip=19456` of `dw_call=23966`, i.e. the author's gate
   (`time_since_verification and not focus_enemy.lost_track or my_seg ==
   enemy_seg`, open question 4) sent most calls to vanilla before any probing.
   Decide later whether to relax it — nothing in this run says the skips were
   wrong, only that they dominate the armed path.
9. **The cost figure is a lower bound.** Run A produced only about two minutes of
   assault (it ended in the crash in §10), so `dw_us` = 17.77 µs average over
   23 966 calls ≈ 0.43 s of Lua across 120 s is measured on a short slice of one
   map's assault. A longer repeat plus the `--ab` control is needed before
   calling the cost bounded.
10. **Stale-bail ratio differs between the two runs.** 0.5 % armed (125/23966)
    against 22.4 % gated (6746/30085). The two runs do not sample the same call
    population either — ≈200 calls/s armed over ~2 min versus ≈84 calls/s gated
    over ~6 min — so the likeliest explanation is the `highperformance` aim-path
    difference, not a guard misfire. Confirm on a longer armed run that
    `dw_stale_bail` stays low while the gate is off and that the gated share
    tracks the assault's death rate.

## 8. Player POV

Cops that have lost sight of you now keep aiming at the doorway you are about
to come through, not only the one they happen to be walking through — so
stepping into a room can meet a cop who is already on the door instead of one
still turning. Nothing changes when High Performance Mode is on, and nothing
changes on a map without nav-link doors.

## 9. Decision & artifacts

**Decision.** Restore ledger blocks #1/#2/#4 as a LIES layer around the vanilla
`_get_expected_attention_position`, gated by `door_watch and not
highperformance`, with the eight deviations in §4 (cadence re-test without the
`advancing` term, same-segment delegation, 2-arg `find_segment_doors`, two
tracker guards before the gate, six outcomes, cadence-gated pre-step,
`dw_path_prestep_hit`, the `_get_expected_pos` dead-branch fix). Retire block #3
(lateral sight search) and record it as deferred under this umbrella. The
tracker liveness gates stay ahead of everything, so the crash fix from 8.57.19 is
not reopened.

**Artifacts.**

- `a9bfba0` — `find_segment_doors` guards (`fsd_nil_tracker`, `fsd_bad_shape`)
  plus the harness test for the tracker balance.
- `0edc8bc` — `door_watch` setting and menu toggle.
- `e389d5e` — the restore, `lies_upd_expected_pos`, `dw_*`/`fsd_*`/`react_*`
  digest fields, `[LIES-TRACE] phase=door_watch`.
- `189a053` — reachability and tracker-safety fix; `dw_gap` alarm delta
  snapshot when the digest is off.
- `10fa632` — 8.57.23 release commit: `dev/tools/door-watch-report.mjs`,
  `dev/tools/test/door-watch-report.test.mjs`, this report, ledger/status/
  decisions/smoke-check/menu docs, release metadata.
- Follow-up in the same unreleased 8.57.23 (the commit that carries this text):
  cadence made real, `dw_no_my_tracker`, timing sampled once, explicit nil shape
  tests (intent, not a behaviour change), in-code `8.57.23` pinned by
  `compat.test.mjs`, report tool header normalisation + disarmed-run INCOMPLETE +
  `dw_path_prestep` demoted to INFO + `--ab` control-unusable branch + exit code
  3.
- Second follow-up (the same unreleased 8.57.23): cadence-gated pre-step,
  `dw_path_prestep_hit` as a position counter, `_get_expected_pos` dead-branch
  fix, report CLI flag values as usage errors and a narrowed read-only `try`,
  UTF-8 gates report.
- Third follow-up (the same unreleased 8.57.23): the report splits a log into game
  sessions (`--session last|all|<n>`, default `last`, `--ab` follows the same
  selection, out-of-range exits 3). A SuperBLT file can hold several plays, so a
  control play used to be summed into the armed play's claim table and made the
  gate claim unjudgeable. Every claim rule and exit code is unchanged.
- Verification (the commit that carries this text): §10 records the 2026-11-01
  `auc` plays on deployed `8.57.23`, and §7 gains the four questions the
  numbers raised. Docs only — no Lua, settings or version change.
- Tests: `dev/tools/test/door-watch.test.mjs` (source pins),
  `dev/test-harness/test/find_segment_doors.lua` (tracker balance, raw
  `Vector3` contract, nav-link segment filter),
  `dev/tools/test/door-watch-report.test.mjs` (every claim, all three verdicts,
  header normalisation, disarmed run, empty control, game-session split and the
  out-of-range exit code),
  `dev/tools/test/compat.test.mjs` (in-code version pinned to `mod.txt`).

**Verified in game (2026-11-01).** Runs A and B (§10) observed the §5 claims on
level `auc` with the deployed `8.57.23`: watch positions from all three
sources, `dw_gap=0` on every digest, `fsd_bad_shape=0`, the gate holding with
every work counter at zero, and both reaction-level paths. Run A lasted about two
minutes and ended in Iter's follow-unit UAF, fixed out of tree (Iter 200.2); no
LIES frame was on the stack. Still open: the `--ab` cost control, nav-link door
volume against the vanilla list, the same-segment delegation, the outer gate's
`lost_track` skip and a longer repeat of Run A (§7). The user deploys; this
worktree contains no game install, so the raw logs stay outside the repo.

## 10. Verification (2026-11-01)

First in-game evidence for the restore: deployed build `8.57.23`, level `auc`,
`dev/tools/door-watch-report.mjs` as the reader, no `--ab` control. Two plays —
A armed, B gated — so the cost comparison is still open (§7.9).

### Run A — armed

Header `door_watch=true highperformance=false trace=true watch_log=true
enemy_reaction_level=1 level=auc`. About two minutes of assault; the play ended
in a crash (see below), so the session carries the t=0 snapshot and the digests
at t=60 and t=120.

| Counter | Value | Reading |
|---|---:|---|
| `dw_call` | 23966 | denominator |
| `dw_gap` | 0 | outcome accounting held on every digest |
| `dw_hit` / `dw_raw_hit` / `dw_expected_pos_hit` / `dw_path_prestep_hit` | 2015 / 24 / 37 / 4 | all three position sources produced positions |
| `dw_path_prestep` | 68 | attempts only; 4 returned a position |
| `dw_cached_reuse` / `dw_cached_unsighted` | 1733 / 28 | saved position reused; 28 re-test rays blocked |
| `dw_cadence_skip` / `dw_advancing_skip` | 3053 / 3053 | window closed (the advancing count is implied at this call site) |
| `dw_outer_gate_skip` | 19456 | 81 % of calls — the `lost_track` gate (§7.8) |
| `dw_stale_bail` / `dw_no_my_tracker` | 125 / 0 | liveness guards fired on 0.5 % of calls |
| `dw_seg_same` / `dw_height_skip` / `dw_ray` | 2 / 4 / 1333 | same-segment delegation, height gate, per-door rays |
| `dw_us` avg / `dw_us_max` | 17.77 µs / 1000 µs | 17.77 µs × 23 966 ≈ 0.43 s of Lua across 120 s; the max is one `os.clock` tick (1 ms granularity), a quantisation reading rather than a 1 ms solve |

Claims observed: positions from raw doors, expected position and the armed-path
pre-step (24 + 37 + 4 = 65); `dw_gap=0`; no `door_outcome_gap` or
`door_contract_violation` alarm. The SLOW reaction level did hold fire, but the
ratio is the finding: `react_level=1`, `react_hold=42043`, `react_allow=2713` —
**94 % of aim passes sat inside the hold window**, not "fired and then expired
into allowed shots" (corrected 2026-11-06). The block re-arms on every pass where
`data.t - verified_t > 2`, so a target the cop cannot verify keeps the timer
fresh and the hold is effectively continuous; a target it can verify pays
`2 / level` seconds again on each re-acquisition. That pre-instrumentation log
cannot say how many of those held passes carried a real shot, which is why
8.57.32 + the 2026-11-06 instrumentation add `react_arm` and `react_blocked`
(see the field list above). The same change reworks the timer to arm once per
verified acquisition (a false→true `verified` edge) instead of on every pass with
a stale verification, so a repeat run should show `react_arm` in the hundreds per
window rather than the tens of thousands, a much lower hold share, and
`react_blocked` only on genuine re-acquisitions.

NAV (`find_segment_doors`): `fsd_navlink_seg_ok=158`,
`fsd_navlink_seg_mismatch=0`, `fsd_tracker_created = fsd_tracker_destroyed =
158`, `fsd_bad_shape=0`, `fsd_raw=5396`, `fsd_disabled=248`,
`fsd_call_2arg=1896`, `fsd_call_center=217`. Nav-link doors were reached and
segment-matched, the raw-`Vector3` contract held, and no non-`Vector3` end
position reached `mvec3_set`/distance.

Trace: 58 `[LIES-TRACE] phase=door_watch` lines, `raw=21 expected=37`; first
adoption `evt=door_watch_first src=raw seg=124 tweak=shield`.

### Run B — gated (High Performance Mode on)

Header `door_watch=true highperformance=true react_level=3`. About six minutes,
digests at t=0/60/120/180/240/300/360. `dw_call=30085` split exactly into
`dw_gate_off=23339` + `dw_stale_bail=6746` + `dw_no_my_tracker=0`, with every
work counter at 0 (`dw_raw_hit`, `dw_expected_pos_hit`, `dw_path_prestep`,
`dw_path_prestep_hit`, `dw_hit`, `dw_ray`, `dw_cached_reuse`,
`dw_cached_unsighted`, `dw_cadence_skip`, `dw_outer_gate_skip`, `dw_none`,
`dw_vanilla_call`, `dw_path_kick`, `dw_height_skip`, `dw_seg_same`) and
`dw_gap=0`. The `gate respected` claim therefore PASSed on a real log; the
evidence line also prints the 22.4 % stale-bail share (§7.10).

NAV was still exercised under the gate: `fsd_navlink_seg_ok=263`,
`fsd_tracker_created = fsd_tracker_destroyed = 263`, `fsd_bad_shape=0`.

ULTRA-VIOLENCE behaved as intended: `react_level=3`, `react_hold=0`,
`react_allow=72325` — no hold, shots allowed throughout. No crash in this
session.

### The crash was Iter's, not LIES'

Run A ended in an engine access violation whose stack is entirely Iter's:
`results_callback() @ mods/Iter/lua/copbrain.lua:115` →
`_commence_coarce_searches` → `NavigationManager:update`. No LIES frame is on
it. The cause is Iter reading `objective.follow_unit:position()` without an
`alive()` check after a queued coarse search landed on a destroyed unit. Fixed
out of tree on Iter branch `feat/iter-follow-unit-uaf` (commits `ea7732a`,
`aa6211c`, Iter 200.2; unmerged when this was written).

LIES is not implicated: `_get_expected_pos` calls the synchronous `search_coarse`
branch (`results_clbk` nil), and that branch never queues a callback — so the
restore cannot produce the queued-callback shape that crashed.

### Tooling the evidence exposed (already fixed on this branch)

- `d8d6b06` — one SuperBLT log file accumulates launches, so the report needs
  `--session last|all|<n>`; summing an armed and a gated play made the gate
  claim unjudgeable.
- `a31a029` — the gate claim required `dw_gate_off == dw_call`, which is
  unreachable because the tracker liveness check runs before the gate. It now
  requires the three termination counters to sum to `dw_call` with every work
  counter zero, and prints the stale-bail ratio (Run B: 22.4 %).

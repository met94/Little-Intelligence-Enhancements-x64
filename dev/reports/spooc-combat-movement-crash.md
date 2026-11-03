# LIES 8.57.13: crash breadcrumbs + dead-enemy guards in the spooc/combat path

Crash report for 2026-11-01 05:46 (heist `dinner`) and the diagnostic layer added
in response. Mod Lua, docs and one setting were edited.

- **Game:** 248.2 source (`e3a8b616`), installed build `1.0.0-159028`.
- **Mod:** 8.57.12 (deployed) → 8.57.13.
- **Evidence:** `%LOCALAPPDATA%\PAYDAY 2\crash.txt` (05:46:10),
  `crashlog.txt:3557-3602`, `mods\logs\2026_11_01_log.txt` (691 lines; the
  session ran from 05:43:17 to 05:46:09).

## 1. Crash

```
Application has crashed: access violation

Script stack:
     update()  @mods/LIES/lua/coplogics/specials/spooc/spooclogicattack.lua:151
   original()  @mods/LIES/lua/copextensions/copbrain.lua:1365
               @mods/base/req/core/Hooks.lua:293
```

Line 151 is `CopLogicAttack._upd_combat_movement(data)` inside
`SpoocLogicAttack.update`. No deeper Lua frame exists in the dump, which means
the fault happened inside JIT-compiled code (a native fault has no Lua frame;
`pcall` cannot catch it either).

Player POV: the game closed with no error during an assault, again.

## 2. What this is not

- Not a recurrence of the 8.57.11 exit guard or the 8.57.12 tracker guard: neither
  path appears in the stack, and `[LIES-WATCH]` shows no `exit_missing_logic`
  alarm for the session.
- The three crashes are three different sites (travel exit, aim tracker, spooc
  combat movement), all of them native/engine-pointer faults in old LIES code,
  not regressions introduced by the guards.

## 3. Why logging, not another blind patch

An access violation terminates the process: no Lua error, no callback, nothing
can be written after it. The only useful evidence is what was written *before*,
attached to the unit that was running. 8.57.13 adds exactly that.

`LIES:Trace(unit, logic_data, phase, extra)` (`menumanager.lua`):

- default on at the time of this fix (`trace = true`, settings file only), because a
  crash cannot opt in retrospectively; **changed to opt-in in 8.57.30** - a
  release build does not write the breadcrumbs unless asked. `MENU_OPTIONS.md`
  documents the switch;
- one line per unit per phase per 2.5 s, global cap 25 lines/s, no table
  allocation when a line is suppressed, state cleared on level change with the
  watch channel;
- line shape: `[LIES-TRACE] v=<ver> t=<time> u=<unit key> tweak=<tweak>
  logic=<current logic> phase=<step> att=<enemy key> att_alive=<bool>
  att_trk=<bool>`.

Instrumented phases: `combat`, `charge_search` (both charge branches),
`cover_path_search`, `cover_upd`, `peek`, `retreat`, `aim`, `movement_aim`,
`spooc`. Failure phases that now replace a crash instead of preceding it:
`combat_no_attention`, `dodge_dead_enemy`, `spooc_dead_enemy`.

## 4. Guards added in the same path

- `_upd_combat_movement`: missing `attention_obj` returns immediately (the old
  code dereferenced it three lines later); the preemptive-dodge block reads
  `enemy.unit:movement():current_state()` and `enemy.unit:anim_data()` only while
  the enemy is alive.
- `SpoocLogicAttack._upd_spooc_attack`: bails when the enemy unit is gone,
  before `zipline_unit()`, `is_SPOOC_attack_allowed()` and
  `AnimSpooc.chk_can_start_spooc_sprint` (all engine/movement calls on the
  enemy).

Player POV: no behaviour change for living enemies; a dead or despawned enemy
inside these two decisions is now skipped instead of used.

## 5. Decision & artifacts

Decision: **instrument first, patch the two provable dead-enemy reads**. The
faulting engine call inside `_upd_combat_movement` is not identified yet; the
next occurrence will name unit, tweak, logic and phase, and whether a dead enemy
was involved. Fixing that call is then a targeted change instead of another
guess.

Artifacts:

- `menumanager.lua` — `LIES:Trace`, `trace` default, reset in `WatchReset`.
- `lua/coplogics/coplogicattack.lua` — 9 trace phases, missing-attention bail,
  dodge liveness guard.
- `lua/coplogics/specials/spooc/spooclogicattack.lua` — trace + liveness guard.
- `lua/copextensions/copbrain.lua` — `movement_aim` trace.
- `MENU_OPTIONS.md` breadcrumb section; `changelog.txt` 8.57.13; version metadata.
- `dev/tools/test/trace-logging.test.mjs` — trace contract, every phase, guard
  ordering.
- Gates: `dev/tools/gates.ps1` (all Node tests, 71/71 Lua compile, freevars, API
  audit), `dev/reports/static-gates.md`.

Deploy/test split: build with `dev/build.ps1`, user deploys and plays. On the
next crash, attach `crash.txt` plus the tail of `mods\logs\<date>_log.txt`
(the `[LIES-TRACE]` lines immediately before the end).

## 5b. Review pass (post-implementation)

The review of the first breadcrumb implementation found one blocker and several
risks, all fixed here:

- **Blocker:** the 25 lines/s window (`trace_window_t`) survived `WatchReset`
  while `time()` restarts near zero on a level change, so the budget never
  refilled and tracing could go silent for a whole heist. `WatchReset` now
  resets the window and a backwards clock also starts a new one.
- Failure phases are exempt from the cap (they used to be dropped once healthy
  traffic filled it) and a `dropped=<n>` field records suppressions.
- Throttling is per phase now: `combat`/`charge_search`/`retreat` alternate every
  frame, so a single "last phase" stamp let the pair through on every call.
- Units that stop tracing are pruned after 60 s instead of holding a table entry
  for the whole heist; recycled unit keys no longer inherit a stale timestamp.
- The log line uses `att.u_key` instead of `att_unit:key()`, so the breadcrumb
  itself never calls into the (possibly dead) attention unit.
- The 8.57.11 and 8.57.12 guards now leave breadcrumbs too: `exit_missing_logic` /
  `exit_no_fallback` with `wanted=<state>`, and `stale_tracker` when the tracker
  guard refuses a dead enemy's tracker.
- `movement_aim` was dropped: every branch of `check_upd_aim` immediately emits
  `aim`, so it spent two cap slots for one step.

Player POV: unchanged; the extra lines only appear when a guard steps in.

## 7. Second run (06:03) - breadcrumbs named the unit

`[LIES-TRACE]` lines before the crash:

```
t=173.05 u=0xb71 tweak=spooc logic=attack phase=spooc        att=0x968 att_alive=true att_trk=true
t=173.25 u=0xb71 tweak=spooc logic=attack phase=cover_upd    att=0x968 att_alive=true att_trk=true
t=173.47 u=0xb71 tweak=spooc logic=attack phase=combat       att=0x968 att_alive=true att_trk=true
```

then `update() @spooclogicattack.lua:153` (the `_upd_combat_movement` call).
So the crashing unit is a **cloaker in attack logic with a live, verified enemy**;
the fault happens inside `_upd_combat_movement` after `_update_cover`, not in the
dead-enemy family.

8.57.14 therefore instruments the sub-steps of that function (`pose`,
`pose_upd`, `flank`, `cover_path`, `dodge`, `dodge_preemptive`, `move_out`,
`move_out_lost_test`) and gives the spooc its own `spooc_combat` phase with a
0.2 s window. Rate cap raised to 60 normal lines/s, with a per-call window
argument so a tight phase is not squeezed out.

Also added the guard the cop attack update already had: `SpoocLogicAttack.update`
does not run combat movement when `chk_action_forbidden("walk")` (mid-tackle,
tased, staggered). It logs `spooc_no_walk` instead.

Player POV: a cloaker that is mid-tackle or stunned no longer receives walk/cover
action requests; everything else is unchanged.

## 8. Backlog

`CopLogicAttack._upd_aim` and its neighbours remain ledger status **PORT**
(573 vs 195 lines for `_upd_aim` alone). Each crash so far has been an old-game
engine-pointer assumption in that family; porting the 248.2 bodies is the
structural fix, the guards and breadcrumbs are the interim safety net.

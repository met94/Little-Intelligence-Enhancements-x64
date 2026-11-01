# LIES V8.69_x64: crash breadcrumbs + dead-enemy guards in the spooc/combat path

Crash report for 2026-11-01 05:46 (heist `dinner`) and the diagnostic layer added
in response. Mod Lua, docs and one setting were edited.

- **Game:** 248.2 source (`e3a8b616`), installed build `1.0.0-159028`.
- **Mod:** V8.68_x64 (deployed) → V8.69_x64.
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

- Not a recurrence of the V8.67 exit guard or the V8.68 tracker guard: neither
  path appears in the stack, and `[LIES-WATCH]` shows no `exit_missing_logic`
  alarm for the session.
- The three crashes are three different sites (travel exit, aim tracker, spooc
  combat movement), all of them native/engine-pointer faults in old LIES code,
  not regressions introduced by the guards.

## 3. Why logging, not another blind patch

An access violation terminates the process: no Lua error, no callback, nothing
can be written after it. The only useful evidence is what was written *before*,
attached to the unit that was running. V8.69 adds exactly that.

`LIES:Trace(unit, logic_data, phase, extra)` (`menumanager.lua`):

- default on (`trace = true`, settings file only), because a crash cannot opt in
  retrospectively; `MENU_OPTIONS.md` documents the switch;
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
- `MENU_OPTIONS.md` breadcrumb section; `changelog.txt` V8.69; version metadata.
- `dev/tools/test/trace-logging.test.mjs` — trace contract, every phase, guard
  ordering.
- Gates: `dev/tools/gates.ps1` (all Node tests, 71/71 Lua compile, freevars, API
  audit), `dev/reports/static-gates.md`.

Deploy/test split: build with `dev/build.ps1`, user deploys and plays. On the
next crash, attach `crash.txt` plus the tail of `mods\logs\<date>_log.txt`
(the `[LIES-TRACE]` lines immediately before the end).

## 6. Backlog

`CopLogicAttack._upd_aim` and its neighbours remain ledger status **PORT**
(573 vs 195 lines for `_upd_aim` alone). Each crash so far has been an old-game
engine-pointer assumption in that family; porting the 248.2 bodies is the
structural fix, the guards and breadcrumbs are the interim safety net.

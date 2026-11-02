# LIES V8.84_x64: access violation in the detection pass (queued task on a dead unit)

Crash-fix report for a user report received 2026-11-02 against `V8.57_x64`.
Mod Lua **was** edited (`lua/coplogics/coplogicbase.lua`,
`lua/teamailogics/teamailogictravel.lua`, new static test, version metadata,
changelog).

- **Game:** 248.2 (`e3a8b616`). The report's vanilla line numbers
  (`enemymanager.lua:651/678`, `gamesetup.lua:814`) do not match the decompiled
  clone (`enemymanager.lua:513/525`), which is expected: shipped-build line
  numbers differ from the decompiled clone (same caveat as
  `exit-missing-logic-crash.md` §1).
- **Mod:** `V8.57_x64` (`4d97be0`, 2026-10-24 — the 248.2 port) → `V8.84_x64`.
- **Evidence:** user-supplied script stack, reproduced below. No local `crash.txt`:
  the report came from a player, not this machine, and no further reports are
  available.

## 1. Crash

```
Application has crashed: access violation

Current thread: Main
Script stack:
            _upd_attention_obj_detection()  @mods/LIES/lua/coplogics/coplogicbase.lua:807
                                    clbk()  @mods/LIES/lua/teamailogics/teamailogictravel.lua:91
                    _execute_queued_task()  lib/managers/enemymanager.lua:651
                    _update_queued_tasks()  lib/managers/enemymanager.lua:678
                                  update()  lib/managers/enemymanager.lua:63
                                original()  lib/setups/gamesetup.lua:814
                                  update()  @mods/base/req/core/Hooks.lua:293
                                  update()  lib/setups/networkgamesetup.lua:21
                                            core/lib/setups/coresetup.lua:537
```

Both mod frames are exact, because mod files ship as authored. At `V8.57_x64`
they are:

- `lua/coplogics/coplogicbase.lua:807` — the `my_pos` local inside
  `CopLogicBase._upd_attention_obj_detection`:
  `local my_pos = data.cool and data.unit:movement():m_head_pos() or data.m_pos:with_z(data.unit:movement():m_head_pos().z)`
- `lua/teamailogics/teamailogictravel.lua:91` — the
  `CopLogicBase._upd_attention_obj_detection(data, ...)` call inside
  `TeamAILogicTravel._upd_enemy_detection`, the queued detection callback.

The stack is the vanilla queued-task pump, so this was not a logic update: a
detection callback stored earlier in `EnemyManager:_queued_tasks` fired, and the
callback's `data.unit` no longer had a live engine object.

`TeamAILogicTravel` exists only in `TeamAIBrain._logics`, so the unit was a
**team AI bot** (crew bot), not an enemy cop.

`access violation` is a native fault: no Lua message, so the last statement is
the one that faulted. `m_head_pos()` and `movement()` are engine calls; a freed
unit or freed movement extension behind the Lua handle is exactly this shape
(compare `aim-stale-nav-tracker-crash.md` §2: "`access violation` = native fault,
so there is no Lua message").

Player POV: the game closed instantly to the crash reporter mid-heist, with no
error text.

## 2. Root cause

A queued task outlived its unit. The vanilla queue tolerates that by design:

- `EnemyManager:queue_task` (`enemymanager.lua:455` @ `e3a8b616`) appends
  unconditionally, with no id dedupe.
- `EnemyManager:unqueue_task` (`:482`) scans from the end and removes **one**
  matching entry, then returns.
- `EnemyManager:has_task` (`:497`) returns a *count* when several entries share
  an id.

Cancellation happens through `CopLogicBase.cancel_queued_tasks`, which is called
from the logic's `exit`. On destruction the normal route is
`CopBrain:pre_destroy` → `set_active(false)` → `set_logic("inactive")` →
`TeamAILogicTravel.exit` → cancel. Two routes still leave a live entry:

1. **Duplicate id.** A second queue for the same `detection_task_key` (LIES'
   `CopLogicBase.queue_task` already logs `task queued twice`) leaves one entry
   behind after a single cancel — it survives its unit and fires later.
2. **No exit ran.** Any teardown that does not pass through the logic exit
   leaves every queued id in place.

Either way the callback runs with a `data` table whose `unit` is gone, and
nothing on that path checked liveness:

- `TeamAILogicTravel._upd_enemy_detection` — no check (also vanilla; the vanilla
  body has the same hole).
- `CopLogicBase._upd_attention_obj_detection` — no check at the head. LIES' line
  also dereferences `data.m_pos`, so it has one more term than vanilla's
  `data.unit:movement():m_head_pos()`.
- The vanilla queue pump — no liveness check before `task.clbk(task.data)`.

LIES already treats this class as a crash source: `2a8bbb1` added
`not alive(data.unit) ... or not data.unit:movement()` to
`CopLogicIntimidated.queued_update`, and V8.68 gated the cached enemy tracker on
`alive(unit)`. The detection callbacks never received the same treatment.

## 3. Fix

One idiom at every detection entry, no scheduler or queue changes.

`lua/coplogics/coplogicbase.lua` (first statement of
`_upd_attention_obj_detection`, defence in depth for any other caller):

```lua
if not alive(data.unit) or not data.unit:movement() then
	return 2
end
```

and the same guard as the first statement of every logic that owns a queued
detection callback — twelve functions in twelve files:

| file | entry |
| --- | --- |
| `lua/teamailogics/teamailogictravel.lua` | `TeamAILogicTravel._upd_enemy_detection` |
| `lua/teamailogics/teamailogicidle.lua` | `TeamAILogicIdle._upd_enemy_detection` |
| `lua/teamailogics/teamailogicassault.lua` | `TeamAILogicAssault._upd_enemy_detection` |
| `lua/coplogics/coplogicidle.lua` | `CopLogicIdle._upd_enemy_detection` |
| `lua/coplogics/coplogictravel.lua` | `CopLogicTravel._upd_enemy_detection` |
| `lua/coplogics/coplogicattack.lua` | `CopLogicAttack._upd_enemy_detection` |
| `lua/coplogics/coplogicarrest.lua` | `CopLogicArrest._upd_enemy_detection` |
| `lua/coplogics/coplogicsniper.lua` | `CopLogicSniper._upd_enemy_detection` |
| `lua/coplogics/specials/taserlogicattack.lua` | `TaserLogicAttack._upd_enemy_detection` |
| `lua/coplogics/specials/shieldlogicattack.lua` | `ShieldLogicAttack._upd_enemy_detection` |
| `lua/coplogics/specials/spooc/spooclogicidle.lua` | `SpoocLogicIdle._upd_enemy_detection` |
| `lua/coplogics/boss/bosslogicattack.lua` | `LIESBossLogicAttack._upd_enemy_detection` |
| `lua/civlogics/civilianlogicidle.lua` | `CivilianLogicIdle._upd_detection` |

- `alive()` first is deliberate: LIES already treats unit liveness as the
  validity predicate for engine objects (V8.68 §3, `lies_enemy_tracker`), and
  `movement()` is only read once liveness holds. `alive()` is itself a native
  call on the unit handle; the assumption behind it is stated in §5, not proven
  here.
- The entry guards are not redundant with the shared one. After
  `_upd_attention_obj_detection` returns, each callback still dereferences the
  unit (`movement()`, `anim_data()`, `objective`), re-queues itself, and in the
  sniper's case reads `anim_data()` *before* the shared call. Guarding only the
  shared pass would move the fault a few lines down; returning at the entry also
  stops a dead unit from re-queuing.
- Return value depends on the callback's contract: `return` where the caller
  ignores the result, `return 2` where the value is a delay
  (`CopLogicIdle`/`CopLogicTravel`/`CopLogicArrest`/`TaserLogicAttack`/
  `SpoocLogicIdle`, whose `queued_update` does `data.t + delay` or
  `delay = 0.5 + delay * 1.5`). A bare `nil` there would be a nil arithmetic
  error instead of a skipped update. `2` mirrors the shared pass's own default
  delay (`whisper_mode() and 0 or 2`); `CopLogicAttack` schedules with
  `delay and data.t + delay`, where `nil` means "run next tick". The static test
  derives the expectation from each body (`return delay` present or not), and it
  caught `SpoocLogicIdle` during this change.
- Live units are unaffected: the guard is false, cost is two native calls per
  detection tick, the same trade-off V8.82 accepted for one `alive()` per unit
  per check.
- Downed units are unaffected in practice: `TeamAILogicIdle.damage_clbk` exits
  to `disabled` on `bleedout`/`fatal`/`tase` (`teamailogicidle.lua:327-328` @
  `e3a8b616`), so travel never runs on a downed bot, and a unit that fails
  `alive()` has no detection work worth keeping.

Deliberately **not** done, because each is riskier than the bug:

- `pcall` around queued callbacks — hides real errors and changes crash output.
- `EnemyManager` id dedupe or an `unqueue_task` loop — vanilla queue semantics
  shared by every cop, civilian and bot; ordering and cost risk.
- `pre_destroy` cancel hook — the normal path already cancels, and it cannot
  reach a duplicate-id orphan anyway.

## 4. Verification

- `dev/tools/test/detection-dead-unit-guard.test.mjs` — three tests: the shared
  pass reads `alive()` before `movement()` and returns `2` before the `my_pos`
  deref; every detected `_upd_enemy_detection`/`_upd_detection` definition under
  `lua/` (discovered from the source, not hardcoded) starts with the guard; and
  each guard returns a number exactly when its callback reports a delay.
- `node --test dev/tools/test/*.test.mjs` — 199/199 (196 before this release).
- LuaJIT syntax on all changed files, `lua-freevars` on them against
  `e3a8b616` — `no game-file locals missing`.
- `dev/tools/gates.ps1` — see `dev/reports/static-gates.md`.
- **No in-game observation.** The reporter cannot be asked for another session,
  and there is no local reproduction (the trigger is a destroyed bot with a
  live queued task). The guard is provably sufficient for the reported line: a
  unit that fails `alive()` can no longer reach that deref.

## 5. Remaining risk and what would falsify this

If an `access violation` at the same line reappears, `alive()` was true while
the movement extension was gone, which would point at the duplicate-id orphan
route rather than unit destruction. The next step then is cancelling **all**
entries for the unit's key at `TeamAIBrain:set_active(false)` (loop on
`has_task(id)`), not a wider guard.

`alive()` is a native call on the unit handle. The guard assumes a destroyed
unit's Lua handle still answers it, which is the same assumption V8.68 ships; it
is not proven by anything in this report. If a fault moves to the guard line
itself, that assumption is wrong and the guard has to be replaced by a liveness
list (keys the manager still owns) instead of calling into the unit.

The class is closed at the entry points: every logic that owns a queued
detection callback guards before its first statement, so the two pre-guard reads
found earlier (`GroupAIStateBase:on_unit_detection_updated` while the group AI's
`_draw_enabled` debug drawing is on, and `CopLogicSniper`'s
`CopLogicAttack._upd_stop_old_action` branch at `coplogicsniper.lua:118-120`)
now sit behind the guard.

What remains is the orphan itself, not the crash: a leaked queued task for a
destroyed unit still fires at the normal cadence and now returns immediately
(`return 2` where the callback reports a delay, bare `return` otherwise). The
queue leak is vanilla behaviour — `queue_task` appends without id dedupe and
`unqueue_task` removes one entry per id — and is left alone on purpose (see §3).

One sibling callback is vanilla-owned and therefore outside this fix:
`CivilianLogicIdle._upd_outline_detection` (queued by four civilian logics for
`data.t + 2`) dereferences `data.unit:movement()` at
`civilianlogicidle.lua:128` @ `e3a8b616`. LIES does not override that function,
so covering it would mean shipping a vanilla civ-outline copy for a guard; it is
recorded here rather than done.

Player POV: no gameplay change. A bot whose unit is already gone no longer takes
the session down on its next detection tick; live bots detect exactly as before.

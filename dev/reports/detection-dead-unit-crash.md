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

Two guards, one idiom, no scheduler or queue changes.

`lua/coplogics/coplogicbase.lua` (first statement of
`_upd_attention_obj_detection`):

```lua
if not alive(data.unit) or not data.unit:movement() then
	return 2
end
```

`lua/teamailogics/teamailogictravel.lua` (first statement of the callback):

```lua
if not alive(data.unit) or not data.unit:movement() then
	return
end
```

- `alive()` first is deliberate: LIES already treats unit liveness as the
  validity predicate for engine objects (V8.68 §3, `lies_enemy_tracker`), and
  `movement()` is only read once liveness holds. `alive()` is itself a native
  call on the unit handle; the assumption behind it is stated in §5, not proven
  here.
- The second guard is not redundant. After `_upd_attention_obj_detection`
  returns, the callback still dereferences the unit (`movement()`,
  `anim_data()`, `objective`) and re-queues itself, so guarding only the shared
  function would move the fault a few lines down. Returning also stops the dead
  unit from re-queuing.
- `return 2` mirrors the function's own default delay
  (`whisper_mode() and 0 or 2`). A `nil` return would be a behaviour change:
  `CopLogicAttack._upd_enemy_detection` schedules with `delay and data.t + delay`,
  where `nil` means "run next tick".
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

- `dev/tools/test/detection-dead-unit-guard.test.mjs` — three tests: the guard is
  the first statement of both callbacks, it sits before the `my_pos` deref, it
  reads `alive()` before `movement()`, and the return values are a number
  (`2`) in the shared pass and a bare `return` in the callback.
- `node --test dev/tools/test/*.test.mjs` — 199/199 (196 before this release).
- LuaJIT syntax on both files, `lua-freevars` on both files against
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

The same hole exists on the other queued detection entries
(`teamailogicidle:446`, `teamailogicassault:247`, `coplogicidle:1074`,
`coplogictravel:1015`, `coplogicsniper:112`, `coplogicattack:478`,
`taserlogicattack:260`, `bosslogicattack:906`). In a normal session they reach
the shared pass without dereferencing the unit first:
`GroupAIStateBase:on_unit_detection_updated` (`groupaistatebase.lua:1034` @
`e3a8b616`) only reads `unit:movement()` when the group AI's `_draw_enabled`
debug drawing is on, so the shared guard covers their reachable path. Two
exceptions stay open and are candidates for the follow-up: that callout while
AI drawing is enabled, and `CopLogicSniper._upd_enemy_detection`, whose
`CopLogicAttack._upd_stop_old_action` branch (`coplogicsniper.lua:118-120`) reads
`data.unit:anim_data()` before the guard when an old action is pending.

`return 2` keeps those callbacks re-queuing at the normal detection cadence for
a unit that is already gone, instead of stopping them. That is deliberate: the
sites share the shared pass but not a single callback to return from, and a `nil`
return would re-schedule them immediately. The travel callback, which owns its
own re-queue, returns bare and stops.

Player POV: no gameplay change. A bot whose unit is already gone no longer takes
the session down on its next detection tick; live bots detect exactly as before.

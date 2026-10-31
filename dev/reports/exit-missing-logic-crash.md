# LIES V8.67_x64: crash on `CopLogicBase._exit` with a state the brain does not own

Crash-fix report for the session of 2026-10-31 (heist `auc`). Mod Lua **was**
edited (`lua/coplogics/coplogicbase.lua`, version metadata, changelog). All
other files are unchanged.

- **Game:** 248.2 (`e3a8b616`), installed build `1.0.0-159028`.
- **Mod:** V8.66_x64 (branch `feat/ai-suite-compat`) → V8.67_x64.
- **Evidence:** `%LOCALAPPDATA%\PAYDAY 2\crash.txt` (07:17:27),
  `crashlog.txt:3441-3451`, `mods\logs\2026_10_31_log.txt`.

## 1. Crash

```
Application has crashed: C++ exception
[string "lib/units/enemies/cop/copbrain.lua"]:561: attempt to index local 'logic' (a nil value)

SCRIPT STACK
_exit() lib/units/enemies/cop/logics/coplogicbase.lua:198
update() @mods/LIES/lua/coplogics/coplogictravel.lua:915
original() @mods/LIES/lua/copextensions/copbrain.lua:1365
@mods/base/req/core/Hooks.lua:293
```

Shipped-build line numbers differ from the decompiled clone, so the cloned
`CopBrain:set_logic` (248.2, `copbrain.lua:456-471`) is the reference, not the
`:561` label. There `local logic = self._logics[name]` is followed by
`logic.enter(l_data, name, enter_params)`; the raised error is that lookup
returning nil.

## 2. Root cause

`CopLogicBase._exit(unit, state_name)` is `unit:brain():set_logic(state_name)`.
The brain owns exactly one logic table:

| brain | table | holds |
| --- | --- | --- |
| `CopBrain` | `CopBrain._logic_variants[tweak]` | idle, attack, travel, arrest, inactive, intimidated*, guard, flee*, sniper, trade, phalanx (* shield variants drop `intimidated` and `flee`) |
| `TeamAIBrain` | `TeamAIBrain._logics` | inactive, idle, surrender, travel, assault, disabled |
| `CivilianBrain` | `CivilianBrain._logics` | inactive, idle, surrender, flee, escort, travel, trade |

`set_logic(name)` does not validate `name`. Any state outside the table is a
nil index and a closed game.

The failing call site is `CopLogicTravel.upd_advance` line 915, the
`objective == nil` branch of the "can walk" arm:

```lua
else
    local wanted_state = data.logic._get_logic_state_from_reaction(data) or "idle"
    CopLogicBase._exit(data.unit, wanted_state)
end
```

Vanilla 248.2 exits the same situation to a literal `"idle"`
(`coplogictravel.lua:281`). LIES instead asks the current logic for a state;
`CopLogicBase._get_logic_state_from_reaction` can return the cop-only states
`"arrest"` and `"attack"` (`lua/coplogics/coplogicbase.lua:25-59`). Non-cop
brains reaching this branch therefore request a state they cannot enter.

How non-cop brains reach cop travel: vanilla `TeamAILogicTravel.update` already
delegates to `CopLogicTravel.upd_advance` for every bot that has an objective
(`lib/units/player_team/logics/teamailogictravel.lua:169-177`, but dereferences
`data.objective.type` first), and the installed Useful Bots wrapper adds the
objective-less case (`<game>\mods\Useful Bots\lua\teamailogictravel.lua:71-74`).
Both run the cop travel body on `TeamAIBrain` instances, which have no
`"attack"`/`"arrest"`. Which of the two dispatched the failing exit is not
proven by the dump; the alarm records the owning brain on the next occurrence.

Player POV: the heist ended instantly with the Payday crash reporter.

## 3. Why the dump cannot name the unit

`crash.dmp` is a minidump with no readable Lua strings (ASCII/UTF-16 scan for
`LIES`, `logic`, `travel`, tweak names: zero hits), the crash entry has no game
log line naming the unit, and the run's `[ITER-TEST]` samplers (about one line
per second) never sampled the crashing unit. The state that was requested is
therefore inferred from the code path, not read from the dump; the fix below
records it on the next occurrence.

## 4. Fix

`lua/coplogics/coplogicbase.lua`: `CopLogicBase._exit` is wrapped once, at the
single choke point every mod and game caller uses.

- If `unit:brain()._logics[state_name]` is missing, the exit is downgraded to
  `"idle"` (or `"inactive"` for a brain that lacks idle), instead of handing
  `set_logic` a nil table entry.
- A brain with no usable state at all keeps its current logic: the exit is
  skipped rather than crashing.
- The guard does **not** gate on `alive(unit)`. A dead or mid-destroy unit still
  updates its logic for a frame, and the guard only reads tables, so checking
  those units is safe and is the point.
- Every downgrade emits a `[LIES-WATCH] evt=alarm name=exit_missing_logic ...
  tweak=<tweak> wanted=<state> current=<logic> fallback=<state or none>
  logics=<idle.attack.travel...>` line; the no-fallback case uses
  `name=exit_no_fallback`. Throttle: one line per name per 60 s of game time,
  20 per session, and no field building once the budget is gone.
- Untouched paths: a valid state still goes straight to the game function
  (`return exit_original(unit, state_name, params)`).

Player POV: no visible change in normal play. The rare unit that previously
would crash the session falls back to its idle behaviour for one update.

## 5. Decision & artifacts

Decision: **safety net plus probe**. The exact brain/state pair could not be
recovered from the dump, and a nil-index ban in one place protects every LIES
exit (`travel` 10 sites, plus `idle`, `attack`, `arrest`, `sniper`, `base`)
without guessing which one is wrong. Once the alarm names the pair, the source
exit can be restricted instead of downgraded.

Note for the next port pass: `dev/port-248-ledger.md` lists
`CopLogicBase._exit` as `LIES_EDIT_CLEAN` with status `keep`. In that tool
`keep` means "no port work", not "regenerate from vanilla"; the guard stays.

Artifacts:

- `lua/coplogics/coplogicbase.lua` — guarded `_exit` (`exit_original`,
  `lies_logic_exists`, `exit_fallback_name = "idle"`, alarm).
- `dev/tools/test/exit-guard.test.mjs` — pins the guard and that travel never
  calls `set_logic` directly; `dev/tools/test/compat.test.mjs` — version bump.
- `changelog.txt` V8.67_x64 entry, `mod.txt`, `autoupdate.json`,
  `menumanager.lua` (`LIES.version`), `README.md`.
- Gates: `dev/tools/gates.ps1` PASS (79 Node tests, 71/71 Lua compile, freevars
  0 findings, API audit 0 errors), `dev/reports/static-gates.md`.

Deploy/test split: the user deploys (`dev/build.ps1` output or the folder copy)
and plays; the probe line appears in `mods\logs\` only if the crash class
reproduces. Expected outcome: no crash; a `[LIES-WATCH] evt=alarm
name=exit_missing_logic` line if it does.

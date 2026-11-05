# LIES 8.57.31: taser crash in the aim pass (`u_key` indexed as a Vector3)

Crash-fix report for the session of 2026-11-05 13:24 (heist `bph`, 59 cops,
`highperformance=false`, `door_watch` on, digest and trace off). Mod Lua **was**
edited (`lua/coplogics/coplogicattack.lua`, `lua/coplogics/specials/taserlogicattack.lua`,
`lua/coplogics/boss/bosslogicattack.lua`, version metadata, tests, changelog).

- **Game:** 248.2 source (`e3a8b616`), installed build `1.0.0-159028`.
- **Mod:** 8.57.30 (deployed, hash-identical to the workspace copy) → 8.57.31.
- **Evidence:** the crash pasted by the player (stack below), `mods/logs/2026_11_05_log.txt`
  (last write 13:24:39, `[PERF-STORM] ... level=bph t=120 ... hp=false`).
  `trace` and `watch_log` were off, so no `[LIES-TRACE]`/`[LIES-WATCH]` breadcrumb
  survives from the failing pass.

## 1. Crash

```
Application has crashed: C++ exception
mods/LIES/lua/coplogics/coplogicattack.lua:1195: attempt to index local 'attention_unit' (a userdata value)

SCRIPT STACK
_upd_aim() @mods/LIES/lua/coplogics/coplogicattack.lua:1385
_upd_aim() @mods/LIES/lua/coplogics/specials/taserlogicattack.lua:261
_upd_enemy_detection() @mods/LIES/lua/coplogics/specials/taserlogicattack.lua:343
clbk() @mods/LIES/lua/coplogics/specials/taserlogicattack.lua:62
_execute_queued_task() lib/managers/enemymanager.lua:651
```

The failing line was the settled-facing drop test added in 8.57.30 (`5cedda6`):

```lua
local function lies_settle_target_held(attention_unit, pos)
	if type(attention_unit) ~= "userdata" or attention_unit.type_name ~= "Vector3" then
		return false
	end

	return mvec3_dis(attention_unit, pos) <= LIES_SETTLE_TARGET_DIS
end
```

Player POV: the game closes instantly mid-fight, with a C++ exception line
naming a LIES file. No warning, no stutter - the heist is lost.

## 2. Root cause

`my_data.attention_unit` is vanilla's mirror of the aim target and holds one of
two things, written at `coplogicattack.lua:1674/1687/1695/1731` and copied across
logic changes by each `enter()`:

1. a `Vector3` - the watch position (`mvector3.copy(expected_pos)`), the
   last-known position (`mvector3.copy(look_pos)`), or the idle/team-AI
   reconstruction (`mvector3.copy(current_attention.pos)`);
2. an enemy key - `focus_enemy.u_key` (`coplogicattack.lua:1687`,
   `taserlogicattack.lua:204`, `spooclogicattack.lua:337/369`,
   `bosslogicattack.lua:408`, `teamailogicdisabled.lua:71`) or
   `current_attention.unit:key()` (`coplogicidle.lua:1015`).

A `u_key` is an Idstring engine userdata with **no `__index`**. `type()` answers
`"userdata"` for it and for a `Vector3`, so the guard never short-circuits, and
`attention_unit.type_name` is an index on an opaque value: Lua raises
`attempt to index local 'attention_unit' (a userdata value)` instead of
answering `nil`. The engine's own `CoreClass.type_name` (`coreclass.lua:58-66`)
has the same unguarded `value.type_name` read, so it is not a usable
discriminator either.

Independent confirmation that these keys are opaque: the game log prints them
through `%s` as the default userdata string, e.g.
`[ITER-TEST] diag cop key=userdata: 0x0000187c id=2321` - no `__tostring`, and
the same shape reproduces locally with `newproxy(false)`.

**Why it took three days and a taser.** The sample is dropped before the target
check in two cases: when it is stale or the logic changed, and when the target
is `verified`/`nearly_visible` (`coplogicattack.lua:1380`). The `u_key` is left
behind by exactly that visible-target pass. The crash therefore needs the *next*
aim pass in which the target is invisible again and the sample is still pending
(`data.t < settle.t + 2`). The taser reaches `_upd_aim` from its own
`_upd_aim` (`:261`) and its detection update (`:343`), and its focus moves while
it is tasing. Changelog 8.57.30 recorded that the settled feature had **zero**
in-game samples: the first sample it ever took was also its first crash.

## 3. Why `pcall` was rejected

Wrapping the read in `pcall` would stop the crash while keeping the actual
defect: the code would still be inferring provenance from a runtime type it
cannot observe. Every alternative in that family (`pcall`,
`getmetatable` comparison, `tostring` sniffing) answers "what is this value"
instead of "what did the writer mean". The writer knows: the aim target is
decided in one place, and the engine stores it typed.

## 4. Fix

`CopMovement:attention()` (`game-data/.../lib/units/enemies/cop/copmovement.lua:1578`)
returns `self._attention`, the table `set_attention` stored at 1232 - by
reference, no allocation. `CopLogicBase._set_attention_on_pos`
(`coplogicbase.lua:76-82`) builds that table as `{ pos = pos }`, so `pos` is a
`Vector3` for a position target and `nil` for a unit/key target or no target at
all. That is the discriminated record, and LIES already reads it this way in
`coplogicidle.lua:1007`, `coplogictravel.lua:1075`, `coplogicarrest.lua:198` and
`civilianlogicsurrender.lua:344`.

```lua
local function lies_settle_target_held(data, pos)
	local movement = data.unit:movement()

	if not movement then
		return false
	end

	local attention = movement:attention()
	local aim_pos = attention and attention.pos

	if not aim_pos then
		return false
	end

	return mvec3_dis(aim_pos, pos) <= LIES_SETTLE_TARGET_DIS
end
```

Call site: `elseif not lies_settle_target_held(data, settle.pos) then`.

- **Total by construction:** `attention.pos` is a Vector3 or nil; no opaque
  userdata can reach `mvec3_dis`. No new state to keep in sync, no
  monkeypatching of the vanilla setters, no `pcall`, no allocation.
- **More accurate, not just safer:** the mirror can be stale (travel sets an
  attention position without updating it, `coplogictravel.lua:1280/1309`; the
  engine record also sees `_reset_attention`), so `watch_aim_settled` samples
  from 8.57.30 and 8.57.31 are not directly comparable. The kept set can only
  shrink, and every kept sample is one the cop's real aim also kept.
- **Known noise:** `attention.pos` can alias a nav-ray or turn vector the caller
  mutates afterwards (travel 1301-1309, idle 819-827), so the 20-unit band can
  measure a moved vector. That is jitter in the measurement, never a crash -
  `.pos` is only ever written by `_set_attention_on_pos`.

### Companion hardening (same class, other aim sinks)

Verified against the write order: none of these was reachable today, but each
relied on an invariant that one edit could break, and each fed `mvec3_dir`
through `_chk_request_action_turn_to_enemy` (`coplogicattack.lua:1972-1977`).

| site | old expression | why it was safe only by path | now |
| --- | --- | --- | --- |
| `taserlogicattack.lua:99-108` | `enemy_pos = my_data.attention_unit` when it `~= focus_enemy.u_key` | `queued_update` runs during a tase, and `_upd_enemy_detection` early-returns at `:311` while the tase holds, so the key matches in practice | `attention.pos or focus_enemy.m_pos` |
| `taserlogicattack.lua:240-249` | same | `:201-204` writes the current key earlier in the same branch | same |
| `bosslogicattack.lua:433` | `... or my_data.attention_unit` | the look-pos branch at `:413-416` overwrites the union with a copy in the same pass | `attention.pos` |

The outer `my_data.attention_unit` truthiness gates stay as they were: a bare
existence test cannot raise, and they preserve "no target, no turn".

## 5. Audit: the mistake class in the workspace

Class: a value that may be an opaque engine userdata (`u_key`, `unit:key()`,
a nav link) is treated as a table or Vector3.

- **LIES** (77 Lua files): the crash site and the three aim sinks above; all
  other union uses are identity compares (`~= focus_enemy.u_key`), truthiness,
  or `enter()` copies. Clean.
- **Out of scope, reported for follow-up:** `mods\GoonmodCustomWaypoints\lua\menumanager.lua:211/264/266/267`
  (`object.type_name` on an arbitrary waypoint, then `object.x/y/z`),
  `mods\Anticrash\lua\menumanager.lua:456` (`type(sender) == 'userdata' and
  sender.type_name == 'RPCCaller'`), `mods\Iter` (`navigationmanager.lua:178-205`
  `is_vec3`/`itr_alive` probing `.x/.y/.z` and `.alive` on unproven userdata,
  `copactionwalk.lua:23`, `coplogictravel.lua:221` using
  `type(x) ~= 'userdata'` as a Vector3 proof, `navigationmanager.lua:1668` using
  `type(x) == 'userdata'` as "is a nav link"). Iter is active and has its own
  gates; handoff in `docs/investigations/iter-opaque-userdata-handoff.md`.

## 6. Tests and claims

| Claim | Evidence | A FAIL means |
| --- | --- | --- |
| the settle check never indexes the union | `dev/tools/test/userdata-shape.test.mjs` (rule 3), `dev/tools/test/door-watch.test.mjs` (`doesNotMatch` on `attention_unit.` and `type_name`) | the crash shape is back |
| the check reads the engine record | `watch_settle_target.lua`: `movement:attention()`, `attention.pos`, three returns | the helper drifted from the engine API |
| a `u_key` target drops the sample without raising | `watch_settle_target.lua` case 6, `newproxy(false)` stand-in (asserted to print and raise like the log's key) | the crash reproduces |
| a live position is measured with the 20-unit band | cases 8: 5 and 20 hold, 25 drops | the band or the units changed |
| no other LIES site assumes a shape from `type()` | `userdata-shape.test.mjs` rules 1, 2, 4 | the class returned |
| the turn sinks use the engine record | `userdata-shape.test.mjs` (two `movement():attention()` in taser, one in boss) | a slow-walk back to the union |

The harness test slices the helper out of the shipped file (no copy to drift)
and accepts an optional path so a pre-fix build can be replayed:
`tools\luajit\luajit.exe dev/test-harness/test/watch_settle_target.lua <old-copy>`
fails on the old signature; it was run that way against `git show HEAD:lua/coplogics/coplogicattack.lua`.

Independent review: a read-only reviewer pass (`cavecrew-reviewer`) over this
fix returned GO with three accepted amendments (nil `movement()` guard, the two
test re-pins, and a test that fails if the helper only reads `pos`; the
reviewer also confirmed the engine getter is reachable from every `_upd_aim`
caller because all three movement classes derive from `CopMovement`). Its
optional suggestion - a `type(aim_pos) ~= "userdata"` rejection guard - was
dropped: `.pos` only ever comes from `_set_attention_on_pos` with a Vector3, so
the guard would be dead code, and the invariant is documented and tested
instead.

## 7. Not yet observed

The fixed path has no live sample yet. Reproduce with `"trace": true` (and
`watch_log` on), door_watch on, High Performance Mode off, on a doorway-heavy
loud heist with tasers; look for `[LIES-TRACE] phase=watch_aim_settle` and zero
LIES Lua errors. The pre-fix trigger (a taser that loses sight of a doorway it
adopted) was a hard game kill, so surviving that run is the signal.

## 8. Player POV

Cops behave exactly as in 8.57.30 - same aim, same turning, same door watching.
The game no longer closes without warning when a taser's aim has settled on a
doorway and then loses sight of it. Door Watching can stay on.

## 9. Decision & artifacts

**Decision.** Read the engine's typed aim record for the settled-facing test
instead of type-sniffing vanilla's untyped `attention_unit` mirror; apply the
same idiom to the three aim sinks that could hand a `u_key` to vector math; gate
the class with a source-scan test plus a runtime harness test; leave the
out-of-scope mods to their own follow-ups.

**Artifacts.**

- `lua/coplogics/coplogicattack.lua` - `lies_settle_target_held(data, pos)` and
  the rewritten comment; call site at 1385.
- `lua/coplogics/specials/taserlogicattack.lua` - both turn targets.
- `lua/coplogics/boss/bosslogicattack.lua` - turn target.
- `dev/tools/test/userdata-shape.test.mjs` - the class gate.
- `dev/test-harness/test/watch_settle_target.lua` - runtime regression test.
- `dev/tools/test/door-watch.test.mjs` - re-pinned target-moved test, new call
  signature in the settled-drop test.
- Version metadata, `changelog.txt` (8.57.31), this report.
- Deploy/test split: the user deploys `dist\LIES` (built by `dev/build.ps1`);
  agents never copy into the game install.

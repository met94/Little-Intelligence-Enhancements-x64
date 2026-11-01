# LIES V8.68_x64: engine crash in the aim pass (freed enemy nav tracker)

Crash-fix report for the session of 2026-10-31 11:03 (heist `red2`). Mod Lua
**was** edited (`lua/coplogics/coplogicattack.lua`, version metadata, changelog).

- **Game:** 248.2 source (`e3a8b616`), installed build `1.0.0-159028`.
- **Mod:** V8.67_x64 (deployed, guard from V8.67 present) → V8.68_x64.
- **Evidence:** `%LOCALAPPDATA%\PAYDAY 2\crash.txt` (11:03:51),
  `crashlog.txt:3494-3535`, `crash.dmp`. The 11:03 session's game log was
  truncated by the 11:07 restart, so no `[LIES-WATCH]` digest survives from it.

## 1. Crash

```
Application has crashed: access violation

Script stack:
            _upd_aim()  @mods/LIES/lua/coplogics/coplogicattack.lua:998
       check_upd_aim()  @mods/LIES/lua/copextensions/copbrain.lua:252
                func()  @mods/LIES/lua/copextensions/copmovement.lua:10
        _upd_actions()  @mods/base/req/core/Hooks.lua:301
            original()  lib/units/enemies/cop/copmovement.lua:770
              update()  @mods/base/req/core/Hooks.lua:293
            original()  lib/units/player_team/teamaimovement.lua:385
                        @mods/base/req/core/Hooks.lua:293
```

`access violation` = native fault, so there is no Lua message. The Lua frame
chain still names the instruction: `focus_enemy.nav_tracker:nav_segment()` inside
`CopLogicAttack._upd_aim`. The bottom frame is `TeamAIMovement:update`, i.e. the
unit was a **team AI bot**, not an enemy cop.

Player POV: the game closed instantly during a firefight, with no error text.

## 2. Root cause

`AIAttentionObject:_register` hands the unit's own tracker to the group-AI
registry (`lib/units/props/aiattentionobject.lua:265-267`:
`self._unit:movement():nav_tracker()`), and `CopMovement:pre_destroy` destroys
that tracker (`lib/units/enemies/cop/copmovement.lua:3403-3407`:
`NavigationManager:destroy_nav_tracker`). Attention objects keep the pointer.

`nav_segment()`/`obstructed()` are engine methods on that tracker object, so a
call after the enemy is gone is an access violation, not a catchable Lua error.

Why LIES reaches it while vanilla does not:

- `CopBrain:update` is LIES's; `CopBrain:check_upd_aim`
  (`lua/copextensions/copbrain.lua:218-256`) is called from
  `CopMovement:_upd_actions` (`lua/copextensions/copmovement.lua:10`) - the
  **movement** update of every server-side unit, cops and team AI alike.
- That runs outside the logic update that refreshes `attention_obj`, so the aim
  pass can use an attention object whose unit died/despawned since the last
  detection tick. Team AI logics refresh attention on their own schedule
  (`TeamAILogicAssault.update`, `TeamAILogicTravel:216`), so the window is real
  for bots even though their logic also aims.
- Vanilla 248.2 reads the enemy tracker only inside a logic update, right after
  detection, and bails when the tracker is nil
  (`coplogicattack.lua:1506-1516`). LIES's own `_upd_aim` (573 lines, ledger
  status **PORT**, still pending) is the old implementation and dereferences the
  cached tracker in four places.

## 3. Fix

`lua/coplogics/coplogicattack.lua`: one helper, used by every aim-path tracker
read.

```lua
local function lies_enemy_tracker(focus_enemy)
	if not focus_enemy then return end
	local unit = focus_enemy.unit
	if not (unit and alive(unit)) then return end
	return focus_enemy.nav_tracker
end
```

- The tracker is freed no later than the unit's destruction (`pre_destroy`), so
  unit liveness is the validity predicate; the helper returns the same tracker
  the registry stored, so **live enemies behave exactly as before**.
- Call sites (six): `_upd_aim` same-segment check, its `obstructed()` test, the
  expected-position branch (`enemy_tracker` replaces `focus_enemy.nav_tracker`),
  `_get_expected_pos` (bails with `expected_pos_path = nil`, mirroring vanilla's
  `if not e_nav_tracker then return end`), `_update_cover`'s `field_position()`
  search, both charge branches feeding `_find_charge_pos`, and
  `_chk_start_action_move_back`'s retreat search. The enemy-unit chatter read at
  the end of `_upd_aim` is gated on the same liveness test.
- Dead/removed enemies simply stop producing aim, cover and charge work.

Player POV: enemies that are alive are aimed at exactly as before; a dead or
despawned enemy no longer takes the session down.

## 4. Decision & artifacts

Decision: **guard at the pointer, not a port**. Porting `_upd_aim` to 248.2's
195-line version is the real backlog item (ledger marks it `PORT`); until then
the tracker reads must not outlive their unit. The helper keeps that invariant
in one place instead of five inline checks.

Artifacts:

- `lua/coplogics/coplogicattack.lua` - `lies_enemy_tracker`, six call sites,
  `_get_expected_pos` bail-out.
- `dev/tools/test/aim-tracker-guard.test.mjs` - pins the helper, forbids
  `focus_enemy.nav_tracker` method/field reads elsewhere in the file, pins the
  `_get_expected_pos` guard.
- `changelog.txt` V8.68_x64, `mod.txt`, `autoupdate.json`, `menumanager.lua`,
  `README.md`, `dev/tools/test/compat.test.mjs`.
- Gates: `dev/tools/gates.ps1` (Node tests, 71/71 Lua compile, freevars, API
  audit), `dev/reports/static-gates.md`.

Deploy/test split: build with `dev/build.ps1`, the user re-enables and deploys
(the mod is currently parked in the game's `disabled mods` folder). Watch
`crash.txt` for a new `access violation` with `_upd_aim`; none is expected.

## 5. Remaining risk

`_upd_aim` still runs from the movement update, so its view of `attention_obj`
can be one detection tick stale. That is now harmless for the tracker, but the
full 248.2 port of `_upd_aim` (and a decision on whether team AI should run this
extra pass at all, since bot logics aim on their own) remains open.

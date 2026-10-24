# Periphery audit — LIES 248.2 port

Read-only audit plus fixes for team AI, civilians, props, mission elements,
menu, and player states. Baseline 246.1 `a3180fc`, target 248.2 `e3a8b616`,
LIES V8.57 `4215a39`.

## Result

The 248.2 periphery changed in only six hooked files, and only two changes
reach LIES code. No 248.2 contract drift required a port rewrite. The audit
did uncover pre-existing LIES-side defects, now fixed where they were clear.

## Fixed

| Severity | File | Defect | Player effect | Fix |
|---|---|---|---|---|
| Medium | `lua\props\securitycamera.lua` `_detect_criminals_loud` | LOS check compared against undefined global `u_key`; slot mask could be nil; `angle_multiplier` leaked global | Loud camera reveal could fire through walls or never fire; intended LOS was not evaluated | Compare `vis_ray.unit:key()` to `c_key`; lazy-init `AI_visibility` mask; local `angle_multiplier` |
| Low | `lua\teamaiextensions\teamaimovement.lua` | LIES stub delegated straight to `super`, dropping vanilla `_should_stay` walk guard and revive/forced exceptions | Bots told to hold could still walk; revive/forced exceptions lost | Restored vanilla `chk_action_forbidden` branch |
| Low | `lua\civlogics\civilianlogictravel.lua` | Follow branch dereferenced `objective.follow_unit` without `alive` | Civilian could throw if its follow target was destroyed mid-travel | Added `alive(objective.follow_unit)` |
| Low | `lua\props\drill.lua` `_register_sabotage_SO` | Guard omitted vanilla `not self._nav_tracker` | Scripted drill with no tracker could nil-index | Re-added tracker guard |
| Low | `lua\managers\mapelements\missionscriptelement.lua` PAL branch | `_obstacle_units` inserted without init | If 101797 ran first, PostHook aborted and nav blockers were skipped | Added the same init guard as the 100945 branch |
| Low | `lua\managers\mapelements\elementdifficulty.lua` | `remove_on_exec[self._id]` indexed the level map with an element id | Pent 101606 "disable assault on execute" fix never ran | Use the local `to_adjust[self._id]` |
| Doc | `dev\reports\hhtacs-audit.md` H-08 | Claimed `has_spawned` was write-only | Deleting it would kill the marshal-marksman harasser swap | Corrected: read by `ElementSpawnEnemyDummy.check_overwrite_spawn_value` |

Regression tests: `dev\tools\test\runtime-audit.test.mjs` now covers the camera
key, team-AI guard, civilian alive guard, drill tracker, both obstacle init
branches, and the difficulty lookup.

## Deferred / no change

- `PlayerBleedOut:on_rescue_SO_administered` bag-drop distance is effectively
  huge (670·28 cm). This looks like intentional "drop only if very far" pacing,
  not a 248.2 regression; no evidence to change it.
- `rvd1` forced follow-up with `base_chance = 0`: 248.2 now returns a backup
  follow-up where 246.1 returned nil. Only affects an authored edge case; no
  action without a symptom.
- `SecurityCamera._destroyed` → `_destroying` was suggested by the audit but is
  wrong: 248.2 writes `_destroyed` at camera destroy. Left unchanged.
- LIES `_execute_coarce_search` omits the vanilla door `delay_time` gate; delay
  is enforced downstream in `coplogictravel`. Pre-existing; no action.

## Checked clean

- Team AI: game files unchanged except fields LIES does not override.
- Civilians: all five overrides map to unchanged 248.2 bodies and dependencies.
- Mission elements: hook targets/classes exist; spawn/civilian contracts intact.
- Props: `carrydata` port applied; drill sabotage contract unchanged.
- Player states: revive SO signature/tweak keys intact.
- Menu: only PSN/X360 and sound-output changes; no LIES reference affected.
- Periphery `_nav_segments` lookups use string ids; no numeric-key path.

## Verification

`runtime-audit` 9/9; full static gates/API/freevars after the fixes.

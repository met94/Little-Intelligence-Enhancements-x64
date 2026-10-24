# LIES 248.2 port — dropped / removed functions

Purpose: one place to review every function or override we removed during the
248.2 port, why it was removed, what replaces it, and when to reconsider.

Related documents:

- `dev/reports/port-decisions.md` — per-function keep / adopt / merge decisions
  for functions we did **not** drop.
- `dev/reports/port-status.md` — current phase, green areas, open backlog.
- `dev/reports/nav-b-feasibility.md` — Nav-B design and risk list.

Status legend: `dropped` = removed from the shipped mod; `replaced` = old
implementation removed and rebuilt against nav v6; `dead file` = present but
never loaded.

## 1. EnemyManager v246 overrides — dropped (commit `61d31b2`)

Whole file `lua/managers/enemymanager.lua` reduced to a comment. The following
11 functions no longer override vanilla 248.2:

| Function | Why dropped |
|---|---|
| `EnemyManager:set_corpse_disposal_enabled` | Used `_corpse_disposal_id` delayed-clbk state; 248.2 uses `_corpse_disposal_t` timer. |
| `EnemyManager:chk_queue_disposal` | Crashed on enemy death: `add_delayed_clbk(..., t)` with nil `t`, `attempt to compare number with nil`. |
| `EnemyManager:corpse_limit_changed_clbk` | Same delayed-clbk disposal model. |
| `EnemyManager:on_civilian_destroyed` | Used `no_dispose`; 248.2 renamed to `no_disposal`. |
| `EnemyManager:on_enemy_destroyed` | Same `no_dispose` / disposal model. |
| `EnemyManager:register_shield` | Used `_shield_disposal_id` / `_fast_shield_disposal`. |
| `EnemyManager:unregister_shield` | Same shield disposal model. |
| `EnemyManager:_upd_shield_disposal` | Did not accept the 248.2 `t` parameter; timer fields changed. |
| `EnemyManager:_update_queued_tasks` | 248.2 rewrote the queued-task path; LIES perf override was v246-specific. |
| `EnemyManager:_execute_queued_task` | Same; 248.2 changed the queue execution contract. |
| `EnemyManager:unqueue_task` | Same. |

Evidence:

- `%LOCALAPPDATA%\PAYDAY 2\crash.txt` (2026-10-23 17:25:55):
  `enemymanager.lua:760: attempt to compare number with nil`, stack
  `chk_queue_disposal() @mods/LIES/lua/managers/enemymanager.lua:42` →
  `on_enemy_died_orig()`.
- After dropping: guard death + SWAT assault smoke passed; `crash.txt` not
  updated on the next run.

Replacement: vanilla 248.2 `EnemyManager` timer-based corpse/shield disposal and
queued-task implementation.

Player impact: normal corpse and shield disposal. LIES's corpse/shield/queue
tuning is gone; no observed gameplay regression in the basic loud smoke.

Review trigger:

- Corpses or shields linger / dispose too slowly.
- `[EnemyManager]` errors after enemy death.
- Interaction with `The Fixes` (it hooks `on_enemy_died`) changes.
- A measured need for LIES's queue-performance tuning returns.

## 2. Dead v5 navigation functions — dropped (commit `316cbf7`)

| Function | Why dropped | Replacement / impact |
|---|---|---|
| `NavigationManager:find_segment_doors_with_nav_links` | Read `_room_doors`; only remaining caller was deleted debug draw. `generate_cover_fwd` now uses the ported `find_segment_doors`. | `find_segment_doors(..., center_only=true)`; no player impact. |
| `NavigationManager:_draw_rooms_LIES` | Debug draw; read `_rooms` (never assigned in nav v6). | Deleted; debug only. |
| `NavigationManager:_draw_doors_LIES` | Debug draw; called the deleted nav-link door lookup. | Deleted; debug only. |
| `NavigationManager:_LIES_register_cover` | Uncalled; iterated script-data covers and would double-count. | Deleted; Nav-B is the supported generation path. |
| `NavigationManager:send_nav_field_to_engine` | Function no longer exists in 248.2; no callers; v5 data format. | 248.2 `_send_nav_field_to_engine(load_data)`. |
| `NavigationManager:_strip_nav_field_for_gameplay` | Function no longer exists in 248.2; no callers. | Deleted. |
| `CopLogicTravel.find_door_pos_nearest_to_next_nav_seg` | No call sites; read `_room_doors`; contained debug `log("help")` and draw code. | Deleted; no player impact. |

Replacement for cover generation: Nav-B in `navigationmanager.lua`
(`_schedule_LIES_cover_generation` and related functions), gated on
`lua_cover >= 2` and host.

Player impact: none expected from the deleted debug/cache functions. Cover
generation still exists via Nav-B.

Review trigger:

- A mod or future LIES code calls any of these names.
- Nav-B cover generation needs the old nav-link door list for a specific map.
- Debug drawing is re-added under a proper dev-only switch.

## 3. Replaced, not dropped

| Old thing | New thing | Reason |
|---|---|---|
| v5 room-based runtime cover generation in `register_cover_units` | Nav-B generation from `_nav_segments` | Rooms and `NavFieldBuilder._calculate_room_center` are editor-only at runtime. |
| `get_nav_segments_in_direction` (vanilla removed) | `NavigationManager:get_nav_segments_in_direction` helper (direct neighbours by dot product) | Besiege grenade/assault code still needs a direction query. |
| `find_segment_doors` v5 numeric doors | v6 vector doors + nav links | Nav v6 door encoding. |
| `_execute_coarce_search` / `_sort_nav_segs_after_pos` v5 door tables | v6 vector doors + nav links | Nav v6 encoding; no `_room_doors`/`_rooms`. |
| `set_nav_segment_state` numeric ids | `tostring(id)` keys | `_nav_segments` keyed by string in v6. |

## 4. Temporary / restored

- `[LIES-TRACE]` logs: temporary crash-localization logs; removed after the
  load/SWAT crash chain was fixed. Not a function drop.
- `NavigationManager._LIES_navlink_elements`: removed during dead-code cleanup,
  then **restored** because `lua/managers/mapelements/elementspecialobjective.lua`
  still writes to it. Do not remove without removing that writer.
- `math_clamp` local and the no-op doorless-cover fallback: removed as dead
  code; no replacement needed.

## 5. Dead files, not deleted

| File | State | Review |
|---|---|---|
| `lua/copextensions/copinventory.lua` | 0 bytes, not hooked | Delete or implement when cop inventory work resumes. |
| `lua/managers/mapelements/elementnavobstacle.lua` | 0 bytes, not hooked | Delete or implement when nav obstacles are revisited. |
| `lua/player/states/playerfatal.lua` | 113 bytes, not hooked; contains a `PlayerFatal.enter` PostHook | Currently never loads. Decide whether to hook it or remove it. |

## 6. Dead recon-sweep subsystem — dropped (commit `9dec81a`)

| Function | Why dropped | Replacement / impact |
|---|---|---|
| `GroupAIStateBesiege:_begin_recon_sweep_task` | No callers; `sweep_task` was never created. | Vanilla `_upd_recon_tasks` remains the only recon driver. No player impact. |
| `GroupAIStateBesiege:_upd_recon_sweep_task` | Only caller of the sweep assignment helpers; never called itself. | Deleted with the sweep path. |
| `GroupAIStateBesiege:_assign_enemy_group_to_recon_sweep` | Only reachable from `_upd_recon_sweep_task`. | Deleted; normal `_assign_enemy_group_to_recon` branch remains. |
| `GroupAIStateBesiege:_assign_enemy_groups_to_recon_sweep` | Only called by `_upd_recon_sweep_task`. | Deleted. |
| `GroupAIStateBesiege:_set_recon_sweep_objective_to_group` | Only called by the sweep helpers. | Deleted; vanilla recon objective flow remains. |

Also removed the permanent `if self._task_data.recon.sweep_task then ...`
fork in `_assign_enemy_group_to_recon`. Audit: `dev/reports/hhtacs-audit.md`
H-05. Regression test: `dev/tools/test/runtime-audit.test.mjs`.

Review trigger: only if recon sweep is deliberately reimplemented against the
248.2 recon driver; do not restore the old dead copy without a caller.

## 7. Do not drop without review (kept LIES bodies)

These remain LIES implementations and are **not** drops:

- `CopLogicBase._upd_attention_obj_detection`
- `CopLogicAttack._upd_aim`
- `TaserLogicAttack._upd_enemy_detection`
- `TaserLogicAttack._cancel_tase_attempt`
- `TankCopLogicAttack.update`
- `CopLogicIdle.damage_clbk` (with the 248.2 `data.t = t` fix)

Pending merges (not dropped): `CopLogicAttack.is_available_for_assignment`,
`CopLogicAttack.action_complete_clbk`, `ShieldLogicAttack.queued_update`,
`CarryData._chk_register_steal_SO`,
`TaserLogicAttack._chk_play_charge_weapon_sound`. Details in
`dev/reports/port-decisions.md`.

## Review checklist

1. Confirm each dropped function still has no call sites:
   `git grep` the name across `lua/`.
2. Confirm the replacement path is covered by a smoke test:
   - corpse/shield disposal → kill a guard, wait, check corpse cleanup.
   - cover generation → `lua_cover 2`, `!lies gen run`, `!lies nav`.
   - nav doors/coarse search → SWAT pathing through doors.
3. Check `mods/logs` for `LEAKING POS RESERVATION`, `nonexistent nav_segment`,
   `attempt to`, and `FATAL ERROR`.
4. If restoring a dropped function, link the motivating regression/log here.

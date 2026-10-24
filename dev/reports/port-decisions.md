# LIES 248.2 port — per-function decisions (core AI + nav)

Scope: the twelve functions listed in `dev/reports/port-status.md` under
"Open — core AI", plus the two remaining `NavigationManager` overrides.

Sources of truth:

- LIES V8.57 bodies in this worktree (`lua/…`), imported at `4215a39`.
- 246.1 vanilla at `a3180fc`, 248.2 vanilla at `e3a8b616`
  (`game-data/Payday-2-LuaJIT-Complete`).
- Per-function bodies/diffs: `dev/reports/dossiers/<function>.md`.
- Symbol/field existence checked directly against the 248.2 clone, not just
  the dossiers.

Two facts that drive most decisions:

1. Every file listed here is a **post-load overlay**. Each fragment calls
   `function CopLogicAttack.…` / `function NavigationManager:…` on an already
   existing class; nothing here re-creates the class. So a function the mod
   defines **replaces** the 248.2 vanilla function wholesale. "Keep LIES" is a
   real replacement, not an additive hook — stale bodies stay stale until
   rewritten.
2. `NavigationManager._nav_segments` is keyed by **string** at 248.2
   (`_load_nav_data` does `self._nav_segments[tostring(nav_seg.id)]`). The
   worktree's own nav code already depends on that (`_LIES_cover_gen_state_new`
   logs "expected string nav segment keys"). Any LIES nav code that indexes
   `_nav_segments` with a raw number is dead code at 248.2.

## Summary

| Function | LIES delta vs 246.1 | 248.2 delta vs 246.1 | Decision | Gate |
|---|---|---|---|---|
| `CopLogicBase._upd_attention_obj_detection` | full rewrite: instant acquire (weapons hot), quick-register, hhtacs ranges, whisper delay, blind-enemy purge, own `_nearly_visible_chk` | only `_nearly_visible_chk` (distance-scaled probe height) | **keep LIES** | smoke |
| `CopLogicAttack._upd_aim` | full rewrite: nav-segment sight logic, wall-peek (`find_walls_across_pos`), cover-fire, aggro/reaction caps, no charge-by-default | **none functional** (`math.lerp(c,o,0)` → `c` is a no-op; dead `debug_pause_unit`/`same_z` removed) | **keep LIES** | smoke |
| `CopLogicAttack.action_complete_clbk` | adds `act`/`heal`/`healed`, cover+movement+aim re-run on completion, `in_cover[7]`, `charging`, `at_cover_shoot_pos` gated on `expired()` | `math.lerp(a,b,math.random())` → `math.rand(a,b)` | **merge** | smoke |
| `CopLogicAttack.is_available_for_assignment` | sets `my_data.attitude`, honours `is_default`, path-fail window 6 → 3 s, sabotage gate; **drops `data.is_suppressed`** | reorders `is_suppressed` ahead of walk/path-fail | **merge** | smoke |
| `CopLogicIdle.damage_clbk` | no forced verify/`verified_pos`; `identify_attention_obj_instant` instead of create+patch; `data.group` guard around `criminal_spotted` | create-time `data.t` → fresh `t` | **keep LIES** (+1-line fresh-time inherit) | static |
| `TaserLogicAttack._upd_enemy_detection` | returns `delay`, drops the wind-up focus lock | local declaration order only | **keep LIES** | smoke |
| `TaserLogicAttack._cancel_tase_attempt` | splits handle (`tasing_action`) from data (`tasing`); nils `tasing` first | inline action table only | **keep LIES** | static |
| `TaserLogicAttack._chk_play_charge_weapon_sound` | distance-scaled 15–30 s cooldown, 3000 range, **z-check dropped** | cooldown 30 → 3 s, range `2000` → `tase_distance * 2` | **merge** (keep LIES scaling, restore z-check) | static/ear |
| `TankCopLogicAttack.update` | `old_action_advancing`, per-frame `attitude`, `next_mov_time` gate, walk/run chase choice | `within_z_distance` refactor, inline action table, `unit:movement()` | **keep LIES** | static |
| `ShieldLogicAttack.queued_update` | movement gates (`next_mov_time`, charging, `follow_unit`), `_chk_wants_to_take_cover`, 2500 sq threshold, `old_action_advancing` | reservation plumbing: `brain:add_pos_rsrv` + `set_pos_rsrv` only on success | **merge** | smoke |
| `CarryData._chk_register_steal_SO` | `sabotage = true` / `sabo_voiceline` markers on pickup+drop objectives | `_add_body_activation_clbk()` helper, server/`_AI_carry` hoisted into first guard | **merge** | smoke-lite |
| `NavigationManager.add_obstacle` | invalidates cached LIES paths that intersect the new obstacle | nil-object guard, destroy listener, field reorder | **merge** | smoke |
| `NavigationManager.set_nav_segment_state` | invalidates cached LIES paths on `forbid_custom` and on disable | `tostring(id)` / `unique_id` everywhere (v6 string segment ids) | **merge — P0** | smoke + log scan |

Priority order for the implementer: `set_nav_segment_state` (live bug),
`add_obstacle`, then `is_available_for_assignment`, `action_complete_clbk`,
`ShieldLogicAttack.queued_update`, `CarryData`, then the taste calls
(detection, `_upd_aim`, taser sound), then the no-op trio.

---

## 1. `CopLogicBase._upd_attention_obj_detection`

Mod: `lua/coplogics/coplogicbase.lua` (function at ~802; nested
`_nearly_visible_chk` at ~899; instant-identify call at ~1021).

**LIES intent.** Rewritten detection: candidates are no longer pre-filtered by
nav-tracker visibility (`chk_vis_func` commented out), weapons-hot acquision is
instant (`identify_attention_obj_instant`), `should_quick_register` grants
instant registration for player team / friends / slot 16, `delay` becomes 0 in
whisper mode, hhtacs dampens `range_mul` and `delay_mul` by 75 %, and
`Global.blind_enemies` purges detections. It also rewrote `_nearly_visible_chk`
to probe the exact point, ±30 sideways, then +30 up, and to maintain
`last_verified_m_pos` / `last_verified_dis` and clear `last_expected` /
`lost_track`.

**248.2 delta.** One hunk, entirely inside `_nearly_visible_chk`: constant
`MAX_DISTANCE = 2000`, and the +100 m probe height becomes
`math.lerp(100, 10, verified_dis / MAX_DISTANCE)`. No field, callback or
signature change anywhere else. `identify_attention_obj_instant` and
`_create_detected_attention_object_data(..., forced)` already exist in 248.2
with the same signatures.

**Decision: keep LIES.** Do not graft 248.2's height ramp onto the LIES probe:
LIES already dropped the fixed +100 and is stricter at range through its
three-probe shape. More importantly, `last_verified_m_pos` is produced *here*
and consumed by `CopLogicAttack._upd_aim` (`find_walls_across_pos` branch,
`enemy_m_pos`); pulling a vanilla `_nearly_visible_chk` back in silently
returns nil `last_verified_m_pos` to aim.

**Merge points (only if the team later wants the ramp).** Inside the LIES
`_nearly_visible_chk`, the `mvector3.add(near_pos, math.UP * 30)` probe is the
one that corresponds to 248.2's `height_over_target`; substitute
`math.lerp(100, 10, math.min(attention_info.verified_dis / 2000, 1))`. Keep the
exact-point and ±30 probes and keep the `last_verified_*` bookkeeping.

**Risk if wrong.** Detection speed is the single most visible LIES feature.
Too permissive → SWAT spots players through cover/walls at range; too strict →
cops ignore players in the open. Scenario: stand behind a wall corner at ~15 m
with weapons hot, then step out — the cop must react within the vanilla notice
window, not instantly and not after several seconds.

**Gate.** Smoke. No static gate can validate notice timing.

## 2. `CopLogicAttack._upd_aim`

Mod: `lua/coplogics/coplogicattack.lua` (~753). Depends on
`_get_expected_pos` (~1314), `chk_should_turn` (~695), `aim_allow_fire`
(~1627), `_chk_enrage` (~1529).

**LIES intent.** Near-total rewrite of aiming: works off
`last_verified_pos` / `last_verified_m_pos`, adds nav-segment equality and
door/segment watching when the enemy is out of sight, wall-peek search via
`managers.navigation:find_walls_across_pos` + `pad_out_position`, cover-fire
from `data.tactics.provide_coverfire_LIES`, charge suppression unless
`enemy_aggro_level >= 4` / `tactics.charge` / tank, hostage-block weapon swap
(`request_switch_to_safe_weapon` / `request_switch_to_normal_weapon`),
per-attack reaction cap via `enemy_reaction_level`, and throwable use through
`LIESBossLogicAttack._chk_use_throwable`.

**248.2 delta.** None functional. The three hunks are
`math.lerp(my_data.weapon_range.close, my_data.weapon_range.optimal, 0)` →
`my_data.weapon_range.close` (identical value), removal of
`debug_pause_unit(... "doesn't have data.internal_data.weapon_range")`, and
removal of the unused `same_z` local. LIES does not use any of those branches.

**Decision: keep LIES.** Note the LIES local fallback `weapon_range`
(`w_td`/`char_tweak.weapon[usage].range`, 2000/5000/1000 backup) is belt-and-
braces: `CopLogicAttack.update` already assigns `my_data.weapon_range` with a
fallback in this worktree, so no change is needed for 248.2.

**Risk if wrong.** Aim is the highest-blast-radius function in the mod. A
mis-merge yields cops that never fire, fire while strafing, or stare at walls.
Scenario: 3–4 SWAT at 10–25 m, player strafing between two cover pieces — cops
must track, shoot, stop firing when the player breaks LOS behind cover, and
re-acquire on peek. Also check a dozer (charge path) and a shield (cover path)
since they share this function.

**Gate.** Smoke, minimal 2–3 min loud run with `enemy_aggro_level` at default
and at 4.

## 3. `CopLogicAttack.action_complete_clbk`

Mod: `lua/coplogics/coplogicattack.lua` (~2210).

**LIES intent.** After `walk`, `act`, `turn`, `heal`, `hurt`/`healed` and
`dodge` complete (and `not highperformance`), re-run
`_update_cover` → `_upd_combat_movement` → `_upd_aim` when there is a
REACT_COMBAT attention object. Also clears `old_action_advancing`, invalidates
`my_data.in_cover` on every walk completion, strips `in_cover[7]`, resets
`cover_test_step`/`flank_cover`, gates `at_cover_shoot_pos` on
`action:expired()`, and handles `healed`/`heal` at all (vanilla 248.2 still
does not).

**248.2 delta.** `data.dodge_timeout_t = time() + math.rand(timeout[1],
timeout[2])` replaces `math.lerp(timeout[1], timeout[2], math.random())`.
`math.rand` is engine-side (used by 248.2 vanilla itself); nothing else in the
function changed, and `healed` is still unhandled by vanilla.

**Decision: merge.** Keep the whole LIES body; change one expression.

**Merge point.** In the `action_type == "dodge"` branch, replace the LIES
`math.lerp(timeout[1], timeout[2], math.random())` with
`math.rand(timeout[1], timeout[2])`.

**Risk if wrong.** Losing the post-action re-run makes cops pause after a walk
or an `act` finishes (they stand until the next queue tick), which looks like
"cops freeze after moving". Losing the `in_cover` reset makes them believe
they are in cover that no longer exists → they stop shooting or sit in the
open. Scenario: watch a SWAT walk from cover A to cover B; it must resume
firing the same tick it arrives. Second scenario: cop takes cover, player
flanks; cop must leave cover and re-engage.

**Gate.** Smoke.

## 4. `CopLogicAttack.is_available_for_assignment`

Mod: `lua/coplogics/coplogicattack.lua` (~2473).

**LIES intent.** Copies `new_objective.attitude` into `my_data.attitude`
before any return, accepts `is_default` objectives unconditionally, shortens
the path-failure lockout from 6 s to 3 s, and replaces the suppression gate
with `CopLogicBase.check_sabotage_objective_not_allowed(data, new_objective)`
(which itself reads `objective.sabotage`, `brain:objective_is_sabotage`, and
`_nav_segments[objective.nav_seg]`).

**248.2 delta.** Pure reorder: `data.is_suppressed` moves above
`chk_action_forbidden("walk")` and the path-fail check. Same set of gates, but
suppression now wins over the walk-forbidden and path-fail returns.

**Decision: merge.** The LIES diff *swapped* the suppression block for the
sabotage block rather than adding to it (`- if data.is_suppressed then
+ if CopLogicBase.check_sabotage_objective_not_allowed(...)`). There is no
LIES design note justifying dropping suppression, and 248.2 reinforces it by
hoisting it. Restore it.

**Merge points.** Final order:
`exiting` → `attitude` copy → `forced` → `is_default` → **`data.is_suppressed`**
→ `chk_action_forbidden("walk")` → `path_fail_t + 3` →
`check_sabotage_objective_not_allowed` → attention checks → `is_obstructed`.
Keep the LIES 3 s lockout and the sabotage gate as-is.

**Risk if wrong.** With suppression restored, a suppressed cop refuses a new
objective — correct per 248.2, but if LIES relied on suppressed cops still
relocating, they will now hold position more. Scenario: light a cop up with an
LMG/throw a flashbang, then break LOS; a suppressed cop should stay put and
not be draggable to a new cover across the room. Watch for cops that stand in
the open instead of relocating under fire.

**Gate.** Smoke (suppression interaction is only visible live).

## 5. `CopLogicIdle.damage_clbk`

Mod: `lua/coplogics/coplogicidle.lua` (~1663).

**LIES intent.** On damage, do not force `verified = true` /
`verified_pos`; only stamp `dmg_t`/`alert_t`, clear `notice_delay`, run the
identified callbacks once, and use `identify_attention_obj_instant` for the
not-yet-detected attacker (which also sets `verified_m_pos`). `criminal_spotted`
/ `report_aggression` only when `data.group` exists.

**248.2 delta.** `_create_detected_attention_object_data(data.t, …)` →
`(t, …)`, where `t = TimerManager:game():time()`. Fixes stale timestamps
(`next_verify_t`, `prev_notice_chk_t`) when detection was updated earlier in
the frame.

**Decision: keep LIES**, with an optional one-line inherit of the 248.2 fix.

**Merge point.** LIES already computes `local t = TimerManager:game():time()`
at the top of the branch. Before calling
`CopLogicBase.identify_attention_obj_instant(data, enemy_key)`, set
`data.t = t` so the helper stamps fresh timestamps (it reads `data.t`
internally). Nothing else changes.

**Risk if wrong.** Very low. Worst case is a notice/verify timestamp up to one
tick stale → attacker noticed slightly later. Scenario: shoot an idle cop from
behind; it must turn and return fire immediately, not finish its idle action
first.

**Gate.** Static. (The optional `data.t = t` line is behaviourally neutral and
covered by the normal smoke.)

## 6. `TaserLogicAttack._upd_enemy_detection`

Mod: `lua/coplogics/specials/taserlogicattack.lua` (~260).

**LIES intent.** Consume the detection return value and propagate `delay`
through all three exits (falls through to `queued_update`'s scheduling), and
drop the vanilla wind-up focus lock: vanilla keeps the current focus while
`tase_in_effect` **or** `data.t - tasing.start_t < max(1, aim_delay_tase[2] *
1.5)`; LIES only keeps it while `tase_in_effect`, so focus can be re-evaluated
during the charge animation.

**248.2 delta.** Local declaration order only (`under_multiple_fire` before
`under_fire_nr`). No behaviour change.

**Decision: keep LIES.** The delay plumbing is required by the LIES detection
rewrite; the wind-up change is LIES intent (it is visible as tasers acquiring
a new target while the previous one leaves cover).

**Flag for the tester, not a code change.** Confirm tasers do not visibly
switch targets mid-charge and waste the zap. If they do, the fix is to restore
the `tasing and data.t - tasing.start_t < math.max(1,
data.char_tweak.weapon.is_rifle.aim_delay_tase[2] * 1.5)` arm of the
condition — `tasing.start_t` still exists in the LIES taser data (set at
~221).

**Risk if wrong.** Cosmetically: a taser charges, the target ducks, and the
taser re-targets, losing the shot. Functionally worse: repeated charge cycles
with no zap. Scenario: face a taser from ~8 m, step behind cover during its
charge whine, step back out.

**Gate.** Smoke (taser encounter).

## 7. `TaserLogicAttack._cancel_tase_attempt`

Mod: `lua/coplogics/specials/taserlogicattack.lua` (~473).

**LIES intent.** Clear `my_data.tasing` *before* requesting the idle action,
and gate the idle request on the action handle `my_data.tasing_action` instead
of the data table.

**248.2 delta.** Formatting only (inline action table). No caller or semantic
change; the 248.2 callers are still `TaserLogicAttack.exit`,
`on_criminal_neutralized`, `on_detected_enemy_destroyed` — none of which the
mod overrides, so the LIES body is reached.

**Decision: keep LIES.** The handle-gate is the correct fix for the
"tasing data present but action already finished" case.

**Side effect to document, not fix.** Because `tasing` is nil'd first,
`action_complete_clbk("tase")` skips `on_tase_end(target_key)`. That only
clears `record.being_tased`, which 248.2 never reads (only writes at
`on_tase_start`/`on_tase_end`), so there is no AI consequence. Do not add an
`on_tase_end` call to compensate — that would double-clear on the normal path.

**Risk if wrong.** Low. Worst case is a stale `being_tased` bookkeeping field
with no reader. Scenario: kill a criminal while a taser is charging; the taser
must go idle and later tase normally.

**Gate.** Static.

## 8. `TaserLogicAttack._chk_play_charge_weapon_sound`

Mod: `lua/coplogics/specials/taserlogicattack.lua` (~440).

**LIES intent.** Charge whine cooldown scales with distance
(`math.lerp(15, 30, verified_dis / 3000)`) and is audible out to 3000 (vanilla
30 s / 2000). Gates on `tasing_action`.

**248.2 delta.** Cooldown 30 s → **3 s**, range `2000` →
`data.internal_data.tase_distance * 2` (`tase_distance` is assigned in the
taser's `enter`, ~800–1000, so ≈1600–2000). The vertical guard
`math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300` survives in both vanilla
revisions.

**Decision: merge.** Keep the LIES distance-scaled cooldown and 3000 range —
the 3 s 248.2 cadence is exactly the spam LIES removed. Restore the vertical
guard, which the LIES rewrite dropped without a compensating mechanic (the
result is a charge whine audible through floors above/below).

**Merge point.** Single condition:
`if not my_data.tasing_action and (not data.last_charge_snd_play_t or data.t -
data.last_charge_snd_play_t > math.lerp(15, 30, focus_enemy.verified_dis /
3000)) and focus_enemy.verified_dis < 3000 and math.abs(data.m_pos.z -
focus_enemy.m_pos.z) < 300 then`.

**Risk if wrong.** Audio-only. Scenario: stand one floor above a taser; no
charge whine should leak through the ceiling.

**Gate.** Static (verifiable by ear in any smoke run).

## 9. `TankCopLogicAttack.update`

Mod: `lua/coplogics/specials/tankcoplogicattack.lua` (~39).

**LIES intent.** `old_action_advancing` treated like `has_old_action` (retry
after `_upd_stop_old_action`), per-frame
`my_data.attitude = data.objective.attitude or "engage"`, `next_mov_time`
movement gate owned by the LIES `CopBrain:get_movement_delay` /
`request_stillness` machinery, and the walk/run decision
(`walk and "walk" or "run"`) instead of always `"run"`.

**248.2 delta.** `z_dist` → `within_z_distance` (same value),
`data.unit:movement()` → `unit:movement()` (same unit), inline
`action_request({...})`. No new fields or callbacks, no behaviour change.

**Decision: keep LIES.** Optional cosmetic rebase (adopt `within_z_distance`
naming) so future 248.3 diffs stay small; behaviour must not change.

**Risk if wrong.** Dozer either stops chasing (`next_mov_time` gate never
satisfied) or charges non-stop (gate lost). Scenario: aggro a dozer at 30 m,
break LOS around a corner; it must keep closing, and must not freeze.

**Gate.** Static. (Dozer behaviour is covered by any loud smoke.)

## 10. `ShieldLogicAttack.queued_update`

Mod: `lua/coplogics/specials/shieldlogicattack.lua` (~433; reservation block
~524–540).

**LIES intent.** `old_action_advancing`, `my_data.want_to_take_cover =
CopLogicAttack._chk_wants_to_take_cover(...)`, movement gated by
`data.next_mov_time` / flash-shield `is_charging()`, ignore `optimal_pos` while
escorting (`data.objective.follow_unit`), raycast only when engaging and not
recently verified, 50 m (`2500` sq) dead-zone instead of 100 m (`10000` sq),
and a 70-radius fallback reservation.

**248.2 delta.** Reservation plumbing only: on success
`data.brain:set_pos_rsrv("path", reservation)` moved *inside* the `if
reservation` branch; the fallback becomes
`data.brain:add_pos_rsrv("path", {radius = 60, position = copy(to_pos)})` with
no `filter` field and no `managers.navigation:add_pos_reservation` call.

**Decision: merge.** Keep the entire LIES movement block and adopt 248.2's
reservation block.

**Merge points.** Replace the LIES block
`if reservation then to_pos = reservation.position else reservation = {radius
= 70, position = ..., filter = data.pos_rsrv_id}; managers.navigation:add_pos_reservation(reservation) end; data.brain:set_pos_rsrv("path",
reservation)` with 248.2's:
`if reservation then to_pos = reservation.position;
data.brain:set_pos_rsrv("path", reservation) else data.brain:add_pos_rsrv("path", {radius = 70, position = mvector3.copy(to_pos)}) end`.
Keep LIES's 70 radius in the fallback (LIES widened 60 → 70 on purpose).
`CopBrain:add_pos_rsrv` sets `filter` itself from `data.pos_rsrv_id`, so the
explicit `filter` is redundant; `set_pos_rsrv` requires `pos_rsrv.id`, which
only `add_pos_reservation`/`add_pos_rsrv` supply — hence 248.2's split.

**Risk if wrong.** Classic symptom is `[NavigationManager:add_pos_reservation]
LEAKING POS RESERVATION!!` in the log plus shields that freeze in place (they
hold a reservation for a position they never path to), or shields that never
reposition (gate stuck). Scenario: fight 2–3 shields in a corridor; they must
advance cover-to-cover every few seconds, not stand still or jitter.

**Gate.** Smoke + log scan for `LEAKING POS RESERVATION` and
`missing id` debug pauses.

## 11. `CarryData._chk_register_steal_SO`

Mod: `lua/props/carrydata.lua` (whole file is this one function, 128 lines).

**LIES intent.** Adds `sabotage = true` and `sabo_voiceline` (`"gatherloot"` on
the drop objective, `"none"` on pickup) to both special objectives, so the LIES
sabotage gating (`CopLogicBase.check_sabotage_objective_not_allowed`,
`CopBrain:objective_is_sabotage`, `coplogicintimidated`, `coplogicflee`) treats
loot handling as sabotage work. These markers do not exist in any vanilla
revision — they are LIES-only and the gate silently stops working without them.

**248.2 delta.** Extracts `_add_body_activation_clbk()` (new helper, also
called from vanilla at three other sites), and hoists guards:
`if not Network:is_server() or not self._link_body or not self._AI_carry then
return end` first, then `_add_body_activation_clbk()`, then
`_steal_SO_data / _linked_to / _zipline_unit`, then `_link_body:active() or not
managers.navigation:is_data_ready()`, then the drop-point lookup (same `+10`
retry clbk).

**Decision: merge.** Adopt the 248.2 guard order and helper; keep the LIES
objective fields exactly as they are (both `drop_objective` and
`pickup_objective`, plus `so_descriptor`).

**Merge points.** Function head: replace the LIES `if not self._link_body` /
inline `_has_body_activation_clbk` block with the 248.2 guard +
`self:_add_body_activation_clbk()`. Leave
`type/sabo_voiceline/sabotage/interrupt_health/path_ahead/action_duration/
haste/pose/interrupt_dis` in both objective tables untouched.

**Risk if wrong.** Adopting 248.2 *without* the LIES markers → AI-carried bags
are no longer treated as sabotage; armed cops/hostages can be assigned to the
pickup, and the "no sabotage while enemies are close" behaviour disappears.
Keeping LIES without the 248.2 guards → body-activation callback re-registered
or registered on the wrong peer. Scenario: kill a cop carrying a loot bag, let
another cop pick it up; the bag must be carried and secured, and no cop should
start "untie" work on it while the player is shooting at him.

**Gate.** Smoke-lite. Static checks can only confirm the fields and helper
exist; the objective flow needs one bag cap.

## 12. `NavigationManager.add_obstacle`

Mod: `lua/managers/navigationmanager.lua` (~1351).

**LIES intent.** After fetching `obstacle_obj`, walk `self._cached_paths` and
set `cached_path_data.invalidated = true` for any cached path containing a
navpoint inside the new obstacle (`obstacle_obj:inside_bv(check_navpoint)`).

**248.2 delta.** New: fetch object first, `Application:error` + return when the
object is missing, then register a destroy listener
(`NavigationManager._OBSTACLE_DESTROY_KEY` →
`_clbk_obstacle_unit_destroyed(obstacle_obj_name)`) via
`obstacle_unit:unit_data()`, then add to the quad field. The debug-only
duplicate check is gone. `_clbk_obstacle_unit_destroyed` and the key constant
are plain vanilla class members at 248.2, so the overlay can use them.

**Decision: merge.** Adopt 248.2's object guard + destroy listener and keep the
LIES cached-path invalidation between the guard and
`self._quad_field:add_obstacle`.

**Merge points.** Order: `get_object` → `if not obstacle_obj then
Application:error(...); return end` → `unit_data():add_destroy_listener(...)`
→ LIES `_cached_paths` invalidation loop → `add_obstacle` →
`table.insert(self._obstacles, {id, unit, obstacle_obj_name})`. Keeping the
LIES code without the guard means `obstacle_obj:inside_bv` throws when a level
references a missing object; keeping it without the listener means destroyed
obstacle units stay in `self._obstacles` and in the quad field (ghost blocker,
or use of a freed object).

**Risk if wrong.** Callers are `ElementNavObstacle` (level nav blockers that
toggle on/off) and the CG22/piggybank mutators. Scenario: trigger a nav-obstacle
element (e.g. a blocker that is removed when a door opens); after the obstacle
unit is destroyed, AI must not path around an invisible blocker, and no Lua
error may reference `inside_bv` or `_clbk_obstacle_unit_destroyed`.

**Gate.** Smoke. Watch the log for `There was no obj to reference` and for
errors from `_quad_field:add_obstacle`.

## 13. `NavigationManager.set_nav_segment_state` — P0, live bug

Mod: `lua/managers/navigationmanager.lua` (~1442; the two LIES invalidation
loops compare `check_seg == id` at ~1471 and ~1518).

**LIES intent.** After `forbid_custom` (and after a segment is disabled),
invalidate cached LIES paths that traverse the affected segment:
`convert_bastards(filter_group)` → `ai_groups_so_accesses[...]` to pre-filter
by access string, then `self:get_nav_seg_from_pos(check_navpoint, true)` and
compare with the segment id.

**248.2 delta.** `local unique_id = tostring(id)` and every lookup/engine call
uses it: `self._nav_segments[unique_id]`,
`set_nav_segment_blocked_filter(unique_id, …)`,
`is_nav_segment_enabled(unique_id)`, `set_nav_segment_enabled(unique_id, …)`,
`on_nav_segment_state_change(unique_id, …)`.

**Why this is a live bug, not a port chore.** `_load_nav_data` keys
`_nav_segments` by `tostring(nav_seg.id)`. The only production caller is
`ElementAIGraph:on_executed`, which iterates `self._values.graph_ids` — numeric
ids authored in the editor against `unit:unit_data().unit_id` (numeric). With
the current LIES body, `self._nav_segments[<number>]` is `nil`, so the function
`debug_pause`s and returns: **every scripted AI-graph operation is dropped**
(segment never blocked/enabled, `on_nav_segment_state_change` never fires).
The LIES invalidation comparisons would also never match, because
`get_nav_seg_from_pos` returns the string key.

**Decision: merge (adopt 248.2).**

**Merge points.** Add `local unique_id = tostring(id)` at the top and use it for
every `_nav_segments` index, every `_quad_field` call and the
`on_nav_segment_state_change` argument. In both LIES invalidation loops compare
`check_seg == unique_id`. Keep
`convert_bastards`/`ai_groups_so_accesses`/`access_pos_str` pre-filtering and
`cached_path_data.invalidated = true` exactly as they are. Keep the
`blocked_group` bookkeeping on the `unique_id` entry.

**Risk if wrong.** High and silent: cops never receive access to areas that
missions unlock at runtime, so they hold at the boundary ("SWAT never comes
upstairs/into the vault"), and the LIES path cache keeps serving routes through
closed segments. Detection is easy in the log:
`[NavigationManager:set_nav_segment_state] nonexistent nav_segment <number>`.
Scenario: any heist with a scripted nav-graph element that gates an area
(opening a gate/door, unlocking the objective area) — trigger it and watch
whether cops path in.

**Gate.** Smoke + log scan. Add the log pattern above to the smoke checklist.

---

## Ordered work list

1. `set_nav_segment_state` — string ids; log-scan for `nonexistent nav_segment`.
2. `add_obstacle` — nil guard + destroy listener, keep cache invalidation.
3. `is_available_for_assignment` — restore suppression gate in 248.2 order.
4. `action_complete_clbk` — `math.rand` only.
5. `ShieldLogicAttack.queued_update` — 248.2 reservation block.
6. `CarryData._chk_register_steal_SO` — 248.2 head guards + helper, keep
   sabotage markers.
7. `_chk_play_charge_weapon_sound` — restore vertical guard.
8. `CopLogicIdle.damage_clbk` — optional `data.t = t` before instant identify.
9. Keep as-is (no edit): `_upd_attention_obj_detection`, `_upd_aim`,
   `_upd_enemy_detection`, `_cancel_tase_attempt`, `TankCopLogicAttack.update`.

## Notes for the reviewer

- `Global.blind_enemies` is written nowhere in the game or the mod; the
  detection purge branch is dead. Leave it (zero cost, intended for a
  flashbang feature that never landed here) but do not cite it as coverage.
- `math.rand` is engine-provided at 248.2 (vanilla calls it); do not replace it
  with a Lua shim.
- `my_data.weapon_range`, `my_data.attitude`, `next_mov_time`,
  `old_action_advancing`, `has_old_action` and `tasing_action` are all
  available at 248.2: the first two from 248.2 vanilla, the rest from the LIES
  `CopBrain`/`CopLogicAttack` overlays already in this worktree.
- Run after the edits: `luajit -bl` on each touched file,
  `node dev/tools/api-audit.mjs`, ledger closure, plus
  `node tools/lua-freevars.mjs lua/managers/navigationmanager.lua --game
  <gamefile>` for the nav file.

---

## Group AI audit additions (2026-10-24)

- **rvd1 forced follow-up (`ElementSpecialObjective:choose_followup_SO`):**
  accept 248.2 `backup_pool` behavior. LIES no longer gets `nil` for an
  all-zero-weight followup, so its idle fallback is reached less often. Only
  edge-cases authored with `base_chance = 0`; cosmetic.
- **Whisper-mode `on_criminal_nav_seg_change`:** no change. 248.2
  `_on_area_safety_status` returns early in whisper mode; LIES clears
  `area.is_safe` first, but `is_area_safe()` recomputes from criminals and
  pathing/spawn checks are unaffected.
- **`_get_spawn_unit_name` boss gate:** keep LIES behavior (no vanilla
  `max_nr_simultaneous_boss_types` gate). Intentional LIES special pressure;
  do not "fix" without a measured spawn issue.
- **Recon truncation:** keep the 248.2 `#coarse_path - forwardmost_i_nav_point`
  loop form, including its one-extra removal. Parity-safe; re-target node is
  the one behind the forwardmost point.

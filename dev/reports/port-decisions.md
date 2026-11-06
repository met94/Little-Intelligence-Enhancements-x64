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
| `CopLogicBase._upd_attention_obj_detection` | full rewrite: instant acquire (weapons hot), quick-register, hhtacs ranges, whisper delay, blind-enemy purge, own `_nearly_visible_chk` | only `_nearly_visible_chk` (distance-scaled probe height) | **keep LIES + merge 248.2 near-visible height (8.57.24)** | smoke |
| `CopLogicAttack._upd_aim` | full rewrite: nav-segment sight logic, wall-peek (`find_walls_across_pos`), cover-fire, aggro/reaction caps, no charge-by-default | **none functional** (`math.lerp(c,o,0)` → `c` is a no-op; dead `debug_pause_unit`/`same_z` removed) | **port 248.2 body + ledger blocks 5-9** (8.57.19/8.57.21; blocks 1-4 retired) | smoke |
| `CopLogicAttack.action_complete_clbk` | adds `act`/`heal`/`healed`, cover+movement+aim re-run on completion, `in_cover[7]`, `charging`, `at_cover_shoot_pos` gated on `expired()` | `math.lerp(a,b,math.random())` → `math.rand(a,b)` | **merge — applied `f0370d4`, verified complete 2026-11-01** | smoke |
| `CopLogicAttack.is_available_for_assignment` | sets `my_data.attitude`, honours `is_default`, path-fail window 6 → 3 s, sabotage gate; **drops `data.is_suppressed`** | reorders `is_suppressed` ahead of walk/path-fail | **merge** | smoke |
| `CopLogicIdle.damage_clbk` | no forced verify/`verified_pos`; `identify_attention_obj_instant` instead of create+patch; `data.group` guard around `criminal_spotted` | create-time `data.t` → fresh `t` | **keep LIES** (+1-line fresh-time inherit) | static |
| `TaserLogicAttack._upd_enemy_detection` | returns `delay`, drops the wind-up focus lock | local declaration order only | **keep LIES** | smoke |
| `TaserLogicAttack._cancel_tase_attempt` | splits handle (`tasing_action`) from data (`tasing`); nils `tasing` first | inline action table only | **keep LIES** — verified present 2026-11-01 (`38b8582`) | static |
| `TaserLogicAttack._chk_play_charge_weapon_sound` | distance-scaled 15–30 s cooldown, 3000 range, **z-check dropped** | cooldown 30 → 3 s, range `2000` → `tase_distance * 2` | **merge — applied, verified present 2026-11-01** (`38b8582`; 300 guard `:446`, lerp `:441`, 3000 range) | static/ear |
| `TankCopLogicAttack.update` | `old_action_advancing`, per-frame `attitude`, `next_mov_time` gate, walk/run chase choice | restyle only (`within_z_distance`, inline action table, `unit:movement()`) | **keep LIES — inert fallback**: every dozer variant is remapped to `LIESBossLogicAttack` (`lua/copextensions/copbrain.lua:3-10`); latent `old_action_advancing` latch documented, not fixed (§9) | static |
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
and read by `LIESBossLogicAttack._chk_use_throwable` (`bosslogicattack.lua:839/856`,
no fallback) — that is the exposed consumer. `ShieldLogicAttack`
(`shieldlogicattack.lua:90`) uses `enemy_data.last_verified_m_pos or enemy_data.m_pos`,
so it degrades to the current position rather than nil. The aim body itself stopped
reading it in 8.57.19 when the `find_walls_across_pos` branch was retired
(`dev/reports/aim-port-behaviour-ledger.md` block 3), but a vanilla
`_nearly_visible_chk` would still silently return nil `last_verified_m_pos` to the
boss callers.

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

**Update (8.57.24, `c409ba4`):** the "do not graft the ramp" half of this verdict is
superseded — see *Near-visible probe height* at the end of this file. The LIES
rewrite of the pass stays; only the vertical fallback probe adopted the 248.2
height scaling. The `last_verified_m_pos` consumer argument below is why the
helper itself is still the LIES one, not vanilla's.

## 2. `CopLogicAttack._upd_aim`

Mod: `lua/coplogics/coplogicattack.lua` (8.57.21 body spans `~870-1200`). Depends on
the vanilla `_get_expected_attention_position`, `chk_should_turn`,
`aim_allow_fire`, `_chk_enrage`, `LIESBossLogicAttack._chk_use_throwable`,
`CopBrain:request_switch_to_safe_weapon` / `request_switch_to_normal_weapon`
and `CopLogicAttack._cancel_charge` (vanilla).

**LIES intent (pre-port).** Near-total rewrite of aiming: works off
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

**Decision: port to the 248.2 body, then re-add the ledger blocks.**
8.57.19 (`bbb30fa`) replaced the body with vanilla because the LIES body aimed
through the enemy's cached navigation tracker and that is the 2026-10-31 access
violation (`dev/reports/aim-stale-nav-tracker-crash.md`); the per-block verdicts
are in `dev/reports/aim-port-behaviour-ledger.md`. 8.57.21 restored the blocks
that ledger marks RE-ADD:

- script-free and back in the body: charge abort + `tankboss` table (block 5),
  turn-to-shoot concessions (block 6), hostage safe-weapon pair (block 7),
  `_chk_enrage` / `_chk_use_throwable` (block 8), reload callout (block 9);
- 8.57.22 restored block 10 in corrected form: `level < 3 and not
  data.unit:in_slot(16) and not data.is_converted and not (data.team and
  data.team.id == "criminal1") and not (data.tactics and
  data.tactics.provide_coverfire_LIES)`, `2 / level` with the level computed and
  clamped before the gate, and a private `focus_enemy.lies_react_t` timer. The
  7.84 clause `and not data.team.id == "criminal1"` is
  `(not data.team.id) == "criminal1"`, i.e. constant `false`, so the block is a
  re-derivation rather than a re-copy and needs in-game verification at each
  menu value. Coverfire is exempt because the hold would otherwise silence the
  suppression fire block 7 exists for. **Superseded in 8.57.32:** the block now
  takes the delay from `LIES:ReactionDelay()` (HIGH = 0.5 s added; HIGH took
  value 3, ULTRA-VIOLENCE moved to 4), arms only after a >2 s gap without
  verification instead of on every stale pass, and the digest carries
  `react_delay`; the `level < 3` / `2 / level` form above is history, not the
  current contract;
- the watch position comes from `_get_expected_attention_position`, so nothing
  in `_upd_aim` reads `nav_tracker`, `_nav_segments`, `find_segment_doors` or
  `find_walls_across_pos`;
- retired on purpose, do not re-add without a new decision: blocks 1-4 (tracker
  and its derivatives), block 11 (0.5 s shoot-stop hold, written against the old
  action-handle `my_data.shooting`) and block 12 (weapon-range self-heal; the
  caller already guarantees the field).

The LIES local fallback `weapon_range` (`w_td`/`char_tweak.weapon[usage].range`,
2000/5000/1000 backup) stays retired: `CopBrain:check_upd_aim` returns early
without `internal_data.weapon_range` (`copbrain.lua:248-250`) and
`CopLogicAttack.enter` sets it for the attack family.

**Risk if wrong.** Aim is the highest-blast-radius function in the mod. A
mis-merge yields cops that never fire, fire while strafing, or stare at walls.
Scenario: 3–4 SWAT at 10–25 m, player strafing between two cover pieces — cops
must track, shoot, stop firing when the player breaks LOS behind cover, and
re-acquire on peek. Also check a dozer (charge path, and now enrage) and a
shield (cover path) since they share this function.

**Gate.** Smoke, minimal 2–3 min loud run with `enemy_aggro_level` at default
and at 4, once with `hhtacs` on and once with a dozer in the wave. Static gates:
`dev/tools/test/aim-behaviour-ledger.test.mjs` and
`dev/tools/test/aim-tracker-guard.test.mjs`.

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

**Applied `f0370d4`; verified complete 2026-11-01.** Re-ran `tools/pd2fn.ps1
-From 246.1 -To 248.2 -Path lib/units/enemies/cop/logics/coplogicattack.lua
-Class CopLogicAttack -Name action_complete_clbk`: one hunk, the `math.rand`
line, and the LIES body carries it (`lua/coplogics/coplogicattack.lua:2547`).
No other 248.2-only construct in the function.

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

## 9. `TankCopLogicAttack.update` — inert fallback (do not port)

Mod: `lua/coplogics/specials/tankcoplogicattack.lua` (~39).

**Status: inert fallback** (re-verified 2026-11-01 at `38b8582`;
`dev/reports/tank-taser-reverify.md`). The body is correct for 248.2, but in a
LIES profile it never runs. `lua/copextensions/copbrain.lua:3-10` rebinds
`CopBrain._logic_variants.triad_boss.attack = LIESBossLogicAttack` (`:3`) and
then points every dozer tweak table at that entry — `tank` (`:6`),
`tank_medic` (`:7`), `tank_mini` (`:8`), `tank_hw` (`:9`), `piggydozer`
(`:10`) — before any unit spawns, and `CopBrain:post_init` resolves `_logics`
from that same table (248.2 `copbrain.lua:126`, `:156`). Vanilla's
`logic_variants.tank.attack = TankCopLogicAttack` (248.2 `:109`) is therefore
**orphaned**: no other file in the mod references `TankCopLogicAttack` (5 grep
hits, all inside its own file), and dozers run `LIESBossLogicAttack`
(`lua/coplogics/boss/bosslogicattack.lua:166-241`). No port work should be
spent here, and the cosmetic `within_z_distance` rebase buys nothing while the
body is dead.

**LIES intent (kept as written, for the fallback).** `old_action_advancing`
treated like `has_old_action` (retry after `_upd_stop_old_action`), per-frame
`my_data.attitude = data.objective.attitude or "engage"`, `next_mov_time`
movement gate owned by the LIES `CopBrain:get_movement_delay` /
`request_stillness` machinery, and the walk/run decision
(`walk and "walk" or "run"`) instead of always `"run"`.

**248.2 delta.** Restyle only: `z_dist` → `within_z_distance` (same
predicate, hoisted), `data.unit:movement()` → `unit:movement()` (same unit,
`unit = data.unit`), inline `action_request({...})`. No new fields or
callbacks, no behaviour change.

**Decision: keep LIES** — as an inert fallback. Not a port, not a rebase, not
a deletion: the file costs nothing and is the body that would come back if the
remap were ever reverted.

**Known risk — latent latch, documented not fixed.** `old_action_advancing` is
a LIES-only field, set by `CopLogicIdle._chk_has_old_action`
(`lua/coplogics/coplogicidle.lua:131-140`) and cleared in the
`action_complete_clbk` of every other attack-family logic that gates on it
(`coplogicattack.lua:2467`, `taserlogicattack.lua:343`,
`shieldlogicattack.lua:564`, `spooclogicattack.lua:226`,
`bosslogicattack.lua:704`, `coplogictravel.lua:1594`,
`coplogicidle.lua:1942`, `teamailogicassault.lua:417`,
`teamailogicidle.lua:442`, `coplogicsniper.lua:176`,
`coplogicarrest.lua:468`). The tank has **no clear**: `enter` calls
`CopLogicIdle._chk_has_old_action` (`:22`), its
`action_complete_clbk` (`:222-239`) clears `advancing` (`:227`) but not
`old_action_advancing`, and `CopLogicAttack._upd_stop_old_action` cannot
interrupt an in-progress walk (it requests idle only when
`chk_action_forbidden("walk")` is false, which it is not while the walk action
still owns body part 2). So if the body were ever reachable, the `update` gate
at `:44-48` could latch: `update` would `return` every frame after the current
walk ends, and the dozer would stop starting chase walks (it would still shoot —
aim/fire run from `CopBrain:check_upd_aim`).

- Condition that makes it live: the remap in `copbrain.lua:3-10` removed or
  reverted, or `CopBrain._logic_variants` otherwise re-exposed with vanilla's
  `tank.attack` — any change that lets `TankCopLogicAttack` be reached.
- Why it is not a live bug today: the body is never entered (§ above), and the
  body that does run — `LIESBossLogicAttack` — clears the field in its own
  `action_complete_clbk` (`bosslogicattack.lua:704`) while re-arming it
  deliberately when it cannot stop the current walk (`:762-765`).
- If that condition ever happens: the two-line `action_complete_clbk` clear on
  `"walk"` (same shape as `bosslogicattack.lua:704`) must ship **with** the
  remap change. It is dead code while the remap stands, so it is not added
  now.

**Also verified present in this pass** (the two rows previously recorded as
applied, re-read against the current bodies):

- `TaserLogicAttack._cancel_tase_attempt` (§7) — `tasing` nil'd first, body-part-3
  idle gated on the `tasing_action` handle (`lua/coplogics/specials/taserlogicattack.lua:487-498`).
- `TaserLogicAttack._chk_play_charge_weapon_sound` (§8) — the recorded merge is
  in the body: 300-unit vertical guard present (`:446`), distance-scaled
  cooldown `math.lerp(15, 30, focus_enemy.verified_dis / 3000)` (`:441`),
  3000 range (`:441`). 248.2's 3 s cadence and `tase_distance * 2` range
  deliberately not taken.

**Gate.** Static. (Dozer behaviour is covered by any loud smoke — and today it
is the boss logic that produces it, not this file.)

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
4. `action_complete_clbk` — `math.rand` only (done: `f0370d4`).
5. `ShieldLogicAttack.queued_update` — 248.2 reservation block.
6. `CarryData._chk_register_steal_SO` — 248.2 head guards + helper, keep
   sabotage markers.
7. `_chk_play_charge_weapon_sound` — restore vertical guard.
8. `CopLogicIdle.damage_clbk` — optional `data.t = t` before instant identify.
9. Keep as-is (no edit): `_upd_attention_obj_detection`,
   `_upd_enemy_detection`, `_cancel_tase_attempt`, `TankCopLogicAttack.update`
   (inert fallback — remapped away by LIES, see §9).
   `_upd_aim` is no longer on this list: it was ported in 8.57.19 and had ledger
   blocks 5-9 re-added in 8.57.21 (see section 2).

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

---

## Door watching (2026-11-01, 8.57.23)

- **Function:** `CopLogicAttack._upd_aim` (LIES restored body) via the local
  helper `lies_upd_expected_pos` in `lua/coplogics/coplogicattack.lua`;
  `NavigationManager.find_segment_doors` in its 2-arg (default) contract.
- **Decision:** restore ledger blocks #1/#2/#4 as a LIES layer *over* the
  vanilla `_get_expected_attention_position`, gated by
  `door_watch and not highperformance`, instead of overriding the vanilla
  method. Review finding: the game's
  `lib/units/enemies/boss/logics/bosslogicattack.lua:694` calls
  `CopLogicAttack._get_expected_attention_position` directly (LIES'
  `lua/coplogics/boss/bosslogicattack.lua` delegates to `_upd_aim` at `245`
  and `935`, and its own reaction-delay copy sits at `bosslogicattack.lua:451-466`
  in that same LIES file), so a method override would either miss the
  boss path or need a second override; keeping the watch as a call target
  inside the shared body reaches every caller (attack family, team-AI assault,
  bosses) with one gate.
- **Deviations, all deliberate:**
  - the height gate reads `focus_enemy.m_pos.z` (fallback `data.m_pos.z`)
    instead of `managers.navigation._nav_segments[seg].pos` — that table is
    private, string-keyed at 248.2, and the value was tracker-derived;
  - the same-segment case delegates to vanilla (`dw_seg_same`): a self-to-self
    `search_coarse` can never satisfy `i_to_seg ~= i_from_seg`, so the pre-port
    fallback burned a search per cadence window and returned nothing;
  - the probe calls the 2-arg `find_segment_doors(enemy_seg)`, so nav-link
    doors arrive as raw `Vector3` `nav_link_end_pos()` (AI-02 shape) and the
    `door.x ~= nil` branch accepts them; that nil test is explicit intent, not a
    behaviour change (Lua has no falsy `0`), the real rejection is
    `fsd_bad_shape`; `center_only` callers keep the table shape;
  - the cadence re-test is not gated on `advancing`: the pre-port term
    (`bbb30fa^:1213`) is unreachable at the only call site, where the cop is
    running, so it froze the watch position forever — the re-test now runs on
    the 0.2/1.5 s window like the probe;
  - the armed-path pre-step sits inside that window and only runs when the
    re-test left no position: it can reach a coarse search,
    `find_segment_doors` and one nav tracker per nav-link door, so it must not
    run per frame, and a nil result must not discard a held position;
    `dw_path_prestep_hit` counts the positions it does produce (the attempt
    counter alone cannot back the report's `positions` claim);
  - `_get_expected_pos` drops an armed path when the door retry still finds no
    doors (the old `if not #found_doors == 0` was always false, so a dead path
    was re-walked every window);
  - the cop's own tracker is nil-guarded (`dw_no_my_tracker`, a sixth outcome):
    vanilla `_get_expected_attention_position` would dereference it unguarded;
  - `dw_cached_reuse` only counts the window-closed arm, i.e. "cadence window
    closed, saved position reused", never a pre-step result.
- **Safety order:** the tracker liveness check runs before the feature gate,
  because vanilla `_get_expected_attention_position` dereferences
  `attention_obj.nav_tracker` unguarded (`248.2:1508/1516`); with the feature
  off, handing it a freed tracker re-opens the 8.57.12/8.57.19 crash class.
- **Gate:** smoke. `[LIES-WATCH] evt=digest` with `watch_log=true`, read by
  `node dev/tools/door-watch-report.mjs`; the claim -> counter table and the
  test-play procedure are in `dev/reports/door-watch-port.md`.

---

## Near-visible probe height (2026-11-01, 8.57.24)

- **Function:** `CopLogicBase._upd_attention_obj_detection` in
  `lua/coplogics/coplogicbase.lua` — the nested `_nearly_visible_chk` helper
  (LIES body entry at `906`, helper at `1010`, three call sites at
  `1374`/`1386`/`1396`).
- **Decision:** keep the LIES rewrite of the detection pass; merge **only** the
  248.2 vertical probe-height scaling inside `_nearly_visible_chk`. Released as
  8.57.24 (`c409ba4`, `feat/ai-suite-compat`).
- **Evidence.** A function diff 246.1 → 248.2
  (`tools\pd2fn.ps1 -From 246.1 -To 248.2 -Path lib/units/enemies/cop/logics/coplogicbase.lua
  -Class CopLogicBase -Name _upd_attention_obj_detection`) shows exactly one
  functional change in the whole function, and it is inside the vanilla helper:
  the fixed `+100` probe above the last known position becomes
  `math.lerp(100, 10, math.max(attention_info.verified_dis / MAX_DISTANCE))`
  with `local MAX_DISTANCE = 2000` declared in the helper
  (`248.2:482-491`). Everything else in the function — signatures, fields,
  callbacks, the instant-identify helper, the `forced` argument — is unchanged.
  That is why the earlier "keep LIES, do not graft the ramp" verdict in
  section 1 is narrowed here rather than reversed: the rewrite stays, the one
  changed expression is adopted.
- **What is adopted.** The LIES vertical fallback probe (previously a fixed
  `math.UP * 30`, fired fourth, after the exact-point and both ±30 lateral
  probes) now rises by `height_over_target`. LIES's probe **order** (exact →
  lateral + → lateral − → vertical) and its **±30 lateral tolerance** (vanilla
  uses 150, deliberately not adopted) are unchanged, and so is its
  `last_verified_pos` / `last_verified_m_pos` / `last_verified_dis` /
  `last_expected` / `lost_track` bookkeeping **code** — but not the values it
  stores. When only the vertical ray clears, `last_verified_pos` is set to the
  elevated `near_pos`, so it now sits up to ~70 units higher at contact range
  (100 instead of 30), fading to the old height by ~2000 units. That field is
  read as an aim/look point (`lua/coplogics/coplogicattack.lua` `aim_pos` /
  `look_pos`), so smoke should watch for shots and aim passing over the head of
  a player who peeks from behind low cover at close range.
- **`MAX_DISTANCE` hoist.** Vanilla declares the constant inside the helper and
  gates there on `verified_dis`; LIES gates at the three call sites instead, on
  `attention_info.dis`. Each site has just written `verified_dis = dis`
  immediately above the gate, so the two are the same value at that point —
  but the constant is now needed by both the call-site gate and the helper
  body, so it is hoisted to the function scope as the single source. All three
  gates read `MAX_DISTANCE > attention_info.dis`; the bare `2000` literal is
  gone (pinned by the test).
- **`math.clamp` vs vanilla's `math.max`.** The vanilla line is
  `math.lerp(100, 10, math.max(attention_info.verified_dis / MAX_DISTANCE))`.
  `math.max` with a single argument is the identity, so the vanilla ratio is
  unclamped above — it relies on the enclosing
  `MAX_DISTANCE > verified_dis` gate to keep it below 1. LIES uses
  `math.clamp(ratio, 0, 1)`, which is behaviour-identical *inside* the gate
  (ratio ∈ [0, 1)) and additionally safe if a future caller ever probes without
  the gate. The clamp bounds the height to [10, 100].
- **Diagnostics.** `LIES:Count("near_vis_probe")` (how often the vertical
  fallback ran, after both lateral probes) and `LIES:Gauge("near_vis_h",
  height_over_target)` (tallest height seen in the window), digested as
  `near_vis_probe` and `near_vis_h_max` (`menumanager.lua:529-530`, right after
  the `dw_*` group). `LIES:Gauge` keeps only the window **maximum**, so the pair
  proves two things and not a third: the probe fired (`near_vis_probe` counts
  it), and the height really is the merged one at its worst case
  (`near_vis_h_max` ≈ 100, not the pre-merge 30). The taper itself is **not**
  observable in the digest: a single contact-range probe pins the gauge near 100
  for the whole window, so ≈ 10 near 2000 units can only be seen on a play whose
  covered targets were all far away.
- **Player-visible effect, stated honestly.** At contact range the peek probe
  rises to ~100 units instead of 30, so a cop keeps a "nearly visible" read on
  a target behind low cover more readily up close; by ~2000 units the probe has
  faded to 10, so distant peeking is less likely to keep them watching. Nothing
  else in detection changes — no new acquisition, no wider lateral search, no
  different notice timing path — but the elevated probe does move the derived
  value: `last_verified_pos` (and the `last_verified_m_pos` /
  `last_verified_dis` computed from it) is up to ~70 units higher at contact
  range when the vertical ray is the one that cleared, and that position feeds
  the aim/look points. **Not yet observed in game.**
- **Risk if wrong.** Detection is the most visible LIES feature. A too-tall
  probe over-reads cover: cops keep the target flagged `nearly_visible=true`
  and stay on it instead of dropping to search. A too-short probe makes them
  lose a target behind chest-high cover at point-blank range. Scenario: crouch
  behind a low wall ~3-5 m in front of a SWAT — it must keep watching the spot
  while you crouch-walk behind it, and drop the read within a couple of seconds
  of you breaking away. Repeat at ~40 m behind the same wall: the read should be
  less sticky there than up close.
- **Gate:** smoke (`near_vis_probe > 0` and `near_vis_h_max` ≈ 100 rather than
  the pre-merge 30 in one digest). Note what the gauge cannot do: it holds the
  window maximum, so one contact-range probe pins it near 100 and the taper is
  not visible in the digest — the claim is "the merge is live and tall at worst
  case", not "the fade works". Static coverage:
  `dev/tools/test/detection-near-visible.test.mjs`.

---

## Nav-v6 audit outcome (2026-11-01, 8.57.25)

- **Functions:** the five open rows of the `NavigationManager` nav-v6 block in
  `lua/managers/navigationmanager.lua` — `register_cover_units`,
  `_execute_coarce_search`, `_sort_nav_segs_after_pos`, `remove_obstacle`,
  `_draw_covers` — plus a re-verify of the two rows this file calls done
  (`add_obstacle` §12, `set_nav_segment_state` §13).
- **Evidence.** `dev/reports/nav-v6-remaining-audit.md` (2026-11-01), built with
  `tools\pd2fn.ps1 -From 246.1 -To 248.2
  -Path lib/managers/navigationmanager.lua -Class NavigationManager -Name <fn>`
  and `git show a3180fc:lib/managers/navigationmanager.lua`, cross-checked
  against `mods/base/base.lua`, `mods/base/req/BLTMod.lua` and
  `mods/Iter/lua/navigationmanager.lua`.
- **Audit first, Lua second.** The backlog row list was stale, so porting on its
  word would have cost a regression plus a dead-code rewrite. Four of the seven
  rows were closed without editing Lua:
  - `add_obstacle` — **already merged** (nil-object guard, `unit_data()`
    destroy listener, `id` stored in the entry). LIES additionally keeps the
    246.1 duplicate-add `self._debug` guard, which 248.2 deleted; that is the
    safer side and the only `self._debug` read left in the file.
  - `set_nav_segment_state` — **already merged**: all eight `tostring(id)` /
    `unique_id` constructs are present, so the v6 string segment keys are
    handled; LIES adds the two `_cached_paths` invalidations and a `log()` line
    before the `debug_pause`.
  - `remove_obstacle` — **keep LIES**. Three of 248.2's four pieces are present
    (nil guard, destroy-listener removal, index-based `temp_array` rebuild) and
    LIES *adds* `self._quad_field:remove_obstacle(obs_data.id)` for a dead unit,
    where 248.2 merely drops the list entry and leaks the engine blocker. The
    one absent line, `self._quad_field:remove_obstacle(obstacle_obj)`
    (248.2:2030), only covers "an obstacle exists in the quad field with no
    `_obstacles` entry" — no caller can produce that state, `add_obstacle` always
    stores the id it got back, and `on_simulation_ended` (248.2:1722-1752)
    sweeps the remaining ids between heists.
  - `_draw_covers` — **keep LIES**, and it is dead code on both sides: 248.2
    reaches it only from `_debug_draw_options.covers` (`248.2:159-161`), LIES
    comments its own call out (`:1251`). Porting 248.2's body would drag in
    `temp_rot1` and `mrot_set_look_at`, which LIES' chunk does not declare — a
    freevars hit for zero gameplay value.
- **Three gaps merged** (`cbc4a29`, released 8.57.25):
  1. `register_cover_units` — the legacy cover-unit branch now passes the create
     flag, `self._quad_field:get_script_data(nav_tracker, true)` (`:552`).
     248.2:849 added it to match the sibling `cover_data` call site
     (`246.1@a3180fc:1389` already passed it); `246.1@a3180fc:1433` did not. Line
     numbers here name the commit they were read from — the 246.1 restyle pivot
     `a3180fc`; the manifest baseline `b36f5fbb` carries identical bodies.
     Without it the following `location_script_data.covers` write is an
     index-nil error that aborts cover registration for the map. Reachable only
     when `managers.worlddefinition:get_cover_data()` returns nil.
  2. `_execute_coarce_search` — restored the nav-link availability gate:
     `local t = TimerManager:game():time()` hoisted (`:2296`) and
     `t > i_door:delay_time()` ahead of `check_access` (`:2325`). The construct
     exists in **both** baselines (246.1@a3180fc:1829, 248.2:1257), so this is a
     LIES drop relative to 246.1, not a 248.2 fix.
  3. `_sort_nav_segs_after_pos` — the same gate, same hoist (`:2409`),
     `alive(door) and not door:is_obstructed() and t > door:delay_time() and
     door:check_access(...)` (`:2422`); 246.1@a3180fc:1952 and 248.2:1368.
  Not ported in the same pass, deliberately: the 248.2 `for i = 1, 500` loop
  restyle (equivalent — `i == 500` is checked before the increment — plus two
  hoists the gate did not need) and the `check_segment` closure in the sort
  (pure restructure that would displace LIES' extra `from_pos` parameter and
  two-term weight, and touch the caller).
- **Deliberate LIES shapes this decision protects**, pinned by
  `dev/tools/test/nav-gates.test.mjs` so a later 248.2 restyle cannot silently
  drop them: the 7-argument `_sort_nav_segs_after_pos` signature, its two-term
  `mvec3_dis(from_pos, door_pos) + mvec3_dis(door_pos, to_pos)` weight, the
  4-tuple path with its `nav_link`, `not is_obstructed()` in the coarse-search
  entry test (AI-06), dead-link skipping instead of `debug_pause`, and the
  246.1 `while true` / `i == 500` loop with the per-iteration
  `self._nav_segments` lookup.
- **Iter-override caveat.** Iter replaces `_execute_coarce_search` **wholesale**
  when its `nav_search` setting is on
  (`NavigationManager._execute_coarce_search = NavigationManager.itr_execute_coarce_search`,
  `mods/Iter/lua/navigationmanager.lua:2147` on Iter's `feat/ai-suite-compat`
  branch, 200.21; default `true` at `lua/corecode.lua:17`). That function is the
  only caller of `_sort_nav_segs_after_pos`
  (`lua/managers/navigationmanager.lua:2371`), and Iter's replacement never calls
  it, so under that profile — the default layout — **both** gap 2 and gap 3 are
  dead: they are live only in a LIES-only profile or with Iter's nav search off.
  Under Iter its own search runs instead, including its 200.20 FIFO cursor rework
  (`f896b61`). Both gates are still correct standalone. Load order keeps the
  interaction safe: LIES is priority 100, Iter 40, `mods/base/base.lua:236` sorts
  descending, so LIES' bodies are installed first and Iter's wrappers/assignment
  run over them (the opposite of NavFixes, priority 0, which loads last and breaks
  LIES' 7-argument caller — `compatibility.md` §2.1).
- **Risk if wrong.** Both gates add one userdata method call (`delay_time()`) in
  the path-expansion hot loop, on the same object LIES already calls
  `is_obstructed()` and `check_access()` on, so no new pointer class. The failure
  mode of a too-strict gate is a cop refusing a usable link and stalling on a
  reachable route; the failure mode of the code before this release is
  committing to a link that is not ready. Scenario: fight through a door the AI
  opens and re-opens — cops should walk through it, and should not stack at a
  closed vault or ladder while it is still settling.
- **Gate:** smoke. Not yet observed in game; the change is only visible on maps
  with nav links that are still cooling down during a search, and only with
  Iter's nav search off.

## Group smoke/flash grenade audit outcome (2026-11-01, 8.57.26)

Last two `PORT` rows of the group-AI set (`dev/port-248-ledger.md:312-313`):
`GroupAIStateBesiege._chk_group_use_flash_grenade` (LIES 145 L / 246.1 45 L /
248.2 45 L) and `_chk_group_use_smoke_grenade` (179 / 47 / 47). Audit with the
complete vanilla hunk sets, the LIES-intent read and the crash-class table:
`dev/reports/group-grenade-audit.md`. Release: `8.57.26`.

- **Vanilla half already merged — no port.** Both functions changed in exactly
  the same two ways in `5d84b4be` "247" (246.1 `b36f5fbb` → 248.2
  `e3a8b616`): `local a, b = nil` → bare locals (restyle) and numeric
  room-door id → `door.x` / nav-link unit. The door change is forced by the 247
  nav rewrite (neighbour lists carry door positions,
  `navigationmanager.lua:326-347` @ `e3a8b616`; `_room_doors` and
  `_refresh_data_from_builder` are gone). LIES already tests `door.x` and
  falls back to `nav_link_end_pos()`, and its residual numeric branch maps an
  id to `test_pos = nil` ("skip that door") — dead-but-safe, since numbers no
  longer occur. Net: the only functional hunk was already in the LIES bodies.
- **Guards shipped** (`b4d5b61`). Both bodies read
  `u_data.tracker:nav_segment()` unguarded (`:3935`, `:4100`) in a file
  that guards the same field at `:3877`; a freed tracker at that read is the
  8.57.12 engine-AV shape (`dev/reports/aim-stale-nav-tracker-crash.md`), and the
  two reads are reached from the group-AI update, not the movement update. Both
  sites now fold `u_data.tracker and alive(u_data.tracker)` into the existing
  per-unit condition (no new nesting, no other behaviour change, one extra
  `alive()` per unit per check). Pinned by
  `dev/tools/test/group-grenade-guards.test.mjs` (red against `e1f7d90`,
  green after).
- **Parked as a decision: the dead explicit-`detonate_pos` branch.** In both
  functions the `else` arm tests `objective` as an undefined global —
  `local objective = u_data.unit:brain():objective()` is declared only in the
  `if not detonate_pos` arm — so no shooter is ever selected there and the
  branch is dead. Inherited pre-port behaviour in every 8.x build
  (`git show 997e95e`), and the outcome equals vanilla's (vanilla never throws
  when a position is handed in either). Reviving it makes charge-specific
  flashes/smokes land on a camping player's last known position — a real
  difficulty increase on Death Wish+ with no test capacity here — so it stays
  dead until an explicit decision. **Fix spec (one line per function):**
  `local objective = u_data.unit:brain():objective()` inside the `else` loop
  at `lua/groupaistate/groupaistatebesiege.lua:4022` (smoke) and `:4173`
  (flash). The test pins the dead shape on purpose, so applying the fix turns
  the suite red — the marker that the decision was taken.
- **Inert, left alone.** The flash passes
  `tweak_data.group_ai.smoke_grenade_lifetime` where vanilla gates on
  `flash_grenade_lifetime` (`:4078`); `QuickFlashGrenade:activate(position)`
  takes no duration (`quickflashgrenade.lua:112` @ `e3a8b616`), so the value
  never reaches the blind window. Cosmetic mismatch, no edit.
- **Ledger.** Rows 312-313 stay `PORT` until the dead-branch decision is
  recorded — the ledger records the proposed action, not completion, so this
  file and `port-status.md` are the "is it done" source. The vanilla half of
  both rows is audited as already merged.

## Port backlog close-out (2026-11-01, 8.57.27)

The 23 rows `dev/port-248-ledger.md` still marks `**PORT**`
(`LIES_EDIT_VANILLA_CHANGED`) are all decided or applied. The ledger's status is
generated from source classification — a *proposed action* per function, never a
completion flag — so it will keep printing `PORT` for these bodies; this section
and `dev/reports/port-status.md` are the completion record. No unexamined 248.2
hotspot is left: what remains is in-game verification of already shipped
behaviour, not porting.

| Function | Verdict | Reference | Reason |
|---|---|---|---|
| `NavigationManager.find_segment_doors` | superset + guards | `a9bfba0`, `dev/test-harness/test/find_segment_doors.lua` | LIES body already carries the 248.2 work plus tracker guards; the 2-arg `Vector3` contract is pinned by the test. |
| `NavigationManager.register_cover_units` | merged: create flag | `cbc4a29` | 248.2 only added the create flag to the legacy branch; LIES now calls `get_script_data(nav_tracker, true)`. |
| `NavigationManager._execute_coarce_search` | merged: nav-link `delay_time()` gate; 248.2 loop restyle skipped | `cbc4a29` | The gate was the only functional delta; the `for i = 1, 500` rewrite is equivalent and was deliberately not taken. |
| `NavigationManager._sort_nav_segs_after_pos` | merged: same gate; 7-arg + two-term weight kept | `cbc4a29` | Gate restored in place; LIES' 7-argument signature and two-term distance weight are pinned by `nav-gates.test.mjs`. |
| `NavigationManager.add_obstacle` | already merged (guard + destroy listener) | earlier port commits | Nil-object guard and `unit_data()` destroy listener are present, with the LIES cache invalidation layered between them. |
| `NavigationManager.set_nav_segment_state` | already merged (`tostring(id)`) | earlier port commits | All `tostring(id)` / `unique_id` constructs are present, so the v6 string segment keys resolve. |
| `NavigationManager.remove_obstacle` | keep LIES (id-based removal covers it) | `dev/reports/nav-v6-remaining-audit.md` | LIES removes the quad-field blocker by id, which is stronger than 248.2's one absent object-call line; no caller reaches that state. |
| `NavigationManager._draw_covers` | keep LIES (dead code; call site commented) | `dev/reports/nav-v6-remaining-audit.md` | Unreachable on both sides (248.2 only from the debug draw option), and the vanilla body would drag in locals the LIES chunk does not declare. |
| `CarryData._chk_register_steal_SO` | merged (guard order + activation clbk; sabotage kept) | earlier port commits | 248.2 head guards and `_add_body_activation_clbk()` adopted; the LIES `sabotage` / `sabo_voiceline` markers stay exactly as written. |
| `GroupAIStateBesiege._chk_group_use_flash_grenade` | vanilla hunk already merged; tracker guards added | `b4d5b61`; dead `detonate_pos` branch parked | The only functional vanilla hunk (247 `door.x` / nav-link form) was already in the LIES body; tracker reads are now nil/alive-guarded. |
| `GroupAIStateBesiege._chk_group_use_smoke_grenade` | same | `b4d5b61`; `dev/reports/group-grenade-audit.md` | Identical hunk set and identical guard; the explicit-`detonate_pos` branch stays parked as a difficulty decision, not a port. |
| `GroupAIStateBesiege._queue_police_upd_task` | already ported (timestamp scheduler) + LIES `_nr_important_cops` | `ab03d52`, re-verified 2026-11-01 | Body is the 248.2 timestamp scheduler; the only delta is the LIES `_nr_important_cops` line. |
| `GroupAIStateBesiege._upd_police_activity` | already ported (early-out + single `_upd_group_spawning`), LIES `_last_upd_t`/`_update_criminal_reveal` kept | `703c9af`/`ab03d52`, re-verified 2026-11-01 | Vanilla early-out and single spawn pass are present; `_last_upd_t` and `_update_criminal_reveal` are the documented LIES-only additions. |
| `CopLogicBase._upd_attention_obj_detection` | keep LIES rewrite + 248.2 near-visible probe height | 8.57.24 (`c409ba4`) | The LIES detection pass stays; only the vertical fallback probe adopted 248.2's distance-scaled height. |
| `CopLogicIdle.damage_clbk` | keep LIES + fresh-time inherit | earlier merge | The staged `data.t = t` inherit was taken; the LIES damage reaction (no forced verify) is unchanged. |
| `CopLogicAttack._upd_aim` | 248.2 body + author-behaviour restores + door watch | 8.57.19/8.57.21/8.57.22/8.57.23 | Rebuilt on the 248.2 body because the old body read a stale nav tracker; ledger blocks 5-10 restored, blocks 1-4 retired on purpose. |
| `CopLogicAttack.action_complete_clbk` | merged (`math.rand` dodge timeout) | `f0370d4`, re-verified 2026-11-01 | The `math.rand` expression is the function's only 246.1→248.2 delta and the LIES body carries it. |
| `CopLogicAttack.is_available_for_assignment` | merged (`is_suppressed` gate) | earlier merge | `data.is_suppressed` restored ahead of walk-forbidden/path-fail; LIES 3 s lockout and sabotage gate kept. |
| `TankCopLogicAttack.update` | keep LIES (inert under the dozer remap) | `dev/reports/tank-taser-reverify.md` | Every dozer variant is remapped to `LIESBossLogicAttack`, so the restyle-only delta buys nothing; latent latch documented, not fixed. |
| `ShieldLogicAttack.queued_update` | merged (reservation split) | earlier merge | 248.2's `set_pos_rsrv`/`add_pos_rsrv` split adopted; LIES 70 radius and movement gates kept. |
| `TaserLogicAttack._cancel_tase_attempt` | keep LIES (handle/data split) | `dev/reports/tank-taser-reverify.md` | The `tasing_action` handle gate with `tasing` nil'd first is the correct fix; the vanilla delta is formatting only. |
| `TaserLogicAttack._chk_play_charge_weapon_sound` | merged (300-unit guard + LIES scaling) | earlier merge | 300-unit vertical guard restored; LIES distance-scaled 15-30 s cooldown and 3000 range kept instead of 248.2's 3 s cadence. |
| `TaserLogicAttack._upd_enemy_detection` | keep LIES (`delay` contract, wind-up lock) | `dev/reports/tank-taser-reverify.md` | The `delay` plumbing is required by the LIES detection rewrite and the dropped wind-up focus lock is LIES intent; vanilla changed declaration order only. |

**Verification, the two rows closed today.** Both were re-read 2026-11-01 against
`game-data/Payday-2-LuaJIT-Complete` @ `e3a8b616`:

- `_queue_police_upd_task` — LIES
  `lua/groupaistate/groupaistatebesiege.lua:1178-1194` vs 248.2
  `lib/managers/group_ai_states/groupaistatebesiege.lua:78-90`: identical
  queued-timestamp guard, identical `next_upd_t` choice, identical
  `_police_upd_task_queued` assignment. The single addition is the LIES
  `_nr_important_cops = 12 / table.size(self:all_player_criminals())` block
  (server, non-single-player).
- `_upd_police_activity` — LIES `:592-629` vs 248.2 `:152-173`: identical
  `_ai_enabled` / `_police_activity_blocked` early-out, identical task sequence,
  identical `_enemy_weapons_hot` block with exactly one `_upd_group_spawning()`
  call. The additions are the two documented LIES-only blocks: `_last_upd_t`
  bookkeeping (read by the `_upd_assault_task` posthook) and the
  `_update_criminal_reveal()` pass.
- Scheduler constants: `_POLICE_ACTIVITY_DELAY = 2` and
  `_POLICE_ACTIVITY_DELAY_FAST = 0.4` are declared by the game's own class
  definition (`248.2 :3-4`), not by LIES, so no mod-side redefinition can drift
  them. Application commits: `ab03d52` (scheduler), `703c9af` (update shape).

**Player POV:** no behaviour change — this release ships no Lua. It records that
the 248.2 port surface is fully accounted for, so the "port the ledger" backlog
no longer reads as outstanding work; the only open items are in-game checks of
behaviour that already ships.


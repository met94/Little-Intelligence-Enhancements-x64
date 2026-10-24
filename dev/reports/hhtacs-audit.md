# HHTACS / tweak-data audit for 248.2 (read-only)

Static audit of the LIES "Hyper Taktikz" (hhtacs) surface against game 248.2.
No runtime Lua was edited; this report is the only artifact.

- Worktree: `.worktrees/LIES-port-248` (`feat/port-248`, HEAD `b81db84`)
- Baseline: `a3180fc` (246.1). Target: `e3a8b616` (248.2)
- Clone: `game-data/Payday-2-LuaJIT-Complete`
- Scope: `lua/tweak_data/{groupai,character,attention,weapon,levels,skirmish}tweakdata.lua`,
  `lua/groupaistate/groupaistatebesiege.lua` (LIES + `_LIES` functions),
  `lua/groupaistate/groupaistatebase.lua` (hhtacs multipliers), plus the 248.2
  consumers in `lib/tweak_data/*` and `lib/managers/group_ai_states/*`.
- Method: same-style `pd2diff` ranges, per-function body comparison, then every
  string key / tactic name / unit-category / hook target the hhtacs path touches
  was grepped directly in the 248.2 tree.

```powershell
tools\pd2diff.ps1 246.1 248.2 -Stat
tools\pd2diff.ps1 246.1 248.2 -Paths lib/managers/group_ai_states/groupaistatebesiege.lua
tools\pd2fn.ps1 -From 246.1 -To 248.2 -Path lib/managers/group_ai_states/groupaistatebase.lua `
                -Class GroupAIStateBase -Name _add_drama
tools\luajit\luajit.exe -bl lua\groupaistate\groupaistatebesiege.lua   # exit 0
tools\luajit\luajit.exe -bl lua\tweak_data\groupaitweakdata.lua        # exit 0
```

Headline: **no hhtacs tactic, spawn group, unit category, character key,
attention setting, weapon key or level key is missing at 248.2.** The real
findings are stale/duplicated hhtacs *logic* (scheduler already ported, dead
phalanx keys, dead recon-sweep subsystem, one skirmish metatable hazard).

## Summary

| ID | Severity | Symbol / location | 248.2 status | Impact | Action | Gate |
|---|---|---|---|---|---|---|
| H-01 | High (verify) | `GroupAITweakData:_LIES_setup` skirmish block, `groupaitweakdata.lua:1327`, `:4286-4287` | `tweak_data.group_ai.skirmish.assault` is metatable-backed (232.4 and 248.2 alike); `groups` calls `managers.skirmish:current_wave_number()` -> `GroupAIManager:state()` | First `set_state("empty")` (inside `GroupAIManager:init`) runs the PreHook with `state() == nil`; `math.clamp(nil, ...)` throws from `_LIES_setup`. If SuperBLT does not swallow it, the whole switch is aborted and no hhtacs runs. Second bug: line 4287 writes the **skirmish** slot into `besiege`. | Hoist `local skirmish = tweak_data.group_ai.skirmish`, guard `managers.skirmish` / `state()`, write `skirmish.assault.groups[...]`. | static + log |
| H-02 | Medium | `_check_spawn_phalanx_LIES` (`besiege:763`), `_setup_hhtacs_task_data` `phalanx.respawn_delay` (`groupaitweakdata:4464`) | 248.2 `_check_spawn_phalanx` has `not Global.game_settings.single_player`; respawn delay lives in `phalanx.spawn_chance.respawn_delay` (300000 on DW+) | LIES re-enables phalanx in solo; the 1200 s `respawn_delay` LIES writes is never read, so the intended respawn cap is a no-op. | Resolved `9dec81a`: moved to `spawn_chance.respawn_delay` (hhtacs-only); solo guard kept intentionally. | smoke (phalanx) |
| H-03 | Medium | `besiege:4754` `_spawn_phalanx_LIES` -> `_find_spawn_group_near_area(..., "phalanx")` | LIES helper takes 5 params; 248.2 takes 5 | 6th argument silently discarded. Any intended phalanx-specific spawn-point filter never applied. | Resolved `9dec81a`: argument dropped; helper remains 5-arg. | static |
| H-04 | Medium (latent) | `_find_spawn_group_near_area` (`besiege:4570`) | 248.2 squares/filters by `max_dis`; LIES ignores the parameter | Today all call sites pass `nil`, so no visible change; any future caller silently loses distance capping. | Resolved `9dec81a`: linear `max_dis` cap restored; weighting keeps the unscaled value. | static |
| H-05 | Low | Recon sweep: `_begin_recon_sweep_task`, `_upd_recon_sweep_task`, `_assign_enemy_group_to_recon_sweep`, `_set_recon_sweep_objective_to_group`, `_assign_enemy_groups_to_recon_sweep` (`besiege:3612-3830`) | No caller anywhere in the tree; `_task_data.recon.sweep_task` is never created | Whole subsystem is dead; `_assign_enemy_group_to_recon` branch is permanently false. No player effect. | Resolved `9dec81a`: deleted five functions and the sweep fork. | static |
| H-06 | Low | `_setup_hhtacs_task_data` LIES-only keys (`groupaitweakdata:4389-4464`) | `max_smoke_grenades`, `phalanx.max_soldier_groups`, `phalanx.move_interval` do not exist in any game file (246/248) | Consumed only by LIES code; consistent. Not a break, but do not expect the game to honour them. | Document as LIES-private. | static |
| H-07 | Low | `_LIES_setup:14` `enemy_spawn_groups["tac_swat_shotgun_rush"]` detection | Vanilla 246.1 and 248.2 expose only 13 spawn groups; `tac_swat_shotgun_rush` exists only in `besiege.assault.groups` weight tables | "Another mod already fixed spawn groups" detection now relies solely on `medic_M4`; the first half is always false. | Leave (works) or retarget to a group vanilla actually defines. | static |
| H-08 | Low | `_check_spawn_timed_groups` hhtacs PostHook (`besiege:423-445`) | `_timed_groups[*].has_spawned` is a LIES-private field | **Read** by `ElementSpawnEnemyDummy.check_overwrite_spawn_value` (`elementspawnenemydummy.lua:81`) to gate the marshal-marksman harasser swap. Not dead. | Keep; do not delete. | static |
| H-09 | Low (pre-existing) | `besiege:1483` `self._area_data[new_objective.nav_seg]` | `_area_data` is keyed by area id, never by nav-seg id (232.4 identical) | Always nil -> `set_enemy_assigned(nil, u_key)` clears the cop's area assignment instead of setting it. | `self:get_area_from_nav_seg_id(new_objective.nav_seg)`. | static + smoke |
| H-10 | Info | `_queue_police_upd_task` (`besiege:1125`) vs 248.2 `besiege:78-90` | 247 added `_POLICE_ACTIVITY_DELAY` / `_FAST` and moved rescheduling into `update()` | LIES already matches the 248.2 contract (direct `_upd_police_activity` call, timestamp field, constants). No double-run, no stale `managers.enemy:queue_task`. | No change; close the ledger `PORT` item. | static |
| H-11 | Info | `managers.network:session():send_to_peers_synched` (`besiege:4241/4387/4458/4780`) | 247 switched group-ai calls to `managers.network:send_to_peers_synched`; `session()` and `GameSession:send_to_peers_synched` still exist and are still used by the game itself | Not a break. Style/consistency only. | Optional cleanup. | static |
| H-12 | Info | `phalanx.vip.damage_reduction` override (`groupaitweakdata:4467`) | Vanilla 248.2: `{max .5, start .1, increase .05, interval 5}`; LIES: `{max .2, start .025, increase .025, interval 15}` | Intentional hhtacs tuning; every key is read by `_check_phalanx_damage_reduction_increase_LIES` / `phalanx_damage_reduction_enable`. | Keep. | smoke |

Everything else in scope checked clean; see "Verified clean".

## Resolution (2026-10-24, `9dec81a`)

- **H-02:** respawn key now `phalanx.spawn_chance.respawn_delay = 1200`, only
  when `LIES.settings.hhtacs` is on. Solo phalanx remains enabled deliberately.
  Player: with hhtacs, a phalanx can return after roughly 20 minutes; with
  hhtacs off, vanilla 248.2 pacing is unchanged.
- **H-03/H-04:** the phalanx spawn call is five-argument; the helper enforces
  `max_dis` as a **linear** cap and keeps the unscaled value as the weighting
  scale. No current caller passes `max_dis`, so live behavior is unchanged.
  Vanilla's squared comparison is latent-inert because the cached path distance
  is linear; this port uses the intended cap instead.
- **H-05:** deleted the five uncalled recon-sweep functions and the permanent
  `sweep_task` fork. Vanilla `_upd_recon_tasks` remains the only recon driver.
  Player: no change.
- **Evidence:** `tools\gates.ps1` PASS (45 Node tests, 71/71 Lua compile,
  freevars 0, API errors 0); source regression tests in
  `dev/tools/test/runtime-audit.test.mjs`.

---

## H-01 - `_LIES_setup` skirmish access can throw, and one branch writes the wrong table

**Where.** `lua/tweak_data/groupaitweakdata.lua`:

```lua
1327:  self.skirmish.assault.groups.custom = { 0, 0, 0 }
...
4281:  for group_id, group_info in pairs(self.enemy_spawn_groups) do
4282:      if not self.besiege.assault.groups[group_id] then
4283:          self.besiege.assault.groups[group_id] = {0, 0, 0}
4284:      end
4286:      if not self.skirmish.assault.groups[group_id] then
4287:          self.besiege.assault.groups[group_id] = {0, 0, 0}   -- should be skirmish
4288:      end
```

**248.2 state.** `tweak_data.group_ai.skirmish` is created by
`SkirmishTweakData:_init_group_ai_data` (clone of `besiege`) and then gets a
metatable on `skirmish.assault`:

```lua
-- lib/tweak_data/skirmishtweakdata.lua:533-546 (identical at 232.4)
__index = function(t, key)
    if key == "groups" then
        local current_wave = managers.skirmish:current_wave_number()
        local current_wave_index = math.clamp(current_wave, 1, #self.assault.groups)
        return self.assault.groups[current_wave_index]
    end
end
```

`SkirmishManager:current_wave_number()` returns
`managers.groupai and managers.groupai:state():get_assault_number()` on the
server. `GroupAIManager:init` calls `set_state("empty")` before
`managers.groupai` is assigned and before `self._state` exists, and LIES hooks
`set_state` with a **PreHook**, so on that first call the read is
`nil:get_assault_number()` (or `math.clamp(nil, ...)` if `managers.groupai` is
still nil).

**248.2 delta.** 247 added `GroupAIStateBase:destroy()` / `get_persisting_data()`
/ `set_persisting_data()` and made `set_state` destroy the old state before
creating the new one. The PreHook still runs first, so the nil/nil-active-state
window is unchanged from 246.1 - this is a pre-existing hazard, not a 248
regression. It matters here only because hhtacs setup lives behind it.

**Impact.** If the error propagates, `set_state` aborts for that call; if
SuperBLT wraps hooks in `pcall`, the error is logged and `_LIES_fix` stays nil,
so the next `set_state` (level load) retries successfully. Player-visible
difference between the two cases: hhtacs either works or silently does nothing.

**Fix.** Localise and guard:

```lua
local skirmish = tweak_data.group_ai.skirmish
local skirmish_groups = skirmish and managers.skirmish and managers.groupai
    and managers.groupai:state() and skirmish.assault.groups or nil
```

then use `skirmish_groups` (and `skirmish.assault.groups` on write) instead of
re-reading the metatable per group id. Also fixes line 4287 to write
`self.skirmish.assault.groups[group_id]`.

**Risk.** Low; pure table bookkeeping. Only changes the skirmish weight table
that currently never receives its `{0,0,0}` entries.

**Gate.** static + one boot log check ("no `_LIES_setup` error, hhtacs log lines
present"). Because the fix alters which table is written, run one skirmish
(holdout) round.

---

## H-02 - Phalanx: single-player guard dropped, respawn delay written to a dead key

**Where.** `lua/groupaistate/groupaistatebesiege.lua:763`:

```lua
function GroupAIStateBesiege:_check_spawn_phalanx_LIES()
    if self._phalanx_center_pos and self._task_data and self._task_data.assault.active ...
```

248.2 `_check_spawn_phalanx` (besiege:3893) starts with
`if not Global.game_settings.single_player and self._phalanx_center_pos ...`.

`lua/tweak_data/groupaitweakdata.lua:4464` writes `self.phalanx.respawn_delay = 1200`;
248.2 reads `tweak_data.group_ai.phalanx.spawn_chance.respawn_delay` (300000 at
DW/DS, 120 at low difficulty) inside the same function. `git grep` finds
`phalanx.respawn_delay` nowhere in 246.1 or 248.2.

**Impact.** Player-visible: with hhtacs on, the VIP phalanx can arrive in
single-player, where 248.2 deliberately disables it. The 1200 s respawn cap LIES
intends never applies, so respawn pacing follows vanilla's 300000 s (i.e. once
per heist). Neither is a crash.

**Fix.** Decide intent. If single-player phalanx is wanted, keep as is and
document; otherwise restore the guard. For the respawn value, write
`self.phalanx.spawn_chance.respawn_delay = 1200` (the key vanilla reads) or drop
the line.

**Risk.** Medium: both options change in-game phalanx availability/pacing.
Static edit is trivial; the *choice* needs a gameplay call.

**Gate.** smoke: DW+ assault with hhtacs, watch for VIP spawn, check the buff
icon appears and disappears (validates `_check_phalanx_damage_reduction_increase_LIES`
and the disable path).

---

## H-03 / H-04 - Phalanx spawn-search signature drift

`_spawn_phalanx_LIES` (`besiege:4754`) calls
`self:_find_spawn_group_near_area(phalanx_area, phalanx_group, nil, nil, nil, "phalanx")`.
The LIES helper (`besiege:4570`) and the 248.2 helper both take
`(target_area, allowed_groups, target_pos, max_dis, verify_clbk)`. The 6th
argument is discarded by Lua, so no error and no effect.

Separately, the LIES body dropped the vanilla `max_dis = max_dis and max_dis * max_dis`
filter. All current callers pass `nil` for `max_dis`
(`besiege:853`, `:3724`, `:4754`), so this is latent only.

**Impact.** None today. The phalanx-specific spawn-point restriction the extra
argument implies does not happen; phalanx spawns from any valid
`Phalanx`-allowed area.

**Fix.** Either delete the extra argument (cheapest, honest) or add an
`allowed_access`/`spawn_kind` parameter and use it. Restore the `max_dis` filter
in the helper while there.

**Risk.** Low. Static.

**Gate.** static.

---

## H-05 - Recon sweep is dead code

`_upd_recon_sweep_task` is never called; `_begin_recon_sweep_task` is never
called; therefore `self._task_data.recon.sweep_task` is always nil, and the
`if self._task_data.recon.sweep_task then` forks in
`_assign_enemy_group_to_recon` / `_upd_recon_sweep_task` never take the sweep
path. `_assign_enemy_groups_to_recon_sweep` and
`_set_recon_sweep_objective_to_group` are likewise only reachable from that
subsystem.

**Impact.** No player-visible effect. Costs maintenance and hides the fact that
`_upd_recon_tasks` (vanilla 248.2) is the only recon driver.

**Fix.** Delete the five functions and the sweep fork, or add the missing trigger
(most likely a hhtacs event on first contact) and test. Do not leave it half-wired.

**Risk.** Low (deletion), medium (wiring). Deletion is static-safe.

**Gate.** static.

---

## H-06 - LIES-private tweak keys (not game keys)

`_setup_hhtacs_task_data` writes, in addition to real 248.2 keys:

| Key | Read by | Exists in game? |
|---|---|---|
| `max_smoke_grenades` | `besiege:4074`, `:4235` | no (246/248) |
| `phalanx.max_soldier_groups` | `besiege:844`, `:935` | no |
| `phalanx.move_interval` | `besiege:935` | no |
| `phalanx.respawn_delay` | nothing (see H-02) | no |

These are fine as LIES-private namespace, but they must not be "fixed" against
vanilla later. `smoke_grenade_lifetime` and `smoke_and_flash_grenade_timeout`
are real 248.2 keys and are overwritten correctly.

---

## H-07 - Spawn-group detection half-dead; `spawn_point_chk_ref` names

At 246.1 and 248.2 vanilla `enemy_spawn_groups` contains exactly 13 groups:
`FBI_spoocs, marshal_squad, Phalanx, piggydozer, single_spooc, snowman_boss,
tac_bull_rush, tac_shield_wall, tac_shield_wall_charge, tac_shield_wall_ranged,
tac_swat_rifle_flank, tac_tazer_charge, tac_tazer_flanking` (plus LIES' own
additions). `tac_swat_shotgun_rush`, `tac_swat_shotgun_flank`, `tac_swat_rifle`
and `tac_swat_smg` appear only as **weight keys** in
`besiege.assault.groups` (vanilla quirk, both versions) and as LIES-created
groups inside the `fixed_spawngroups` branch, which hhtacs skips.

Consequences, none fatal:

- `_LIES_setup:14` `enemy_spawn_groups["tac_swat_shotgun_rush"]` is always nil
  under hhtacs; the "other mod already fixed groups" test degenerates to
  `not unit_categories["medic_M4"]`, which is false on vanilla 248.2, so setup
  proceeds as intended.
- `tac_reenforce.spawn_point_chk_ref = {"tac_swat_rifle_flank", "tac_swat_rifle"}`
  (`groupaitweakdata:3007/3034/3147/3210/3253`): `ElementSpawnEnemyGroup:_chk_spawn_group_references`
  only string-matches mission-element values, so the non-existent
  `tac_swat_rifle` entry simply never matches. `tac_reenforce` is still added
  via `tac_swat_rifle_flank`.

**Fix.** None required. If touched, prefer a group vanilla actually defines.

---

## H-08 - `has_spawned` on timed groups gates the marshal harasser swap

Corrected 2026-10-24: this is **not** write-only. The hhtacs PostHook on
`_check_spawn_timed_groups` sets `cur_group_data.has_spawned = true` for every
timed group that has produced a unit. `ElementSpawnEnemyDummy.check_overwrite_spawn_value`
(`lua/managers/mapelements/elementspawnenemydummy.lua:81`) reads
`groupaistate._timed_groups["marshal_squad"].has_spawned` to decide whether to
swap in the LIES marshal-marksman harasser. Removing the hook would silently
kill that substitution on man/rvd1/moon. Keep it.

---

## H-09 - `_area_data[nav_seg]` lookup is always nil (pre-existing)

`besiege:1483` inside `on_objective_complete`:

```lua
self:set_enemy_assigned(self._area_data[new_objective.nav_seg], u_key)
```

`_area_data` is keyed by area id, and `_nav_seg_to_area_map` is the nav-seg
index (232.4 had the same shape). So this always passes nil and
`set_enemy_assigned` clears `u_data.assigned_area` instead of assigning the new
objective's area. Player-visible only as slightly worse area ownership /
force accounting for SO-assigned cops. Not a 248 regression.

**Fix.** `self:get_area_from_nav_seg_id(new_objective.nav_seg)`. Low risk, but it
changes area bookkeeping - smoke it.

---

## H-10 / H-11 - Things that are *already* correct (close the ledger entries)

**Police activity scheduler.** 247 (`ab03d52` in this worktree) ported it:

- 248.2 `GroupAIStateBesiege.update` calls `_queue_police_upd_task()` when
  `self._is_server and managers.navigation:is_data_ready()`.
- 248.2 `_upd_police_activity` no longer re-queues itself and no longer resets
  `_police_upd_task_queued`; it early-returns on `not _ai_enabled or
  _police_activity_blocked`.
- 248.2 `_queue_police_upd_task` calls `_upd_police_activity()` immediately when
  the stored timestamp has passed, then sets
  `_police_upd_task_queued = self._t + (_FAST 0.4 / 2.0)`.

LIES' override (`besiege:1125-1141`) matches this contract, adds
`_nr_important_cops = 12 / table.size(all_player_criminals())` on
server non-single-player (safe: SP keeps the class default 3), and keeps the old
`_police_activity_blocked` early return plus the `_upd_group_spawning` reorder.
No double-run: LIES' `_upd_police_activity` does not call `_queue_police_upd_task`.
246.1's `managers.enemy:queue_task("GroupAIStateBesiege._upd_police_activity", ...)`
is gone from the file.

**Network sync.** 247 replaced `managers.network:session():send_to_peers_synched`
with `managers.network:send_to_peers_synched` **only in group AI**. Both entry
points exist at 248.2 (`networkmanager.lua:553` forwards to the session), and the
game still uses `session():send_to_peers_synched` in dozens of managers. LIES'
four call sites are valid; no edit needed.

---

## H-12 - Phalanx damage reduction values

248.2 vanilla `phalanx.vip.damage_reduction` is `{increase .05, interval 5, max
.5, start .1}`. LIES hhtacs overrides it with `{max .2, start .025, increase
.025, interval 15}` (`groupaitweakdata:4467-4472`). All four keys are read by
`_check_phalanx_damage_reduction_increase_LIES` and by vanilla
`phalanx_damage_reduction_enable`, and `_get_law1_team()` still exists at 248.2.
Behaviour is intentional and internally consistent. Player-visible: the VIP
buff ramps much slower and caps at 20 %.

No change. Verify only that the buff HUD icon appears/clears in one phalanx
fight (`set_damage_reduction_buff_hud` unchanged 246->248).

---

## Semantic drift: assumptions 248.2 changed

These are 246.1 -> 248.2 changes that hhtacs *touches*. Only the ones marked
**action** need work.

| Assumption | 248.2 reality | State in this port |
|---|---|---|
| `_queue_police_upd_task` uses `managers.enemy:queue_task` + bool flag | Direct call + `_t` timestamp + `_POLICE_ACTIVITY_DELAY{,_FAST}` | ported (ab03d52), correct |
| `_upd_police_activity` re-queues itself and clears the flag | Caller (`update`) reschedules; function returns early on `_ai_enabled`/blocked | ported, correct |
| `Network:is_server()` used inline | `GroupAIStateBase._is_server` cached in init; besiege switched to it | LIES still uses `Network:is_server()` in `init`/`_queue_police_upd_task`; same value at runtime, no action |
| door lists hold numeric door ids | nav v6: door lists hold `Vector3` positions **or** nav-link units | LIES smoke/flash loops already branch on `door.x` / `script_data()`; `NavigationManager.find_segment_doors` override still returns `{center,end_pos}` tables - tracked as AI-02 in `core-ai-gap-audit.md`, not new |
| `add_area(area_id, ...)` stores raw id | 248.2 `tostring`s area ids, guards nil, drops the old nav-seg clobber loop | no LIES code indexes `_area_data` by nav seg except H-09; area ids are only used as table keys, consistent |
| `set_state` assigns the new state directly | 248.2 calls `destroy()` + `get_persisting_data()` on the old state first | PreHook ordering unchanged; relevant only to H-01 |
| `check_gameover_conditions` asks skirmish | 248.2 removed that call; `SkirmishManager:check_gameover_conditions` is stubbed `do return false end` | no LIES dependency |
| `GroupAITweakData` phalanx/assault task keys | **file unchanged 246.1 -> 248.2** (only `IS_CONSOLE`); all `besiege.recurring_group_SO`, `assault.force_pool/force_pool_balance_mul/delay/build_duration/sustain_duration_*`, `phalanx.*` keys still exist and are read | `_setup_hhtacs_task_data` is safe except the dead `respawn_delay` (H-02) |
| hhtacs tactic names exist | vanilla 248.2 `_tactics`: `swat_shotgun_rush, swat_shotgun_flank, swat_rifle, swat_rifle_flank, shield_wall, shield_wall_ranged, shield_wall_charge, shield_support_ranged, shield_support_charge, tazer_flanking, tazer_charge, tank_rush, spooc, Phalanx_minion, Phalanx_vip, marshal_marksman, marshal_shield` | every referenced name resolves; LIES' own `hrt`, `reenforce`, `smg`, `taser_sabo` are defined in the hhtacs block before use |
| hhtacs unit categories exist | 28 vanilla categories, each with `.america` at runtime; `CS_heavy_M4_w` defined per difficulty; `tank_r870` is LIES-only and defined | all `unit = "..."` values in LIES spawn groups resolve |
| `bo` faction clone loop is safe | `deep_clone` errors on nil (`pairs(nil)`), but every category has `.america` | safe; keep the loop as is |
| char tweak keys (`ecm_vulnerability`, `throwable`, `safe_weapon`, `spooc_attack_use_smoke_chance`, `dodge.occasions/speed`, `enrages`, `faster_reactions`, `submission_*`, `walk_only`) | no renames; 247 char-tweak diff is additive (`lead_curator`, `auctioneer_boss`, `bleckert` weapon) | all consumed by LIES' own cop-logic copies or vanilla; clean |
| attention settings names | `attentiontweakdata.lua` byte-identical 246.1 -> 248.2 | clean |
| weapon clip keys (`dmr_npc`, `heavy_snp_npc`, `contraband_npc`, `m4_npc`, `m4_yellow_npc`, `ak47_ass_npc`, `g36_npc`, `r870_npc`, `benelli_npc`) | all present; 247 weapon diff does not touch their `CLIP_AMMO_MAX` | clean |
| level fields (`spa`, `rvd1`, `framing_frame_3`, `trigger_follower_behavior_element`, `fallback_patrol_element`) | levels are still defined; the two custom field names are LIES-private and consumed by LIES `copbrain`/`besiege`; 248.2 removed only `cube` fields | clean; element ids are map data - needs one in-game pass |
| `skirmish.assault.*` tuning | `skirmishtweakdata.lua` unchanged 246.1 -> 248.2 | clean except H-01 |

## Verified clean

Checked by name against `e3a8b616`; all present (or LIES-defined by design):

- **Spawn groups LIES reads**: `Phalanx`, `phalanx_aggressors`, `tac_reenforce`,
  `Cowboys`, `CS_cops`, `spoocs_145`, `FBI_office_agents`, `CS_swat_taser_tac`,
  `bulls_on_parade`, `Murkies`, `FBI_tank_and_backup`.
- **`besiege.*.groups` cross-refs**: only `FBI_spoocs` / `single_spoocs` are not
  defined as spawn groups; both exist for other reasons (`FBI_spoocs` is a
  vanilla alias of `single_spooc`, `single_spoocs` is a dangling weight key -
  same quirk in vanilla 248.2).
- **Unit categories**: 34 referenced, all resolve (`FBI_reenforce`,
  `FBI_reenforce_heavy`, `FBI_SMG`, `FBI_office`, `CS_cop_all`, `CS_fbi_all`,
  `MKWTR_mercs`, `ranc_rangers`, `phalanx_pusher`, `tank_r870`,
  `tank_diff_specific`, `medic_*_refless`, `spooc_refless`, `taser_refless` are
  LIES-created in the hhtacs branch).
- **Character tweaks**: `tank`, `tank_mini`, `tank_medic`, `tank_hw`,
  `drug_lord_boss`, `medic`, `spooc`, `shadow_spooc`, `zeal_swat`,
  `zeal_heavy_swat`, `fbi_swat`, `fbi_heavy_swat`, `city_swat`, `taser`,
  `shield`, all civilians, `security*`, `gensec`, `sniper`,
  `marshal_{marksman,shield,shield_break}`, `old_hoxton_mission`, `spa_vip`,
  gangers.
- **Besiege helpers called**: `_get_law1_team`, `phalanx_vip`,
  `phalanx_minions`, `get_phalanx_minion_count`, `register_phalanx_vip`,
  `set_phalanx_damage_reduction_buff`, `set_damage_reduction_buff_hud`,
  `set_assault_endless`, `_check_spawn_timed_groups`, `_perform_group_spawning`,
  `_upd_group_spawning`, `_spawn_in_group`, `_set_objective_to_enemy_group`,
  `_verify_group_objective`, `_chk_group_areas_tresspassed`,
  `get_nav_seg_id_from_area`, `chk_area_leads_to_enemy`, `_count_police_force`,
  `criminal_spotted`, `all_player_criminals`, `all_AI_criminals`,
  `set_enemy_assigned`, `chk_say_enemy_chatter`. The 4 dotted-style definitions
  (`_create_objective_from_group_objective`, `_determine_group_leader`,
  `_get_closest_group_unit_to_pos`, `_get_group_acces_mask`) exist as
  `function Class.name(...)` at 248.2.
- **Hooks**: all 44 `Hooks:(Pre|Post)Hook` targets in `lua/` exist somewhere in
  the 248.2 tree, including `GroupAIManager.set_state`,
  `GroupAIStateBesiege._check_spawn_timed_groups`, `_perform_group_spawning`,
  `_upd_groups`, `on_criminal_nav_seg_change`, `NavigationManager._clear`,
  `Drill.on_sabotage_SO_completed`.
- **Manager calls**: `enemy:all_civilians`, `enemy:all_enemies`,
  `enemy:add_delayed_clbk`, `navigation:search_coarse`,
  `navigation:create_nav_tracker`, `navigation:get_nav_seg_from_pos`,
  `skirmish:is_skirmish`, `groupai:dispatch_event/state`,
  `mission:call_global_event/get_element_by_id`, `hud:start_assault`,
  `trade:set_trade_countdown`, `modifiers:modify_value`,
  `game_play_central:announcer_say`. `NavigationManager:get_nav_segments_in_direction`
  is **gone at 248.2** but LIES re-adds it in `lua/managers/navigationmanager.lua`,
  so the four `besiege` call sites remain valid.
- **Syntax**: `luajit -bl` exit 0 on `groupaistatebesiege.lua`,
  `groupaistatebase.lua`, `groupaitweakdata.lua`, `navigationmanager.lua`.

## Applied

- **H-01 fixed:** `_LIES_setup` now guards the skirmish metatable read on
  `managers.groupai:state()` / `managers.skirmish`; the wrong-table write is
  corrected to `self.skirmish.assault.groups[group_id]`.
- **H-09 fixed:** `set_enemy_assigned(self:get_area_from_nav_seg_id(
  new_objective.nav_seg), u_key)`.
- **H-02 deferred:** keep LIES's single-player phalanx behavior for now; the
  `phalanx.respawn_delay = 1200` key is dead (vanilla reads
  `spawn_chance.respawn_delay`). Needs a gameplay decision.
- **H-03/H-04 deferred:** 6th spawn-search argument is ignored; `max_dis` filter
  is dormant because all current callers pass nil. No behavior change today.
- **H-05 dead:** recon-sweep subsystem has no caller; leave for a future
  delete-or-wire decision.
- **H-06/H-07/H-08/H-12:** LIES-private keys, spawn-group detection quirk,
  marshal-gating `has_spawned`, intentional phalanx tuning. Documented, no code.
- **H-10/H-11:** already correct; ledger can be closed.

## Test plan (what static analysis cannot settle)

1. **H-01 boot check** - start the game with hhtacs on, grep the log for
   `_LIES_setup` / "Hyper Taktikz enabled". Confirms whether the skirmish
   metatable error is swallowed and whether the second `set_state` retries.
2. **H-02 phalanx** - DW+ assault on a level with VIP capable group. Expect:
   VIP spawn announces, phalanx minions form, damage-reduction HUD icon ramps
   and clears, `_phalanx_despawn_time` set. In solo, decide whether VIP should
   appear at all.
3. **H-01-H-05 smoke** - one skirmish/holdout round after the skirmish +
   recon-sweep edits, to prove the newly written table is the intended one and
   that no dead-code removal broke a dynamic call.
4. **H-09** - one SO-heavy heist, check cops assigned to SO areas do not
   thrash between areas in the group-AI debug draw.

## Decisions / artifacts

- No runtime Lua edited. Report only: `dev/reports/hhtacs-audit.md`.
- Ledger items this audit closes: `groupaitweakdata._setup_hhtacs_task_data`
  (audited: keys safe, H-02/H-06 only), `_queue_police_upd_task` (PORT verified
  correct), `_check_spawn_phalanx_LIES` (audited: H-02).
- Overlap with existing reports: `find_segment_doors` mixed return types and
  phalanx alias capture are **AI-02 / AI-03** in `dev/reports/core-ai-gap-audit.md`
  and are not re-proposed here.
- Recommended order if fixes are scheduled: H-01 (cheap, unblocks "is hhtacs
  even running"), then H-09, then H-02 decision, then H-03/H-04, then H-05
  deletion.

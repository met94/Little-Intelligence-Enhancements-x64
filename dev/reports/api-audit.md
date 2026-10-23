# LIES 248.2 API audit

Target: `e3a8b616`

- hooks: 68/68 ok
- method checks: 44/44 ok
- errors: 46
- review: 154

## Hook checks

| status | hook | script | note |
|---|---|---|---|
| ok | `lib/managers/menumanager` | `menumanager.lua` |  |
| ok | `lib/managers/menu/menunodegui` | `menunodegui.lua` |  |
| ok | `lib/tweak_data/attentiontweakdata` | `lua/tweak_data/attentiontweakdata.lua` |  |
| ok | `lib/tweak_data/weapontweakdata` | `lua/tweak_data/weapontweakdata.lua` |  |
| ok | `lib/tweak_data/charactertweakdata` | `lua/tweak_data/charactertweakdata.lua` |  |
| ok | `lib/tweak_data/levelstweakdata` | `lua/tweak_data/levelstweakdata.lua` |  |
| ok | `lib/tweak_data/groupaitweakdata` | `lua/tweak_data/groupaitweakdata.lua` |  |
| ok | `lib/tweak_data/skirmishtweakdata` | `lua/tweak_data/skirmishtweakdata.lua` |  |
| ok | `lib/managers/enemymanager` | `lua/managers/enemymanager.lua` |  |
| ok | `lib/managers/navigationmanager` | `lua/managers/navigationmanager.lua` |  |
| ok | `lib/units/characters/characterattentionobject` | `lua/characters/characterattentionobject.lua` |  |
| ok | `lib/units/props/securitycamera` | `lua/props/securitycamera.lua` |  |
| ok | `lib/units/props/carrydata` | `lua/props/carrydata.lua` |  |
| ok | `lib/units/props/drill` | `lua/props/drill.lua` |  |
| ok | `lib/managers/groupaimanager` | `lua/groupaistate/groupaimanager.lua` |  |
| ok | `lib/managers/mission/missionscriptelement` | `lua/managers/mapelements/missionscriptelement.lua` |  |
| ok | `lib/managers/mission/elementenemyprefered` | `lua/managers/mapelements/elementenemyprefered.lua` |  |
| ok | `lib/managers/mission/elementspawnenemydummy` | `lua/managers/mapelements/elementspawnenemydummy.lua` |  |
| ok | `lib/managers/mission/elementspawncivilian` | `lua/managers/mapelements/elementspawncivilian.lua` |  |
| ok | `lib/managers/mission/elementspawnciviliangroup` | `lua/managers/mapelements/elementspawnciviliangroup.lua` |  |
| ok | `lib/managers/mission/elementdifficulty` | `lua/managers/mapelements/elementdifficulty.lua` |  |
| ok | `lib/managers/mission/elementspawnenemygroup` | `lua/managers/mapelements/elementspawnenemygroup.lua` |  |
| ok | `lib/managers/mission/elementspecialobjective` | `lua/managers/mapelements/elementspecialobjective.lua` |  |
| ok | `lib/managers/mission/elementspecialobjectivegroup` | `lua/managers/mapelements/elementspecialobjectivegroup.lua` |  |
| ok | `lib/managers/mission/elementaiglobalevent` | `lua/managers/mapelements/elementaiglobalevent.lua` |  |
| ok | `lib/managers/group_ai_states/groupaistatebase` | `lua/groupaistate/groupaistatebase.lua` |  |
| ok | `lib/managers/group_ai_states/groupaistatebesiege` | `lua/groupaistate/groupaistatebesiege.lua` |  |
| ok | `lib/units/enemies/cop/copdamage` | `lua/copextensions/copdamage.lua` |  |
| ok | `lib/units/enemies/tank/tankcopdamage` | `lua/copextensions/tankcopdamage.lua` |  |
| ok | `lib/units/enemies/cop/copbase` | `lua/copextensions/copbase.lua` |  |
| ok | `lib/units/enemies/cop/copmovement` | `lua/copextensions/copmovement.lua` |  |
| ok | `lib/units/enemies/cop/copbrain` | `lua/copextensions/copbrain.lua` |  |
| ok | `lib/units/enemies/cop/copsound` | `lua/copextensions/copsound.lua` |  |
| ok | `lib/units/enemies/cop/actions/upper_body/copactionshoot` | `lua/copactions/copactionshoot.lua` |  |
| ok | `lib/units/enemies/cop/actions/lower_body/copactionwalk` | `lua/copactions/copactionwalk.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicintimidated` | `lua/coplogics/coplogicintimidated.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicbase` | `lua/coplogics/coplogicbase.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogictravel` | `lua/coplogics/coplogictravel.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicidle` | `lua/coplogics/coplogicidle.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicarrest` | `lua/coplogics/coplogicarrest.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicattack` | `lua/coplogics/coplogicattack.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicsniper` | `lua/coplogics/coplogicsniper.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicphalanxminion` | `lua/coplogics/coplogicphalanxminion.lua` |  |
| ok | `lib/units/enemies/cop/logics/coplogicphalanxvip` | `lua/coplogics/coplogicphalanxvip.lua` |  |
| ok | `lib/units/enemies/tank/logics/tankcoplogicattack` | `lua/coplogics/specials/tankcoplogicattack.lua` |  |
| ok | `lib/units/enemies/shield/logics/shieldlogicattack` | `lua/coplogics/specials/shieldlogicattack.lua` |  |
| ok | `lib/units/enemies/taser/logics/taserlogicattack` | `lua/coplogics/specials/taserlogicattack.lua` |  |
| ok | `lib/units/enemies/spooc/logics/spooclogicattack` | `lua/coplogics/specials/spooc/spooclogicattack.lua` |  |
| ok | `lib/units/enemies/spooc/logics/spooclogicidle` | `lua/coplogics/specials/spooc/spooclogicidle.lua` |  |
| ok | `lib/units/enemies/boss/logics/bosslogicattack` | `lua/coplogics/boss/bosslogicattack.lua` |  |
| ok | `lib/units/player_team/teamaidamage` | `lua/teamaiextensions/teamaidamage.lua` |  |
| ok | `lib/units/player_team/teamaimovement` | `lua/teamaiextensions/teamaimovement.lua` |  |
| ok | `lib/units/player_team/teamaibrain` | `lua/teamaiextensions/teamaibrain.lua` |  |
| ok | `lib/units/player_team/teamaiinventory` | `lua/teamaiextensions/teamaiinventory.lua` |  |
| ok | `lib/units/player_team/logics/teamailogicbase` | `lua/teamailogics/teamailogicbase.lua` |  |
| ok | `lib/units/player_team/logics/teamailogicidle` | `lua/teamailogics/teamailogicidle.lua` |  |
| ok | `lib/units/player_team/logics/teamailogictravel` | `lua/teamailogics/teamailogictravel.lua` |  |
| ok | `lib/units/player_team/logics/teamailogicassault` | `lua/teamailogics/teamailogicassault.lua` |  |
| ok | `lib/units/player_team/logics/teamailogicdisabled` | `lua/teamailogics/teamailogicdisabled.lua` |  |
| ok | `lib/units/beings/player/states/playerbleedout` | `lua/player/states/playerbleedout.lua` |  |
| ok | `lib/units/beings/player/states/playerdriving` | `lua/player/states/playerdriving.lua` |  |
| ok | `lib/units/civilians/logics/civilianlogicflee` | `lua/civlogics/civilianlogicflee.lua` |  |
| ok | `lib/units/civilians/logics/civilianlogicidle` | `lua/civlogics/civilianlogicidle.lua` |  |
| ok | `lib/units/civilians/logics/civilianlogictravel` | `lua/civlogics/civilianlogictravel.lua` |  |
| ok | `lib/units/civilians/logics/civilianlogicescort` | `lua/civlogics/civilianlogicescort.lua` |  |
| ok | `lib/units/civilians/logics/civilianlogicsurrender` | `lua/civlogics/civilianlogicsurrender.lua` |  |
| ok | `lib/units/equipment/sentry_gun/sentrygunbase` | `lua/equipment/sentry_gun/sentrygunbase.lua` |  |
| ok | `core/lib/utils/dev/editor/coreworlddefinition` | `lua/managers/core/coreworlddefinition.lua` |  |

## Hook method checks

| status | hook | class.method | id |
|---|---|---|---|
| ok | PostHook | `CopBrain._reset_logic_data` | `lies_reset_logic_data` |
| ok | PostHook | `CopBrain.set_spawn_entry` | `lies_accessentry` |
| ok | PostHook | `CopBrain.convert_to_criminal` | `lies_convert_to_criminal` |
| ok | PostHook | `CopBrain.clbk_death` | `lies_remove_sabo_outline` |
| ok | PostHook | `CopBrain.set_group` | `lies_reset_weapons` |
| ok | PostHook | `CopBrain.on_reload` | `lies_on_reload` |
| ok | PostHook | `CopBrain.clbk_death` | `lies_clbk_death` |
| ok | PostHook | `CopBrain._add_pathing_result` | `lies_pathing` |
| ok | PostHook | `CopMovement._upd_actions` | `lies_actions` |
| ok | PostHook | `CopSound.init` | `lies_init` |
| ok | PostHook | `TankCopDamage.seq_clbk_vizor_shatter` | `lies_tankvisorbroken` |
| ok | PostHook | `SentryGunBase.activate_as_module` | `lies_fix_turret_fuck` |
| ok | PreHook | `GroupAIManager.set_state` | `lies_groupsetup` |
| ok | PostHook | `GroupAIStateBase._clbk_switch_enemies_to_not_cool` | `lies_switch_tweaks_for_guards` |
| ok | PostHook | `GroupAIStateBase.register_rescueable_hostage` | `lies_hrt_reg` |
| ok | PostHook | `GroupAIStateBase.unregister_rescueable_hostage` | `lies_hrt_unreg` |
| ok | PostHook | `GroupAIStateBase.on_enemy_unregistered` | `lies_unregister_boss` |
| ok | PostHook | `GroupAIStateBase._remove_group_member` | `lies_frienddead` |
| ok | PostHook | `GroupAIStateBesiege.init` | `lies_spawngroups` |
| ok | PostHook | `GroupAIStateBesiege._check_spawn_timed_groups` | `lieshhtacs_checkspawnedgroups` |
| ok | PostHook | `GroupAIStateBesiege._perform_group_spawning` | `lies_upd_group_early` |
| ok (base) | PostHook | `GroupAIStateBesiege.on_criminal_nav_seg_change` | `lies_check_relocation_for_friendlies` |
| ok | PostHook | `GroupAIStateBesiege._upd_groups` | `lies_group_dialogue` |
| ok | PostHook | `GroupAIStateBesiege._upd_assault_task` | `lies_retire` |
| ok | PostHook | `WorldDefinition.assign_unit_data` | `lies_fix_dumb_map_stuff` |
| ok | PostHook | `ElementDifficulty.init` | `lies_alter_diff_values` |
| ok | PostHook | `ElementSpawnCivilian._finalize_values` | `lies_finalize_values` |
| ok | PostHook | `ElementSpawnCivilianGroup._finalize_values` | `lies_finalize_values` |
| ok | PostHook | `ElementSpawnEnemyDummy._finalize_values` | `lies_hhtacs_elementcheck` |
| ok | PostHook | `ElementSpawnEnemyGroup._finalize_values` | `lies_finalize_values` |
| ok | PostHook | `ElementSpecialObjective._finalize_values` | `lies_send_navlink_element` |
| ok | PostHook | `MissionScriptElement.on_executed` | `lies_nav_and_modify` |
| ok | PostHook | `NavigationManager.update` | `lies_cover` |
| ok | PostHook | `PlayerDriving.update` | `lies_fix_vehicle` |
| ok | PostHook | `PlayerFatal.enter` | `lies_fix_revive` |
| ok | PostHook | `Drill.on_sabotage_SO_completed` | `lies_drilljammedvoiceline` |
| ok | PostHook | `Drill.clbk_sabotage_SO_verification` | `lies_tacs_drill` |
| ok | PostHook | `Drill._unregister_sabotage_SO` | `lies_unregisterdrill` |
| ok | PostHook | `TeamAIBrain.on_cool_state_changed` | `lies_swap` |
| ok | PostHook | `AttentionTweakData.init` | `lies_fix_badaimobjs` |
| ok | PostHook | `CharacterTweakData.init` | `lies_fix_nosup` |
| ok | PostHook | `GroupAITweakData._init_chatter_data` | `lies_chatter` |
| ok | PostHook | `LevelsTweakData.init` | `lies_fixed_ai_obj` |
| ok (base) | PostHook | `MenuNodeGui._setup_item_rows` | `LIES_update` |

## Errors

- `lua/coplogics/coplogictravel.lua:2002` `_room_doors` — Removed in nav v6; doors are position vectors in segment.neighbours. `local all_doors = managers.navigation._room_doors`
- `lua/groupaistate/groupaistatebesiege.lua:2926` `get_nav_segments_in_direction` — Removed; use _quad_field/nav_segment_neighbours. `local navsegs = managers.navigation:get_nav_segments_in_direction(other_group.objective.area.pos_nav_seg, fwd_vec)`
- `lua/groupaistate/groupaistatebesiege.lua:3240` `get_nav_segments_in_direction` — Removed; use _quad_field/nav_segment_neighbours. `local navsegs = managers.navigation:get_nav_segments_in_direction(other_group.objective.area.pos_nav_seg, fwd_vec)`
- `lua/groupaistate/groupaistatebesiege.lua:4107` `get_nav_segments_in_direction` — Removed; use _quad_field/nav_segment_neighbours. `local get_dir_navsegs_f = nav_manager.get_nav_segments_in_direction`
- `lua/groupaistate/groupaistatebesiege.lua:4149` `_room_doors` — Removed in nav v6; doors are position vectors in segment.neighbours. `test_pos = managers.navigation._room_doors[door_id].center`
- `lua/groupaistate/groupaistatebesiege.lua:4268` `get_nav_segments_in_direction` — Removed; use _quad_field/nav_segment_neighbours. `local get_dir_navsegs_f = nav_manager.get_nav_segments_in_direction`
- `lua/groupaistate/groupaistatebesiege.lua:4310` `_room_doors` — Removed in nav v6; doors are position vectors in segment.neighbours. `test_pos = managers.navigation._room_doors[door_id].center`
- `lua/managers/enemymanager.lua:18` `_corpse_disposal_id` — Timer-based disposal in 248.2. `local corpse_disposal_id = self._corpse_disposal_id`
- `lua/managers/enemymanager.lua:21` `_corpse_disposal_id` — Timer-based disposal in 248.2. `self._corpse_disposal_id = nil`
- `lua/managers/enemymanager.lua:32` `_corpse_disposal_id` — Timer-based disposal in 248.2. `local corpse_disposal_id = self._corpse_disposal_id`
- `lua/managers/enemymanager.lua:40` `_corpse_disposal_id` — Timer-based disposal in 248.2. `self._corpse_disposal_id = corpse_disposal_id`
- `lua/managers/enemymanager.lua:53` `_corpse_disposal_id` — Timer-based disposal in 248.2. `local corpse_disposal_id = self._corpse_disposal_id`
- `lua/managers/enemymanager.lua:57` `_corpse_disposal_id` — Timer-based disposal in 248.2. `self._corpse_disposal_id = nil`
- `lua/managers/enemymanager.lua:63` `_corpse_disposal_id` — Timer-based disposal in 248.2. `self._corpse_disposal_id = corpse_disposal_id`
- `lua/managers/enemymanager.lua:92` `no_dispose` — Renamed to no_disposal. `if not corpse_data.no_dispose then`
- `lua/managers/enemymanager.lua:95` `_corpse_disposal_id` — Timer-based disposal in 248.2. `local corpse_disposal_id = self._corpse_disposal_id`
- `lua/managers/enemymanager.lua:98` `_corpse_disposal_id` — Timer-based disposal in 248.2. `self._corpse_disposal_id = nil`
- `lua/managers/enemymanager.lua:130` `no_dispose` — Renamed to no_disposal. `if not corpse_data.no_dispose then`
- `lua/managers/enemymanager.lua:133` `_corpse_disposal_id` — Timer-based disposal in 248.2. `local corpse_disposal_id = self._corpse_disposal_id`
- `lua/managers/enemymanager.lua:136` `_corpse_disposal_id` — Timer-based disposal in 248.2. `self._corpse_disposal_id = nil`
- `lua/managers/enemymanager.lua:162` `_shield_disposal_id` — Timer-based disposal in 248.2. `local shield_disposal_id = self._shield_disposal_id`
- `lua/managers/enemymanager.lua:166` `_shield_disposal_id` — Timer-based disposal in 248.2. `self._shield_disposal_id = shield_disposal_id`
- `lua/managers/enemymanager.lua:169` `_fast_shield_disposal` — Removed in 247. `self._fast_shield_disposal = true`
- `lua/managers/enemymanager.lua:175` `_fast_shield_disposal` — Removed in 247. `elseif not self._fast_shield_disposal and self:shield_limit() < nr_shields then`
- `lua/managers/enemymanager.lua:176` `_fast_shield_disposal` — Removed in 247. `self._fast_shield_disposal = false`
- `lua/managers/enemymanager.lua:194` `_shield_disposal_id` — Timer-based disposal in 248.2. `local shield_disposal_id = self._shield_disposal_id`
- `lua/managers/enemymanager.lua:201` `_shield_disposal_id` — Timer-based disposal in 248.2. `self._shield_disposal_id = nil`
- `lua/managers/enemymanager.lua:202` `_fast_shield_disposal` — Removed in 247. `self._fast_shield_disposal = false`
- `lua/managers/enemymanager.lua:205` `_fast_shield_disposal` — Removed in 247. `elseif self._fast_shield_disposal and nr_shields <= self:shield_limit() then`
- `lua/managers/enemymanager.lua:206` `_fast_shield_disposal` — Removed in 247. `self._fast_shield_disposal = false`
- `lua/managers/enemymanager.lua:341` `_shield_disposal_id` — Timer-based disposal in 248.2. `self:add_delayed_clbk(self._shield_disposal_id, callback(self, self, "_upd_shield_disposal"), delay)`
- `lua/managers/enemymanager.lua:343` `_shield_disposal_id` — Timer-based disposal in 248.2. `self._shield_disposal_id = nil`
- `lua/managers/navigationmanager.lua:113` `_room_doors` — Removed in nav v6; doors are position vectors in segment.neighbours. `local all_doors = self._room_doors`
- `lua/managers/navigationmanager.lua:1601` `_rooms` — Removed at runtime in nav v6. `rooms = self._rooms`
- `lua/managers/navigationmanager.lua:1605` `_room_doors` — Removed in nav v6; doors are position vectors in segment.neighbours. `send_data.doors = self._room_doors`
- `lua/managers/navigationmanager.lua:1610` `_nr_geog_segments` — Removed in nav v6. `send_data.sector_max_x = self._nr_geog_segments and self._nr_geog_segments.x or 0`
- `lua/managers/navigationmanager.lua:1611` `_nr_geog_segments` — Removed in nav v6. `send_data.sector_max_y = self._nr_geog_segments and self._nr_geog_segments.y or 0`
- `lua/managers/navigationmanager.lua:1615` `_visibility_groups` — Never assigned in nav v6. `for i_vis_group, vis_group in ipairs(self._visibility_groups) do`
- `lua/managers/navigationmanager.lua:1627` `_rooms` — Removed at runtime in nav v6. `self._nav_segments[vis_group.seg].rooms[i_room] = self._rooms[i_room]`
- `lua/managers/navigationmanager.lua:1653` `_geog_segments` — Removed in nav v6. `for sector_id, sector in pairs(self._geog_segments) do`
- `lua/managers/navigationmanager.lua:1676` `_strip_nav_field_for_gameplay` — Function removed in nav v6. `function NavigationManager:_strip_nav_field_for_gameplay()`
- `lua/managers/navigationmanager.lua:1677` `_room_doors` — Removed in nav v6; doors are position vectors in segment.neighbours. `local all_doors = self._room_doors`
- `lua/managers/navigationmanager.lua:1678` `_rooms` — Removed at runtime in nav v6. `local all_rooms = self._rooms`
- `lua/managers/navigationmanager.lua:1701` `_rooms` — Removed at runtime in nav v6. `self._rooms = {}`
- `lua/managers/navigationmanager.lua:1702` `_geog_segments` — Removed in nav v6. `self._geog_segments = {}`
- `lua/managers/navigationmanager.lua:1704` `_visibility_groups` — Never assigned in nav v6. `self._visibility_groups = {}`

## Review

- `lua/civlogics/civilianlogicescort.lua:45` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.outline_detection_task_key, CivilianLogicIdle._upd_outline_detection, data, data.t + 2)`
- `lua/civlogics/civilianlogicflee.lua:81` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.outline_detection_task_key, CivilianLogicIdle._upd_outline_detection, data, data.t + 2)`
- `lua/civlogics/civilianlogicflee.lua:783` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.cover_search_task_key, CivilianLogicFlee._find_hide_cover, data, data.t + 0.5)`
- `lua/civlogics/civilianlogicflee.lua:916` `search_coarse` — Start/end validation added at 247. `coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/civlogics/civilianlogicidle.lua:30` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CivilianLogicIdle._upd_detection, data, data.t + 1)`
- `lua/civlogics/civilianlogicidle.lua:35` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.outline_detection_task_key, CivilianLogicIdle._upd_outline_detection, data, data.t + 2)`
- `lua/civlogics/civilianlogicidle.lua:218` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CivilianLogicIdle._upd_detection, data, data.t + delay)`
- `lua/civlogics/civilianlogicsurrender.lua:67` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.outline_detection_task_key, CivilianLogicIdle._upd_outline_detection, data, data.t + 2)`
- `lua/civlogics/civilianlogictravel.lua:19` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `return CopLogicTravel._get_pos_on_wall(managers.navigation._nav_segments[objective.nav_seg].pos, 700, nil, nil, nil, data.pos_rsrv_id)`
- `lua/copextensions/copbrain.lua:872` `search_coarse` — Start/end validation added at 247. `return managers.navigation:search_coarse(params)`
- `lua/copextensions/copbrain.lua:894` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `managers.navigation:search_pos_to_pos(params)`
- `lua/copextensions/copbrain.lua:917` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `managers.navigation:search_pos_to_pos(params)`
- `lua/copextensions/copbrain.lua:945` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `managers.navigation:search_pos_to_pos(params)`
- `lua/copextensions/copbrain.lua:1368` `search_coarse` — Start/end validation added at 247. `managers.navigation:search_coarse(params)`
- `lua/coplogics/boss/bosslogicattack.lua:163` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_queue_id, LIESBossLogicAttack.queued_update, data, data.t + delay, true)`
- `lua/coplogics/boss/bosslogicattack.lua:938` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, LIESBossLogicAttack._upd_enemy_detection, data, data.t + delay, true)`
- `lua/coplogics/coplogicarrest.lua:245` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, CopLogicArrest.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/coplogicarrest.lua:312` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, CopLogicArrest.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/coplogicattack.lua:117` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_queue_id, data.logic.queued_update, data, data.t + (data.important and 0 or 0.2), true)`
- `lua/coplogics/coplogicattack.lua:188` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicAttack._upd_enemy_detection, data, delay and data.t + delay, data.important and true)`
- `lua/coplogics/coplogicattack.lua:1116` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = managers.navigation._nav_segments`
- `lua/coplogics/coplogicattack.lua:1123` `find_segment_doors` — Returns position vectors, not door tables. `local doors = managers.navigation:find_segment_doors(enemy_nav_seg)`
- `lua/coplogics/coplogicattack.lua:1342` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/coplogics/coplogicattack.lua:1398` `find_segment_doors` — Returns position vectors, not door tables. `local found_doors = managers.navigation:find_segment_doors(from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", to_nav_seg), true)`
- `lua/coplogics/coplogicattack.lua:1402` `find_segment_doors` — Returns position vectors, not door tables. `found_doors = managers.navigation:find_segment_doors(from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", enemy_seg), true)`
- `lua/coplogics/coplogicattack.lua:2862` `_quad_field` — New engine surface; verify method/arg shapes. `found_cover = managers.navigation._quad_field:find_cover(search_params)`
- `lua/coplogics/coplogicbase.lua:263` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = managers.navigation._nav_segments`
- `lua/coplogics/coplogicbase.lua:417` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `function CopLogicBase.queue_task(internal_data, id, func, data, exec_t, asap)`
- `lua/coplogics/coplogicbase.lua:448` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `managers.enemy:queue_task(id, func, data, exec_t, callback(CopLogicBase, CopLogicBase, "on_queued_task", internal_data), asap)`
- `lua/coplogics/coplogicidle.lua:76` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicIdle.queued_update, data, data.t, data.important and true)`
- `lua/coplogics/coplogicidle.lua:93` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.wall_stare_task_key, CopLogicIdle._chk_stare_into_wall_1, data, data.t)`
- `lua/coplogics/coplogicidle.lua:184` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicIdle.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogicidle.lua:275` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicIdle.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogicidle.lua:1923` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.wall_stare_task_key, CopLogicIdle._chk_stare_into_wall_1, data, data.t)`
- `lua/coplogics/coplogicintimidated.lua:45` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, CopLogicIntimidated.queued_update, data, data.t + 0.2)`
- `lua/coplogics/coplogicintimidated.lua:148` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, CopLogicIntimidated.queued_update, data, data.t + 0.2)`
- `lua/coplogics/coplogicphalanxminion.lua:33` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicPhalanxMinion.queued_update, data, data.t)`
- `lua/coplogics/coplogicphalanxminion.lua:77` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicPhalanxMinion.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogicphalanxminion.lua:102` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicPhalanxMinion.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogicphalanxvip.lua:33` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicPhalanxVip.queued_update, data, data.t)`
- `lua/coplogics/coplogicsniper.lua:31` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicSniper._upd_enemy_detection, data, data.t)`
- `lua/coplogics/coplogicsniper.lua:157` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicSniper._upd_enemy_detection, data, data.t + delay)`
- `lua/coplogics/coplogictravel.lua:187` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicTravel.queued_detection_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogictravel.lua:287` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segments = managers.navigation._nav_segments`
- `lua/coplogics/coplogictravel.lua:460` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segments = managers.navigation._nav_segments`
- `lua/coplogics/coplogictravel.lua:1330` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local near_pos = objective.follow_unit and alive(objective.follow_unit) and objective.follow_unit:movement():nav_tracker():field_position() or data.internal_data.coarse_path[#data.internal_data.coarse`
- `lua/coplogics/coplogictravel.lua:1393` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `follow_pos = my_data.coarse_path[#my_data.coarse_path][2] or managers.navigation._nav_segments[dest_nav_seg_id].pos`
- `lua/coplogics/coplogictravel.lua:2000` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local nav_seg_data = managers.navigation._nav_segments[coarse_path[nav_index + 1][1]]`
- `lua/coplogics/coplogictravel.lua:2116` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.upd_task_key, CopLogicTravel.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/specials/shieldlogicattack.lua:430` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_queue_id, ShieldLogicAttack.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/specials/spooc/spooclogicattack.lua:28` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicAttack._upd_enemy_detection, data, data.t)`
- `lua/coplogics/specials/tankcoplogicattack.lua:21` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicAttack._upd_enemy_detection, data)`
- `lua/coplogics/specials/taserlogicattack.lua:28` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, TaserLogicAttack.queued_update, data, data.t, data.important)`
- `lua/coplogics/specials/taserlogicattack.lua:65` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, TaserLogicAttack.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/specials/taserlogicattack.lua:75` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, TaserLogicAttack.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/specials/taserlogicattack.lua:105` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, TaserLogicAttack.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/specials/taserlogicattack.lua:127` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, TaserLogicAttack.queued_update, data, data.t + delay, data.important)`
- `lua/groupaistate/groupaistatebase.lua:86` `_quad_field` — New engine surface; verify method/arg shapes. `local quadfield = managers.navigation._quad_field`
- `lua/groupaistate/groupaistatebesiege.lua:169` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `obj_pos = managers.navigation._nav_segments[objective.nav_seg].pos`
- `lua/groupaistate/groupaistatebesiege.lua:551` `_police_upd_task_queued` — Boolean -> timestamp in 247. `self._police_upd_task_queued = false`
- `lua/groupaistate/groupaistatebesiege.lua:662` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local nav_segments = managers.navigation._nav_segments`
- `lua/groupaistate/groupaistatebesiege.lua:960` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(params)`
- `lua/groupaistate/groupaistatebesiege.lua:1131` `_police_upd_task_queued` — Boolean -> timestamp in 247. `if not self._police_upd_task_queued then`
- `lua/groupaistate/groupaistatebesiege.lua:1132` `_police_upd_task_queued` — Boolean -> timestamp in 247. `self._police_upd_task_queued = true`
- `lua/groupaistate/groupaistatebesiege.lua:1334` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:1369` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2378` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2422` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2476` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2532` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2595` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3004` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3088` `search_coarse` — Start/end validation added at 247. `push_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3121` `search_coarse` — Start/end validation added at 247. `push_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3318` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3412` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3416` `search_coarse` — Start/end validation added at 247. `coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3437` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3441` `search_coarse` — Start/end validation added at 247. `coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3810` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3833` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3995` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:4105` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = nav_manager._nav_segments`
- `lua/groupaistate/groupaistatebesiege.lua:4266` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = nav_manager._nav_segments`
- `lua/groupaistate/groupaistatebesiege.lua:4503` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:4531` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:4594` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(coarse_params)`
- `lua/managers/mapelements/elementspecialobjective.lua:373` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/managers/navigationmanager.lua:43` `find_segment_doors` — Returns position vectors, not door tables. `function NavigationManager:find_segment_doors(from_seg_id, approve_clbk, center_only)`
- `lua/managers/navigationmanager.lua:45` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:67` `_quad_field` — New engine surface; verify method/arg shapes. `local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)`
- `lua/managers/navigationmanager.lua:93` `_quad_field` — New engine surface; verify method/arg shapes. `local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)`
- `lua/managers/navigationmanager.lua:114` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:156` `_quad_field` — New engine surface; verify method/arg shapes. `local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)`
- `lua/managers/navigationmanager.lua:182` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:206` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:370` `_quad_field` — New engine surface; verify method/arg shapes. `elseif tracker:obstructed() or not self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) then`
- `lua/managers/navigationmanager.lua:404` `_quad_field` — New engine surface; verify method/arg shapes. `local nav_tracker = self._quad_field:create_nav_tracker(pos, true)`
- `lua/managers/navigationmanager.lua:411` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local room_nav_seg = self._nav_segments[nav_tracker:nav_segment()]`
- `lua/managers/navigationmanager.lua:418` `_quad_field` — New engine surface; verify method/arg shapes. `local navseg_tracker = self._quad_field:create_nav_tracker(room_nav_seg.pos, true)`
- `lua/managers/navigationmanager.lua:434` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(navseg_tracker, true)`
- `lua/managers/navigationmanager.lua:469` `_quad_field` — New engine surface; verify method/arg shapes. `local nav_tracker = self._quad_field:create_nav_tracker(pos, true)`
- `lua/managers/navigationmanager.lua:478` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(nav_tracker)`
- `lua/managers/navigationmanager.lua:492` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local max_cover_points = #covers <= 0 and 5000 or math.round(16 * table.size(self._nav_segments))`
- `lua/managers/navigationmanager.lua:501` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `for key, res in pairs(self._nav_segments) do`
- `lua/managers/navigationmanager.lua:503` `_quad_field` — New engine surface; verify method/arg shapes. `local tracker = self._quad_field:create_nav_tracker(res.pos, true)`
- `lua/managers/navigationmanager.lua:505` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(tracker, true)`
- `lua/managers/navigationmanager.lua:518` `_quad_field` — New engine surface; verify method/arg shapes. `local try_tracker = self._quad_field:create_nav_tracker(room_pos, true)`
- `lua/managers/navigationmanager.lua:538` `_quad_field` — New engine surface; verify method/arg shapes. `local zingus_tracker = self._quad_field:create_nav_tracker(try_pos, true)`
- `lua/managers/navigationmanager.lua:738` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `function NavigationManager:search_pos_to_pos(params)`
- `lua/managers/navigationmanager.lua:822` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:detailed_search(params)`
- `lua/managers/navigationmanager.lua:920` `_quad_field` — New engine surface; verify method/arg shapes. `local id = self._quad_field:add_obstacle(obstacle_obj)`
- `lua/managers/navigationmanager.lua:977` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if not self._nav_segments[id] then`
- `lua/managers/navigationmanager.lua:986` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:set_nav_segment_blocked_filter(id, access_filter)`
- `lua/managers/navigationmanager.lua:988` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[id].blocked_group = filter_group`
- `lua/managers/navigationmanager.lua:990` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if self._nav_segments[id].blocked_group and self._cached_paths and #self._cached_paths > 0 then`
- `lua/managers/navigationmanager.lua:1023` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:set_nav_segment_blocked_filter(id, 0)`
- `lua/managers/navigationmanager.lua:1025` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[id].blocked_group = nil`
- `lua/managers/navigationmanager.lua:1027` `_quad_field` — New engine surface; verify method/arg shapes. `local cur_state = self._quad_field:is_nav_segment_enabled(id)`
- `lua/managers/navigationmanager.lua:1034` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[id].disabled = seg_disabled_state`
- `lua/managers/navigationmanager.lua:1037` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:set_nav_segment_enabled(id, wanted_state)`
- `lua/managers/navigationmanager.lua:1096` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `for seg_id, seg_info in pairs(self._nav_segments) do`
- `lua/managers/navigationmanager.lua:1118` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `for seg_id, seg_info in pairs(self._nav_segments) do`
- `lua/managers/navigationmanager.lua:1165` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `for key, res in pairs(self._nav_segments) do`
- `lua/managers/navigationmanager.lua:1167` `_quad_field` — New engine surface; verify method/arg shapes. `local tracker = self._quad_field:create_nav_tracker(res.pos, true)`
- `lua/managers/navigationmanager.lua:1169` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(tracker)`
- `lua/managers/navigationmanager.lua:1232` `_quad_field` — New engine surface; verify method/arg shapes. `if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then`
- `lua/managers/navigationmanager.lua:1250` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then`
- `lua/managers/navigationmanager.lua:1327` `_quad_field` — New engine surface; verify method/arg shapes. `if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then`
- `lua/managers/navigationmanager.lua:1349` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then`
- `lua/managers/navigationmanager.lua:1426` `_quad_field` — New engine surface; verify method/arg shapes. `if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then`
- `lua/managers/navigationmanager.lua:1451` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then`
- `lua/managers/navigationmanager.lua:1490` `_quad_field` — New engine surface; verify method/arg shapes. `local position_tracker = self._quad_field:create_nav_tracker(position)`
- `lua/managers/navigationmanager.lua:1494` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:destroy_nav_tracker(position_tracker)`
- `lua/managers/navigationmanager.lua:1545` `_quad_field` — New engine surface; verify method/arg shapes. `local position_tracker = self._quad_field:create_nav_tracker(altered_pos, true)`
- `lua/managers/navigationmanager.lua:1551` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:destroy_nav_tracker(position_tracker)`
- `lua/managers/navigationmanager.lua:1598` `send_nav_field_to_engine` — Renamed _send_nav_field_to_engine(load_data); v5 data format. `function NavigationManager:send_nav_field_to_engine()`
- `lua/managers/navigationmanager.lua:1606` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `send_data.nav_segments = self._nav_segments`
- `lua/managers/navigationmanager.lua:1622` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if self._nav_segments[vis_group.seg] and self._nav_segments[vis_group.seg].pos then`
- `lua/managers/navigationmanager.lua:1623` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if not self._nav_segments[vis_group.seg].rooms then`
- `lua/managers/navigationmanager.lua:1624` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[vis_group.seg].rooms = {}`
- `lua/managers/navigationmanager.lua:1627` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[vis_group.seg].rooms[i_room] = self._rooms[i_room]`
- `lua/managers/navigationmanager.lua:1729` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segments = self._nav_segments`
- `lua/managers/navigationmanager.lua:1792` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_nav_segment_blocked(i_seg, search_data.access_pos) then`
- `lua/managers/navigationmanager.lua:1824` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:1876` `_quad_field` — New engine surface; verify method/arg shapes. `local from_tracker = self._quad_field:create_nav_tracker(pos)`
- `lua/managers/navigationmanager.lua:1929` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:destroy_nav_tracker(from_tracker)`
- `lua/teamailogics/teamailogicassault.lua:28` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicAssault._upd_enemy_detection, data, data.t)`
- `lua/teamailogics/teamailogicassault.lua:334` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicAssault._upd_enemy_detection, data, data.t + delay)`
- `lua/teamailogics/teamailogicidle.lua:404` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.wall_stare_task_key, CopLogicIdle._chk_stare_into_wall_1, data, data.t)`
- `lua/teamailogics/teamailogicidle.lua:533` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicIdle._upd_enemy_detection, data, data.t + delay)`
- `lua/teamailogics/teamailogictravel.lua:33` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicTravel._upd_enemy_detection, data, data.t)`
- `lua/teamailogics/teamailogictravel.lua:202` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, key, TeamAILogicTravel._remove_enemy_attention, {`
- `lua/teamailogics/teamailogictravel.lua:214` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicTravel._upd_enemy_detection, data, data.t + delay)`


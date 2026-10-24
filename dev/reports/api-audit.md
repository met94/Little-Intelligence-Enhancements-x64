# LIES 248.2 API audit

Target: `e3a8b616`

- hooks: 68/68 ok
- method checks: 48/48 ok
- errors: 0
- review: 152

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
| ok | PostHook | `GroupAIStateBesiege._check_phalanx_group_has_spawned` | `lies_check_phalanx_spawn_log` |
| ok | PostHook | `GroupAIStateBesiege.phalanx_damage_reduction_enable` | `lies_check_phalanx_buff_enable` |
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
| ok | PostHook | `NavigationManager._unregister_cover_units` | `LIES_nav_gen_abort_unregister` |
| ok | PostHook | `NavigationManager._clear` | `LIES_nav_gen_abort_clear` |
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

None.

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
- `lua/copextensions/copbrain.lua:874` `search_coarse` — Start/end validation added at 247. `return managers.navigation:search_coarse(params)`
- `lua/copextensions/copbrain.lua:896` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `managers.navigation:search_pos_to_pos(params)`
- `lua/copextensions/copbrain.lua:919` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `managers.navigation:search_pos_to_pos(params)`
- `lua/copextensions/copbrain.lua:947` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `managers.navigation:search_pos_to_pos(params)`
- `lua/copextensions/copbrain.lua:1370` `search_coarse` — Start/end validation added at 247. `managers.navigation:search_coarse(params)`
- `lua/coplogics/boss/bosslogicattack.lua:163` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_queue_id, LIESBossLogicAttack.queued_update, data, data.t + delay, true)`
- `lua/coplogics/boss/bosslogicattack.lua:938` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, LIESBossLogicAttack._upd_enemy_detection, data, data.t + delay, true)`
- `lua/coplogics/coplogicarrest.lua:245` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, CopLogicArrest.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/coplogicarrest.lua:312` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_task_key, CopLogicArrest.queued_update, data, data.t + delay, data.important)`
- `lua/coplogics/coplogicattack.lua:117` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.update_queue_id, data.logic.queued_update, data, data.t + (data.important and 0 or 0.2), true)`
- `lua/coplogics/coplogicattack.lua:188` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicAttack._upd_enemy_detection, data, delay and data.t + delay, data.important and true)`
- `lua/coplogics/coplogicattack.lua:1116` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = managers.navigation._nav_segments`
- `lua/coplogics/coplogicattack.lua:1123` `find_segment_doors` — Returns position vectors, not door tables. `local doors = managers.navigation:find_segment_doors(enemy_nav_seg)`
- `lua/coplogics/coplogicattack.lua:1354` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/coplogics/coplogicattack.lua:1410` `find_segment_doors` — Returns position vectors, not door tables. `local found_doors = managers.navigation:find_segment_doors(from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", to_nav_seg), true)`
- `lua/coplogics/coplogicattack.lua:1414` `find_segment_doors` — Returns position vectors, not door tables. `found_doors = managers.navigation:find_segment_doors(from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", enemy_seg), true)`
- `lua/coplogics/coplogicattack.lua:2883` `_quad_field` — New engine surface; verify method/arg shapes. `found_cover = managers.navigation._quad_field:find_cover(search_params)`
- `lua/coplogics/coplogicbase.lua:263` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = managers.navigation._nav_segments`
- `lua/coplogics/coplogicbase.lua:417` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `function CopLogicBase.queue_task(internal_data, id, func, data, exec_t, asap)`
- `lua/coplogics/coplogicbase.lua:448` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `managers.enemy:queue_task(id, func, data, exec_t, callback(CopLogicBase, CopLogicBase, "on_queued_task", internal_data), asap)`
- `lua/coplogics/coplogicidle.lua:76` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicIdle.queued_update, data, data.t, data.important and true)`
- `lua/coplogics/coplogicidle.lua:93` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.wall_stare_task_key, CopLogicIdle._chk_stare_into_wall_1, data, data.t)`
- `lua/coplogics/coplogicidle.lua:184` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicIdle.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogicidle.lua:275` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicIdle.queued_update, data, data.t + delay, data.important and true)`
- `lua/coplogics/coplogicidle.lua:1924` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.wall_stare_task_key, CopLogicIdle._chk_stare_into_wall_1, data, data.t)`
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
- `lua/coplogics/coplogictravel.lua:2017` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.upd_task_key, CopLogicTravel.queued_update, data, data.t + delay, data.important and true)`
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
- `lua/groupaistate/groupaistatebesiege.lua:684` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local nav_segments = managers.navigation._nav_segments`
- `lua/groupaistate/groupaistatebesiege.lua:986` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(params)`
- `lua/groupaistate/groupaistatebesiege.lua:1156` `_police_upd_task_queued` — Boolean -> timestamp in 247. `if self._police_upd_task_queued then`
- `lua/groupaistate/groupaistatebesiege.lua:1157` `_police_upd_task_queued` — Boolean -> timestamp in 247. `if self._t < self._police_upd_task_queued then`
- `lua/groupaistate/groupaistatebesiege.lua:1170` `_police_upd_task_queued` — Boolean -> timestamp in 247. `self._police_upd_task_queued = self._t + next_upd_t`
- `lua/groupaistate/groupaistatebesiege.lua:1183` `_police_upd_task_queued` — Boolean -> timestamp in 247. `if self._police_upd_task_queued then`
- `lua/groupaistate/groupaistatebesiege.lua:1184` `_police_upd_task_queued` — Boolean -> timestamp in 247. `self._police_upd_task_queued = self._t + 0.1`
- `lua/groupaistate/groupaistatebesiege.lua:1362` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:1397` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2362` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2406` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2460` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2516` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2579` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:2988` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3072` `search_coarse` — Start/end validation added at 247. `push_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3105` `search_coarse` — Start/end validation added at 247. `push_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3302` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3396` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3400` `search_coarse` — Start/end validation added at 247. `coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3421` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3425` `search_coarse` — Start/end validation added at 247. `coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3731` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:3841` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = nav_manager._nav_segments`
- `lua/groupaistate/groupaistatebesiege.lua:4006` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = nav_manager._nav_segments`
- `lua/groupaistate/groupaistatebesiege.lua:4247` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:4275` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/groupaistate/groupaistatebesiege.lua:4338` `search_coarse` — Start/end validation added at 247. `local path = managers.navigation:search_coarse(coarse_params)`
- `lua/managers/mapelements/elementspecialobjective.lua:373` `search_coarse` — Start/end validation added at 247. `local coarse_path = managers.navigation:search_coarse(search_params)`
- `lua/managers/navigationmanager.lua:35` `find_segment_doors` — Returns position vectors, not door tables. `function NavigationManager:find_segment_doors(from_seg_id, approve_clbk, center_only)`
- `lua/managers/navigationmanager.lua:36` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:58` `_quad_field` — New engine surface; verify method/arg shapes. `local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)`
- `lua/managers/navigationmanager.lua:84` `_quad_field` — New engine surface; verify method/arg shapes. `local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)`
- `lua/managers/navigationmanager.lua:106` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local from_seg = self._nav_segments[from_seg_id]`
- `lua/managers/navigationmanager.lua:115` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local neighbour = self._nav_segments[neighbour_id]`
- `lua/managers/navigationmanager.lua:135` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:159` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:165` `find_segment_doors` — Returns position vectors, not door tables. `local doors = door_list or self:find_segment_doors(m_seg_id, nil, true)`
- `lua/managers/navigationmanager.lua:332` `_quad_field` — New engine surface; verify method/arg shapes. `elseif tracker:obstructed() or not self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) then`
- `lua/managers/navigationmanager.lua:366` `_quad_field` — New engine surface; verify method/arg shapes. `local nav_tracker = self._quad_field:create_nav_tracker(pos, true)`
- `lua/managers/navigationmanager.lua:374` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local room_nav_seg = self._nav_segments[seg_id]`
- `lua/managers/navigationmanager.lua:384` `find_segment_doors` — Returns position vectors, not door tables. `doors = self:find_segment_doors(seg_id, nil, true)`
- `lua/managers/navigationmanager.lua:388` `_quad_field` — New engine surface; verify method/arg shapes. `local navseg_tracker = self._quad_field:create_nav_tracker(room_nav_seg.pos, true)`
- `lua/managers/navigationmanager.lua:404` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(navseg_tracker, true)`
- `lua/managers/navigationmanager.lua:439` `_quad_field` — New engine surface; verify method/arg shapes. `local nav_tracker = self._quad_field:create_nav_tracker(pos, true)`
- `lua/managers/navigationmanager.lua:448` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(nav_tracker)`
- `lua/managers/navigationmanager.lua:567` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local first_key = next(self._nav_segments)`
- `lua/managers/navigationmanager.lua:576` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `for seg_id, seg in pairs(self._nav_segments) do`
- `lua/managers/navigationmanager.lua:594` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `total_limit = math.min(LIES_COVER_GEN_PER_SEGMENT * table.size(self._nav_segments), LIES_COVER_GEN_TOTAL_CAP),`
- `lua/managers/navigationmanager.lua:668` `_quad_field` — New engine surface; verify method/arg shapes. `local ok, pos = pcall(self._quad_field.random_position_in_nav_segment, self._quad_field, arg)`
- `lua/managers/navigationmanager.lua:774` `_quad_field` — New engine surface; verify method/arg shapes. `local tracker = self._quad_field:create_nav_tracker(candidate, true)`
- `lua/managers/navigationmanager.lua:864` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local seg = self._nav_segments[seg_id]`
- `lua/managers/navigationmanager.lua:870` `_quad_field` — New engine surface; verify method/arg shapes. `local seg_tracker = self._quad_field:create_nav_tracker(seg.pos, true)`
- `lua/managers/navigationmanager.lua:882` `_quad_field` — New engine surface; verify method/arg shapes. `local location_script_data = self._quad_field:get_script_data(seg_tracker, true)`
- `lua/managers/navigationmanager.lua:908` `find_segment_doors` — Returns position vectors, not door tables. `doors = self:find_segment_doors(seg_id, nil, true)`
- `lua/managers/navigationmanager.lua:1233` `search_pos_to_pos` — Delegates to _quad_field:detailed_search(params). `function NavigationManager:search_pos_to_pos(params)`
- `lua/managers/navigationmanager.lua:1316` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:detailed_search(params)`
- `lua/managers/navigationmanager.lua:1428` `_quad_field` — New engine surface; verify method/arg shapes. `local id = self._quad_field:add_obstacle(obstacle_obj)`
- `lua/managers/navigationmanager.lua:1452` `_quad_field` — New engine surface; verify method/arg shapes. `local nav_link = self._quad_field:add_nav_link(element:value("position"), element:nav_link_end_pos(), {`
- `lua/managers/navigationmanager.lua:1461` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local start_nav_seg = self._nav_segments[start_nav_seg_id]`
- `lua/managers/navigationmanager.lua:1463` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if not start_nav_seg or not self._nav_segments[end_nav_seg_id] then`
- `lua/managers/navigationmanager.lua:1514` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:remove_obstacle(obs_data.id)`
- `lua/managers/navigationmanager.lua:1520` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:remove_obstacle(obs_data.id)`
- `lua/managers/navigationmanager.lua:1586` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if not self._nav_segments[unique_id] then`
- `lua/managers/navigationmanager.lua:1596` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:set_nav_segment_blocked_filter(unique_id, access_filter)`
- `lua/managers/navigationmanager.lua:1598` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[unique_id].blocked_group = filter_group`
- `lua/managers/navigationmanager.lua:1600` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `if self._nav_segments[unique_id].blocked_group and self._cached_paths and #self._cached_paths > 0 then`
- `lua/managers/navigationmanager.lua:1633` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:set_nav_segment_blocked_filter(unique_id, 0)`
- `lua/managers/navigationmanager.lua:1635` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[unique_id].blocked_group = nil`
- `lua/managers/navigationmanager.lua:1637` `_quad_field` — New engine surface; verify method/arg shapes. `local cur_state = self._quad_field:is_nav_segment_enabled(unique_id)`
- `lua/managers/navigationmanager.lua:1644` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `self._nav_segments[unique_id].disabled = seg_disabled_state`
- `lua/managers/navigationmanager.lua:1647` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:set_nav_segment_enabled(unique_id, wanted_state)`
- `lua/managers/navigationmanager.lua:1771` `_quad_field` — New engine surface; verify method/arg shapes. `if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then`
- `lua/managers/navigationmanager.lua:1789` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then`
- `lua/managers/navigationmanager.lua:1866` `_quad_field` — New engine surface; verify method/arg shapes. `if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then`
- `lua/managers/navigationmanager.lua:1888` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then`
- `lua/managers/navigationmanager.lua:1965` `_quad_field` — New engine surface; verify method/arg shapes. `if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then`
- `lua/managers/navigationmanager.lua:1990` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then`
- `lua/managers/navigationmanager.lua:2029` `_quad_field` — New engine surface; verify method/arg shapes. `local position_tracker = self._quad_field:create_nav_tracker(position)`
- `lua/managers/navigationmanager.lua:2033` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:destroy_nav_tracker(position_tracker)`
- `lua/managers/navigationmanager.lua:2084` `_quad_field` — New engine surface; verify method/arg shapes. `local position_tracker = self._quad_field:create_nav_tracker(altered_pos, true)`
- `lua/managers/navigationmanager.lua:2090` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:destroy_nav_tracker(position_tracker)`
- `lua/managers/navigationmanager.lua:2157` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_nav_segments = self._nav_segments`
- `lua/managers/navigationmanager.lua:2220` `_quad_field` — New engine surface; verify method/arg shapes. `if self._quad_field:is_nav_segment_blocked(i_seg, search_data.access_pos) then`
- `lua/managers/navigationmanager.lua:2251` `_nav_segments` — Keyed by tostring(id); neighbours are door vectors. `local all_segs = self._nav_segments`
- `lua/managers/navigationmanager.lua:2303` `_quad_field` — New engine surface; verify method/arg shapes. `local from_tracker = self._quad_field:create_nav_tracker(pos)`
- `lua/managers/navigationmanager.lua:2356` `_quad_field` — New engine surface; verify method/arg shapes. `self._quad_field:destroy_nav_tracker(from_tracker)`
- `lua/teamailogics/teamailogicassault.lua:28` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicAssault._upd_enemy_detection, data, data.t)`
- `lua/teamailogics/teamailogicassault.lua:334` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicAssault._upd_enemy_detection, data, data.t + delay)`
- `lua/teamailogics/teamailogicidle.lua:404` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.wall_stare_task_key, CopLogicIdle._chk_stare_into_wall_1, data, data.t)`
- `lua/teamailogics/teamailogicidle.lua:533` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicIdle._upd_enemy_detection, data, data.t + delay)`
- `lua/teamailogics/teamailogictravel.lua:33` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicTravel._upd_enemy_detection, data, data.t)`
- `lua/teamailogics/teamailogictravel.lua:202` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, key, TeamAILogicTravel._remove_enemy_attention, {`
- `lua/teamailogics/teamailogictravel.lua:214` `queue_task` — No longer executes inline; check EnemyManager/CopLogicBase assumptions. `CopLogicBase.queue_task(my_data, my_data.detection_task_key, TeamAILogicTravel._upd_enemy_detection, data, data.t + delay)`


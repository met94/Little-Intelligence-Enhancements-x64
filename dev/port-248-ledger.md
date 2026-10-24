# LIES 248.2 port — function ledger

Generated: 2026-10-24T08:16:57.757Z
Old baseline: `a3180fc`  Target: `e3a8b616`

Status is the proposed action. `PORT` = port LIES intent onto 248.2; `audit` = LIES-only, check API calls; `delete` = stale 246.1 copy; `keep` = no port work; `drop/rewrite` = target function gone; `BLOCKED` = parse failure.

Scope: top-level function definitions only. Nested helpers are folded into their parent function body and are ported with it.

## Totals

| category | count |
|---|---:|
| LIES_EDIT_VANILLA_CHANGED | 24 |
| MOD_ONLY_HOOK | 43 |
| MOD_ONLY | 189 |
| VANISHED_IN_NEW | 1 |
| SAME_AS_OLD_VANILLA | 2 |
| SAME_AS_OLD_VANILLA_LOCAL | 1 |
| LIES_EDIT_CLEAN | 288 |

## menumanager.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `LIES._optimize_path` | 37 | 0 | 0 |  |
| [ ] | audit | `LIES._path_is_straight_line` | 25 | 0 | 0 |  |
| [ ] | audit | `LIES.check_for_updates` | 5 | 0 | 0 |  |
| [ ] | audit | `LIES.find_cover_away_from_pos` | 5 | 0 | 0 |  |
| [ ] | audit | `LIES.find_cover_from_threat` | 5 | 0 | 0 |  |
| [ ] | audit | `LIES.find_cover_in_cone_from_threat_pos_1` | 5 | 0 | 0 |  |
| [ ] | audit | `LIES.find_cover_in_nav_seg_3` | 5 | 0 | 0 |  |
| [ ] | audit | `LIES.find_cover_near_pos_1` | 5 | 0 | 0 |  |
| [ ] | audit | `LIES.Load` | 11 | 0 | 0 |  |
| [ ] | audit | `LIES.Save` | 8 | 0 | 0 |  |
| [ ] | audit | `LIES.set_update_data` | 15 | 0 | 0 |  |
| [ ] | audit | `LIES.tprint` | 38 | 0 | 0 |  |
| [ ] | audit | `LIES.UseLuaCover` | 3 | 0 | 0 |  |

## menunodegui.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:MenuNodeGui._setup_item_rows:LIES_update` | 13 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/tweak_data/attentiontweakdata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:AttentionTweakData.init:lies_fix_badaimobjs` | 87 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `AttentionTweakData.setup_hhtacs` | 117 | 0 | 0 |  |

## lua/tweak_data/weapontweakdata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `WeaponTweakData.setup_hhtacs` | 22 | 0 | 0 |  |

## lua/tweak_data/charactertweakdata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:CharacterTweakData.init:lies_fix_nosup` | 26 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `CharacterTweakData._setup_extra_chatter_tweak` | 72 | 0 | 0 |  |
| [ ] | audit | `CharacterTweakData.fix_escort` | 11 | 0 | 0 |  |
| [ ] | audit | `CharacterTweakData.setup_hhtacs` | 340 | 0 | 0 |  |
| [ ] | keep | `CharacterTweakData._init_region_america` | 12 | 11 | 11 |  |

## lua/tweak_data/levelstweakdata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:LevelsTweakData.init:lies_fixed_ai_obj` | 4 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `LevelsTweakData.setup_hhtacs` | 3 | 0 | 0 |  |

## lua/tweak_data/groupaitweakdata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:GroupAITweakData._init_chatter_data:lies_chatter` | 367 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `GroupAITweakData._LIES_setup` | 4313 | 0 | 0 |  |
| [ ] | audit | `GroupAITweakData._setup_hhtacs_bo_compatibility` | 41 | 0 | 0 |  |
| [ ] | audit | `GroupAITweakData._setup_hhtacs_cartel_compatibility` | 310 | 0 | 0 |  |
| [ ] | audit | `GroupAITweakData._setup_hhtacs_task_data` | 172 | 0 | 0 |  |

## lua/tweak_data/skirmishtweakdata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `SkirmishTweakData.setup_hhtacs` | 68 | 0 | 0 |  |

## lua/managers/enemymanager.lua

No function definitions (hook/overlay file).

## lua/managers/navigationmanager.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `NavigationManager._draw_covers` | 34 | 27 | 38 |  |
| [ ] | **PORT** | `NavigationManager._execute_coarce_search` | 110 | 103 | 95 |  |
| [ ] | **PORT** | `NavigationManager._sort_nav_segs_after_pos` | 51 | 89 | 47 |  |
| [ ] | **PORT** | `NavigationManager.add_obstacle` | 57 | 20 | 25 |  |
| [ ] | **PORT** | `NavigationManager.find_segment_doors` | 68 | 18 | 17 |  |
| [ ] | **PORT** | `NavigationManager.register_cover_units` | 132 | 80 | 75 |  |
| [ ] | **PORT** | `NavigationManager.remove_obstacle` | 46 | 15 | 46 |  |
| [ ] | **PORT** | `NavigationManager.set_nav_segment_state` | 93 | 36 | 38 |  |
| [ ] | audit (hook) | `Hooks.PostHook:NavigationManager._clear:LIES_nav_gen_abort_clear` | 3 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:NavigationManager._unregister_cover_units:LIES_nav_gen_abort_unregister` | 3 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:NavigationManager.update:lies_cover` | 8 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `_lies_cover_grid_add` | 12 | 0 | 0 |  |
| [ ] | audit | `_lies_cover_mode` | 9 | 0 | 0 |  |
| [ ] | audit | `_lies_cover_too_close` | 22 | 0 | 0 |  |
| [ ] | audit | `_lies_grid_key` | 3 | 0 | 0 |  |
| [ ] | audit | `convert_bastards` | 7 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._add_LIES_cached_path` | 7 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._change_funcs` | 21 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._check_LIES_invalidated_navlink_cached_paths` | 25 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._do_nav_fixes` | 21 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._draw_coarse_graph_areas` | 24 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_abort` | 6 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_collect_candidates` | 84 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_cover_total` | 3 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_log` | 44 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_process_segment` | 75 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_remove_pending` | 11 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_sample_position` | 39 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_start` | 29 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_state_new` | 79 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_step` | 55 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._LIES_cover_gen_try_candidate` | 91 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._schedule_LIES_cover_generation` | 11 | 0 | 0 |  |
| [ ] | audit | `NavigationManager._update_LIES_cached_paths` | 19 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.check_cover_close_to_wall` | 36 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.clamp_position_to_field` | 13 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.draw_coarse_path` | 27 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.find_cover_from_threat_LUA` | 96 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.find_cover_in_cone_from_threat_pos_1_LUA` | 94 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.find_cover_in_nav_seg_3_LUA` | 104 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.find_walls_across_pos` | 58 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.generate_cover_fwd` | 157 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.insert_cover` | 8 | 0 | 0 |  |
| [ ] | audit | `NavigationManager.pad_out_position` | 61 | 0 | 0 |  |
| [ ] | drop/rewrite | `NavigationManager.get_nav_segments_in_direction` | 24 | 55 | 0 | function exists in 246.1 but not in 248.2; drop or re-home |
| [ ] | keep | `NavigationManager.draw_path` | 59 | 36 | 36 |  |
| [ ] | keep | `NavigationManager.register_anim_nav_link` | 51 | 45 | 45 |  |
| [ ] | keep | `NavigationManager.search_pos_to_pos` | 85 | 7 | 7 |  |

## lua/characters/characterattentionobject.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CharacterAttentionObject._chk_update_registered_state` | 3 | 0 | 0 |  |
| [ ] | audit | `CharacterAttentionObject._register` | 16 | 0 | 0 |  |
| [ ] | audit | `CharacterAttentionObject.on_enemy_weapons_hot` | 3 | 0 | 0 |  |

## lua/props/securitycamera.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `SecurityCamera._detect_criminals_loud` | 89 | 0 | 0 |  |
| [ ] | keep | `SecurityCamera._detection_angle_and_dis_chk` | 31 | 26 | 26 |  |
| [ ] | keep | `SecurityCamera._upd_detect_attention_objects` | 160 | 133 | 133 |  |
| [ ] | keep | `SecurityCamera._upd_suspicion` | 124 | 97 | 97 |  |
| [ ] | keep | `SecurityCamera.set_detection_enabled` | 60 | 65 | 65 |  |

## lua/props/carrydata.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `CarryData._chk_register_steal_SO` | 136 | 126 | 118 |  |

## lua/props/drill.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:Drill._unregister_sabotage_SO:lies_unregisterdrill` | 3 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:Drill.clbk_sabotage_SO_verification:lies_tacs_drill` | 15 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:Drill.on_sabotage_SO_completed:lies_drilljammedvoiceline` | 9 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | keep | `Drill._register_sabotage_SO` | 76 | 82 | 82 |  |

## lua/groupaistate/groupaimanager.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PreHook:GroupAIManager.set_state:lies_groupsetup` | 7 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/managers/mapelements/missionscriptelement.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:MissionScriptElement.on_executed:lies_nav_and_modify` | 36 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/managers/mapelements/elementenemyprefered.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `ElementEnemyPreferedRemove.on_executed` | 25 | 15 | 15 |  |

## lua/managers/mapelements/elementspawnenemydummy.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:ElementSpawnEnemyDummy._finalize_values:lies_hhtacs_elementcheck` | 48 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `ElementSpawnEnemyDummy.check_overwrite_spawn_value` | 21 | 0 | 0 |  |
| [ ] | audit | `ElementSpawnEnemyDummy.value` | 19 | 0 | 0 |  |

## lua/managers/mapelements/elementspawncivilian.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:ElementSpawnCivilian._finalize_values:lies_finalize_values` | 11 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | keep | `ElementSpawnCivilian.produce` | 46 | 47 | 47 |  |

## lua/managers/mapelements/elementspawnciviliangroup.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:ElementSpawnCivilianGroup._finalize_values:lies_finalize_values` | 11 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/managers/mapelements/elementdifficulty.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:ElementDifficulty.init:lies_alter_diff_values` | 26 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/managers/mapelements/elementspawnenemygroup.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:ElementSpawnEnemyGroup._finalize_values:lies_finalize_values` | 51 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | keep | `ElementSpawnEnemyGroup.on_executed` | 43 | 35 | 35 |  |

## lua/managers/mapelements/elementspecialobjective.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:ElementSpecialObjective._finalize_values:lies_send_navlink_element` | 85 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | keep | `ElementSpecialObjective.clbk_verify_administration` | 65 | 20 | 20 |  |
| [ ] | keep | `ElementSpecialObjective.nav_link_delay` | 9 | 3 | 3 |  |

## lua/managers/mapelements/elementspecialobjectivegroup.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `ElementSpecialObjectiveGroup.choose_followup_SO` | 21 | 15 | 15 |  |

## lua/managers/mapelements/elementaiglobalevent.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `ElementAiGlobalEvent.on_executed` | 48 | 39 | 39 |  |

## lua/groupaistate/groupaistatebase.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBase._clbk_switch_enemies_to_not_cool:lies_switch_tweaks_for_guards` | 11 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBase._remove_group_member:lies_frienddead` | 23 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBase.on_enemy_unregistered:lies_unregister_boss` | 9 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBase.register_rescueable_hostage:lies_hrt_reg` | 9 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBase.unregister_rescueable_hostage:lies_hrt_unreg` | 5 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `GroupAIStateBase._add_drama_hhtacs` | 3 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase._calculate_difficulty_ratio_hhtacs` | 17 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase._get_balancing_multiplier_hhtacs` | 22 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.on_unit_pathing_complete` | 7 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.on_unit_pathing_failed` | 7 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.print_objective` | 135 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.register_active_drill` | 5 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.register_boss` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.rescueable_hostages` | 3 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.unregister_active_drill` | 4 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBase.unregister_boss` | 5 | 0 | 0 |  |
| [ ] | keep | `GroupAIStateBase._determine_objective_for_criminal_AI` | 93 | 63 | 63 |  |
| [ ] | keep | `GroupAIStateBase._get_group_acces_mask` | 14 | 12 | 12 |  |
| [ ] | keep | `GroupAIStateBase._get_spawn_unit_name` | 58 | 65 | 65 |  |
| [ ] | keep | `GroupAIStateBase._set_rescue_state` | 3 | 15 | 15 |  |
| [ ] | keep | `GroupAIStateBase.on_criminal_nav_seg_change` | 41 | 48 | 48 |  |
| [ ] | keep | `GroupAIStateBase.on_nav_link_unregistered` | 16 | 14 | 14 |  |
| [ ] | keep | `GroupAIStateBase.on_objective_failed` | 86 | 51 | 51 |  |
| [ ] | keep | `GroupAIStateBase.register_criminal` | 63 | 53 | 53 |  |
| [ ] | keep | `GroupAIStateBase.register_security_camera` | 15 | 3 | 3 |  |
| [ ] | keep | `GroupAIStateBase.report_aggression` | 11 | 9 | 9 |  |
| [ ] | keep | `GroupAIStateBase.set_importance_weight` | 78 | 67 | 67 |  |
| [ ] | keep | `GroupAIStateBase.unregister_AI_attention_object` | 23 | 5 | 5 |  |

## lua/groupaistate/groupaistatebesiege.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `GroupAIStateBesiege._chk_group_use_flash_grenade` | 145 | 45 | 45 |  |
| [ ] | **PORT** | `GroupAIStateBesiege._chk_group_use_smoke_grenade` | 179 | 47 | 47 |  |
| [ ] | **PORT** | `GroupAIStateBesiege._queue_police_upd_task` | 17 | 7 | 13 |  |
| [ ] | **PORT** | `GroupAIStateBesiege._upd_police_activity` | 48 | 28 | 22 |  |
| [ ] | **PORT** | `GroupAIStateBesiege.force_end_assault_phase` | 18 | 18 | 20 |  |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBase.sync_event:lies_check_phalanx_sync` | 5 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBesiege._upd_assault_task:lies_retire` | 101 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBesiege.init:lies_spawngroups` | 132 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:GroupAIStateBesiege.update:lies_check_phalanx_binding` | 13 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `GroupAIStateBesiege._assign_enemy_group_to_assault` | 44 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._assign_enemy_group_to_recon` | 44 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._assign_enemy_group_to_reenforce` | 46 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._check_phalanx_damage_reduction_increase_LIES` | 126 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._check_spawn_phalanx_LIES` | 51 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._chk_crimin_proximity_to_unit` | 22 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._chk_group_area_presence` | 22 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._chk_group_engaging_area` | 44 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._chk_group_use_gas_grenade` | 65 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._get_group_area` | 20 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._get_group_forwardmost_coarse_path_index_from_unit` | 39 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._get_group_forwardmost_unit` | 17 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._on_player_slow_pos_rsrv_upd` | 38 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._register_escort` | 11 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._set_objective_to_phalanx_group_LIES` | 44 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._spawn_phalanx_LIES` | 68 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._unregister_escort` | 4 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._upd_group` | 40 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._update_criminal_reveal` | 24 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_block_escort_start` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_charge_start` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_flank_start` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_follow_me` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_gatherloot` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_getcivs` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_movedin_civs` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege._voice_retreat` | 10 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege.check_follow_objectives_ready` | 22 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege.phalanx_damage_reduction_disable_LIES` | 8 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege.request_group_upd` | 12 | 0 | 0 |  |
| [ ] | audit | `GroupAIStateBesiege.start_extend_assault` | 33 | 0 | 0 |  |
| [ ] | keep (local helper) | `spawn_group_id` | 3 | 3 | 3 | local helper; keep even if identical to vanilla |
| [ ] | keep | `GroupAIStateBesiege._assign_assault_groups_to_retire` | 49 | 31 | 31 |  |
| [ ] | keep | `GroupAIStateBesiege._assign_enemy_groups_to_assault` | 40 | 33 | 33 |  |
| [ ] | keep | `GroupAIStateBesiege._assign_enemy_groups_to_recon` | 45 | 38 | 38 |  |
| [ ] | keep | `GroupAIStateBesiege._assign_group_to_retire` | 100 | 51 | 51 |  |
| [ ] | keep | `GroupAIStateBesiege._choose_best_group` | 28 | 29 | 29 |  |
| [ ] | keep | `GroupAIStateBesiege._create_objective_from_group_objective` | 88 | 77 | 77 |  |
| [ ] | keep | `GroupAIStateBesiege._determine_group_leader` | 15 | 13 | 13 |  |
| [ ] | keep | `GroupAIStateBesiege._draw_enemy_activity` | 341 | 287 | 287 |  |
| [ ] | keep | `GroupAIStateBesiege._find_spawn_group_near_area` | 130 | 123 | 123 |  |
| [ ] | keep | `GroupAIStateBesiege._perform_group_spawning` | 153 | 145 | 145 |  |
| [ ] | keep | `GroupAIStateBesiege._set_assault_objective_to_group` | 1424 | 351 | 351 |  |
| [ ] | keep | `GroupAIStateBesiege._set_recon_objective_to_group` | 191 | 176 | 176 |  |
| [ ] | keep | `GroupAIStateBesiege._set_reenforce_objective_to_group` | 93 | 83 | 83 |  |
| [ ] | keep | `GroupAIStateBesiege._upd_hostage_task` | 29 | 15 | 15 |  |
| [ ] | keep | `GroupAIStateBesiege._upd_regroup_task` | 11 | 11 | 11 |  |
| [ ] | keep | `GroupAIStateBesiege._verify_group_objective` | 70 | 67 | 67 |  |
| [ ] | keep | `GroupAIStateBesiege._voice_deathguard_start` | 12 | 9 | 9 |  |
| [ ] | keep | `GroupAIStateBesiege._voice_move_complete` | 10 | 7 | 7 |  |
| [ ] | keep | `GroupAIStateBesiege._voice_move_in_start` | 10 | 7 | 7 |  |
| [ ] | keep | `GroupAIStateBesiege._voice_open_fire_start` | 10 | 7 | 7 |  |
| [ ] | keep | `GroupAIStateBesiege.add_to_surrendered` | 16 | 12 | 12 |  |
| [ ] | keep | `GroupAIStateBesiege.assign_enemy_to_group_ai` | 37 | 36 | 36 |  |
| [ ] | keep | `GroupAIStateBesiege.force_spawn_group` | 29 | 27 | 27 |  |
| [ ] | keep | `GroupAIStateBesiege.is_detection_persistent` | 3 | 3 | 3 |  |
| [ ] | keep | `GroupAIStateBesiege.on_defend_travel_end` | 30 | 13 | 13 |  |
| [ ] | keep | `GroupAIStateBesiege.on_objective_complete` | 130 | 88 | 88 |  |
| [ ] | keep | `GroupAIStateBesiege.remove_from_surrendered` | 12 | 18 | 18 |  |
| [ ] | keep | `make_dis_id` | 6 | 5 | 5 |  |

## lua/copextensions/copdamage.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `CopDamage.damage_explosion` | 33 | 162 | 162 |  |

## lua/copextensions/tankcopdamage.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:TankCopDamage.seq_clbk_vizor_shatter:lies_tankvisorbroken` | 15 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/copextensions/copbase.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CopBase.change_and_sync_char_tweak` | 25 | 0 | 0 |  |
| [ ] | audit | `CopBase.change_buff_by_id` | 19 | 0 | 0 |  |
| [ ] | keep | `CopBase._refresh_buff_total` | 36 | 14 | 14 |  |
| [ ] | keep | `CopBase.default_weapon_name` | 232 | 28 | 28 |  |

## lua/copextensions/copmovement.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:CopMovement._upd_actions:lies_actions` | 15 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `CopMovement.force_upd_z_ray` | 7 | 0 | 0 |  |

## lua/copextensions/copbrain.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain._add_pathing_result:lies_pathing` | 46 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain._reset_logic_data:lies_reset_logic_data` | 25 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain.clbk_death:lies_clbk_death` | 3 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain.clbk_death:lies_remove_sabo_outline` | 6 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain.convert_to_criminal:lies_convert_to_criminal` | 26 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain.on_reload:lies_on_reload` | 48 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain.set_group:lies_reset_weapons` | 115 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit (hook) | `Hooks.PostHook:CopBrain.set_spawn_entry:lies_accessentry` | 15 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `CopBrain._do_hhtacs_damage_modifiers` | 152 | 0 | 0 |  |
| [ ] | audit | `CopBrain._on_player_slow_pos_rsrv_upd` | 9 | 0 | 0 |  |
| [ ] | audit | `CopBrain.check_upd_aim` | 39 | 0 | 0 |  |
| [ ] | audit | `CopBrain.clbk_group_member_attention_verified` | 11 | 0 | 0 |  |
| [ ] | audit | `CopBrain.get_movement_delay` | 15 | 0 | 0 |  |
| [ ] | audit | `CopBrain.is_criminal` | 5 | 0 | 0 |  |
| [ ] | audit | `CopBrain.objective_is_sabotage` | 91 | 0 | 0 |  |
| [ ] | audit | `CopBrain.request_stillness` | 3 | 0 | 0 |  |
| [ ] | audit | `CopBrain.request_switch_to_normal_weapon` | 21 | 0 | 0 |  |
| [ ] | audit | `CopBrain.request_switch_to_safe_weapon` | 51 | 0 | 0 |  |
| [ ] | audit | `CopBrain.search_for_coarse_immediate` | 15 | 0 | 0 |  |
| [ ] | audit | `CopBrain.search_for_coarse_path_to_pos` | 20 | 0 | 0 |  |
| [ ] | audit | `CopBrain.upd_falloff_sim` | 7 | 0 | 0 |  |
| [ ] | keep | `CopBrain._chk_use_cover_grenade` | 25 | 40 | 40 |  |
| [ ] | keep | `CopBrain.action_complete_clbk` | 23 | 3 | 3 |  |
| [ ] | keep | `CopBrain.add_pos_rsrv` | 23 | 19 | 19 |  |
| [ ] | keep | `CopBrain.clbk_pathing_results` | 54 | 41 | 41 |  |
| [ ] | keep | `CopBrain.on_suppressed` | 11 | 13 | 13 |  |
| [ ] | keep | `CopBrain.on_team_set` | 10 | 5 | 5 |  |
| [ ] | keep | `CopBrain.post_init` | 53 | 46 | 46 |  |
| [ ] | keep | `CopBrain.search_for_path` | 23 | 18 | 18 |  |
| [ ] | keep | `CopBrain.search_for_path_from_pos` | 22 | 18 | 18 |  |
| [ ] | keep | `CopBrain.search_for_path_to_cover` | 27 | 16 | 16 |  |
| [ ] | keep | `CopBrain.set_objective` | 141 | 13 | 13 |  |
| [ ] | keep | `CopBrain.set_pos_rsrv` | 23 | 19 | 19 |  |
| [ ] | keep | `CopBrain.set_spawn_ai` | 37 | 17 | 17 |  |
| [ ] | keep | `CopBrain.update` | 31 | 12 | 12 |  |

## lua/copextensions/copsound.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:CopSound.init:lies_init` | 15 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |
| [ ] | audit | `CopSound._play_fixed` | 17 | 0 | 0 |  |
| [ ] | audit | `CopSound._play_vc_framework_voice` | 15 | 0 | 0 |  |
| [ ] | audit | `CopSound.say_fix` | 168 | 0 | 0 |  |
| [ ] | audit | `CopSound.speaking_fix` | 3 | 0 | 0 |  |
| [ ] | audit | `CopSound.stop_speaking_clbk` | 8 | 0 | 0 |  |

## lua/copactions/copactionshoot.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `CopActionShoot.on_exit` | 36 | 30 | 30 |  |

## lua/copactions/copactionwalk.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CopActionWalk.enforce_gravity_on_path` | 43 | 0 | 0 |  |
| [ ] | audit | `CopActionWalk.enforce_gravity_on_simple_path` | 28 | 0 | 0 |  |
| [ ] | keep | `CopActionWalk._apply_padding_to_simplified_path` | 52 | 50 | 50 |  |
| [ ] | keep | `CopActionWalk._calculate_simplified_path` | 53 | 33 | 33 |  |
| [ ] | keep | `CopActionWalk._init` | 168 | 160 | 160 |  |
| [ ] | keep | `CopActionWalk.on_attention` | 27 | 21 | 21 |  |

## lua/coplogics/coplogicintimidated.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | delete | `CopLogicIntimidated._do_tied` | 59 | 60 | 60 | stale 246.1 copy; delete unless intentionally kept |
| [ ] | keep | `CopLogicIntimidated._update_enemy_detection` | 59 | 41 | 41 |  |
| [ ] | keep | `CopLogicIntimidated.enter` | 62 | 55 | 55 |  |
| [ ] | keep | `CopLogicIntimidated.exit` | 56 | 40 | 40 |  |
| [ ] | keep | `CopLogicIntimidated.on_intimidated` | 68 | 54 | 54 |  |
| [ ] | keep | `CopLogicIntimidated.queued_update` | 20 | 11 | 11 |  |
| [ ] | keep | `CopLogicIntimidated.register_rescue_SO` | 63 | 67 | 67 |  |

## lua/coplogics/coplogicbase.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `CopLogicBase._upd_attention_obj_detection` | 512 | 355 | 359 |  |
| [ ] | audit | `CopLogicBase.check_sabotage_objective_not_allowed` | 42 | 0 | 0 |  |
| [ ] | audit | `CopLogicBase.on_attention_obj_verified` | 13 | 0 | 0 |  |
| [ ] | audit | `CopLogicBase.pre_destroy` | 5 | 0 | 0 |  |
| [ ] | audit | `CopLogicBase.upd_falloff_sim` | 94 | 0 | 0 |  |
| [ ] | keep | `CopLogicBase._can_arrest` | 7 | 3 | 3 |  |
| [ ] | keep | `CopLogicBase._chk_call_the_police` | 15 | 17 | 17 |  |
| [ ] | keep | `CopLogicBase._create_detected_attention_object_data` | 75 | 74 | 74 |  |
| [ ] | keep | `CopLogicBase._evaluate_reason_to_surrender` | 171 | 186 | 186 |  |
| [ ] | keep | `CopLogicBase._get_logic_state_from_reaction` | 35 | 23 | 23 |  |
| [ ] | keep | `CopLogicBase._report_detections` | 9 | 9 | 9 |  |
| [ ] | keep | `CopLogicBase._set_attention_obj` | 91 | 67 | 67 |  |
| [ ] | keep | `CopLogicBase._upd_suspicion` | 130 | 89 | 89 |  |
| [ ] | keep | `CopLogicBase.chk_start_action_dodge` | 253 | 179 | 179 |  |
| [ ] | keep | `CopLogicBase.death_clbk` | 17 | 3 | 3 |  |
| [ ] | keep | `CopLogicBase.identify_attention_obj_instant` | 51 | 51 | 51 |  |
| [ ] | keep | `CopLogicBase.is_obstructed` | 129 | 74 | 74 |  |
| [ ] | keep | `CopLogicBase.on_attention_obj_identified` | 3 | 13 | 13 |  |
| [ ] | keep | `CopLogicBase.on_new_objective` | 34 | 35 | 35 |  |
| [ ] | keep | `CopLogicBase.on_objective_unit_damaged` | 16 | 3 | 3 |  |
| [ ] | keep | `CopLogicBase.on_objective_unit_destroyed` | 16 | 12 | 12 |  |
| [ ] | keep | `CopLogicBase.queue_task` | 33 | 21 | 21 |  |
| [ ] | keep | `CopLogicBase.should_duck_on_alert` | 3 | 11 | 11 |  |

## lua/coplogics/coplogictravel.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CopLogicTravel._chk_coarse_objective_reached` | 25 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel._chk_focus_on_undetected_criminal` | 54 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel._chk_report_in` | 11 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel._chk_say_clear` | 33 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel._pathing_complete_clbk` | 9 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel._upd_focus_on_undetected_criminal` | 173 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel._upd_pose` | 39 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel.queue_detection_update` | 7 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel.queued_detection_update` | 10 | 0 | 0 |  |
| [ ] | audit | `CopLogicTravel.update` | 7 | 0 | 0 |  |
| [ ] | keep | `CopLogicTravel._begin_coarse_pathing` | 30 | 19 | 19 |  |
| [ ] | keep | `CopLogicTravel._check_start_path_ahead` | 57 | 26 | 26 |  |
| [ ] | keep | `CopLogicTravel._chk_begin_advance` | 72 | 36 | 36 |  |
| [ ] | keep | `CopLogicTravel._chk_close_to_criminal` | 32 | 21 | 21 |  |
| [ ] | keep | `CopLogicTravel._chk_cover_height` | 10 | 17 | 17 |  |
| [ ] | keep | `CopLogicTravel._chk_request_action_walk_to_advance_pos` | 25 | 31 | 31 |  |
| [ ] | keep | `CopLogicTravel._chk_start_pathing_to_next_nav_point` | 116 | 14 | 14 |  |
| [ ] | keep | `CopLogicTravel._chk_stop_for_follow_unit` | 108 | 25 | 25 |  |
| [ ] | keep | `CopLogicTravel._determine_destination_occupation` | 200 | 186 | 186 |  |
| [ ] | keep | `CopLogicTravel._find_cover` | 47 | 42 | 42 |  |
| [ ] | keep | `CopLogicTravel._get_exact_move_pos` | 138 | 98 | 98 |  |
| [ ] | keep | `CopLogicTravel._get_pos_on_wall` | 73 | 75 | 75 |  |
| [ ] | keep | `CopLogicTravel._on_destination_reached` | 28 | 29 | 29 |  |
| [ ] | keep | `CopLogicTravel._upd_enemy_detection` | 77 | 62 | 62 |  |
| [ ] | keep | `CopLogicTravel._upd_pathing` | 52 | 44 | 44 |  |
| [ ] | keep | `CopLogicTravel._update_cover` | 21 | 28 | 28 |  |
| [ ] | keep | `CopLogicTravel.action_complete_clbk` | 138 | 104 | 104 |  |
| [ ] | keep | `CopLogicTravel.chk_group_ready_to_move` | 81 | 35 | 35 |  |
| [ ] | keep | `CopLogicTravel.enter` | 160 | 150 | 150 |  |
| [ ] | keep | `CopLogicTravel.get_pathing_prio` | 50 | 14 | 14 |  |
| [ ] | keep | `CopLogicTravel.is_available_for_assignment` | 13 | 19 | 19 |  |
| [ ] | keep | `CopLogicTravel.queue_update` | 9 | 5 | 5 |  |
| [ ] | keep | `CopLogicTravel.upd_advance` | 208 | 71 | 71 |  |

## lua/coplogics/coplogicidle.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `CopLogicIdle.damage_clbk` | 62 | 69 | 69 |  |
| [ ] | audit | `CopLogicIdle._check_needs_reload` | 57 | 0 | 0 |  |
| [ ] | audit | `CopLogicIdle._check_should_relocate` | 63 | 0 | 0 |  |
| [ ] | audit | `CopLogicIdle._chk_focus_on_undetected_criminal` | 91 | 0 | 0 |  |
| [ ] | audit | `CopLogicIdle._chk_start_action_move_out_of_the_way` | 32 | 0 | 0 |  |
| [ ] | audit | `CopLogicIdle._move_back_into_field_position` | 28 | 0 | 0 |  |
| [ ] | audit | `CopLogicIdle._on_player_slow_pos_rsrv_upd` | 25 | 0 | 0 |  |
| [ ] | audit | `CopLogicIdle._upd_focus_on_undetected_criminal` | 281 | 0 | 0 |  |
| [ ] | delete | `CopLogicIdle.exit` | 31 | 31 | 31 | stale 246.1 copy; delete unless intentionally kept |
| [ ] | keep | `CopLogicIdle._chk_has_old_action` | 10 | 9 | 9 |  |
| [ ] | keep | `CopLogicIdle._chk_objective_needs_travel` | 25 | 21 | 21 |  |
| [ ] | keep | `CopLogicIdle._chk_reaction_to_attention_object` | 86 | 56 | 56 |  |
| [ ] | keep | `CopLogicIdle._chk_relocate` | 89 | 128 | 128 |  |
| [ ] | keep | `CopLogicIdle._get_all_paths` | 6 | 5 | 5 |  |
| [ ] | keep | `CopLogicIdle._get_priority_attention` | 383 | 199 | 199 |  |
| [ ] | keep | `CopLogicIdle._set_verified_paths` | 4 | 3 | 3 |  |
| [ ] | keep | `CopLogicIdle._upd_enemy_detection` | 48 | 41 | 41 |  |
| [ ] | keep | `CopLogicIdle._upd_pathing` | 29 | 33 | 33 |  |
| [ ] | keep | `CopLogicIdle._upd_scan` | 73 | 70 | 70 |  |
| [ ] | keep | `CopLogicIdle._upd_stance_and_pose` | 58 | 61 | 61 |  |
| [ ] | keep | `CopLogicIdle._upd_stop_old_action` | 35 | 35 | 35 |  |
| [ ] | keep | `CopLogicIdle.action_complete_clbk` | 48 | 33 | 33 |  |
| [ ] | keep | `CopLogicIdle.clbk_action_timeout` | 23 | 21 | 21 |  |
| [ ] | keep | `CopLogicIdle.enter` | 114 | 107 | 107 |  |
| [ ] | keep | `CopLogicIdle.is_available_for_assignment` | 35 | 27 | 27 |  |
| [ ] | keep | `CopLogicIdle.on_alert` | 72 | 56 | 56 |  |
| [ ] | keep | `CopLogicIdle.on_new_objective` | 59 | 45 | 45 |  |
| [ ] | keep | `CopLogicIdle.queued_update` | 109 | 54 | 54 |  |

## lua/coplogics/coplogicarrest.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `CopLogicArrest._call_the_police` | 22 | 20 | 20 |  |
| [ ] | keep | `CopLogicArrest._mark_call_in_event` | 36 | 30 | 30 |  |
| [ ] | keep | `CopLogicArrest._process_pathing_results` | 18 | 18 | 18 |  |
| [ ] | keep | `CopLogicArrest._say_call_the_police` | 23 | 21 | 21 |  |
| [ ] | keep | `CopLogicArrest._upd_advance` | 103 | 87 | 87 |  |
| [ ] | keep | `CopLogicArrest._upd_enemy_detection` | 77 | 89 | 89 |  |
| [ ] | keep | `CopLogicArrest._verify_arrest_targets` | 38 | 38 | 38 |  |
| [ ] | keep | `CopLogicArrest.action_complete_clbk` | 30 | 29 | 29 |  |
| [ ] | keep | `CopLogicArrest.enter` | 49 | 64 | 64 |  |
| [ ] | keep | `CopLogicArrest.queued_update` | 86 | 83 | 83 |  |

## lua/coplogics/coplogicattack.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `CopLogicAttack._upd_aim` | 572 | 195 | 192 |  |
| [ ] | **PORT** | `CopLogicAttack.action_complete_clbk` | 101 | 47 | 47 |  |
| [ ] | **PORT** | `CopLogicAttack.is_available_for_assignment` | 60 | 43 | 43 |  |
| [ ] | audit | `CopLogicAttack._check_needs_reload` | 48 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._chk_enrage` | 97 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._chk_request_action_walk_to_cover_offset_pos` | 70 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._confirm_retreat_position_visless` | 14 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._find_charge_pos` | 38 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._find_friend_pos` | 89 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._get_expected_pos` | 138 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._move_back_into_field_position` | 27 | 0 | 0 |  |
| [ ] | audit | `CopLogicAttack._pathing_complete_clbk` | 21 | 0 | 0 |  |
| [ ] | keep | `CopLogicAttack._can_move` | 3 | 3 | 3 |  |
| [ ] | keep | `CopLogicAttack._chk_covered` | 20 | 23 | 23 |  |
| [ ] | keep | `CopLogicAttack._chk_exit_attack_logic` | 39 | 19 | 19 |  |
| [ ] | keep | `CopLogicAttack._chk_request_action_turn_to_enemy` | 21 | 19 | 19 |  |
| [ ] | keep | `CopLogicAttack._chk_request_action_walk_to_cover` | 72 | 32 | 32 |  |
| [ ] | keep | `CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos` | 26 | 23 | 23 |  |
| [ ] | keep | `CopLogicAttack._chk_start_action_move_back` | 77 | 32 | 32 |  |
| [ ] | keep | `CopLogicAttack._chk_start_action_move_out_of_the_way` | 59 | 21 | 21 |  |
| [ ] | keep | `CopLogicAttack._chk_wants_to_take_cover` | 49 | 15 | 15 |  |
| [ ] | keep | `CopLogicAttack._correct_path_start_pos` | 16 | 8 | 8 |  |
| [ ] | keep | `CopLogicAttack._find_flank_pos` | 38 | 86 | 86 |  |
| [ ] | keep | `CopLogicAttack._find_retreat_position` | 122 | 72 | 72 |  |
| [ ] | keep | `CopLogicAttack._get_cover_offset_pos` | 41 | 33 | 33 |  |
| [ ] | keep | `CopLogicAttack._peek_for_pos_sideways` | 53 | 54 | 54 |  |
| [ ] | keep | `CopLogicAttack._process_pathing_results` | 65 | 48 | 48 |  |
| [ ] | keep | `CopLogicAttack._upd_combat_movement` | 307 | 150 | 150 |  |
| [ ] | keep | `CopLogicAttack._upd_enemy_detection` | 48 | 49 | 49 |  |
| [ ] | keep | `CopLogicAttack._upd_pose` | 38 | 15 | 15 |  |
| [ ] | keep | `CopLogicAttack._upd_stop_old_action` | 24 | 15 | 15 |  |
| [ ] | keep | `CopLogicAttack._update_cover` | 262 | 149 | 149 |  |
| [ ] | keep | `CopLogicAttack._verify_cover` | 15 | 15 | 15 |  |
| [ ] | keep | `CopLogicAttack.action_taken` | 3 | 3 | 3 |  |
| [ ] | keep | `CopLogicAttack.aim_allow_fire` | 37 | 19 | 19 |  |
| [ ] | keep | `CopLogicAttack.chk_should_turn` | 3 | 3 | 3 |  |
| [ ] | keep | `CopLogicAttack.damage_clbk` | 17 | 3 | 3 |  |
| [ ] | keep | `CopLogicAttack.enter` | 81 | 61 | 61 |  |
| [ ] | keep | `CopLogicAttack.queue_update` | 3 | 3 | 3 |  |
| [ ] | keep | `CopLogicAttack.queued_update` | 16 | 11 | 11 |  |
| [ ] | keep | `CopLogicAttack.update` | 89 | 58 | 58 |  |

## lua/coplogics/coplogicsniper.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `CopLogicSniper._chk_crouch_visibility` | 8 | 8 | 8 |  |
| [ ] | keep | `CopLogicSniper._chk_stand_visibility` | 8 | 8 | 8 |  |
| [ ] | keep | `CopLogicSniper._upd_aim` | 32 | 133 | 133 |  |
| [ ] | keep | `CopLogicSniper._upd_enemy_detection` | 48 | 54 | 54 |  |
| [ ] | keep | `CopLogicSniper.action_complete_clbk` | 27 | 18 | 18 |  |
| [ ] | keep | `CopLogicSniper.enter` | 57 | 79 | 79 |  |

## lua/coplogics/coplogicphalanxminion.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `CopLogicPhalanxMinion._calc_pos_on_phalanx_circle` | 17 | 6 | 6 |  |
| [ ] | keep | `CopLogicPhalanxMinion._reposition_phalanx` | 53 | 57 | 57 |  |
| [ ] | keep | `CopLogicPhalanxMinion.calc_initial_phalanx_pos` | 15 | 17 | 17 |  |
| [ ] | keep | `CopLogicPhalanxMinion.enter` | 59 | 65 | 65 |  |
| [ ] | keep | `CopLogicPhalanxMinion.is_available_for_assignment` | 11 | 3 | 3 |  |
| [ ] | keep | `CopLogicPhalanxMinion.queued_update` | 43 | 40 | 40 |  |

## lua/coplogics/coplogicphalanxvip.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CopLogicPhalanxVip._reposition_VIP_team` | 68 | 0 | 0 |  |
| [ ] | keep | `CopLogicPhalanxVip.do_vip_flee` | 28 | 21 | 21 |  |
| [ ] | keep | `CopLogicPhalanxVip.enter` | 57 | 62 | 62 |  |
| [ ] | keep | `CopLogicPhalanxVip.exit` | 31 | 29 | 29 |  |
| [ ] | keep | `CopLogicPhalanxVip.is_available_for_assignment` | 11 | 3 | 3 |  |

## lua/coplogics/specials/tankcoplogicattack.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `TankCopLogicAttack.update` | 106 | 104 | 102 |  |
| [ ] | keep | `TankCopLogicAttack.enter` | 37 | 43 | 43 |  |

## lua/coplogics/specials/shieldlogicattack.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `ShieldLogicAttack.queued_update` | 124 | 130 | 129 |  |
| [ ] | audit | `ShieldLogicAttack._pathing_complete_clbk` | 21 | 0 | 0 |  |
| [ ] | audit | `ShieldLogicAttack.chk_should_turn` | 3 | 0 | 0 |  |
| [ ] | keep | `ShieldLogicAttack._chk_request_action_walk_to_optimal_pos` | 25 | 24 | 24 |  |
| [ ] | keep | `ShieldLogicAttack._upd_enemy_detection` | 336 | 250 | 250 |  |
| [ ] | keep | `ShieldLogicAttack.action_complete_clbk` | 27 | 18 | 18 |  |
| [ ] | keep | `ShieldLogicAttack.enter` | 58 | 46 | 46 |  |
| [ ] | keep | `ShieldLogicAttack.queue_update` | 9 | 3 | 3 |  |

## lua/coplogics/specials/taserlogicattack.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | **PORT** | `TaserLogicAttack._cancel_tase_attempt` | 12 | 10 | 8 |  |
| [ ] | **PORT** | `TaserLogicAttack._chk_play_charge_weapon_sound` | 21 | 7 | 7 |  |
| [ ] | **PORT** | `TaserLogicAttack._upd_enemy_detection` | 75 | 74 | 74 |  |
| [ ] | audit | `TaserLogicAttack._chk_wants_to_take_cover` | 37 | 0 | 0 |  |
| [ ] | keep | `TaserLogicAttack._chk_reaction_to_attention_object` | 24 | 21 | 21 |  |
| [ ] | keep | `TaserLogicAttack._upd_aim` | 90 | 141 | 141 |  |
| [ ] | keep | `TaserLogicAttack.action_complete_clbk` | 103 | 39 | 39 |  |
| [ ] | keep | `TaserLogicAttack.enter` | 51 | 52 | 52 |  |
| [ ] | keep | `TaserLogicAttack.queued_update` | 77 | 57 | 57 |  |

## lua/coplogics/specials/spooc/spooclogicattack.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `SpoocLogicAttack._chk_play_charge_spooc_sound` | 7 | 0 | 0 |  |
| [ ] | audit | `SpoocLogicAttack._chk_wants_to_take_cover` | 49 | 0 | 0 |  |
| [ ] | audit | `SpoocLogicAttack.update` | 104 | 0 | 0 |  |
| [ ] | keep | `SpoocLogicAttack._upd_spooc_attack` | 53 | 45 | 45 |  |
| [ ] | keep | `SpoocLogicAttack.action_complete_clbk` | 91 | 49 | 49 |  |
| [ ] | keep | `SpoocLogicAttack.enter` | 51 | 55 | 55 |  |

## lua/coplogics/specials/spooc/spooclogicidle.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `SpoocLogicIdle._chk_exit_hiding` | 34 | 22 | 22 |  |
| [ ] | keep | `SpoocLogicIdle._upd_enemy_detection` | 59 | 52 | 52 |  |
| [ ] | keep | `SpoocLogicIdle.damage_clbk` | 9 | 9 | 9 |  |

## lua/coplogics/boss/bosslogicattack.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `LIESBossLogicAttack._cancel_chase_attempt` | 31 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack._chk_use_throwable` | 119 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack._confirm_retreat_position_visless` | 14 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack._pathing_complete_clbk` | 11 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack._upd_aim` | 230 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack._upd_combat_movement` | 208 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack._upd_enemy_detection` | 37 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack.action_complete_clbk` | 55 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack.enter` | 83 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack.queue_update` | 9 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack.queued_update` | 18 | 0 | 0 |  |
| [ ] | audit | `LIESBossLogicAttack.update` | 76 | 0 | 0 |  |
| [ ] | audit | `LIESDeepBossLogicAttack.damage_clbk` | 7 | 0 | 0 |  |

## lua/teamaiextensions/teamaidamage.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `TeamAIDamage._check_fatal` | 17 | 17 | 17 |  |

## lua/teamaiextensions/teamaimovement.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `TeamAIMovement.chk_action_forbidden` | 16 | 11 | 11 |  |

## lua/teamaiextensions/teamaibrain.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:TeamAIBrain.on_cool_state_changed:lies_swap` | 5 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/teamaiextensions/teamaiinventory.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `TeamAIInventory.equip_selection` | 11 | 7 | 7 |  |

## lua/teamailogics/teamailogicbase.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `TeamAILogicBase._get_logic_state_from_reaction` | 9 | 7 | 7 |  |
| [ ] | keep | `TeamAILogicBase._set_attention_obj` | 31 | 26 | 26 |  |

## lua/teamailogics/teamailogicidle.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `TeamAILogicIdle._on_player_slow_pos_rsrv_upd` | 41 | 0 | 0 |  |
| [ ] | audit | `TeamAILogicIdle.intimidate_others` | 125 | 0 | 0 |  |
| [ ] | keep | `TeamAILogicIdle._check_should_relocate` | 23 | 58 | 58 |  |
| [ ] | keep | `TeamAILogicIdle._find_intimidateable_civilians` | 61 | 53 | 53 |  |
| [ ] | keep | `TeamAILogicIdle._get_priority_attention` | 237 | 101 | 101 |  |
| [ ] | keep | `TeamAILogicIdle._upd_enemy_detection` | 89 | 78 | 78 |  |
| [ ] | keep | `TeamAILogicIdle.action_complete_clbk` | 61 | 58 | 58 |  |
| [ ] | keep | `TeamAILogicIdle.clbk_revive_complete` | 57 | 19 | 19 |  |
| [ ] | keep | `TeamAILogicIdle.intimidate_civilians` | 98 | 85 | 85 |  |
| [ ] | keep | `TeamAILogicIdle.is_available_for_assignment` | 29 | 27 | 27 |  |
| [ ] | keep | `TeamAILogicIdle.on_long_dis_interacted` | 177 | 141 | 141 |  |
| [ ] | keep | `TeamAILogicIdle.on_new_objective` | 37 | 37 | 37 |  |

## lua/teamailogics/teamailogictravel.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `TeamAILogicTravel._upd_enemy_detection` | 134 | 62 | 62 |  |
| [ ] | keep | `TeamAILogicTravel.enter` | 80 | 85 | 85 |  |

## lua/teamailogics/teamailogicassault.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `TeamAILogicAssault._chk_wants_to_take_cover` | 13 | 0 | 0 |  |
| [ ] | audit | `TeamAILogicAssault._on_player_slow_pos_rsrv_upd` | 27 | 0 | 0 |  |
| [ ] | keep | `TeamAILogicAssault._upd_enemy_detection` | 90 | 72 | 72 |  |
| [ ] | keep | `TeamAILogicAssault.action_complete_clbk` | 73 | 40 | 40 |  |
| [ ] | keep | `TeamAILogicAssault.enter` | 41 | 40 | 40 |  |
| [ ] | keep | `TeamAILogicAssault.find_enemy_to_mark` | 50 | 12 | 12 |  |
| [ ] | keep | `TeamAILogicAssault.mark_enemy` | 21 | 25 | 25 |  |
| [ ] | keep | `TeamAILogicAssault.update` | 173 | 68 | 68 |  |

## lua/teamailogics/teamailogicdisabled.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `TeamAILogicDisabled._consider_surrender` | 42 | 49 | 49 |  |
| [ ] | keep | `TeamAILogicDisabled._register_revive_SO` | 62 | 61 | 61 |  |
| [ ] | keep | `TeamAILogicDisabled._upd_aim` | 65 | 70 | 70 |  |

## lua/player/states/playerbleedout.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `PlayerBleedOut._register_revive_SO` | 71 | 72 | 72 |  |
| [ ] | keep | `PlayerBleedOut.on_rescue_SO_administered` | 35 | 12 | 12 |  |

## lua/player/states/playerdriving.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:PlayerDriving.update:lies_fix_vehicle` | 13 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/civlogics/civilianlogicflee.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CivilianLogicFlee.needs_panic_redirect` | 7 | 0 | 0 |  |
| [ ] | audit | `CivilianLogicFlee.ready_for_action` | 7 | 0 | 0 |  |
| [ ] | keep | `CivilianLogicFlee._find_hide_cover` | 79 | 95 | 95 |  |
| [ ] | keep | `CivilianLogicFlee._get_coarse_flee_path` | 61 | 61 | 61 |  |
| [ ] | keep | `CivilianLogicFlee._run_away_from_alert` | 40 | 29 | 29 |  |
| [ ] | keep | `CivilianLogicFlee._start_moving_to_cover` | 24 | 23 | 23 |  |
| [ ] | keep | `CivilianLogicFlee._unregister_rescue_SO` | 23 | 21 | 21 |  |
| [ ] | keep | `CivilianLogicFlee._update_pathing` | 23 | 23 | 23 |  |
| [ ] | keep | `CivilianLogicFlee.action_complete_clbk` | 40 | 35 | 35 |  |
| [ ] | keep | `CivilianLogicFlee.clbk_chk_call_the_police` | 51 | 44 | 44 |  |
| [ ] | keep | `CivilianLogicFlee.clbk_chk_run_away` | 17 | 15 | 15 |  |
| [ ] | keep | `CivilianLogicFlee.enter` | 124 | 102 | 102 |  |
| [ ] | keep | `CivilianLogicFlee.on_alert` | 81 | 111 | 111 |  |
| [ ] | keep | `CivilianLogicFlee.on_intimidated` | 36 | 19 | 19 |  |
| [ ] | keep | `CivilianLogicFlee.on_rescue_SO_administered` | 11 | 10 | 10 |  |
| [ ] | keep | `CivilianLogicFlee.on_rescue_SO_completed` | 44 | 44 | 44 |  |
| [ ] | keep | `CivilianLogicFlee.post_react_alert_clbk` | 53 | 66 | 66 |  |
| [ ] | keep | `CivilianLogicFlee.register_rescue_SO` | 109 | 95 | 95 |  |
| [ ] | keep | `CivilianLogicFlee.rescue_SO_verification` | 16 | 16 | 16 |  |
| [ ] | keep | `CivilianLogicFlee.reset_actions` | 27 | 12 | 12 |  |
| [ ] | keep | `CivilianLogicFlee.schedule_run_away_clbk` | 12 | 12 | 12 |  |
| [ ] | keep | `CivilianLogicFlee.update` | 73 | 91 | 91 |  |

## lua/civlogics/civilianlogicidle.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CivilianLogicIdle._perform_objective_action` | 27 | 0 | 0 |  |
| [ ] | audit | `CivilianLogicIdle.update` | 17 | 0 | 0 |  |
| [ ] | keep | `CivilianLogicIdle._delayed_alert_clbk` | 43 | 33 | 33 |  |
| [ ] | keep | `CivilianLogicIdle._upd_detection` | 57 | 55 | 55 |  |
| [ ] | keep | `CivilianLogicIdle.action_complete_clbk` | 25 | 17 | 17 |  |
| [ ] | keep | `CivilianLogicIdle.enter` | 67 | 90 | 90 |  |
| [ ] | keep | `CivilianLogicIdle.is_available_for_assignment` | 9 | 9 | 9 |  |
| [ ] | keep | `CivilianLogicIdle.is_obstructed` | 23 | 27 | 27 |  |
| [ ] | keep | `CivilianLogicIdle.on_alert` | 80 | 65 | 65 |  |
| [ ] | keep | `CivilianLogicIdle.on_new_objective` | 45 | 44 | 44 |  |

## lua/civlogics/civilianlogictravel.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CivilianLogicTravel._check_should_relocate` | 23 | 0 | 0 |  |
| [ ] | keep | `CivilianLogicTravel._chk_has_old_action` | 14 | 5 | 5 |  |
| [ ] | keep | `CivilianLogicTravel._determine_exact_destination` | 26 | 18 | 18 |  |
| [ ] | keep | `CivilianLogicTravel._upd_stop_old_action` | 20 | 9 | 9 |  |
| [ ] | keep | `CivilianLogicTravel.update` | 113 | 104 | 104 |  |

## lua/civlogics/civilianlogicescort.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | keep | `CivilianLogicEscort._begin_advance_action` | 27 | 23 | 23 |  |
| [ ] | keep | `CivilianLogicEscort.action_complete_clbk` | 15 | 14 | 14 |  |
| [ ] | keep | `CivilianLogicEscort.enter` | 54 | 50 | 50 |  |
| [ ] | keep | `CivilianLogicEscort.exit` | 14 | 13 | 13 |  |
| [ ] | keep | `CivilianLogicEscort.too_scared_to_move` | 46 | 35 | 35 |  |
| [ ] | keep | `CivilianLogicEscort.update` | 72 | 69 | 69 |  |

## lua/civlogics/civilianlogicsurrender.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit | `CivilianLogicSurrender.progress_to_drop` | 60 | 0 | 0 |  |
| [ ] | audit | `CivilianLogicSurrender.update` | 38 | 0 | 0 |  |
| [ ] | keep | `CivilianLogicSurrender._delayed_intimidate_clbk` | 77 | 70 | 70 |  |
| [ ] | keep | `CivilianLogicSurrender._update_enemy_detection` | 118 | 81 | 81 |  |
| [ ] | keep | `CivilianLogicSurrender.action_complete_clbk` | 18 | 10 | 10 |  |
| [ ] | keep | `CivilianLogicSurrender.enter` | 108 | 110 | 110 |  |
| [ ] | keep | `CivilianLogicSurrender.on_intimidated` | 39 | 31 | 31 |  |
| [ ] | keep | `CivilianLogicSurrender.queued_update` | 40 | 31 | 31 |  |

## lua/equipment/sentry_gun/sentrygunbase.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:SentryGunBase.activate_as_module:lies_fix_turret_fuck` | 3 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/managers/core/coreworlddefinition.lua

| done | status | function | mod L | old L | new L | note |
|---:|---|---|---:|---:|---:|---|
| [ ] | audit (hook) | `Hooks.PostHook:WorldDefinition.assign_unit_data:lies_fix_dumb_map_stuff` | 37 | 0 | 0 | Hooks:PostHook/PreHook callback; audit and port with the hooked method |

## lua/copextensions/copinventory.lua

**UNHOOKED FILE** — not referenced by mod.txt; it never loads.

## lua/managers/mapelements/elementnavobstacle.lua

**UNHOOKED FILE** — not referenced by mod.txt; it never loads.

## lua/player/states/playerfatal.lua

**UNHOOKED FILE** — not referenced by mod.txt; it never loads.


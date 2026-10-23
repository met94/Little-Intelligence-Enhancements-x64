# Function dossier: lua/coplogics/coplogicattack.lua :: CopLogicAttack._upd_aim

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 560 lines, params `(data, my_data)`
- 246.1: 195 lines, params `(data, my_data)`
- 248.2: 192 lines, params `(data, my_data)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function CopLogicAttack._upd_aim(data, my_data)
local shoot, aim, expected_pos = nil
	local focus_enemy = data.attention_obj
	local walk_action
	local walk_dir, walking

	if focus_enemy and AIAttentionObject.REACT_AIM <= focus_enemy.reaction then
		local last_sup_t = data.unit:character_damage():last_suppression_t()
		local enemy_pos = not focus_enemy.lost_track and focus_enemy.last_verified_pos or focus_enemy.verified_pos
		local enemy_m_pos = not focus_enemy.lost_track and focus_enemy.last_verified_m_pos or focus_enemy.verified_m_pos or focus_enemy.m_pos
		local enemy_dis
		
		local weapon_range = my_data.weapon_range
		
		if not weapon_range then
			local complained = my_data.complained_about_invalid_range
			local w_td = alive(data.unit) and data.unit:inventory():equipped_unit() and data.unit:inventory():equipped_unit():base():weapon_tweak_data()

			if w_td then
				local cw_td = data.char_tweak.weapon[w_td.usage]
				weapon_range = cw_td and cw_td.range 
				
				if not weapon_range then
					if not complained then
						log(data.unit:base()._tweak_table)
						log(data.name)
						log("CopLogicAttack.upd_aim, weapon invalid, using backup values")
						complained = true
					end
					
					weapon_range = {
						optimal = 2000,
						far = 5000,
						close = 1000
					}
				elseif not complained then
					log(data.unit:base()._tweak_table)
					log(data.name)
					log("CopLogicAttack.upd_aim, range unset, setting range")
					complained = true
				end
			else
				if not complained then
					log(data.unit:base()._tweak_table)
					log(data.name)
					log("CopLogicAttack.upd_aim, weapon dead or range unset, using backup values")
					complained = true
				end
				
				weapon_range = {
					optimal = 2000,
					far = 5000,
					close = 1000
				}
			end
			
			my_data.complained_about_invalid_range = complained
		end
		
		if not focus_enemy.verified and not focus_enemy.lost_track and focus_enemy.last_verified_pos then
			enemy_dis = mvec3_dis(data.m_pos, focus_enemy.last_verified_m_pos)
			focus_enemy.last_verified_dis = enemy_dis
		else
			enemy_dis = focus_enemy.verified_dis or focus_enemy.dis
		end

		if LIES.settings.hhtacs and (focus_enemy.verified_t and data.t - focus_enemy.verified_t < 2 or my_data.shooting) then
			if focus_enemy.hostage_blocked then
				if data.important then
					if data.char_tweak.chatter and data.char_tweak.chatter.ready then
						managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "hostageblock")
					end
				end
			
				if data.brain:request_switch_to_safe_weapon(3) then
					if my_data.shooting then
						local new_action = {
							body_part = 3,
							type = "idle"
						}

						data.unit:brain():action_request(new_action)
					end
					
					if my_data.firing then
						data.unit:movement():set_allow_fire(false)

						my_data.firing = nil
					end
					
					return
				end
			elseif data.safe_equipped and data.brain:request_switch_to_normal_weapon(7) then
				if my_data.shooting then
					local new_action = {
						body_part = 3,
						type = "idle"
					}

					data.unit:brain():action_request(new_action)
				end
				
				if my_data.firing then
					data.unit:movement():set_allow_fire(false)

					my_data.firing = nil
				end
				
				return
			end
		end

		local try_stop_charge
		
		if focus_enemy.verified and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
			my_data.charging = my_data.charging or my_data.flank_cover
			
			--stop the charge, we are not chargers we do not push unless nescessary
			if my_data.charging and not data.unit:movement():chk_action_forbidden("walk") then
				try_stop_charge = true
				
				if data.attention_obj.dis <= 200 or LIES.settings.enemy_aggro_level < 4 and (not data.tactics or not data.tactics.charge) and not data.unit:base():has_tag("tank") and not tankboss[data.unit:base()._tweak_table] then
					local new_action = {
						body_part = 2,
						type = "idle"
					}

					if data.unit:brain():action_request(new_action) then
						CopLogicAttack._cancel_charge(data, my_data)
						my_data.at_cover_shoot_pos = true
						try_stop_charge = nil
					end
				end
			end
			
			my_data.cover_test_step = 0
			my_data.flank_cover = nil
		end
		
		local running = data.unit:anim_data().run or data.unit:anim_data().sprint
		running = not data.unit:anim_data().run_stop and running or nil
		
		if not data.char_tweak.always_face_enemy and not focus_enemy.dangerous_special then
			if my_data.low_value_att or running and not (data.tactics and data.tactics.sniper) then
				walk_action = my_data.advancing 
			
				if walk_action and walk_action._init_called and walk_action._footstep_pos and walk_action._haste == "run" then --do this properly
					walking = true
					local pos_for_dir = walk_action._footstep_pos
					walk_dir = pos_for_dir - data.m_pos
					walk_dir = walk_dir:with_z(0):normalized()

					mvec3_dir(temp_vec2, data.m_pos, enemy_m_pos)
					mvec3_set_z(temp_vec2, 0)

					local dot = mvec3_dot(walk_dir, temp_vec2)

					if dot < 0.7 then
						if try_stop_charge then
							local new_action = {
								body_part = 2,
								type = "idle"
							}

							if data.unit:brain():action_request(new_action) then
								CopLogicAttack._cancel_charge(data, my_data)
								my_data.at_cover_shoot_pos = true
								try_stop_charge = nil
								walking = nil
								running = nil
							end
						else
							local can_turn_to_shoot = focus_enemy.dmg_t and data.t - focus_enemy.dmg_t < 5
							can_turn_to_shoot = can_turn_to_shoot or focus_enemy.acquire_t and data.t - focus_enemy.acquire_t < 4 and focus_enemy.dis <= weapon_range.close
							
							if not can_turn_to_shoot then
								shoot = false
								aim = false
							end
						end
					end
				end
			end
		end
		
		
		local firing_range = running and weapon_range.close or weapon_range.far
		local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t

		if focus_enemy.verified or focus_enemy.nearly_visible or time_since_verification and time_since_verification <= 0.2 then
			if aim == nil and AIAttentionObject.REACT_AIM <= focus_enemy.reaction then
				if AIAttentionObject.REACT_SHOOT <= focus_enemy.reaction then
					if AIAttentionObject.REACT_SHOOT == focus_enemy.reaction then
						shoot = true
					end

					if not shoot and my_data.attitude == "engage" then
						shoot = true
					end

					if not shoot then
						if data.unit:base():has_tag("law") and not data.is_converted then
							if focus_enemy.criminal_record then
								if focus_enemy.aimed_at and not focus_enemy.hostage_blocked and not focus_enemy.busy then
									shoot = true
								elseif focus_enemy.dis < 1400 then
									shoot = true
								elseif focus_enemy.criminal_record.assault_t and data.t - focus_enemy.criminal_record.assault_t < 7 or data.name == "attack" then
									shoot = true
								else
									aim = true
								end
							elseif enemy_dis < firing_range then
								shoot = true
							else
								aim = true
							end
						else
							shoot = true
						end
					end

					if shoot then
						aim = true
					end
				else
					aim = true
				end
			end
		elseif AIAttentionObject.REACT_AIM <= focus_enemy.reaction then
			local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
			local my_tracker = data.unit:movement():nav_tracker()
			local my_seg = my_tracker:nav_segment()
			local enemy_nav_seg = focus_enemy.nav_tracker and focus_enemy.nav_tracker:nav_segment()
			
			if time_since_verification and not focus_enemy.lost_track or my_seg == enemy_nav_seg then
				if aim == nil and enemy_dis > 200 then
					if running and not data.char_tweak.always_face_enemy then
						if time_since_verification and time_since_verification < math.lerp(7, 1, math.max(0, enemy_dis - 500) / 600) then
							aim = true
						end
					elseif time_since_verification and time_since_verification < 15 then
						aim = true
					end
				end
				
				if AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
					if aim and not LIES.settings.highperformance then
						local test_for_sight = not my_data.expected_pos_last_check_t
						
						if not test_for_sight then
							local time_for_check = data.important and 0.2 or 1.5
							test_for_sight = data.t - my_data.expected_pos_last_check_t > time_for_check
						end

						if test_for_sight and not my_data.advancing then
							local head_pos = data.m_pos:with_z(data.unit:movement():m_head_pos().z)
							local last_verified_pos = not focus_enemy.lost_track and focus_enemy.last_verified_pos or focus_enemy.verified_pos

							if data.unit:raycast("ray", head_pos, last_verified_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
								aim = nil
								local vec_to_pos = temp_vec1
								mvec3_dir(vec_to_pos, head_pos, last_verified_pos)
								mvec3_set_len(vec_to_pos, 2000)
								
								local vis_positions = managers.navigation:find_walls_across_pos(last_verified_pos, vec_to_pos, 360, 9)
								
								mvec3_norm(vec_to_pos)
								mvec3_set_z(vec_to_pos, 0)
								
								if vis_positions then
									local raycast_f = data.unit.raycast
									local nav_manager = managers.navigation
									local pad_out_position_f = nav_manager.pad_out_position
									local last_verified_m_pos = not focus_enemy.lost_track and focus_enemy.last_verified_m_pos or focus_enemy.verified_m_pos
									local height = 140

									local best_has_vis, best_dis_to_pos, best_pos, best_head_pos
									
									for _, vis_pos in ipairs(vis_positions) do
										local check_position = pad_out_position_f(nav_manager, vis_pos[1], 4)
										
										mvec3_dir(temp_vec2, last_verified_m_pos, check_position)
										local dis_sq = mvec3_dis_sq(last_verified_m_pos, check_position)
										mvec3_set_z(temp_vec2, 0)
										
										local target_dot = mvec3_dot(vec_to_pos, temp_vec2)
										
										if target_dot >= 0.7 then
											local check_pos_with_height = check_position:with_z(check_position.z + height)
											local has_vis = not raycast_f(data.unit, "ray", head_pos, check_pos_with_height, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
											
											if not best_has_vis or has_vis then
												local check_dis = mvec3_dis_sq(check_position, last_verified_m_pos)
							
												if not best_dis_to_pos or check_dis < best_dis_to_pos then
													best_dis_to_pos = check_dis
													best_has_vis = has_vis
													best_head_pos = check_pos_with_height
													best_pos = check_position
												end
											end
										end
									end
									
									if best_pos and best_head_pos and best_has_vis then
										focus_enemy.last_verified_pos = best_head_pos
										focus_enemy.last_verified_m_pos = best_pos
										focus_enemy.last_verified_dis = mvec3_dis(data.m_pos, focus_enemy.last_verified_m_pos)
										
										if focus_enemy.last_verified_dis > 200 then
											aim = true
										end
									end
								end
							end
							
							my_data.expected_pos_last_check_t = data.t
						end
					end
				end

				if aim and AIAttentionObject.REACT_SHOOT <= focus_enemy.reaction then
					if AIAttentionObject.REACT_SHOOT == focus_enemy.reaction then
						shoot = true
					end
					
					if not shoot and data.tactics and data.tactics.provide_coverfire_LIES and time_since_verification and time_since_verification < 7 then
						shoot = true
					end
				end				
			elseif AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction and focus_enemy.nav_tracker and not LIES.settings.highperformance then
				local raycast_f, head_pos
				
				local expected_path = my_data.expected_pos_path

				if expected_path then
					expected_pos = CopLogicAttack._get_expected_pos(data, my_data)
				elseif my_data.expected_pos then
					expected_pos = my_data.expected_pos
				end
				
				local test_for_sight = not my_data.expected_pos_last_check_t
	
				if not test_for_sight then
					local time_for_check = data.important and 0.2 or 1.5
					test_for_sight = data.t - my_data.expected_pos_last_check_t > time_for_check
				end
				
				if test_for_sight and expected_pos and not my_data.advancing then
					raycast_f = data.unit.raycast
					head_pos = data.m_pos:with_z(data.unit:movement():m_head_pos().z)
					
					if raycast_f(data.unit, "ray", head_pos, expected_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
						expected_pos = nil
						my_data.expected_pos = nil
					end
				end
			
				if not expected_pos and test_for_sight then					
					if my_seg ~= enemy_nav_seg then
						head_pos = head_pos or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
						raycast_f = raycast_f or data.unit.raycast
						local all_nav_segs = managers.navigation._nav_segments
						local seg_pos = all_nav_segs[enemy_nav_seg].pos
						
						local height_preference = data.m_pos.z >= seg_pos.z
						local try_watch_enemy_seg = height_preference or math.abs(data.m_pos.z - seg_pos.z) < 250 or focus_enemy.dis >= 2000
						
						if try_watch_enemy_seg then
							local doors = managers.navigation:find_segment_doors(enemy_nav_seg)
							
							if #doors > 0 then
								for i = 1, #doors do
									local door = doors[i]
									
									if door.end_pos then
										local test_pos = door.end_pos:with_z(door.end_pos.z + 140)
										if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
											expected_pos = test_pos
											
											break
										end
									elseif door.center then
										local test_pos = door.center:with_z(door.center.z + 140)
										if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
											expected_pos = test_pos
											
											break
										end
									end
								end
							end
						end
						
						if not expected_pos and not focus_enemy.nav_tracker:obstructed() and not my_tracker:obstructed() then
							local expected_pos_func = CopLogicAttack._get_expected_pos
							expected_pos = expected_pos_func(data, my_data)
						end						
					end
					
					my_data.expected_pos_last_check_t = data.t
				end
				
				if expected_pos then
					my_data.expected_pos = expected_pos
					head_pos = head_pos or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
					enemy_dis = mvec3_dis(expected_pos, head_pos)

					if enemy_dis > 200 then
						aim = true
						shoot = nil
						
						if running and not (data.tactics and data.tactics.sniper) then
							if walking then
								mvec3_dir(temp_vec2, data.m_pos, expected_pos)
								mvec3_set_z(temp_vec2, 0)

								local dot = mvec3_dot(walk_dir, temp_vec2)

								if dot < 0.7 then
									aim = false
								end
							end
						end
					end
				end
			end
		end

		CopLogicAttack._chk_enrage(data, focus_enemy)
	end
	
	if shoot and data.tactics and data.tactics.harass and data.char_tweak.chatter and data.char_tweak.chatter.clear and focus_enemy.verified then
		if focus_enemy.is_local_player then
			local cur_state = focus_enemy.unit:movement():current_state()
			
			if cur_state:_is_reloading() then
				managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "calloutreload")
			end
		else
			local focus_anim_data = focus_enemy.unit:anim_data()

			if focus_anim_data and focus_anim_data.reload then
				managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "calloutreload")
			end
		end
	end
	
	if shoot then
		aim = true
	end

	if aim or shoot then
		local look_pos
		
		if focus_enemy.verified then		
			if not my_data.attention_unit or my_data.attention_unit ~= focus_enemy.u_key then
				CopLogicBase._set_attention(data, focus_enemy)

				my_data.attention_unit = focus_enemy.u_key
			end
		elseif expected_pos then
			my_data.expected_pos = expected_pos
			look_pos = expected_pos
			
			if not my_data.attention_unit or my_data.attention_unit == focus_enemy.u_key or my_data.attention_unit ~= look_pos then
				CopLogicBase._set_attention_on_pos(data, my_data.expected_pos)

				my_data.attention_unit = my_data.expected_pos
			end
		elseif focus_enemy.last_verified_pos then
			look_pos = focus_enemy.last_verified_pos

			if not my_data.attention_unit or my_data.attention_unit == focus_enemy.u_key or my_data.attention_unit ~= look_pos then
				CopLogicBase._set_attention_on_pos(data, look_pos)

				my_data.attention_unit = focus_enemy.last_verified_pos
			end
		elseif focus_enemy.last_expected then
			look_pos = focus_enemy.last_expected

			if not my_data.attention_unit or my_data.attention_unit == focus_enemy.u_key or my_data.attention_unit ~= look_pos then
				CopLogicBase._set_attention_on_pos(data, look_pos)
				
				my_data.attention_unit = focus_enemy.last_expected
			end
		elseif my_data.attention_unit then
			CopLogicBase._reset_attention(data)

			my_data.attention_unit = nil
		end

		if not my_data.shooting and not my_data.spooc_attack and not data.unit:movement():chk_action_forbidden("action") then
			local shoot_action = {
				body_part = 3,
				type = "shoot"
			}

			my_data.shooting = data.unit:brain():action_request(shoot_action)
			
			if my_data.shooting then
				my_data.start_shoot_t = data.t
			end
		end
	else
		if not my_data.start_shoot_t or data.t - my_data.start_shoot_t > 0.5 then
			if not data.unit:movement():chk_action_forbidden("action") and not data.unit:anim_data().reload and CopLogicAttack._check_needs_reload(data, my_data) then
				if my_data.shooting then
					local new_action = {
						body_part = 3,
						type = "idle"
					}

					data.unit:brain():action_request(new_action)
				end
			end
		end
		
		if my_data.attention_unit then
			CopLogicBase._reset_attention(data)

			my_data.attention_unit = nil
		end
	end
	
	if not my_data.advancing and CopLogicAttack.chk_should_turn(data, my_data) then
		if my_data.attention_unit then
			local turn_pos
			
			if my_data.attention_unit ~= focus_enemy.u_key then
				turn_pos = my_data.attention_unit
			else
				turn_pos = focus_enemy.m_pos
			end

			CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, turn_pos)
		end
	end
	
	if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
		if LIES.settings.enemy_reaction_level < 3 and not data.unit:in_slot(16) and not data.team.id == "criminal1" then
			if not focus_enemy.react_t or not focus_enemy.verified_t or data.t - focus_enemy.verified_t > 2 then
				focus_enemy.react_t = data.t
			end
		
			local react_t = 2 / LIES.settings.enemy_reaction_level
		
			if data.t - focus_enemy.react_t < react_t then
				shoot = nil
			end
		end
	end
	
	if shoot and focus_enemy and not data.safe_equipped and not focus_enemy.hostage_blocked then
		LIESBossLogicAttack._chk_use_throwable(data, my_data, focus_enemy)
	end

	CopLogicAttack.aim_allow_fire(shoot, aim, data, my_data)
end
```

## 246.1 vanilla (a3180fc)

```lua
function CopLogicAttack._upd_aim(data, my_data)
local shoot, aim, expected_pos
	local focus_enemy = data.attention_obj

	if focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
		local last_sup_t = data.unit:character_damage():last_suppression_t()

		if focus_enemy.verified or focus_enemy.nearly_visible then
			if data.unit:anim_data().run and focus_enemy.dis > math.lerp(my_data.weapon_range.close, my_data.weapon_range.optimal, 0) then
				local walk_to_pos = data.unit:movement():get_walk_to_pos()

				if walk_to_pos then
					mvector3.direction(temp_vec1, data.m_pos, walk_to_pos)
					mvector3.direction(temp_vec2, data.m_pos, focus_enemy.m_pos)

					local dot = mvector3.dot(temp_vec1, temp_vec2)

					if dot < 0.6 then
						shoot = false
						aim = false
					end
				end
			end

			if aim == nil and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
				if focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT then
					local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"
					local firing_range = 500

					if data.internal_data.weapon_range then
						firing_range = running and data.internal_data.weapon_range.close or data.internal_data.weapon_range.far
					else
						debug_pause_unit(data.unit, "[CopLogicAttack]: Unit doesn't have data.internal_data.weapon_range")
					end

					if last_sup_t and data.t - last_sup_t < 7 * (running and 0.3 or 1) * (focus_enemy.verified and 1 or focus_enemy.vis_ray and firing_range < focus_enemy.vis_ray.distance and 0.5 or 0.2) then
						shoot = true
					elseif focus_enemy.verified and data.internal_data.weapon_range and firing_range > focus_enemy.verified_dis then
						shoot = true
					elseif focus_enemy.verified and focus_enemy.criminal_record and focus_enemy.criminal_record.assault_t and data.t - focus_enemy.criminal_record.assault_t < 2 then
						shoot = true
					end

					if not shoot and my_data.attitude == "engage" then
						if focus_enemy.verified then
							if firing_range > focus_enemy.verified_dis or focus_enemy.reaction == AIAttentionObject.REACT_SHOOT then
								shoot = true
							end
						else
							local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t

							if my_data.firing and time_since_verification and time_since_verification < 3.5 then
								shoot = true
							else
								data.brain:search_for_path_to_unit("hunt" .. tostring(my_data.key), focus_enemy.unit)
							end
						end
					end

					aim = aim or shoot

					if not aim and firing_range > focus_enemy.verified_dis then
						aim = true
					end
				else
					aim = true
				end
			end
		elseif focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
			local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
			local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"
			local same_z = math.abs(focus_enemy.verified_pos.z - data.m_pos.z) < 250

			if running then
				if time_since_verification and time_since_verification < math.lerp(5, 1, math.max(0, focus_enemy.verified_dis - 500) / 600) then
					aim = true
				end
			else
				aim = true
			end

			if aim and my_data.shooting and focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT and time_since_verification and time_since_verification < (running and 2 or 3) then
				shoot = true
			end

			if not aim then
				expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)

				if expected_pos then
					if running then
						local watch_dir = temp_vec1

						mvec3_set(watch_dir, expected_pos)
						mvec3_sub(watch_dir, data.m_pos)
						mvec3_set_z(watch_dir, 0)

						local watch_pos_dis = mvec3_norm(watch_dir)
						local walk_to_pos = data.unit:movement():get_walk_to_pos()
						local walk_vec = temp_vec2

						mvec3_set(walk_vec, walk_to_pos)
						mvec3_sub(walk_vec, data.m_pos)
						mvec3_set_z(walk_vec, 0)
						mvec3_norm(walk_vec)

						local watch_walk_dot = mvec3_dot(watch_dir, walk_vec)

						if watch_pos_dis < 500 or watch_pos_dis < 1000 and watch_walk_dot > 0.85 then
							aim = true
						end
					else
						aim = true
					end
				end
			end
		else
			expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)

			if expected_pos then
				aim = true
			end
		end
	end

	if not aim and data.char_tweak.always_face_enemy and focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
		aim = true
	end

	if data.logic.chk_should_turn(data, my_data) and (focus_enemy or expected_pos) then
		local enemy_pos = expected_pos or (focus_enemy.verified or focus_enemy.nearly_visible) and focus_enemy.m_pos or focus_enemy.verified_pos

		CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)
	end

	if aim or shoot then
		if expected_pos then
			if my_data.attention_unit ~= expected_pos then
				CopLogicBase._set_attention_on_pos(data, mvector3.copy(expected_pos))

				my_data.attention_unit = mvector3.copy(expected_pos)
			end
		elseif focus_enemy.verified or focus_enemy.nearly_visible then
			if my_data.attention_unit ~= focus_enemy.u_key then
				CopLogicBase._set_attention(data, focus_enemy)

				my_data.attention_unit = focus_enemy.u_key
			end
		else
			local look_pos = focus_enemy.last_verified_pos or focus_enemy.verified_pos

			if my_data.attention_unit ~= look_pos then
				CopLogicBase._set_attention_on_pos(data, mvector3.copy(look_pos))

				my_data.attention_unit = mvector3.copy(look_pos)
			end
		end

		if not my_data.shooting and not my_data.spooc_attack and not data.unit:anim_data().reload and not data.unit:movement():chk_action_forbidden("action") then
			local shoot_action = {
				body_part = 3,
				type = "shoot"
			}

			if data.unit:brain():action_request(shoot_action) then
				my_data.shooting = true
			end
		end
	else
		if my_data.shooting then
			local new_action

			if data.unit:anim_data().reload then
				new_action = {
					body_part = 3,
					type = "reload"
				}
			else
				new_action = {
					body_part = 3,
					type = "idle"
				}
			end

			data.unit:brain():action_request(new_action)
		end

		if my_data.attention_unit then
			CopLogicBase._reset_attention(data)

			my_data.attention_unit = nil
		end
	end

	CopLogicAttack.aim_allow_fire(shoot, aim, data, my_data)
end
```

## 248.2 vanilla (e3a8b616)

```lua
function CopLogicAttack._upd_aim(data, my_data)
local shoot, aim, expected_pos
	local focus_enemy = data.attention_obj

	if focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
		local last_sup_t = data.unit:character_damage():last_suppression_t()

		if focus_enemy.verified or focus_enemy.nearly_visible then
			if data.unit:anim_data().run and focus_enemy.dis > my_data.weapon_range.close then
				local walk_to_pos = data.unit:movement():get_walk_to_pos()

				if walk_to_pos then
					mvector3.direction(temp_vec1, data.m_pos, walk_to_pos)
					mvector3.direction(temp_vec2, data.m_pos, focus_enemy.m_pos)

					local dot = mvector3.dot(temp_vec1, temp_vec2)

					if dot < 0.6 then
						shoot = false
						aim = false
					end
				end
			end

			if aim == nil and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
				if focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT then
					local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"
					local firing_range = 500

					if data.internal_data.weapon_range then
						firing_range = running and data.internal_data.weapon_range.close or data.internal_data.weapon_range.far
					end

					if last_sup_t and data.t - last_sup_t < 7 * (running and 0.3 or 1) * (focus_enemy.verified and 1 or focus_enemy.vis_ray and firing_range < focus_enemy.vis_ray.distance and 0.5 or 0.2) then
						shoot = true
					elseif focus_enemy.verified and data.internal_data.weapon_range and firing_range > focus_enemy.verified_dis then
						shoot = true
					elseif focus_enemy.verified and focus_enemy.criminal_record and focus_enemy.criminal_record.assault_t and data.t - focus_enemy.criminal_record.assault_t < 2 then
						shoot = true
					end

					if not shoot and my_data.attitude == "engage" then
						if focus_enemy.verified then
							if firing_range > focus_enemy.verified_dis or focus_enemy.reaction == AIAttentionObject.REACT_SHOOT then
								shoot = true
							end
						else
							local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t

							if my_data.firing and time_since_verification and time_since_verification < 3.5 then
								shoot = true
							else
								data.brain:search_for_path_to_unit("hunt" .. tostring(my_data.key), focus_enemy.unit)
							end
						end
					end

					aim = aim or shoot

					if not aim and firing_range > focus_enemy.verified_dis then
						aim = true
					end
				else
					aim = true
				end
			end
		elseif focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
			local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
			local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"

			if running then
				if time_since_verification and time_since_verification < math.lerp(5, 1, math.max(0, focus_enemy.verified_dis - 500) / 600) then
					aim = true
				end
			else
				aim = true
			end

			if aim and my_data.shooting and focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT and time_since_verification and time_since_verification < (running and 2 or 3) then
				shoot = true
			end

			if not aim then
				expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)

				if expected_pos then
					if running then
						local watch_dir = temp_vec1

						mvec3_set(watch_dir, expected_pos)
						mvec3_sub(watch_dir, data.m_pos)
						mvec3_set_z(watch_dir, 0)

						local watch_pos_dis = mvec3_norm(watch_dir)
						local walk_to_pos = data.unit:movement():get_walk_to_pos()
						local walk_vec = temp_vec2

						mvec3_set(walk_vec, walk_to_pos)
						mvec3_sub(walk_vec, data.m_pos)
						mvec3_set_z(walk_vec, 0)
						mvec3_norm(walk_vec)

						local watch_walk_dot = mvec3_dot(watch_dir, walk_vec)

						if watch_pos_dis < 500 or watch_pos_dis < 1000 and watch_walk_dot > 0.85 then
							aim = true
						end
					else
						aim = true
					end
				end
			end
		else
			expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)

			if expected_pos then
				aim = true
			end
		end
	end

	if not aim and data.char_tweak.always_face_enemy and focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
		aim = true
	end

	if data.logic.chk_should_turn(data, my_data) and (focus_enemy or expected_pos) then
		local enemy_pos = expected_pos or (focus_enemy.verified or focus_enemy.nearly_visible) and focus_enemy.m_pos or focus_enemy.verified_pos

		CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)
	end

	if aim or shoot then
		if expected_pos then
			if my_data.attention_unit ~= expected_pos then
				CopLogicBase._set_attention_on_pos(data, mvector3.copy(expected_pos))

				my_data.attention_unit = mvector3.copy(expected_pos)
			end
		elseif focus_enemy.verified or focus_enemy.nearly_visible then
			if my_data.attention_unit ~= focus_enemy.u_key then
				CopLogicBase._set_attention(data, focus_enemy)

				my_data.attention_unit = focus_enemy.u_key
			end
		else
			local look_pos = focus_enemy.last_verified_pos or focus_enemy.verified_pos

			if my_data.attention_unit ~= look_pos then
				CopLogicBase._set_attention_on_pos(data, mvector3.copy(look_pos))

				my_data.attention_unit = mvector3.copy(look_pos)
			end
		end

		if not my_data.shooting and not my_data.spooc_attack and not data.unit:anim_data().reload and not data.unit:movement():chk_action_forbidden("action") then
			local shoot_action = {
				body_part = 3,
				type = "shoot"
			}

			if data.unit:brain():action_request(shoot_action) then
				my_data.shooting = true
			end
		end
	else
		if my_data.shooting then
			local new_action

			if data.unit:anim_data().reload then
				new_action = {
					body_part = 3,
					type = "reload"
				}
			else
				new_action = {
					body_part = 3,
					type = "idle"
				}
			end

			data.unit:brain():action_request(new_action)
		end

		if my_data.attention_unit then
			CopLogicBase._reset_attention(data)

			my_data.attention_unit = nil
		end
	end

	CopLogicAttack.aim_allow_fire(shoot, aim, data, my_data)
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,194 +1,559 @@
-local shoot, aim, expected_pos
+local shoot, aim, expected_pos = nil
 	local focus_enemy = data.attention_obj
+	local walk_action
+	local walk_dir, walking
 
-	if focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
+	if focus_enemy and AIAttentionObject.REACT_AIM <= focus_enemy.reaction then
 		local last_sup_t = data.unit:character_damage():last_suppression_t()
+		local enemy_pos = not focus_enemy.lost_track and focus_enemy.last_verified_pos or focus_enemy.verified_pos
+		local enemy_m_pos = not focus_enemy.lost_track and focus_enemy.last_verified_m_pos or focus_enemy.verified_m_pos or focus_enemy.m_pos
+		local enemy_dis
+		
+		local weapon_range = my_data.weapon_range
+		
+		if not weapon_range then
+			local complained = my_data.complained_about_invalid_range
+			local w_td = alive(data.unit) and data.unit:inventory():equipped_unit() and data.unit:inventory():equipped_unit():base():weapon_tweak_data()
+
+			if w_td then
+				local cw_td = data.char_tweak.weapon[w_td.usage]
+				weapon_range = cw_td and cw_td.range 
+				
+				if not weapon_range then
+					if not complained then
+						log(data.unit:base()._tweak_table)
+						log(data.name)
+						log("CopLogicAttack.upd_aim, weapon invalid, using backup values")
+						complained = true
+					end
+					
+					weapon_range = {
+						optimal = 2000,
+						far = 5000,
+						close = 1000
+					}
+				elseif not complained then
+					log(data.unit:base()._tweak_table)
+					log(data.name)
+					log("CopLogicAttack.upd_aim, range unset, setting range")
+					complained = true
+				end
+			else
+				if not complained then
+					log(data.unit:base()._tweak_table)
+					log(data.name)
+					log("CopLogicAttack.upd_aim, weapon dead or range unset, using backup values")
+					complained = true
+				end
+				
+				weapon_range = {
+					optimal = 2000,
+					far = 5000,
+					close = 1000
+				}
+			end
+			
+			my_data.complained_about_invalid_range = complained
+		end
+		
+		if not focus_enemy.verified and not focus_enemy.lost_track and focus_enemy.last_verified_pos then
+			enemy_dis = mvec3_dis(data.m_pos, focus_enemy.last_verified_m_pos)
+			focus_enemy.last_verified_dis = enemy_dis
+		else
+			enemy_dis = focus_enemy.verified_dis or focus_enemy.dis
+		end
 
-		if focus_enemy.verified or focus_enemy.nearly_visible then
-			if data.unit:anim_data().run and focus_enemy.dis > math.lerp(my_data.weapon_range.close, my_data.weapon_range.optimal, 0) then
-				local walk_to_pos = data.unit:movement():get_walk_to_pos()
+		if LIES.settings.hhtacs and (focus_enemy.verified_t and data.t - focus_enemy.verified_t < 2 or my_data.shooting) then
+			if focus_enemy.hostage_blocked then
+				if data.important then
+					if data.char_tweak.chatter and data.char_tweak.chatter.ready then
+						managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "hostageblock")
+					end
+				end
+			
+				if data.brain:request_switch_to_safe_weapon(3) then
+					if my_data.shooting then
+						local new_action = {
+							body_part = 3,
+							type = "idle"
+						}
+
+						data.unit:brain():action_request(new_action)
+					end
+					
+					if my_data.firing then
+						data.unit:movement():set_allow_fire(false)
 
-				if walk_to_pos then
-					mvector3.direction(temp_vec1, data.m_pos, walk_to_pos)
-					mvector3.direction(temp_vec2, data.m_pos, focus_enemy.m_pos)
+						my_data.firing = nil
+					end
+					
+					return
+				end
+			elseif data.safe_equipped and data.brain:request_switch_to_normal_weapon(7) then
+				if my_data.shooting then
+					local new_action = {
+						body_part = 3,
+						type = "idle"
+					}
+
+					data.unit:brain():action_request(new_action)
+				end
+				
+				if my_data.firing then
+					data.unit:movement():set_allow_fire(false)
 
-					local dot = mvector3.dot(temp_vec1, temp_vec2)
+					my_data.firing = nil
+				end
+				
+				return
+			end
+		end
 
-					if dot < 0.6 then
-						shoot = false
-						aim = false
+		local try_stop_charge
+		
+		if focus_enemy.verified and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
+			my_data.charging = my_data.charging or my_data.flank_cover
+			
+			--stop the charge, we are not chargers we do not push unless nescessary
+			if my_data.charging and not data.unit:movement():chk_action_forbidden("walk") then
+				try_stop_charge = true
+				
+				if data.attention_obj.dis <= 200 or LIES.settings.enemy_aggro_level < 4 and (not data.tactics or not data.tactics.charge) and not data.unit:base():has_tag("tank") and not tankboss[data.unit:base()._tweak_table] then
+					local new_action = {
+						body_part = 2,
+						type = "idle"
+					}
+
+					if data.unit:brain():action_request(new_action) then
+						CopLogicAttack._cancel_charge(data, my_data)
+						my_data.at_cover_shoot_pos = true
+						try_stop_charge = nil
 					end
 				end
 			end
-
-			if aim == nil and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
-				if focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT then
-					local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"
-					local firing_range = 500
-
-					if data.internal_data.weapon_range then
-						firing_range = running and data.internal_data.weapon_range.close or data.internal_data.weapon_range.far
-					else
-						debug_pause_unit(data.unit, "[CopLogicAttack]: Unit doesn't have data.internal_data.weapon_range")
+			
+			my_data.cover_test_step = 0
+			my_data.flank_cover = nil
+		end
+		
+		local running = data.unit:anim_data().run or data.unit:anim_data().sprint
+		running = not data.unit:anim_data().run_stop and running or nil
+		
+		if not data.char_tweak.always_face_enemy and not focus_enemy.dangerous_special then
+			if my_data.low_value_att or running and not (data.tactics and data.tactics.sniper) then
+				walk_action = my_data.advancing 
+			
+				if walk_action and walk_action._init_called and walk_action._footstep_pos and walk_action._haste == "run" then --do this properly
+					walking = true
+					local pos_for_dir = walk_action._footstep_pos
+					walk_dir = pos_for_dir - data.m_pos
+					walk_dir = walk_dir:with_z(0):normalized()
+
+					mvec3_dir(temp_vec2, data.m_pos, enemy_m_pos)
+					mvec3_set_z(temp_vec2, 0)
+
+					local dot = mvec3_dot(walk_dir, temp_vec2)
+
+					if dot < 0.7 then
+						if try_stop_charge then
+							local new_action = {
+								body_part = 2,
+								type = "idle"
+							}
+
+							if data.unit:brain():action_request(new_action) then
+								CopLogicAttack._cancel_charge(data, my_data)
+								my_data.at_cover_shoot_pos = true
+								try_stop_charge = nil
+								walking = nil
+								running = nil
+							end
+						else
+							local can_turn_to_shoot = focus_enemy.dmg_t and data.t - focus_enemy.dmg_t < 5
+							can_turn_to_shoot = can_turn_to_shoot or focus_enemy.acquire_t and data.t - focus_enemy.acquire_t < 4 and focus_enemy.dis <= weapon_range.close
+							
+							if not can_turn_to_shoot then
+								shoot = false
+								aim = false
+							end
+						end
 					end
-
-					if last_sup_t and data.t - last_sup_t < 7 * (running and 0.3 or 1) * (focus_enemy.verified and 1 or focus_enemy.vis_ray and firing_range < focus_enemy.vis_ray.distance and 0.5 or 0.2) then
-						shoot = true
-					elseif focus_enemy.verified and data.internal_data.weapon_range and firing_range > focus_enemy.verified_dis then
-						shoot = true
-					elseif focus_enemy.verified and focus_enemy.criminal_record and focus_enemy.criminal_record.assault_t and data.t - focus_enemy.criminal_record.assault_t < 2 then
+				end
+			end
+		end
+		
+		
+		local firing_range = running and weapon_range.close or weapon_range.far
+		local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
+
+		if focus_enemy.verified or focus_enemy.nearly_visible or time_since_verification and time_since_verification <= 0.2 then
+			if aim == nil and AIAttentionObject.REACT_AIM <= focus_enemy.reaction then
+				if AIAttentionObject.REACT_SHOOT <= focus_enemy.reaction then
+					if AIAttentionObject.REACT_SHOOT == focus_enemy.reaction then
 						shoot = true
 					end
 
 					if not shoot and my_data.attitude == "engage" then
-						if focus_enemy.verified then
-							if firing_range > focus_enemy.verified_dis or focus_enemy.reaction == AIAttentionObject.REACT_SHOOT then
-								shoot = true
-							end
-						else
-							local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
+						shoot = true
+					end
 
-							if my_data.firing and time_since_verification and time_since_verification < 3.5 then
+					if not shoot then
+						if data.unit:base():has_tag("law") and not data.is_converted then
+							if focus_enemy.criminal_record then
+								if focus_enemy.aimed_at and not focus_enemy.hostage_blocked and not focus_enemy.busy then
+									shoot = true
+								elseif focus_enemy.dis < 1400 then
+									shoot = true
+								elseif focus_enemy.criminal_record.assault_t and data.t - focus_enemy.criminal_record.assault_t < 7 or data.name == "attack" then
+									shoot = true
+								else
+									aim = true
+								end
+							elseif enemy_dis < firing_range then
 								shoot = true
 							else
-								data.brain:search_for_path_to_unit("hunt" .. tostring(my_data.key), focus_enemy.unit)
+								aim = true
 							end
+						else
+							shoot = true
 						end
 					end
 
-					aim = aim or shoot
-
-					if not aim and firing_range > focus_enemy.verified_dis then
+					if shoot then
 						aim = true
 					end
 				else
 					aim = true
 				end
 			end
-		elseif focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
+		elseif AIAttentionObject.REACT_AIM <= focus_enemy.reaction then
 			local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
-			local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"
-			local same_z = math.abs(focus_enemy.verified_pos.z - data.m_pos.z) < 250
-
-			if running then
-				if time_since_verification and time_since_verification < math.lerp(5, 1, math.max(0, focus_enemy.verified_dis - 500) / 600) then
-					aim = true
+			local my_tracker = data.unit:movement():nav_tracker()
+			local my_seg = my_tracker:nav_segment()
+			local enemy_nav_seg = focus_enemy.nav_tracker and focus_enemy.nav_tracker:nav_segment()
+			
+			if time_since_verification and not focus_enemy.lost_track or my_seg == enemy_nav_seg then
+				if aim == nil and enemy_dis > 200 then
+					if running and not data.char_tweak.always_face_enemy then
+						if time_since_verification and time_since_verification < math.lerp(7, 1, math.max(0, enemy_dis - 500) / 600) then
+							aim = true
+						end
+					elseif time_since_verification and time_since_verification < 15 then
+						aim = true
+					end
 				end
-			else
-				aim = true
-			end
-
-			if aim and my_data.shooting and focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT and time_since_verification and time_since_verification < (running and 2 or 3) then
-				shoot = true
-			end
+				
+				if AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
+					if aim and not LIES.settings.highperformance then
+						local test_for_sight = not my_data.expected_pos_last_check_t
+						
+						if not test_for_sight then
+							local time_for_check = data.important and 0.2 or 1.5
+							test_for_sight = data.t - my_data.expected_pos_last_check_t > time_for_check
+						end
 
-			if not aim then
-				expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)
+						if test_for_sight and not my_data.advancing then
+							local head_pos = data.m_pos:with_z(data.unit:movement():m_head_pos().z)
+							local last_verified_pos = not focus_enemy.lost_track and focus_enemy.last_verified_pos or focus_enemy.verified_pos
+
+							if data.unit:raycast("ray", head_pos, last_verified_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
+								aim = nil
+								local vec_to_pos = temp_vec1
+								mvec3_dir(vec_to_pos, head_pos, last_verified_pos)
+								mvec3_set_len(vec_to_pos, 2000)
+								
+								local vis_positions = managers.navigation:find_walls_across_pos(last_verified_pos, vec_to_pos, 360, 9)
+								
+								mvec3_norm(vec_to_pos)
+								mvec3_set_z(vec_to_pos, 0)
+								
+								if vis_positions then
+									local raycast_f = data.unit.raycast
+									local nav_manager = managers.navigation
+									local pad_out_position_f = nav_manager.pad_out_position
+									local last_verified_m_pos = not focus_enemy.lost_track and focus_enemy.last_verified_m_pos or focus_enemy.verified_m_pos
+									local height = 140
+
+									local best_has_vis, best_dis_to_pos, best_pos, best_head_pos
+									
+									for _, vis_pos in ipairs(vis_positions) do
+										local check_position = pad_out_position_f(nav_manager, vis_pos[1], 4)
+										
+										mvec3_dir(temp_vec2, last_verified_m_pos, check_position)
+										local dis_sq = mvec3_dis_sq(last_verified_m_pos, check_position)
+										mvec3_set_z(temp_vec2, 0)
+										
+										local target_dot = mvec3_dot(vec_to_pos, temp_vec2)
+										
+										if target_dot >= 0.7 then
+											local check_pos_with_height = check_position:with_z(check_position.z + height)
+											local has_vis = not raycast_f(data.unit, "ray", head_pos, check_pos_with_height, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
+											
+											if not best_has_vis or has_vis then
+												local check_dis = mvec3_dis_sq(check_position, last_verified_m_pos)
+							
+												if not best_dis_to_pos or check_dis < best_dis_to_pos then
+													best_dis_to_pos = check_dis
+													best_has_vis = has_vis
+													best_head_pos = check_pos_with_height
+													best_pos = check_position
+												end
+											end
+										end
+									end
+									
+									if best_pos and best_head_pos and best_has_vis then
+										focus_enemy.last_verified_pos = best_head_pos
+										focus_enemy.last_verified_m_pos = best_pos
+										focus_enemy.last_verified_dis = mvec3_dis(data.m_pos, focus_enemy.last_verified_m_pos)
+										
+										if focus_enemy.last_verified_dis > 200 then
+											aim = true
+										end
+									end
+								end
+							end
+							
+							my_data.expected_pos_last_check_t = data.t
+						end
+					end
+				end
 
+				if aim and AIAttentionObject.REACT_SHOOT <= focus_enemy.reaction then
+					if AIAttentionObject.REACT_SHOOT == focus_enemy.reaction then
+						shoot = true
+					end
+					
+					if not shoot and data.tactics and data.tactics.provide_coverfire_LIES and time_since_verification and time_since_verification < 7 then
+						shoot = true
+					end
+				end				
+			elseif AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction and focus_enemy.nav_tracker and not LIES.settings.highperformance then
+				local raycast_f, head_pos
+				
+				local expected_path = my_data.expected_pos_path
+
+				if expected_path then
+					expected_pos = CopLogicAttack._get_expected_pos(data, my_data)
+				elseif my_data.expected_pos then
+					expected_pos = my_data.expected_pos
+				end
+				
+				local test_for_sight = not my_data.expected_pos_last_check_t
+	
+				if not test_for_sight then
+					local time_for_check = data.important and 0.2 or 1.5
+					test_for_sight = data.t - my_data.expected_pos_last_check_t > time_for_check
+				end
+				
+				if test_for_sight and expected_pos and not my_data.advancing then
+					raycast_f = data.unit.raycast
+					head_pos = data.m_pos:with_z(data.unit:movement():m_head_pos().z)
+					
+					if raycast_f(data.unit, "ray", head_pos, expected_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
+						expected_pos = nil
+						my_data.expected_pos = nil
+					end
+				end
+			
+				if not expected_pos and test_for_sight then					
+					if my_seg ~= enemy_nav_seg then
+						head_pos = head_pos or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
+						raycast_f = raycast_f or data.unit.raycast
+						local all_nav_segs = managers.navigation._nav_segments
+						local seg_pos = all_nav_segs[enemy_nav_seg].pos
+						
+						local height_preference = data.m_pos.z >= seg_pos.z
+						local try_watch_enemy_seg = height_preference or math.abs(data.m_pos.z - seg_pos.z) < 250 or focus_enemy.dis >= 2000
+						
+						if try_watch_enemy_seg then
+							local doors = managers.navigation:find_segment_doors(enemy_nav_seg)
+							
+							if #doors > 0 then
+								for i = 1, #doors do
+									local door = doors[i]
+									
+									if door.end_pos then
+										local test_pos = door.end_pos:with_z(door.end_pos.z + 140)
+										if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
+											expected_pos = test_pos
+											
+											break
+										end
+									elseif door.center then
+										local test_pos = door.center:with_z(door.center.z + 140)
+										if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
+											expected_pos = test_pos
+											
+											break
+										end
+									end
+								end
+							end
+						end
+						
+						if not expected_pos and not focus_enemy.nav_tracker:obstructed() and not my_tracker:obstructed() then
+							local expected_pos_func = CopLogicAttack._get_expected_pos
+							expected_pos = expected_pos_func(data, my_data)
+						end						
+					end
+					
+					my_data.expected_pos_last_check_t = data.t
+				end
+				
 				if expected_pos then
-					if running then
-						local watch_dir = temp_vec1
-
-						mvec3_set(watch_dir, expected_pos)
-						mvec3_sub(watch_dir, data.m_pos)
-						mvec3_set_z(watch_dir, 0)
-
-						local watch_pos_dis = mvec3_norm(watch_dir)
-						local walk_to_pos = data.unit:movement():get_walk_to_pos()
-						local walk_vec = temp_vec2
-
-						mvec3_set(walk_vec, walk_to_pos)
-						mvec3_sub(walk_vec, data.m_pos)
-						mvec3_set_z(walk_vec, 0)
-						mvec3_norm(walk_vec)
-
-						local watch_walk_dot = mvec3_dot(watch_dir, walk_vec)
+					my_data.expected_pos = expected_pos
+					head_pos = head_pos or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
+					enemy_dis = mvec3_dis(expected_pos, head_pos)
 
-						if watch_pos_dis < 500 or watch_pos_dis < 1000 and watch_walk_dot > 0.85 then
-							aim = true
-						end
-					else
+					if enemy_dis > 200 then
 						aim = true
+						shoot = nil
+						
+						if running and not (data.tactics and data.tactics.sniper) then
+							if walking then
+								mvec3_dir(temp_vec2, data.m_pos, expected_pos)
+								mvec3_set_z(temp_vec2, 0)
+
+								local dot = mvec3_dot(walk_dir, temp_vec2)
+
+								if dot < 0.7 then
+									aim = false
+								end
+							end
+						end
 					end
 				end
 			end
+		end
+
+		CopLogicAttack._chk_enrage(data, focus_enemy)
+	end
+	
+	if shoot and data.tactics and data.tactics.harass and data.char_tweak.chatter and data.char_tweak.chatter.clear and focus_enemy.verified then
+		if focus_enemy.is_local_player then
+			local cur_state = focus_enemy.unit:movement():current_state()
+			
+			if cur_state:_is_reloading() then
+				managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "calloutreload")
+			end
 		else
-			expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)
+			local focus_anim_data = focus_enemy.unit:anim_data()
 
-			if expected_pos then
-				aim = true
+			if focus_anim_data and focus_anim_data.reload then
+				managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "calloutreload")
 			end
 		end
 	end
-
-	if not aim and data.char_tweak.always_face_enemy and focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
+	
+	if shoot then
 		aim = true
 	end
 
-	if data.logic.chk_should_turn(data, my_data) and (focus_enemy or expected_pos) then
-		local enemy_pos = expected_pos or (focus_enemy.verified or focus_enemy.nearly_visible) and focus_enemy.m_pos or focus_enemy.verified_pos
-
-		CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)
-	end
-
 	if aim or shoot then
-		if expected_pos then
-			if my_data.attention_unit ~= expected_pos then
-				CopLogicBase._set_attention_on_pos(data, mvector3.copy(expected_pos))
-
-				my_data.attention_unit = mvector3.copy(expected_pos)
-			end
-		elseif focus_enemy.verified or focus_enemy.nearly_visible then
-			if my_data.attention_unit ~= focus_enemy.u_key then
+		local look_pos
+		
+		if focus_enemy.verified then		
+			if not my_data.attention_unit or my_data.attention_unit ~= focus_enemy.u_key then
 				CopLogicBase._set_attention(data, focus_enemy)
 
 				my_data.attention_unit = focus_enemy.u_key
 			end
-		else
-			local look_pos = focus_enemy.last_verified_pos or focus_enemy.verified_pos
+		elseif expected_pos then
+			my_data.expected_pos = expected_pos
+			look_pos = expected_pos
+			
+			if not my_data.attention_unit or my_data.attention_unit == focus_enemy.u_key or my_data.attention_unit ~= look_pos then
+				CopLogicBase._set_attention_on_pos(data, my_data.expected_pos)
+
+				my_data.attention_unit = my_data.expected_pos
+			end
+		elseif focus_enemy.last_verified_pos then
+			look_pos = focus_enemy.last_verified_pos
 
-			if my_data.attention_unit ~= look_pos then
-				CopLogicBase._set_attention_on_pos(data, mvector3.copy(look_pos))
+			if not my_data.attention_unit or my_data.attention_unit == focus_enemy.u_key or my_data.attention_unit ~= look_pos then
+				CopLogicBase._set_attention_on_pos(data, look_pos)
 
-				my_data.attention_unit = mvector3.copy(look_pos)
+				my_data.attention_unit = focus_enemy.last_verified_pos
 			end
+		elseif focus_enemy.last_expected then
+			look_pos = focus_enemy.last_expected
+
+			if not my_data.attention_unit or my_data.attention_unit == focus_enemy.u_key or my_data.attention_unit ~= look_pos then
+				CopLogicBase._set_attention_on_pos(data, look_pos)
+				
+				my_data.attention_unit = focus_enemy.last_expected
+			end
+		elseif my_data.attention_unit then
+			CopLogicBase._reset_attention(data)
+
+			my_data.attention_unit = nil
 		end
 
-		if not my_data.shooting and not my_data.spooc_attack and not data.unit:anim_data().reload and not data.unit:movement():chk_action_forbidden("action") then
+		if not my_data.shooting and not my_data.spooc_attack and not data.unit:movement():chk_action_forbidden("action") then
 			local shoot_action = {
 				body_part = 3,
 				type = "shoot"
 			}
 
-			if data.unit:brain():action_request(shoot_action) then
-				my_data.shooting = true
+			my_data.shooting = data.unit:brain():action_request(shoot_action)
+			
+			if my_data.shooting then
+				my_data.start_shoot_t = data.t
 			end
 		end
 	else
-		if my_data.shooting then
-			local new_action
-
-			if data.unit:anim_data().reload then
-				new_action = {
-					body_part = 3,
-					type = "reload"
-				}
-			else
-				new_action = {
-					body_part = 3,
-					type = "idle"
-				}
+		if not my_data.start_shoot_t or data.t - my_data.start_shoot_t > 0.5 then
+			if not data.unit:movement():chk_action_forbidden("action") and not data.unit:anim_data().reload and CopLogicAttack._check_needs_reload(data, my_data) then
+				if my_data.shooting then
+					local new_action = {
+						body_part = 3,
+						type = "idle"
+					}
+
+					data.unit:brain():action_request(new_action)
+				end
 			end
-
-			data.unit:brain():action_request(new_action)
 		end
-
+		
 		if my_data.attention_unit then
 			CopLogicBase._reset_attention(data)
 
 			my_data.attention_unit = nil
 		end
 	end
+	
+	if not my_data.advancing and CopLogicAttack.chk_should_turn(data, my_data) then
+		if my_data.attention_unit then
+			local turn_pos
+			
+			if my_data.attention_unit ~= focus_enemy.u_key then
+				turn_pos = my_data.attention_unit
+			else
+				turn_pos = focus_enemy.m_pos
+			end
+
+			CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, turn_pos)
+		end
+	end
+	
+	if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
+		if LIES.settings.enemy_reaction_level < 3 and not data.unit:in_slot(16) and not data.team.id == "criminal1" then
+			if not focus_enemy.react_t or not focus_enemy.verified_t or data.t - focus_enemy.verified_t > 2 then
+				focus_enemy.react_t = data.t
+			end
+		
+			local react_t = 2 / LIES.settings.enemy_reaction_level
+		
+			if data.t - focus_enemy.react_t < react_t then
+				shoot = nil
+			end
+		end
+	end
+	
+	if shoot and focus_enemy and not data.safe_equipped and not focus_enemy.hostage_blocked then
+		LIESBossLogicAttack._chk_use_throwable(data, my_data, focus_enemy)
+	end
 
 	CopLogicAttack.aim_allow_fire(shoot, aim, data, my_data)
 end
\ No newline at end of file
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -5,7 +5,7 @@ local shoot, aim, expected_pos
 		local last_sup_t = data.unit:character_damage():last_suppression_t()
 
 		if focus_enemy.verified or focus_enemy.nearly_visible then
-			if data.unit:anim_data().run and focus_enemy.dis > math.lerp(my_data.weapon_range.close, my_data.weapon_range.optimal, 0) then
+			if data.unit:anim_data().run and focus_enemy.dis > my_data.weapon_range.close then
 				local walk_to_pos = data.unit:movement():get_walk_to_pos()
 
 				if walk_to_pos then
@@ -28,8 +28,6 @@ local shoot, aim, expected_pos
 
 					if data.internal_data.weapon_range then
 						firing_range = running and data.internal_data.weapon_range.close or data.internal_data.weapon_range.far
-					else
-						debug_pause_unit(data.unit, "[CopLogicAttack]: Unit doesn't have data.internal_data.weapon_range")
 					end
 
 					if last_sup_t and data.t - last_sup_t < 7 * (running and 0.3 or 1) * (focus_enemy.verified and 1 or focus_enemy.vis_ray and firing_range < focus_enemy.vis_ray.distance and 0.5 or 0.2) then
@@ -68,7 +66,6 @@ local shoot, aim, expected_pos
 		elseif focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
 			local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
 			local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"
-			local same_z = math.abs(focus_enemy.verified_pos.z - data.m_pos.z) < 250
 
 			if running then
 				if time_since_verification and time_since_verification < math.lerp(5, 1, math.max(0, focus_enemy.verified_dis - 500) / 600) then
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

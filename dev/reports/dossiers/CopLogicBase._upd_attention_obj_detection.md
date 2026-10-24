# Function dossier: lua/coplogics/coplogicbase.lua :: CopLogicBase._upd_attention_obj_detection

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 512 lines, params `(data, min_reaction, max_reaction)`
- 246.1: 355 lines, params `(data, min_reaction, max_reaction)`
- 248.2: 359 lines, params `(data, min_reaction, max_reaction)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function CopLogicBase._upd_attention_obj_detection(data, min_reaction, max_reaction)
local t = data.t
	local detected_obj = data.detected_attention_objects
	local my_data = data.internal_data
	local my_key = data.key
	local my_pos = data.cool and data.unit:movement():m_head_pos() or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
	local my_access = data.SO_access
	local all_attention_objects = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str, data.team)
	local my_head_fwd = nil
	local my_tracker = data.unit:movement():nav_tracker()
	--local chk_vis_func = my_tracker.check_visibility
	local is_detection_persistent = managers.groupai:state():is_detection_persistent()
	local is_weapons_hot = managers.groupai:state():enemy_weapons_hot()
	local delay = managers.groupai:state():whisper_mode() and 0 or 2
	local hhtacs = LIES.settings.hhtacs
	local highperformance = LIES.settings.highperformance
	local should_quick_register = data.team.id == tweak_data.levels:get_default_team_ID("player") or data.team.foes[tweak_data.levels:get_default_team_ID("player")] or data.unit:in_slot(16) or data.team.friends[tweak_data.levels:get_default_team_ID("player")]
	local player_importance_wgt = data.unit:in_slot(managers.slot:get_mask("enemies")) and {}

	local function _angle_chk(attention_pos, dis, strictness)
		mvector3.direction(tmp_vec1, my_pos, attention_pos)

		my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()
		local angle = mvector3.angle(my_head_fwd, tmp_vec1)
		local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))

		if angle_max > angle * strictness then
			return true
		end
	end

	local function _angle_and_dis_chk(handler, settings, attention_pos)
		attention_pos = attention_pos or handler:get_detection_m_pos()

		local dis = mvector3.direction(tmp_vec1, my_pos, attention_pos)
		local dis_multiplier, angle_multiplier = nil
		local max_dis = math.min(my_data.detection.dis_max, settings.max_range or my_data.detection.dis_max)

		if settings.detection and settings.detection.range_mul then
			local range_mul = settings.detection.range_mul
			
			if hhtacs then
				range_mul = math.lerp(range_mul, 1, 0.75)
			end
			
			max_dis = max_dis * range_mul
		end

		dis_multiplier = dis / max_dis

		if settings.uncover_range and my_data.detection.use_uncover_range and dis < settings.uncover_range then
			return hhtacs and 0 or -1, hhtacs and dis_multiplier or 0
		end

		if dis_multiplier < 1 then
			if not is_weapons_hot and settings.notice_requires_FOV then
				my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()
				local angle = mvector3.angle(my_head_fwd, tmp_vec1)
				
				if hhtacs then
					if not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
						local att_unit = handler:unit()
						
						if att_unit:movement() then
							local att_unit_pos = att_unit:movement():m_pos()
							local uncover_dis = mvec3_dis(att_unit_pos, data.m_pos)
							
							if uncover_dis <= 90 then --*bump*
								return -1, 0
							end
						end
						
						if angle < 55 then
							return -1, 0
						end
					end
				elseif angle < 55 and not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
					return -1, 0
				end
				
				if hhtacs then
					angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp(dis / 200, 0, 1))	
				else
					angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))
				end
				
				angle_multiplier = angle / angle_max

				if angle_multiplier < 1 then
					return angle, dis_multiplier
				end
			else
				return 0, dis_multiplier
			end
		end
	end

	local function _nearly_visible_chk(attention_info, detect_pos)
		local near_pos = tmp_vec1

		mvec3_set(near_pos, detect_pos)

		local near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")

		if near_vis_ray then
			local side_vec = tmp_vec2

			mvec3_set(side_vec, my_pos)
			mvec3_sub(side_vec, detect_pos)
			mvector3.cross(side_vec, side_vec, math.UP)
			mvector3.set_length(side_vec, 30)
			mvec3_set(near_pos, detect_pos)
			mvector3.add(near_pos, side_vec)

			near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")

			if near_vis_ray then
				mvector3.multiply(side_vec, -2)
				mvector3.add(near_pos, side_vec)

				near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
				
				if near_vis_ray then
					mvec3_set(near_pos, detect_pos)
					mvector3.add(near_pos, math.UP * 30)
					
					near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
				end
			end
		end

		if not near_vis_ray then
			attention_info.nearly_visible = true
			attention_info.release_t = nil

			if attention_info.last_verified_pos then
				mvec3_set(attention_info.last_verified_pos, near_pos)
				attention_info.last_verified_m_pos = near_pos:with_z(attention_info.m_pos.z)
				attention_info.last_verified_dis = mvec3_dis(data.m_pos, attention_info.last_verified_m_pos)
			else
				attention_info.last_verified_pos = mvector3.copy(near_pos)
				attention_info.last_verified_m_pos = near_pos:with_z(attention_info.m_pos.z)
				attention_info.last_verified_dis = mvec3_dis(data.m_pos, attention_info.last_verified_m_pos)
			end
			
			attention_info.last_expected = nil
			attention_info.lost_track = nil
		end
	end

	local function _chk_record_acquired_attention_importance_wgt(attention_info)
		if not player_importance_wgt or not attention_info.is_human_player then
			return
		end

		local weight = mvector3.direction(tmp_vec1, attention_info.m_head_pos, my_pos)
		local e_fwd = attention_info.unit:movement():detect_look_dir()

		local dot = mvector3.dot(e_fwd, tmp_vec1)
		weight = weight * weight * (1 - dot)

		table.insert(player_importance_wgt, attention_info.u_key)
		table.insert(player_importance_wgt, weight)
	end

	local function _chk_record_attention_obj_importance_wgt(u_key, attention_info)
		if not player_importance_wgt then
			return
		end

		local is_human_player, is_local_player, is_husk_player = nil

		if attention_info.unit:base() then
			is_local_player = attention_info.unit:base().is_local_player
			is_husk_player = not is_local_player and attention_info.unit:base().is_husk_player
			is_human_player = is_local_player or is_husk_player
		end

		if not is_human_player then
			return
		end

		local weight = mvector3.direction(tmp_vec1, attention_info.handler:get_detection_m_pos(), my_pos)
		local e_fwd = nil

		if is_husk_player then
			e_fwd = attention_info.unit:movement():detect_look_dir()
		else
			e_fwd = attention_info.unit:movement():m_head_rot():y()
		end

		local dot = mvector3.dot(e_fwd, tmp_vec1)
		weight = weight * weight * (1 - dot)

		table.insert(player_importance_wgt, u_key)
		table.insert(player_importance_wgt, weight)
	end
	
	local blind_enemies = Global.blind_enemies
	
	for u_key, attention_info in pairs(all_attention_objects) do
		if blind_enemies then
			if detected_obj[u_key] then
				detected_obj[u_key] = nil
			end
		elseif u_key ~= my_key and not detected_obj[u_key] then
			local settings = attention_info.handler:get_attention(my_access, min_reaction, max_reaction, data.team)

			if settings then
				local acquired = nil
				local attention_pos = attention_info.handler:get_detection_m_pos()

				if is_detection_persistent and should_quick_register or _angle_and_dis_chk(attention_info.handler, settings, attention_pos) then
					local vis_ray = is_detection_persistent and nil or data.unit:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

					if is_detection_persistent or not vis_ray or vis_ray.unit:key() == u_key then
						acquired = true
						
						if is_weapons_hot then 
							detected_obj[u_key] = CopLogicBase.identify_attention_obj_instant(data, u_key)
						else
							detected_obj[u_key] = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, u_key, attention_info, settings)
						end
					end
				end

				if not acquired then
					_chk_record_attention_obj_importance_wgt(u_key, attention_info)
				end
			end
		end
	end

	for u_key, attention_info in pairs(detected_obj) do
		if blind_enemies then
			detected_obj[u_key] = nil
		elseif min_reaction and attention_info.reaction < min_reaction or max_reaction and attention_info.reaction > max_reaction then
			CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
		elseif t < attention_info.next_verify_t then
			if AIAttentionObject.REACT_SUSPICIOUS <= attention_info.reaction then
				delay = math.min(attention_info.next_verify_t - t, delay)
			end
		else
			attention_info.next_verify_t = t + (attention_info.identified and attention_info.verified and attention_info.settings.verification_interval or attention_info.settings.notice_interval or attention_info.settings.verification_interval)
			delay = math.min(delay, attention_info.settings.verification_interval)
			
			if not data.cool and is_weapons_hot then
				if not attention_info.identified then
					local noticable = nil
					attention_info.notice_progress = nil
					attention_info.prev_notice_chk_t = nil
					attention_info.identified = true
					attention_info.release_t = t + attention_info.settings.release_delay
					attention_info.identified_t = t
					noticable = true

					data.logic.on_attention_obj_identified(data, u_key, attention_info)

					if noticable ~= false and attention_info.settings.notice_clbk then
						attention_info.settings.notice_clbk(data.unit, noticable)
					end
				end
			elseif not attention_info.identified then
				local noticable = nil
				local angle, dis_multiplier = _angle_and_dis_chk(attention_info.handler, attention_info.settings)
				
				local attention_pos = attention_info.handler:get_detection_m_pos()
				
				if angle then
					local vis_ray = data.unit:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

					if not vis_ray or vis_ray.unit:key() == u_key then
						noticable = true
					end
				end

				local delta_prog = 0
				local dt = t - attention_info.prev_notice_chk_t
				
				attention_info.real_pos = mvector3.copy(attention_pos)

				if noticable then
					local attention_pos = attention_info.handler:get_detection_m_pos()
					attention_info.notice_t = t
					attention_info.notice_pos = mvector3.copy(attention_info.m_pos)
					attention_info.last_notice_pos = mvector3.copy(attention_pos)
					attention_info.noticed = true
				
					if angle == -1 then
						if attention_info.is_husk_player then
							local peer = managers.network:session():peer_by_unit(attention_info.unit)
							local latency = peer and Network:qos(peer:rpc()).ping or nil
							
							if latency then
								local ping = latency / 1000
								
								delta_prog = dt / ping + 0.02
							end	
						else
							delta_prog = 1
						end
					else
						local min_delay = attention_info.settings.delay_override and attention_info.settings.delay_override[1] or my_data.detection.delay[1]
						local max_delay = attention_info.settings.delay_override and attention_info.settings.delay_override[2] or my_data.detection.delay[2]
						local angle_mul_mod = 0.25 * math.min(angle / my_data.detection.angle_max, 1)
						local dis_mul_mod = 0.75 * dis_multiplier

						local notice_delay_mul = attention_info.settings.notice_delay_mul or 1

						if attention_info.settings.detection and attention_info.settings.detection.delay_mul then
							if hhtacs then
								local mul = attention_info.settings.detection.delay_mul
								mul = math.lerp(mul, 1, 0.75) --detection risk affects detection rate 75% less
								
								notice_delay_mul = notice_delay_mul * mul
							else
								notice_delay_mul = notice_delay_mul * attention_info.settings.detection.delay_mul
							end
						end

						local notice_delay_modified = math.lerp(min_delay * notice_delay_mul, max_delay, math.clamp(dis_mul_mod + angle_mul_mod, 0, 1))
						
						if attention_info.is_husk_player then
							local peer = managers.network:session():peer_by_unit(attention_info.unit)
							local latency = peer and Network:qos(peer:rpc()).ping or nil
							
							if latency then
								local ping = latency / 1000
								
								notice_delay_modified = notice_delay_modified + ping + 0.02
							end	
						end
							
						delta_prog = notice_delay_modified > 0 and dt / notice_delay_modified or 1
					end
				else
					attention_info.noticed = nil
					
					delta_prog = dt * -0.125
					
					local attention_pos = attention_info.handler:get_detection_m_pos()
					
					if attention_info.last_notice_pos then
						local lerp = math.clamp(mvector3.distance(attention_pos, attention_info.last_notice_pos) / 400)
						
						if attention_info.notice_t and data.t - attention_info.notice_t < math.lerp(2, 0.2, lerp) then					
							attention_info.notice_pos = mvector3.copy(attention_info.m_pos)
						end
					end
				end

				attention_info.notice_progress = math.clamp(attention_info.notice_progress + delta_prog, 0, 1)

				if attention_info.notice_progress == 1 then
					attention_info.notice_progress = nil
					attention_info.prev_notice_chk_t = nil
					attention_info.identified = true
					attention_info.release_t = t + attention_info.settings.release_delay
					attention_info.identified_t = t
					noticable = true

					data.logic.on_attention_obj_identified(data, u_key, attention_info)
				elseif attention_info.notice_progress == 0 and not attention_info.being_chased and (not hhtacs or not attention_info.notice_t or not attention_info.detected_criminal or attention_info.detected_criminal and t - attention_info.notice_t > 2) then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)

					noticable = false
				else
					noticable = math.clamp(attention_info.notice_progress, 0.01, 1)
					attention_info.prev_notice_chk_t = t

					if data.cool and AIAttentionObject.REACT_SCARED <= attention_info.settings.reaction then
						managers.groupai:state():on_criminal_suspicion_progress(attention_info.unit, data.unit, noticable)
					end
				end

				if noticable ~= false and attention_info.settings.notice_clbk then
					attention_info.settings.notice_clbk(data.unit, noticable)
				end
			end

			if attention_info.identified then
				delay = math.min(delay, attention_info.settings.verification_interval)
				attention_info.nearly_visible = nil
				local verified, vis_ray = nil
				local attention_pos = attention_info.handler:get_detection_m_pos()
				local dis = mvector3.distance(data.m_pos, attention_info.m_pos)

				if dis < my_data.detection.dis_max * 1.2 and (not attention_info.settings.max_range or dis < attention_info.settings.max_range * (attention_info.settings.detection and attention_info.settings.detection.range_mul or 1) * 1.2) then
					local detect_pos = attention_pos
					local lost_track = attention_info.lost_track and not highperformance or not attention_info.verified_t
					
					if data.unit:anim_data().hide or data.unit:anim_data().hide_loop or data.unit:anim_data().needs_idle and (data.unit:base():has_tag("spooc") or data.unit:base()._tweak_table == "shadow_spooc") then
						lost_track = nil
					end
					
					local fov_not_required = not attention_info.settings.notice_requires_FOV or data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask)
					
					local in_FOV = not lost_track and fov_not_required
					in_FOV = in_FOV or _angle_chk(attention_pos, dis, 0.8)
					
					if in_FOV then
						vis_ray = data.unit:raycast("ray", my_pos, detect_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

						if not vis_ray or vis_ray.unit:key() == u_key then
							verified = true
						end
					end

					attention_info.verified = verified
				end

				attention_info.dis = dis
				attention_info.vis_ray = vis_ray and vis_ray.dis or nil
				local is_ignored = false

				if attention_info.unit:movement() and attention_info.unit:movement().is_cuffed then
					is_ignored = attention_info.unit:movement():is_cuffed()
				end

				if is_ignored then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
				elseif verified then
					attention_info.release_t = nil
					
					if not attention_info.verified_t or attention_info.lost_track then
						data.logic.on_attention_obj_verified(data, u_key, attention_info)
					end
					
					attention_info.verified_t = t

					mvector3.set(attention_info.verified_pos, attention_pos)
					attention_info.verified_m_pos = mvector3.copy(attention_info.m_pos)
					attention_info.verified_dis = dis
					
					attention_info.last_verified_pos = mvector3.copy(attention_pos)
					attention_info.last_verified_m_pos = mvector3.copy(attention_info.m_pos)
					attention_info.last_verified_dis = dis
					attention_info.last_expected = nil
					attention_info.lost_track = nil
				elseif data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) then
					local destroyed
					
					if attention_info.criminal_record and AIAttentionObject.REACT_COMBAT <= attention_info.settings.reaction then
						if data.logic._keep_player_focus_t and attention_info.is_human_player and attention_info.verified_t and data.t - attention_info.verified_t < data.logic._keep_player_focus_t then
							delay = math.min(0.2, delay)
							attention_info.verified_pos = attention_info.criminal_record.pos:with_z(attention_info.criminal_record.pos.z + math.abs(attention_pos.z - attention_info.m_pos.z))
							attention_info.verified_m_pos = mvector3.copy(attention_info.criminal_record.pos)
							attention_info.verified_dis = dis

							if not attention_info.lost_track and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) and attention_info.dis < 2000 then
								_nearly_visible_chk(attention_info, attention_pos)
							end
						elseif not is_detection_persistent and mvector3.distance(attention_info.m_pos, attention_info.criminal_record.pos) > 700 then
							destroyed = true
							CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
						else
							delay = math.min(0.2, delay)
							attention_info.verified_pos = attention_info.criminal_record.pos:with_z(attention_info.criminal_record.pos.z + math.abs(attention_pos.z - attention_info.m_pos.z))
							attention_info.verified_m_pos = mvector3.copy(attention_info.criminal_record.pos)
							attention_info.verified_dis = dis

							if not attention_info.lost_track and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) and attention_info.dis < 2000 then
								_nearly_visible_chk(attention_info, attention_pos)
							end
						end
					elseif is_detection_persistent and AIAttentionObject.REACT_COMBAT <= attention_info.settings.reaction then
						delay = math.min(0.2, delay)
						mvector3.set(attention_info.verified_pos, attention_pos)
						attention_info.verified_m_pos = mvector3.copy(attention_info.m_pos)
						attention_info.verified_dis = dis
						
						if not attention_info.lost_track and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) and attention_info.dis < 2000 then
							_nearly_visible_chk(attention_info, attention_pos)
						end
					elseif attention_info.verified_m_pos and mvector3.distance(attention_info.m_pos, attention_info.verified_m_pos) > 700 then
						destroyed = true
						CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
					elseif attention_info.release_t and attention_info.release_t < t then
						destroyed = true
						CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
					else
						attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
					end
					
					if not destroyed and AIAttentionObject.REACT_COMBAT <= attention_info.settings.reaction then
						if not highperformance and not attention_info.lost_track and not attention_info.nearly_visible then
							do
								if attention_info.last_expected and not data.unit:raycast("ray", my_pos, attention_info.last_expected, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision") then
									attention_info.lost_track = true
								elseif not attention_info.last_expected then
									attention_info.last_expected = mvector3.copy(attention_pos)
								end
							end
						end
					end
				elseif attention_info.release_t and attention_info.release_t < t then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
				else
					attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
				end
			end
		end

		_chk_record_acquired_attention_importance_wgt(attention_info)
	end

	if player_importance_wgt then
		managers.groupai:state():set_importance_weight(data.key, player_importance_wgt)
	end

	return delay
end
```

## 246.1 vanilla (a3180fc)

```lua
function CopLogicBase._upd_attention_obj_detection(data, min_reaction, max_reaction)
local t = data.t
	local detected_obj = data.detected_attention_objects
	local my_data = data.internal_data
	local my_key = data.key
	local my_pos = data.unit:movement():m_head_pos()
	local my_access = data.SO_access
	local all_attention_objects = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str, data.team)
	local my_head_fwd
	local my_tracker = data.unit:movement():nav_tracker()
	local chk_vis_func = my_tracker.check_visibility
	local is_detection_persistent = managers.groupai:state():is_detection_persistent()
	local delay = 2
	local player_importance_wgt = data.unit:in_slot(managers.slot:get_mask("enemies")) and {}

	local function _angle_chk(attention_pos, dis, strictness)
		mvector3.direction(tmp_vec1, my_pos, attention_pos)

		my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()

		local angle = mvector3.angle(my_head_fwd, tmp_vec1)
		local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))

		if angle_max > angle * strictness then
			return true
		end
	end

	local function _angle_and_dis_chk(handler, settings, attention_pos)
		attention_pos = attention_pos or handler:get_detection_m_pos()

		local dis = mvector3.direction(tmp_vec1, my_pos, attention_pos)
		local dis_multiplier, angle_multiplier
		local max_dis = math.min(my_data.detection.dis_max, settings.max_range or my_data.detection.dis_max)

		if settings.detection and settings.detection.range_mul then
			max_dis = max_dis * settings.detection.range_mul
		end

		dis_multiplier = dis / max_dis

		if settings.uncover_range and my_data.detection.use_uncover_range and dis < settings.uncover_range then
			return -1, 0
		end

		if dis_multiplier < 1 then
			if settings.notice_requires_FOV then
				my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()

				local angle = mvector3.angle(my_head_fwd, tmp_vec1)

				if angle < 55 and not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
					return -1, 0
				end

				local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))

				angle_multiplier = angle / angle_max

				if angle_multiplier < 1 then
					return angle, dis_multiplier
				end
			else
				return 0, dis_multiplier
			end
		end
	end

	local function _nearly_visible_chk(attention_info, detect_pos)
		local near_pos = tmp_vec1

		if attention_info.verified_dis < 2000 and math.abs(detect_pos.z - my_pos.z) < 300 then
			mvec3_set(near_pos, detect_pos)
			mvec3_set_z(near_pos, near_pos.z + 100)

			local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")

			if near_vis_ray then
				local side_vec = tmp_vec1

				mvec3_set(side_vec, detect_pos)
				mvec3_sub(side_vec, my_pos)
				mvector3.cross(side_vec, side_vec, math.UP)
				mvector3.set_length(side_vec, 150)
				mvector3.set(near_pos, detect_pos)
				mvector3.add(near_pos, side_vec)

				local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")

				if near_vis_ray then
					mvector3.multiply(side_vec, -2)
					mvector3.add(near_pos, side_vec)

					near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
				end
			end

			if not near_vis_ray then
				attention_info.nearly_visible = true
				attention_info.last_verified_pos = mvector3.copy(near_pos)
			end
		end
	end

	local function _chk_record_acquired_attention_importance_wgt(attention_info)
		if not player_importance_wgt or not attention_info.is_human_player then
			return
		end

		local weight = mvector3.direction(tmp_vec1, attention_info.m_head_pos, my_pos)
		local e_fwd = attention_info.unit:movement():detect_look_dir()
		local dot = mvector3.dot(e_fwd, tmp_vec1)

		weight = weight * weight * (1 - dot)

		table.insert(player_importance_wgt, attention_info.u_key)
		table.insert(player_importance_wgt, weight)
	end

	local function _chk_record_attention_obj_importance_wgt(u_key, attention_info)
		if not player_importance_wgt then
			return
		end

		local is_human_player, is_local_player, is_husk_player

		if attention_info.unit:base() then
			is_local_player = attention_info.unit:base().is_local_player
			is_husk_player = not is_local_player and attention_info.unit:base().is_husk_player
			is_human_player = is_local_player or is_husk_player
		end

		if not is_human_player then
			return
		end

		local weight = mvector3.direction(tmp_vec1, attention_info.handler:get_detection_m_pos(), my_pos)
		local e_fwd = attention_info.unit:movement():detect_look_dir()
		local dot = mvector3.dot(e_fwd, tmp_vec1)

		weight = weight * weight * (1 - dot)

		table.insert(player_importance_wgt, u_key)
		table.insert(player_importance_wgt, weight)
	end

	for u_key, attention_info in pairs(all_attention_objects) do
		if u_key ~= my_key and not detected_obj[u_key] and (not attention_info.nav_tracker or chk_vis_func(my_tracker, attention_info.nav_tracker)) then
			local settings = attention_info.handler:get_attention(my_access, min_reaction, max_reaction, data.team)

			if settings then
				local acquired
				local attention_pos = attention_info.handler:get_detection_m_pos()

				if _angle_and_dis_chk(attention_info.handler, settings, attention_pos) then
					local vis_ray = World:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

					if not vis_ray or vis_ray.unit:key() == u_key then
						acquired = true
						detected_obj[u_key] = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, u_key, attention_info, settings)
					end
				end

				if not acquired then
					_chk_record_attention_obj_importance_wgt(u_key, attention_info)
				end
			end
		end
	end

	for u_key, attention_info in pairs(detected_obj) do
		if t < attention_info.next_verify_t then
			if attention_info.reaction >= AIAttentionObject.REACT_SUSPICIOUS then
				delay = math.min(attention_info.next_verify_t - t, delay)
			end
		else
			attention_info.next_verify_t = t + (attention_info.identified and attention_info.verified and attention_info.settings.verification_interval or attention_info.settings.notice_interval or attention_info.settings.verification_interval)
			delay = math.min(delay, attention_info.settings.verification_interval)

			if not attention_info.identified then
				local noticable
				local angle, dis_multiplier = _angle_and_dis_chk(attention_info.handler, attention_info.settings)

				if angle then
					local attention_pos = attention_info.handler:get_detection_m_pos()
					local vis_ray = World:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

					if not vis_ray or vis_ray.unit:key() == u_key then
						noticable = true
					end
				end

				local delta_prog
				local dt = t - attention_info.prev_notice_chk_t

				if noticable then
					if angle == -1 then
						if attention_info.is_husk_player then
							local peer = managers.network:session():peer_by_unit(attention_info.unit)
							local latency = peer and Network:qos(peer:rpc()).ping or nil

							if latency then
								delta_prog = dt / (latency / 1000) + 0.02
							else
								delta_prog = 0
							end
						else
							delta_prog = 1
						end
					else
						local min_delay = my_data.detection.delay[1]
						local max_delay = my_data.detection.delay[2]
						local angle_mul_mod = 0.25 * math.min(angle / my_data.detection.angle_max, 1)
						local dis_mul_mod = 0.75 * dis_multiplier
						local notice_delay_mul = attention_info.settings.notice_delay_mul or 1

						if attention_info.settings.detection and attention_info.settings.detection.delay_mul then
							notice_delay_mul = notice_delay_mul * attention_info.settings.detection.delay_mul
						end

						local notice_delay_modified = math.lerp(min_delay * notice_delay_mul, max_delay, dis_mul_mod + angle_mul_mod)

						if attention_info.is_husk_player then
							local peer = managers.network:session():peer_by_unit(attention_info.unit)
							local latency = peer and Network:qos(peer:rpc()).ping or nil

							if latency then
								notice_delay_modified = notice_delay_modified + latency / 1000 + 0.02
							else
								delta_prog = 0
							end
						end

						delta_prog = delta_prog or notice_delay_modified > 0 and dt / notice_delay_modified or 1
					end
				else
					delta_prog = dt * -0.125
				end

				attention_info.notice_progress = attention_info.notice_progress + delta_prog

				if attention_info.notice_progress > 1 then
					attention_info.notice_progress = nil
					attention_info.prev_notice_chk_t = nil
					attention_info.identified = true
					attention_info.release_t = t + attention_info.settings.release_delay
					attention_info.identified_t = t
					noticable = true

					data.logic.on_attention_obj_identified(data, u_key, attention_info)
				elseif attention_info.notice_progress < 0 then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)

					noticable = false
				else
					noticable = attention_info.notice_progress
					attention_info.prev_notice_chk_t = t

					if data.cool and attention_info.settings.reaction >= AIAttentionObject.REACT_SCARED then
						managers.groupai:state():on_criminal_suspicion_progress(attention_info.unit, data.unit, noticable)
					end
				end

				if noticable ~= false and attention_info.settings.notice_clbk then
					attention_info.settings.notice_clbk(data.unit, noticable)
				end
			end

			if attention_info.identified then
				delay = math.min(delay, attention_info.settings.verification_interval)
				attention_info.nearly_visible = nil

				local verified, vis_ray
				local attention_pos = attention_info.handler:get_detection_m_pos()
				local dis = mvector3.distance(data.m_pos, attention_info.m_pos)

				if dis < my_data.detection.dis_max * 1.2 and (not attention_info.settings.max_range or dis < attention_info.settings.max_range * (attention_info.settings.detection and attention_info.settings.detection.range_mul or 1) * 1.2) then
					local detect_pos

					if attention_info.is_husk_player and attention_info.unit:anim_data().crouch then
						detect_pos = tmp_vec1

						mvector3.set(detect_pos, attention_info.m_pos)
						mvector3.add(detect_pos, tweak_data.player.stances.default.crouched.head.translation)
					else
						detect_pos = attention_pos
					end

					local in_FOV = not attention_info.settings.notice_requires_FOV or data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) or _angle_chk(attention_pos, dis, 0.8)

					if in_FOV then
						vis_ray = World:raycast("ray", my_pos, detect_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

						if not vis_ray or vis_ray.unit:key() == u_key then
							verified = true
						end
					end

					attention_info.verified = verified
				end

				attention_info.dis = dis
				attention_info.vis_ray = vis_ray and vis_ray.dis or nil

				local is_ignored = false

				if attention_info.unit:movement() and attention_info.unit:movement().is_cuffed then
					is_ignored = attention_info.unit:movement():is_cuffed()
				end

				if is_ignored then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
				elseif verified then
					attention_info.release_t = nil
					attention_info.verified_t = t

					mvector3.set(attention_info.verified_pos, attention_pos)

					attention_info.last_verified_pos = mvector3.copy(attention_pos)
					attention_info.verified_dis = dis
				elseif data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) then
					if attention_info.criminal_record and attention_info.settings.reaction >= AIAttentionObject.REACT_COMBAT then
						if not is_detection_persistent and mvector3.distance(attention_pos, attention_info.criminal_record.pos) > 700 then
							CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
						else
							delay = math.min(0.2, delay)
							attention_info.verified_pos = mvector3.copy(attention_info.criminal_record.pos)
							attention_info.verified_dis = dis

							if vis_ray and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) then
								_nearly_visible_chk(attention_info, attention_pos)
							end
						end
					elseif attention_info.release_t and t > attention_info.release_t then
						CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
					else
						attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
					end
				elseif attention_info.release_t and t > attention_info.release_t then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
				else
					attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
				end
			end
		end

		_chk_record_acquired_attention_importance_wgt(attention_info)
	end

	if player_importance_wgt then
		managers.groupai:state():set_importance_weight(data.key, player_importance_wgt)
	end

	return delay
end
```

## 248.2 vanilla (e3a8b616)

```lua
function CopLogicBase._upd_attention_obj_detection(data, min_reaction, max_reaction)
local t = data.t
	local detected_obj = data.detected_attention_objects
	local my_data = data.internal_data
	local my_key = data.key
	local my_pos = data.unit:movement():m_head_pos()
	local my_access = data.SO_access
	local all_attention_objects = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str, data.team)
	local my_head_fwd
	local my_tracker = data.unit:movement():nav_tracker()
	local chk_vis_func = my_tracker.check_visibility
	local is_detection_persistent = managers.groupai:state():is_detection_persistent()
	local delay = 2
	local player_importance_wgt = data.unit:in_slot(managers.slot:get_mask("enemies")) and {}

	local function _angle_chk(attention_pos, dis, strictness)
		mvector3.direction(tmp_vec1, my_pos, attention_pos)

		my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()

		local angle = mvector3.angle(my_head_fwd, tmp_vec1)
		local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))

		if angle_max > angle * strictness then
			return true
		end
	end

	local function _angle_and_dis_chk(handler, settings, attention_pos)
		attention_pos = attention_pos or handler:get_detection_m_pos()

		local dis = mvector3.direction(tmp_vec1, my_pos, attention_pos)
		local dis_multiplier, angle_multiplier
		local max_dis = math.min(my_data.detection.dis_max, settings.max_range or my_data.detection.dis_max)

		if settings.detection and settings.detection.range_mul then
			max_dis = max_dis * settings.detection.range_mul
		end

		dis_multiplier = dis / max_dis

		if settings.uncover_range and my_data.detection.use_uncover_range and dis < settings.uncover_range then
			return -1, 0
		end

		if dis_multiplier < 1 then
			if settings.notice_requires_FOV then
				my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()

				local angle = mvector3.angle(my_head_fwd, tmp_vec1)

				if angle < 55 and not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
					return -1, 0
				end

				local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))

				angle_multiplier = angle / angle_max

				if angle_multiplier < 1 then
					return angle, dis_multiplier
				end
			else
				return 0, dis_multiplier
			end
		end
	end

	local function _nearly_visible_chk(attention_info, detect_pos)
		local near_pos = tmp_vec1
		local MAX_DISTANCE = 2000

		if MAX_DISTANCE > attention_info.verified_dis and math.abs(detect_pos.z - my_pos.z) < 300 then
			mvec3_set(near_pos, detect_pos)

			local height_over_target = math.lerp(100, 10, math.max(attention_info.verified_dis / MAX_DISTANCE))

			mvec3_set_z(near_pos, near_pos.z + height_over_target)

			local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")

			if near_vis_ray then
				local side_vec = tmp_vec1

				mvec3_set(side_vec, detect_pos)
				mvec3_sub(side_vec, my_pos)
				mvector3.cross(side_vec, side_vec, math.UP)
				mvector3.set_length(side_vec, 150)
				mvector3.set(near_pos, detect_pos)
				mvector3.add(near_pos, side_vec)

				local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")

				if near_vis_ray then
					mvector3.multiply(side_vec, -2)
					mvector3.add(near_pos, side_vec)

					near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
				end
			end

			if not near_vis_ray then
				attention_info.nearly_visible = true
				attention_info.last_verified_pos = mvector3.copy(near_pos)
			end
		end
	end

	local function _chk_record_acquired_attention_importance_wgt(attention_info)
		if not player_importance_wgt or not attention_info.is_human_player then
			return
		end

		local weight = mvector3.direction(tmp_vec1, attention_info.m_head_pos, my_pos)
		local e_fwd = attention_info.unit:movement():detect_look_dir()
		local dot = mvector3.dot(e_fwd, tmp_vec1)

		weight = weight * weight * (1 - dot)

		table.insert(player_importance_wgt, attention_info.u_key)
		table.insert(player_importance_wgt, weight)
	end

	local function _chk_record_attention_obj_importance_wgt(u_key, attention_info)
		if not player_importance_wgt then
			return
		end

		local is_human_player, is_local_player, is_husk_player

		if attention_info.unit:base() then
			is_local_player = attention_info.unit:base().is_local_player
			is_husk_player = not is_local_player and attention_info.unit:base().is_husk_player
			is_human_player = is_local_player or is_husk_player
		end

		if not is_human_player then
			return
		end

		local weight = mvector3.direction(tmp_vec1, attention_info.handler:get_detection_m_pos(), my_pos)
		local e_fwd = attention_info.unit:movement():detect_look_dir()
		local dot = mvector3.dot(e_fwd, tmp_vec1)

		weight = weight * weight * (1 - dot)

		table.insert(player_importance_wgt, u_key)
		table.insert(player_importance_wgt, weight)
	end

	for u_key, attention_info in pairs(all_attention_objects) do
		if u_key ~= my_key and not detected_obj[u_key] and (not attention_info.nav_tracker or chk_vis_func(my_tracker, attention_info.nav_tracker)) then
			local settings = attention_info.handler:get_attention(my_access, min_reaction, max_reaction, data.team)

			if settings then
				local acquired
				local attention_pos = attention_info.handler:get_detection_m_pos()

				if _angle_and_dis_chk(attention_info.handler, settings, attention_pos) then
					local vis_ray = World:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

					if not vis_ray or vis_ray.unit:key() == u_key then
						acquired = true
						detected_obj[u_key] = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, u_key, attention_info, settings)
					end
				end

				if not acquired then
					_chk_record_attention_obj_importance_wgt(u_key, attention_info)
				end
			end
		end
	end

	for u_key, attention_info in pairs(detected_obj) do
		if t < attention_info.next_verify_t then
			if attention_info.reaction >= AIAttentionObject.REACT_SUSPICIOUS then
				delay = math.min(attention_info.next_verify_t - t, delay)
			end
		else
			attention_info.next_verify_t = t + (attention_info.identified and attention_info.verified and attention_info.settings.verification_interval or attention_info.settings.notice_interval or attention_info.settings.verification_interval)
			delay = math.min(delay, attention_info.settings.verification_interval)

			if not attention_info.identified then
				local noticable
				local angle, dis_multiplier = _angle_and_dis_chk(attention_info.handler, attention_info.settings)

				if angle then
					local attention_pos = attention_info.handler:get_detection_m_pos()
					local vis_ray = World:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

					if not vis_ray or vis_ray.unit:key() == u_key then
						noticable = true
					end
				end

				local delta_prog
				local dt = t - attention_info.prev_notice_chk_t

				if noticable then
					if angle == -1 then
						if attention_info.is_husk_player then
							local peer = managers.network:session():peer_by_unit(attention_info.unit)
							local latency = peer and Network:qos(peer:rpc()).ping or nil

							if latency then
								delta_prog = dt / (latency / 1000) + 0.02
							else
								delta_prog = 0
							end
						else
							delta_prog = 1
						end
					else
						local min_delay = my_data.detection.delay[1]
						local max_delay = my_data.detection.delay[2]
						local angle_mul_mod = 0.25 * math.min(angle / my_data.detection.angle_max, 1)
						local dis_mul_mod = 0.75 * dis_multiplier
						local notice_delay_mul = attention_info.settings.notice_delay_mul or 1

						if attention_info.settings.detection and attention_info.settings.detection.delay_mul then
							notice_delay_mul = notice_delay_mul * attention_info.settings.detection.delay_mul
						end

						local notice_delay_modified = math.lerp(min_delay * notice_delay_mul, max_delay, dis_mul_mod + angle_mul_mod)

						if attention_info.is_husk_player then
							local peer = managers.network:session():peer_by_unit(attention_info.unit)
							local latency = peer and Network:qos(peer:rpc()).ping or nil

							if latency then
								notice_delay_modified = notice_delay_modified + latency / 1000 + 0.02
							else
								delta_prog = 0
							end
						end

						delta_prog = delta_prog or notice_delay_modified > 0 and dt / notice_delay_modified or 1
					end
				else
					delta_prog = dt * -0.125
				end

				attention_info.notice_progress = attention_info.notice_progress + delta_prog

				if attention_info.notice_progress > 1 then
					attention_info.notice_progress = nil
					attention_info.prev_notice_chk_t = nil
					attention_info.identified = true
					attention_info.release_t = t + attention_info.settings.release_delay
					attention_info.identified_t = t
					noticable = true

					data.logic.on_attention_obj_identified(data, u_key, attention_info)
				elseif attention_info.notice_progress < 0 then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)

					noticable = false
				else
					noticable = attention_info.notice_progress
					attention_info.prev_notice_chk_t = t

					if data.cool and attention_info.settings.reaction >= AIAttentionObject.REACT_SCARED then
						managers.groupai:state():on_criminal_suspicion_progress(attention_info.unit, data.unit, noticable)
					end
				end

				if noticable ~= false and attention_info.settings.notice_clbk then
					attention_info.settings.notice_clbk(data.unit, noticable)
				end
			end

			if attention_info.identified then
				delay = math.min(delay, attention_info.settings.verification_interval)
				attention_info.nearly_visible = nil

				local verified, vis_ray
				local attention_pos = attention_info.handler:get_detection_m_pos()
				local dis = mvector3.distance(data.m_pos, attention_info.m_pos)

				if dis < my_data.detection.dis_max * 1.2 and (not attention_info.settings.max_range or dis < attention_info.settings.max_range * (attention_info.settings.detection and attention_info.settings.detection.range_mul or 1) * 1.2) then
					local detect_pos

					if attention_info.is_husk_player and attention_info.unit:anim_data().crouch then
						detect_pos = tmp_vec1

						mvector3.set(detect_pos, attention_info.m_pos)
						mvector3.add(detect_pos, tweak_data.player.stances.default.crouched.head.translation)
					else
						detect_pos = attention_pos
					end

					local in_FOV = not attention_info.settings.notice_requires_FOV or data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) or _angle_chk(attention_pos, dis, 0.8)

					if in_FOV then
						vis_ray = World:raycast("ray", my_pos, detect_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

						if not vis_ray or vis_ray.unit:key() == u_key then
							verified = true
						end
					end

					attention_info.verified = verified
				end

				attention_info.dis = dis
				attention_info.vis_ray = vis_ray and vis_ray.dis or nil

				local is_ignored = false

				if attention_info.unit:movement() and attention_info.unit:movement().is_cuffed then
					is_ignored = attention_info.unit:movement():is_cuffed()
				end

				if is_ignored then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
				elseif verified then
					attention_info.release_t = nil
					attention_info.verified_t = t

					mvector3.set(attention_info.verified_pos, attention_pos)

					attention_info.last_verified_pos = mvector3.copy(attention_pos)
					attention_info.verified_dis = dis
				elseif data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) then
					if attention_info.criminal_record and attention_info.settings.reaction >= AIAttentionObject.REACT_COMBAT then
						if not is_detection_persistent and mvector3.distance(attention_pos, attention_info.criminal_record.pos) > 700 then
							CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
						else
							delay = math.min(0.2, delay)
							attention_info.verified_pos = mvector3.copy(attention_info.criminal_record.pos)
							attention_info.verified_dis = dis

							if vis_ray and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) then
								_nearly_visible_chk(attention_info, attention_pos)
							end
						end
					elseif attention_info.release_t and t > attention_info.release_t then
						CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
					else
						attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
					end
				elseif attention_info.release_t and t > attention_info.release_t then
					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
				else
					attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
				end
			end
		end

		_chk_record_acquired_attention_importance_wgt(attention_info)
	end

	if player_importance_wgt then
		managers.groupai:state():set_importance_weight(data.key, player_importance_wgt)
	end

	return delay
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -2,21 +2,24 @@ local t = data.t
 	local detected_obj = data.detected_attention_objects
 	local my_data = data.internal_data
 	local my_key = data.key
-	local my_pos = data.unit:movement():m_head_pos()
+	local my_pos = data.cool and data.unit:movement():m_head_pos() or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
 	local my_access = data.SO_access
 	local all_attention_objects = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str, data.team)
-	local my_head_fwd
+	local my_head_fwd = nil
 	local my_tracker = data.unit:movement():nav_tracker()
-	local chk_vis_func = my_tracker.check_visibility
+	--local chk_vis_func = my_tracker.check_visibility
 	local is_detection_persistent = managers.groupai:state():is_detection_persistent()
-	local delay = 2
+	local is_weapons_hot = managers.groupai:state():enemy_weapons_hot()
+	local delay = managers.groupai:state():whisper_mode() and 0 or 2
+	local hhtacs = LIES.settings.hhtacs
+	local highperformance = LIES.settings.highperformance
+	local should_quick_register = data.team.id == tweak_data.levels:get_default_team_ID("player") or data.team.foes[tweak_data.levels:get_default_team_ID("player")] or data.unit:in_slot(16) or data.team.friends[tweak_data.levels:get_default_team_ID("player")]
 	local player_importance_wgt = data.unit:in_slot(managers.slot:get_mask("enemies")) and {}
 
 	local function _angle_chk(attention_pos, dis, strictness)
 		mvector3.direction(tmp_vec1, my_pos, attention_pos)
 
 		my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()
-
 		local angle = mvector3.angle(my_head_fwd, tmp_vec1)
 		local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))
 
@@ -29,31 +32,57 @@ local t = data.t
 		attention_pos = attention_pos or handler:get_detection_m_pos()
 
 		local dis = mvector3.direction(tmp_vec1, my_pos, attention_pos)
-		local dis_multiplier, angle_multiplier
+		local dis_multiplier, angle_multiplier = nil
 		local max_dis = math.min(my_data.detection.dis_max, settings.max_range or my_data.detection.dis_max)
 
 		if settings.detection and settings.detection.range_mul then
-			max_dis = max_dis * settings.detection.range_mul
+			local range_mul = settings.detection.range_mul
+			
+			if hhtacs then
+				range_mul = math.lerp(range_mul, 1, 0.75)
+			end
+			
+			max_dis = max_dis * range_mul
 		end
 
 		dis_multiplier = dis / max_dis
 
 		if settings.uncover_range and my_data.detection.use_uncover_range and dis < settings.uncover_range then
-			return -1, 0
+			return hhtacs and 0 or -1, hhtacs and dis_multiplier or 0
 		end
 
 		if dis_multiplier < 1 then
-			if settings.notice_requires_FOV then
+			if not is_weapons_hot and settings.notice_requires_FOV then
 				my_head_fwd = my_head_fwd or data.unit:movement():m_head_rot():z()
-
 				local angle = mvector3.angle(my_head_fwd, tmp_vec1)
-
-				if angle < 55 and not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
+				
+				if hhtacs then
+					if not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
+						local att_unit = handler:unit()
+						
+						if att_unit:movement() then
+							local att_unit_pos = att_unit:movement():m_pos()
+							local uncover_dis = mvec3_dis(att_unit_pos, data.m_pos)
+							
+							if uncover_dis <= 90 then --*bump*
+								return -1, 0
+							end
+						end
+						
+						if angle < 55 then
+							return -1, 0
+						end
+					end
+				elseif angle < 55 and not my_data.detection.use_uncover_range and settings.uncover_range and dis < settings.uncover_range then
 					return -1, 0
 				end
-
-				local angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))
-
+				
+				if hhtacs then
+					angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp(dis / 200, 0, 1))	
+				else
+					angle_max = math.lerp(180, my_data.detection.angle_max, math.clamp((dis - 150) / 700, 0, 1))
+				end
+				
 				angle_multiplier = angle / angle_max
 
 				if angle_multiplier < 1 then
@@ -68,36 +97,53 @@ local t = data.t
 	local function _nearly_visible_chk(attention_info, detect_pos)
 		local near_pos = tmp_vec1
 
-		if attention_info.verified_dis < 2000 and math.abs(detect_pos.z - my_pos.z) < 300 then
+		mvec3_set(near_pos, detect_pos)
+
+		local near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
+
+		if near_vis_ray then
+			local side_vec = tmp_vec2
+
+			mvec3_set(side_vec, my_pos)
+			mvec3_sub(side_vec, detect_pos)
+			mvector3.cross(side_vec, side_vec, math.UP)
+			mvector3.set_length(side_vec, 30)
 			mvec3_set(near_pos, detect_pos)
-			mvec3_set_z(near_pos, near_pos.z + 100)
+			mvector3.add(near_pos, side_vec)
 
-			local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
+			near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
 
 			if near_vis_ray then
-				local side_vec = tmp_vec1
-
-				mvec3_set(side_vec, detect_pos)
-				mvec3_sub(side_vec, my_pos)
-				mvector3.cross(side_vec, side_vec, math.UP)
-				mvector3.set_length(side_vec, 150)
-				mvector3.set(near_pos, detect_pos)
+				mvector3.multiply(side_vec, -2)
 				mvector3.add(near_pos, side_vec)
 
-				local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
-
+				near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
+				
 				if near_vis_ray then
-					mvector3.multiply(side_vec, -2)
-					mvector3.add(near_pos, side_vec)
-
-					near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
+					mvec3_set(near_pos, detect_pos)
+					mvector3.add(near_pos, math.UP * 30)
+					
+					near_vis_ray = data.unit:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
 				end
 			end
+		end
 
-			if not near_vis_ray then
-				attention_info.nearly_visible = true
+		if not near_vis_ray then
+			attention_info.nearly_visible = true
+			attention_info.release_t = nil
+
+			if attention_info.last_verified_pos then
+				mvec3_set(attention_info.last_verified_pos, near_pos)
+				attention_info.last_verified_m_pos = near_pos:with_z(attention_info.m_pos.z)
+				attention_info.last_verified_dis = mvec3_dis(data.m_pos, attention_info.last_verified_m_pos)
+			else
 				attention_info.last_verified_pos = mvector3.copy(near_pos)
+				attention_info.last_verified_m_pos = near_pos:with_z(attention_info.m_pos.z)
+				attention_info.last_verified_dis = mvec3_dis(data.m_pos, attention_info.last_verified_m_pos)
 			end
+			
+			attention_info.last_expected = nil
+			attention_info.lost_track = nil
 		end
 	end
 
@@ -108,8 +154,8 @@ local t = data.t
 
 		local weight = mvector3.direction(tmp_vec1, attention_info.m_head_pos, my_pos)
 		local e_fwd = attention_info.unit:movement():detect_look_dir()
-		local dot = mvector3.dot(e_fwd, tmp_vec1)
 
+		local dot = mvector3.dot(e_fwd, tmp_vec1)
 		weight = weight * weight * (1 - dot)
 
 		table.insert(player_importance_wgt, attention_info.u_key)
@@ -121,7 +167,7 @@ local t = data.t
 			return
 		end
 
-		local is_human_player, is_local_player, is_husk_player
+		local is_human_player, is_local_player, is_husk_player = nil
 
 		if attention_info.unit:base() then
 			is_local_player = attention_info.unit:base().is_local_player
@@ -134,29 +180,46 @@ local t = data.t
 		end
 
 		local weight = mvector3.direction(tmp_vec1, attention_info.handler:get_detection_m_pos(), my_pos)
-		local e_fwd = attention_info.unit:movement():detect_look_dir()
-		local dot = mvector3.dot(e_fwd, tmp_vec1)
+		local e_fwd = nil
 
+		if is_husk_player then
+			e_fwd = attention_info.unit:movement():detect_look_dir()
+		else
+			e_fwd = attention_info.unit:movement():m_head_rot():y()
+		end
+
+		local dot = mvector3.dot(e_fwd, tmp_vec1)
 		weight = weight * weight * (1 - dot)
 
 		table.insert(player_importance_wgt, u_key)
 		table.insert(player_importance_wgt, weight)
 	end
-
+	
+	local blind_enemies = Global.blind_enemies
+	
 	for u_key, attention_info in pairs(all_attention_objects) do
-		if u_key ~= my_key and not detected_obj[u_key] and (not attention_info.nav_tracker or chk_vis_func(my_tracker, attention_info.nav_tracker)) then
+		if blind_enemies then
+			if detected_obj[u_key] then
+				detected_obj[u_key] = nil
+			end
+		elseif u_key ~= my_key and not detected_obj[u_key] then
 			local settings = attention_info.handler:get_attention(my_access, min_reaction, max_reaction, data.team)
 
 			if settings then
-				local acquired
+				local acquired = nil
 				local attention_pos = attention_info.handler:get_detection_m_pos()
 
-				if _angle_and_dis_chk(attention_info.handler, settings, attention_pos) then
-					local vis_ray = World:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")
+				if is_detection_persistent and should_quick_register or _angle_and_dis_chk(attention_info.handler, settings, attention_pos) then
+					local vis_ray = is_detection_persistent and nil or data.unit:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")
 
-					if not vis_ray or vis_ray.unit:key() == u_key then
+					if is_detection_persistent or not vis_ray or vis_ray.unit:key() == u_key then
 						acquired = true
-						detected_obj[u_key] = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, u_key, attention_info, settings)
+						
+						if is_weapons_hot then 
+							detected_obj[u_key] = CopLogicBase.identify_attention_obj_instant(data, u_key)
+						else
+							detected_obj[u_key] = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, u_key, attention_info, settings)
+						end
 					end
 				end
 
@@ -168,77 +231,126 @@ local t = data.t
 	end
 
 	for u_key, attention_info in pairs(detected_obj) do
-		if t < attention_info.next_verify_t then
-			if attention_info.reaction >= AIAttentionObject.REACT_SUSPICIOUS then
+		if blind_enemies then
+			detected_obj[u_key] = nil
+		elseif min_reaction and attention_info.reaction < min_reaction or max_reaction and attention_info.reaction > max_reaction then
+			CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
+		elseif t < attention_info.next_verify_t then
+			if AIAttentionObject.REACT_SUSPICIOUS <= attention_info.reaction then
 				delay = math.min(attention_info.next_verify_t - t, delay)
 			end
 		else
 			attention_info.next_verify_t = t + (attention_info.identified and attention_info.verified and attention_info.settings.verification_interval or attention_info.settings.notice_interval or attention_info.settings.verification_interval)
 			delay = math.min(delay, attention_info.settings.verification_interval)
+			
+			if not data.cool and is_weapons_hot then
+				if not attention_info.identified then
+					local noticable = nil
+					attention_info.notice_progress = nil
+					attention_info.prev_notice_chk_t = nil
+					attention_info.identified = true
+					attention_info.release_t = t + attention_info.settings.release_delay
+					attention_info.identified_t = t
+					noticable = true
 
-			if not attention_info.identified then
-				local noticable
-				local angle, dis_multiplier = _angle_and_dis_chk(attention_info.handler, attention_info.settings)
+					data.logic.on_attention_obj_identified(data, u_key, attention_info)
 
+					if noticable ~= false and attention_info.settings.notice_clbk then
+						attention_info.settings.notice_clbk(data.unit, noticable)
+					end
+				end
+			elseif not attention_info.identified then
+				local noticable = nil
+				local angle, dis_multiplier = _angle_and_dis_chk(attention_info.handler, attention_info.settings)
+				
+				local attention_pos = attention_info.handler:get_detection_m_pos()
+				
 				if angle then
-					local attention_pos = attention_info.handler:get_detection_m_pos()
-					local vis_ray = World:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")
+					local vis_ray = data.unit:raycast("ray", my_pos, attention_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")
 
 					if not vis_ray or vis_ray.unit:key() == u_key then
 						noticable = true
 					end
 				end
 
-				local delta_prog
+				local delta_prog = 0
 				local dt = t - attention_info.prev_notice_chk_t
+				
+				attention_info.real_pos = mvector3.copy(attention_pos)
 
 				if noticable then
+					local attention_pos = attention_info.handler:get_detection_m_pos()
+					attention_info.notice_t = t
+					attention_info.notice_pos = mvector3.copy(attention_info.m_pos)
+					attention_info.last_notice_pos = mvector3.copy(attention_pos)
+					attention_info.noticed = true
+				
 					if angle == -1 then
 						if attention_info.is_husk_player then
 							local peer = managers.network:session():peer_by_unit(attention_info.unit)
 							local latency = peer and Network:qos(peer:rpc()).ping or nil
-
+							
 							if latency then
-								delta_prog = dt / (latency / 1000) + 0.02
-							else
-								delta_prog = 0
-							end
+								local ping = latency / 1000
+								
+								delta_prog = dt / ping + 0.02
+							end	
 						else
 							delta_prog = 1
 						end
 					else
-						local min_delay = my_data.detection.delay[1]
-						local max_delay = my_data.detection.delay[2]
+						local min_delay = attention_info.settings.delay_override and attention_info.settings.delay_override[1] or my_data.detection.delay[1]
+						local max_delay = attention_info.settings.delay_override and attention_info.settings.delay_override[2] or my_data.detection.delay[2]
 						local angle_mul_mod = 0.25 * math.min(angle / my_data.detection.angle_max, 1)
 						local dis_mul_mod = 0.75 * dis_multiplier
+
 						local notice_delay_mul = attention_info.settings.notice_delay_mul or 1
 
 						if attention_info.settings.detection and attention_info.settings.detection.delay_mul then
-							notice_delay_mul = notice_delay_mul * attention_info.settings.detection.delay_mul
+							if hhtacs then
+								local mul = attention_info.settings.detection.delay_mul
+								mul = math.lerp(mul, 1, 0.75) --detection risk affects detection rate 75% less
+								
+								notice_delay_mul = notice_delay_mul * mul
+							else
+								notice_delay_mul = notice_delay_mul * attention_info.settings.detection.delay_mul
+							end
 						end
 
-						local notice_delay_modified = math.lerp(min_delay * notice_delay_mul, max_delay, dis_mul_mod + angle_mul_mod)
-
+						local notice_delay_modified = math.lerp(min_delay * notice_delay_mul, max_delay, math.clamp(dis_mul_mod + angle_mul_mod, 0, 1))
+						
 						if attention_info.is_husk_player then
 							local peer = managers.network:session():peer_by_unit(attention_info.unit)
 							local latency = peer and Network:qos(peer:rpc()).ping or nil
-
+							
 							if latency then
-								notice_delay_modified = notice_delay_modified + latency / 1000 + 0.02
-							else
-								delta_prog = 0
-							end
+								local ping = latency / 1000
+								
+								notice_delay_modified = notice_delay_modified + ping + 0.02
+							end	
 						end
-
-						delta_prog = delta_prog or notice_delay_modified > 0 and dt / notice_delay_modified or 1
+							
+						delta_prog = notice_delay_modified > 0 and dt / notice_delay_modified or 1
 					end
 				else
+					attention_info.noticed = nil
+					
 					delta_prog = dt * -0.125
+					
+					local attention_pos = attention_info.handler:get_detection_m_pos()
+					
+					if attention_info.last_notice_pos then
+						local lerp = math.clamp(mvector3.distance(attention_pos, attention_info.last_notice_pos) / 400)
+						
+						if attention_info.notice_t and data.t - attention_info.notice_t < math.lerp(2, 0.2, lerp) then					
+							attention_info.notice_pos = mvector3.copy(attention_info.m_pos)
+						end
+					end
 				end
 
-				attention_info.notice_progress = attention_info.notice_progress + delta_prog
+				attention_info.notice_progress = math.clamp(attention_info.notice_progress + delta_prog, 0, 1)
 
-				if attention_info.notice_progress > 1 then
+				if attention_info.notice_progress == 1 then
 					attention_info.notice_progress = nil
 					attention_info.prev_notice_chk_t = nil
 					attention_info.identified = true
@@ -247,15 +359,15 @@ local t = data.t
 					noticable = true
 
 					data.logic.on_attention_obj_identified(data, u_key, attention_info)
-				elseif attention_info.notice_progress < 0 then
+				elseif attention_info.notice_progress == 0 and not attention_info.being_chased and (not hhtacs or not attention_info.notice_t or not attention_info.detected_criminal or attention_info.detected_criminal and t - attention_info.notice_t > 2) then
 					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
 
 					noticable = false
 				else
-					noticable = attention_info.notice_progress
+					noticable = math.clamp(attention_info.notice_progress, 0.01, 1)
 					attention_info.prev_notice_chk_t = t
 
-					if data.cool and attention_info.settings.reaction >= AIAttentionObject.REACT_SCARED then
+					if data.cool and AIAttentionObject.REACT_SCARED <= attention_info.settings.reaction then
 						managers.groupai:state():on_criminal_suspicion_progress(attention_info.unit, data.unit, noticable)
 					end
 				end
@@ -268,27 +380,25 @@ local t = data.t
 			if attention_info.identified then
 				delay = math.min(delay, attention_info.settings.verification_interval)
 				attention_info.nearly_visible = nil
-
-				local verified, vis_ray
+				local verified, vis_ray = nil
 				local attention_pos = attention_info.handler:get_detection_m_pos()
 				local dis = mvector3.distance(data.m_pos, attention_info.m_pos)
 
 				if dis < my_data.detection.dis_max * 1.2 and (not attention_info.settings.max_range or dis < attention_info.settings.max_range * (attention_info.settings.detection and attention_info.settings.detection.range_mul or 1) * 1.2) then
-					local detect_pos
-
-					if attention_info.is_husk_player and attention_info.unit:anim_data().crouch then
-						detect_pos = tmp_vec1
-
-						mvector3.set(detect_pos, attention_info.m_pos)
-						mvector3.add(detect_pos, tweak_data.player.stances.default.crouched.head.translation)
-					else
-						detect_pos = attention_pos
+					local detect_pos = attention_pos
+					local lost_track = attention_info.lost_track and not highperformance or not attention_info.verified_t
+					
+					if data.unit:anim_data().hide or data.unit:anim_data().hide_loop or data.unit:anim_data().needs_idle and (data.unit:base():has_tag("spooc") or data.unit:base()._tweak_table == "shadow_spooc") then
+						lost_track = nil
 					end
-
-					local in_FOV = not attention_info.settings.notice_requires_FOV or data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) or _angle_chk(attention_pos, dis, 0.8)
-
+					
+					local fov_not_required = not attention_info.settings.notice_requires_FOV or data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask)
+					
+					local in_FOV = not lost_track and fov_not_required
+					in_FOV = in_FOV or _angle_chk(attention_pos, dis, 0.8)
+					
 					if in_FOV then
-						vis_ray = World:raycast("ray", my_pos, detect_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")
+						vis_ray = data.unit:raycast("ray", my_pos, detect_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")
 
 						if not vis_ray or vis_ray.unit:key() == u_key then
 							verified = true
@@ -300,7 +410,6 @@ local t = data.t
 
 				attention_info.dis = dis
 				attention_info.vis_ray = vis_ray and vis_ray.dis or nil
-
 				local is_ignored = false
 
 				if attention_info.unit:movement() and attention_info.unit:movement().is_cuffed then
@@ -311,31 +420,79 @@ local t = data.t
 					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
 				elseif verified then
 					attention_info.release_t = nil
+					
+					if not attention_info.verified_t or attention_info.lost_track then
+						data.logic.on_attention_obj_verified(data, u_key, attention_info)
+					end
+					
 					attention_info.verified_t = t
 
 					mvector3.set(attention_info.verified_pos, attention_pos)
-
-					attention_info.last_verified_pos = mvector3.copy(attention_pos)
+					attention_info.verified_m_pos = mvector3.copy(attention_info.m_pos)
 					attention_info.verified_dis = dis
+					
+					attention_info.last_verified_pos = mvector3.copy(attention_pos)
+					attention_info.last_verified_m_pos = mvector3.copy(attention_info.m_pos)
+					attention_info.last_verified_dis = dis
+					attention_info.last_expected = nil
+					attention_info.lost_track = nil
 				elseif data.enemy_slotmask and attention_info.unit:in_slot(data.enemy_slotmask) then
-					if attention_info.criminal_record and attention_info.settings.reaction >= AIAttentionObject.REACT_COMBAT then
-						if not is_detection_persistent and mvector3.distance(attention_pos, attention_info.criminal_record.pos) > 700 then
+					local destroyed
+					
+					if attention_info.criminal_record and AIAttentionObject.REACT_COMBAT <= attention_info.settings.reaction then
+						if data.logic._keep_player_focus_t and attention_info.is_human_player and attention_info.verified_t and data.t - attention_info.verified_t < data.logic._keep_player_focus_t then
+							delay = math.min(0.2, delay)
+							attention_info.verified_pos = attention_info.criminal_record.pos:with_z(attention_info.criminal_record.pos.z + math.abs(attention_pos.z - attention_info.m_pos.z))
+							attention_info.verified_m_pos = mvector3.copy(attention_info.criminal_record.pos)
+							attention_info.verified_dis = dis
+
+							if not attention_info.lost_track and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) and attention_info.dis < 2000 then
+								_nearly_visible_chk(attention_info, attention_pos)
+							end
+						elseif not is_detection_persistent and mvector3.distance(attention_info.m_pos, attention_info.criminal_record.pos) > 700 then
+							destroyed = true
 							CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
 						else
 							delay = math.min(0.2, delay)
-							attention_info.verified_pos = mvector3.copy(attention_info.criminal_record.pos)
+							attention_info.verified_pos = attention_info.criminal_record.pos:with_z(attention_info.criminal_record.pos.z + math.abs(attention_pos.z - attention_info.m_pos.z))
+							attention_info.verified_m_pos = mvector3.copy(attention_info.criminal_record.pos)
 							attention_info.verified_dis = dis
 
-							if vis_ray and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) then
+							if not attention_info.lost_track and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) and attention_info.dis < 2000 then
 								_nearly_visible_chk(attention_info, attention_pos)
 							end
 						end
-					elseif attention_info.release_t and t > attention_info.release_t then
+					elseif is_detection_persistent and AIAttentionObject.REACT_COMBAT <= attention_info.settings.reaction then
+						delay = math.min(0.2, delay)
+						mvector3.set(attention_info.verified_pos, attention_pos)
+						attention_info.verified_m_pos = mvector3.copy(attention_info.m_pos)
+						attention_info.verified_dis = dis
+						
+						if not attention_info.lost_track and data.logic._chk_nearly_visible_chk_needed(data, attention_info, u_key) and attention_info.dis < 2000 then
+							_nearly_visible_chk(attention_info, attention_pos)
+						end
+					elseif attention_info.verified_m_pos and mvector3.distance(attention_info.m_pos, attention_info.verified_m_pos) > 700 then
+						destroyed = true
+						CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
+					elseif attention_info.release_t and attention_info.release_t < t then
+						destroyed = true
 						CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
 					else
 						attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
 					end
-				elseif attention_info.release_t and t > attention_info.release_t then
+					
+					if not destroyed and AIAttentionObject.REACT_COMBAT <= attention_info.settings.reaction then
+						if not highperformance and not attention_info.lost_track and not attention_info.nearly_visible then
+							do
+								if attention_info.last_expected and not data.unit:raycast("ray", my_pos, attention_info.last_expected, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision") then
+									attention_info.lost_track = true
+								elseif not attention_info.last_expected then
+									attention_info.last_expected = mvector3.copy(attention_pos)
+								end
+							end
+						end
+					end
+				elseif attention_info.release_t and attention_info.release_t < t then
 					CopLogicBase._destroy_detected_attention_object_data(data, attention_info)
 				else
 					attention_info.release_t = attention_info.release_t or t + attention_info.settings.release_delay
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -67,10 +67,14 @@ local t = data.t
 
 	local function _nearly_visible_chk(attention_info, detect_pos)
 		local near_pos = tmp_vec1
+		local MAX_DISTANCE = 2000
 
-		if attention_info.verified_dis < 2000 and math.abs(detect_pos.z - my_pos.z) < 300 then
+		if MAX_DISTANCE > attention_info.verified_dis and math.abs(detect_pos.z - my_pos.z) < 300 then
 			mvec3_set(near_pos, detect_pos)
-			mvec3_set_z(near_pos, near_pos.z + 100)
+
+			local height_over_target = math.lerp(100, 10, math.max(attention_info.verified_dis / MAX_DISTANCE))
+
+			mvec3_set_z(near_pos, near_pos.z + height_over_target)
 
 			local near_vis_ray = World:raycast("ray", my_pos, near_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report")
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

# Function dossier: lua/coplogics/specials/shieldlogicattack.lua :: ShieldLogicAttack.queued_update

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 117 lines, params `(data)`
- 246.1: 130 lines, params `(data)`
- 248.2: 129 lines, params `(data)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function ShieldLogicAttack.queued_update(data)
local t = TimerManager:game():time()
	data.t = t
	local unit = data.unit
	local my_data = data.internal_data

	ShieldLogicAttack._upd_enemy_detection(data)

	if my_data ~= data.internal_data then
		return
	end

	if my_data.has_old_action or my_data.old_action_advancing then
		CopLogicAttack._upd_stop_old_action(data, my_data)
		
		if my_data.has_old_action or my_data.old_action_advancing then
			ShieldLogicAttack.queue_update(data, my_data)
			CopLogicBase._report_detections(data.detected_attention_objects)

			return
		end
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		ShieldLogicAttack.queue_update(data, my_data)

		return
	end

	local focus_enemy = data.attention_obj
	
	my_data.want_to_take_cover = CopLogicAttack._chk_wants_to_take_cover(data, my_data)
	
	local action_taken = data.unit:movement():chk_action_forbidden("walk") or my_data.advancing

	if not action_taken and unit:anim_data().stand then
		action_taken = CopLogicAttack._chk_request_action_crouch(data)
	end

	ShieldLogicAttack._process_pathing_results(data, my_data)

	local enemy_visible = focus_enemy.verified
	local engage = my_data.attitude == "engage"

	if not action_taken then
		if not data.next_mov_time or data.next_mov_time < data.t or my_data.shield_unit and my_data.shield_unit:base():is_charging() then
			if my_data.pathing_to_optimal_pos then
				-- Nothing
			elseif my_data.optimal_path then
				ShieldLogicAttack._chk_request_action_walk_to_optimal_pos(data, my_data)
			elseif my_data.optimal_pos and focus_enemy.nav_tracker then
				local to_pos = my_data.optimal_pos
				my_data.optimal_pos = nil
				
				if not data.objective or not data.objective.follow_unit then
					if my_data.attitude == "engage" and (LIES.settings.enemy_aggro_level > 2 or not focus_enemy.verified_t or t - focus_enemy.verified_t > 15) and my_data.shield_state ~= "defensive" or my_data.shield_unit and my_data.shield_unit:base():is_charging() then
						local ray_params = {
							pos_to = to_pos,
							trace = true
						}
					
						local enemy_tracker = focus_enemy.unit:movement():nav_tracker()
						
						if enemy_tracker:lost() then
							ray_params.tracker_from = nil
							ray_params.pos_from = enemy_tracker:field_position()
						else
							ray_params.tracker_from = enemy_tracker
						end
						
						local ray_res = managers.navigation:raycast(ray_params)
						to_pos = ray_params.trace[1]
					end
				end

				local fwd_bump = nil
				to_pos, fwd_bump = ShieldLogicAttack.chk_wall_distance(data, my_data, to_pos)
				local do_move = mvector3.distance_sq(to_pos, data.m_pos) > 2500

				if not do_move then
					local to_pos_current, fwd_bump_current = ShieldLogicAttack.chk_wall_distance(data, my_data, data.m_pos)

					if fwd_bump_current and mvector3.distance_sq(to_pos_current, data.m_pos) > 2500 then
						do_move = true
					end
				end

				if do_move then
					my_data.pathing_to_optimal_pos = true
					my_data.optimal_path_search_id = tostring(unit:key()) .. "optimal"

					local reservation = managers.navigation:reserve_pos(nil, nil, to_pos, callback(ShieldLogicAttack, ShieldLogicAttack, "_reserve_pos_step_clbk", {
						unit_pos = data.m_pos
					}), 70, data.pos_rsrv_id)

					if reservation then
						to_pos = reservation.position
					else
						reservation = {
							radius = 70,
							position = mvector3.copy(to_pos),
							filter = data.pos_rsrv_id
						}

						managers.navigation:add_pos_reservation(reservation)
					end

					data.brain:set_pos_rsrv("path", reservation)
					data.brain:search_for_path(my_data.optimal_path_search_id, to_pos)
				end
			end
		end
	end

	ShieldLogicAttack.queue_update(data, my_data)
	CopLogicBase._report_detections(data.detected_attention_objects)
end
```

## 246.1 vanilla (a3180fc)

```lua
function ShieldLogicAttack.queued_update(data)
local t = TimerManager:game():time()

	data.t = t

	local unit = data.unit
	local my_data = data.internal_data

	ShieldLogicAttack._upd_enemy_detection(data)

	if my_data ~= data.internal_data then
		return
	end

	if my_data.has_old_action then
		CopLogicAttack._upd_stop_old_action(data, my_data)
		ShieldLogicAttack.queue_update(data, my_data)
		CopLogicBase._report_detections(data.detected_attention_objects)

		return
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		ShieldLogicAttack.queue_update(data, my_data)

		return
	end

	local focus_enemy = data.attention_obj
	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_shoot_pos

	if not action_taken and unit:anim_data().stand then
		action_taken = CopLogicAttack._chk_request_action_crouch(data)
	end

	ShieldLogicAttack._process_pathing_results(data, my_data)

	local enemy_visible = focus_enemy.verified
	local engage = my_data.attitude == "engage"
	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_optimal_pos

	if not action_taken then
		if unit:anim_data().stand then
			action_taken = CopLogicAttack._chk_request_action_crouch(data)
		end

		if action_taken or my_data.pathing_to_optimal_pos then
			-- Nothing
		elseif my_data.optimal_path then
			ShieldLogicAttack._chk_request_action_walk_to_optimal_pos(data, my_data)
		elseif my_data.optimal_pos and focus_enemy.nav_tracker then
			local to_pos = my_data.optimal_pos

			my_data.optimal_pos = nil

			local ray_params = {
				trace = true,
				tracker_from = unit:movement():nav_tracker(),
				pos_to = to_pos
			}
			local ray_res = managers.navigation:raycast(ray_params)

			to_pos = ray_params.trace[1]

			if ray_res then
				local vec = data.m_pos - to_pos

				mvector3.normalize(vec)

				local fwd = unit:movement():m_fwd()
				local fwd_dot = fwd:dot(vec)

				if fwd_dot > 0 then
					local enemy_tracker = focus_enemy.nav_tracker

					if enemy_tracker:lost() then
						ray_params.tracker_from = nil
						ray_params.pos_from = enemy_tracker:field_position()
					else
						ray_params.tracker_from = enemy_tracker
					end

					ray_res = managers.navigation:raycast(ray_params)
					to_pos = ray_params.trace[1]
				end
			end

			local fwd_bump

			to_pos, fwd_bump = ShieldLogicAttack.chk_wall_distance(data, my_data, to_pos)

			local do_move = mvector3.distance_sq(to_pos, data.m_pos) > 10000

			if not do_move then
				local to_pos_current, fwd_bump_current = ShieldLogicAttack.chk_wall_distance(data, my_data, data.m_pos)

				if fwd_bump_current then
					do_move = true
				end
			end

			if do_move then
				my_data.pathing_to_optimal_pos = true
				my_data.optimal_path_search_id = tostring(unit:key()) .. "optimal"

				local reservation = managers.navigation:reserve_pos(nil, nil, to_pos, callback(ShieldLogicAttack, ShieldLogicAttack, "_reserve_pos_step_clbk", {
					unit_pos = data.m_pos
				}), 70, data.pos_rsrv_id)

				if reservation then
					to_pos = reservation.position
				else
					reservation = {
						radius = 60,
						position = mvector3.copy(to_pos),
						filter = data.pos_rsrv_id
					}

					managers.navigation:add_pos_reservation(reservation)
				end

				data.brain:set_pos_rsrv("path", reservation)
				data.brain:search_for_path(my_data.optimal_path_search_id, to_pos)
			end
		end
	end

	ShieldLogicAttack.queue_update(data, my_data)
	CopLogicBase._report_detections(data.detected_attention_objects)
end
```

## 248.2 vanilla (e3a8b616)

```lua
function ShieldLogicAttack.queued_update(data)
local t = TimerManager:game():time()

	data.t = t

	local unit = data.unit
	local my_data = data.internal_data

	ShieldLogicAttack._upd_enemy_detection(data)

	if my_data ~= data.internal_data then
		return
	end

	if my_data.has_old_action then
		CopLogicAttack._upd_stop_old_action(data, my_data)
		ShieldLogicAttack.queue_update(data, my_data)
		CopLogicBase._report_detections(data.detected_attention_objects)

		return
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		ShieldLogicAttack.queue_update(data, my_data)

		return
	end

	local focus_enemy = data.attention_obj
	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_shoot_pos

	if not action_taken and unit:anim_data().stand then
		action_taken = CopLogicAttack._chk_request_action_crouch(data)
	end

	ShieldLogicAttack._process_pathing_results(data, my_data)

	local enemy_visible = focus_enemy.verified
	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_optimal_pos

	if not action_taken then
		if unit:anim_data().stand then
			action_taken = CopLogicAttack._chk_request_action_crouch(data)
		end

		if action_taken or my_data.pathing_to_optimal_pos then
			-- Nothing
		elseif my_data.optimal_path then
			ShieldLogicAttack._chk_request_action_walk_to_optimal_pos(data, my_data)
		elseif my_data.optimal_pos and focus_enemy.nav_tracker then
			local to_pos = my_data.optimal_pos

			my_data.optimal_pos = nil

			local ray_params = {
				trace = true,
				tracker_from = unit:movement():nav_tracker(),
				pos_to = to_pos
			}
			local ray_res = managers.navigation:raycast(ray_params)

			to_pos = ray_params.trace[1]

			if ray_res then
				local vec = data.m_pos - to_pos

				mvector3.normalize(vec)

				local fwd = unit:movement():m_fwd()
				local fwd_dot = fwd:dot(vec)

				if fwd_dot > 0 then
					local enemy_tracker = focus_enemy.nav_tracker

					if enemy_tracker:lost() then
						ray_params.tracker_from = nil
						ray_params.pos_from = enemy_tracker:field_position()
					else
						ray_params.tracker_from = enemy_tracker
					end

					ray_res = managers.navigation:raycast(ray_params)
					to_pos = ray_params.trace[1]
				end
			end

			local fwd_bump

			to_pos, fwd_bump = ShieldLogicAttack.chk_wall_distance(data, my_data, to_pos)

			local do_move = mvector3.distance_sq(to_pos, data.m_pos) > 10000

			if not do_move then
				local to_pos_current, fwd_bump_current = ShieldLogicAttack.chk_wall_distance(data, my_data, data.m_pos)

				if fwd_bump_current then
					do_move = true
				end
			end

			if do_move then
				my_data.pathing_to_optimal_pos = true
				my_data.optimal_path_search_id = tostring(unit:key()) .. "optimal"

				local reservation = managers.navigation:reserve_pos(nil, nil, to_pos, callback(ShieldLogicAttack, ShieldLogicAttack, "_reserve_pos_step_clbk", {
					unit_pos = data.m_pos
				}), 70, data.pos_rsrv_id)

				if reservation then
					to_pos = reservation.position

					data.brain:set_pos_rsrv("path", reservation)
				else
					reservation = {
						radius = 60,
						position = mvector3.copy(to_pos)
					}

					data.brain:add_pos_rsrv("path", reservation)
				end

				data.brain:search_for_path(my_data.optimal_path_search_id, to_pos)
			end
		end
	end

	ShieldLogicAttack.queue_update(data, my_data)
	CopLogicBase._report_detections(data.detected_attention_objects)
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,7 +1,5 @@
 local t = TimerManager:game():time()
-
 	data.t = t
-
 	local unit = data.unit
 	local my_data = data.internal_data
 
@@ -11,12 +9,15 @@ local t = TimerManager:game():time()
 		return
 	end
 
-	if my_data.has_old_action then
+	if my_data.has_old_action or my_data.old_action_advancing then
 		CopLogicAttack._upd_stop_old_action(data, my_data)
-		ShieldLogicAttack.queue_update(data, my_data)
-		CopLogicBase._report_detections(data.detected_attention_objects)
+		
+		if my_data.has_old_action or my_data.old_action_advancing then
+			ShieldLogicAttack.queue_update(data, my_data)
+			CopLogicBase._report_detections(data.detected_attention_objects)
 
-		return
+			return
+		end
 	end
 
 	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
@@ -26,7 +27,10 @@ local t = TimerManager:game():time()
 	end
 
 	local focus_enemy = data.attention_obj
-	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_shoot_pos
+	
+	my_data.want_to_take_cover = CopLogicAttack._chk_wants_to_take_cover(data, my_data)
+	
+	local action_taken = data.unit:movement():chk_action_forbidden("walk") or my_data.advancing
 
 	if not action_taken and unit:anim_data().stand then
 		action_taken = CopLogicAttack._chk_request_action_crouch(data)
@@ -36,90 +40,73 @@ local t = TimerManager:game():time()
 
 	local enemy_visible = focus_enemy.verified
 	local engage = my_data.attitude == "engage"
-	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_optimal_pos
 
 	if not action_taken then
-		if unit:anim_data().stand then
-			action_taken = CopLogicAttack._chk_request_action_crouch(data)
-		end
-
-		if action_taken or my_data.pathing_to_optimal_pos then
-			-- Nothing
-		elseif my_data.optimal_path then
-			ShieldLogicAttack._chk_request_action_walk_to_optimal_pos(data, my_data)
-		elseif my_data.optimal_pos and focus_enemy.nav_tracker then
-			local to_pos = my_data.optimal_pos
-
-			my_data.optimal_pos = nil
-
-			local ray_params = {
-				trace = true,
-				tracker_from = unit:movement():nav_tracker(),
-				pos_to = to_pos
-			}
-			local ray_res = managers.navigation:raycast(ray_params)
-
-			to_pos = ray_params.trace[1]
-
-			if ray_res then
-				local vec = data.m_pos - to_pos
-
-				mvector3.normalize(vec)
-
-				local fwd = unit:movement():m_fwd()
-				local fwd_dot = fwd:dot(vec)
-
-				if fwd_dot > 0 then
-					local enemy_tracker = focus_enemy.nav_tracker
-
-					if enemy_tracker:lost() then
-						ray_params.tracker_from = nil
-						ray_params.pos_from = enemy_tracker:field_position()
-					else
-						ray_params.tracker_from = enemy_tracker
+		if not data.next_mov_time or data.next_mov_time < data.t or my_data.shield_unit and my_data.shield_unit:base():is_charging() then
+			if my_data.pathing_to_optimal_pos then
+				-- Nothing
+			elseif my_data.optimal_path then
+				ShieldLogicAttack._chk_request_action_walk_to_optimal_pos(data, my_data)
+			elseif my_data.optimal_pos and focus_enemy.nav_tracker then
+				local to_pos = my_data.optimal_pos
+				my_data.optimal_pos = nil
+				
+				if not data.objective or not data.objective.follow_unit then
+					if my_data.attitude == "engage" and (LIES.settings.enemy_aggro_level > 2 or not focus_enemy.verified_t or t - focus_enemy.verified_t > 15) and my_data.shield_state ~= "defensive" or my_data.shield_unit and my_data.shield_unit:base():is_charging() then
+						local ray_params = {
+							pos_to = to_pos,
+							trace = true
+						}
+					
+						local enemy_tracker = focus_enemy.unit:movement():nav_tracker()
+						
+						if enemy_tracker:lost() then
+							ray_params.tracker_from = nil
+							ray_params.pos_from = enemy_tracker:field_position()
+						else
+							ray_params.tracker_from = enemy_tracker
+						end
+						
+						local ray_res = managers.navigation:raycast(ray_params)
+						to_pos = ray_params.trace[1]
 					end
-
-					ray_res = managers.navigation:raycast(ray_params)
-					to_pos = ray_params.trace[1]
 				end
-			end
-
-			local fwd_bump
-
-			to_pos, fwd_bump = ShieldLogicAttack.chk_wall_distance(data, my_data, to_pos)
 
-			local do_move = mvector3.distance_sq(to_pos, data.m_pos) > 10000
+				local fwd_bump = nil
+				to_pos, fwd_bump = ShieldLogicAttack.chk_wall_distance(data, my_data, to_pos)
+				local do_move = mvector3.distance_sq(to_pos, data.m_pos) > 2500
 
-			if not do_move then
-				local to_pos_current, fwd_bump_current = ShieldLogicAttack.chk_wall_distance(data, my_data, data.m_pos)
+				if not do_move then
+					local to_pos_current, fwd_bump_current = ShieldLogicAttack.chk_wall_distance(data, my_data, data.m_pos)
 
-				if fwd_bump_current then
-					do_move = true
+					if fwd_bump_current and mvector3.distance_sq(to_pos_current, data.m_pos) > 2500 then
+						do_move = true
+					end
 				end
-			end
 
-			if do_move then
-				my_data.pathing_to_optimal_pos = true
-				my_data.optimal_path_search_id = tostring(unit:key()) .. "optimal"
+				if do_move then
+					my_data.pathing_to_optimal_pos = true
+					my_data.optimal_path_search_id = tostring(unit:key()) .. "optimal"
+
+					local reservation = managers.navigation:reserve_pos(nil, nil, to_pos, callback(ShieldLogicAttack, ShieldLogicAttack, "_reserve_pos_step_clbk", {
+						unit_pos = data.m_pos
+					}), 70, data.pos_rsrv_id)
 
-				local reservation = managers.navigation:reserve_pos(nil, nil, to_pos, callback(ShieldLogicAttack, ShieldLogicAttack, "_reserve_pos_step_clbk", {
-					unit_pos = data.m_pos
-				}), 70, data.pos_rsrv_id)
+					if reservation then
+						to_pos = reservation.position
+					else
+						reservation = {
+							radius = 70,
+							position = mvector3.copy(to_pos),
+							filter = data.pos_rsrv_id
+						}
 
-				if reservation then
-					to_pos = reservation.position
-				else
-					reservation = {
-						radius = 60,
-						position = mvector3.copy(to_pos),
-						filter = data.pos_rsrv_id
-					}
+						managers.navigation:add_pos_reservation(reservation)
+					end
 
-					managers.navigation:add_pos_reservation(reservation)
+					data.brain:set_pos_rsrv("path", reservation)
+					data.brain:search_for_path(my_data.optimal_path_search_id, to_pos)
 				end
-
-				data.brain:set_pos_rsrv("path", reservation)
-				data.brain:search_for_path(my_data.optimal_path_search_id, to_pos)
 			end
 		end
 	end
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -35,7 +35,6 @@ local t = TimerManager:game():time()
 	ShieldLogicAttack._process_pathing_results(data, my_data)
 
 	local enemy_visible = focus_enemy.verified
-	local engage = my_data.attitude == "engage"
 	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_optimal_pos
 
 	if not action_taken then
@@ -108,17 +107,17 @@ local t = TimerManager:game():time()
 
 				if reservation then
 					to_pos = reservation.position
+
+					data.brain:set_pos_rsrv("path", reservation)
 				else
 					reservation = {
 						radius = 60,
-						position = mvector3.copy(to_pos),
-						filter = data.pos_rsrv_id
+						position = mvector3.copy(to_pos)
 					}
 
-					managers.navigation:add_pos_reservation(reservation)
+					data.brain:add_pos_rsrv("path", reservation)
 				end
 
-				data.brain:set_pos_rsrv("path", reservation)
 				data.brain:search_for_path(my_data.optimal_path_search_id, to_pos)
 			end
 		end
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

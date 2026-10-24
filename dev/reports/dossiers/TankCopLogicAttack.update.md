# Function dossier: lua/coplogics/specials/tankcoplogicattack.lua :: TankCopLogicAttack.update

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 106 lines, params `(data)`
- 246.1: 104 lines, params `(data)`
- 248.2: 102 lines, params `(data)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function TankCopLogicAttack.update(data)
local t = data.t
	local unit = data.unit
	local my_data = data.internal_data

	if my_data.has_old_action or my_data.old_action_advancing then
		CopLogicAttack._upd_stop_old_action(data, my_data)
		
		if my_data.has_old_action or my_data.old_action_advancing then
			return
		end
	end

	if CopLogicIdle._chk_relocate(data) then
		return
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		CopLogicAttack._upd_enemy_detection(data, true)

		if my_data ~= data.internal_data or not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
			return
		end
	end

	local focus_enemy = data.attention_obj

	TankCopLogicAttack._process_pathing_results(data, my_data)

	local enemy_visible = focus_enemy.verified
	my_data.attitude = data.objective and data.objective.attitude or "engage"
	local engage = my_data.attitude == "engage"
	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos

	if action_taken then
		return
	end

	if unit:anim_data().crouch then
		action_taken = CopLogicAttack._chk_request_action_stand(data)
	end

	if action_taken then
		return
	end

	local enemy_pos = enemy_visible and focus_enemy.m_pos or focus_enemy.verified_pos
	action_taken = CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)

	if action_taken then
		return
	end

	local chase = nil
	local z_dist = math.abs(data.m_pos.z - focus_enemy.m_pos.z)

	if AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
		if enemy_visible then
			if z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
				chase = true
			end

			if focus_enemy.verified_dis < 800 and unit:anim_data().run then
				local new_action = {
					body_part = 2,
					type = "idle"
				}

				data.unit:brain():action_request(new_action)
			end
		elseif z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and (not focus_enemy.verified_t or t - focus_enemy.verified_t > 5 or focus_enemy.verified_dis > 700) then
			chase = true
		end
	end

	if chase then
		if not data.next_mov_time or data.next_mov_time < data.t then
			if my_data.walking_to_chase_pos then
				-- Nothing
			elseif my_data.pathing_to_chase_pos then
				-- Nothing
			elseif my_data.chase_path then
				local dist = focus_enemy.verified_dis
				local run_dist = focus_enemy.verified and 1500 or 800
				local walk = dist < run_dist

				TankCopLogicAttack._chk_request_action_walk_to_chase_pos(data, my_data, walk and "walk" or "run")
			elseif my_data.chase_pos then
				my_data.chase_path_search_id = tostring(unit:key()) .. "chase"
				my_data.pathing_to_chase_pos = true
				local to_pos = my_data.chase_pos
				my_data.chase_pos = nil

				data.brain:add_pos_rsrv("path", {
					radius = 60,
					position = mvector3.copy(to_pos)
				})
				unit:brain():search_for_path(my_data.chase_path_search_id, to_pos)
			elseif focus_enemy.nav_tracker then
				my_data.chase_pos = CopLogicAttack._find_flank_pos(data, my_data, focus_enemy.nav_tracker)
			end
		end
	else
		TankCopLogicAttack._cancel_chase_attempt(data, my_data)
	end
end
```

## 246.1 vanilla (a3180fc)

```lua
function TankCopLogicAttack.update(data)
local t = data.t
	local unit = data.unit
	local my_data = data.internal_data

	if my_data.has_old_action then
		CopLogicAttack._upd_stop_old_action(data, my_data)

		return
	end

	if CopLogicIdle._chk_relocate(data) then
		return
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		CopLogicAttack._upd_enemy_detection(data, true)

		if my_data ~= data.internal_data or not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
			return
		end
	end

	local focus_enemy = data.attention_obj

	TankCopLogicAttack._process_pathing_results(data, my_data)

	local enemy_visible = focus_enemy.verified
	local engage = my_data.attitude == "engage"
	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos

	if action_taken then
		return
	end

	if unit:anim_data().crouch then
		action_taken = CopLogicAttack._chk_request_action_stand(data)
	end

	if action_taken then
		return
	end

	local enemy_pos = enemy_visible and focus_enemy.m_pos or focus_enemy.verified_pos

	action_taken = CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)

	if action_taken then
		return
	end

	local chase
	local z_dist = math.abs(data.m_pos.z - focus_enemy.m_pos.z)

	if focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
		if enemy_visible then
			if z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
				chase = true
			end

			if focus_enemy.verified_dis < 800 and unit:anim_data().run then
				local new_action = {
					body_part = 2,
					type = "idle"
				}

				data.unit:brain():action_request(new_action)
			end
		elseif z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and (not focus_enemy.verified_t or t - focus_enemy.verified_t > 5 or focus_enemy.verified_dis > 700) then
			chase = true
		end
	end

	if chase then
		if my_data.walking_to_chase_pos then
			-- Nothing
		elseif my_data.pathing_to_chase_pos then
			-- Nothing
		elseif my_data.chase_path then
			local dist = focus_enemy.verified_dis
			local run_dist = focus_enemy.verified and 1500 or 800
			local walk = dist < run_dist

			TankCopLogicAttack._chk_request_action_walk_to_chase_pos(data, my_data, "run")
		elseif my_data.chase_pos then
			my_data.chase_path_search_id = tostring(unit:key()) .. "chase"
			my_data.pathing_to_chase_pos = true

			local to_pos = my_data.chase_pos

			my_data.chase_pos = nil

			data.brain:add_pos_rsrv("path", {
				radius = 60,
				position = mvector3.copy(to_pos)
			})
			unit:brain():search_for_path(my_data.chase_path_search_id, to_pos)
		elseif focus_enemy.nav_tracker then
			my_data.chase_pos = CopLogicAttack._find_flank_pos(data, my_data, focus_enemy.nav_tracker)
		end
	else
		TankCopLogicAttack._cancel_chase_attempt(data, my_data)
	end
end
```

## 248.2 vanilla (e3a8b616)

```lua
function TankCopLogicAttack.update(data)
local t = data.t
	local unit = data.unit
	local my_data = data.internal_data

	if my_data.has_old_action then
		CopLogicAttack._upd_stop_old_action(data, my_data)

		return
	end

	if CopLogicIdle._chk_relocate(data) then
		return
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		CopLogicAttack._upd_enemy_detection(data, true)

		if my_data ~= data.internal_data or not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
			return
		end
	end

	local focus_enemy = data.attention_obj

	TankCopLogicAttack._process_pathing_results(data, my_data)

	local enemy_visible = focus_enemy.verified
	local engage = my_data.attitude == "engage"
	local action_taken = my_data.turning or unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos

	if action_taken then
		return
	end

	if unit:anim_data().crouch then
		action_taken = CopLogicAttack._chk_request_action_stand(data)
	end

	if action_taken then
		return
	end

	local enemy_pos = enemy_visible and focus_enemy.m_pos or focus_enemy.verified_pos

	action_taken = CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)

	if action_taken then
		return
	end

	local chase
	local within_z_distance = math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300

	if focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
		if enemy_visible then
			if within_z_distance or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
				chase = true
			end

			if focus_enemy.verified_dis < 800 and unit:anim_data().run then
				unit:brain():action_request({
					body_part = 2,
					type = "idle"
				})
			end
		elseif within_z_distance or focus_enemy.verified_dis > 2000 or engage and (not focus_enemy.verified_t or t - focus_enemy.verified_t > 5 or focus_enemy.verified_dis > 700) then
			chase = true
		end
	end

	if chase then
		if my_data.walking_to_chase_pos then
			-- Nothing
		elseif my_data.pathing_to_chase_pos then
			-- Nothing
		elseif my_data.chase_path then
			local dist = focus_enemy.verified_dis
			local run_dist = focus_enemy.verified and 1500 or 800
			local walk = dist < run_dist

			TankCopLogicAttack._chk_request_action_walk_to_chase_pos(data, my_data, "run")
		elseif my_data.chase_pos then
			my_data.chase_path_search_id = tostring(unit:key()) .. "chase"
			my_data.pathing_to_chase_pos = true

			local to_pos = my_data.chase_pos

			my_data.chase_pos = nil

			data.brain:add_pos_rsrv("path", {
				radius = 60,
				position = mvector3.copy(to_pos)
			})
			unit:brain():search_for_path(my_data.chase_path_search_id, to_pos)
		elseif focus_enemy.nav_tracker then
			my_data.chase_pos = CopLogicAttack._find_flank_pos(data, my_data, focus_enemy.nav_tracker)
		end
	else
		TankCopLogicAttack._cancel_chase_attempt(data, my_data)
	end
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -2,10 +2,12 @@ local t = data.t
 	local unit = data.unit
 	local my_data = data.internal_data
 
-	if my_data.has_old_action then
+	if my_data.has_old_action or my_data.old_action_advancing then
 		CopLogicAttack._upd_stop_old_action(data, my_data)
-
-		return
+		
+		if my_data.has_old_action or my_data.old_action_advancing then
+			return
+		end
 	end
 
 	if CopLogicIdle._chk_relocate(data) then
@@ -25,6 +27,7 @@ local t = data.t
 	TankCopLogicAttack._process_pathing_results(data, my_data)
 
 	local enemy_visible = focus_enemy.verified
+	my_data.attitude = data.objective and data.objective.attitude or "engage"
 	local engage = my_data.attitude == "engage"
 	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos
 
@@ -41,17 +44,16 @@ local t = data.t
 	end
 
 	local enemy_pos = enemy_visible and focus_enemy.m_pos or focus_enemy.verified_pos
-
 	action_taken = CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)
 
 	if action_taken then
 		return
 	end
 
-	local chase
+	local chase = nil
 	local z_dist = math.abs(data.m_pos.z - focus_enemy.m_pos.z)
 
-	if focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
+	if AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
 		if enemy_visible then
 			if z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
 				chase = true
@@ -71,31 +73,31 @@ local t = data.t
 	end
 
 	if chase then
-		if my_data.walking_to_chase_pos then
-			-- Nothing
-		elseif my_data.pathing_to_chase_pos then
-			-- Nothing
-		elseif my_data.chase_path then
-			local dist = focus_enemy.verified_dis
-			local run_dist = focus_enemy.verified and 1500 or 800
-			local walk = dist < run_dist
-
-			TankCopLogicAttack._chk_request_action_walk_to_chase_pos(data, my_data, "run")
-		elseif my_data.chase_pos then
-			my_data.chase_path_search_id = tostring(unit:key()) .. "chase"
-			my_data.pathing_to_chase_pos = true
-
-			local to_pos = my_data.chase_pos
-
-			my_data.chase_pos = nil
-
-			data.brain:add_pos_rsrv("path", {
-				radius = 60,
-				position = mvector3.copy(to_pos)
-			})
-			unit:brain():search_for_path(my_data.chase_path_search_id, to_pos)
-		elseif focus_enemy.nav_tracker then
-			my_data.chase_pos = CopLogicAttack._find_flank_pos(data, my_data, focus_enemy.nav_tracker)
+		if not data.next_mov_time or data.next_mov_time < data.t then
+			if my_data.walking_to_chase_pos then
+				-- Nothing
+			elseif my_data.pathing_to_chase_pos then
+				-- Nothing
+			elseif my_data.chase_path then
+				local dist = focus_enemy.verified_dis
+				local run_dist = focus_enemy.verified and 1500 or 800
+				local walk = dist < run_dist
+
+				TankCopLogicAttack._chk_request_action_walk_to_chase_pos(data, my_data, walk and "walk" or "run")
+			elseif my_data.chase_pos then
+				my_data.chase_path_search_id = tostring(unit:key()) .. "chase"
+				my_data.pathing_to_chase_pos = true
+				local to_pos = my_data.chase_pos
+				my_data.chase_pos = nil
+
+				data.brain:add_pos_rsrv("path", {
+					radius = 60,
+					position = mvector3.copy(to_pos)
+				})
+				unit:brain():search_for_path(my_data.chase_path_search_id, to_pos)
+			elseif focus_enemy.nav_tracker then
+				my_data.chase_pos = CopLogicAttack._find_flank_pos(data, my_data, focus_enemy.nav_tracker)
+			end
 		end
 	else
 		TankCopLogicAttack._cancel_chase_attempt(data, my_data)
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -26,7 +26,7 @@ local t = data.t
 
 	local enemy_visible = focus_enemy.verified
 	local engage = my_data.attitude == "engage"
-	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos
+	local action_taken = my_data.turning or unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos
 
 	if action_taken then
 		return
@@ -49,23 +49,21 @@ local t = data.t
 	end
 
 	local chase
-	local z_dist = math.abs(data.m_pos.z - focus_enemy.m_pos.z)
+	local within_z_distance = math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300
 
 	if focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
 		if enemy_visible then
-			if z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
+			if within_z_distance or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
 				chase = true
 			end
 
 			if focus_enemy.verified_dis < 800 and unit:anim_data().run then
-				local new_action = {
+				unit:brain():action_request({
 					body_part = 2,
 					type = "idle"
-				}
-
-				data.unit:brain():action_request(new_action)
+				})
 			end
-		elseif z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and (not focus_enemy.verified_t or t - focus_enemy.verified_t > 5 or focus_enemy.verified_dis > 700) then
+		elseif within_z_distance or focus_enemy.verified_dis > 2000 or engage and (not focus_enemy.verified_t or t - focus_enemy.verified_t > 5 or focus_enemy.verified_dis > 700) then
 			chase = true
 		end
 	end
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

# Function dossier: lua/coplogics/coplogicattack.lua :: CopLogicAttack.action_complete_clbk

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 101 lines, params `(data, action)`
- 246.1: 47 lines, params `(data, action)`
- 248.2: 47 lines, params `(data, action)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function CopLogicAttack.action_complete_clbk(data, action)
local my_data = data.internal_data
	local action_type = action:type()
	local highperformance = LIES.settings.highperformance

	if action_type == "walk" then
		my_data.advancing = nil
		my_data.old_action_advancing = nil
		my_data.in_cover = nil
		
		CopLogicAttack._cancel_cover_pathing(data, my_data)
		CopLogicAttack._cancel_charge(data, my_data)
		
		if my_data.surprised then
			my_data.surprised = false
		elseif my_data.moving_to_cover then
			if action:expired() then
				my_data.in_cover = my_data.moving_to_cover
				my_data.in_cover[7] = nil
				my_data.cover_enter_t = data.t
				my_data.cover_test_step = 0
				my_data.flank_cover = nil
			end

			my_data.moving_to_cover = nil
		elseif my_data.walking_to_cover_shoot_pos then
			my_data.walking_to_cover_shoot_pos = nil
			my_data.charging = nil
			
			if action:expired() then
				my_data.at_cover_shoot_pos = true
			end
		end
		
		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "act" then
		if not my_data.advancing and action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "shoot" then
		my_data.shooting = nil
	elseif action_type == "turn" then
		my_data.turning = nil
		
		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "heal" then
		CopLogicAttack._cancel_cover_pathing(data, my_data)
		
		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "hurt" or action_type == "healed" then
		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if action:expired() and not highperformance then
			if data.is_converted or not CopLogicBase.chk_start_action_dodge(data, "hit") then
				if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
					data.logic._update_cover(data)
					data.logic._upd_combat_movement(data)
					data.logic._upd_aim(data, my_data)
				end
			end
		end
	elseif action_type == "dodge" then
		local timeout = action:timeout()

		if timeout then
			data.dodge_timeout_t = TimerManager:game():time() + math.lerp(timeout[1], timeout[2], math.random())
		end

		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	end
end
```

## 246.1 vanilla (a3180fc)

```lua
function CopLogicAttack.action_complete_clbk(data, action)
local my_data = data.internal_data
	local action_type = action:type()

	if action_type == "walk" then
		my_data.advancing = nil

		CopLogicAttack._cancel_cover_pathing(data, my_data)
		CopLogicAttack._cancel_charge(data, my_data)

		if my_data.surprised then
			my_data.surprised = false
		elseif my_data.moving_to_cover then
			if action:expired() then
				my_data.in_cover = my_data.moving_to_cover
				my_data.cover_enter_t = data.t
			end

			my_data.moving_to_cover = nil
		elseif my_data.walking_to_cover_shoot_pos then
			my_data.walking_to_cover_shoot_pos = nil
			my_data.at_cover_shoot_pos = true
		end
	elseif action_type == "shoot" then
		my_data.shooting = nil
	elseif action_type == "turn" then
		my_data.turning = nil
	elseif action_type == "hurt" then
		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if data.important and action:expired() and not CopLogicBase.chk_start_action_dodge(data, "hit") then
			data.logic._upd_aim(data, my_data)
		end
	elseif action_type == "dodge" then
		local timeout = action:timeout()

		if timeout then
			data.dodge_timeout_t = TimerManager:game():time() + math.lerp(timeout[1], timeout[2], math.random())
		end

		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if action:expired() then
			CopLogicAttack._upd_aim(data, my_data)
		end
	end
end
```

## 248.2 vanilla (e3a8b616)

```lua
function CopLogicAttack.action_complete_clbk(data, action)
local my_data = data.internal_data
	local action_type = action:type()

	if action_type == "walk" then
		my_data.advancing = nil

		CopLogicAttack._cancel_cover_pathing(data, my_data)
		CopLogicAttack._cancel_charge(data, my_data)

		if my_data.surprised then
			my_data.surprised = false
		elseif my_data.moving_to_cover then
			if action:expired() then
				my_data.in_cover = my_data.moving_to_cover
				my_data.cover_enter_t = data.t
			end

			my_data.moving_to_cover = nil
		elseif my_data.walking_to_cover_shoot_pos then
			my_data.walking_to_cover_shoot_pos = nil
			my_data.at_cover_shoot_pos = true
		end
	elseif action_type == "shoot" then
		my_data.shooting = nil
	elseif action_type == "turn" then
		my_data.turning = nil
	elseif action_type == "hurt" then
		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if data.important and action:expired() and not CopLogicBase.chk_start_action_dodge(data, "hit") then
			data.logic._upd_aim(data, my_data)
		end
	elseif action_type == "dodge" then
		local timeout = action:timeout()

		if timeout then
			data.dodge_timeout_t = TimerManager:game():time() + math.rand(timeout[1], timeout[2])
		end

		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if action:expired() then
			CopLogicAttack._upd_aim(data, my_data)
		end
	end
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,34 +1,84 @@
 local my_data = data.internal_data
 	local action_type = action:type()
+	local highperformance = LIES.settings.highperformance
 
 	if action_type == "walk" then
 		my_data.advancing = nil
-
+		my_data.old_action_advancing = nil
+		my_data.in_cover = nil
+		
 		CopLogicAttack._cancel_cover_pathing(data, my_data)
 		CopLogicAttack._cancel_charge(data, my_data)
-
+		
 		if my_data.surprised then
 			my_data.surprised = false
 		elseif my_data.moving_to_cover then
 			if action:expired() then
 				my_data.in_cover = my_data.moving_to_cover
+				my_data.in_cover[7] = nil
 				my_data.cover_enter_t = data.t
+				my_data.cover_test_step = 0
+				my_data.flank_cover = nil
 			end
 
 			my_data.moving_to_cover = nil
 		elseif my_data.walking_to_cover_shoot_pos then
 			my_data.walking_to_cover_shoot_pos = nil
-			my_data.at_cover_shoot_pos = true
+			my_data.charging = nil
+			
+			if action:expired() then
+				my_data.at_cover_shoot_pos = true
+			end
+		end
+		
+		if action:expired() and not highperformance then
+			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
+				data.logic._update_cover(data)
+				data.logic._upd_combat_movement(data)
+				data.logic._upd_aim(data, my_data)
+			end
+		end
+	elseif action_type == "act" then
+		if not my_data.advancing and action:expired() and not highperformance then
+			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
+				data.logic._update_cover(data)
+				data.logic._upd_combat_movement(data)
+				data.logic._upd_aim(data, my_data)
+			end
 		end
 	elseif action_type == "shoot" then
 		my_data.shooting = nil
 	elseif action_type == "turn" then
 		my_data.turning = nil
-	elseif action_type == "hurt" then
+		
+		if action:expired() and not highperformance then
+			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
+				data.logic._update_cover(data)
+				data.logic._upd_combat_movement(data)
+				data.logic._upd_aim(data, my_data)
+			end
+		end
+	elseif action_type == "heal" then
+		CopLogicAttack._cancel_cover_pathing(data, my_data)
+		
+		if action:expired() and not highperformance then
+			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
+				data.logic._update_cover(data)
+				data.logic._upd_combat_movement(data)
+				data.logic._upd_aim(data, my_data)
+			end
+		end
+	elseif action_type == "hurt" or action_type == "healed" then
 		CopLogicAttack._cancel_cover_pathing(data, my_data)
 
-		if data.important and action:expired() and not CopLogicBase.chk_start_action_dodge(data, "hit") then
-			data.logic._upd_aim(data, my_data)
+		if action:expired() and not highperformance then
+			if data.is_converted or not CopLogicBase.chk_start_action_dodge(data, "hit") then
+				if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
+					data.logic._update_cover(data)
+					data.logic._upd_combat_movement(data)
+					data.logic._upd_aim(data, my_data)
+				end
+			end
 		end
 	elseif action_type == "dodge" then
 		local timeout = action:timeout()
@@ -39,8 +89,12 @@ local my_data = data.internal_data
 
 		CopLogicAttack._cancel_cover_pathing(data, my_data)
 
-		if action:expired() then
-			CopLogicAttack._upd_aim(data, my_data)
+		if action:expired() and not highperformance then
+			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
+				data.logic._update_cover(data)
+				data.logic._upd_combat_movement(data)
+				data.logic._upd_aim(data, my_data)
+			end
 		end
 	end
 end
\ No newline at end of file
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -34,7 +34,7 @@ local my_data = data.internal_data
 		local timeout = action:timeout()
 
 		if timeout then
-			data.dodge_timeout_t = TimerManager:game():time() + math.lerp(timeout[1], timeout[2], math.random())
+			data.dodge_timeout_t = TimerManager:game():time() + math.rand(timeout[1], timeout[2])
 		end
 
 		CopLogicAttack._cancel_cover_pathing(data, my_data)
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

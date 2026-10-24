# Function dossier: lua/coplogics/specials/taserlogicattack.lua :: TaserLogicAttack._upd_enemy_detection

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 75 lines, params `(data)`
- 246.1: 74 lines, params `(data)`
- 248.2: 74 lines, params `(data)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function TaserLogicAttack._upd_enemy_detection(data)
managers.groupai:state():on_unit_detection_updated(data.unit)

	data.t = TimerManager:game():time()
	local my_data = data.internal_data
	local min_reaction = AIAttentionObject.REACT_AIM

	local delay = CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)

	local tasing = my_data.tasing
	local tased_u_key = tasing and tasing.target_u_key
	local under_fire_nr = 0
	local under_multiple_fire = nil
	local alert_chk_t = data.t - 1.2

	for key, enemy_data in pairs(data.detected_attention_objects) do
		if tased_u_key ~= key and enemy_data.dmg_t and alert_chk_t < enemy_data.dmg_t then
			under_fire_nr = under_fire_nr + 1

			if under_fire_nr > 2 then
				under_multiple_fire = true

				break
			end
		end
	end

	local find_new_focus_enemy = nil
	local tase_in_effect = tasing and tasing.target_u_data.unit:movement():tased()

	if tase_in_effect then
		if under_multiple_fire then
			find_new_focus_enemy = true
		end
	else
		find_new_focus_enemy = true
	end

	if not find_new_focus_enemy then
		return delay
	end

	local new_attention, new_prio_slot, new_reaction = CopLogicIdle._get_priority_attention(data, data.detected_attention_objects, TaserLogicAttack._chk_reaction_to_attention_object)
	local old_att_obj = data.attention_obj

	CopLogicBase._set_attention_obj(data, new_attention, new_reaction)
	CopLogicAttack._chk_exit_attack_logic(data, new_reaction)

	if my_data ~= data.internal_data then
		return delay
	end

	if new_attention then
		if old_att_obj then
			if old_att_obj.u_key ~= new_attention.u_key then
				CopLogicAttack._cancel_charge(data, my_data)

				if not data.unit:movement():chk_action_forbidden("walk") then
					CopLogicAttack._cancel_walking_to_cover(data, my_data)
				end

				CopLogicAttack._set_best_cover(data, my_data, nil)
				TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, new_attention)
			end
		else
			TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, new_attention)
		end
	elseif old_att_obj then
		CopLogicAttack._cancel_charge(data, my_data)
	end

	TaserLogicAttack._upd_aim(data, my_data, new_reaction)
	
	return delay
end
```

## 246.1 vanilla (a3180fc)

```lua
function TaserLogicAttack._upd_enemy_detection(data)
managers.groupai:state():on_unit_detection_updated(data.unit)

	data.t = TimerManager:game():time()

	local my_data = data.internal_data
	local min_reaction = AIAttentionObject.REACT_AIM

	CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)

	local tasing = my_data.tasing
	local tased_u_key = tasing and tasing.target_u_key
	local under_fire_nr = 0
	local under_multiple_fire
	local alert_chk_t = data.t - 1.2

	for key, enemy_data in pairs(data.detected_attention_objects) do
		if tased_u_key ~= key and enemy_data.dmg_t and alert_chk_t < enemy_data.dmg_t then
			under_fire_nr = under_fire_nr + 1

			if under_fire_nr > 2 then
				under_multiple_fire = true

				break
			end
		end
	end

	local find_new_focus_enemy
	local tase_in_effect = tasing and tasing.target_u_data.unit:movement():tased()

	if tase_in_effect or tasing and data.t - tasing.start_t < math.max(1, data.char_tweak.weapon.is_rifle.aim_delay_tase[2] * 1.5) then
		if under_multiple_fire then
			find_new_focus_enemy = true
		end
	else
		find_new_focus_enemy = true
	end

	if not find_new_focus_enemy then
		return
	end

	local new_attention, new_prio_slot, new_reaction = CopLogicIdle._get_priority_attention(data, data.detected_attention_objects, TaserLogicAttack._chk_reaction_to_attention_object)
	local old_att_obj = data.attention_obj

	CopLogicBase._set_attention_obj(data, new_attention, new_reaction)
	CopLogicAttack._chk_exit_attack_logic(data, new_reaction)

	if my_data ~= data.internal_data then
		return
	end

	if new_attention then
		if old_att_obj then
			if old_att_obj.u_key ~= new_attention.u_key then
				CopLogicAttack._cancel_charge(data, my_data)

				if not data.unit:movement():chk_action_forbidden("walk") then
					CopLogicAttack._cancel_walking_to_cover(data, my_data)
				end

				CopLogicAttack._set_best_cover(data, my_data, nil)
				TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, new_attention)
			end
		else
			TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, new_attention)
		end
	elseif old_att_obj then
		CopLogicAttack._cancel_charge(data, my_data)
	end

	TaserLogicAttack._upd_aim(data, my_data, new_reaction)
end
```

## 248.2 vanilla (e3a8b616)

```lua
function TaserLogicAttack._upd_enemy_detection(data)
managers.groupai:state():on_unit_detection_updated(data.unit)

	data.t = TimerManager:game():time()

	local my_data = data.internal_data
	local min_reaction = AIAttentionObject.REACT_AIM

	CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)

	local tasing = my_data.tasing
	local tased_u_key = tasing and tasing.target_u_key
	local under_multiple_fire
	local under_fire_nr = 0
	local alert_chk_t = data.t - 1.2

	for key, enemy_data in pairs(data.detected_attention_objects) do
		if tased_u_key ~= key and enemy_data.dmg_t and alert_chk_t < enemy_data.dmg_t then
			under_fire_nr = under_fire_nr + 1

			if under_fire_nr > 2 then
				under_multiple_fire = true

				break
			end
		end
	end

	local find_new_focus_enemy
	local tase_in_effect = tasing and tasing.target_u_data.unit:movement():tased()

	if tase_in_effect or tasing and data.t - tasing.start_t < math.max(1, data.char_tweak.weapon.is_rifle.aim_delay_tase[2] * 1.5) then
		if under_multiple_fire then
			find_new_focus_enemy = true
		end
	else
		find_new_focus_enemy = true
	end

	if not find_new_focus_enemy then
		return
	end

	local new_attention, new_prio_slot, new_reaction = CopLogicIdle._get_priority_attention(data, data.detected_attention_objects, TaserLogicAttack._chk_reaction_to_attention_object)
	local old_att_obj = data.attention_obj

	CopLogicBase._set_attention_obj(data, new_attention, new_reaction)
	CopLogicAttack._chk_exit_attack_logic(data, new_reaction)

	if my_data ~= data.internal_data then
		return
	end

	if new_attention then
		if old_att_obj then
			if old_att_obj.u_key ~= new_attention.u_key then
				CopLogicAttack._cancel_charge(data, my_data)

				if not data.unit:movement():chk_action_forbidden("walk") then
					CopLogicAttack._cancel_walking_to_cover(data, my_data)
				end

				CopLogicAttack._set_best_cover(data, my_data, nil)
				TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, new_attention)
			end
		else
			TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, new_attention)
		end
	elseif old_att_obj then
		CopLogicAttack._cancel_charge(data, my_data)
	end

	TaserLogicAttack._upd_aim(data, my_data, new_reaction)
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,16 +1,15 @@
 managers.groupai:state():on_unit_detection_updated(data.unit)
 
 	data.t = TimerManager:game():time()
-
 	local my_data = data.internal_data
 	local min_reaction = AIAttentionObject.REACT_AIM
 
-	CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)
+	local delay = CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)
 
 	local tasing = my_data.tasing
 	local tased_u_key = tasing and tasing.target_u_key
 	local under_fire_nr = 0
-	local under_multiple_fire
+	local under_multiple_fire = nil
 	local alert_chk_t = data.t - 1.2
 
 	for key, enemy_data in pairs(data.detected_attention_objects) do
@@ -25,10 +24,10 @@ managers.groupai:state():on_unit_detection_updated(data.unit)
 		end
 	end
 
-	local find_new_focus_enemy
+	local find_new_focus_enemy = nil
 	local tase_in_effect = tasing and tasing.target_u_data.unit:movement():tased()
 
-	if tase_in_effect or tasing and data.t - tasing.start_t < math.max(1, data.char_tweak.weapon.is_rifle.aim_delay_tase[2] * 1.5) then
+	if tase_in_effect then
 		if under_multiple_fire then
 			find_new_focus_enemy = true
 		end
@@ -37,7 +36,7 @@ managers.groupai:state():on_unit_detection_updated(data.unit)
 	end
 
 	if not find_new_focus_enemy then
-		return
+		return delay
 	end
 
 	local new_attention, new_prio_slot, new_reaction = CopLogicIdle._get_priority_attention(data, data.detected_attention_objects, TaserLogicAttack._chk_reaction_to_attention_object)
@@ -47,7 +46,7 @@ managers.groupai:state():on_unit_detection_updated(data.unit)
 	CopLogicAttack._chk_exit_attack_logic(data, new_reaction)
 
 	if my_data ~= data.internal_data then
-		return
+		return delay
 	end
 
 	if new_attention then
@@ -70,4 +69,6 @@ managers.groupai:state():on_unit_detection_updated(data.unit)
 	end
 
 	TaserLogicAttack._upd_aim(data, my_data, new_reaction)
+	
+	return delay
 end
\ No newline at end of file
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -9,8 +9,8 @@ managers.groupai:state():on_unit_detection_updated(data.unit)
 
 	local tasing = my_data.tasing
 	local tased_u_key = tasing and tasing.target_u_key
-	local under_fire_nr = 0
 	local under_multiple_fire
+	local under_fire_nr = 0
 	local alert_chk_t = data.t - 1.2
 
 	for key, enemy_data in pairs(data.detected_attention_objects) do
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

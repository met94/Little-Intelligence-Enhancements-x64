# Function dossier: lua/coplogics/coplogicidle.lua :: CopLogicIdle.damage_clbk

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 61 lines, params `(data, damage_info)`
- 246.1: 69 lines, params `(data, damage_info)`
- 248.2: 69 lines, params `(data, damage_info)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function CopLogicIdle.damage_clbk(data, damage_info)
local enemy = damage_info.attacker_unit
	local enemy_data = nil

	if enemy and enemy:in_slot(data.enemy_slotmask) then
		local my_data = data.internal_data
		local enemy_key = enemy:key()
		enemy_data = data.detected_attention_objects[enemy_key]
		local t = TimerManager:game():time()

		if enemy_data then
			enemy_data.dmg_t = t
			enemy_data.alert_t = t
			enemy_data.notice_delay = nil

			if not enemy_data.identified then
				enemy_data.identified = true
				enemy_data.identified_t = t
				enemy_data.notice_progress = nil
				enemy_data.prev_notice_chk_t = nil

				if enemy_data.settings.notice_clbk then
					enemy_data.settings.notice_clbk(data.unit, true)
				end

				data.logic.on_attention_obj_identified(data, enemy_key, enemy_data)
			end
		else
			local attention_info = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str)[enemy_key]

			if attention_info then
				local settings = attention_info.handler:get_attention(data.SO_access, nil, nil, data.team)

				if settings then
					enemy_data = CopLogicBase.identify_attention_obj_instant(data, enemy_key)
					enemy_data.dmg_t = t
					enemy_data.alert_t = t
					enemy_data.identified = true
					enemy_data.identified_t = t
					enemy_data.notice_progress = nil
					enemy_data.prev_notice_chk_t = nil

					if enemy_data.settings.notice_clbk then
						enemy_data.settings.notice_clbk(data.unit, true)
					end

					data.detected_attention_objects[enemy_key] = enemy_data

					data.logic.on_attention_obj_identified(data, enemy_key, enemy_data)
				end
			end
		end
	end

	if enemy_data and enemy_data.criminal_record then
		if data.group then
			managers.groupai:state():criminal_spotted(enemy, true)
			managers.groupai:state():report_aggression(enemy)
		end
	end
end
```

## 246.1 vanilla (a3180fc)

```lua
function CopLogicIdle.damage_clbk(data, damage_info)
local enemy = damage_info.attacker_unit
	local enemy_data

	if enemy and enemy:in_slot(data.enemy_slotmask) then
		local my_data = data.internal_data
		local enemy_key = enemy:key()

		enemy_data = data.detected_attention_objects[enemy_key]

		local t = TimerManager:game():time()

		if enemy_data then
			enemy_data.verified_t = t
			enemy_data.verified = true

			mvector3.set(enemy_data.verified_pos, enemy:movement():m_stand_pos())

			enemy_data.verified_dis = mvector3.distance(enemy_data.verified_pos, data.unit:movement():m_stand_pos())
			enemy_data.dmg_t = t
			enemy_data.alert_t = t
			enemy_data.notice_delay = nil

			if not enemy_data.identified then
				enemy_data.identified = true
				enemy_data.identified_t = t
				enemy_data.notice_progress = nil
				enemy_data.prev_notice_chk_t = nil

				if enemy_data.settings.notice_clbk then
					enemy_data.settings.notice_clbk(data.unit, true)
				end

				data.logic.on_attention_obj_identified(data, enemy_key, enemy_data)
			end
		else
			local attention_info = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str)[enemy_key]

			if attention_info then
				local settings = attention_info.handler:get_attention(data.SO_access, nil, nil, data.team)

				if settings then
					enemy_data = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, enemy_key, attention_info, settings)
					enemy_data.verified_t = t
					enemy_data.verified = true
					enemy_data.dmg_t = t
					enemy_data.alert_t = t
					enemy_data.identified = true
					enemy_data.identified_t = t
					enemy_data.notice_progress = nil
					enemy_data.prev_notice_chk_t = nil

					if enemy_data.settings.notice_clbk then
						enemy_data.settings.notice_clbk(data.unit, true)
					end

					data.detected_attention_objects[enemy_key] = enemy_data

					data.logic.on_attention_obj_identified(data, enemy_key, enemy_data)
				end
			end
		end
	end

	if enemy_data and enemy_data.criminal_record then
		managers.groupai:state():criminal_spotted(enemy)
		managers.groupai:state():report_aggression(enemy)
	end
end
```

## 248.2 vanilla (e3a8b616)

```lua
function CopLogicIdle.damage_clbk(data, damage_info)
local enemy = damage_info.attacker_unit
	local enemy_data

	if enemy and enemy:in_slot(data.enemy_slotmask) then
		local my_data = data.internal_data
		local enemy_key = enemy:key()

		enemy_data = data.detected_attention_objects[enemy_key]

		local t = TimerManager:game():time()

		if enemy_data then
			enemy_data.verified_t = t
			enemy_data.verified = true

			mvector3.set(enemy_data.verified_pos, enemy:movement():m_stand_pos())

			enemy_data.verified_dis = mvector3.distance(enemy_data.verified_pos, data.unit:movement():m_stand_pos())
			enemy_data.dmg_t = t
			enemy_data.alert_t = t
			enemy_data.notice_delay = nil

			if not enemy_data.identified then
				enemy_data.identified = true
				enemy_data.identified_t = t
				enemy_data.notice_progress = nil
				enemy_data.prev_notice_chk_t = nil

				if enemy_data.settings.notice_clbk then
					enemy_data.settings.notice_clbk(data.unit, true)
				end

				data.logic.on_attention_obj_identified(data, enemy_key, enemy_data)
			end
		else
			local attention_info = managers.groupai:state():get_AI_attention_objects_by_filter(data.SO_access_str)[enemy_key]

			if attention_info then
				local settings = attention_info.handler:get_attention(data.SO_access, nil, nil, data.team)

				if settings then
					enemy_data = CopLogicBase._create_detected_attention_object_data(t, data.unit, enemy_key, attention_info, settings)
					enemy_data.verified_t = t
					enemy_data.verified = true
					enemy_data.dmg_t = t
					enemy_data.alert_t = t
					enemy_data.identified = true
					enemy_data.identified_t = t
					enemy_data.notice_progress = nil
					enemy_data.prev_notice_chk_t = nil

					if enemy_data.settings.notice_clbk then
						enemy_data.settings.notice_clbk(data.unit, true)
					end

					data.detected_attention_objects[enemy_key] = enemy_data

					data.logic.on_attention_obj_identified(data, enemy_key, enemy_data)
				end
			end
		end
	end

	if enemy_data and enemy_data.criminal_record then
		managers.groupai:state():criminal_spotted(enemy)
		managers.groupai:state():report_aggression(enemy)
	end
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,21 +1,13 @@
 local enemy = damage_info.attacker_unit
-	local enemy_data
+	local enemy_data = nil
 
 	if enemy and enemy:in_slot(data.enemy_slotmask) then
 		local my_data = data.internal_data
 		local enemy_key = enemy:key()
-
 		enemy_data = data.detected_attention_objects[enemy_key]
-
 		local t = TimerManager:game():time()
 
 		if enemy_data then
-			enemy_data.verified_t = t
-			enemy_data.verified = true
-
-			mvector3.set(enemy_data.verified_pos, enemy:movement():m_stand_pos())
-
-			enemy_data.verified_dis = mvector3.distance(enemy_data.verified_pos, data.unit:movement():m_stand_pos())
 			enemy_data.dmg_t = t
 			enemy_data.alert_t = t
 			enemy_data.notice_delay = nil
@@ -39,9 +31,7 @@ local enemy = damage_info.attacker_unit
 				local settings = attention_info.handler:get_attention(data.SO_access, nil, nil, data.team)
 
 				if settings then
-					enemy_data = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, enemy_key, attention_info, settings)
-					enemy_data.verified_t = t
-					enemy_data.verified = true
+					enemy_data = CopLogicBase.identify_attention_obj_instant(data, enemy_key)
 					enemy_data.dmg_t = t
 					enemy_data.alert_t = t
 					enemy_data.identified = true
@@ -62,7 +52,9 @@ local enemy = damage_info.attacker_unit
 	end
 
 	if enemy_data and enemy_data.criminal_record then
-		managers.groupai:state():criminal_spotted(enemy)
-		managers.groupai:state():report_aggression(enemy)
+		if data.group then
+			managers.groupai:state():criminal_spotted(enemy, true)
+			managers.groupai:state():report_aggression(enemy)
+		end
 	end
 end
\ No newline at end of file
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -39,7 +39,7 @@ local enemy = damage_info.attacker_unit
 				local settings = attention_info.handler:get_attention(data.SO_access, nil, nil, data.team)
 
 				if settings then
-					enemy_data = CopLogicBase._create_detected_attention_object_data(data.t, data.unit, enemy_key, attention_info, settings)
+					enemy_data = CopLogicBase._create_detected_attention_object_data(t, data.unit, enemy_key, attention_info, settings)
 					enemy_data.verified_t = t
 					enemy_data.verified = true
 					enemy_data.dmg_t = t
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

# Function dossier: lua/groupaistate/groupaistatebesiege.lua :: GroupAIStateBesiege._upd_police_activity

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 52 lines, params `()`
- 246.1: 28 lines, params `()`
- 248.2: 22 lines, params `()`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function GroupAIStateBesiege._upd_police_activity()
self._police_upd_task_queued = false

	if self._police_activity_blocked then
		return
	end
	
	if not self._last_upd_t then
		self._last_upd_t = self._t
	end

	if self._ai_enabled then
		self:_upd_SO()
		self:_upd_grp_SO()
		self:_check_spawn_phalanx()
		self:_check_phalanx_group_has_spawned()
		self:_check_phalanx_damage_reduction_increase()

		if self._enemy_weapons_hot then
			
			--in vanilla, if a group gets partially spawned in one update,
			--the next update might result in groupai not adding a new group to spawn 
			--until after that update because the group spawning gets updated late
			--kind of a picky thing to get hung up on but it kinda bothers me so i fixed it here
			local updated_group_spawning = nil
			
			if next(self._spawning_groups) then
				self:_upd_group_spawning()
				
				updated_group_spawning = true
			end
			
			self:_claculate_drama_value()
			self:_update_criminal_reveal()
			self:_upd_regroup_task()
			self:_upd_reenforce_tasks()
			self:_upd_recon_tasks()
			self:_upd_assault_task()
			self:_begin_new_tasks()
			
			if not updated_group_spawning then
				self:_upd_group_spawning()
			end
			
			self:_upd_groups()
		end
		
		self._last_upd_t = self._t
	end

	self:_queue_police_upd_task()
end
```

## 246.1 vanilla (a3180fc)

```lua
function GroupAIStateBesiege._upd_police_activity()
self._police_upd_task_queued = false

	if self._police_activity_blocked then
		return
	end

	if self._ai_enabled then
		self:_upd_SO()
		self:_upd_grp_SO()
		self:_check_spawn_phalanx()
		self:_check_phalanx_group_has_spawned()
		self:_check_phalanx_damage_reduction_increase()

		if self._enemy_weapons_hot then
			self:_claculate_drama_value()
			self:_upd_regroup_task()
			self:_upd_reenforce_tasks()
			self:_upd_recon_tasks()
			self:_upd_assault_task()
			self:_begin_new_tasks()
			self:_upd_group_spawning()
			self:_upd_groups()
		end
	end

	self:_queue_police_upd_task()
end
```

## 248.2 vanilla (e3a8b616)

```lua
function GroupAIStateBesiege._upd_police_activity()
if not self._ai_enabled or self._police_activity_blocked then
		return
	end

	self:_upd_SO()
	self:_upd_grp_SO()
	self:_check_spawn_phalanx()
	self:_check_phalanx_group_has_spawned()
	self:_check_phalanx_damage_reduction_increase()

	if self._enemy_weapons_hot then
		self:_claculate_drama_value()
		self:_upd_regroup_task()
		self:_upd_reenforce_tasks()
		self:_upd_recon_tasks()
		self:_upd_assault_task()
		self:_begin_new_tasks()
		self:_upd_group_spawning()
		self:_upd_groups()
	end
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -3,6 +3,10 @@ self._police_upd_task_queued = false
 	if self._police_activity_blocked then
 		return
 	end
+	
+	if not self._last_upd_t then
+		self._last_upd_t = self._t
+	end
 
 	if self._ai_enabled then
 		self:_upd_SO()
@@ -12,15 +16,35 @@ self._police_upd_task_queued = false
 		self:_check_phalanx_damage_reduction_increase()
 
 		if self._enemy_weapons_hot then
+			
+			--in vanilla, if a group gets partially spawned in one update,
+			--the next update might result in groupai not adding a new group to spawn 
+			--until after that update because the group spawning gets updated late
+			--kind of a picky thing to get hung up on but it kinda bothers me so i fixed it here
+			local updated_group_spawning = nil
+			
+			if next(self._spawning_groups) then
+				self:_upd_group_spawning()
+				
+				updated_group_spawning = true
+			end
+			
 			self:_claculate_drama_value()
+			self:_update_criminal_reveal()
 			self:_upd_regroup_task()
 			self:_upd_reenforce_tasks()
 			self:_upd_recon_tasks()
 			self:_upd_assault_task()
 			self:_begin_new_tasks()
-			self:_upd_group_spawning()
+			
+			if not updated_group_spawning then
+				self:_upd_group_spawning()
+			end
+			
 			self:_upd_groups()
 		end
+		
+		self._last_upd_t = self._t
 	end
 
 	self:_queue_police_upd_task()
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -1,27 +1,21 @@
-self._police_upd_task_queued = false
-
-	if self._police_activity_blocked then
+if not self._ai_enabled or self._police_activity_blocked then
 		return
 	end
 
-	if self._ai_enabled then
-		self:_upd_SO()
-		self:_upd_grp_SO()
-		self:_check_spawn_phalanx()
-		self:_check_phalanx_group_has_spawned()
-		self:_check_phalanx_damage_reduction_increase()
+	self:_upd_SO()
+	self:_upd_grp_SO()
+	self:_check_spawn_phalanx()
+	self:_check_phalanx_group_has_spawned()
+	self:_check_phalanx_damage_reduction_increase()
 
-		if self._enemy_weapons_hot then
-			self:_claculate_drama_value()
-			self:_upd_regroup_task()
-			self:_upd_reenforce_tasks()
-			self:_upd_recon_tasks()
-			self:_upd_assault_task()
-			self:_begin_new_tasks()
-			self:_upd_group_spawning()
-			self:_upd_groups()
-		end
+	if self._enemy_weapons_hot then
+		self:_claculate_drama_value()
+		self:_upd_regroup_task()
+		self:_upd_reenforce_tasks()
+		self:_upd_recon_tasks()
+		self:_upd_assault_task()
+		self:_begin_new_tasks()
+		self:_upd_group_spawning()
+		self:_upd_groups()
 	end
-
-	self:_queue_police_upd_task()
 end
\ No newline at end of file
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

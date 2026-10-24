# Function dossier: lua/managers/navigationmanager.lua :: NavigationManager.add_obstacle

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 43 lines, params `(obstacle_unit, obstacle_obj_name)`
- 246.1: 20 lines, params `(obstacle_unit, obstacle_obj_name)`
- 248.2: 25 lines, params `(obstacle_unit, obstacle_obj_name)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function NavigationManager.add_obstacle(obstacle_unit, obstacle_obj_name)
if self._debug then
		for i, obs_data in ipairs(self._obstacles) do
			if obstacle_unit == obs_data.unit and obstacle_obj_name == obs_data.obstacle_obj_name then
				debug_pause_unit(obstacle_unit, "[NavigationManager:add_obstacle] obstacle added twice", obstacle_unit, obstacle_obj_name)

				return
			end
		end
	end

	local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)
	
	if self._cached_paths and #self._cached_paths > 0 then
		for i = 1, #self._cached_paths do
			local cached_path_data = self._cached_paths[i]
			
			if cached_path_data then
				local cached_path = cached_path_data.path
			
				for cached_path_i = 1, #cached_path do
					local check_navpoint = cached_path[cached_path_i]
					
					if check_navpoint.x then
						if obstacle_obj:inside_bv(check_navpoint) then
							cached_path_data.invalidated = true
							
							break
						end
					end
				end
			end
		end
	end
	
	local id = self._quad_field:add_obstacle(obstacle_obj)

	table.insert(self._obstacles, {
		unit = obstacle_unit,
		obstacle_obj_name = obstacle_obj_name,
		id = id
	})
end
```

## 246.1 vanilla (a3180fc)

```lua
function NavigationManager.add_obstacle(obstacle_unit, obstacle_obj_name)
if self._debug then
		for i, obs_data in ipairs(self._obstacles) do
			if obstacle_unit == obs_data.unit and obstacle_obj_name == obs_data.obstacle_obj_name then
				debug_pause_unit(obstacle_unit, "[NavigationManager:add_obstacle] obstacle added twice", obstacle_unit, obstacle_obj_name)

				return
			end
		end
	end

	local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)
	local id = self._quad_field:add_obstacle(obstacle_obj)

	table.insert(self._obstacles, {
		unit = obstacle_unit,
		obstacle_obj_name = obstacle_obj_name,
		id = id
	})
end
```

## 248.2 vanilla (e3a8b616)

```lua
function NavigationManager.add_obstacle(obstacle_unit, obstacle_obj_name)
local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)

	if not obstacle_obj then
		Application:error("[NavigationManager:add_obstacle] There was no obj to reference in this unit!", obstacle_unit, obstacle_obj_name, world_id)

		return
	end

	local scriptdata_ext = obstacle_unit:unit_data()

	if scriptdata_ext and scriptdata_ext.add_destroy_listener then
		scriptdata_ext:add_destroy_listener(NavigationManager._OBSTACLE_DESTROY_KEY, callback(self, self, "_clbk_obstacle_unit_destroyed", obstacle_obj_name))
	else
		Application:error("[NavigationManager:add_obstacle] No unit_data extension to listen for destruction!", obstacle_unit)
	end

	local id = self._quad_field:add_obstacle(obstacle_obj)

	table.insert(self._obstacles, {
		id = id,
		unit = obstacle_unit,
		obstacle_obj_name = obstacle_obj_name
	})
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -9,6 +9,29 @@ if self._debug then
 	end
 
 	local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)
+	
+	if self._cached_paths and #self._cached_paths > 0 then
+		for i = 1, #self._cached_paths do
+			local cached_path_data = self._cached_paths[i]
+			
+			if cached_path_data then
+				local cached_path = cached_path_data.path
+			
+				for cached_path_i = 1, #cached_path do
+					local check_navpoint = cached_path[cached_path_i]
+					
+					if check_navpoint.x then
+						if obstacle_obj:inside_bv(check_navpoint) then
+							cached_path_data.invalidated = true
+							
+							break
+						end
+					end
+				end
+			end
+		end
+	end
+	
 	local id = self._quad_field:add_obstacle(obstacle_obj)
 
 	table.insert(self._obstacles, {
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -1,19 +1,24 @@
-if self._debug then
-		for i, obs_data in ipairs(self._obstacles) do
-			if obstacle_unit == obs_data.unit and obstacle_obj_name == obs_data.obstacle_obj_name then
-				debug_pause_unit(obstacle_unit, "[NavigationManager:add_obstacle] obstacle added twice", obstacle_unit, obstacle_obj_name)
+local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)
 
-				return
-			end
-		end
+	if not obstacle_obj then
+		Application:error("[NavigationManager:add_obstacle] There was no obj to reference in this unit!", obstacle_unit, obstacle_obj_name, world_id)
+
+		return
+	end
+
+	local scriptdata_ext = obstacle_unit:unit_data()
+
+	if scriptdata_ext and scriptdata_ext.add_destroy_listener then
+		scriptdata_ext:add_destroy_listener(NavigationManager._OBSTACLE_DESTROY_KEY, callback(self, self, "_clbk_obstacle_unit_destroyed", obstacle_obj_name))
+	else
+		Application:error("[NavigationManager:add_obstacle] No unit_data extension to listen for destruction!", obstacle_unit)
 	end
 
-	local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)
 	local id = self._quad_field:add_obstacle(obstacle_obj)
 
 	table.insert(self._obstacles, {
+		id = id,
 		unit = obstacle_unit,
-		obstacle_obj_name = obstacle_obj_name,
-		id = id
+		obstacle_obj_name = obstacle_obj_name
 	})
 end
\ No newline at end of file
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

# Function dossier: lua/groupaistate/groupaistatebesiege.lua :: GroupAIStateBesiege._queue_police_upd_task

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 17 lines, params `()`
- 246.1: 7 lines, params `()`
- 248.2: 13 lines, params `()`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function GroupAIStateBesiege._queue_police_upd_task()
if not self._police_upd_task_queued then
		self._police_upd_task_queued = true
		
		if Network:is_server() then --essentially, if theres less players, more important enemies are allowed instead of just 3
			if not Global.game_settings.single_player then
				local new_value = 12 / table.size(self:all_player_criminals()) 

				self._nr_important_cops = new_value
			end
		end
		
		--moving this to a delayed callback makes sure it not take up space in the enemy manager tasks
		managers.enemy:add_delayed_clbk("GroupAIStateBesiege._upd_police_activity", callback(self, self, "_upd_police_activity"), self._t + 1)
	end
end
```

## 246.1 vanilla (a3180fc)

```lua
function GroupAIStateBesiege._queue_police_upd_task()
if not self._police_upd_task_queued then
		self._police_upd_task_queued = true

		managers.enemy:queue_task("GroupAIStateBesiege._upd_police_activity", self._upd_police_activity, self, self._t + (next(self._spawning_groups) and 0.4 or 2))
	end
end
```

## 248.2 vanilla (e3a8b616)

```lua
function GroupAIStateBesiege._queue_police_upd_task()
if self._police_upd_task_queued then
		if self._t < self._police_upd_task_queued then
			return
		end

		self:_upd_police_activity()
	end

	local next_upd_t = next(self._spawning_groups) and GroupAIStateBesiege._POLICE_ACTIVITY_DELAY_FAST or GroupAIStateBesiege._POLICE_ACTIVITY_DELAY

	self._police_upd_task_queued = self._t + next_upd_t
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,6 +1,15 @@
 if not self._police_upd_task_queued then
 		self._police_upd_task_queued = true
+		
+		if Network:is_server() then --essentially, if theres less players, more important enemies are allowed instead of just 3
+			if not Global.game_settings.single_player then
+				local new_value = 12 / table.size(self:all_player_criminals()) 
 
-		managers.enemy:queue_task("GroupAIStateBesiege._upd_police_activity", self._upd_police_activity, self, self._t + (next(self._spawning_groups) and 0.4 or 2))
+				self._nr_important_cops = new_value
+			end
+		end
+		
+		--moving this to a delayed callback makes sure it not take up space in the enemy manager tasks
+		managers.enemy:add_delayed_clbk("GroupAIStateBesiege._upd_police_activity", callback(self, self, "_upd_police_activity"), self._t + 1)
 	end
 end
\ No newline at end of file
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -1,6 +1,12 @@
-if not self._police_upd_task_queued then
-		self._police_upd_task_queued = true
+if self._police_upd_task_queued then
+		if self._t < self._police_upd_task_queued then
+			return
+		end
 
-		managers.enemy:queue_task("GroupAIStateBesiege._upd_police_activity", self._upd_police_activity, self, self._t + (next(self._spawning_groups) and 0.4 or 2))
+		self:_upd_police_activity()
 	end
+
+	local next_upd_t = next(self._spawning_groups) and GroupAIStateBesiege._POLICE_ACTIVITY_DELAY_FAST or GroupAIStateBesiege._POLICE_ACTIVITY_DELAY
+
+	self._police_upd_task_queued = self._t + next_upd_t
 end
\ No newline at end of file
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

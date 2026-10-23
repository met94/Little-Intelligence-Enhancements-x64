# Function dossier: lua/groupaistate/groupaistatebesiege.lua :: GroupAIStateBesiege.force_end_assault_phase

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 16 lines, params `(force_regroup)`
- 246.1: 18 lines, params `(force_regroup)`
- 248.2: 20 lines, params `(force_regroup)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function GroupAIStateBesiege.force_end_assault_phase(force_regroup)
local task_data = self._task_data.assault

	if task_data.active then
		task_data.phase = "fade"
		task_data.force_end = true

		if force_regroup then
			task_data.force_regroup = true

			managers.enemy:reschedule_delayed_clbk(GroupAIStateBesiege._upd_police_activity, self._t)
		end
	end

	self:set_assault_endless(false)
end
```

## 246.1 vanilla (a3180fc)

```lua
function GroupAIStateBesiege.force_end_assault_phase(force_regroup)
local task_data = self._task_data.assault

	if task_data.active then
		print("GroupAIStateBesiege:force_end_assault_phase()")

		task_data.phase = "fade"
		task_data.force_end = true

		if force_regroup then
			task_data.force_regroup = true

			managers.enemy:update_queue_task("GroupAIStateBesiege._upd_police_activity", nil, nil, self._t + 0.1, nil, nil)
		end
	end

	self:set_assault_endless(false)
end
```

## 248.2 vanilla (e3a8b616)

```lua
function GroupAIStateBesiege.force_end_assault_phase(force_regroup)
local task_data = self._task_data.assault

	if task_data.active then
		cat_print("groupai", "[GroupAI] GroupAIStateBesiege:force_end_assault_phase - Forcing current assault to end.", force_regroup and "Forcing regroup." or "")

		task_data.phase = "fade"
		task_data.force_end = true

		if force_regroup then
			task_data.force_regroup = true

			if self._police_upd_task_queued then
				self._police_upd_task_queued = self._t + 0.1
			end
		end
	end

	self:set_assault_endless(false)
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,15 +1,13 @@
 local task_data = self._task_data.assault
 
 	if task_data.active then
-		print("GroupAIStateBesiege:force_end_assault_phase()")
-
 		task_data.phase = "fade"
 		task_data.force_end = true
 
 		if force_regroup then
 			task_data.force_regroup = true
 
-			managers.enemy:update_queue_task("GroupAIStateBesiege._upd_police_activity", nil, nil, self._t + 0.1, nil, nil)
+			managers.enemy:reschedule_delayed_clbk(GroupAIStateBesiege._upd_police_activity, self._t)
 		end
 	end
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -1,7 +1,7 @@
 local task_data = self._task_data.assault
 
 	if task_data.active then
-		print("GroupAIStateBesiege:force_end_assault_phase()")
+		cat_print("groupai", "[GroupAI] GroupAIStateBesiege:force_end_assault_phase - Forcing current assault to end.", force_regroup and "Forcing regroup." or "")
 
 		task_data.phase = "fade"
 		task_data.force_end = true
@@ -9,7 +9,9 @@ local task_data = self._task_data.assault
 		if force_regroup then
 			task_data.force_regroup = true
 
-			managers.enemy:update_queue_task("GroupAIStateBesiege._upd_police_activity", nil, nil, self._t + 0.1, nil, nil)
+			if self._police_upd_task_queued then
+				self._police_upd_task_queued = self._t + 0.1
+			end
 		end
 	end
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

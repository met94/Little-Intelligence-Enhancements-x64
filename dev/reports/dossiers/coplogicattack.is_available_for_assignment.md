# Function dossier: lua/coplogics/coplogicattack.lua :: CopLogicAttack.is_available_for_assignment

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 51 lines, params `(data, new_objective)`
- 246.1: 43 lines, params `(data, new_objective)`
- 248.2: 43 lines, params `(data, new_objective)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function CopLogicAttack.is_available_for_assignment(data, new_objective)
local my_data = data.internal_data

	if my_data.exiting then
		return
	end
	
	if new_objective and new_objective.attitude then
		my_data.attitude = new_objective.attitude
	end

	if new_objective and new_objective.forced then
		return true
	end
	
	if new_objective and new_objective.is_default then
		return true
	end

	if data.unit:movement():chk_action_forbidden("walk") then
		return
	end

	if data.path_fail_t and data.t < data.path_fail_t + 3 then
		return
	end
	
	if CopLogicBase.check_sabotage_objective_not_allowed(data, new_objective) then
		return
	end

	local att_obj = data.attention_obj

	if not att_obj or att_obj.reaction < AIAttentionObject.REACT_AIM then
		return true
	end

	if not new_objective or new_objective.type == "free" then
		return true
	end

	if new_objective then
		local allow_trans, obj_fail = CopLogicBase.is_obstructed(data, new_objective, 0.2)

		if obj_fail then
			return
		end
	end

	return true
end
```

## 246.1 vanilla (a3180fc)

```lua
function CopLogicAttack.is_available_for_assignment(data, new_objective)
local my_data = data.internal_data

	if my_data.exiting then
		return
	end

	if new_objective and new_objective.forced then
		return true
	end

	if data.unit:movement():chk_action_forbidden("walk") then
		return
	end

	if data.path_fail_t and data.t < data.path_fail_t + 6 then
		return
	end

	if data.is_suppressed then
		return
	end

	local att_obj = data.attention_obj

	if not att_obj or att_obj.reaction < AIAttentionObject.REACT_AIM then
		return true
	end

	if not new_objective or new_objective.type == "free" then
		return true
	end

	if new_objective then
		local allow_trans, obj_fail = CopLogicBase.is_obstructed(data, new_objective, 0.2)

		if obj_fail then
			return
		end
	end

	return true
end
```

## 248.2 vanilla (e3a8b616)

```lua
function CopLogicAttack.is_available_for_assignment(data, new_objective)
local my_data = data.internal_data

	if my_data.exiting then
		return
	end

	if new_objective and new_objective.forced then
		return true
	end

	if data.is_suppressed then
		return
	end

	if data.unit:movement():chk_action_forbidden("walk") then
		return
	end

	if data.path_fail_t and data.t < data.path_fail_t + 6 then
		return
	end

	local att_obj = data.attention_obj

	if not att_obj or att_obj.reaction < AIAttentionObject.REACT_AIM then
		return true
	end

	if not new_objective or new_objective.type == "free" then
		return true
	end

	if new_objective then
		local allow_trans, obj_fail = CopLogicBase.is_obstructed(data, new_objective, 0.2)

		if obj_fail then
			return
		end
	end

	return true
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -3,20 +3,28 @@ local my_data = data.internal_data
 	if my_data.exiting then
 		return
 	end
+	
+	if new_objective and new_objective.attitude then
+		my_data.attitude = new_objective.attitude
+	end
 
 	if new_objective and new_objective.forced then
 		return true
 	end
+	
+	if new_objective and new_objective.is_default then
+		return true
+	end
 
 	if data.unit:movement():chk_action_forbidden("walk") then
 		return
 	end
 
-	if data.path_fail_t and data.t < data.path_fail_t + 6 then
+	if data.path_fail_t and data.t < data.path_fail_t + 3 then
 		return
 	end
-
-	if data.is_suppressed then
+	
+	if CopLogicBase.check_sabotage_objective_not_allowed(data, new_objective) then
 		return
 	end
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -8,15 +8,15 @@ local my_data = data.internal_data
 		return true
 	end
 
-	if data.unit:movement():chk_action_forbidden("walk") then
+	if data.is_suppressed then
 		return
 	end
 
-	if data.path_fail_t and data.t < data.path_fail_t + 6 then
+	if data.unit:movement():chk_action_forbidden("walk") then
 		return
 	end
 
-	if data.is_suppressed then
+	if data.path_fail_t and data.t < data.path_fail_t + 6 then
 		return
 	end
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

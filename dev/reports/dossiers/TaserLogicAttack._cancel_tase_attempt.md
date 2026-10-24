# Function dossier: lua/coplogics/specials/taserlogicattack.lua :: TaserLogicAttack._cancel_tase_attempt

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 12 lines, params `(data, my_data)`
- 246.1: 10 lines, params `(data, my_data)`
- 248.2: 8 lines, params `(data, my_data)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function TaserLogicAttack._cancel_tase_attempt(data, my_data)
my_data.tasing = nil

	if my_data.tasing_action then
		local new_action = {
			body_part = 3,
			type = "idle"
		}

		data.unit:brain():action_request(new_action)
	end
end
```

## 246.1 vanilla (a3180fc)

```lua
function TaserLogicAttack._cancel_tase_attempt(data, my_data)
if my_data.tasing then
		local new_action = {
			body_part = 3,
			type = "idle"
		}

		data.unit:brain():action_request(new_action)
	end
end
```

## 248.2 vanilla (e3a8b616)

```lua
function TaserLogicAttack._cancel_tase_attempt(data, my_data)
if my_data.tasing then
		data.unit:brain():action_request({
			body_part = 3,
			type = "idle"
		})
	end
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,4 +1,6 @@
-if my_data.tasing then
+my_data.tasing = nil
+
+	if my_data.tasing_action then
 		local new_action = {
 			body_part = 3,
 			type = "idle"
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -1,9 +1,7 @@
 if my_data.tasing then
-		local new_action = {
+		data.unit:brain():action_request({
 			body_part = 3,
 			type = "idle"
-		}
-
-		data.unit:brain():action_request(new_action)
+		})
 	end
 end
\ No newline at end of file
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

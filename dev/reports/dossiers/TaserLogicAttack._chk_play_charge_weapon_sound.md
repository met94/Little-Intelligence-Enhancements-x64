# Function dossier: lua/coplogics/specials/taserlogicattack.lua :: TaserLogicAttack._chk_play_charge_weapon_sound

Category: **LIES_EDIT_VANILLA_CHANGED**

- LIES: 7 lines, params `(data, my_data, focus_enemy)`
- 246.1: 7 lines, params `(data, my_data, focus_enemy)`
- 248.2: 7 lines, params `(data, my_data, focus_enemy)`

Normalized signature: `self` is omitted for methods; the body is the porting surface.

## LIES body (V8.57)

```lua
function TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, focus_enemy)
if not my_data.tasing_action and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > math.lerp(15, 30, focus_enemy.verified_dis / 3000)) and focus_enemy.verified_dis < 3000 then
		data.last_charge_snd_play_t = data.t

		data.unit:sound():play("taser_charge", nil, true)
	end
end
```

## 246.1 vanilla (a3180fc)

```lua
function TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, focus_enemy)
if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 30) and focus_enemy.verified_dis < 2000 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
		data.last_charge_snd_play_t = data.t

		data.unit:sound():play("taser_charge", nil, true)
	end
end
```

## 248.2 vanilla (e3a8b616)

```lua
function TaserLogicAttack._chk_play_charge_weapon_sound(data, my_data, focus_enemy)
if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 3) and focus_enemy.verified_dis < data.internal_data.tase_distance * 2 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
		data.last_charge_snd_play_t = data.t

		data.unit:sound():play("taser_charge", nil, true)
	end
end
```

## Diff 246.1 -> LIES

```diff
--- 246.1 vanilla
+++ LIES
@@ -1,4 +1,4 @@
-if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 30) and focus_enemy.verified_dis < 2000 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
+if not my_data.tasing_action and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > math.lerp(15, 30, focus_enemy.verified_dis / 3000)) and focus_enemy.verified_dis < 3000 then
 		data.last_charge_snd_play_t = data.t
 
 		data.unit:sound():play("taser_charge", nil, true)
```

## Diff 246.1 -> 248.2

```diff
--- 246.1 vanilla
+++ 248.2 vanilla
@@ -1,4 +1,4 @@
-if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 30) and focus_enemy.verified_dis < 2000 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
+if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 3) and focus_enemy.verified_dis < data.internal_data.tase_distance * 2 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
 		data.last_charge_snd_play_t = data.t
 
 		data.unit:sound():play("taser_charge", nil, true)
```

## Porter checklist

- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.
- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.
- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).
- [ ] Check new 248.2 fields/callbacks this function must preserve.
- [ ] Run `luajit -bl` and `api-audit` on the file.

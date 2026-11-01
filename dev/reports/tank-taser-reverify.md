# Tank and taser logic re-verify against 248.2 (audit-first)

Audit of the two backlog entries whose standing decision is **keep LIES**
(`dev/reports/port-decisions.md` §9 `TankCopLogicAttack.update`, §6
`TaserLogicAttack._upd_enemy_detection`), plus re-verification of the two taser
rows already recorded as done (§7 `_cancel_tase_attempt` = keep,
§8 `_chk_play_charge_weapon_sound` = merge, applied). Nothing here is taken on
trust; each claim is re-read against the current bodies.

## Sources and line-number provenance

| Side | Revision | Notes |
|---|---|---|
| LIES | this worktree, `7d83be8` (`feat/ai-suite-compat`, V8.81_x64) | all `lua/…:NNN` cites |
| 248.2 vanilla | `e3a8b616` = clone `HEAD` (verified with `rev-parse HEAD`), so on-disk line numbers are 248.2 | all `game-data/…:NNN` cites |
| 246.1 vanilla | `b36f5fbb` — the commit `tools\pd2fn.ps1 -From 246.1` resolves from `game-data/manifest.json` | used only through `pd2fn`; no hand-read 246.1 offsets are cited |

Method: `powershell -ExecutionPolicy Bypass -File tools\pd2fn.ps1 -From 246.1
-To 248.2 -Path <game path> -Class <class> -Name <fn>` for each of the four
functions (full 246.1→248.2 hunk sets below), then a line-by-line read of the
LIES body against the 248.2 body. Supporting facts (`CopBrain._logic_variants`,
`CopLogicIdle._chk_has_old_action`, `CopBrain:action_complete_clbk`,
`CopBrain:update`, `EnemyManager:queue_task`, `CopLogicAttack._find_flank_pos`)
were read directly at the revisions above. The `a3180fc` 246.1 restyle pivot was
not used: no hand-read 246.1 line number appears in this report, so the pivot
offset problem does not apply.

## Verdicts

| Function | Vanilla delta 246.1→248.2 | LIES delta vs 248.2 | Verdict | Risk | Testable |
|---|---|---|---|---|---|
| `TankCopLogicAttack.update` | restyle only (3 hunks, zero behaviour) | 4 LIES features (`old_action_advancing`, per-frame `attitude`, `next_mov_time` gate, walk/run chase); no 248.2 fix dropped. **Function is unreachable in a LIES profile** — every dozer variant is remapped to the boss logic | `keep LIES` (row is inert; do not spend port effort) | today: none. Latent: if the body ever becomes live, `old_action_advancing` is a one-way latch with no clear in the tank's own callback → dozer stops closing | yes (remap + latch chain, static) |
| `TaserLogicAttack._upd_enemy_detection` | restyle only (blank lines, local declaration order, `= nil` removal) | `delay` plumbing (LIES-only contract, self-contained and sound) + wind-up focus lock dropped (recorded LIES intent); 248.2 added nothing to drop or invert | `keep LIES` | medium-cosmetic: taser may re-target mid-charge and lose the zap | shape: yes; behaviour: smoke |
| `TaserLogicAttack._cancel_tase_attempt` | restyle only (inline action table) | handle-gate on `tasing_action`, `tasing` nil'd first; `on_tase_end` skipped as a documented side effect | `keep LIES` — claim **verified** | low: stale `being_tased` with no reader | yes |
| `TaserLogicAttack._chk_play_charge_weapon_sound` | **functional**: cooldown `30` → `3` s, range `2000` → `data.internal_data.tase_distance * 2` | LIES keeps the 15–30 s distance-scaled cooldown and the 3000 range, the 300-unit vertical guard is present, gate moved to `tasing_action` | `already merged` — the recorded merge is **present** | audio only | yes (the `taser_allowed` / `taser_blocked` tags are pinned by `dev/tools/test/watch-channel.test.mjs:91`) |

No port gap was found in any of the four functions: every 248.2 change is
either cosmetic or already carried by the LIES body. Two findings are recorded
below that need a **user** decision, neither of them a port.

---

## 1. `TankCopLogicAttack.update`

LIES `lua/coplogics/specials/tankcoplogicattack.lua:39-144` / 248.2
`lib/units/enemies/tank/logics/tankcoplogicattack.lua:59-160`.

### 1.1 Vanilla delta 246.1 → 248.2 — all restyle

Full hunk set from `pd2fn` (246.1 `b36f5fbb` → 248.2 `e3a8b616`):

```diff
-	local action_taken = my_data.turning or data.unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos
+	local action_taken = my_data.turning or unit:movement():chk_action_forbidden("walk") or my_data.walking_to_chase_pos
...
-	local chase = nil
-	local z_dist = math.abs(data.m_pos.z - focus_enemy.m_pos.z)
+	local chase
+	local within_z_distance = math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300
-	if AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
+	if focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
-		if z_dist < 300 or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
+		if within_z_distance or focus_enemy.verified_dis > 2000 or engage and focus_enemy.verified_dis > 500 then
...
-			local new_action = {
-				body_part = 2,
-				type = "idle"
-			}
-
-			data.unit:brain():action_request(new_action)
+			unit:brain():action_request({
+				body_part = 2,
+				type = "idle"
+			})
...
+	local to_pos = my_data.chase_pos
+
 	my_data.chase_pos = nil
```

Assessment: `data.unit` → `unit` is the same unit (`unit = data.unit`,
248.2:61); `z_dist < 300` and `within_z_distance` are the same predicate (the
refactor hoists the computation above the reaction gate, no behavioural
difference); `AIAttentionObject.REACT_COMBAT <= x` and `x >=
AIAttentionObject.REACT_COMBAT` are the same expression; the inline action
table builds the identical table. **No functional change, no new field, no new
callback.**

### 1.2 LIES delta vs 248.2 — four deliberate features, no missed fix

```lua
-- lua/coplogics/specials/tankcoplogicattack.lua:44-50
if my_data.has_old_action or my_data.old_action_advancing then
	CopLogicAttack._upd_stop_old_action(data, my_data)

	if my_data.has_old_action or my_data.old_action_advancing then
		return
	end
end
...
my_data.attitude = data.objective and data.objective.attitude or "engage"   -- :69
...
if not data.next_mov_time or data.next_mov_time < data.t then               -- :115
...
TankCopLogicAttack._chk_request_action_walk_to_chase_pos(data, my_data, walk and "walk" or "run")  -- :125
```

- Retry-after-stop instead of vanilla's unconditional `return`
  (248.2:64-68) — behavioural, LIES intent.
- Per-frame `attitude` with default `"engage"` instead of the `enter`-time
  `"avoid"` default (248.2:28); `engage` gates the `verified_dis > 500` chase
  arm, so this makes dozers chase at shorter range by default — LIES intent.
  Freshness is safe: the tank runs per-frame (`enter` sets
  `set_update_enabled_state(true)`, `:27`) and `CopBrain:update`
  (248.2:202-212) writes `l_data.t = t` every frame before
  `logic.update(l_data)`.
- `next_mov_time` gate: a real gate, not a dead one. `next_mov_time` is written
  by `CopBrain:get_movement_delay()` after every `walk_blocked_actions`
  completion (`lua/copextensions/copbrain.lua:1105-1110`) and by
  `CopBrain:request_stillness` (`:1117-1119`); for a dozer (`is_criminal()`
  false) it is a 0.2–0.9 s pause scaled by `enemy_travel_level`. Vanilla has no
  such pacing. LIES intent.
- `walk and "walk" or "run"` where vanilla always passes `"run"`
  (248.2:140); `walk = dist < (verified and 1500 or 800)`. LIES intent.

No 248.2 fix is omitted: the four vanilla hunks are cosmetic and LIES is
equivalent on all of them. `within_z_distance` is the only naming drift; a
cosmetic rebase is pointless while the body is unreachable (§1.3).

### 1.3 Cross-check — the body is unreachable in a LIES profile

`lua/copextensions/copbrain.lua:1-15` rebinds every dozer tweak table before
any unit spawns (this file is the `lib/units/enemies/cop/copbrain` hook,
`mod.txt:133-134`):

```lua
CopBrain._logic_variants.triad_boss.attack = LIESBossLogicAttack   -- :3
CopBrain._logic_variants.tank      = CopBrain._logic_variants.triad_boss -- :6
CopBrain._logic_variants.tank_medic = CopBrain._logic_variants.triad_boss -- :7
CopBrain._logic_variants.tank_mini  = CopBrain._logic_variants.triad_boss -- :8
CopBrain._logic_variants.tank_hw    = CopBrain._logic_variants.triad_boss -- :9
CopBrain._logic_variants.piggydozer = CopBrain._logic_variants.triad_boss -- :10
```

The chain is complete and closed:

- vanilla exposes that exact table as the live one — `CopBrain._logic_variants
  = logic_variants` (248.2 `copbrain.lua:126`), `CopBrain:post_init` assigns
  `self._logics = CopBrain._logic_variants[self._unit:base()._tweak_table]`
  (`:156`), `set_logic` resolves `self._logics[name]` (`:457`), and that is
  what `CopBrain:update` calls and what `CopBrain:action_complete_clbk`
  dispatches to (`:581`).
- vanilla's `logic_variants.tank.attack = TankCopLogicAttack` (`:109`) is
  therefore orphaned; LIES never touches `_logic_variants.tank.attack` itself.
- no other file in the mod references `TankCopLogicAttack` (grep: 5 hits, all
  inside `lua/coplogics/specials/tankcoplogicattack.lua`).

So under LIES, dozers run `LIESBossLogicAttack.update`
(`lua/coplogics/boss/bosslogicattack.lua:166-241`), which has the same
`old_action_advancing` gate **plus** the two things the tank body lacks: a
self-heal to a queued update instead of a per-frame spin (`:175-181`) and a
clear in its own `action_complete_clbk` (`:704`). The tank overlay file costs
nothing and is a fallback if the remap is ever reverted, but it is not the body
that produces dozer behaviour, and **no port work should be spent on it**.

Player POV: nothing changes, because nothing in this file runs. Dozer chasing
comes from the boss logic; §9 of `port-decisions.md` is describing a body the
player never sees.

### 1.4 Cross-check — `old_action_advancing` is a latch with no clear (latent)

Asked explicitly: does LIES use `old_action_advancing` correctly against
248.2's shape? Structurally it is used the same way as in
`CopLogicAttack.update` / `TaserLogicAttack.queued_update`, but the clear that
makes that pattern safe is missing here.

- The field is **LIES-only**. It is produced by one shared helper for the whole
  codebase, `CopLogicIdle._chk_has_old_action`
  (`lua/coplogics/coplogicidle.lua:131-140`) —
  `if my_data.advancing then my_data.old_action_advancing = my_data.advancing` —
  and re-armed directly by a few logic bodies that cannot stop a live walk
  (`coplogictravel.lua:79`, `civilianlogicflee.lua:319`,
  `shieldlogicattack.lua:393`, `bosslogicattack.lua:764`). Vanilla's 248.2
  version of `_chk_has_old_action` (`coplogicidle.lua:1670-1678`) has no such
  field.
- Nothing in `_chk_has_old_action` ever clears it. Every other attack-family
  logic that gates on it clears it in its own `action_complete_clbk`:
  `coplogicattack.lua:2467`, `taserlogicattack.lua:343`,
  `shieldlogicattack.lua:564`, `spooclogicattack.lua:226`,
  `bosslogicattack.lua:704`, `coplogictravel.lua:1594`,
  `coplogicidle.lua:1942`, `teamailogicassault.lua:417`,
  `teamailogicidle.lua:442`, `coplogicsniper.lua:176`,
  `coplogicarrest.lua:468`. (`civilianlogictravel.lua:46` is the only other
  latch site without a clear; civilians are out of scope here.)
- The tank has **no** such clear anywhere reachable. `TankCopLogicAttack.enter`
  calls `CopLogicIdle._chk_has_old_action` (`:22`), so a dozer that switches to
  attack logic while a walk action is still on body part 2 latches the field on
  entry; the dispatch target for a tank callback is the vanilla
  `TankCopLogicAttack.action_complete_clbk` (`:222-239`), whose walk branch
  clears `advancing` (`:227`) but not `old_action_advancing`; and
  `CopLogicAttack._upd_stop_old_action`
  (`lua/coplogics/coplogicattack.lua:2824-2847`) cannot interrupt an in-progress
  walk (it requests idle only under `not chk_action_forbidden("walk")`; that test
  is false while the walk action still owns body part 2). Once the walk ends,
  `advancing` is nil and `has_old_action` is false, but the stale action pointer
  keeps line 44's gate true → `update` returns at line 48 every frame.
- Scope of the damage if it ever goes live: not a full statue. Dozer aim/ fire
  are driven from the movement update (`CopBrain:check_upd_aim`,
  `lua/copextensions/copbrain.lua:239-275`, called from
  `lua/copextensions/copmovement.lua`), so a latched dozer would still shoot but
  would never start another chase walk — it stops closing distance after its
  current walk ends.

Why this is latent and not a live bug: the remap in §1.3 means the function is
never entered, and the boss body that does run never lets the latch outlive a
walk — it re-arms the field on purpose when it cannot stop the current walk
(`bosslogicattack.lua:762-765`, inside `_cancel_chase_attempt`) and clears it in
its own `action_complete_clbk` (`:704`). **Decision needed from the user, not a
port**: either leave it (documented dead fallback) or add a two-line
`TankCopLogicAttack.action_complete_clbk` override that clears the field on
`"walk"` the way `bosslogicattack.lua:704` does — which would be an edit to a
file this audit is not allowed to touch, and buys nothing while the remap
stands.

Testable statically: yes — the remap and the latch chain are pure code facts
(reproduced above). Testable in game only by disabling the remap, which is not
a shipping configuration.

### 1.5 Other cross-checks on this body

- `unit:movement()` vs `data.unit:movement()`: equivalent (`:41` binds
  `local unit = data.unit`). `data.unit:brain():action_request(...)` (`:107`)
  is the same object as vanilla's `unit:brain()`. ✓
- 248.2-only field read by LIES that no longer exists: none. Everything the
  body reads (`data.attention_obj.reaction/verified/verified_dis/verified_t/
  m_pos/verified_pos/nav_tracker`, `data.objective.attitude`,
  `data.next_mov_time`, `data.brain`, `data.pathing_results`,
  `my_data.*`, `unit:anim_data()`) exists at 248.2; conversely 248.2 introduces
  no field the body would need and lack.
- `TankCopLogicAttack.enter` deviation worth recording (not a gap): LIES queues
  the detection task without `data.t` (`:21`) where 248.2 passes it
  (`:25`). `EnemyManager:queue_task` does `t = execute_t or 0`
  (248.2 `enemymanager.lua:460`), so a nil `execute_t` runs in the same queue
  pass. Already recorded in `dev/reports/api-audit-triage.md:31`.
- Unguarded unit/tracker read: `focus_enemy.nav_tracker` →
  `CopLogicAttack._find_flank_pos` (`:137-138`), and `_find_flank_pos`
  dereferences `flank_tracker:position()` with no liveness test
  (`lua/coplogics/coplogicattack.lua:2116`). This is the
  `aim-stale-nav-tracker-crash.md` pointer class, but it is read **inside a
  logic update right after detection**, which is the pattern that report calls
  safe for vanilla (`aim-stale-nav-tracker-crash.md` §2, "Vanilla 248.2 reads
  the enemy tracker only inside a logic update, right after detection"), and
  248.2's own tank body does the identical unguarded read (`:154-155`). Not a
  LIES regression, and dead under the remap anyway.

---

## 2. `TaserLogicAttack._upd_enemy_detection`

LIES `lua/coplogics/specials/taserlogicattack.lua:260-334` / 248.2
`lib/units/enemies/taser/logics/taserlogicattack.lua:135-208`.

### 2.1 Vanilla delta 246.1 → 248.2 — restyle only

```diff
 	data.t = TimerManager:game():time()
+
 	local my_data = data.internal_data
...
 	local tasing = my_data.tasing
 	local tased_u_key = tasing and tasing.target_u_key
+	local under_multiple_fire
 	local under_fire_nr = 0
-	local under_multiple_fire = nil
 	local alert_chk_t = data.t - 1.2
...
-	local find_new_focus_enemy = nil
+	local find_new_focus_enemy
```

Blank line, declaration order, and `= nil` removal on a local that is assigned
before use in both branches below. **Zero behaviour change.**

### 2.2 LIES delta vs 248.2 — `delay` plumbing and the dropped wind-up lock

```lua
-- LIES :267
local delay = CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)
...
-- LIES :288-300
local tase_in_effect = tasing and tasing.target_u_data.unit:movement():tased()

if tase_in_effect then
	if under_multiple_fire then
		find_new_focus_enemy = true
	end
else
	find_new_focus_enemy = true
end

if not find_new_focus_enemy then
	return delay                      -- :299
end
```

against 248.2 `:164-172`:

```lua
if tase_in_effect or tasing and data.t - tasing.start_t < math.max(1, data.char_tweak.weapon.is_rifle.aim_delay_tase[2] * 1.5) then
```

So LIES (a) returns `delay` on all three exits (`:299`, `:309`, `:333`) and
(b) drops the charge-window arm of the focus lock. Both are recorded LIES
intent (`port-decisions.md` §6). The `start_t` the dropped arm would need still
exists — `my_data.tasing = { …, start_t = data.t }` at
`taserlogicattack.lua:218-222`. No recorded rationale beyond that entry; it is
the same section's stated intent.

### 2.3 Cross-check — is the `delay` contract still the same in 248.2?

There is **no** `delay` contract in 248.2 to preserve: vanilla
`TaserLogicAttack._upd_enemy_detection` returns no value on any exit (bare
`return` at `:175` and `:185`, implicit fallthrough after `_upd_aim` at
`:207-208`), and vanilla `queued_update` hardcodes its cadence
(`+1` at `:87`, `+1.5` at `:131`, `+2` at `:118`). The contract is LIES-internal:
the only caller is the LIES `queued_update` (`:56`), and the only producer is
the LIES `CopLogicBase._upd_attention_obj_detection`, whose `delay` is
initialised as a number at `lua/coplogics/coplogicbase.lua:919`
(`local delay = managers.groupai:state():whisper_mode() and 0 or 2`) and only
ever reassigned through `math.min` (`:1165`, `:1169`, `:1306`, `:1369`, `:1381`,
`:1391`). So `delay` is never nil and `0.5 + delay * 1.5`
(`taserlogicattack.lua:63`) and `data.t + delay` (`:75`, `:105`) cannot fault.

Does LIES drop or invert anything 248.2 added? No — 248.2 adds nothing to this
function. One dead return value: `return delay` at `:309` (logic changed under
us) is discarded by the caller, which returns before reading `delay`
(`:58-61`). Cosmetic.

Player POV (real risk, same as the decisions flag): a taser that is winding up
a charge no longer locks its target, so if another criminal becomes the
higher-priority attention object mid-whine the taser abandons the charge and
re-targets — the charge sound plays and no zap lands. It does **not** thrash:
the branch only re-targets when `_get_priority_attention` actually returns a
different `u_key` (LIES `:312-323` compares `old_att_obj.u_key ~=
new_attention.u_key` before cancelling anything).

### 2.4 Unguarded unit reads in this function

`tasing.target_u_data.unit:movement():tased()` (`:288`) has no `alive()` guard.
This is byte-for-byte 248.2's own line (`:164`), and the two paths that can
free that unit both nil `tasing` first: vanilla
`on_detected_enemy_destroyed` → `_cancel_tase_attempt` (248.2 `:414-422`,
resolving to the LIES body, §3), and `action_complete_clbk("tase")`
(`:418-437`). Not a LIES regression; recorded for the crash-family survey
because it is precisely the "pointer outlives its unit" shape, and it is only
safe because LIES nils `tasing` earlier than vanilla does.

---

## 3. `TaserLogicAttack._cancel_tase_attempt`

LIES `lua/coplogics/specials/taserlogicattack.lua:487-498` / 248.2
`:392-399`.

### 3.1 Vanilla delta — restyle only

```diff
 function TaserLogicAttack._cancel_tase_attempt(data, my_data)
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
```

### 3.2 The claimed split (handle vs data, `tasing` nil'd first) — verified

```lua
-- lua/coplogics/specials/taserlogicattack.lua:487-498
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

- data cleared first (`:488`), handle gated second (`:490`). ✓
- Vanilla gates on the data table (`:393`); LIES gates on the action handle, so
  "tasing data present, tase action already completed" no longer issues a
  pointless body-part-3 idle that could cancel an unrelated reload. ✓
- Callers are the three the decisions doc names, none of them overridden by the
  mod, so the LIES body is what runs: `exit` (`248.2:62`),
  `on_criminal_neutralized` (`:407`), `on_detected_enemy_destroyed` (`:420`). ✓
- Documented side effect verified: because `tasing` is nil'd first,
  `action_complete_clbk("tase")` skips `on_tase_end(target_key)`
  (`taserlogicattack.lua:421`, `:429-431` — both inside `if my_data.tasing`),
  while `tasing_action = nil` (`:419`) and `has_played_warning = nil` (`:433`)
  still run. No reader of `being_tased` exists at 248.2 (only the writers in
  `on_tase_start`/`on_tase_end`), so no AI consequence.

Verdict `keep LIES` — the recorded claim is accurate as written.

---

## 4. `TaserLogicAttack._chk_play_charge_weapon_sound`

LIES `lua/coplogics/specials/taserlogicattack.lua:440-460` / 248.2 `:450-455`.

### 4.1 Vanilla delta — functional (the 248.2 change LIES deliberately did not take)

```diff
-	if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 30) and focus_enemy.verified_dis < 2000 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
+	if not my_data.tasing and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > 3) and focus_enemy.verified_dis < data.internal_data.tase_distance * 2 and math.abs(data.m_pos.z - focus_enemy.m_pos.z) < 300 then
```

Cooldown 30 s → 3 s, range `2000` → `tase_distance * 2` (~1600–2000 with the
taser's own `tase_distance`), vertical guard unchanged in both revisions.

### 4.2 The recorded merge is present — verified

```lua
-- lua/coplogics/specials/taserlogicattack.lua:440-460
local want_charge = not my_data.tasing_action and (not data.last_charge_snd_play_t or data.t - data.last_charge_snd_play_t > math.lerp(15, 30, focus_enemy.verified_dis / 3000)) and focus_enemy.verified_dis < 3000

if want_charge then
	local vertical_dis = math.abs(data.m_pos.z - focus_enemy.m_pos.z)

	if vertical_dis < 300 then
		data.last_charge_snd_play_t = data.t

		data.unit:sound():play("taser_charge", nil, true)

		if not data._LIES_check_taser_charge_allowed then
			data._LIES_check_taser_charge_allowed = true
			LIES:LogCheck(string.format("taser charge allowed vertical=%.0f", vertical_dis), "taser_allowed")
		end
	elseif not data._LIES_check_taser_charge_blocked then
		data._LIES_check_taser_charge_blocked = true
		LIES:LogCheck(string.format("taser charge blocked vertical=%.0f", vertical_dis), "taser_blocked")
	end
end
```

- 300-unit vertical guard: **present** (`:446`), restored as the decisions doc
  requires; the two `LogCheck` branches additionally make the guard observable.
- LIES cooldown scaling: **present** — `math.lerp(15, 30, verified_dis / 3000)`
  (`:441`), i.e. 15 s point-blank to 30 s at the edge of audibility, never the
  3 s 248.2 cadence.
- 3000 range: **present** (`verified_dis < 3000`).
- Extra deviation not spelled out in the merge point: the gate is
  `my_data.tasing_action` (handle) where 248.2 uses `my_data.tasing` (data).
  Strictly safer — in the one-frame window where `_cancel_tase_attempt` has
  nil'd `tasing` but the tase action has not completed, LIES suppresses the
  whine and vanilla would not.
- Amplitude of the difference, player POV: vanilla 248.2 whines every 3 s out to
  ~2000; LIES whines at most every 15 s (standing next to it) to every 30 s (at
  30 m) and never through a floor (`< 300` z). Behaviour unchanged from the
  merge; nothing regressed.

Verdict `already merged`, confirmed by the body.

### 4.3 Cross-check — nil guard

`focus_enemy.verified_dis` (`:441`) and `focus_enemy.m_pos.z` (`:444`) are
dereferenced without a nil test on `focus_enemy`. Call sites:

| Caller | Guard |
|---|---|
| `_upd_enemy_detection` `:322`, `:325` | inside `if new_attention` / `else` of `if old_att_obj` — non-nil |
| `coplogicbase.lua:464` (taser check in the take-cover/attack-entry test) | inside `if … attention and …` (`:453`) — non-nil |
| `enter` `:41` with `data.attention_obj` | **unguarded** |

The unguarded one is vanilla-parity: 248.2's own `enter` (`:44`) makes the same
call with the same argument. So this is not a LIES regression and has no crash
history; recorded because it is the only unguarded `focus_enemy` read in the
four functions. `data.unit` (`:449`) is safe — the logic is inside that unit's
own update.

---

## 5. Cross-check roll-up

| Question | Answer |
|---|---|
| Tank: `unit:movement()` / `old_action_advancing` / `within_z_distance` correct against 248.2's shape? | `unit:movement()` ✓ equivalent (`unit = data.unit`); `within_z_distance` ✓ same predicate as LIES `z_dist < 300`; `old_action_advancing` **used the same way as elsewhere in LIES but the clear is missing for this owner** — latent only, because the body is unreachable (§1.3, §1.4) |
| Tank: 248.2-only field read that no longer exists (or vice versa)? | none (§1.5) |
| Taser `_upd_enemy_detection`: `delay` contract still the same in 248.2? | 248.2 has no such contract (returns nothing); LIES's is internal, single-caller, and `delay` is provably numeric (`coplogicbase.lua:919` + `math.min` writes) |
| Taser `_upd_enemy_detection`: does LIES drop or invert anything 248.2 added? | nothing 248.2 added; the dropped arm (charge-window focus lock) predates 248.2 and is LIES intent |
| Taser `_cancel_tase_attempt`: handle/data split, `tasing` first | **verified** verbatim (§3.2) |
| Taser `_chk_play_charge_weapon_sound`: 300 guard + LIES scaling + 3000 range | **verified** (§4.2) |
| Unit/tracker touched without `alive()`/nil check | `focus_enemy.nav_tracker` → `_find_flank_pos` (tank, vanilla-parity, inside a logic update); `tasing.target_u_data.unit:movement():tased()` (taser, vanilla-parity, `tasing` nil'd by both cancel paths); `focus_enemy` unguarded in `_chk_play_charge_weapon_sound`'s `enter` call site (vanilla-parity). No new LIES-only hazard in these four bodies |

## 6. Iter and NavFixes

Neither mod hooks either file.

- `mods\Iter` (`feat/ai-suite-compat`, 200.21, priority 40): its `mod.txt`
  hooks `lib/units/enemies/cop/copbrain`, `cop/logics/coplogicidle`,
  `cop/logics/coplogictravel` — not `tank/logics/tankcoplogicattack` and not
  `taser/logics/taserlogicattack`. `grep` for `_logic_variants|TankCopLogic|
  TaserLogic` over its `lua/` finds nothing, so it does not re-point the tank
  remap or replace a taser body.
  Its one shared surface is `CopBrain:clbk_coarse_pathing_results` /
  `clbk_pathing_results` (`lua/copbrain.lua:93-158`), which it wraps and always
  chains to `itr_original_…` (`:128`, `:134`), so `data.pathing_results` — the
  field `TankCopLogicAttack._process_pathing_results` reads — is still
  populated. No interaction.
- `mods\NavFixes` (priority 0): hooks `lib/managers/navigationmanager` only;
  no reference to `tank`/`taser`/`copbrain`.
- Load order keeps this safe either way: LIES is priority 100, Iter 40,
  NavFixes 0, and `mods/base/base.lua` sorts descending, so LIES' bodies are
  installed first and any later wrapper sits on top. Nothing wraps these
  bodies, so there is no ordering hazard to check beyond the remap itself,
  which is LIES-internal and resolved at `post_init` (`copbrain.lua:156`).

## 7. Decision & artifacts

**Decision: no Lua edited.** All four functions are correct as they stand for
248.2:

- `TankCopLogicAttack.update` — `keep LIES`; the 246.1→248.2 delta is restyle,
  LIES carries every semantic it ever had, and the body is unreachable under
  the mod's own `_logic_variants` remap, so neither a port nor the cosmetic
  `within_z_distance` rebase has any effect on play. Not worth an edit.
- `TaserLogicAttack._upd_enemy_detection` — `keep LIES`; the `delay` return is
  an internal contract with one caller and one producer, provably numeric, and
  248.2 provides nothing it would need to adopt.
- `TaserLogicAttack._cancel_tase_attempt` — `keep LIES`; claim verified, no gap.
- `TaserLogicAttack._chk_play_charge_weapon_sound` — `already merged`; the 300
  guard, the LIES cooldown lerp and the 3000 range are all in the body.

The task is read-only for `lua/`, and none of the findings is a port gap, so
nothing in `lua/` was touched. Editing any of these four bodies would either be
a no-op (`within_z_distance`) or an unrecorded behaviour change.

**Open for the user (not port work):**

1. `dev/reports/port-decisions.md` §9 describes `TankCopLogicAttack.update` as
   the dozer logic. It is not, under LIES: every dozer variant is remapped to
   `LIESBossLogicAttack` (`lua/copextensions/copbrain.lua:6-10`). Decide whether
   the row should be re-labelled "inert fallback" so a future 248.3 audit does
   not re-open it, and whether the latent `old_action_advancing` latch (§1.4)
   gets the two-line clear that `bosslogicattack.lua:704` already has. Today's
   play is unaffected either way.
2. `_upd_enemy_detection`'s dropped wind-up focus lock still wants the smoke the
   decisions doc asks for: face a taser at ~8 m, step behind cover during its
   charge whine, step back out — the taser must not waste the zap on a target
   it abandoned. No code change is proposed until that is observed.

Player-POV summary per function: the dozer behaves exactly as before (its body
is the boss logic); tasers keep the longer, distance-scaled charge whine with
no through-floor audio and can still lose a charge to a better target; killing
a criminal mid-charge still sends the taser to idle and it tases normally
afterwards.

Artifacts:

- this report only (`dev/reports/tank-taser-reverify.md`, commit `docs:`,
  no `lua/` change, no version bump);
- `dev/reports/port-status.md` and `port-decisions.md` are left as-is on
  purpose — the open question in item 1 above is the user's call, and recording
  "inert" is a decision, not an observation.

## Applied

Verdicts recorded; **no Lua was edited** and no version bump.

- `dev/reports/port-decisions.md` §9 is re-labelled **inert fallback** — the
  dozer remap at `lua/copextensions/copbrain.lua:3-10` orphans
  `TankCopLogicAttack`, dozers run `LIESBossLogicAttack` — with the latent
  `old_action_advancing` latch kept as a named risk plus the condition that
  makes it live (remap removed / `CopBrain._logic_variants` re-exposed) and the
  note that the boss body does clear the field. §7 and §8 now record the two
  claims as verified present (300-unit guard `:446`, lerp `:441`, 3000 range).
- `dev/reports/port-status.md` marks this re-verify done (`38b8582`) and
  re-points the backlog at the group smoke/flash checks
  (`GroupAIStateBesiege._chk_group_use_flash_grenade`,
  `_chk_group_use_smoke_grenade`).
- **The tank latch stays documented rather than fixed.** It is dead code today,
  so a two-line `action_complete_clbk` clear would be dead code too; if the
  remap is ever changed, that clear must ship in the same commit.

# Group smoke / flash grenade checks — audit-first pass

Audit of the last two `PORT` rows in `dev/port-248-ledger.md:312-313`:

| row | function | LIES | 246.1 | 248.2 |
|---|---|---:|---:|---:|
| 312 | `GroupAIStateBesiege._chk_group_use_flash_grenade` | 145 | 45 | 45 |
| 313 | `GroupAIStateBesiege._chk_group_use_smoke_grenade` | 179 | 47 | 47 |

**No Lua was edited.** This pass only records what the vanilla delta is, what the
LIES rewrite adds, and which of the additions are dead. One real gap came out of
it (both functions: the explicit-`detonate_pos` branch is unreachable), and it
needs a user decision because the fix is a LIES-body edit, not a port.

## Sources and line-number provenance

| Side | Revision | Used for |
|---|---|---|
| LIES | this worktree, `22a1f96` (`feat/ai-suite-compat`, V8.81_x64) | every `lua/…:NNN` cite |
| 248.2 vanilla | `e3a8b616` = clone `HEAD`; handout line numbers below are that commit | every `game-data/…:NNN` cite |
| 246.1 vanilla | `b36f5fbb`, resolved by `tools\pd2fn.ps1 -From 246.1` | only through `pd2fn`, plus `git show b36f5fbb:<path>` for the nav builder |
| per-patch attribution | `5d84b4be` "247" (2026-08-13) touches this file; `a3180fc0` "Switched to new decompiler" is the 246.1 restyle pivot, `6fafad7` the 248.1 one | the whole 246.1→248.2 delta |

Method: `powershell -ExecutionPolicy Bypass -File tools\pd2fn.ps1 -From 246.1
-To 248.2 -Path lib/managers/group_ai_states/groupaistatebesiege.lua -Class
GroupAIStateBesiege -Name <fn>` for both functions (complete hunk sets below),
then a line-by-line read of each LIES body against 248.2. Supporting facts were
read at the named revisions: `GroupAIStateBase.detonate_smoke_grenade` /
`sync_smoke_grenade` / `detonate_world_smoke_grenade` /
`is_smoke_grenade_active` / `_end_regroup_task`, `NavigationManager:_resolve_segment_neighbours`,
`NavFieldBuilder:_generate_coarse_navigation_graph` (246.1), `QuickFlashGrenade`,
`QuickSmokeGrenade`, and LIES' own `NavigationManager.get_nav_segments_in_direction`.

No hand-read 246.1 offset from `groupaistatebesiege.lua` appears here, so the
`a3180fc0` offset shift cannot corrupt a cite. Where a 246.1 offset is named
(nav builder) the commit is stated inline.

## Verdicts

| function | vanilla delta 246.1→248.2 | LIES delta vs 248.2 | verdict | risk | testable |
|---|---|---|---|---|---|
| `_chk_group_use_flash_grenade` | **functional** (`5d84b4be`): numeric room-door id → `door.x`/nav-link unit, forced by the 247 nav rewrite. Nothing else in the vanilla body changes (45 lines both sides) | new cooldown field `use_flash_t`; per-unit objective/group gate; facing + line-of-sight + nearest-shot selection; 2-hop "doorway on the way in" search via LIES' own `get_nav_segments_in_direction`; throw animation + network sync; chatter allowed on `chatter.smoke` too. **Drops** the shared `use_smoke` gate and `is_smoke_grenade_active()` (deliberate decoupling). **The added explicit-`detonate_pos` branch is dead** (`objective` is an undefined global) | vanilla hunk **already merged** (LIES already tests `door.x`); LIES-intent gap = `merge: dead detonate_pos branch` → overall **needs a decision** | stale `u_data.tracker` / `u_data.unit` reads unguarded, vanilla-parity (see crash section); flash can now fire into a live smoke (deliberate, undocumented); timer field inert (`use_flash_t` never initialised → `not nil` path, harmless) | yes — cooldown field, group gate, chatter tag, "no shared `use_smoke` flag" all regex-pinnable |
| `_chk_group_use_smoke_grenade` | **functional** (`5d84b4be`): identical two hunks — `= nil` removal and the same door-id → `door.x` change. Nothing else in the vanilla body changes (47 lines both sides) | replaces the `is_smoke_grenade_active()` gate with a per-assault budget (`max_smoke_grenades` 1/2/3 from `lua/tweak_data/groupaitweakdata.lua:4398-4407`); 300-unit "don't stack on an existing cloud" dedupe; nearest-visible-door selection with facing/LOS; throw animation + sync; timer only once the budget is spent. **Drops** vanilla's `or next(area.criminal.units)` neighbour shortcut. **Same dead explicit-`detonate_pos` branch** | vanilla hunk **already merged**; LIES gate **keep LIES**; dead branch → until fixed, smoke shares vanilla's "no throw when a position is handed in" behaviour → **needs a decision** | `_smoke_grenades` grows within one assault (linear dedupe scan, reset at the assault boundary); `#self._smoke_grenades` counts flashbang holes as borders (base-game numbering, not LIES); tracker/unit reads unguarded, vanilla-parity | yes — budget gate, dedupe radius, timer-only-at-cap are all static |

## 1. Shared vanilla delta (246.1 `b36f5fbb` → 248.2 `e3a8b616`, landed in `5d84b4be` "247")

Both functions changed in exactly the same two ways. Complete hunk sets, no
truncation:

```diff
@@ _chk_group_use_flash_grenade @@
-		local shooter_pos, shooter_u_data = nil
+		local shooter_pos, shooter_u_data
...
-							local random_door_id = door_list[math.random(#door_list)]
+							local door = door_list[math.random(#door_list)]
-							if type(random_door_id) == "number" then
-								detonate_pos = managers.navigation._room_doors[random_door_id].center
+							if door.x then
+								detonate_pos = door
 							else
-								detonate_pos = random_door_id:script_data().element:nav_link_end_pos()
+								detonate_pos = door:script_data().element:nav_link_end_pos()
 							end
```

The smoke hunk is the character-identical equivalent (`random_door_id` →
`door`). Assessment:

- `shooter_pos, shooter_u_data = nil` → bare locals: **restyle**, no behaviour.
- The door change is **functional and forced by the 247 navigation rewrite** —
  in 246.1 the nav builder stored numeric door ids into
  `nav_seg.neighbours[seg][i]` (`navfieldbuilder.lua:3153-3169` @ `b36f5fbb`,
  `table.insert(neighbour_doors, id_door)`), which is why vanilla had to resolve
  `managers.navigation._room_doors[id].center`; the manager still had
  `_room_doors` (`navigationmanager.lua:602-610` @ `b36f5fbb`,
  `_refresh_data_from_builder`, a function that no longer exists in 248.2).
  In 248.2 the neighbour lists are positions:
  `navigationmanager.lua:326-347` @ `e3a8b616`,
  `table.insert(segment.neighbours[other_id], mvec3_copy(door_pos))`; the other
  producer, `add_nav_link`, still inserts nav-link **units**
  (`navigationmanager.lua:929` @ `e3a8b616`). Hence the 248.2 test is
  `door.x` (Vector3) else nav-link unit.
- Consequence for a mod that still treats numbers: a 246.1-era copy would index
  a table the 248.2 manager does not populate, `nil.center` → error, and it would
  do so on the first neighbour with a door. **LIES is not exposed** — it already
  uses `door.x`, and its residual `type(door_id) == "number"` branch
  (`lua/groupaistate/groupaistatebesiege.lua:3968-3974`, `4133-4139`) maps a
  numeric id to `test_pos = nil`, i.e. "skip that door". Numbers no longer occur
  in 248.2, so the branch is dead-but-safe.

Verdict for the vanilla side of both rows: **already merged**.

## 2. `_chk_group_use_flash_grenade`

LIES `lua/groupaistate/groupaistatebesiege.lua:4075-4219` (145 lines) vs
248.2 `lib/managers/group_ai_states/groupaistatebesiege.lua:3406-3450` (45).

### 2.1 What the rewrite adds

Gate (LIES:4076 vs vanilla:3407):

```lua
-- LIES 4076
if not task_data.use_flash_t or task_data.use_flash_t < self._t then
-- vanilla 3407
if task_data.use_smoke and not self:is_smoke_grenade_active() then
```

LIES gives the flash its own cooldown (`task_data.use_flash_t`, written at
LIES:4206 with the same
`math.lerp(smoke_and_flash_grenade_timeout[1], [2], math.random()^0.5)` vanilla
uses for its shared timer at 3438). It therefore **drops both** vanilla gates:
the shared `use_smoke` flag and `is_smoke_grenade_active()`. That is a
deliberate decoupling — a flash can be thrown while a smoke cloud is still up,
and a flash no longer sets `task_data.use_smoke = false` (vanilla 3439). LIES'
callers (`lua/groupaistate/groupaistatebesiege.lua:2944-2947`, `3095-3096`,
`3242-3245`, `3409-3410`) pass `self._task_data.assault` and rely on the field
staying nil-initialised; `not nil` is true, so the first call always passes. The
field is not reset in `set_assault_mode` (vanilla resets only
`use_smoke_timer`/`use_smoke`, `groupaistatebesiege.lua:2456-2459` @ `e3a8b616`),
so a cooldown can survive a mode change for at most one timeout window (10-20 s).
Harmless.

Selection (LIES:4094-4170 vs vanilla:3411-3433). Per-unit gates LIES adds:

```lua
-- LIES 4095-4099
local objective = u_data.unit:brain():objective()
if u_data.tactics_map and u_data.tactics_map.flash_grenade and objective and objective.grp_objective == group.objective then
    if not u_data.unit:movement():chk_action_forbidden("action") and u_data.unit:movement()._anim_global ~= "shield" and mvec3_dis(u_data.m_pos, target_area.pos) < 4000000 then
```

so only a unit that is (a) carrying the flash tactic, (b) actually working this
group's objective, (c) not mid-action, (d) not a shield, and (e) within 2000
units of the target area may throw. Then instead of vanilla's one random
neighbour door, LIES walks the unit's own segment's door list toward the target
area (`4102`), falls back to a 2-hop "common neighbour on the incoming
direction" search (`4105-4125`), and keeps the **nearest** door that the unit is
facing (`dot >= 0.6`, `4151`) and can see by raycast (`4154-4156`).

The 2-hop search calls `nav_manager.get_nav_segments_in_direction` (LIES:4092).
Vanilla 246.1 had that method (`NavigationManager:get_nav_segments_in_direction`,
`navigationmanager.lua:1286` per `pd2fn -List` @ 246.1) and 248.2's rewritten
manager **does not** (grep for the name over
`game-data/…/lib/managers/navigationmanager.lua` @ `e3a8b616`: zero hits). LIES
ships its own shim in the same mod, `lua/managers/navigationmanager.lua:207-230`,
so the call resolves — this is the one piece of the rewrite that is a genuine
API port (a 246.1 method 248.2 deleted), not a stray helper. No nil-call gap.

Throw side (LIES:4201-4217 vs vanilla:3435-3445): same
`detonate_smoke_grenade(pos, shooter_pos, duration, true[, false])`, plus
`play_redirect("throw_grenade")` + `send_to_peers_synched("play_distance_interact_redirect", …)`
(LIES:4208-4210), plus chatter. The chatter gate is deliberately widened:

```lua
-- LIES 4212-4214
if shooter_u_data.char_tweak.chatter.smoke and not shooter_u_data.unit:sound():speaking(self._t) then --if they can shout smoke, they'll shout flash, just in case
    self:chk_say_enemy_chatter(shooter_u_data.unit, shooter_u_data.m_pos, "flash_grenade")
end
```

Vanilla gates on `chatter.flash_grenade` (3441). LIES announces `flash_grenade`
whenever the unit could announce `smoke`, which is the author's stated fix
(comment at LIES:3892-3893).

### 2.2 What it drops

- `is_smoke_grenade_active()` and `task_data.use_smoke = false` — see above,
  deliberate, and the only way to get a flash during smoke.
- Vanilla's `task_data.target_areas[1].nav_segs[neighbour_nav_seg_id]` predicate
  — replaced by the unit-relative segment walk. Not a 248.2 change; both
  versions have the vanilla predicate.
- `tweak_data.group_ai.flash_grenade_lifetime` (vanilla:3409) →
  LIES:4078 uses `tweak_data.group_ai.smoke_grenade_lifetime`.

The duration swap looks like a copy-paste bug, and it is **inert**: the flash
path in `detonate_world_smoke_grenade` passes the duration to
`flash_grenade:base():activate(data.shooter_pos, data.duration)`
(`groupaistatebase.lua:3948-3952` @ `e3a8b616`), but
`QuickFlashGrenade:activate` takes only one argument —
`function QuickFlashGrenade:activate(position)`
(`lib/units/weapons/grenades/quickflashgrenade.lua:112` @ `e3a8b616`) — and
`activate_immediately` likewise (`:116`). The blind window comes from
`tweak_data.group_ai.flash_grenade` (`:34-44` of the same file), not from this
argument. So LIES flashing for "16 s" on Death Sentence changes nothing
in-game. Recorded as a cosmetic mismatch; not worth a Lua edit on its own.
(For contrast the smoke path *does* consume it:
`QuickSmokeGrenade:activate(position, duration)` →
`self._remove_t = TimerManager:game():time() + self._duration`,
`lib/units/weapons/grenades/quicksmokegrenade.lua:50-75`.)

### 2.3 The real gap — the explicit-`detonate_pos` branch is dead

LIES splits into `if not detonate_pos` (4094-4171) and `else` (4172-4199). The
`else` branch tests a name that is not in scope:

```lua
-- LIES 4172-4175
else
    for u_key, u_data in pairs(group.units) do
        if u_data.tactics_map and u_data.tactics_map.flash_grenade and objective and objective.grp_objective == group.objective then
            if not u_data.unit:movement():chk_action_forbidden("action") and … then
```

`objective` is declared per unit **inside the first branch only** (LIES:4095).
In the `else` branch it is an undefined global, i.e. always `nil`, so the
conjunction is always false and the loop body never runs: with a `detonate_pos`
handed in, no shooter is ever selected and the grenade is never thrown.

That is exactly the case the file's own comment claims to fix
(LIES:3891: "if a detonate_pos gets set, the function doesn't complete because
shooter_u_data doesn't get set, this fixes that"). It was never fixed: the same
shape is in the pre-port LIES body, `git show 997e95e` (`objective` declared at
4249, tested in the `else` at 4322), so this is inherited, not a 248.2
regression. Net behaviour equals vanilla's (vanilla also never throws when
`detonate_pos` is passed, because `shooter_u_data` is only set inside
`if not detonate_pos`, vanilla:3413-3433) — a parity outcome with an inert
intent, not a new break.

It is reachable and player-visible: the charge call site builds `detonate_pos`
from the first non-deployable criminal in the target/neighbour area
(`lua/groupaistate/groupaistatebesiege.lua:3163-3168`, `3218-3226`) and passes it
at `:3244-3245`; the other five-arg site (`:2908-2947`) passes a position that
survives only while `use_gas and charge`. So **when a group charges a camping
player and the last known target position is within 700 units of a criminal, the
function is handed that position — and returns without ever throwing**, which is
exactly the case the comment says it fixes. With `detonate_pos` nil (the common
case) the live door-based selection still runs, so this is a lost improvement,
not a lost vanilla behaviour.

**Player POV (gap):** you camp a corner, a group commits to a charge and knows
where you were last seen; the charge code hands that position over and the
flash/smoke that should land on it is skipped. In practice the flock still
throws at the doorway on its normal path, so the loss is "the charge-specific
grenade never happens", not "no grenades at all" — and nothing in-game signals
it.

### 2.4 Verdict

- Vanilla delta: **already merged** (LIES' `door.x` handling is the 248.2 shape;
  its numeric branch is a safe skip).
- LIES-intent gap: `merge: make the explicit-detonate_pos branch live` (resolve
  `objective` per unit in that loop, or hoist both branches under a single
  per-unit loop) — **needs a decision**, because it is a LIES-body edit, not a
  port of a vanilla change, and it changes grenade frequency in charges.

## 3. `_chk_group_use_smoke_grenade`

LIES `lua/groupaistate/groupaistatebesiege.lua:3895-4073` (179 lines) vs
248.2 `lib/managers/group_ai_states/groupaistatebesiege.lua:3358-3404` (47).

### 3.1 What the rewrite adds

Gate (LIES:3896-3898 vs vanilla:3359):

```lua
local max_smoke_grenades = tweak_data.group_ai.max_smoke_grenades or 1
if task_data.use_smoke and (not self._smoke_grenades or #self._smoke_grenades < max_smoke_grenades) then
```

The vanilla time gate (`not self:is_smoke_grenade_active()`) is replaced by a
**per-assault budget**. `max_smoke_grenades` is LIES tweak data:
1 (below `difficulty_index` 6), 2 (6-7), 3 (8+)
(`lua/tweak_data/groupaitweakdata.lua:4398-4407`). `self._smoke_grenades` is the
base-game table: `sync_smoke_grenade` numbers entries with
`#self._smoke_grenades + 1` (`groupaistatebase.lua:3990` @ `e3a8b616`) and the
table is cleared by `sync_smoke_grenade_kill()` from `_end_regroup_task`
(`groupaistatebesiege.lua:758-767`, reached from `:801` and `:2454` @
`e3a8b616`), i.e. once per assault/regroup boundary. So the budget is
per assault, not per heist — verified, not assumed.

Consequences of the swap: a second smoke can go up while the first is still
burning (up to the cap), and `task_data.use_smoke = false` +
`task_data.use_smoke_timer = …` are only applied **after** the cap is reached
(LIES:4057-4060), which is what lets the extra clouds out on consecutive ticks.
LIES adds a 300-unit (90000 sq) "do not stack on an existing cloud" filter in
both the position-first path (LIES:3904-3915) and the door-candidate loop
(3989-3998).

Selection: same structure as the flash rewrite — per-unit objective/group gate
(`3930-3934`), action/shield/range gates, unit-relative door list toward the
target area, 2-hop direction shim (`3940-3957`), nearest faced-and-visible door
(`3962-4008`). Throw side adds `play_redirect("throw_grenade")` + sync
(4062-4064) and keeps the vanilla chatter (`shooter_u_data.char_tweak.chatter.smoke`,
`"smoke"` tag, 4066-4068).

### 3.2 What it drops

- `or next(area.criminal.units)` from vanilla's neighbour predicate
  (vanilla:3372: `if task_data.target_areas[1].nav_segs[neighbour_nav_seg_id] or next(area.criminal.units) then`).
  Vanilla may smoke a door into any neighbouring segment that holds criminals;
  LIES only accepts doors of the **target area's own segment** (or a
  common-neighbour segment via the direction shim). Not a 248.2 change — 246.1
  has the same predicate. Effect: smoke lands less often, but only on the
  intended doorway.
- `is_smoke_grenade_active()` — intentional (see gate).
- The 5th `detonate_smoke_grenade` argument. LIES:4055 calls
  `detonate_smoke_grenade(detonate_pos, shooter_pos, duration, false)`; vanilla
  passes `(…, false, false)`. The signature is
  `detonate_smoke_grenade(detonate_pos, shooter_pos, duration, flashbang, instant)`
  (`groupaistatebase.lua:3979` @ `e3a8b616`, unchanged since 246.1 — `pd2fn`
  says "unchanged"), so `instant = nil` ≡ `false`. No gap.
- Same inert dead `else` branch as the flash (LIES:4021-4050, `objective`
  undefined at `4023`, declared only at `3930` in the other branch). Vanilla
  also never throws when `detonate_pos` is passed (its `shooter_u_data` is only
  set inside `if not detonate_pos`, vanilla:3363-3387).

### 3.3 Verdict

- Vanilla delta: **already merged**.
- LIES gate: **keep LIES** — the per-assault budget is the point of the rewrite
  and the reset path exists.
- Dead `detonate_pos` branch: `merge: same fix as the flash` — **needs a
  decision** (shared edit, one commit can fix both).

**Player POV (budget):** on Mayhem+ up to two or three smoke clouds can be up
per assault instead of one timed cloud, and a new one can be laid while the old
one still burns — more of the approach is covered, and a player holding a lane
gets smoked from a second doorway, not just the first.
**Player POV (dropped neighbour shortcut):** smoke appears less often than
vanilla, but when it does it is at a door that actually leads into the area
you're holding.

## 4. Crash-class check (unit / tracker reads)

| read | LIES site | vanilla equivalent | guarded? |
|---|---|---|---|
| `u_data.tracker:nav_segment()` | 3935 (smoke), 4100 (flash) | yes — 3366, 3414 | **no** — vanilla parity |
| `all_nav_segs[m_nav_seg_id].neighbours` | 3937, 4102 | `nav_seg.neighbours` after `managers.navigation._nav_segments[nav_seg_id]` (3367) | no — vanilla parity (nil segment ⇒ same fault shape) |
| `all_nav_segs[id].neighbours[target_area_seg]` in the direction shim | 3945, 4110 | — (LIES-only) | safe: `id` comes from `get_nav_segments_in_direction`, which only emits ids whose segment exists and has `.pos` (`lua/managers/navigationmanager.lua:207-230`) |
| `u_data.unit:brain():objective()` | 3930, 4095 | — (LIES-only) | **no** |
| `u_data.unit:movement():chk_action_forbidden`, `._anim_global`, `:m_fwd()` | 3934/3936, 4099/4101 | — (LIES-only) | no |
| `u_data.unit:movement():m_head_pos()` | 4001/4035, 4153/4186 | — (LIES-only) | no |
| `u_data.unit:raycast(…)` | 4002/4036, 4154/4187 | — (LIES-only) | no |
| `shooter_u_data.unit:sound()` / `chk_say_enemy_chatter(shooter_u_data.unit, …)` | 4066, 4212 | yes — 3395, 3441 | no — vanilla parity |
| `u_data.m_pos` | everywhere | yes | safe (stored vector copy) |
| `managers.network:session()` | 4063, 4209 | — (LIES-only) | manager, always present in-heist |

Assessment:

- No **new class** of fault: every unguarded dereference is on the same
  `u_data.unit` / `u_data.tracker` vanilla already dereferences in the same
  function. Group members are removed in the death path —
  `GroupAIStateBase:on_enemy_unregistered` → `_remove_group_member` →
  `group.units[u_key] = nil` (`groupaistatebase.lua:1508-1516`, `4629-4686` @
  `e3a8b616`) — so a group entry does not outlive the unit's unregister.
- The one read that has already shipped an engine AV in this mod is exactly
  `tracker:nav_segment()` on a freed tracker (`dev/reports/aim-stale-nav-tracker-crash.md`,
  V8.68). These two functions are the same shape and are reached from the
  group-AI update rather than the movement update, so the safest read is: **not
  proven reachable, not proven safe**. This file already carries the guard the
  author wanted in other places —
  `u_data.tracker and alive(u_data.tracker)` at `lua/groupaistate/groupaistatebesiege.lua:3431`
  and `:3877` — while `:718`, `:1571`, `:2307`, `:3585`, `:3935`, `:4100` are
  unguarded. When these two functions are edited, matching the `:3877` pattern
  is a two-line change and keeps the file internally consistent.
- No reservation/queue leak: the grenade queue is base-game
  (`_smoke_grenades`), LIES only reads `#` and `data.detonate_pos`; it never
  removes or inserts entries. Flashbang entries are nilled by the base game
  (`groupaistatebase.lua:3954`), smoke entries are cleared wholesale at the
  assault boundary, so the LIES count can only under-report (open the gate one
  cloud early) — never leak.

## 5. Cross-mod

| mod | priority | hooks `groupaistatebesiege`? | touches these functions? |
|---|---:|---|---|
| LIES | 100 | yes, `mod.txt:112-115` | owns them |
| Iter | 40 | no | no — `grep GroupAIStateBesiege` over the worktree's `*.lua`: zero hits; its `lib/managers/group_ai_states/groupaistatebase` hook only adds `GroupAIStateBase:on_nav_seg_neighbour_state` (`lua/groupaistatebase.lua:9`) |
| NavFixes | 0 | no — hooks only `lib/managers/navigationmanager` (`mod.txt` `hooks[0]`) | no |

Load order (SuperBLT: descending priority, higher number loads earlier —
`docs/reference/mod-interfaces.md:10-13`): **LIES (100) → Iter (40) → NavFixes
(0)**. Later load wins for same-named class methods, so:

- All three hook `lib/managers/navigationmanager`, so Iter's and NavFixes'
  redefinitions land on top of LIES'. Same-name overlaps between the three
  include `find_segment_doors` (LIES `lua/managers/navigationmanager.lua:45`,
  NavFixes `lua/navigationmanager.lua:11` — NavFixes wins), `register_cover_units`
  (LIES and Iter), `register_anim_nav_link` (LIES, Iter and NavFixes),
  `set_nav_segment_state` (LIES and Iter), `remove_obstacle` (LIES and NavFixes)
  and `_sort_nav_segs_after_pos` (LIES and NavFixes). That is the
  cover/coarse-path pipeline, not this pair.
- Iter's `groupaistatebase` hook is a 14-line wrapper
  (`lua/groupaistatebase.lua:10-14`, gated on `Iter.settings.nav_overlay` /
  `nav_ai`) that only re-lists neighbours after `on_nav_seg_neighbour_state`;
  it cannot affect these functions.
- **For the grenade checks the shim survives:** `get_nav_segments_in_direction`
  is defined only by LIES (`lua/managers/navigationmanager.lua:207`); neither
  Iter's nor NavFixes' hook defines it, so the flash/smoke 2-hop search keeps
  working in the shipped stack. Latent hazard: if a future Iter/NavFixes release
  claims that name, the search silently changes (same signature assumed).
- Iter's `groupaistatebase` hook cannot affect these functions: they live on
  `GroupAIStateBesiege`, and nothing in either mod redefines
  `is_smoke_grenade_active`, `detonate_smoke_grenade`, `sync_smoke_grenade` or
  `_smoke_grenades` handling.
- `_nav_segments` structure is preserved by all three: NavFixes' `add_nav_link`
  rewrite still inserts nav-link units into `neighbours`
  (`mods/NavFixes/lua/navigationmanager.lua:134`), which is the
  `door.x == nil` → `script_data()` path LIES already handles.

## 6. Testable — static pins, no engine stubs

Yes. The established pattern is `dev/tools/test/aim-tracker-guard.test.mjs`
(strip comments, cut the function out by its signature, regex the body). The
following are pinnable today:

| intent | assertion |
|---|---|
| flash has its own cooldown | body of `_chk_group_use_flash_grenade` matches `/if not task_data\.use_flash_t or task_data\.use_flash_t < self\._t then/` and `/task_data\.use_flash_t = self\._t \+ math\.lerp/` |
| flash decoupled from smoke | flash body does **not** contain `is_smoke_grenade_active` nor `use_smoke = false` (pins current intent; would fail if someone "restores" parity) |
| smoke budget gate | `/tweak_data\.group_ai\.max_smoke_grenades or 1/` and `/#self\._smoke_grenades < max_smoke_grenades/`; and `_chk_group_use_smoke_grenade` does **not** contain `is_smoke_grenade_active` |
| no smoke stacking within 300 units | `/mvec3_dis\(smoke_pos, .*\) < 90000/` appears twice |
| group gating | both function bodies contain `objective.grp_objective == group.objective` |
| chatter intent | flash body contains `chatter.smoke` **and** the `"flash_grenade"` tag |
| **would be red today** | each body declares `local objective = u_data.unit:brain():objective()` inside the loop that also tests `objective and objective.grp_objective` (fails: the `else` branch reads a global) |
| **would be red today** | `alive(u_data.tracker)` precedes every `u_data.tracker:nav_segment()` in the two bodies (fails at 3935/4100) |

The last two are the point of the audit: they encode the two findings as
failing tests, ready to be flipped green by the follow-up edit.

## Player-facing summary

- Charging groups still do not throw the flash at the position the charge code
  computed — the LIES "flash the camper" fix is inert (both functions).
- A group can flash a player who is already standing in its own smoke
  (deliberate decoupling; undocumented in `MENU_OPTIONS.md` terms — LIES has no
  options doc for this, it is tweak-driven).
- Smoke: up to 1/2/3 clouds per assault by difficulty instead of one timed
  cloud, non-stacking within 300 units, target-doorway-only placement.
- Flash duration setting is inert either way; no player difference from the
  `smoke_grenade_lifetime`/`flash_grenade_lifetime` mismatch.

## Decision & artifacts

- **No Lua edited** in this pass. The task's read-only rule on `lua/` stands,
  and both rows turned out to need *no* port: the only vanilla change is already
  in the LIES bodies, and the remaining items are LIES-intent bugs that must be
  fixed deliberately, not ported.
- Artifacts: this file only. No test added (the two candidate assertions would
  be red by design until the follow-up fix lands; adding them now would leave a
  red suite). `node --test dev\tools\test\*.test.mjs` was therefore not run —
  no test file was touched. `gates.ps1` not run.
- Ledger rows 312-313 stay `PORT`/unticked until the user decides on the dead
  `detonate_pos` branch; the vanilla half of both rows is `already merged` and
  can be ticked as audited once the decision is recorded.
- **Needs a user decision:** (1) fix the dead `detonate_pos` branch in both
  functions (single shared edit: resolve `objective` per unit in the `else`
  loop) — makes group flashes/smokes actually land on charging players, a real
  difficulty increase on Death Wish+; (2) optionally add the
  `alive(u_data.tracker)` gate at LIES:3935/4100 to match `:3431`/`:3877`, at
  the cost of one extra `alive()` per unit per check; (3) leave the
  `smoke_grenade_lifetime`-for-flash mismatch alone (inert).

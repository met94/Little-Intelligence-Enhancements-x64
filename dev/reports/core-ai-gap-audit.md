# Core AI 248.2 gap audit (read-only)

Static audit of the LIES bodies we keep as LIES bodies, plus the core cop
extensions around them, against game 248.2.

- Worktree: `.worktrees/LIES-port-248` (`feat/port-248`, base `b81db84`)
- Baseline: `a3180fc` (246.1). Target: `e3a8b616` (248.2)
- Clone: `game-data/Payday-2-LuaJIT-Complete`
- Mode: read-only. No runtime Lua was edited. This report is the only artifact.
- Scope: `coplogicbase`, `coplogicattack`, `coplogicidle`, `coplogictravel`,
  `copbrain`, `copbase`, `copmovement`, `copdamage`, `specials/*` (taser, tank,
  shield), `coplogicphalanx{vip,minion}`, and the 248.2 equivalents.

Method: per-file `a3180fc..e3a8b616` diffs, then a per-function check of which
side of the overlay actually executes (LIES defines a function only where the
ledger says so; everything else stays 248.2 vanilla). Function bodies were
compared with `dev/tools/fn-workbench.mjs` and the 248.2 call sites were grepped
directly in the clone.

```powershell
git -C game-data\Payday-2-LuaJIT-Complete diff a3180fc e3a8b616 -- lib/units/enemies
node dev/tools/fn-workbench.mjs --file lua/copextensions/copbrain.lua --name CopBrain.post_init
git -C game-data\Payday-2-LuaJIT-Complete log -S "unit:brain():pre_destroy(unit)" -- lib/units/enemies/cop/copbase.lua
```

Findings already decided in `dev/reports/port-decisions.md` are **not** repeated
here. This audit only adds gaps that the decision ledger does not cover.

## Summary

| ID | Severity | File / function | 248.2 change | Impact | Action | Gate |
|---|---|---|---|---|---|---|
| AI-01 | High | `lua/coplogics/coplogicattack.lua` `_upd_aim` (door watch, 1123–1145) | v6 nav stores neighbour doors as `Vector3`; `find_segment_doors` returns positions, not door objects | Door watching is dead for every ordinary door; cops never predict a target through a doorway. Silent, no crash. | Add the `door.x` (raw position) branch to the LIES loop. | static + smoke |
| AI-02 | High (crash) | `lua/managers/navigationmanager.lua` `find_segment_doors` (78–96) vs 248.2 `CopLogicAttack._get_expected_attention_position` (1546–1547) | 248.2 callers assume `find_segment_doors` returns `Vector3` only. LIES re-adds `{center, end_pos}` tables for nav-link doors. | Reachable through the vanilla `_upd_aim` alias used by phalanx VIP/minions; `mvec3_set(temp_vec1, door)` on a table = engine type error. | Normalise the LIES helper: raw positions in the default branch, tables only for `center_only`. | static + smoke (phalanx) |
| AI-03 | Medium | `lua/coplogics/coplogicphalanxvip.lua`, `coplogicphalanxminion.lua` + 248.2 alias table (vip 4–20, minion 4–21) | Aliases on the class capture `CopLogicAttack/Idle` functions at game-file load, i.e. *before* the LIES overlay replaces them | Phalanx VIP/minions run vanilla aim, `on_new_objective`, `_perform_objective_action`, `damage_clbk`, `_chk_has_old_action`. LIES aim/cover behavior silently does not apply to them — and this is the path that makes AI-02 reachable. | Re-alias after the LIES files load, or accept and document. | static + smoke |
| AI-04 | Medium | `lua/copextensions/copbrain.lua:1` `CopBrain._logic_variants.marshal_marksman.attack = CopLogicAttack` | 248.2 (and 246.1) use `MarshalLogicAttack`, a `CopLogicAttack` subclass with its own `update` / `_chk_exit_non_walkable_area` | Marshal marksmen are silently downgraded; marshal-specific movement/exit logic never runs. Undocumented in the worktree. | Confirm intent; document in the port report either way. | smoke (marshal heist) |
| AI-05 | Info / verify | `CopBase:pre_destroy` (248.2:569) + LIES `CopLogicBase.pre_destroy` (143) | 247 (`5d84b4be`) removed `brain/movement/inventory:pre_destroy` from `CopBase`/`HuskCopBase`, and removed `CopSound:destroy` | Engine now dispatches each extension's `pre_destroy` (zero Lua callers remain, and `UnitBase` gained the `_destroying` guard in the same commit). LIES must **not** re-add the manual chain; LIES's `TeamAILogicBase._current_att_objs` cleanup still runs via `CopBrain:pre_destroy`. | No code change. One smoke check that logic `pre_destroy` still fires. | static + 1 kill-pass |
| AI-06 | Low (latent crash) | `lua/coplogics/coplogictravel.lua` 287–300, 460–475 | 248.2 coarse paths are `{seg, pos}`; LIES keeps the 246.1 `{seg, pos, nav_link, multi}` tuples only because LIES overrides `_execute_coarce_search` | `[4]` is never set, so the loops are dead today. If P1d adopts vanilla `search_coarse`, these loops become live and call `alive(i_door)` on `Vector3` door entries -> Lua error. | Keep the 4-tuple contract, or add `if i_door.x then ...` guards before `alive()`. | static |

Everything else in scope checked clean; see "Verified non-gaps".

---

## AI-01 — `_upd_aim` door watching is dead on v6 door lists

**Where.** `lua/coplogics/coplogicattack.lua:1123–1145` (inside the kept LIES
`_upd_aim`):

```lua
local doors = managers.navigation:find_segment_doors(enemy_nav_seg)
...
if door.end_pos then ...
elseif door.center then ...
```

**248.2 change.** Nav v6 stores segment neighbours as door **positions**.
`NavigationManager:_resolve_segment_neighbours` inserts
`mvec3_copy(door_pos)` (248.2 `navigationmanager.lua:326–348`), and 248.2's own
`find_segment_doors` filters with `if door.x then table.insert(found_doors, door)`
(1204–1219). The vanilla 248.2 `_get_expected_attention_position` was updated to
`mvec3_set(temp_vec1, door)` for exactly this reason (1546–1547).

**Impact.** `find_segment_doors` is overridden by LIES
(`lua/managers/navigationmanager.lua:35`). In the default branch it returns
`Vector3` for ordinary doors and a `{center, end_pos}` table only for nav-link
units (78–96). The LIES loop above only understands the table form, so for
normal doors both `door.end_pos` and `door.center` are nil and the loop finds
nothing. The fallback `_get_expected_pos` then runs, so there is no crash — the
cop just loses the "watch the doorway the target is about to come through"
behavior. That is a visible LIES feature loss, not a vanilla parity loss.

**Exact merge point.** After `local door = doors[i]` (line 1127), add a raw
position branch before the table branches:

```lua
if door.x then
    local test_pos = door:with_z(door.z + 140)
    ...
elseif door.end_pos then
    ...
elseif door.center then
    ...
end
```

Keep the raycast/`best` logic identical; do not replace the loop with the
vanilla `_get_expected_attention_position`.

**Test.** Stand on the far side of a closed door that joins two nav segments,
let a cop lose sight of you, then open/move. The cop should pre-aim at the
doorway (`data.internal_data.expected_pos`) instead of only reacting after you
appear. Also watch a shield/taser approach through a door.

**Gate.** `luajit -bl` (static) + smoke. Detection timing itself is unaffected.

---

## AI-02 — `find_segment_doors` contract collision (crash path)

**Where.** LIES helper `lua/managers/navigationmanager.lua:35–101`; 248.2
consumer `lib/units/enemies/cop/logics/coplogicattack.lua:1506–1570`.

**248.2 change.** 248.2 `find_segment_doors` returns only `Vector3` door
positions (it skips nav-link units). LIES's override deliberately returns door
tables for nav-link units in **both** branches, so `center_only` callers keep
working:

```lua
else   -- center_only == nil
    for _, door in ipairs(door_list) do
        if door.x then
            table.insert(found_doors, door)          -- Vector3
        elseif alive(door) ... then
            table.insert(found_doors, {              -- table!
                center = nl_element:value("position"),
                end_pos = nl_element:nav_link_end_pos()
            })
```

248.2's `_get_expected_attention_position` does not defend against that:

```lua
for _, door in pairs(found_doors) do
    mvec3_set(temp_vec1, door)   -- 1547
```

Passing a Lua table to `mvector3.set` is a type error.

**Reachability.** LIES replaces `CopLogicAttack._upd_aim` (so the ordinary cop
path never calls the vanilla function) and `LIESBossLogicAttack._upd_aim`
comments the call out (`lua/coplogics/boss/bosslogicattack.lua:357`). But
`CopLogicPhalanxVip._upd_aim` and `CopLogicPhalanxMinion._upd_aim` are **aliases
captured at game load** (248.2 vip 6, minion 6) and therefore still point at
the 248.2 vanilla `_upd_aim`. A phalanx unit whose target is out of sight and
whose segments are joined by a nav-link (ladder/anim link) reaches 1547 with a
table. Same story for any future class that aliases the vanilla function before
LIES loads.

**Exact merge point.** In `lua/managers/navigationmanager.lua`, default branch
(78–96): insert the nav-link **position** instead of the table, e.g.
`table.insert(found_doors, nl_element:value("position"))` (or
`nav_link_end_pos`) and keep the `{center, end_pos}` table only inside the
`center_only` branch. LIES callers that need centers already pass `true`
(`_get_expected_pos` at 1398/1402). This also fixes the `door.center`-based
branch in AI-01 once AI-01 adds the raw-position branch.

One-writer note: this is `lua/managers/navigationmanager.lua`, owned by the nav
workstream. Land it as a nav change, not a core-AI change; the core-AI half is
AI-01.

**Test.** Phalanx heist (a `phalanx_vip` / `phalanx_minion` spawn, e.g. Midland
Ranch content) and a cop standing across a nav-link door from the player.
Expected: no `Vector3 expected` / `mvector3.set` error, VIP still aims and
shoots; smoke log clean.

**Gate.** Static cannot prove the type, but it can prove the branch shape
(review the two return shapes). Smoke required.

---

## AI-03 — phalanx VIP/minion aliases bypass every LIES override

**Where.** 248.2 `lib/units/enemies/cop/logics/coplogicphalanxvip.lua:4–20`
and `coplogicphalanxminion.lua:4–21`:

```lua
CopLogicPhalanxVip._upd_aim              = CopLogicAttack._upd_aim
CopLogicPhalanxVip._perform_objective_action = CopLogicIdle._perform_objective_action
CopLogicPhalanxVip._chk_has_old_action   = CopLogicIdle._chk_has_old_action
CopLogicPhalanxVip.on_new_objective      = CopLogicIdle.on_new_objective
...
```

**Why it matters now.** The assignment runs when the game file loads. LIES is a
post-load overlay and replaces `CopLogicAttack._upd_aim`,
`CopLogicIdle._perform_objective_action`, `_chk_has_old_action`,
`damage_clbk`, `on_new_objective`, etc. afterwards. Replacing a function on
`CopLogicIdle` does not update an alias already copied onto
`CopLogicPhalanxVip`. So phalanx units run 248.2 vanilla bodies for all of
those.

This is not a 248.2 regression (the same aliasing existed at 246.1), but:

- it is the only route that makes AI-02 reachable;
- LIES's aim/cover/detection-adjacent behavior is missing for VIP and minions;
- `CopLogicPhalanxMinion.damage_clbk` is the alias, so LIES's "no forced
  verify" damage behaviour does not apply to minions.

The same alias pattern exists elsewhere (`CopLogicArrest` 2–4,
`CopLogicSniper` 4–11, `CopLogicTravel` 5–10, `TeamAILogicIdle` 9–10,
`TeamAILogicTravel` 13–20). Those classes also keep 248.2 vanilla copies of
whatever LIES replaces on `CopLogicIdle`/`CopLogicAttack`/`CopLogicTravel`.
This audit only flags phalanx because it is in scope and because it creates the
AI-02 crash route; the others are pre-existing and lower risk (vanilla 248.2
bodies are 248.2-correct). Do not add per-class re-aliases in this port unless
the owner wants LIES behavior on those units too.

**Exact merge point.** If parity is wanted, re-alias after LIES's files load,
in the LIES phalanx files (which load last), e.g.:

```lua
CopLogicPhalanxVip._upd_aim = CopLogicAttack._upd_aim
CopLogicPhalanxVip._perform_objective_action = CopLogicIdle._perform_objective_action
CopLogicPhalanxVip._chk_has_old_action = CopLogicIdle._chk_has_old_action
CopLogicPhalanxVip.on_new_objective = CopLogicIdle.on_new_objective
CopLogicPhalanxVip.on_alert = CopLogicIdle.on_alert
CopLogicPhalanxVip.damage_clbk = CopLogicIdle.damage_clbk
```

(mirror for `CopLogicPhalanxMinion`). Verify file load order first: the LIES
phalanx files must execute after `coplogicattack.lua`/`coplogicidle.lua`.
Alternatively, leave the aliases vanilla and document that phalanx units are a
LIES-free zone. Either is defensible; silently doing neither is not.

**Test.** Phalanx heist: VIP must keep LIES-like aim (no long stare, re-acquire
on peek), minions must reposition/re-aim like the rest of the cops, and no new
errors. This is a feel check, not a pass/fail.

**Gate.** Smoke (phalanx).

---

## AI-04 — marshal marksmen are force-downgraded to `CopLogicAttack`

**Where.** `lua/copextensions/copbrain.lua:1`:

```lua
CopBrain._logic_variants.marshal_marksman.attack = CopLogicAttack
```

**248.2 change.** None between 246.1 and 248.2: vanilla maps
`logic_variants.marshal_marksman.attack = MarshalLogicAttack`
(248.2 `copbrain.lua:121–122`), and `MarshalLogicAttack` adds
`update` and `_chk_exit_non_walkable_area` on top of `CopLogicAttack`.

**Impact.** All marshal marksmen lose the marshal-specific update/exit path and
run the LIES `CopLogicAttack` instead. Because LIES also remaps
`logic_variants.marshal_shield` to a clone of `shield`, the whole marshal pair
behaves like ordinary units. Could be intentional ("LIES replaces marshal AI
with its own"), but nothing in `dev/` records that decision.

**Action.** Confirm intent with the mod owner. If intentional, add one line to
the port report / ledger note so the next update pass does not "fix" it back.
If not, delete the line and let 248.2's `MarshalLogicAttack` run (it will use
LIES's `_upd_aim` via inheritance, which is the normal cop path).

**Test.** Heist with marshal marksmen (Midland Ranch / marshal content): they
must still reposition when the player breaks LOS and must not stand in
non-walkable spots. Compare with and without the line if possible.

**Gate.** Smoke.

---

## AI-05 — `CopBase:pre_destroy` teardown moved to the engine

**Where.** 248.2 `lib/units/enemies/cop/copbase.lua:569–579`; 246.1 had:

```lua
unit:brain():pre_destroy(unit)
self._ext_movement:pre_destroy()
self._unit:inventory():pre_destroy()
UnitBase.pre_destroy(self, unit)
```

**248.2 change.** Commit `5d84b4be` ("247", 2026-08-13) removed that chain from
`CopBase`, the equivalent chain from `HuskCopBase`, and `CopSound:destroy`
(which previously called `unit:base():pre_destroy(unit)`). The same commit added
the `_destroying` guard/`Application:error` to
`UnitBase:add_destroy_listener` and lazy `_destroy_listener_holder`
allocation in `UnitBase:init` / `remove_destroy_listener`.

**Reading.** After 247 there is no Lua caller of `CopBrain:pre_destroy`,
`CopMovement:pre_destroy` or `CopInventory:pre_destroy`, yet all three are still
present. `CopBase:pre_destroy` itself still exists and still calls
`UnitBase.pre_destroy` (which sets `_destroying`, the flag the new guard reads).
The only consistent interpretation is that the engine now calls `pre_destroy`
on **each** extension, and the Lua-side manual chain was removed to stop the
double call. That also explains the `_destroying` hardening in the same commit.

**Impact on LIES.** None, as long as LIES does not re-add the manual chain.
Specifically:

- LIES does not define `CopBase:pre_destroy` and does not hook it
  (`grep "pre_destroy" lua/copextensions/` = no hits).
- LIES's `CopLogicBase.pre_destroy(data)` (143–147) clears
  `TeamAILogicBase._current_att_objs[data.key]`; it is reached only through
  `CopBrain:pre_destroy` -> `self._current_logic.pre_destroy`. If the engine
  dispatch assumption is wrong, that table leaks one entry per dead cop and
  `TeamAILogicIdle` keeps a stale key in its target-selection loop. No crash,
  small leak.
- LIES's position reservations are not at risk either way: death goes through
  `CopBrain:set_active(false)` -> `inactive` logic, and
  `CopLogicInactive.enter` calls `data.brain:rem_all_pos_rsrv()` (248.2
  `coplogicinactive.lua:34`).
- `CopSound:destroy` removal does not touch the LIES `CopSound` overlay: it
  only hooks `init` and overrides `say/_play/stop_speaking_clbk`.

**Action.** No runtime change. Do not add `brain():pre_destroy` calls to any
LIES `pre_destroy`; if the engine dispatch ever regresses, that would
double-run `CopLogicTrade.pre_destroy` and LIES's team-AI cleanup.

**Test.** Kill ~10 cops (mix of idle, travel, attack, shield/taser) in one
smoke run. Watch the log for `LEAKING POS RESERVATION`, errors from
`CopLogicTrade.pre_destroy`, and unexpected `TeamAILogicBase._current_att_objs`
growth (test harness can count the table if needed). No behavior difference is
expected.

**Gate.** Static + one kill pass.

---

## AI-06 — travel's nav-link wait depends on a LIES-only coarse-path shape

**Where.** `lua/coplogics/coplogictravel.lua:287–300` and `460–475`:

```lua
local nav_link = my_data.coarse_path[i + 1][3]
...
elseif my_data.coarse_path[i + 1][4] then
    for _, i_door in ipairs(target_door_list) do
        if type(i_door) == "number" then ...
        elseif alive(i_door) and ... i_door:delay_time() ...
```

**248.2 change.** 248.2 `search_coarse` / `_execute_coarce_search` build
2-tuples `{seg_id, pos}` (`navigationmanager.lua:1268–1290`); the 246.1
`{seg, pos, nav_link, multiple}` shape is gone. LIES still gets the 4-tuple
because LIES overrides `_execute_coarce_search`
(`lua/managers/navigationmanager.lua:2039`) and preserves `[3]`/`[4]`.

**Impact.** Today `[4]` is never assigned even in the LIES version
(`has_multiple_navlink_elements` is declared and never set), so the `elseif`
branch is dead and no `Vector3` ever reaches `alive()`. The nav-link wait
itself still works through `[3]` for the LIES tuple. The risk is the **next**
change: if P1d replaces LIES's coarse search with the 248.2 2-tuple, `[3]` and
`[4]` become nil, cops silently stop waiting for delayed nav links (ladders,
anim links), and the now-reachable loops call `alive()` / `:delay_time()` on
`Vector3` entries -> Lua error.

**Exact merge point.** Either keep the LIES `_execute_coarce_search` 4-tuple
contract as an explicit dependency of travel, or harden both loops with the v6
test before `alive()`:

```lua
if i_door.x then
    -- v6 door position; no nav-link delay to honour
elseif type(i_door) == "number" then
    ...
elseif alive(i_door) then
    ...
end
```

**Test.** Any heist with a ladder/anim nav link on a cop travel route: cops
must pause for the link instead of pathing through it. Also confirm no
`attempt to index a Vector3` / `alive` error in the log when many cops path
through multi-door segments.

**Gate.** Static today; smoke if the nav tuple changes.

---

## Applied

- AI-01 + AI-02 fixed: `find_segment_doors` default branch returns raw
  `nav_link_end_pos()` positions; `_upd_aim` handles `door.x` raw positions.
  `center_only` still returns `{center}` / `{center, end_pos}` tables.
- AI-03 deferred: phalanx aliases still run vanilla bodies; document/decide
  later. AI-02 crash route is removed for vanilla callers.
- AI-04 documented: `marshal_marksman` is force-mapped to `CopLogicAttack`;
  confirm intent before changing.
- AI-05 no code change: do not re-add extension pre_destroy chain.
- AI-06 latent: keep the 4-tuple coarse-path contract, or add `door.x` guards
  before a future vanilla coarse-search merge.

## Verified non-gaps (checked, no action)

These are the items the task called out that turned out to be already covered
or unchanged between 246.1 and 248.2.

- **`CopBrain` distraction objective.** `set_distract_objective`,
  `clbk_distract_objective_{failed,complete}`, `is_distracted`,
  `_logic_data.distract_objective`, `distract_penalty_t` are byte-identical in
  246.1 and 248.2 (`copbrain.lua:278–377`); the only 248.2 `copbrain` changes
  are the `auctioneer_boss` variant, the debug-print removal in
  `attention_objects()`, and the `convert_to_criminal` refactor, none of which
  LIES overrides. LIES's `set_objective` passes the objective through intact
  and delegates to the logic's `on_new_objective`, so `distraction`,
  `fail_clbk`, `complete_clbk`, `followup_objective` and `action_duration` are
  preserved. `CopLogicIdle.is_available_for_assignment` keeps the 248.2
  `objective.distraction` branch (LIES idle 958–961).
- **`dazed` detection and `suspicion_mul`.** `presets.detection.normal.dazed`,
  `detection.guard.dazed`, `immune_to_daze`, the `distraction_dazed` act and
  `raycastweaponbase` setting `detection = char_tweak.detection.dazed` are all
  identical in 246.1 and 248.2. LIES's `_upd_suspicion` keeps the
  `my_data.detection.suspicion_mul` multiplier (LIES `coplogicbase.lua:609`).
  Dazing a LIES cop therefore still routes through the 248.2 vanilla
  `set_distract_objective` into the LIES logic.
- **`CopLogicIdle` / `CopLogicTravel` new objective fields.** No objective key
  was added between 246.1 and 248.2 in `lib/units/enemies/**` or
  `lib/managers/group_ai_states/**` (set comparison of
  `objective.<field>` identifiers; only `from_seg` disappeared, and it is a
  local, not an objective field). The only logic-file changes are the two
  `TimerManager:game():time()` freshness fixes (`CopLogicIdle.damage_clbk`,
  `CopLogicIdle.on_area_safety`). LIES overrides `damage_clbk` and already
  inherits the fix (`data.t = t`, LIES idle 1697); LIES does **not** override
  `on_area_safety`, so the 248.2 fix applies to it automatically.
- **`CopLogicAttack` aim/cover/door fields.** The 248.2 `coplogicattack` diff is
  the six hunks already decided (inline action tables, `math.rand` dodge
  timeout, `_upd_aim` no-ops, suppressed-before-walk reorder, `.center` ->
  raw door position in `_get_expected_attention_position`) plus the
  `_get_expected_attention_position` change covered by AI-02. No new aim/cover
  fields. The three decisions are already implemented in the worktree:
  `math.rand` at 2297, suppression gate restored at 2492, taser vertical guard
  at 441.
- **`CopMovement` action update order.** `_upd_actions` is unchanged between
  246.1 and 248.2 (the file diff is `IDS_*` constants and the new
  `action_variants.lead_curator` / `auctioneer_boss` entries). The LIES
  `PostHook` on `_upd_actions` is still valid; nothing calls
  `action_complete_clbk` with a new signature. LIES's `force_upd_z_ray` is a
  mod-only addition and is not referenced by 248.2.
- **`CopBase` LOD changes.** 248.2 added `self.lod_stage and
  self:lod_stage()` guards in `prevent_invisibility`, `set_force_invisible`,
  `set_anim_lod`, `chk_freeze_anims`, `prevent_main_bones_disabling`. LIES's
  `copbase.lua` overlay only defines `default_weapon_name`,
  `_refresh_buff_total`, `change_buff_by_id`, `change_and_sync_char_tweak`, so
  the vanilla guarded bodies run. `_refresh_buff_total` is unchanged in 248.2.
- **`CopDamage`.** 248.2 added achievement `stealth`/`loud`/`masks` predicates,
  pick-up visibility in `set_pickup`, and dropped an unused `from_behind`
  calculation. LIES's overlay only replaces `damage_explosion`, which was not
  touched; `set_pickup` and achievements stay 248.2 vanilla.
- **`CopSound`.** `destroy` was removed in 247 (part of AI-05), but the LIES
  overlay only hooks `init` and overrides `say` / `_play` / speaking callbacks;
  nothing there depends on `destroy` ordering.
- **New unit tweak tables.** 248.2 adds `lead_curator` (civilian) and
  `auctioneer_boss` (security variant, `logic_variants.auctioneer_boss =
  security_variant`), plus `action_variants`/`civilian_types` entries. LIES's
  `_logic_variants` mutations do not shadow them: `auctioneer_boss` inherits
  the security variant, whose `attack` is `CopLogicAttack` (LIES's body), and
  LIES's `CharacterTweakData` overlay only hooks `init` and defines
  `_init_region_america` / chatter helpers, so the new `_init_*` calls in
  vanilla `init` still run. `auctioneer_boss` has
  `has_alarm_pager = false`, `no_arrest = true`, `surrender = nil`; no LIES
  code reads those unit names.
- **`CopBrain:attention_objects()`.** 248.2 reduced it to `return` (debug
  prints removed). Nothing in LIES or the test harness calls it.

## Open questions for the smoke run

1. Does phalanx VIP actually reach the vanilla `_upd_aim` door branch? (AI-02,
   AI-03). If the marshal/phalanx content is not available in the test profile,
   at minimum confirm the log is clean on a heist with anim nav links.
2. Does `CopBrain:pre_destroy` run at 248.2? AI-05 predicts yes. One kill pass
   with `!lies dump`-style inspection (or a temporary counter) settles it
   without a code change.
3. Is the `marshal_marksman` downgrade intentional? (AI-04). Owner decision,
   not a static question.

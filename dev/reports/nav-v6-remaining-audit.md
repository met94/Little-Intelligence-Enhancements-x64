# NavigationManager nav-v6 remaining block - audit

Date: 2026-11-01
Branch: `feat/ai-suite-compat` (HEAD `08c7156`)
Game target: 248.2, commit `e3a8b616`. Baseline: 246.1 - `game-data\manifest.json`
maps it to `b36f5fbb`, which is what `pd2fn -From 246.1` reads; the line numbers
in this report were read from the 246.1 restyle pivot `a3180fc` and are labelled
`246.1@a3180fc:<line>`. The bodies cited here are the same code in both (restyle
pivot only), at different line offsets.

Status: **closed** — the three edits this audit lists (P1/P2/P3, "Real gaps and
implementation order") were merged in `cbc4a29` and released as `8.57.25`;
`dev/tools/test/nav-gates.test.mjs` pins them. Verdicts that were `keep LIES`
(`remove_obstacle`, `_draw_covers`) and `already merged` (`add_obstacle`,
`set_nav_segment_state`) stand unchanged. The Iter note in section 2 carries a
correction (the audit first read the stale `master` checkout of `mods/Iter`).

Purpose: decide the five open rows of the nav-v6 block (`register_cover_units`,
`_execute_coarce_search`, `_sort_nav_segs_after_pos`, `remove_obstacle`,
`_draw_covers`) plus re-verify the two rows `port-status.md` calls done
(`add_obstacle`, `set_nav_segment_state`) before any further Lua is written.
**No runtime Lua was edited by this audit.** Two of the seven rows were already
fully merged, one is dead code, one needs no change (LIES is a superset of the
vanilla fix); what is left is three edits across two constructs, and the larger
one is a construct LIES dropped that *both* baselines still have.

## Method

| Item | Path / command |
| --- | --- |
| LIES body | `lua/managers/navigationmanager.lua` (2512 lines, 40 `NavigationManager:` definitions) |
| Vanilla 248.2 | `D:\Programowanie\payday\2\v2\game-data\Payday-2-LuaJIT-Complete\lib\managers\navigationmanager.lua` |
| Vanilla 246.1 | `git -C game-data\Payday-2-LuaJIT-Complete show a3180fc:lib/managers/navigationmanager.lua` (2970 lines, the restyle-pivot commit the line numbers here were read from) |
| Per-function delta | `powershell -ExecutionPolicy Bypass -File tools\pd2fn.ps1 -From 246.1 -To 248.2 -Path lib/managers/navigationmanager.lua -Class NavigationManager -Name <fn>` |

The manifest baseline for 246.1 is `b36f5fbb` (2928 lines) - the commit
`pd2fn -From 246.1` reads - while the `246.1@a3180fc:<line>` citations in this
report were read from the restyle pivot `a3180fc`. The body of every function
cited here is the same code in both (operand-order flips in the two delay
comparisons, `= nil` omitted in `set_nav_segment_state`); only the offsets
differ - the two delay-gate lines are `246.1@a3180fc:1829`/`1952` and
`b36f5fbb:1801`/`1924`.

The `pd2fn` diffs below are quoted verbatim from that command; `246.1@a3180fc`
numbers are lines in the `git show` dump, `248.2` numbers are lines in the
checkout.

Scope note: LIES is a SuperBLT **post-hook file** (`mod.txt:45-46`,
`"hook_id": "lib/managers/navigationmanager"`), so it executes after the game's
module and every `function NavigationManager:X` in it is a bare override of the
248.2 body. Load order is `BLT:ProcessModsList` sorting **descending** by
priority (`mods/base/base.lua:234-241`) and `BLTModManager:SetModsList` calling
`mod:Setup()` in that order (`mods/base/req/BLTModManager.lua:60-70`), which
appends each mod's hook file to `BLT.hook_tables.post[hook_id]`
(`mods/base/req/BLTMod.lua:125-140`) and runs them in insertion order
(`mods/base/base.lua:158-176`, `:178-205`). LIES 100 -> loads **first**;
Iter 40 -> loads **second**, therefore Iter's wrappers capture LIES' bodies.

## 1. `register_cover_units`

### Vanilla delta 246.1 -> 248.2

```
-	local rooms = self._rooms
 	local covers = {}
@@
-			if self._debug then
-				t_ins(covers, cover)
-			end
+			t_ins(covers, cover)
@@
-				_register_cover(cover_data.positions[i], mvector3.copy(temp_vec1))
+				_register_cover(cover_data.positions[i], mvec3_copy(temp_vec1))
...
-				_register_cover(cover_desc[1], mvector3.copy(temp_vec1))
+				_register_cover(cover_desc[1], mvec3_copy(temp_vec1))
@@
-			if self._debug then
-				t_ins(covers, cover)
-			end
+			t_ins(covers, cover)
 
-			local location_script_data = self._quad_field:get_script_data(nav_tracker)
+			local location_script_data = self._quad_field:get_script_data(nav_tracker, true)
```

Four deltas, one behavioural:

1. unused `local rooms = self._rooms` dropped (248.2:792) - the last `_rooms`
   read in this function; `_sort_nav_segs_after_pos` lost its `_rooms`/
   `_room_doors` reads too (see section 3);
2. the debug-gated `t_ins(covers, cover)` became unconditional in **both**
   push sites (248.2:805, 248.2:847). In 246.1 `self._covers` was an editor-only
   debug list;
3. `mvector3.copy` -> the file-local `mvec3_copy` alias (248.2:824, :830) - perf
   restyle only;
4. the cover-unit fallback branch now passes `get_script_data(nav_tracker, true)`
   (248.2:849) where 246.1@a3180fc:1433 passed no flag. The sibling call site already
   passed `true` in 246.1 (`246.1@a3180fc:1389`) and 248.2 made the two consistent.

### LIES delta vs 248.2

LIES `:454-585`; the 248.2 construct that matters is present:

```lua
-- lua/managers/navigationmanager.lua:513-516
			t_ins(location_script_data.covers, cover)
			t_ins(covers, cover)
			
			self:destroy_nav_tracker(navseg_tracker)

-- :550
			t_ins(covers, cover)
```

Both pushes are unconditional, so **LIES does not depend on the debug gate**  - 
that part of the 248.2 change is already merged, and LIES could not have worked
otherwise (`self._covers` is read by LIES' own `find_cover_*_LUA` at `:1924`,
`:2019`, `:2118`). For the record `self._debug = IS_PC and Application:production_build()`
(248.2:89) is not reliably false on retail, and Iter forces it true around its
own call anyway (`mods/Iter/lua/navigationmanager.lua:107-108`).

Deliberate LIES differences (keep):

- rejects covers with `nav_tracker:lost()` / no nav segment / no segment `pos`
  and destroys the tracker (`:471-482`), and rejects covers failing
  `generate_cover_fwd` + `check_cover_close_to_wall` (`:499-505`). 248.2 accepts
  every cover;
- `location_script_data` is fetched from a **separate tracker at the segment
  centre** (`:491-492`, `:507`), then that tracker is destroyed (`:516`), so
  covers are filed on the segment's script data, not on the cover's own
  tracker (248.2:807 files on `nav_tracker`);
- `door_cache` memoises `find_segment_doors(seg_id, nil, true)` per segment
  (`:465`, `:484-489`);
- tail work 248.2 does not have: `_change_funcs()` (`:574`), Nav-B cover
  generation scheduling (`:576-582`), delayed `_do_nav_fixes` (`:584`).

**Remaining gap: the missing `true` at `:551`.**

```lua
-- lua/managers/navigationmanager.lua:551-557
			local location_script_data = self._quad_field:get_script_data(nav_tracker)

			if not location_script_data.covers then
				location_script_data.covers = {}
			end
```

If the engine returns `nil` for a tracker without script data, `:553` is a Lua
index-nil error inside `register_cover_units` - cover registration aborts for
that map. 248.2:849 is the same call with `, true`. This branch only runs when
`managers.worlddefinition:get_cover_data()` returns nil (legacy unit-based
covers), which is why it has never shown up in testing.

**Verdict: `merge: add the 248.2 create flag to the cover-unit branch`.**

## 2. `_execute_coarce_search`

### Vanilla delta 246.1 -> 248.2

```
-	local i = 0
-
-	while true do
-		if i == 500 then
-			debug_pause("[NavigationManager:_execute_coarce_search] endless loop", inspect(search_data))
-
-			return false
-		else
-			i = i + 1
-		end
+	local t = TimerManager:game():time()
+	local all_nav_segments = self._nav_segments
 
+	for i = 1, 500 do
 		...
-		local all_nav_segments = self._nav_segments
 		local neighbours = all_nav_segments[next_search_i_seg].neighbours
@@
-			for _, i_door in ipairs(neighbours[search_data.end_i_seg]) do
-				if type(i_door) == "number" then
+			for _, door in ipairs(neighbours[search_data.end_i_seg]) do
+				if door.x then
 					entry_found = true
 
 					break
-				elseif i_door:delay_time() < TimerManager:game():time() and i_door:check_access(...) then
+				elseif t > door:delay_time() and door:check_access(...) then
```

plus: `local searched`/`local to_search` hoisted, `for i_seg in pairs(...)` when
only the key is used, `#to_search == 0` instead of a `nr_seg_to_search` local,
the `seg_searched[...] = ...` assignment de-nested out of the `else`, and the
`debug_pause`+`return false` moved after the loop (248.2:1327-1329).

Loop shape is **equivalent**, not a fix: `i == 500` is checked before the
increment, so 246.1 also runs exactly 500 iterations. Real deltas: hoisted
`all_nav_segments` (perf), hoisted `t` (perf + one timestamp per search), and
`door.x` instead of `type(i_door) == "number"` (v6 nav-link objects vs v5 door
indices).

### LIES delta vs 248.2

LIES `:2292-2401` is the 246.1 shape with nav-link extensions:

- `local i = 0` / `while true` / `if i == 500` (`:2294-2303`) - **not** the
  `for i = 1, 500` restructure, and no hoisted `t`;
- `local all_nav_segments = self._nav_segments` **inside** the loop (`:2310`);
- entry detection keeps the *last* usable nav link instead of breaking at the
  first match, and drops the delay gate:

```lua
-- lua/managers/navigationmanager.lua:2316-2326
			for _, i_door in ipairs(neighbours[search_data.end_i_seg]) do
				if i_door.x then
					entry_found = true
					nav_link_element = nil

					break
				elseif i_door:check_access(search_data.access_pos, search_data.access_neg) and not i_door:is_obstructed() then
					entry_found = true
					nav_link_element = i_door
				end
			end
```

- path entries are 4-tuples `{i_seg, pos, nav_link, multiple_nav_links}`
  (`:2332-2359`) where 248.2 returns 2-tuples `{i_seg, pos}` (`:1268-1289`);
  `has_multiple_navlink_elements` is declared (`:2314`) and never assigned, so
  `[4]` is always nil (already filed as AI-06 in `core-ai-gap-audit.md`);
- LIES adds `not i_door:is_obstructed()` to the entry test (248.2 has only
  delay+access);
- LIES' caller contract still matches 248.2: `search_coarse` builds
  `id/to_pos/start_i_seg/end_i_seg/seg_searched/discovered_seg/seg_to_search/
  results_callback/verify_clbk/access_pos/access_neg` (248.2:1477-1494), all of
  which LIES's body reads. The first queue entry is `{i_seg = start_i_seg}`
  with **no `pos`** (248.2:1489-1491), which is why LIES passes a possibly-nil
  `from_pos` and guards it in `_sort_nav_segs_after_pos` (`:2407`).

**Missing 248.2-family construct: the nav-link `delay_time()` gate.** It exists
in *both* baselines - `246.1@a3180fc:1829`
(`TimerManager:game():time() > i_door:delay_time()`) and 248.2:1257
(`t > door:delay_time()`) - and LIES has neither. This is not a "248.2 fix";
it is a construct LIES dropped relative to 246.1.

**Is the loop restructure worth porting?** No on its own (equivalence + two
hoists). The `t` hoist is only needed *because* the delay gate wants one
timestamp per search.

**Iter interaction.** `mods/Iter/lua/navigationmanager.lua:2146-2147`:

```lua
if Iter.settings.nav_search then
	NavigationManager._execute_coarce_search = NavigationManager.itr_execute_coarce_search
end
```

with `nav_search = true` as the shipped default (`mods/Iter/lua/corecode.lua:17`).
That is a wholesale **assignment**, not a wrap: when Iter is installed with
defaults, LIES' body is dead. Iter's replacement is a separate Dijkstra
(`potential_paths` + string path keys + `itr_coarse_cache`,
`itr_execute_coarce_search` at `navigationmanager.lua:1901`), so the only
interaction is (a) total replacement of the function and (b)
`set_nav_segment_state` clearing `itr_coarse_cache` (see section 7). The delay-gate
gap therefore only matters for the **LIES-only profile** or Iter with
`nav_search` off.

**Correction to the first version of this note (2026-11-01, after `cbc4a29`).**
The paragraph above was first written against the stale `master` checkout of
`mods/Iter` (a tree whose `changelog.txt` starts at `Revision 200.1`), and it
therefore claimed that the Iter 200.20 FIFO-cursor rework "does not exist in
this checkout". That was wrong about the live line: Iter's current branch is
`feat/ai-suite-compat`, version **200.21**, and it **does** carry the FIFO
cursor rework of `_execute_coarce_search` - commit `f896b61` *perf(nav): FIFO
cursor instead of table_remove(seg_to_search, 1)*, released as **200.20**, which
replaced the `table_remove(seg_to_search, 1)` head shift with head/tail indices.
Both line references above are from that branch: it has the assignment at
`:2146-2147` and `itr_execute_coarce_search` at `:1901`, where the stale `200.1`
tree this audit first read had them at `:1436-1438` and `:1202`.

The conclusion does not change, because it never depended on the Iter body: Iter
still **assigns the whole function**
(`NavigationManager._execute_coarce_search = NavigationManager.itr_execute_coarce_search`),
so LIES' body - and with it the restored gate - is unreachable while
`nav_search` is on, whatever that body does internally. The cursor rework is a
performance change *inside* the Iter replacement, not a third participant in the
LIES/Iter interaction.

**Verdict: `merge: add the nav-link delay gate`** (`local t` + one condition).
Keep LIES' loop shape, 4-tuple contract and nav-link capture.

## 3. `_sort_nav_segs_after_pos`

### Vanilla delta 246.1 -> 248.2

Signature is unchanged at 6 arguments; the body was restructured:

```
 	local all_segs = self._nav_segments
-	local all_doors = self._room_doors
-	local all_rooms = self._rooms
+	local t = TimerManager:game():time()
 	local seg = all_segs[i_seg]
 	local neighbours = seg.neighbours
-	local found_segs = nil
+	local found_segs
+
+	local function check_segment(neighbour_seg_id, end_pos)
+		local weight = mvec3_dis(end_pos, to_pos)
...
-			for _, i_door in ipairs(door_list) do
-				if type(i_door) == "number" then
-					local door = all_doors[i_door]
-					local door_pos = door.center
+			for _, door in ipairs(door_list) do
+				if door.x then
+					local end_pos = door
```

Net: v5 door table lookup (`all_doors[i_door]`, `door.center`) -> v6 Vector3 door
entry; the four repeated `found_segs` blocks collapse into `check_segment`;
`TimerManager:game():time()` is read once into `t`; weight is a single
`mvec3_dis(end_pos, to_pos)`.

Two details worth recording because they look like gaps and are not:
`all_rooms` was already dead in 246.1 (the diff deletes it, it is never read),
and the `debug_pause("[...] dead nav_link! ...")` branch survives into 248.2
(248.2:1366-1367).

### `_rooms` / `_room_doors` in 248.2

Both fields still exist, but nothing in the search path uses them:

- `local doors = self._room_doors` - 248.2:691, inside the editor debug-mesh
  draw pass (the `_draw_door` loop);
- `self._rooms[i_room].vis_group` - 248.2:1602, an editor helper;
- `self._builder._rooms` / `self._builder._room_doors` - 248.2:420, :459, :476
  in `_create_load_data_from_builder` (save/convert path).

LIES references `_rooms`/`_room_doors` **nowhere** (grep: 0 matches in
`lua/managers/navigationmanager.lua`). The backlog worry that LIES depends on
dropped v5 room tables is stale.

### LIES delta vs 248.2

LIES `:2403-2453`, 7 arguments:

```lua
-- :2403, :2404-2408
function NavigationManager:_sort_nav_segs_after_pos(to_pos, from_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)
	local all_segs = self._nav_segments
	local seg = all_segs[i_seg]
	local neighbours = seg.neighbours
	from_pos = from_pos or seg.pos
	local found_segs = nil
```

- **7th parameter `from_pos`** inserted after `to_pos`, and a two-term weight
  `mvec3_dis(from_pos, door_pos) + mvec3_dis(door_pos, to_pos)` (`:2423`)  - 
  A*-style g+h. Deliberate LIES difference; it is what makes the LIES coarse
  search cost-aware. Keep.
- `nav_link` is carried into the segment data (`:2419`, `:2429`) so the 4-tuple
  path can name the link it used. Keep.
- dead nav links are **silently skipped** (`:2417` `alive(door) and ...`) where
  248.2 `debug_pause`s (`:1366`). Keep - a `debug_pause` in the nav hot path is
  worse than skipping.
- **no `t`, no `delay_time()` gate** - 246.1@a3180fc:1952 and 248.2:1368 both have
  `TimerManager:game():time() > i_door:delay_time()` inside the
  `not is_obstructed` branch; LIES' `:2417` condition is
  `alive(door) and not door:is_obstructed() and door:check_access(...)`.

Note this function is **not redefined** by Iter, so LIES' 7-argument contract is
safe there; but Iter's `_execute_coarce_search` replacement never calls it, so the
gate in it is unreachable while Iter's `nav_search` is on (see section 2), i.e. in
the default layout. It is only unsafe under NavFixes, which redefines it with 6
arguments (`compatibility.md`, section 2.1).

**Verdict: `merge: add the nav-link delay gate`.** Do **not** adopt the
`check_segment` closure: it is pure restructure and would force dropping
`from_pos` and touching the caller.

## 4. `remove_obstacle`

### Vanilla delta 246.1 -> 248.2

Whole-function rewrite (`246.1@a3180fc:2744` -> 248.2:2015-2060): nil-object guard,
`unit_data():remove_destroy_listener(NavigationManager._OBSTACLE_DESTROY_KEY)`,
an unconditional `self._quad_field:remove_obstacle(obstacle_obj)`, and the
swap-with-last removal replaced by an index-based `temp_array` rebuild that
drops dead units and calls `self._quad_field:remove_obstacle(obs_data.id)` for
the matching entry.

### LIES delta vs 248.2 - the "already merged" check

LIES `:1642-1687` carries, in order: the nil guard (`:1645-1649`), the
destroy-listener removal (`:1651-1655`), the index-based `temp_array` rebuild
(`:1657-1686`) - **all three already-merged pieces are present**, plus a
superset fix 248.2 does not have:

```lua
-- lua/managers/navigationmanager.lua:1664-1670
		if not alive(obs_data.unit) then
			Application:debug("[NavigationManager:remove_obstacle] Found dead unit in obstacle list, removing it:", i)

			self._quad_field:remove_obstacle(obs_data.id)

			removed = true
```

248.2:2039-2043 only *drops the list entry* for a dead unit and never frees its
engine obstacle - i.e. vanilla leaks a ghost blocker in that branch, LIES does
not.

**Missing call: `self._quad_field:remove_obstacle(obstacle_obj)`** (248.2:2030).
LIES removes only by the numeric id stored in `self._obstacles`.

What that costs: nothing measurable in the current design.

- LIES' own `add_obstacle` always inserts the id it got back (`:1581-1587`), so
  every obstacle LIES added has an entry; the matching branch removes it
  (`:1673`);
- the dead-unit branch removes by id (`:1667`) exactly where 248.2 would leak;
- the simulation-end path in 248.2 (`on_simulation_ended`, :1722-1752) already sweeps
  `for i, obs_data in ipairs(self._obstacles) do self._quad_field:remove_obstacle(obs_data.id) end`
  before `self._obstacles = {}`, so bookkeeping cannot go stale across heists;
- the only scenario the object call covers that LIES does not is "an obstacle
  exists in the quad field with no `_obstacles` entry". No caller produces that
  state (module load happens before any mission runs, and LIES' file replaces
  the function wholesale).

Residual note for the reviewer: `compatibility.md:264` still says
"`remove_obstacle` - **no** (LIES only overrides `add_obstacle`)", which is
stale; LIES has had the function since the NavFixes absorption and the log line
`[NavigationManager:remove_obstacle] Found dead unit ...` would be the tell if
the id path ever missed.

**Verdict: `keep LIES`.** Optional one-line parity
(`self._quad_field:remove_obstacle(obstacle_obj)` above the rebuild) is
harmless - 248.2 itself calls both - but it fixes nothing observable today; see
"needs a user decision".

## 5. `_draw_covers`

### Vanilla delta 246.1 -> 248.2

Pure restyle + three construct changes (verbatim `pd2fn` output, trimmed):

```
-	local reserved = self.COVER_RESERVED
-	local cone_height = Vector3(0, 0, 80)
-	local arrow_height = Vector3(0, 0, 1)
+	local Application = Application
+	local COVER_TRACKER = self.COVER_TRACKER
+	local COVER_FORWARD = self.COVER_FORWARD
+	local COVER_POSITION = self.COVER_POSITION
+	local COVER_RESERVED = self.COVER_RESERVED
+	local UP = math.UP
...
-		local draw_pos = cover[1]
-		local tracker = cover[3]
+		local draw_pos = cover[COVER_POSITION]
+		local tracker = cover[COVER_TRACKER]
+		local draw_to = temp_vec1
+
+		mvec3_set(draw_to, draw_pos)
+		mvec3_add(draw_to, cone_height)
@@
-			local placed_pos = tracker:position()
+			local placed_pos = temp_vec2
+
+			tracker:m_position(placed_pos)
@@
-		Application:draw_rotation(draw_pos + arrow_height, Rotation(cover[2], math.UP))
+		mvec3_set(draw_to, draw_pos)
+		mvec3_add(draw_to, arrow_height)
+		mrot_set_look_at(temp_rot1, cover[COVER_FORWARD], UP)
+		Application:draw_rotation(draw_to, temp_rot1)
```

`cone_height` (`Vector3(0, 0, 80)` in 248.2, `(0, 0, 30)` in LIES) and
`arrow_height` moved from function locals to
module-level locals (248.2:31-32), `temp_vec1`/`temp_vec2`/`temp_rot1` replace
fresh `Vector3()`/`tracker:position()` allocations, and the cover indices become
symbolic. No behaviour change to the covers themselves; 248.2 still draws a cone
at `draw_pos`, a red sphere at the placed position when `tracker:lost()`, and a
grey sphere when `cover[COVER_RESERVED]`.

### LIES delta vs 248.2

LIES `:419-452` is the 246.1 body plus one branch:

```lua
-- lua/managers/navigationmanager.lua:428-439
		if tracker:lost() then
			Application:draw_cone(draw_pos, draw_pos + cone_height, 60, 1, 0, 0)

			local placed_pos = tracker:position()

			Application:draw_sphere(placed_pos, 20, 1, 0, 0)
			Application:draw_line(placed_pos, draw_pos, 1, 0, 0)
		elseif tracker:obstructed() or not self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) then
			Application:draw_cone(draw_pos, draw_pos + cone_height, 60, 1, 0, 1)
		else
			Application:draw_cone(draw_pos, draw_pos + cone_height, 60, 0, 1, 0)
		end
```

LIES is a strict superset for debugging (adds "obstructed tracker / disabled
nav segment" in magenta) and draws the facing as a 100-unit line instead of a
rotation gizmo (`:441-446`).

**Is any of this live?** No. 248.2 calls it only from `update` when
`self._debug_draw_options.covers` is set (248.2:159-161, an editor/console-only
switch), and LIES comments its own call out: `--self:_draw_covers()`
(`:1250`, inside the post-hook `update`). It is dead code either way.

Porting 248.2's body would also drag in two file-scope locals LIES' chunk does
not have - LIES' header declares `temp_vec1..4` and `math_up` (`:26-30`) but no
`temp_rot1` and no `mrot_set_look_at` (vanilla has them at 248.2:20, :30) - so a
verbatim copy is a freevars hit for zero gameplay value.

**Verdict: `keep LIES`.** No port.

## 6. `add_obstacle` (verify "already applied")

LIES `:1532-1588` carries both 248.2 pieces:

```lua
-- lua/managers/navigationmanager.lua:1543-1557
	local obstacle_obj = obstacle_unit:get_object(obstacle_obj_name)

	if not obstacle_obj then
		Application:error("[NavigationManager:add_obstacle] There was no obj to reference in this unit!", obstacle_unit, obstacle_obj_name)

		return
	end

	local scriptdata_ext = obstacle_unit:unit_data()

	if scriptdata_ext and scriptdata_ext.add_destroy_listener then
		scriptdata_ext:add_destroy_listener(NavigationManager._OBSTACLE_DESTROY_KEY, callback(self, self, "_clbk_obstacle_unit_destroyed", obstacle_obj_name))
	else
		Application:error("[NavigationManager:add_obstacle] No unit_data extension to listen for destruction!", obstacle_unit)
	end
```

and stores `id = id` in the obstacle table (`:1583-1587`), then keeps the LIES
`_cached_paths` invalidation between the listener and the field add
(`:1559-1579`). Confirmed merged, matching `port-decisions.md`, section 12.

Two intentional deviations, both fine:

- LIES keeps the 246.1 `if self._debug then ... debug_pause_unit(...) return end`
  duplicate-add guard (`:1533-1541`), which 248.2 deleted (248.2:1989-1996 has
  no such block). Keeping it means a duplicate `add_obstacle` is dropped instead
  of registering a second engine obstacle - the safer side, and it is the only
  `self._debug` use left in the LIES file;
- LIES' error message omits 248.2's trailing `world_id` argument (248.2:1993),
  which is an undefined global in vanilla (its only occurrence in the file) and
  therefore always `nil`. Dropping it is a cleanup, not a gap.

**Verdict: `already merged`.**

## 7. `set_nav_segment_state` (verify "already applied")

248.2 delta was `local unique_id = tostring(id)` threaded through every lookup
and engine call, plus the v5 message typo fix (`inexistent` -> `nonexistent`).
LIES `:1736-1828` carries it:

| 248.2 construct | LIES |
| --- | --- |
| `local unique_id = tostring(id)` | `:1737` |
| `self._nav_segments[unique_id]` guard | `:1739` |
| `set_nav_segment_blocked_filter(unique_id, ...)` | `:1749`, `:1786` |
| `blocked_group` on `unique_id` | `:1751`, `:1788` |
| `is_nav_segment_enabled(unique_id)` | `:1790` |
| `disabled` on `unique_id` | `:1797` |
| `set_nav_segment_enabled(unique_id, ...)` | `:1800` |
| `on_nav_segment_state_change(unique_id, ...)` | `:1801` |

LIES adds the `_cached_paths` invalidation for `forbid_custom` (`:1753-1781`)
and for a disabled segment (`:1804-1827`), plus an extra `log(...)` line before
the `debug_pause` (`:1740-1741`) so the failure is visible in a retail log. Only
cosmetic residuals remain (`local seg_disabled_state = nil` at `:1791` vs bare
`local seg_disabled_state` - identical semantics).

**Verdict: `already merged`.**

## 8. Cover-array indices (`COVER_*`)

248.2 defines the index constants at `:46-50`:

```lua
NavigationManager.COVER_POSITION = 1
NavigationManager.COVER_FORWARD = 2
NavigationManager.COVER_TRACKER = 3
NavigationManager.COVER_RESERVED = 4
NavigationManager.COVER_RESERVATION = 5
```

246.1 had only `COVER_RESERVED = 4` and `COVER_RESERVATION = 5`
(`246.1@a3180fc:39-40`) - `_draw_covers` used literals `cover[1]`/`cover[3]` there.

LIES **defines none of them** (grep for `COVER_POSITION|COVER_FORWARD|
COVER_TRACKER|COVER_RESERVATION` across `lua/`: 0 hits); it reads only
`self.COVER_RESERVED` (`:420`, `:1924`, `:2019`, `:2118`) and literals 1/3.

Where LIES builds cover entries - layout matches 248.2 exactly:

```lua
-- lua/managers/navigationmanager.lua:493-497  (cover_data branch)
			local cover = {
				nav_tracker:field_position(),
				fwd,
				nav_tracker
			}

-- :543-548  (legacy cover-unit branch, index 4 = reserved)
			local cover = {
				nav_tracker:field_position(),
				fwd,
				nav_tracker,
				true
			}
```

So `cover[1]=COVER_POSITION`, `[2]=COVER_FORWARD`, `[3]=COVER_TRACKER`,
`[4]=COVER_RESERVED` all line up, and 248.2's `_draw_covers` /
`clbk_navfield("invalidated_script_data")` (`:2147-2160`) can read LIES-built
covers. Two consequences:

1. LIES' constants come from vanilla 248.2 - fine while LIES is a post-hook
   overlay, would break if LIES ever shipped a whole replacement file;
2. LIES never writes index 5, so vanilla's reservation bookkeeping (if any code
   path still runs it) sees no LIES cover as reservable. LIES' own search reads
   only index 4, so this is internally consistent.

`cover[2]` is a unit vector: `generate_cover_fwd` ends in
`mvec3_dir(new_fwd, field_pos, best_door_pos)` (`:299`, `mvector3.direction`
normalises), so a look-at style consumer would work; the known deviation is
facing *direction* (LIES points at the wall, engine covers point away  - 
`port-status.md`, "Known deviations"), not length.

## 9. Cross-mod: Iter also hooks `lib/managers/navigationmanager`

`mods/Iter/mod.txt` -> `"priority": 40`, version `200.21` on branch
`feat/ai-suite-compat` (the `master` checkout this audit first read is stale at
`200.1`; see the correction in section 2). LIES `mod.txt` ->
`"priority": 100`. Load order is descending priority (`mods/base/base.lua:236-238`),
so **LIES loads first, Iter second**.

Line references below were re-read on Iter `feat/ai-suite-compat` (200.21)
except the `_sort_nav_segs_after_pos`/`_draw_covers` rows, which are LIES-side
(`lua/managers/navigationmanager.lua`) and carry this worktree's numbers.

| Function | LIES | Iter | Effective winner |
| --- | --- | --- | --- |
| `register_cover_units` | bare override `:454` | wrap: saves `itr_original_...`, sets `self._debug = true`, calls it, then filters `self._covers` (`navigationmanager.lua:208-235`; early-returns to the original when `nav_streamline` is off, `:210-212`) | **Iter's wrapper -> LIES' body**. Both run. |
| `set_nav_segment_state` | bare override `:1737` | wrap: `tostring`, `itr_original_...`, clears `itr_coarse_cache`, rebuilds neighbour lists (`:1039-1051`) | **Iter's wrapper -> LIES' body**, then Iter's rebuild. LIES' second `tostring` is idempotent. |
| `_execute_coarce_search` | bare override `:2293` | **assignment** under `if Iter.settings.nav_search` (`:2146-2147`) | **Iter's body entirely** (default `nav_search = true`, `corecode.lua:17`). LIES' body is dead in that profile. |
| `_sort_nav_segs_after_pos` | bare override, 7 args `:2406` | not overridden | **LIES** (Iter never calls/overrides it; only NavFixes is 6-arg incompatible) |
| `add_obstacle`, `remove_obstacle`, `_draw_covers` | bare overrides | not overridden | **LIES** |

Because Iter's wrappers are installed after LIES', a LIES bare override can never
clobber an Iter wrapper - that is the opposite of the NavFixes case (priority 0,
loads last, replaces `_sort_nav_segs_after_pos` outright and breaks LIES'
7-arg caller; `compatibility.md`, section 2.1). Iter is the safe order; NavFixes is not.

Iter's cover filter also confirms the index assumption: it reads `cover[3]` as
the tracker and `cover[1]` as the position
(`mods/Iter/lua/navigationmanager.lua:113-116`), i.e. 248.2 `COVER_TRACKER` /
`COVER_POSITION` - the same layout LIES writes.

## Summary

| Function | Vanilla delta 246.1 -> 248.2 | LIES gap | Verdict | Risk | Testable |
| --- | --- | --- | --- | --- | --- |
| `register_cover_units` | drop dead `_rooms` local; covers pushed unconditionally (was debug-only); `mvec3_copy` alias; `get_script_data(nav_tracker, true)` | one token: `get_script_data(nav_tracker)` at `:551` lacks the create flag (248.2:849) | **merge: 1 token** | low - legacy cover-unit branch only (`get_cover_data()` nil); `location_script_data` may be nil -> Lua error at `:553` | yes (body-slice assertion) |
| `_execute_coarce_search` | `while true`+`i==500` -> `for i = 1,500`; hoist `t`, `all_nav_segments`, `to_search`; `door.x` instead of `type()==number` | keeps 246.1 loop; **missing nav-link `delay_time()` gate** (present in 246.1@a3180fc:1829 and 248.2:1257); 4-tuple path vs 2-tuple (deliberate, AI-06); `[4]` never set | **merge: delay gate** | medium - nav-link userdata call (`delay_time`) in the path-expansion hot loop; no trackers/cover structs; engine pointer class unchanged (LIES already calls `is_obstructed`/`check_access` on the same object). Dead when Iter `nav_search` is on | yes |
| `_sort_nav_segs_after_pos` | 6-arg signature kept; `all_doors`/`all_rooms` removed -> Vector3 doors; `check_segment` closure; single `t`; one-term weight | 7-arg LIES variant with two-term weight + `nav_link` (deliberate); **missing `delay_time()` gate** (246.1@a3180fc:1952, 248.2:1368); dead links skipped instead of `debug_pause` (deliberate) | **merge: delay gate** (same commit as above) | medium - same userdata class; no trackers; `found_segs` contract unchanged. Dead too while Iter's search owns the only call site | yes |
| `remove_obstacle` | nil guard + destroy-listener removal + index-based `temp_array` + unconditional `remove_obstacle(obstacle_obj)` | all three already-merged pieces present; missing only `remove_obstacle(obstacle_obj)` (248.2:2030); LIES *adds* id removal for dead units (248.2 leaks there) | **keep LIES** (optional parity line) | low - `_obstacles` bookkeeping is complete (`:1581-1587`), `on_simulation_ended` sweeps ids (248.2:1722-1752) | yes (weak) |
| `_draw_covers` | index aliases, `mvec3_set/add` into `temp_vec*`, `tracker:m_position`, `mrot_set_look_at`; pure restyle + alloc reduction | 246.1-shape body **plus** obstructed/disabled colour branch; LIES' call site is commented out (`:1250`) | **keep LIES** | none - debug-only, never called in-game | n/a |
| `add_obstacle` | nil guard; destroy listener; `id` in table; duplicate debug guard removed | none - both pieces present (`:1543-1557`, `:1583-1587`); LIES keeps the removed duplicate guard (safer) | **already merged** | none | yes |
| `set_nav_segment_state` | `tostring(id)` threaded through all lookups/engine calls | none - all eight constructs present (`:1737-1801`); only cosmetic residuals | **already merged** | none | yes |

## Real gaps and implementation order

Only two constructs need work, three edits in all: a one-token **behavioural**
fix in `register_cover_units` (the create flag decides whether the script-data
extension exists - a filled table versus a nil index, not a restyle), and one
construct LIES dropped that both baselines still have, in two sibling functions.
The two delay-gate edits should ship as one commit because they share the
`TimerManager` timestamp.

1. **P1 - `register_cover_units` create flag** (`:551`): `get_script_data(nav_tracker, true)`.
   One token, no callers to update.
   *Player POV: no visible change in normal play; removes a Lua error and a
   silent loss of every cover on the rare map that ships legacy cover units
   instead of `cover_data`, i.e. AI there keeps using cover instead of standing
   in the open.*
2. **P2 - nav-link delay gate in `_sort_nav_segs_after_pos`** (`:2404`, `:2417`):
   add `local t = TimerManager:game():time()` next to `local all_segs = ...` and
   extend the third branch to `alive(door) and not door:is_obstructed() and t > door:delay_time() and door:check_access(access_pos, access_neg)`.
   *Player POV: with LIES' own search (no Iter, or Iter's nav search off), cops
   stop committing to a ladder/door nav link during the second or two it is
   still unusable, so fewer "walk to a door, stop, re-path" stalls when a door
   opens or closes mid-path.*
3. **P3 - the same gate in `_execute_coarce_search`** (`:2294-2303`, `:2322`):
   hoist `local t = TimerManager:game():time()` before the loop and extend the
   entry test to
   `t > i_door:delay_time() and i_door:check_access(...) and not i_door:is_obstructed()`.
   The delay comparison stays first for vanilla parity (both baselines lead with
   it, then `check_access`) and to avoid an engine `is_obstructed()` call per
   cooling candidate - a link that is still cooling down costs no engine call at
   all. LIES' extra `is_obstructed()` term goes last; 248.2 has no obstruction
   term in this branch. Keep LIES' loop shape and last-usable-link capture.
   *Player POV: same as P2, for the "goal segment already adjacent" fast path; no
   change while Iter's nav search is enabled (it replaces this function).*

Not scheduled: `remove_obstacle` object-parity line, any `_draw_covers` port, the
`check_segment` closure refactor, the `for i = 1, 500` restructure, and the
2-tuple path adoption (that last one would break
`coplogictravel`'s `[3]` nav-link reads - see `core-ai-gap-audit.md` AI-06).

Suggested static tests (same pattern as `dev/tools/test/aim-tracker-guard.test.mjs:34-39`,
`funcBody(text, signature)` + `assert.ok(body.includes(...))`):
one test that slices `_execute_coarce_search` and `_sort_nav_segs_after_pos` and
asserts both mention `delay_time()`, and one that slices `register_cover_units`
and asserts `get_script_data(nav_tracker, true)`. Not written in this pass - the
audit touched no test file.

## Needs a user decision

- `remove_obstacle`: add the optional `self._quad_field:remove_obstacle(obstacle_obj)`
  parity line, or leave LIES' id-only removal? Recommend **leave it** (no
  reachable failure case today) and only revisit if a mission logs
  `Found dead unit in obstacle list` with a blocker that stays visible.
- Whether to record the stale rows: `compatibility.md:264` claims LIES does not
  override `remove_obstacle` (it does, `:1642`), and `port-status.md:61-64` lists
  `_draw_covers` as an open item although it is dead code. Both are history
  files, so this report supersedes rather than rewrites them.

## Decision & artifacts

No Lua was edited, and no test was added: the audit came first because the
backlog rows were demonstrably stale - `add_obstacle` and `set_nav_segment_state`
were already applied, `remove_obstacle` was already three-quarters ported (and
in one branch better than 248.2), `_draw_covers` is dead code, and the
`_rooms`/`_room_doors` concern does not apply because LIES never referenced
them. Porting on the backlog's word would have produced at least one regression
(dropping LIES' 7-argument `_sort_nav_segs_after_pos` contract to adopt the
`check_segment` restructure) and one dead-code rewrite.

Artifacts: this report only. Verdicts it changes for the next implementer: P1/P2/P3
are the entire remaining block; everything else is closed as `already merged` or
`keep LIES`. No version bump, no `gates.ps1` run (no Lua and no test touched),
`node --test dev\tools\test\*.test.mjs` not needed.

Commands used for every claim, in order:
`git -C ... log --oneline -1`, `git show a3180fc:lib/managers/navigationmanager.lua`,
`tools\pd2fn.ps1 -From 246.1 -To 248.2 -Path lib/managers/navigationmanager.lua -Class NavigationManager -Name <fn>`
for all seven functions, plus `Select-String` over `mods\base\base.lua`,
`mods\base\req\BLTMod.lua`, `mods\base\req\BLTModManager.lua`,
`mods\Iter\lua\navigationmanager.lua`, `mods\Iter\lua\corecode.lua`.

# Nav-B feasibility — runtime cover generation on nav v6 (248.2)

Read-only design task. No runtime Lua was modified for this report.

- Mod: `lua/managers/navigationmanager.lua` (LIES, worktree `LIES-port-248`)
- Game clone: `game-data/Payday-2-LuaJIT-Complete`
- Target: `e3a8b616` (248.2) — `lib/managers/navigationmanager.lua`,
  `lib/managers/navfieldbuilder.lua`
- Baseline: `a3180fc` (246.1)
- Related verified facts: `docs/reference/game-changes-247-248.md` §2 (nav v5→v6)

**Player impact (one line):** Nav-B only shows up as *more cops taking cover in
more places*. Nothing else in the game consumes generated covers (see §4.9), so
a bad generation run can be turned off with `lua_cover 1` and costs nothing but
a few log lines.

---

## 1. Old v5 algorithm, step by step

Two independent paths in `NavigationManager:register_cover_units` (mod
`lua/managers/navigationmanager.lua:414`). Path A is registration, Path B is
generation.

### 1.1 Path A — world-definition registration (kept, must stay)

`mod navigationmanager.lua:427-512`

1. `covers = {}`; `cover_data = managers.worlddefinition:get_cover_data()`.
2. If `cover_data` exists (`{positions[], rotations[]}` or `{{pos, yaw},...}`):
   - local `_register_cover(pos, fwd)` (`:428`):
     - `tracker = _quad_field:create_nav_tracker(pos, true)`; bail on `lost()`;
     - resolve the segment `self._nav_segments[tracker:nav_segment()]`, bail if
       missing/no `pos`;
     - `navseg_tracker = create_nav_tracker(room_nav_seg.pos, true)` — a
       tracker on the *segment* used only to fetch that segment's script data;
     - `fwd = generate_cover_fwd(nav_tracker)`; bail if falsy;
     - bail unless `check_cover_close_to_wall(field_pos)`;
     - `location_script_data = _quad_field:get_script_data(navseg_tracker, true)`;
     - append `cover = {field_position, fwd, tracker}` to
       `location_script_data.covers` **and** to `covers`;
     - destroy only `navseg_tracker` (the cover keeps its own tracker).
   - Iterate `cover_data.rotations`/`positions`, `mrotation.y()` for `fwd`.
3. Else (no world cover data): iterate cover-slot units, build
   `{field_position, unit fwd, tracker, true}`, insert into `covers` + script
   data, `_safe_remove_unit(unit)`.
4. `self._covers = covers` (`:609`), log once (`:611`), `_change_funcs()`
   (`:621`), schedule `_do_nav_fixes` +2 s (`:624`).

Live effect of the added `fwd`/wall validation: `covers=58` on Jewelry Store
(`dev/reports/smoke-3-log-scan.md:36`).

### 1.2 Path B — runtime generation (currently `if false and ...`, `:516`)

The block is LIES-authored, not vanilla: at 246.1 vanilla `register_cover_units`
has no generation and only fills `_covers` when `self._debug`
(`a3180fc:lib/managers/navigationmanager.lua`, `register_cover_units`).

Steps as written (`:517-607`):

1. Budget: `max = #covers <= 0 and 5000 or round(16 * table.size(_nav_segments))`,
   clamped 1..5000; abort if `#covers >= max`.
2. Only on `Network:is_server()`.
3. For every `key, res` in `_nav_segments` with `res.pos` and non-empty
   `res.neighbours`:
   1. `tracker = create_nav_tracker(res.pos, true)`;
      `script_data = get_script_data(tracker, true)`; ensure
      `script_data.covers`; skip the segment if it already has 16 covers.
   2. For every `_, room` in `res.rooms`:
      1. `room_pos = NavFieldBuilder._calculate_room_center(self, room)` —
         room centre from `room.borders` + `room.height`.
      2. `across_vec = room_pos + (room.borders.x_pos, room.borders.y_pos, 0)`
         — a centre→corner vector, i.e. the ray fan's *reference direction*.
      3. `try_tracker = create_nav_tracker(room_pos, true)`;
         `new_positions = find_walls_accross_tracker(try_tracker, across_vec, 360, 12)`
         — 12 rays, 360°, randomised offset; each result is
         `{trace[1], hit?}` where `trace[1]` is the nav-clamped point where the
         ray stops being walkable (i.e. “last floor tile before a wall”).
      4. For each candidate:
         - reject if within 90 units (`8100`) of any existing cover — O(n²)
           over the whole `covers` list;
         - reject unless `check_cover_close_to_wall(try_pos)` (8 rays × 100
           units, any `navigation:raycast` hit = wall nearby);
         - `zingus_tracker = create_nav_tracker(try_pos, true)`; require
           `not lost()` **and** `nav_segment() == key`; else destroy, no insert;
         - `fwd = generate_cover_fwd(zingus_tracker)`; require truthy;
         - cover = `{field_position, fwd, zingus_tracker}`;
           `insert_cover(covers, script_data, cover)` (keeps the tracker) or
           destroy the tracker if not inserted;
         - stop the room at `#covers >= max` or `#script_data.covers >= 16`.
   3. Destroy `try_tracker` and the segment tracker at the end of the segment.
4. Fall through to `self._covers = covers` (single assignment, so generation
   feeds the same list the LIES search iterates).

### 1.3 `generate_cover_fwd(tracker)` (`:230-377`)

1. `m_seg_id = tracker:nav_segment()`; `all_nav_segs[m_seg_id]` must exist.
2. `doors = find_segment_doors_with_nav_links(m_seg_id, nil, true)` — the
   `get_center` variant: averaged door centres per neighbouring segment plus
   nav-link fake doors (`center`, `end_pos`).
3. Pick the nearest door (squared distance to `field_pos` at the tracker's z);
   nav-link doors prefer `end_pos`; remember `second_best_pos`.
4. `new_fwd = normalize(best_door_pos - field_pos)`, then sweep 12 directions
   over a 108° fan (`Rotation(-54)` … `+45`, step 9°). For each direction:
   - `self:raycast{pos_from = field_pos, pos_to = field_pos + fwd*100}` must be
     **truthy = not walkable** (evidence for the truthiness in §2.3), i.e. a
     wall is within 100 units in that direction;
   - `World:raycast("ray", cover+90up, fwd_test+90up, slot_mask = AI_visibility
     + enemy_shield_check, ray_type = ai_vision, "report")` must hit — a tall
     blocker at head height;
   - `i == 6` is treated as the “perfect match” (returns immediately),
     otherwise the hit is collected with its angular offset.
5. Return the hit with the smallest `|angle * i|` (random tie-break), else
   retry the whole sweep from `second_best_pos`, else `false`.

**Facing convention (inferred, medium confidence):** the returned vector points
*at* the protecting wall (both gates require a blocker). Engine covers use the
opposite convention — `CopLogicAttack._verify_cover` requires
`dot(dir(cover→threat), cover[2]) >= 0.7`
(`lua/coplogics/coplogicattack.lua:1742-1746`) — and LIES explicitly disables
that check when `lua_cover >= 2` (`:1744`), which is consistent with LIES's own
covers using the inverted convention. Practical consumer that *does* read
`cover[2]` in LIES mode: the flank/peek offset at `coplogicattack.lua:1697-1732`
uses `cover[2]` as the polar reference and rotates ±90/180°, then clamps with
`navigation:raycast` (`trace[1]`), so an inverted vector degrades to “peek
offset clamped”, not a crash. Nav-B should reproduce the v5 convention first
(parity), and flipping it is a one-line experiment if flank/peek looks wrong in
game.

---

## 2. Exact removed dependencies and v6 replacements

| v5 dependency | State at 248.2 | v6 replacement |
| --- | --- | --- |
| `self._rooms` (manager) | never assigned; only editor/builder + two dead readers (`e3a8b616:...:691`, `:1602`) | nothing — rooms are gone. Use nav segments (`_nav_segments`) as the sampling unit. |
| `self._room_doors` (manager) | never assigned at runtime | `_nav_segments[id].neighbours[other_id]` = **door positions / nav-link units** (see §2.2) |
| `res.rooms` on a segment | absent; segments carry `vis_groups` only | per-segment sampling: `random_position_in_nav_segment(id)`, doorway seeds from `neighbours`, radial scan from `seg.pos` |
| `NavFieldBuilder._calculate_room_center` | **exists** (`navfieldbuilder.lua:3275`) but builder data is editor-only: `set_load_data` populates `self._builder` only under `Application:editor()` (`e3a8b616:...:208-213`), builder is `_VERSION = 5`, `_rooms` empty at runtime | not usable; drop. (Also note the dead code passes the *manager* as `self`, which is wrong for a builder method.) |
| `find_segment_doors_with_nav_links(id, nil, true)` | reads `self._room_doors` → would error / return nothing | mod's already-ported `find_segment_doors(id, approve, center_only)` (`mod :43-110`) returns `{center=...}` / `{center, end_pos}` for nav links — drop-in for the `get_center` use |
| `room.borders` fan reference (`across_vec`) | no room borders | `seg.pos` (or a random direction) as the fan reference; `find_walls_accross_tracker` itself is unchanged and still shipped (`e3a8b616:...:1145`) |
| door centres via door indices into `_room_doors` | indexes replaced by explicit positions | `neighbours[other_id]` *is* the list of door positions; average them (`center_only` path in the ported `find_segment_doors`) |
| `NavFieldBuilder._get_room_height_at_pos` for z | still exposed on the manager (`init` `:91`), but needs room height data | tracker `field_position()` already returns nav-field z; no height maths needed |

### 2.1 What a nav segment actually has at 248.2

`_load_nav_data` (`:306-324`) creates, keyed by `tostring(nav_seg.id)`:

```
{ id = <number>, unique_id = "<string>", pos = <Vector3|nil>,
  neighbours = {}, location_id = <id>, vis_groups = <list> }
```

`_resolve_segment_neighbours` (`:326-351`) then fills, via
`_quad_field:nav_segment_neighbours(Idstring(unique_id))`:

```
segment.neighbours[other_id_string] = { <Vector3 door pos> | <Unit nav-link>, ... }
```

Later mutations add `disabled`, `blocked_group` (`set_nav_segment_state`), and
`disabled_neighbours` (`clbk_navfield`, `:2062`). There is **no** room, border,
height, door index, door centre, or cover list on a segment.

`tracker:nav_segment()` returns the same **string** key: vanilla indexes
`_nav_segments[c_data.tracker:nav_segment()]` directly
(`groupaistatebase.lua:4120-4134`) and passes a tracker-derived id into
`find_segment_doors` (`coplogicattack.lua:1544`, which does
`self._nav_segments[from_seg_id]`). Treat segment ids as strings; never compare
against raw numeric ids.

Live evidence for door encoding (Jewelry Store, `dev/reports/smoke-3-log-scan.md:36`):
`segments=40 missing_neighbours=0 doors(vector=0 numeric=0 links=555) covers=58`
— on that map neighbour entries are nav-link **units**, not Vector3 doors. The
door source must handle both (`door.x` for Vector3, `alive(door)` + `script_data().element`
for nav links), which the ported `find_segment_doors` already does.

### 2.2 `_quad_field` surface at 248.2 (`World:quad_field()`, `init` `:103`)

Complete list used by the Lua layer: `setup`, `load_nav_data`, `clear_all`,
`create_nav_tracker`, `destroy_nav_tracker`, `get_script_data`,
`nav_segment_neighbours`, `find_nav_segment`, `find_cover`, `find_cover_in_cone`,
`random_position_in_nav_segment`, `is_nav_segment_enabled`,
`is_nav_segment_blocked`, `set_nav_segment_enabled`, `is_position_unreserved`,
`add/remove/move` position reservations, `add/remove_obstacle`, `add/remove_nav_link`,
`set_nav_link_filter`, `set_nav_segment_blocked_filter`, `test_walkability`,
`detailed_search`, `abort_detailed_search`, `set_draw_state`,
`check_access_bitmask`, access-filter converters.

There is **no** `add_cover`-style entry: Lua-registered covers are invisible to
the engine's `find_cover`/`find_cover_in_cone`. Generation therefore only pays
off through LIES's own Lua search (`lua_cover >= 2`). Worth restating because it
sets the entire value proposition: Nav-B is a *LIES-search* feature, not a
vanilla-AI improvement.

`NavigationManager:raycast(params)` = `_quad_field:test_walkability(params)`
(`:1380-1384`). Runtime contract, from live call sites:

- `tracker_from` **or** `pos_from`; `pos_to` required; optional `allow_entry`.
- `trace = true` → the engine replaces `params.trace` with a table;
  `params.trace[1]` = the nav-clamped reachable point (coplogicattack:391-393
  uses it as a retreat position), `params.trace[2]` = collision side
  (copactionhurt:1397).
- Return is truthy when the straight line is **not** walkable
  (`civilianlogicflee.lua:760`, `civilianlogictravel.lua:147`,
  `copmovement.lua:1784` all use `if not navigation:raycast(...)` = “clear”).

---

## 3. Proposed v6 generation algorithm

Constraints honoured: vanilla registration untouched (Path A stays as is; the
generation call is additive), no rooms/`_room_doors`/`_calculate_room_center`,
`_quad_field` sampling preferred over Lua ray loops.

### 3.1 Shape

```
register_cover_units()                     -- unchanged vanilla + Path A
  ...
  self._covers = covers
  self:_schedule_LIES_cover_generation()    -- NEW: delayed, sliced, server-only

_schedule_LIES_cover_generation()
  if not (Network:is_server() and LIES.settings.lua_cover >= 2) then return
  managers.enemy:add_delayed_clbk("LIES_cover_gen", <slice fn>, now + 1.0)
  (or a chain of clbks / a token polled from NavigationManager:update)
```

Why delayed and sliced: Path A already runs twice per level (`on_game_started`
`:1617`, `on_simulation_started` `:1623-1627`), synchronously inside level load.
The v5 block added up to 5000 covers × (24 nav rays + 24 visibility rays + 8
wall rays + 1 tracker) in one Lua call — a watchdog risk, not just a hitch.

### 3.2 Pseudocode

```
-- one-time per generation pass
GEN = {
  token        = <monotonic id>,      -- abort stale passes
  total_limit  = clamp(round(16 * table.size(_nav_segments)), 1, 2048), -- see §4.10
  per_seg_limit= 16,
  dedupe_grid  = {},                  -- floor(x/90),floor(y/90) -> {covers}
  door_cache   = {},                  -- seg_id -> {Vector3} (built lazily, once)
  seg_queue    = sorted list of segment keys with pos and next(neighbours)
}

step_slice(token, budget_candidates):
  if token ~= GEN.token or not self:is_data_ready() then return end
  while budget_candidates > 0 and GEN.seg_queue is not empty:
      seg_id = pop(GEN.seg_queue)
      seg    = _nav_segments[seg_id]
      if not seg or not seg.pos then continue end

      seg_tracker = _quad_field:create_nav_tracker(seg.pos, true)
      if seg_tracker:lost() then destroy; continue end
      script_data = _quad_field:get_script_data(seg_tracker, true)
      script_data.covers = script_data.covers or {}
      if #script_data.covers >= per_seg_limit then destroy; continue end

      cands = {}
      -- (a) doorway seeds: cheapest, deterministic, matches v5 intent
      for door_center in self:_LIES_seg_door_centers(seg_id, GEN.door_cache):
          push(cands, jitter(door_center, 60..120, random yaw))
      -- (b) engine sampler: uniform walkable points in this segment
      for i = 1, 4 do
          p = _quad_field:random_position_in_nav_segment(seg_id)
          if p then push(cands, p) end
      -- (c) radial wall scan from the segment centre (v5 fan, v6 reference vec)
      if #cands < 6 then
          fan_ref = (cands[1] and cands[1] - seg.pos) or random_dir
          for _, hit in ipairs(self:find_walls_accross_tracker(seg_tracker, fan_ref, 360, 8) or {}) do
              if hit[1] then push(cands, hit[1]) end     -- nav-clamped floor point near a wall
          end
      end
      destroy seg_tracker

      for _, cand in ipairs(cands):
          if #self._covers >= total_limit then break end
          if #script_data.covers >= per_seg_limit then break end
          budget_candidates = budget_candidates - 1

          tracker = create_nav_tracker(cand, true)
          if tracker:lost() then destroy; continue end
          if tracker:nav_segment() ~= seg_id then destroy; continue end   -- string compare
          pos = tracker:field_position()

          if _LIES_cover_too_close(pos, 90, GEN.dedupe_grid) then destroy; continue end
          if not self:check_cover_close_to_wall(pos, 8, 100) then destroy; continue end

          fwd = self:generate_cover_fwd(tracker, GEN.door_cache[seg_id])
          if not fwd then destroy; continue end

          cover = { pos, mvec3_cpy(fwd), tracker }        -- index 4 stays nil
          self:insert_cover(self._covers, script_data, cover)
          _LIES_grid_insert(GEN.dedupe_grid, pos)
      end
  if GEN.seg_queue is empty then log funnel counters end
  else re-arm the delayed clbk for the next slice
```

### 3.3 The three sub-decisions

**Where candidates come from.** Rooms were only ever *sampling volumes* around
a segment. Their three jobs map 1:1 onto v6 primitives:

| v5 room job | v6 source |
| --- | --- |
| where to stand the ray fan | `seg.pos` (already on the nav field, already used as a tracker origin in v5) |
| fan reference direction (`across_vec` = centre→corner) | any per-segment direction: `seg.pos → first candidate`, `seg.pos → nearest door`, or a random yaw |
| guarantee coverage of the whole room | `random_position_in_nav_segment(seg_id)` × N + doorway seeds (both engine-side, no Lua tracing) |

Order matters: doorway seeds first (deterministic, one per door, covers
“cops peeking doorways”, the case `generate_cover_fwd` was written for), then
sampler, then the fan only as filler. This keeps candidate count per segment
small (≤ ~16) while the fan still guarantees “wall-adjacent” points on maps
where the sampler is sparse.

**How facing is derived.** Reuse `generate_cover_fwd` with one surgical change:
replace `find_segment_doors_with_nav_links(m_seg_id, nil, true)` with
`self:find_segment_doors(m_seg_id, nil, true)` (already ported), and accept a
pre-computed door list so the per-segment door scan is not repeated per
candidate. Everything else (12-direction 108° fan, nav-blocked + head-height
blocked, second-best fallback) stays byte-identical to v5, so the facing vector
keeps whatever convention v5 had. Optional guard for doorless segments
(`#doors == 0`, e.g. a closet): seed `new_fwd` from `candidate → seg.pos`
instead of a door — this is the only behavioural addition, and it keeps the
sweep meaningful where v5 would have swept from the segment centre anyway.

**How walls/visibility are validated.** Exactly as v5: `check_cover_close_to_wall`
(engine `test_walkability`, 8 rays × 100) for “there is a wall within arm's
reach”, and the head-height `World:raycast` inside `generate_cover_fwd` for
“the blocker is tall enough to matter”. No new Lua rayloop geometry maths.

**Duplicates.** v5's O(n²) `8100` (`90²`) scan over up to 5000 covers is 12.5 M
distance checks in the worst case. Replace with a 90-unit spatial hash:
bucket = `floor(x/90), floor(y/90)`, test the 9 neighbouring buckets. Same
threshold, same semantics, O(n) memory, ~constant per candidate. Also dedupe
within a segment's own candidate list before creating trackers (cheap, avoids
tracker churn).

**Insertion.** Only through the existing `insert_cover(covers_table,
location_script_data, cover)` (`:627`) → appends to `self._covers` **and**
`script_data.covers`. This is required, not cosmetic:
`_unregister_cover_units` (`e3a8b616:...:863-873`) walks `self._covers` and
destroys each tracker, and raises
`"[NavigationManager:_unregister_cover_units] Cover tracker is not alive!"` for
any dead one. A cover that exists only in script data is a leak; a cover in
`_covers` without a live tracker is a guaranteed error line on the next
simulation start.

---

## 4. Engine-call risk list

| # | Call / concern | Status at 248.2 | Rule for Nav-B |
| --- | --- | --- | --- |
| 4.1 | `NavFieldBuilder._calculate_room_center` | Lua function exists (`navfieldbuilder.lua:3275`) but needs `room.borders`/`room.height`; builder data only loaded in editor (`navigationmanager.lua:208-213`), `_VERSION = 5` | **Do not call.** Editor-only data path. |
| 4.2 | `self._builder._room_doors` | `{}` at runtime (filled only by builder `load`/`build`) | Do not read. |
| 4.3 | `_quad_field:create_nav_tracker(pos, allow_disabled)` | runtime-safe (vanilla `register_cover_units`, all AI code) | Always `allow_disabled = true`; always `lost()`-check; destroy every tracker you do not ship. |
| 4.4 | tracker lifetime | one tracker per registered cover; `_unregister_cover_units` destroys `self._covers` entries and errors on dead ones; `clbk_navfield("invalidated_script_data")` calls `cover[TRACKER]:move(...)` (`:2148-2160`) | Ownership rule: a tracker either (a) lives in a cover object that is in **both** lists, or (b) is destroyed in the same function. Never leave a cover in `script_data.covers` after its tracker is destroyed or after the pass is aborted. |
| 4.5 | `_quad_field:get_script_data(tracker, true)` | runtime-safe (vanilla calls it twice) | Pass `true` like vanilla; the second argument's exact meaning is engine-side and undocumented in Lua. Segment-level script data is per nav segment (where v5 checked the 16-cover cap). |
| 4.6 | `NavigationManager:raycast` → `test_walkability` | runtime-safe; truthy = blocked; `trace = true` allocates `params.trace`, `[1]` = clamped point, `[2]` = side | Do not pass `trace = false` (v5's `generate_cover_fwd` does; unverified through the engine — pass nothing instead). Reuse, do not wrap in a Lua rayloop. |
| 4.7 | `World:raycast(..., "report")` head-height check | runtime-safe (same flags as vanilla AI visibility code) | Keep the existing slot mask (`AI_visibility + enemy_shield_check`); it is already cached lazily at `:419`. |
| 4.8 | `find_walls_accross_tracker` | shipped in vanilla Lua (`:1145`) but **unused** by vanilla → its engine path is not proven by shipping code | Acceptable as a filler source; keep `nr_rays` low (8, not 12) and treat an empty return as “no candidates”, never as an error. Fallback available: radial `self:raycast{trace=true, pos_from=seg.pos, pos_to=...}` in our own loop. |
| 4.9 | `_quad_field:find_cover*` | engine search reads **engine** cover data; there is no `add_cover` in the exposed surface | Generated covers are invisible to engine search. Only `lua_cover >= 2` benefits → gate generation on that setting + `Network:is_server()` (as v5 did). |
| 4.10 | Max cover budget | v5: `16 * #_nav_segments`, clamp 1..5000, `<=16` per segment script data. Live: Jewelry Store 40 segments / 58 covers → limit 640 | Start at `min(16 * #segments, 2048)` and `16`/segment. Trackers are the scarce resource (one live tracker per cover, held for the whole mission). Do not ship 5000 before a large-map probe. |
| 4.11 | Load-time vs delayed | Path A runs inside `on_game_started` and again in `on_simulation_started` | Generate **after** registration, from a delayed clbk (pattern already used at `:624`), sliced over frames; abort on `_clear`/`_unregister_cover_units`, level change, or a stale token. Search tolerates a partial `_covers`, so partial progress is always safe. |
| 4.12 | Segment id type | `tracker:nav_segment()` == `_nav_segments` key (string; `groupaistatebase.lua:4120-4134`, `coplogicattack.lua:1544`) | Compare with `==` against the loop key only; if a future build changes the type, log it once (`!lies gen`) instead of silently generating nothing. |
| 4.13 | Door-list cost | `find_segment_doors` builds/destroys one tracker **per nav-link unit** — 555 on Jewelry Store per full-map call | Cache per segment for the whole generation pass; never call it per candidate (v5 did → ~9k tracker ops per segment in the worst case). |
| 4.14 | Script-data persistence | `location_script_data.covers` is written by vanilla and never read by game Lua; `_send_nav_field_to_engine`/`load_nav_data` recreate the field on level load but not on simulation restart | Expect (and tolerate) duplicate entries in script data across sim restarts, exactly as vanilla does. Never read script data back as the source of truth — `self._covers` is. `_LIES_register_cover` (`:1189`, currently uncalled) does exactly that and would double-count; leave it unused. |
| 4.15 | Cover record shape | index 1 pos, 2 fwd, 3 tracker, 4 reserved-counter/flag, 5 reservation, engine covers also carry 6/7 fields (`coplogicattack.lua:2899-2907` guards on `in_cover[6]`) | Generated covers: `{pos, fwd, tracker}` only (v5 parity); indices 4/5 get written by `reserve_cover`, index 6 absence is already guarded in coplogicattack. |

---

## 5. Go / no-go

**Recommendation: GO, staged behind a dev-only probe.** Confidence **~75%**
that v6 generation reaches v5 parity in behaviour; **~90%** that it can be built
without touching anything the engine forbids — every removed dependency has a
direct, already-shipped replacement (§2), and the door source is already ported
and live-verified by Nav-A (`!lies nav`: `missing_neighbours=0`, `links=555`).

Residual risk is concentrated in three measurable unknowns, none of which need
code archaeology:

1. **fwd convention** — does an inverted vs v5 vector change cop flank/peek
   behaviour in a way players notice? (§1.3, one-line flip experiment)
2. **tracker budget / generation cost** on a big map at 16 covers/segment.
3. **`find_walls_accross_tracker` at runtime** — shipped but never exercised by
   vanilla; may simply return `{}` at runtime (acceptable, filler only).

**No-go trigger:** if on `branchbank`-class maps a 2048-cover budget produces
frame hitches above ~250 ms per 10 segments, or an engine tracker cap surfaces
(log `Application:error` around tracker creation), then ship Nav-A only
(custom search over vanilla covers — already verified working at `lua_cover=2`)
and keep generation behind a default-off setting.

### 5.1 Cheapest in-game probe (dev harness, not shipped)

Add one dev-only command to `dev/test-harness/lua/chatmanager.lua` (harness is
outside the mod's runtime Lua): `!lies gen [probe|run] [nsegs] [ncands]`.

Probe order — one Jewelry Store Normal session, ~3 minutes:

1. `!lies nav` → baseline: `segments=40 … covers=58 bad_covers=0`.
2. `!lies gen probe 1 8` → dry run on **one** segment, log a funnel + types:
   `seg=<id> type(tracker:nav_segment())=<type> neighbors=<n> door_centers=<n>
   samples=<n> fan_hits=<n> tracker_ok=<n> seg_match=<n> wall_ok=<n>
   fwd_ok=<n> inserted=<n>`
   plus `#script_data.covers_before/after` and elapsed ms
   (`TimerManager:game():time()` deltas).
3. `!lies gen run 40 8` → same for the whole map, sliced (8 segments per
   slice), log total ms and `#_covers` delta.
4. `!lies nav` → expect `covers ≈ 58 + inserted`, `bad_covers=0`,
   `missing_neighbours` unchanged.
5. `!lies cover` → must return a cover; log whether `cover[3]:nav_segment()`
   is a *generated* segment and the distance to the nearest wall
   (`check_cover_close_to_wall` re-check, 8×100).
6. Quit and scan logs.

Log/file checks (PowerShell, from `v2\`):

```
Select-String -Path "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\*.txt" `
  -Pattern "LIES-TEST","Lua: Error","attempt to (index|compare|call)","stack overflow",
           "Cover tracker is not alive","clbk_navfield","invalidated_script_data",
           "Check_termination","Setting up mod 'LIES'"
```

`Setting up mod 'LIES'` must be present (mod actually loaded); any
`attempt to index/compare/call` line that mentions `navigationmanager.lua` is a
hard stop for that build.

Static gates before the run (unchanged workflow):

```
tools\luajit\luajit.exe -bl lua\managers\navigationmanager.lua
node tools\lua-freevars.mjs lua/managers/navigationmanager.lua --game game-data\Payday-2-LuaJIT-Complete\lib\managers\navigationmanager.lua
tools\luajit\luajit.exe dev/test-harness/test/test_commands.lua
```

---

## 6. Test plan

### 6.1 Maps

| Map | Why | Pass criteria |
| --- | --- | --- |
| `jewelrystore` (Normal) | small, fast; 40 segments / 58 covers / 555 nav-link doors; exercises the **nav-link-only** door path | generation adds covers in ≥ 60% of segments, `bad_covers=0`, `!lies cover` finds a cover after generation, 0 error lines |
| `branchbank` (Normal) | large, dense rooms, high cover count; exercises budget, dedupe grid, and slicing | total covers ≤ 2048, ≤ 16 per segment, ≤ 250 ms per 10 segments, no watchdog line |
| `dinner` or `four_stores` | mid-size; chance to hit maps where neighbour entries are Vector3 doors (check `doors(vector=…)` in `!lies nav`) | both door encodings handled: `fwd_ok > 0` from the Vector3 branch as well as the nav-link branch |

### 6.2 Counts to assert

- `segments`, `missing_neighbours` **unchanged** vs baseline (`!lies nav` before/after).
- `covers_after - covers_before` between `1.5 ×` and `16 ×` segments; e.g.
  Jewelry Store: 58 → 150–640, hard ceiling `min(16×40, 2048) = 640`.
- Per-segment script-data covers ≤ 16 (`!lies gen` logs the max).
- `bad_covers == 0` (harness already checks `cover[1]`/`cover[2]` presence).
- Dedupe: after generation, minimum pairwise distance between generated covers
  ≥ 90 units (log min distance in the probe).
- Wall proximity: every generated cover passes `check_cover_close_to_wall(pos)`
  on a fresh re-check (log the failure count — must be 0).
- Search health after generation: `!lies cover` 5× at different player spots →
  5 covers found, all with `nav_segment()` enabled, none `lost`/`obstructed`.
- 60 s of `!lies alarm` → cop count stable, no error lines, cops visibly using
  new cover spots (player POV check).

### 6.3 Crash / error signatures

| Signature in `mods\logs\*.txt` | Meaning |
| --- | --- |
| `attempt to index a nil value (field '_room_doors')` / `'_rooms'` | old v5 dependency still reachable — generation or `find_segment_doors_with_nav_links` not fully replaced |
| `attempt to compare nil with number` at `navigationmanager.lua` | candidate/tracker value assumed non-nil (usually `trace[1]` when `test_walkability` returned falsy) |
| `attempt to call method 'destroy_nav_tracker' (a nil value)` | tracker destroyed twice / manager cleared mid-pass |
| `[NavigationManager:_unregister_cover_units] Cover tracker is not alive!` | a cover was inserted without a live tracker, or a tracker was destroyed while still in `_covers` (abort path bug) |
| `[NavigationManager:clbk_navfield] … invalidated_script_data` + crash | stale cover/tracker left in `location_script_data.covers` after a sim restart |
| `Application:check_termination` / `Check_termination` | generation too heavy in one frame → slicing/budget broken |
| `stack overflow` | recursion (unlikely) or `World:raycast` inside a nav callback loop |
| Lua `Error` with `LIES-TEST` absent before it | generation ran before harness hooks — check load order |
| engine assert on nav field / tracker pool | tracker budget exceeded (lower `total_limit`, then re-test) |

### 6.4 Regression gates (must not change)

- `lua_cover = 1` (engine search + engine covers): cover count identical to
  vanilla registration (`58` on Jewelry Store), generation not scheduled at all.
- `lua_cover = 2`: Nav-A search results identical before/after generation is
  enabled (same covers found when generation inserts nothing, e.g. probe with
  `LIES.settings.nav_b_gen = 0`).
- `lua_cover = 0`: unchanged.
- Non-host client: no generation, no trackers created (`Network:is_server()`).

---

## Decision & artifacts

- **Decision:** GO for an implementation pass, staged: (1) port `generate_cover_fwd`
  to the already-ported `find_segment_doors` + door cache, (2) v6 candidate
  sampler + dedupe grid + budget + sliced delayed generation, (3) probe on
  Jewelry Store, then branchbank, then decide on the fwd-convention flip.
  No-go fallback is Nav-A only, which is already shippable.
- **Not to be ported:** rooms, `_room_doors`, `NavFieldBuilder._calculate_room_center`
  at runtime — all confirmed gone/editor-only in §2.
- **Artifacts:** this report (`dev/reports/nav-b-feasibility.md`); evidence
  files cited above (`dev/reports/smoke-3-log-scan.md`,
  `dev/reports/baseline-crash.md`, `dev/test-harness/README.md`); game evidence
  from `e3a8b616:lib/managers/navigationmanager.lua` and
  `e3a8b616:lib/managers/navfieldbuilder.lua`.
- **UNVERIFIED (needs the §5.1 probe):** fwd convention consumption in-game;
  runtime behaviour of `find_walls_accross_tracker`; tracker-pool ceiling; the
  real generation cost per 10 segments on a large map.

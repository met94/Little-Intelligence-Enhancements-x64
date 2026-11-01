-- Contract test for NavigationManager:find_segment_doors.
-- Loads the real hook file with stubbed engine globals and pins both public
-- shapes: raw Vector3 positions for 2-arg callers (vanilla phalanx/travel,
-- LIES._get_expected_pos) and { center, end_pos } tables for center_only.
-- Also pins the door guards and the tracker create/destroy balance.
-- Run from the worktree root:
--   tools\luajit\luajit.exe dev/test-harness/test/find_segment_doors.lua

local function vec3(x, y, z)
  return { x = x, y = y, z = z }
end

local function is_vec3(value)
  return type(value) == 'table' and type(value.x) == 'number' and type(value.y) == 'number' and type(value.z) == 'number'
end

-- Engine stubs. navigationmanager.lua reads every mvector3 field at load time.
mvector3 = {
  not_equal = function(a, b) return a.x ~= b.x or a.y ~= b.y or a.z ~= b.z end,
  set = function(dst, src) dst.x, dst.y, dst.z = src.x, src.y, src.z end,
  set_static = function(dst, src) return mvector3.set(dst, src) end,
  set_z = function(dst, z) dst.z = z end,
  step = function(dst, src, step) return mvector3.set(dst, src) end,
  subtract = function(dst, a, b) dst.x, dst.y, dst.z = a.x - b.x, a.y - b.y, a.z - b.z end,
  normalize = function(dst) return dst end,
  direction = function(dst, from, to) dst.x, dst.y, dst.z = to.x - from.x, to.y - from.y, to.z - from.z end,
  add = function(dst, src) dst.x, dst.y, dst.z = dst.x + src.x, dst.y + src.y, dst.z + src.z end,
  multiply = function(dst, scale) dst.x, dst.y, dst.z = dst.x * scale, dst.y * scale, dst.z * scale end,
  divide = function(dst, scale) dst.x, dst.y, dst.z = dst.x / scale, dst.y / scale, dst.z / scale end,
  lerp = function(dst, a, b, t) return mvector3.set(dst, a) end,
  copy = function(src) return vec3(src.x, src.y, src.z) end,
  set_length = function(dst, len) return dst end,
  dot = function(a, b) return a.x * b.x + a.y * b.y + a.z * b.z end,
  cross = function(dst, a, b) return dst end,
  distance = function(a, b) return math.sqrt((a.x - b.x) ^ 2 + (a.y - b.y) ^ 2 + (a.z - b.z) ^ 2) end,
  distance_sq = function(a, b) return (a.x - b.x) ^ 2 + (a.y - b.y) ^ 2 + (a.z - b.z) ^ 2 end,
  rotate_with = function(dst, rot) return dst end,
  length = function(v) return math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) end
}

Vector3 = function(x, y, z)
  return vec3(x or 0, y or 0, z or 0)
end

NavigationManager = {}

-- Fake doors are plain tables: alive() is true unless the door is marked dead,
-- which pins the dead-door guard without an engine.
function alive(unit)
  return unit ~= nil and not unit._dead
end

Hooks = {
  PostHook = function() end,
  PreHook = function() end
}

LIES = {
  _counts = {},
  Count = function(self, kind)
    self._counts[kind] = (self._counts[kind] or 0) + 1
  end
}

dofile('lua/managers/navigationmanager.lua')

local function count(kind)
  return LIES._counts[kind] or 0
end

local function count_since(before, kind)
  return count(kind) - before
end

-- Every tracker handed out by the fake nav field is counted here; scenario 11
-- requires the two totals to match after every scenario.
local trackers_created = 0
local trackers_destroyed = 0

-- The real destroy method is vanilla, not in the hook file; record and count.
function NavigationManager:destroy_nav_tracker(tracker)
  assert(tracker, 'destroy_nav_tracker called with a nil tracker')
  trackers_destroyed = trackers_destroyed + 1
end

local function make_element(pos, end_pos)
  return {
    value = function(self, key)
      if key == 'position' then
        return pos
      end

      return nil
    end,
    nav_link_end_pos = function(self)
      return end_pos
    end
  }
end

local function make_door(opts)
  opts = opts or {}

  return {
    _dead = opts.dead,
    is_obstructed = function(self)
      return opts.obstructed or false
    end,
    script_data = function(self)
      if opts.script_data_nil then
        return nil
      end

      if opts.script_data_without_element then
        return {}
      end

      return { element = opts.element }
    end
  }
end

-- plan is keyed by the position table of a door element; a missing entry means
-- create_nav_tracker returns nil (off the nav mesh).
local function make_quad_field(plan)
  return {
    create_nav_tracker = function(self, pos, on_nav_mesh)
      local spec = plan and plan[pos]

      if not spec then
        return nil
      end

      trackers_created = trackers_created + 1

      return {
        nav_segment = function()
          return spec.segment
        end,
        field_position = function()
          return pos
        end
      }
    end
  }
end

local function make_nav(segments, plan)
  return setmetatable({
    _nav_segments = segments,
    _quad_field = make_quad_field(plan)
  }, { __index = NavigationManager })
end

local function check_trackers(label)
  assert(trackers_created == trackers_destroyed,
    ('tracker leak after %s: created=%d destroyed=%d'):format(label, trackers_created, trackers_destroyed))
end

local FROM = 'seg_from'
local TO = 'seg_to'
local OTHER = 'seg_other'

-- 1. 2-arg call with a raw Vector3 door returns exactly that position, and no
--    tracker is allocated for it.
do
  local raw = vec3(100, 200, 300)
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { raw } } },
    [TO] = {}
  })

  local before_2arg = count('fsd_call_2arg')
  local before_raw = count('fsd_raw')
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 1, 'raw door not collected in the 2-arg branch')
  assert(result[1] == raw, '2-arg branch must return the raw Vector3, not a copy or a table')
  assert(count_since(before_2arg, 'fsd_call_2arg') == 1, 'fsd_call_2arg not counted')
  assert(count_since(before_raw, 'fsd_raw') == 1, 'fsd_raw not counted')
  assert(trackers_created == 0, 'raw doors must not allocate a nav tracker')
  check_trackers('raw door')
end

-- 2. Missing from_seg_id returns an empty table and is counted.
do
  local nav = make_nav({}, nil)
  local before = count('fsd_no_from_seg')
  local result = nav:find_segment_doors('nope', nil)

  assert(type(result) == 'table' and #result == 0, 'unknown segment must return an empty table')
  assert(count_since(before, 'fsd_no_from_seg') == 1, 'fsd_no_from_seg not counted')
  check_trackers('missing from_seg')
end

-- 3./4. Disabled neighbour is skipped; a rejecting approve_clbk is skipped and
--       receives the neighbour segment id.
do
  local raw = vec3(1, 0, 0)
  local nav_disabled = make_nav({
    [FROM] = { neighbours = { [TO] = { raw } } },
    [TO] = { disabled = true }
  })
  local before_disabled = count('fsd_disabled')
  local result = nav_disabled:find_segment_doors(FROM, nil)

  assert(#result == 0, 'disabled neighbour must not contribute doors')
  assert(count_since(before_disabled, 'fsd_disabled') == 1, 'fsd_disabled not counted')

  local nav_ok = make_nav({
    [FROM] = { neighbours = { [TO] = { raw } } },
    [TO] = {}
  })
  local seen = {}
  local rejected = nav_ok:find_segment_doors(FROM, function(neighbour_seg_id)
    seen[#seen + 1] = neighbour_seg_id
    return false
  end)

  assert(#rejected == 0, 'rejected neighbour must not contribute doors')
  assert(#seen == 1 and seen[1] == TO, 'approve_clbk must receive the neighbour segment id')
  check_trackers('disabled / rejected neighbour')
end

-- 5. script_data() nil, and script_data().element nil, are skipped and counted.
do
  local door_nil_sd = make_door({ script_data_nil = true })
  local door_no_element = make_door({ script_data_without_element = true })
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { door_nil_sd, door_no_element } } },
    [TO] = {}
  })
  local before = count('fsd_nil_element')
  local created_before = trackers_created
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 0, 'doors without script_data/element must be skipped')
  assert(count_since(before, 'fsd_nil_element') == 2, 'fsd_nil_element not counted for both shapes')
  assert(trackers_created == created_before, 'a door without element must not create a tracker')
  check_trackers('nil element')
end

-- 6. element:value("position") nil is skipped and counted.
do
  local door = make_door({ element = make_element(nil, vec3(0, 0, 0)) })
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { door } } },
    [TO] = {}
  }, nil)
  local before = count('fsd_nil_position')
  local created_before = trackers_created
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 0, 'a door without a position must be skipped')
  assert(count_since(before, 'fsd_nil_position') == 1, 'fsd_nil_position not counted')
  assert(trackers_created == created_before, 'a door without a position must not create a tracker')
  check_trackers('nil position')
end

-- 7. create_nav_tracker returning nil is skipped and counted.
do
  local pos = vec3(6, 6, 6)
  local door = make_door({ element = make_element(pos, vec3(7, 7, 7)) })
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { door } } },
    [TO] = {}
  }, nil)
  local before = count('fsd_nil_tracker')
  local created_before = trackers_created
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 0, 'a nil nav tracker must skip the door')
  assert(count_since(before, 'fsd_nil_tracker') == 1, 'fsd_nil_tracker not counted')
  assert(trackers_created == created_before, 'no tracker was created, so none may be counted')
  check_trackers('nil tracker')
end

-- 8. A door belonging to another segment is not collected, but its tracker is
--    still destroyed (the leak this guard exists for).
do
  local pos = vec3(10, 10, 10)
  local door = make_door({ element = make_element(pos, vec3(11, 11, 11)) })
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { door } } },
    [TO] = {}
  }, { [pos] = { segment = OTHER } })
  local created_before = trackers_created
  local destroyed_before = trackers_destroyed
  local before_mismatch = count('fsd_navlink_seg_mismatch')
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 0, 'a door on another segment must not be collected')
  assert(count_since(before_mismatch, 'fsd_navlink_seg_mismatch') == 1, 'fsd_navlink_seg_mismatch not counted')
  assert(trackers_created - created_before == 1, 'mismatch path must create exactly one tracker')
  assert(trackers_destroyed - destroyed_before == 1, 'mismatch path must still destroy its tracker')
  check_trackers('segment mismatch')
end

-- 9. A door on from_seg_id is collected in both shapes.
do
  local pos = vec3(20, 20, 20)
  local end_pos = vec3(30, 30, 30)
  local plan = { [pos] = { segment = FROM } }

  local nav_raw = make_nav({
    [FROM] = { neighbours = { [TO] = { make_door({ element = make_element(pos, end_pos) }) } } },
    [TO] = {}
  }, plan)
  local before_ok = count('fsd_navlink_seg_ok')
  local raw_result = nav_raw:find_segment_doors(FROM, nil)

  assert(#raw_result == 1, 'matching nav-link door not collected in the 2-arg branch')
  assert(is_vec3(raw_result[1]), '2-arg branch must collect a Vector3')
  assert(raw_result[1] == end_pos, '2-arg branch must collect nav_link_end_pos()')
  assert(count_since(before_ok, 'fsd_navlink_seg_ok') == 1, 'fsd_navlink_seg_ok not counted')
  check_trackers('matching door, 2-arg')

  local nav_center = make_nav({
    [FROM] = { neighbours = { [TO] = { make_door({ element = make_element(pos, end_pos) }) } } },
    [TO] = {}
  }, plan)
  local before_center = count('fsd_call_center')
  local center_result = nav_center:find_segment_doors(FROM, nil, true)

  assert(#center_result == 1, 'matching nav-link door not collected in the center_only branch')
  assert(type(center_result[1]) == 'table', 'center_only must collect tables')
  assert(center_result[1].center ~= nil, 'center_only entry must carry a centre')
  assert(center_result[1].center == pos, 'center_only centre must be the element position')
  assert(center_result[1].end_pos == end_pos, 'center_only entry must carry the nav-link end position')
  assert(count_since(before_center, 'fsd_call_center') == 1, 'fsd_call_center not counted')
  check_trackers('matching door, center_only')
end

-- 10. center_only still averages raw Vector3 doors into one { center } entry
--     (existing behaviour, pinned here).
do
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { vec3(10, 0, 0), vec3(0, 10, 0) } } },
    [TO] = {}
  })

  local result = nav:find_segment_doors(FROM, nil, true)

  assert(#result == 1, 'center_only must emit exactly one averaged centre for raw doors')
  assert(result[1].center.x == 5 and result[1].center.y == 5 and result[1].center.z == 0,
    'averaged centre is wrong: ' .. tostring(result[1].center.x) .. ',' .. tostring(result[1].center.y))
  assert(result[1].end_pos == nil, 'a raw-door average has no end_pos')
  check_trackers('averaged centre')
end

-- 11. Dead and obstructed doors are skipped and counted.
do
  local nav = make_nav({
    [FROM] = {
      neighbours = {
        [TO] = {
          make_door({ dead = true, element = make_element(vec3(1, 1, 1), vec3(2, 2, 2)) }),
          make_door({ obstructed = true, element = make_element(vec3(3, 3, 3), vec3(4, 4, 4)) })
        }
      }
    },
    [TO] = {}
  })
  local before_dead = count('fsd_door_dead')
  local before_obstructed = count('fsd_door_obstructed')
  local created_before = trackers_created
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 0, 'dead/obstructed doors must not be collected')
  assert(count_since(before_dead, 'fsd_door_dead') == 1, 'fsd_door_dead not counted')
  assert(count_since(before_obstructed, 'fsd_door_obstructed') == 1, 'fsd_door_obstructed not counted')
  assert(trackers_created == created_before, 'dead/obstructed doors must not create a tracker')
  check_trackers('dead and obstructed doors')
end

-- 12. A nil nav_link_end_pos is counted; center_only still emits { center },
--     the 2-arg branch skips the door.
do
  local pos = vec3(40, 40, 40)
  local plan = { [pos] = { segment = FROM } }

  local nav_raw = make_nav({
    [FROM] = { neighbours = { [TO] = { make_door({ element = make_element(pos, nil) }) } } },
    [TO] = {}
  }, plan)
  local before_nil_end = count('fsd_nil_end_pos')
  local raw_result = nav_raw:find_segment_doors(FROM, nil)

  assert(#raw_result == 0, '2-arg branch must skip a door without an end position')
  assert(count_since(before_nil_end, 'fsd_nil_end_pos') == 1, 'fsd_nil_end_pos not counted')
  check_trackers('nil end position, 2-arg')

  local nav_center = make_nav({
    [FROM] = { neighbours = { [TO] = { make_door({ element = make_element(pos, nil) }) } } },
    [TO] = {}
  }, plan)
  local center_result = nav_center:find_segment_doors(FROM, nil, true)

  assert(#center_result == 1, 'center_only must still emit a centre without an end position')
  assert(center_result[1].center == pos, 'center_only centre must be the element position')
  assert(center_result[1].end_pos == nil, 'center_only must not emit end_pos = nil')
  check_trackers('nil end position, center_only')
end

-- 13. A collected value without .x is rejected in the 2-arg branch so a table
--     can never reach mvec3_set in a vanilla caller.
do
  local pos = vec3(50, 50, 50)
  local not_a_vector = { center = vec3(1, 1, 1) }
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { make_door({ element = make_element(pos, not_a_vector) }) } } },
    [TO] = {}
  }, { [pos] = { segment = FROM } })
  local before = count('fsd_bad_shape')
  local result = nav:find_segment_doors(FROM, nil)

  assert(#result == 0, 'a non-Vector3 value must not be collected')
  assert(count_since(before, 'fsd_bad_shape') == 1, 'fsd_bad_shape not counted')
  check_trackers('bad shape')
end

-- 14. The same shape rule applies to the center_only table: a non-Vector3
--     `end_pos` would reach `door.end_pos:with_z(...)` in `_get_expected_pos`.
do
  local pos = vec3(60, 60, 60)
  local not_a_vector = { center = vec3(2, 2, 2) }
  local nav = make_nav({
    [FROM] = { neighbours = { [TO] = { make_door({ element = make_element(pos, not_a_vector) }) } } },
    [TO] = {}
  }, { [pos] = { segment = FROM } })
  local before = count('fsd_bad_shape')
  local result = nav:find_segment_doors(FROM, nil, true)

  assert(#result == 1, 'center_only must still emit the centre')
  assert(result[1].center == pos, 'center_only centre must be the element position')
  assert(result[1].end_pos == nil, 'center_only must not carry a non-Vector3 end_pos')
  assert(count_since(before, 'fsd_bad_shape') == 1, 'center_only must count fsd_bad_shape')
  check_trackers('bad shape, center_only')
end

-- Final gate: every scenario above allocated and freed the same number.
check_trackers('all scenarios')

print('ok: NavigationManager:find_segment_doors contract')

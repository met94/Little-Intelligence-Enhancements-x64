-- Contract test for the phalanx helper signatures.
-- 249 calls the helpers with the game's order -- calc_initial_phalanx_pos(own_pos,
-- objective) and _calc_pos_on_phalanx_circle(center_pos, angle, count) -- so the
-- LIES-only `data` context must be an optional trailing argument. Loads the real
-- hook file with stubbed engine globals and pins both conventions plus the
-- reservation path (pos_rsrv_id as the fifth _get_pos_on_wall argument).
-- Run from the worktree root:
--   tools\luajit\luajit.exe dev/test-harness/test/phalanx_signatures.lua

local Vec3 = {}
Vec3.__index = Vec3

local function vec3(x, y, z)
  return setmetatable({ x = x, y = y, z = z }, Vec3)
end

local function is_vec3(value)
  return type(value) == 'table' and type(value.x) == 'number' and type(value.y) == 'number' and type(value.z) == 'number'
end

function Vec3.__add(a, b)
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z)
end

-- Rotation around Z in degrees, matching the engine's Vector3:rotate_with.
function Vec3:rotate_with(rotation)
  local radians = math.rad(rotation.angle)

  return vec3(self.x * math.cos(radians) - self.y * math.sin(radians),
    self.x * math.sin(radians) + self.y * math.cos(radians),
    self.z)
end

-- Only the direction matters here: _get_next_neighbour_angle is stubbed.
function Vec3:angle(other)
  return math.deg(math.atan2(other.y - self.y, other.x - self.x)) % 360
end

Vector3 = function(x, y, z)
  return vec3(x or 0, y or 0, z or 0)
end

Rotation = function(angle)
  return { angle = angle }
end

function alive(unit)
  return unit ~= nil
end

-- Load-time globals of the hook file.
ModPath = 'phalanx_signatures'
RequiredScript = 'lib/units/enemies/cop/logics/coplogicphalanxminion'

CopLogicPhalanxMinion = {}
CopLogicBase = {}

-- Spies: every reservation check and every wall search is recorded, so a case can
-- assert both that the reservation block ran and which filter / id it carried.
local is_pos_free_calls
local wall_calls
local is_pos_free_result

local function reset_spies()
  is_pos_free_calls = {}
  wall_calls = {}
  is_pos_free_result = true
end

CopLogicTravel = {
  _get_pos_on_wall = function(from_pos, max_dist, step_offset, is_recurse, pos_rsrv_id)
    local call = {
      from_pos = from_pos,
      max_dist = max_dist,
      step_offset = step_offset,
      is_recurse = is_recurse,
      pos_rsrv_id = pos_rsrv_id,
      arg_count = select('#', from_pos, max_dist, step_offset, is_recurse, pos_rsrv_id)
    }
    wall_calls[#wall_calls + 1] = call

    return vec3(from_pos.x + 1, from_pos.y, from_pos.z)
  end
}

local group_state = {
  _phalanx_center_pos = vec3(0, 0, 0)
}

function group_state.get_phalanx_minion_count()
  return 4
end

function group_state.phalanx_minions()
  return {}
end

-- managers.navigation is a manager instance: the hook file calls it with `:`.
managers = {
  navigation = {
    clamp_position_to_field = function(self, pos)
      return pos
    end,
    is_pos_free = function(self, reservation)
      is_pos_free_calls[#is_pos_free_calls + 1] = reservation

      return is_pos_free_result
    end
  },
  groupai = {
    state = function(self)
      return group_state
    end
  }
}

tweak_data = {
  group_ai = {
    phalanx = {
      minions = {
        amount = 8
      }
    }
  }
}

reset_spies()

dofile('lua/coplogics/coplogicphalanxminion.lua')

-- Game-owned helpers the hook file only calls.
function CopLogicPhalanxMinion._calc_phalanx_circle_radius(count)
  return 100
end

function CopLogicPhalanxMinion._get_next_neighbour_angle(neighbour_num, minion_count, fixed_angle)
  return 45
end

local function reservation_filter(call)
  return call and call.filter
end

-- 1. Game convention: three arguments, no `data`, so no reservation is checked
--    and the plain circle position comes back.
do
  reset_spies()
  local center = vec3(0, 0, 0)
  local result = CopLogicPhalanxMinion._calc_pos_on_phalanx_circle(center, 90, 8)

  assert(is_vec3(result), '3-arg _calc_pos_on_phalanx_circle must return a Vector3')
  assert(math.abs(result.x) < 1e-9 and math.abs(result.y - 100) < 1e-9,
    'expected the radius-100 point at 90 degrees, got ' .. tostring(result.x) .. ',' .. tostring(result.y))
  assert(#is_pos_free_calls == 0, '3-arg _calc_pos_on_phalanx_circle must not check a reservation')
  assert(#wall_calls == 0, '3-arg _calc_pos_on_phalanx_circle must not search for a wall')
end

-- 2. LIES convention: trailing `data` runs the reservation; an occupied position
--    falls back to _get_pos_on_wall with the id in the fifth (pos_rsrv_id) slot.
do
  reset_spies()
  local center = vec3(0, 0, 0)
  local free_result = CopLogicPhalanxMinion._calc_pos_on_phalanx_circle(center, 90, 8, { pos_rsrv_id = 7 })

  assert(#is_pos_free_calls == 1, 'trailing data must check exactly one reservation')
  assert(reservation_filter(is_pos_free_calls[1]) == 7, 'reservation filter must be data.pos_rsrv_id (7)')
  assert(#wall_calls == 0, 'a free position must not trigger a wall search')
  assert(is_vec3(free_result), 'a free position must be returned as a Vector3')

  reset_spies()
  is_pos_free_result = false
  local occupied_result = CopLogicPhalanxMinion._calc_pos_on_phalanx_circle(center, 90, 8, { pos_rsrv_id = 7 })

  assert(#wall_calls == 1, 'an occupied position must trigger exactly one wall search')
  assert(wall_calls[1].arg_count == 5, 'wall search must be called with five arguments, got ' .. tostring(wall_calls[1].arg_count))
  assert(wall_calls[1].pos_rsrv_id == 7, 'pos_rsrv_id must reach the fifth parameter, got ' .. tostring(wall_calls[1].pos_rsrv_id))
  assert(wall_calls[1].step_offset == nil and wall_calls[1].is_recurse == nil, 'step_offset/is_recurse must stay nil')
  assert(is_vec3(occupied_result), 'the wall fallback must return a Vector3')
end

-- 3. Game convention: two arguments set and return objective.pos without any
--    reservation check (the 249 call shape).
do
  reset_spies()
  local own_pos = vec3(100, 0, 0)
  local objective = {}
  local result = CopLogicPhalanxMinion.calc_initial_phalanx_pos(own_pos, objective)

  assert(result ~= nil, '2-arg calc_initial_phalanx_pos must return a position')
  assert(result == objective.pos, '2-arg calc_initial_phalanx_pos must return objective.pos')
  assert(is_vec3(objective.pos), 'objective.pos must be a Vector3')
  assert(objective.angle == 45, 'objective.angle must come from _get_next_neighbour_angle, got ' .. tostring(objective.angle))
  assert(#is_pos_free_calls == 0, '2-arg calc_initial_phalanx_pos must not check a reservation')
end

-- 4. LIES convention: trailing `data` flows through to the circle helper's
--    reservation block while keeping the game's own_pos/objective order.
do
  reset_spies()
  local own_pos = vec3(100, 0, 0)
  local objective = {}
  local result = CopLogicPhalanxMinion.calc_initial_phalanx_pos(own_pos, objective, { pos_rsrv_id = 9 })

  assert(is_vec3(result), '3-arg calc_initial_phalanx_pos must return a Vector3')
  assert(result == objective.pos, '3-arg calc_initial_phalanx_pos must return objective.pos')
  assert(#is_pos_free_calls == 1, 'trailing data must reach the reservation block')
  assert(reservation_filter(is_pos_free_calls[1]) == 9, 'reservation filter must be data.pos_rsrv_id (9)')
end

-- 5. A phalanx objective that already holds an angle is left alone: the stored
--    position is returned and the circle helper is not consulted.
do
  reset_spies()
  local stored_pos = vec3(5, 6, 7)
  local objective = { angle = 123, pos = stored_pos }
  local real_circle = CopLogicPhalanxMinion._calc_pos_on_phalanx_circle
  local circle_calls = 0

  CopLogicPhalanxMinion._calc_pos_on_phalanx_circle = function(...)
    circle_calls = circle_calls + 1

    return real_circle(...)
  end

  local result = CopLogicPhalanxMinion.calc_initial_phalanx_pos(vec3(100, 0, 0), objective, { pos_rsrv_id = 3 })
  CopLogicPhalanxMinion._calc_pos_on_phalanx_circle = real_circle

  assert(result == stored_pos, 'an objective with an angle must return its stored pos unchanged')
  assert(objective.pos == stored_pos, 'an objective with an angle must keep its stored pos')
  assert(circle_calls == 0, 'an objective with an angle must not recompute the circle position')
  assert(#is_pos_free_calls == 0, 'an objective with an angle must not check a reservation')
end

-- 6. Regression guard for the crash class this fix exists for: the old LIES order
--    (data first) left `objective` nil on a two-argument call and raised
--    "attempt to index local 'objective'". The game order must index nothing nil.
do
  reset_spies()
  local ok, err = pcall(CopLogicPhalanxMinion.calc_initial_phalanx_pos, vec3(100, 0, 0), {})

  assert(ok, 'two-argument calc_initial_phalanx_pos raised instead of returning '
    .. '(attempt to index local \'objective\' crash class): ' .. tostring(err))
end

print('ok: CopLogicPhalanxMinion phalanx helper signatures')

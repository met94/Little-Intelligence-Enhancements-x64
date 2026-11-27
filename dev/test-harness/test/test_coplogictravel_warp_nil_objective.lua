-- Contract test for the warp branch of CopLogicTravel.upd_advance.
-- Loads the real hook file with stubbed engine globals and pins three things:
--   * a nil objective with a warp still in flight exits through
--     CopLogicBase._exit instead of dereferencing objective.pos/rot
--   * a live warp objective still reaches CopLogicTravel._on_destination_reached
--   * a failed warp action request still falls through without exiting
-- Reachable only for path_style == "warp" travel; found by the 249.1 suite
-- smoke as the same crash class as the follow-unit nil guard.

local script_path = (arg and arg[0]) or 'dev/test-harness/test/test_coplogictravel_warp_nil_objective.lua'
local test_dir = script_path:match('^(.*)[/\\][^/\\]+$') or '.'

local function resolve(relative)
	local candidates = {
		relative,
		test_dir .. '/../../../' .. relative
	}

	for _, candidate in ipairs(candidates) do
		local handle = io.open(candidate, 'r')

		if handle then
			handle:close()
			return candidate
		end
	end

	error('cannot locate ' .. relative .. ' from ' .. script_path)
end

local function vector3(x, y, z)
	return {
		x = x or 0,
		y = y or 0,
		z = z or 0
	}
end

local function noop() end

ModPath = 'mods/LIES/'
RequiredScript = 'lib/units/enemies/cop/logics/coplogictravel'

Vector3 = function()
	return vector3()
end

mvector3 = {
	direction = noop,
	set_z = noop,
	dot = noop,
	distance = noop,
	distance_sq = noop,
	add = noop,
	multiply = noop,
	copy = function(v, dst)
		if dst then
			dst.x, dst.y, dst.z = v.x, v.y, v.z

			return dst
		end

		return { x = v.x, y = v.y, z = v.z }
	end
}

CopLogicTravel = {}
CopLogicBase = { _exit = noop }
LIES = { settings = {} }

TimerManager = {
	game = function()
		return {
			time = function() return 0 end
		}
	end
}

dofile(resolve('lua/coplogics/coplogictravel.lua'))

local checks = 0

local function check(condition, label)
	checks = checks + 1

	if not condition then
		error('check failed: ' .. label, 2)
	end
end

-- The warp branch is only reached when the coarse-objective check reports no
-- arrival; stub the rest of the travel loop so the branch is isolated.
CopLogicTravel._chk_coarse_objective_reached = function() return false end
CopLogicTravel._update_cover = noop

local function make_unit(action_request_result)
	return {
		movement = function()
			return {
				action_request = function() return action_request_result end
			}
		end
	}
end

local function run_warp(objective, action_request_result)
	local exits, destinations = {}, 0
	local my_data = {
		warp_pos = vector3(10, 0, 0)
	}
	local data = {
		objective = objective,
		internal_data = my_data,
		unit = make_unit(action_request_result),
		cool = true,
		logic = {
			_get_logic_state_from_reaction = function() return nil end
		}
	}

	CopLogicBase._exit = function(_, state_name)
		exits[#exits + 1] = state_name
	end
	CopLogicTravel._on_destination_reached = function()
		destinations = destinations + 1
	end

	CopLogicTravel.upd_advance(data)

	return exits, destinations
end

-- 1. Objective cleared while a warp is in flight: exit to idle, no deref.
local exits, destinations = run_warp(nil, true)

check(#exits == 1, 'a nil objective exits travel once')
check(exits[1] == 'idle', 'a nil objective exits to the reaction state or idle')
check(destinations == 0, 'a nil objective does not report a destination')

-- 2. Live warp objective: unchanged path to _on_destination_reached.
exits, destinations = run_warp({
	pos = vector3(1, 2, 3),
	rot = 90,
	type = 'act'
}, true)

check(destinations == 1, 'a live warp objective still reports the destination')
check(#exits == 0, 'a live warp objective does not exit travel')

-- 3. Action request refused with a live objective: fall through, no exit.
exits, destinations = run_warp({
	pos = vector3(1, 2, 3),
	rot = 90,
	type = 'act'
}, false)

check(destinations == 0, 'a refused warp action does not report a destination')
check(#exits == 0, 'a refused warp action does not exit travel')

io.write(string.format('ok: warp nil-objective guard (%d checks)\n', checks))

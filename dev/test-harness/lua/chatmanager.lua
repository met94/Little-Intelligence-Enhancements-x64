-- LIES 248.2 port test harness. Dev-only; not shipped.
-- Chat commands: !lies help | nav | cover | gen probe|run | assault | setting <key> <value> | dump

LIES_TestHarness = LIES_TestHarness or {}
local TH = LIES_TestHarness
local PREFIX = '[LIES-TEST] '

local function say(message)
	message = tostring(message)
	log(PREFIX .. message)

	if managers and managers.chat and ChatManager then
		pcall(function()
			managers.chat:_receive_message(ChatManager.GAME, 'LIES-TEST', message, tweak_data and tweak_data.system_chat_color)
		end)
	end
end

function TH.parse_command(message)
	if type(message) ~= 'string' then
		return nil
	end

	local body = message:match('^%s*!lies%s*(.*)$')
	if not body then
		return nil
	end

	body = body:gsub('%s+$', '')
	if body == '' then
		return { command = 'help', args = {} }
	end

	local args = {}
	for word in body:gmatch('%S+') do
		args[#args + 1] = word
	end

	local command = table.remove(args, 1)
	return { command = command, args = args }
end

function TH.nav_stats()
	local nav = managers and managers.navigation
	local segments = nav and nav._nav_segments or {}
	local stats = {
		segments = 0,
		missing_neighbours = 0,
		vector_doors = 0,
		numeric_doors = 0,
		nav_links = 0,
		covers = 0,
		bad_covers = 0
	}

	for _, segment in pairs(segments) do
		stats.segments = stats.segments + 1
		local neighbours = segment.neighbours or {}

		for neighbour_id, doors in pairs(neighbours) do
			if not segments[neighbour_id] then
				stats.missing_neighbours = stats.missing_neighbours + 1
			end

			if type(doors) == 'table' then
				for _, door in ipairs(doors) do
					if type(door) == 'number' then
						stats.numeric_doors = stats.numeric_doors + 1
					elseif type(door) == 'table' and door.x then
						stats.vector_doors = stats.vector_doors + 1
					elseif type(door) == 'userdata' then
						local ok, x = pcall(function()
							return door.x
						end)

						if ok and x then
							stats.vector_doors = stats.vector_doors + 1
						else
							stats.nav_links = stats.nav_links + 1
						end
					end
				end
			end
		end
	end

	local covers = nav and nav._covers or {}
	stats.covers = #covers

	for _, cover in ipairs(covers) do
		if type(cover) ~= 'table' or not cover[1] or not cover[2] then
			stats.bad_covers = stats.bad_covers + 1
		end
	end

	return stats
end

function TH.dump_nav()
	local stats = TH.nav_stats()
	say(string.format(
		'nav segments=%d missing_neighbours=%d doors(vector=%d numeric=%d links=%d) covers=%d bad_covers=%d',
		stats.segments,
		stats.missing_neighbours,
		stats.vector_doors,
		stats.numeric_doors,
		stats.nav_links,
		stats.covers,
		stats.bad_covers
	))
end

function TH.cover_probe()
	local nav = managers and managers.navigation
	local player = managers and managers.player and managers.player:player_unit()

	if not nav then
		say('cover probe: no navigation manager')
		return
	end

	if not player then
		say('cover probe: no player unit')
		return
	end

	local pos = player:position()
	local forward = player:rotation():y()
	local threat = pos + forward * 2000
	local mode = tonumber(LIES and LIES.settings and LIES.settings.lua_cover) or 1
	local tracker = player:movement():nav_tracker()
	local player_seg = tracker and tracker:nav_segment()
	local ok, cover

	if mode > 1 and player_seg then
		say('cover probe: custom LUA search mode=' .. tostring(mode) .. ' seg=' .. tostring(player_seg))
		ok, cover = pcall(function()
			return nav:find_cover_in_nav_seg_3(player_seg, 2000, pos, threat)
		end)
	else
		say('cover probe: engine search mode=' .. tostring(mode))
		ok, cover = pcall(function()
			return nav:find_cover_near_pos_1(pos, threat, 2000, 0, true)
		end)
	end

	if not ok then
		say('cover probe: search failed: ' .. tostring(cover))
		return
	end

	if cover then
		local cover_pos = cover[1]
		say(string.format('cover probe: found cover at %.0f %.0f %.0f', cover_pos.x, cover_pos.y, cover_pos.z))
	else
		say('cover probe: no cover found')
	end
end

function TH.gen_covers(args)
	local nav = managers and managers.navigation

	if not nav or not nav._LIES_cover_gen_start then
		say('gen: navigation manager missing (Nav-B not loaded)')
		return
	end

	local mode = args[1]
	local nsegs = tonumber(args[2])
	local ncands = tonumber(args[3])

	if mode == 'probe' then
		nsegs = math.floor(math.clamp(nsegs or 1, 1, 4))
		ncands = math.floor(math.clamp(ncands or 8, 1, 16))
	elseif mode == 'run' then
		if nsegs then
			nsegs = math.floor(math.clamp(nsegs, 1, 256))
		end
		ncands = math.floor(math.clamp(ncands or 8, 1, 32))
	else
		say('gen: usage !lies gen probe|run [nsegs] [ncands]')
		return
	end

	if nsegs and nsegs < 1 then
		nsegs = 1
	end

	if ncands and ncands < 1 then
		ncands = 1
	end

	local covers_before = #(nav._covers or {})
	local cover_mode = tonumber(LIES and LIES.settings and LIES.settings.lua_cover) or 1

	if cover_mode < 2 then
		say('gen: lua_cover=' .. tostring(cover_mode) .. ' (<2): automatic generation stays off, this manual dev pass still runs')
	end

	local ok, err = pcall(function()
		return nav:_LIES_cover_gen_start(mode == 'probe', nsegs, ncands)
	end)

	if not ok then
		say('gen: failed: ' .. tostring(err))
		return
	end

	if mode == 'probe' then
		say(string.format('gen probe: done segs=%d ncands=%d covers=%d before=%d (funnel line above)', nsegs, ncands, #(nav._covers or {}), covers_before))
	else
		say(string.format('gen run: scheduled segs=%s ncands=%d covers_before=%d (funnel line when the pass finishes)', tostring(nsegs or 'all'), ncands, covers_before))
	end
end

function TH.set_setting(key, value)
	if not LIES or not LIES.settings then
		say('setting: LIES not loaded')
		return
	end

	local parsed = tonumber(value)
	if parsed == nil then
		if value == 'true' then
			parsed = true
		elseif value == 'false' then
			parsed = false
		else
			parsed = value
		end
	end

	LIES.settings[key] = parsed

	if key == 'lua_cover' and managers.navigation and managers.navigation._change_funcs then
		managers.navigation:_change_funcs()
	end

	say(string.format('setting %s=%s', tostring(key), tostring(parsed)))
end

function TH.force_assault()
	local state = managers and managers.groupai and managers.groupai:state()

	if not state or not state.set_assault_mode then
		say('assault: group AI state unavailable')
		return
	end

	state:set_assault_mode(true)
	say('assault: set_assault_mode(true)')
end

function TH.force_alarm()
	local state = managers and managers.groupai and managers.groupai:state()

	if not state then
		say('alarm: group AI state unavailable')
		return
	end

	if state.on_police_called then
		state:on_police_called('civ_alarm')
	end

	if state.on_police_weapons_hot then
		state:on_police_weapons_hot('civ_alarm')
	end

	if state.set_assault_mode then
		state:set_assault_mode(true)
	end

	say('alarm: on_police_called + on_police_weapons_hot + set_assault_mode')
end

function TH.dump_state()
	local state = managers and managers.groupai and managers.groupai:state()

	if not state then
		say('state: group AI state unavailable')
		return
	end

	local groups = state._groups or {}
	local spawning = state._spawning_groups or {}
	local cops = managers.enemy and managers.enemy:all_enemies() or {}
	local assault = state._task_data and state._task_data.assault or {}

	say(string.format(
		'state=%s is_server=%s police_called=%s weapons_hot=%s assault_mode=%s assault_active=%s queued=%s(%s) groups=%d spawning=%d cops=%d',
		tostring(state),
		tostring(state._is_server),
		tostring(state.is_police_called and state:is_police_called()),
		tostring(state._enemy_weapons_hot),
		tostring(state._assault_mode),
		tostring(assault.active),
		tostring(state._police_upd_task_queued),
		type(state._police_upd_task_queued),
		table.size(groups),
		table.size(spawning),
		table.size(cops)
	))
end

function TH.dump()
	if not LIES or not LIES.settings then
		say('dump: LIES settings unavailable')
		return
	end

	say('dump: settings')
	for key, value in pairs(LIES.settings or {}) do
		log(string.format('%s  %s=%s', PREFIX, tostring(key), tostring(value)))
	end

	local nav = managers and managers.navigation
	local cached = nav and (nav._LIES_cached_paths or nav._LIES_navlink_elements)
	say(string.format(
		'dump: lua_cover=%s cached_nav=%s covers=%d',
		tostring(LIES.settings.lua_cover),
		tostring(cached and table.size(cached) or 'n/a'),
		nav and #(nav._covers or {}) or 0
	))
end

function TH.help()
	say('commands: nav | cover | alarm | assault | state | gen probe|run [nsegs] [ncands] | setting <key> <value> | dump | help')
end

function TH.execute_string(message)
	local command = TH.parse_command(message)
	if not command then
		return false
	end
	TH.execute(command)
	return true
end

function TH.execute(command)
	local name = command.command
	local args = command.args

	if name == 'help' then
		TH.help()
	elseif name == 'nav' then
		TH.dump_nav()
	elseif name == 'cover' then
		TH.cover_probe()
	elseif name == 'alarm' then
		TH.force_alarm()
	elseif name == 'assault' then
		TH.force_assault()
	elseif name == 'state' then
		TH.dump_state()
	elseif name == 'gen' then
		TH.gen_covers(args)
	elseif name == 'setting' then
		TH.set_setting(args[1], args[2])
	elseif name == 'dump' then
		TH.dump()
	else
		say('unknown command: ' .. tostring(name))
	end
end

Hooks:Add('ChatManagerOnSendMessage', 'LIES_TestHarness_Chat', function(_, _, message)
	local command = TH.parse_command(message)
	if not command then
		return
	end

	local ok, err = pcall(TH.execute, command)
	if not ok then
		say('ERROR ' .. tostring(err))
	end
end)

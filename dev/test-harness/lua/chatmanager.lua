-- LIES 248.2 port test harness. Dev-only; not shipped.
-- Chat commands: !lies help | nav | cover | assault | setting <key> <value> | dump

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
						stats.nav_links = stats.nav_links + 1
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
	local ok, cover = pcall(function()
		return nav:find_cover_near_pos_1(pos, threat, 2000, 0, true)
	end)

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

function TH.dump()
	if not LIES then
		say('dump: LIES not loaded')
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
	say('commands: nav | cover | assault | setting <key> <value> | dump | help')
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
	elseif name == 'assault' then
		TH.force_assault()
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

if RequiredScript == "lib/managers/menumanager" then
	_G.LIES = {
		mod_path = ModPath,
		loc_path = ModPath .. "loc/",
		save_path = SavePath .. "LittleIntelligenceEnhancementS.txt",
		default_loc_path = ModPath .. "loc/en.txt",
		options_path = ModPath .. "menu/options.txt",
		version = "8.57.31",
		settings = {
			lua_cover = false,
			jokerhurts = false,
			extra_chatter = true,
			enemy_aggro_level = 2,
			enemy_reaction_level = 1,
			enemy_travel_level = 1,
			fixed_spawngroups = 1,
			copsretire = false,
			nav_link_interval = 1,
			coplimit = 1,
			interruptoncontact = true,
			teamaihelpers = true,
			spawngroupdelays = 1,
			hhtacs = false,
			highperformance = false,
			-- Door-watching pre-aim: cops keep their aim on the doorways of the
			-- segment a target is in, not only the one the cop is walking
			-- through. Only active while High Performance Mode is off; that mode
			-- is becoming a section header over per-feature flags like this one.
			-- See MENU_OPTIONS.md.
			door_watch = true,
			debug_log = false,
			-- Opt-in [LIES-WATCH] digest (one line per minute). Failure alarms are
			-- always on and need no setting; see MENU_OPTIONS.md.
			watch_log = false,
			-- Crash breadcrumbs: one [LIES-TRACE] line per unit per phase per
			-- 2.5 s (global cap 120 lines/s). Native access violations leave no
			-- Lua error, so the last trace line is the only record of what the
			-- crashing unit was doing - but the channel is what makes a routine
			-- log tens of MB, so a release build keeps it OFF and a crash report
			-- turns it on first. Settings file only; see MENU_OPTIONS.md.
			trace = false,
			-- Path-cache lookup in NavigationManager:search_pos_to_pos. `true` is
			-- upstream behaviour: before asking the engine, scan the cached paths
			-- and reuse one whose endpoints are still in a straight walkable line.
			-- `false` skips the scan and always asks the engine (one frame later,
			-- ~10 us to enqueue instead of ~3.5 ms of scanning). Settings file
			-- only, no menu entry; see MENU_OPTIONS.md.
			cache_lookup = true
		}
	}
	LIES.update_url = "https://raw.githubusercontent.com/met94/Little-Intelligence-Enhancements-x64/main/autoupdate.json"

	TheFixesPreventer = TheFixesPreventer or {}
	TheFixesPreventer.fix_hostages_not_moving = true
	TheFixesPreventer.crash_no_unit_type_aistatebesiege = true
	TheFixesPreventer.crash_criminal_obj_complete_aistatebase = true
	TheFixesPreventer.crash_upd_aim_coplogicattack = true
	TheFixesPreventer.crash_aim_allow_fire_coplogicattack = true
	TheFixesPreventer.civvie_goes_to_player = true

	function LIES:tprint(tbl, indent, depth)
		depth = depth or 2
		indent = indent or 0
		local toprint = string.rep(" ", indent) .. "{\r\n"
		indent = indent + 2
		
		if type(tbl) ~= "table" then
			toprint = "type is not table, type is " .. type(tbl) .. " with value of " .. tostring(tbl)
			
			return toprint
		else
			for k, v in pairs(tbl) do
				toprint = toprint .. string.rep(" ", indent)

				if type(k) == "number" then
					toprint = toprint .. "[" .. k .. "] = "
				elseif type(k) == "string" then
					toprint = toprint .. k .. "= "
				end

				if type(v) == "number" then
					toprint = toprint .. v .. ",\r\n"
				elseif type(v) == "string" then
					toprint = toprint .. "\"" .. v .. "\",\r\n"
				elseif type(v) == "table" then
					if depth > 0 then
						toprint = toprint .. LIES:tprint(v, indent, depth - 1) .. ",\r\n"
					end
				else
					toprint = toprint .. "\"" .. tostring(v) .. "\",\r\n"
				end
			end
		end

		toprint = toprint .. string.rep(" ", indent - 2) .. "}"

		return toprint
	end

	function LIES:UseLuaCover()
		return self.settings.lua_cover
	end

	function LIES:Load()
		local file = io.open(LIES.save_path, "r")

		if file then
			for k, v in pairs(json.decode(file:read("*all"))) do
				LIES.settings[k] = v
			end
		else
			LIES:Save()
		end
	end

	function LIES:Save()
		local file = io.open(LIES.save_path,"w+")

		if file then
			file:write(json.encode(LIES.settings))
			file:close()
		end
	end

	function LIES:LogCheck(message, kind)
		-- Counters are always live: the watch digest must work with debug logging
		-- off, and the alarms only ever look at counters.
		if kind then
			self:Count(kind)
		end

		if self.settings and self.settings.debug_log then
			log("[LIES-CHECK] " .. tostring(message))
		end
	end

	-- Watch channel. Alarms are always on (hard failures only, rate limited);
	-- the digest is opt-in via `watch_log`. Same shape as Iter's channel so one
	-- reader handles both mods.
	LIES.watch_alarm_last = LIES.watch_alarm_last or {}
	LIES.watch_alarm_budget = LIES.watch_alarm_budget or 20
	LIES.watch_alarm_window = 60
	LIES.watch_next_t = LIES.watch_next_t or 0
	LIES.watch_header_done = LIES.watch_header_done or false
	LIES.watch_counters = LIES.watch_counters or {}
	LIES.watch_prev = LIES.watch_prev or {}

	function LIES:Count(kind, amount)
		self.watch_counters[kind] = (self.watch_counters[kind] or 0) + (amount or 1)
	end

	-- Gauges keep the maximum seen inside the digest window (cache length, id
	-- age); sums keep sum+count so the digest can print an average (timings).
	LIES.watch_gauges = LIES.watch_gauges or {}
	LIES.watch_sums = LIES.watch_sums or {}

	function LIES:Gauge(kind, value)
		local v = tonumber(value)

		if not v then
			return
		end

		if v > (self.watch_gauges[kind] or -1) then
			self.watch_gauges[kind] = v
		end
	end

	function LIES:Sum(kind, value)
		local v = tonumber(value)

		if not v then
			return
		end

		local entry = self.watch_sums[kind]

		if not entry then
			entry = { sum = 0, n = 0 }
			self.watch_sums[kind] = entry
		end

		entry.sum = entry.sum + v
		entry.n = entry.n + 1
	end

	local function lies_watch_fields(fields)
		local parts = {}

		for key, value in pairs(fields or {}) do
			local text = tostring(value):gsub("%s+", "_"):gsub("[^%w%._%+%-/:%[%]]", "")

			if #text > 120 then
				text = text:sub(1, 120)
			end

			parts[#parts + 1] = tostring(key) .. "=" .. text
		end

		table.sort(parts)

		return table.concat(parts, " ")
	end

	function LIES:WatchEnabled()
		return (self.settings and self.settings.watch_log) and true or false
	end

	function LIES:Watch(event_name, fields)
		if not self:WatchEnabled() then
			return
		end

		log("[LIES-WATCH] v=" .. tostring(self.version) .. " evt=" .. tostring(event_name) .. " " .. lies_watch_fields(fields))
	end

	-- Crash breadcrumbs. A native access violation in engine code leaves no Lua
	-- error message and cannot be caught, so the only record of what a unit was
	-- doing is what we logged just before the fault. One line per unit per phase
	-- per 2.5 s (per phase window can be tightened by the caller), 60 normal
	-- lines/s globally; failure phases are exempt because a crash report cannot
	-- be reconstructed without them.
	LIES.trace_state = LIES.trace_state or {}
	LIES.trace_window_t = LIES.trace_window_t or 0
	LIES.trace_window_n = LIES.trace_window_n or 0
	LIES.trace_prune_t = LIES.trace_prune_t or 0
	LIES.trace_dropped = LIES.trace_dropped or 0

	local trace_low_priority = {
		aim = true,
		peek = true,
		cover_upd = true
	}

	local trace_failure_phases = {
		combat_no_attention = true,
		dodge_dead_enemy = true,
		spooc_dead_enemy = true,
		stale_tracker = true,
		movement_aim_stale = true,
		exit_missing_logic = true,
		exit_no_fallback = true
	}

	function LIES:Trace(unit, logic_data, phase, extra, window)
		if not (self.settings and self.settings.trace) then
			return
		end

		local timer = TimerManager and TimerManager:game()

		if not timer then
			return
		end

		local t = timer:time()
		local u_key = unit and unit:key() or 0
		local state = self.trace_state[u_key]

		if not state then
			state = {
				phases = {}
			}

			self.trace_state[u_key] = state
		end

		-- Per-phase throttle: `combat` -> `charge_search` -> `retreat` alternates
		-- every frame, so a single "last phase" timestamp would let the pair
		-- through on every call and burn the whole cap.
		local last = state.phases[phase]

		if last and t >= last and t - last < (window or 2.5) then
			return
		end

		-- Window refill. `time()` restarts near zero on a level change or script
		-- reload, so a clock that moved backwards also starts a new window.
		if t < self.trace_window_t or t > self.trace_window_t + 1 then
			self.trace_window_t = t
			self.trace_window_n = 0
		end

		local trace_limit = trace_low_priority[phase] and 40 or 120

		if self.trace_window_n >= trace_limit and not trace_failure_phases[phase] then
			self.trace_dropped = self.trace_dropped + 1

			return
		end

		self.trace_window_n = self.trace_window_n + 1

		state.phases[phase] = t
		state.last = t

		-- Drop units that stopped tracing (despawned, changed logic) without
		-- waiting for the next level change.
		if t < self.trace_prune_t or t - self.trace_prune_t > 60 then
			self.trace_prune_t = t

			for key, entry in pairs(self.trace_state) do
				if t - (entry.last or 0) > 60 then
					self.trace_state[key] = nil
				end
			end
		end

		local att = logic_data and logic_data.attention_obj
		local base = unit and unit:base()
		local brain = unit and unit:brain()

		-- `att.u_key` instead of `att.unit:key()`: the attention object carries
		-- the key, and a dead unit must not be touched just to log about it.
		log(string.format("[LIES-TRACE] v=%s t=%.2f u=%s tweak=%s logic=%s phase=%s att=%s att_alive=%s att_trk=%s dropped=%d%s",
			tostring(self.version), t, tostring(u_key),
			tostring(base and base._tweak_table or "?"),
			tostring(brain and brain._current_logic_name or "?"),
			tostring(phase),
			tostring(att and att.u_key or "-"),
			tostring((att and att.unit and alive(att.unit)) and true or false),
			tostring((att and att.nav_tracker) and true or false),
			self.trace_dropped,
			extra and (" " .. tostring(extra)) or ""))
	end

	-- Discrete event channel. Logic switches, objective assignments and exits are
	-- the causal chain behind a crash; they are low volume, so they get their own
	-- tag and their own throttle. Gated by the same `trace` switch.
	LIES.event_state = LIES.event_state or {}
	LIES.event_window_t = LIES.event_window_t or 0
	LIES.event_window_n = LIES.event_window_n or 0

	function LIES:Event(kind, unit, logic_data, fields)
		if not (self.settings and self.settings.trace) then
			return
		end

		local timer = TimerManager and TimerManager:game()

		if not timer then
			return
		end

		local t = timer:time()
		local u_key = unit and unit:key() or 0
		local key = tostring(kind) .. "|" .. tostring(u_key)
		local last = self.event_state[key]

		if last and t >= last and t - last < 1 then
			return
		end

		if t < self.event_window_t or t > self.event_window_t + 1 then
			self.event_window_t = t
			self.event_window_n = 0
		end

		if self.event_window_n >= 40 then
			return
		end

		self.event_window_n = self.event_window_n + 1
		self.event_state[key] = t

		local base = unit and unit:base()
		local brain = unit and unit:brain()
		local att = logic_data and logic_data.attention_obj
		local merged = {
			t = string.format("%.2f", t),
			u = tostring(u_key),
			tweak = tostring(base and base._tweak_table or "?"),
			logic = tostring(brain and brain._current_logic_name or "?"),
			att = tostring(att and att.u_key or "-")
		}

		for field_key, value in pairs(fields or {}) do
			merged[field_key] = value
		end

		log("[LIES-EVENT] v=" .. tostring(self.version) .. " kind=" .. tostring(kind) .. " " .. lies_watch_fields(merged))
	end

	function LIES:Alarm(name, fields, now)
		if (self.watch_alarm_budget or 0) <= 0 then
			return
		end

		now = tonumber(now) or 0

		local last = self.watch_alarm_last[name]

		if last and now - last < self.watch_alarm_window then
			return
		end

		self.watch_alarm_last[name] = now
		self.watch_alarm_budget = self.watch_alarm_budget - 1

		log("[LIES-WATCH] v=" .. tostring(self.version) .. " evt=alarm name=" .. tostring(name) .. " " .. lies_watch_fields(fields))

		if self.watch_alarm_budget <= 0 then
			log("[LIES-WATCH] v=" .. tostring(self.version) .. " evt=alarm_budget_exhausted")
		end
	end

	function LIES:WatchReset()
		self.watch_alarm_last = {}
		self.watch_alarm_budget = 20
		self.watch_next_t = 0
		self.watch_header_done = false
		self.watch_prev = {}
		self.watch_prev_ready = false
		self.watch_gauges = {}
		self.watch_sums = {}
		self.trace_state = {}
		self.trace_window_t = 0
		self.trace_window_n = 0
		self.trace_prune_t = 0
		self.event_state = {}
		self.event_window_t = 0
		self.event_window_n = 0
	end

	local function lies_level_id()
		local level = "?"

		pcall(function()
			if managers.job then
				level = tostring(managers.job:current_level_id() or "?")
			end
		end)

		return level
	end

	function LIES:WatchDigest(t)
		local c = self.watch_counters
		local d = {}

		for key, value in pairs(c) do
			d[key] = value - (self.watch_prev[key] or 0)
		end

		self.watch_prev = {}

		for key, value in pairs(c) do
			self.watch_prev[key] = value
		end

		local hits0, hits1, hits2_7, hits8p = self:_cache_hit_histogram()

		local fields = {
			level = lies_level_id(),			t = math.floor(t or 0),
			cover_set = d.cover_set or 0,
			cover_fallback = d.cover_fallback or 0,
			suppression_deny = d.suppression_deny or 0,
			taser_allowed = d.taser_allowed or 0,
			taser_blocked = d.taser_blocked or 0,
			bag_registered = d.bag_registered or 0,
			bag_skipped = d.bag_skipped or 0,
			phalanx_spawn = d.phalanx_spawn or 0,
			marshal = d.marshal or 0,

			-- path cache: is it growing, is it being hit, what does the scan cost
			cache_len = math.floor((self.watch_gauges.cache_len or 0) + 0.5),
			cache_keys = self:_count_cache_keys(),
			cache_hit = d.cache_hit or 0,
			cache_miss = d.cache_miss or 0,
			cache_scan_n = self:_avg_sum("cache_scan_n"),
			cache_scan_us = self:_avg_sum("cache_scan_us"),
			cache_hit_inclusions = d.cache_hit_inclusions or 0,
			cache_hits0 = hits0,
			cache_hits1 = hits1,
			cache_hits2_7 = hits2_7,
			cache_hits8p = hits8p,

			-- where the lookups come from, and whether the destination has a segment
			lookup_cover = d.lookup_cover or 0,
			lookup_path = d.lookup_path or 0,
			lookup_nil_seg = d.lookup_nil_seg or 0,

			-- where searches actually go: straight line, cache, or the engine
			search_sync_line = d.search_sync_line or 0,
			search_sync_cache = d.search_sync_cache or 0,
			search_engine = d.search_engine or 0,
			engine_us = self:_avg_sum("engine_us"),

			-- cover lifecycle: why a search was issued and how it ended
			cover_issued_gate = d.cover_issued_gate or 0,
			cover_issued_failed_path = d.cover_issued_failed_path or 0,
			cover_issued_refused_walk = d.cover_issued_refused_walk or 0,
			cover_walk_refused = d.cover_walk_refused or 0,
			cover_walk_refused_movement = d.cover_walk_refused_movement or 0,
			cover_walk_refused_action = d.cover_walk_refused_action or 0,
			cover_walk_refused_other = d.cover_walk_refused_other or 0,
			cover_path_failed = d.cover_path_failed or 0,
			cover_id_age_ms = self:_avg_sum("cover_id_age_ms"),
			cover_id_age_max_ms = math.floor((self.watch_gauges.cover_id_age_ms or 0) + 0.5),
			cover_abandoned_inflight = d.cover_abandoned_inflight or 0,
			cover_stale_applied = d.cover_stale_applied or 0,

			-- door watch in the aim pass: which branch ran
			dw_call = d.dw_call or 0,
			dw_hit = d.dw_hit or 0,
			dw_gate_off = d.dw_gate_off or 0,
			dw_stale_bail = d.dw_stale_bail or 0,
			dw_outer_gate_skip = d.dw_outer_gate_skip or 0,
			dw_no_my_tracker = d.dw_no_my_tracker or 0,
			dw_none = d.dw_none or 0,
			dw_cadence_skip = d.dw_cadence_skip or 0,
			dw_advancing_skip = d.dw_advancing_skip or 0,
			dw_cached_reuse = d.dw_cached_reuse or 0,
			dw_cached_unsighted = d.dw_cached_unsighted or 0,
			dw_height_skip = d.dw_height_skip or 0,
			dw_seg_same = d.dw_seg_same or 0,
			dw_path_prestep = d.dw_path_prestep or 0,
			dw_path_prestep_hit = d.dw_path_prestep_hit or 0,
			dw_raw_hit = d.dw_raw_hit or 0,
			dw_expected_pos_hit = d.dw_expected_pos_hit or 0,
			dw_vanilla_call = d.dw_vanilla_call or 0,
			dw_path_kick = d.dw_path_kick or 0,
			dw_ray = d.dw_ray or 0,
			dw_us = self:_avg_sum("dw_us"),
			dw_us_max = math.floor((self.watch_gauges.dw_us_max or 0) + 0.5),
			-- The six outcome counters are disjoint; a non-zero gap means a call
			-- returned without an outcome.
			dw_gap = (d.dw_call or 0) - ((d.dw_gate_off or 0) + (d.dw_stale_bail or 0) + (d.dw_outer_gate_skip or 0) + (d.dw_no_my_tracker or 0) + (d.dw_hit or 0) + (d.dw_none or 0)),

			-- watch adoption: the watch position became a cop's attention target
			-- (fresh or cached), the cached subset, the subset adopted while the
			-- target was visible, and how far off the facing was (`dot` 1 =
			-- already facing the doorway, so a low mean means a visible turn)
			watch_aim_adopted = d.watch_aim_adopted or 0,
			watch_aim_cached = d.watch_aim_cached or 0,
			watch_aim_verified = d.watch_aim_verified or 0,
			watch_aim_dot = self:_avg_sum("watch_aim_dot"),
			-- The measured subset behind that mean: `_avg_sum` divides by the
			-- number of `Sum` calls, so this is exactly the samples with a
			-- measurable facing (`dot=n/a` samples never reach `Sum`). The report
			-- needs it to weight the mean and to share one denominator with the
			-- subset counts; weighting by `watch_aim_adopted` would treat an
			-- unmeasured facing as if it had a value.
			watch_aim_dot_n = self:_sum_n("watch_aim_dot"),
			-- Settled facing: the same dot sampled at least 0.4 s after the first
			-- adoption of an episode, on the next due aim pass, so it says whether
			-- the cop actually ended up facing the doorway rather than how far off
			-- it was when the turn started.
			watch_aim_settled = d.watch_aim_settled or 0,
			watch_aim_settled_square = d.watch_aim_settled_square or 0,
			watch_aim_settled_dot = self:_avg_sum("watch_aim_settled_dot"),
			watch_aim_settled_dot_n = self:_sum_n("watch_aim_settled_dot"),

			-- near-visible probe: how often the vertical fallback ran, and its tallest probe
			near_vis_probe = d.near_vis_probe or 0,
			near_vis_h_max = math.floor((self.watch_gauges.near_vis_h or 0) + 0.5),

			-- find_segment_doors: why the door list shrank, and tracker balance
			fsd_call_2arg = d.fsd_call_2arg or 0,
			fsd_call_center = d.fsd_call_center or 0,
			fsd_no_from_seg = d.fsd_no_from_seg or 0,
			fsd_neighbour_missing = d.fsd_neighbour_missing or 0,
			fsd_disabled = d.fsd_disabled or 0,
			fsd_raw = d.fsd_raw or 0,
			fsd_door_dead = d.fsd_door_dead or 0,
			fsd_door_obstructed = d.fsd_door_obstructed or 0,
			fsd_nil_element = d.fsd_nil_element or 0,
			fsd_nil_position = d.fsd_nil_position or 0,
			fsd_nil_tracker = d.fsd_nil_tracker or 0,
			fsd_nil_end_pos = d.fsd_nil_end_pos or 0,
			fsd_navlink_seg_ok = d.fsd_navlink_seg_ok or 0,
			fsd_navlink_seg_mismatch = d.fsd_navlink_seg_mismatch or 0,
			fsd_tracker_created = d.fsd_tracker_created or 0,
			fsd_tracker_destroyed = d.fsd_tracker_destroyed or 0,
			-- No `fsd_balance` field: the two counters above are incremented in
			-- the same unconditional block, so a balance would be zero by
			-- construction. The leak invariant is enforced by
			-- `dev/test-harness/test/find_segment_doors.lua`, and they are here
			-- for the churn volume.
			fsd_bad_shape = d.fsd_bad_shape or 0,

			-- reaction-level fire delay: held frames vs allowed frames
			react_hold = d.react_hold or 0,
			react_allow = d.react_allow or 0,
			react_level = tonumber(self.settings.enemy_reaction_level) or 1
		}

		self.watch_gauges = {}
		self.watch_sums = {}

		self:Watch("digest", fields)
	end

	-- Average of a Sum() accumulator inside the window, for the digest.
	function LIES:_avg_sum(kind)
		local entry = self.watch_sums and self.watch_sums[kind]

		if not entry or entry.n == 0 then
			return 0
		end

		return entry.sum / entry.n
	end

	-- How many `Sum()` calls back a `_avg_sum` figure: the measured subset, as
	-- opposed to the attempt count a `Count()` counter reports.
	function LIES:_sum_n(kind)
		local entry = self.watch_sums and self.watch_sums[kind]

		return entry and entry.n or 0
	end

	-- Distribution of cache entries by how often they have ever been hit: tells us
	-- whether hits cluster in a hot few (= a small cache would do) or spread.
	function LIES:_cache_hit_histogram()
		local cache = managers and managers.navigation and managers.navigation._cached_paths

		if type(cache) ~= "table" then
			return 0, 0, 0, 0
		end

		local zero, one, few, many = 0, 0, 0, 0

		for index = 1, #cache do
			local entry = cache[index]
			local hits = type(entry) == "table" and (entry.hits or 0) or 0

			if hits == 0 then
				zero = zero + 1
			elseif hits == 1 then
				one = one + 1
			elseif hits < 8 then
				few = few + 1
			else
				many = many + 1
			end
		end

		return zero, one, few, many
	end

	-- Distinct access strings currently in the path cache: how many buckets a
	-- real index would need. Bounded scan, skipped if the cache is huge.
	function LIES:_count_cache_keys()
		local cache = managers and managers.navigation and managers.navigation._cached_paths

		if type(cache) ~= "table" or #cache > 5000 then
			return -1
		end

		local keys = {}

		for index = 1, #cache do
			local entry = cache[index]

			if type(entry) == "table" and entry.access_pos_str then
				keys[entry.access_pos_str] = true
			end
		end

		local n = 0

		for _ in pairs(keys) do
			n = n + 1
		end

		return n
	end

	-- Alarms. Evaluated every 60 s whether or not the digest is on, so a normal
	-- session still records a hard failure (that is the whole point).
	local function lies_alarm_ratio(counters, prev, a, b, minimum)
		local total = (counters[a] or 0) - (prev[a] or 0) + (counters[b] or 0) - (prev[b] or 0)

		if total < minimum then
			return nil
		end

		local bad = (counters[a] or 0) - (prev[a] or 0)

		return bad / total, total, bad
	end

	-- Delta of one counter inside the alarm window.
	local function lies_delta(counters, prev, kind)
		return (counters[kind] or 0) - (prev[kind] or 0)
	end

	function LIES:WatchTick(t)
		t = tonumber(t) or 0

		if not self.watch_header_done then
			self.watch_header_done = true
			self:Watch("header", {
				version = self.version,
				level = lies_level_id(),
				lua_cover = tostring(self.settings.lua_cover),
				highperformance = tostring(self.settings.highperformance),
				hhtacs = tostring(self.settings.hhtacs),
				nav_link_interval = tostring(self.settings.nav_link_interval),
				debug_log = tostring(self.settings.debug_log),
				door_watch = tostring(self.settings.door_watch),
				trace = tostring(self.settings.trace),
				watch_log = tostring(self.settings.watch_log),
				enemy_reaction_level = tostring(self.settings.enemy_reaction_level)
			})
		end

		if t < (self.watch_next_t or 0) then
			return
		end

		self.watch_next_t = t + 60

		-- First full minute: snapshot the counters, do not alarm on cumulative
		-- history from level start.
		if not self.watch_prev_ready then
			self.watch_prev_ready = true

			for key, value in pairs(self.watch_counters) do
				self.watch_prev[key] = value
			end

			if self:WatchEnabled() then
				self:WatchDigest(t)
			end

			return
		end

		local ratio, total, bad = lies_alarm_ratio(self.watch_counters, self.watch_prev, "cover_fallback", "cover_set", 40)

		if ratio and ratio > 0.5 then
			self:Alarm("lies_cover_fallback_rate", {
				rate = string.format("%.2f", ratio),
				fallback = bad,
				total = total
			}, t)
		end

		-- Suppression. Absolute spike, not a ratio: nothing in the mod ever
		-- increments the matching allow counter, so the old deny/(deny+allow)
		-- ratio was 1.00 by construction and fired on six of 22 windows in one
		-- 22-minute run (65/60/59 denials), burning the 20-alarm budget on a
		-- healthy play. The counter is meaningful ("distinct cops denied once per
		-- episode"), so only the alarm changes: a minute with more than 90 denials
		-- is the shape worth reporting. 90, not 40, because the observed healthy
		-- maximum of the 2026-11-02 session was 65 at high cop counts - a cut
		-- under that fires on a normal assault wave and teaches the reader to
		-- ignore the line.
		local suppression_deny = lies_delta(self.watch_counters, self.watch_prev, "suppression_deny")

		if suppression_deny > 90 then
			self:Alarm("lies_suppression_deny_spike", {
				deny = suppression_deny,
				threshold = 90
			}, t)
		end

		-- Door probing. `fsd_tracker_created`/`fsd_tracker_destroyed` are digested
		-- for churn volume only: they are written in the same block, so a runtime
		-- balance check cannot fail and is not an alarm. The create/destroy
		-- invariant lives in `dev/test-harness/test/find_segment_doors.lua`.
		-- Every aim-pass call must land in exactly one outcome counter.
		local dw_call = lies_delta(self.watch_counters, self.watch_prev, "dw_call")
		local dw_outcomes = lies_delta(self.watch_counters, self.watch_prev, "dw_gate_off") +
			lies_delta(self.watch_counters, self.watch_prev, "dw_stale_bail") +
			lies_delta(self.watch_counters, self.watch_prev, "dw_outer_gate_skip") +
			lies_delta(self.watch_counters, self.watch_prev, "dw_no_my_tracker") +
			lies_delta(self.watch_counters, self.watch_prev, "dw_hit") +
			lies_delta(self.watch_counters, self.watch_prev, "dw_none")
		local dw_gap = dw_call - dw_outcomes

		if dw_gap ~= 0 and dw_call > 0 then
			self:Alarm("door_outcome_gap", {
				call = dw_call,
				outcomes = dw_outcomes,
				gap = dw_gap
			}, t)
		end

		-- A non-Vector3 door position would be handed to mvec3_set by vanilla.
		local fsd_bad_shape = lies_delta(self.watch_counters, self.watch_prev, "fsd_bad_shape")

		if fsd_bad_shape > 0 then
			self:Alarm("door_contract_violation", {
				bad_shape = fsd_bad_shape
			}, t)
		end

		if self:WatchEnabled() then
			self:WatchDigest(t)
		else
			-- The digest is the only other place the snapshot is refreshed, so
			-- without this the alarm deltas above stay cumulative and re-fire
			-- every window (until the alarm budget silences the real ones).
			for key, value in pairs(self.watch_counters) do
				self.watch_prev[key] = value
			end
		end
	end
	
	local mvec3_cpy = mvector3.copy
	
	function LIES:find_cover_in_cone_from_threat_pos_1(threat_pos, furthest_pos, near_pos, search_from_pos, angle, min_dis, nav_seg, optimal_threat_dis, rsrv_filter)
		local copied_threat_pos = threat_pos and mvec3_cpy(threat_pos) or nil
		
		return managers.navigation:_find_cover_through_lua(copied_threat_pos, near_pos, furthest_pos, min_dis, search_from_pos)
	end

	function LIES:find_cover_in_nav_seg_3(nav_seg_id, max_near_dis, near_pos, threat_pos)
		local copied_threat_pos = threat_pos and mvec3_cpy(threat_pos) or nil

		return managers.navigation:_find_cover_in_seg_through_lua(copied_threat_pos, near_pos, nav_seg_id)
	end

	function LIES:find_cover_from_threat(nav_seg_id, optimal_threat_dis, near_pos, threat_pos)
		local copied_threat_pos = threat_pos and mvec3_cpy(threat_pos) or nil

		return managers.navigation:_find_cover_in_seg_through_lua(threat_pos, near_pos, nav_seg_id)
	end
	
	function LIES:find_cover_near_pos_1(near_pos, threat_pos, max_near_dis, min_threat_dis, allow_fwd)
		local copied_threat_pos = threat_pos and mvec3_cpy(threat_pos) or nil
		
		return managers.navigation:_find_cover_through_lua(copied_threat_pos, near_pos, nil, min_threat_dis, nil, max_near_dis)
	end
	
	function LIES:find_cover_away_from_pos(near_pos, threat_pos, nav_seg_id)
		local copied_threat_pos = threat_pos and mvec3_cpy(threat_pos) or nil
		
		return managers.navigation:_find_cover_in_seg_through_lua(copied_threat_pos, near_pos, nav_seg_id)
	end

	function LIES:_path_is_straight_line(pos_from, pos_to, u_data)
		if not pos_from.z then
			if alive(pos_from) then
				pos_from = CopActionWalk._nav_point_pos(pos_from:script_data())
			else
				return
			end
		end
		
		if not pos_to.z then
			if alive(pos_to) then
				pos_to = CopActionWalk._nav_point_pos(pos_to:script_data())
			else
				return
			end
		end

		if math.abs(pos_from.z - pos_to.z) > 60 then 
			return
		end
		
		local ray = CopActionWalk._chk_shortcut_pos_to_pos(pos_from, pos_to)

		return not ray 
	end
	
	function LIES:_optimize_path(path, u_data)		
		if #path <= 2 then
			return path
		end

		local opt_path = {}
		local nav_path = {}
		
		for i = 1, #path do
			local nav_point = path[i]

			if nav_point.x then
				nav_path[#nav_path + 1] = nav_point
			elseif alive(nav_point) then
				nav_path[#nav_path + 1] = {
					element = nav_point:script_data().element,
					c_class = nav_point
				}
			else
				return path
			end
		end
		
		nav_path = CopActionWalk._calculate_simplified_path(path[1], nav_path, 1, true, true)
		
		for i = 1, #nav_path do
			local nav_point = nav_path[i]
			
			if nav_point.c_class then
				opt_path[#opt_path + 1] = nav_point.c_class
			else
				opt_path[#opt_path + 1] = nav_point
			end
		end

		return opt_path
	end

	function LIES:check_for_updates()
		dohttpreq(self.update_url, function(json_data, http_id)
			self:set_update_data(json_data)
		end)
	end
	
	function LIES:set_update_data(json_data)
		if json_data:is_nil_or_empty() then
			return
		end
		
		local ok, received_data = pcall(json.decode, json_data)

		if not ok or type(received_data) ~= "table" then
			return
		end
		
		for _, data in pairs(received_data) do
			if data.ident == "LIES-AI-MOD" and data.version then
				LIES.received_version = data.version
				log("LIES: Received update data.")
				break
			end
		end
	end
	
	Hooks:Add("LocalizationManagerPostInit", "LocalizationManagerPostInit_LIES", function( loc )
		loc:load_localization_file( LIES.default_loc_path)
	end)
	
	--add the menu callbacks for when menu options are changed
	Hooks:Add( "MenuManagerInitialize", "MenuManagerInitialize_LIES", function(menu_manager)		
		MenuCallbackHandler.callback_lies_lua_cover = function(self, item)
			local value = item:value()
			LIES.settings.lua_cover = value
			
			if managers.navigation then
				managers.navigation:_change_funcs()
			end
			
			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_extra_chatter = function(self, item)
			local on = item:value() == "on"
			LIES.settings.extra_chatter = on

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_jokerhurts = function(self, item)
			local on = item:value() == "on"
			LIES.settings.jokerhurts = on

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_enemy_aggro_level = function(self, item)
			local value = item:value()
			LIES.settings.enemy_aggro_level = value

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_enemy_travel_level = function(self, item)
			local value = item:value()
			LIES.settings.enemy_travel_level = value

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_enemy_reaction_level = function(self, item)
			local value = item:value()
			LIES.settings.enemy_reaction_level = value

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_fixed_spawngroups = function(self, item)
			local value = item:value()
			LIES.settings.fixed_spawngroups = value
			
			LIES.smg_groups = nil

			LIES:Save()
		end

		MenuCallbackHandler.callback_lies_copsretire = function(self, item)
			local on = item:value() == "on"
			LIES.settings.copsretire = on

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_teamaihelpers = function(self, item)
			local on = item:value() == "on"
			LIES.settings.teamaihelpers = on

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_nav_link_interval = function(self, item)
			local value = item:value()
			LIES.settings.nav_link_interval = value

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_coplimit = function(self, item)
			local value = item:value()
			LIES.settings.coplimit = value

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_interruptoncontact = function(self, item)
			local on = item:value() == "on"
			LIES.settings.interruptoncontact = on

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_spawngroupdelays = function(self, item)
			local value = item:value()
			LIES.settings.spawngroupdelays = value

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_hhtacs = function(self, item)
			local on = item:value() == "on"
			LIES.settings.hhtacs = on

			LIES:Save()
		end
		
		MenuCallbackHandler.callback_lies_highperformance = function(self, item)
			local on = item:value() == "on"
			LIES.settings.highperformance = on
			log("high performance mode: "..tostring(LIES.settings.highperformance))

			LIES:Save()
		end

		MenuCallbackHandler.callback_lies_door_watch = function(self, item)
			local on = item:value() == "on"
			LIES.settings.door_watch = on

			LIES:Save()
		end

		MenuCallbackHandler.callback_lies_debug_log = function(self, item)
			local on = item:value() == "on"
			LIES.settings.debug_log = on

			LIES:Save()
		end

		--called when the menu is closed
		MenuCallbackHandler.callback_lies_close = function(self)
		end

		--load settings from user's mod settings txt
		LIES:Load()
		
		if type(LIES.settings.spawngroupdelays) ~= "number" then
			log("LIES: Thanks for downloading the newest version. <3")
			LIES.settings.spawngroupdelays = LIES.settings.spawngroupdelays == true and 2 or 1
			
			LIES:Save()
		end
		
		if type(LIES.settings.fixed_spawngroups) ~= "number" then
			log("LIES: Thanks for downloading the newest version. <3")
			LIES.settings.fixed_spawngroups = 1
			
			LIES:Save()
		elseif LIES.settings.fixed_spawngroups > 2 then
			log("LIES: Thanks for downloading the newest version. <3")
			LIES.settings.fixed_spawngroups = 1
			
			LIES:Save()
		end
		
		if type(LIES.settings.lua_cover) ~= "number" then
			log("LIES: Thanks for downloading the newest version. <3")
			LIES.settings.lua_cover = LIES.settings.lua_cover == true and 2 or 1
			
			LIES:Save()
		elseif LIES.settings.lua_cover > 2 then
			log("LIES: Thanks for downloading the newest version. <3")
			LIES.settings.lua_cover = 2
			
			LIES:Save()
		end

		--create menus
		MenuHelper:LoadFromJsonFile(LIES.options_path, LIES, LIES.settings)
		
		if not Global.checked_for_updates_lies then
			log("LIES: Checking for update data.")
			LIES:check_for_updates()
			Global.checked_for_updates_lies = true
		end
	end)
end

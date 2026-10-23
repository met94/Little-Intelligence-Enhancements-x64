local mvec3_n_equal = mvector3.not_equal
local mvec3_set = mvector3.set
local mvec3_set_st = mvector3.set_static
local mvec3_set_z = mvector3.set_z
local mvec3_step = mvector3.step
local mvec3_sub = mvector3.subtract
local mvec3_norm = mvector3.normalize
local mvec3_dir = mvector3.direction
local mvec3_add = mvector3.add
local mvec3_mul = mvector3.multiply
local mvec3_div = mvector3.divide
local mvec3_lerp = mvector3.lerp
local mvec3_cpy = mvector3.copy
local mvec3_set_l = mvector3.set_length
local mvec3_dot = mvector3.dot
local mvec3_cross = mvector3.cross
local mvec3_dis = mvector3.distance
local mvec3_dis_sq = mvector3.distance_sq
local mvec3_rot = mvector3.rotate_with
local mvec3_length = mvector3.length
local math_lerp = math.lerp
local math_abs = math.abs
local math_max = math.max
local math_ceil = math.ceil
local math_floor = math.floor
local temp_vec1 = Vector3()
local temp_vec2 = Vector3()
local temp_vec3 = Vector3()
local temp_vec4 = Vector3()
local math_up = math.UP
local t_ins = table.insert
NavigationManager.has_registered_cover_units_for_LIES = nil
NavigationManager._LIES_navlink_elements = {}

function NavigationManager:find_segment_doors(from_seg_id, approve_clbk, center_only)
	local all_nav_segs = self._nav_segments
	local from_seg = all_nav_segs[from_seg_id]
	local found_doors = {}

	if not from_seg then
		return found_doors
	end

	for neighbour_seg_id, door_list in pairs(from_seg.neighbours) do
		local neighbour_seg = all_nav_segs[neighbour_seg_id]

		if neighbour_seg and not neighbour_seg.disabled and (not approve_clbk or approve_clbk(neighbour_seg_id)) then
			if center_only then
				local door_central = Vector3()
				local number_of_doors = 0

				for _, door in ipairs(door_list) do
					if door.x then
						mvector3.add(door_central, door)
						number_of_doors = number_of_doors + 1
					elseif alive(door) and not door:is_obstructed() then
						local nl_element = door:script_data().element
						local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)

						if nl_tracker:nav_segment() == from_seg_id then
							table.insert(found_doors, {
								center = nl_element:value("position"),
								end_pos = nl_element:nav_link_end_pos()
							})
						end

						self:destroy_nav_tracker(nl_tracker)
					end
				end

				if number_of_doors > 0 then
					mvector3.divide(door_central, number_of_doors)

					table.insert(found_doors, {
						center = door_central
					})
				end
			else
				for _, door in ipairs(door_list) do
					if door.x then
						table.insert(found_doors, door)
					elseif alive(door) and not door:is_obstructed() then
						local nl_element = door:script_data().element
						local nl_tracker = self._quad_field:create_nav_tracker(nl_element:value("position"), true)

						if nl_tracker:nav_segment() == from_seg_id then
							table.insert(found_doors, {
								center = nl_element:value("position"),
								end_pos = nl_element:nav_link_end_pos()
							})
						end

						self:destroy_nav_tracker(nl_tracker)
					end
				end
			end
		end
	end

	return found_doors
end

function NavigationManager:get_nav_segments_in_direction(from_seg_id, dir)
	local result = {}
	local from_seg = self._nav_segments[from_seg_id]

	if not from_seg or not dir then
		return result
	end

	local to_neighbour = Vector3()

	for neighbour_id in pairs(from_seg.neighbours or {}) do
		local neighbour = self._nav_segments[neighbour_id]

		if neighbour and neighbour.pos then
			mvec3_dir(to_neighbour, from_seg.pos, neighbour.pos)

			if mvector3.dot(to_neighbour, dir) >= 0 then
				result[neighbour_id] = true
			end
		end
	end

	return result
end


function NavigationManager:draw_coarse_path(path, alt_color)
	if not path then
		return
	end
	
	local all_nav_segs = self._nav_segments
	
	local line1 = Draw:brush(Color.red:with_alpha(0.5), 5)
	local line2 = Draw:brush(Color.blue:with_alpha(0.5), 5)
	
	if alt_color then
		for path_i = 1, #path do
			local seg_pos = all_nav_segs[path[path_i][1]].pos
			line2:cylinder(seg_pos, seg_pos + math_up * 185, 10)
			
			if path[path_i - 1] then
				local prev_seg_pos = all_nav_segs[path[path_i - 1][1]].pos
				line2:cylinder(prev_seg_pos, seg_pos, 10)
			end
		end
	else
		for path_i = 1, #path do
			local seg_pos = all_nav_segs[path[path_i][1]].pos
			line1:cylinder(seg_pos, seg_pos + math_up * 185, 20)
		end
	end
end

function NavigationManager:generate_cover_fwd(tracker, door_list)
	local all_nav_segs = self._nav_segments
	local m_seg_id = tracker:nav_segment()
	
	if all_nav_segs[m_seg_id] then
		local new_fwd = temp_vec1
		local v3_dis_sq = mvec3_dis_sq
		local doors = door_list or self:find_segment_doors(m_seg_id, nil, true)
		local best_door_pos = all_nav_segs[m_seg_id].pos
		local field_pos = tracker:field_position()
		local best_door_dis = nil
		local best_door_has_ray = nil
		local best_door_is_navlink = nil
		local second_best_pos = nil
		
		for i = 1, #doors do
			local door = doors[i]
			local door_on_z = door.center:with_z(field_pos.z)			
			local dis = v3_dis_sq(field_pos, door_on_z)			
			
			local ray = door.end_pos and true or self:raycast({pos_from = field_pos, pos_to = door_on_z})
				
			if (not best_door_dis or dis < best_door_dis) and (not best_door_has_ray or ray) then
				second_best_pos = best_door_pos
				
				if door.end_pos then
					best_door_pos = door.end_pos:with_z(field_pos.z)
					best_door_is_navlink = true
				else
					best_door_pos = door_on_z
					best_door_is_navlink = nil
				end
				
				best_door_dis = dis
				best_door_has_ray = ray
			end
		end
		
		mvec3_dir(new_fwd, field_pos, best_door_pos)
		
		-- A candidate standing on the seed point yields a zero-length (or NaN)
		-- direction; use a random yaw so the 12-ray sweep still samples.
		local seed_len = mvec3_length(new_fwd)
		
		if seed_len < 0.01 or seed_len ~= seed_len then
			mvec3_set(new_fwd, Vector3(1, 0, 0))
			mvec3_rot(new_fwd, Rotation(math.random() * 360))
		end
		
		local ray_params = {
			pos_from = field_pos
		}
		local hits = {}
		
		local rot_with = mvector3.rotate_with
		
		local fwd_test = temp_vec2
		
		local nr_rotations = 12
		local angle = 108 / nr_rotations
		rot_with(new_fwd, Rotation(-54))

		for i = 1, nr_rotations do
			mvec3_set(fwd_test, new_fwd)
			mvec3_mul(fwd_test, 100)
			mvec3_add(fwd_test, field_pos)
			ray_params.pos_to = fwd_test
			
			if self:raycast(ray_params) then
				local cover_pos = field_pos
				local ray_from = temp_vec3

				mvec3_set(ray_from, math_up)
				mvec3_mul(ray_from, 90)
				mvec3_add(ray_from, cover_pos)
				
				local ray_to_pos = temp_vec4
				
				mvec3_set(ray_to_pos, math_up)
				mvec3_mul(ray_to_pos, 90)
				mvec3_add(ray_to_pos, fwd_test)
				
				if World:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report") then	
					if i == 6 then --perfect match.
						return mvec3_cpy(new_fwd)
					else
						hits[#hits + 1] = {mvec3_cpy(new_fwd), angle * i}
					end
				end
			end
			
			if i < nr_rotations then
				rot_with(new_fwd, Rotation(angle))
			end
		end
		
		local best_angle, best_hit
		
		if #hits > 0 then
			for i = 1, #hits do
				local hit = hits[i]
				local diff = math_abs(hit[2])
				
				if not best_angle or diff < best_angle or diff == best_angle and math.random() <= 0.5 then
					best_hit = hit[1]
					best_angle = diff
				end
			end
			
			return best_hit
		end
		
		if second_best_pos then
			hits = {}
			mvec3_dir(new_fwd, field_pos, second_best_pos)
			rot_with(new_fwd, Rotation(-54))
			
			for i = 1, nr_rotations do
				mvec3_set(fwd_test, new_fwd)
				mvec3_mul(fwd_test, 100)
				mvec3_add(fwd_test, field_pos)
				ray_params.pos_to = fwd_test
				
				if self:raycast(ray_params) then
					if i == 6 then --perfect match.
						return mvec3_cpy(new_fwd)
					else
						hits[#hits + 1] = {mvec3_cpy(new_fwd), angle * i}
					end
				end
				
				if i < nr_rotations then
					rot_with(new_fwd, Rotation(angle))
				end
			end
			
			local best_angle, best_hit
			
			if #hits > 0 then
				for i = 1, #hits do
					local hit = hits[i]
					local diff = math_abs(hit[2])
					
					if not best_angle or diff < best_angle or diff == best_angle and math.random() <= 0.5 then
						best_hit = hit[1]
						best_angle = diff
					end
				end
				
				return best_hit
			end
		end
		
		--literally nothing worked
		return false
	end
end

function NavigationManager:_draw_covers()
	local reserved = self.COVER_RESERVED
	local cone_height = Vector3(0, 0, 30)
	local arrow_height = Vector3(0, 0, 1)

	for i_cover, cover in ipairs(self._covers) do
		local draw_pos = cover[1]
		local tracker = cover[3]
		
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

		local fwd_pos = temp_vec1
		mvec3_set(fwd_pos, cover[2])
		mvec3_mul(fwd_pos, 100)
		mvec3_add(fwd_pos, draw_pos)

		Application:draw_line(draw_pos, fwd_pos, 1, 0, 0)

		if cover[reserved] then
			Application:draw_sphere(draw_pos, 30, 0, 0, 1)
		end
	end
end

function NavigationManager:register_cover_units()
	if not self:is_data_ready() then
		return
	end
	
	if not self._vis_check_slotmask then
		self._vis_check_slotmask = managers.slot:get_mask("AI_visibility") + managers.slot:get_mask("enemy_shield_check")
	end

	local covers = {}
	local cover_data = managers.worlddefinition:get_cover_data()
	local door_cache = {}

	if cover_data then
		local function _register_cover(pos, fwd)
			local nav_tracker = self._quad_field:create_nav_tracker(pos, true)

			if nav_tracker:lost() then
				self:destroy_nav_tracker(nav_tracker)
				return
			end

			local seg_id = nav_tracker:nav_segment()
			local room_nav_seg = self._nav_segments[seg_id]

			if not room_nav_seg or not room_nav_seg.pos then
				self:destroy_nav_tracker(nav_tracker)
				return
			end

			local doors = door_cache[seg_id]

			if not doors then
				doors = self:find_segment_doors(seg_id, nil, true)
				door_cache[seg_id] = doors
			end

			local navseg_tracker = self._quad_field:create_nav_tracker(room_nav_seg.pos, true)
			local field_pos = nav_tracker:field_position()
			local cover = {
				nav_tracker:field_position(),
				fwd,
				nav_tracker
			}
			
			local valid_fwd = self:generate_cover_fwd(nav_tracker, doors)
			
			if not valid_fwd or not self:check_cover_close_to_wall(field_pos) then
				self:destroy_nav_tracker(nav_tracker)
				self:destroy_nav_tracker(navseg_tracker)
				return
			end

			local location_script_data = self._quad_field:get_script_data(navseg_tracker, true)

			if not location_script_data.covers then
				location_script_data.covers = {}
			end

			t_ins(location_script_data.covers, cover)
			t_ins(covers, cover)
			
			self:destroy_nav_tracker(navseg_tracker)
		end

		local tmp_rot = Rotation(0, 0, 0)

		if cover_data.rotations then
			local rotations = cover_data.rotations

			for i, yaw in ipairs(cover_data.rotations) do
				mrotation.set_yaw_pitch_roll(tmp_rot, yaw, 0, 0)
				mrotation.y(tmp_rot, temp_vec1)
				_register_cover(cover_data.positions[i], mvector3.copy(temp_vec1))
			end
		else
			for _, cover_desc in ipairs(cover_data) do
				mrotation.set_yaw_pitch_roll(tmp_rot, cover_desc[2], 0, 0)
				mrotation.y(tmp_rot, temp_vec1)
				_register_cover(cover_desc[1], mvector3.copy(temp_vec1))
			end
		end
	else
		local all_cover_units = World:find_units_quick("all", managers.slot:get_mask("cover"))

		for i, unit in ipairs(all_cover_units) do
			local pos = unit:position()
			local fwd = unit:rotation():y()
			local nav_tracker = self._quad_field:create_nav_tracker(pos, true)
			local cover = {
				nav_tracker:field_position(),
				fwd,
				nav_tracker,
				true
			}

			t_ins(covers, cover)
			local location_script_data = self._quad_field:get_script_data(nav_tracker)

			if not location_script_data.covers then
				location_script_data.covers = {}
			end

			t_ins(location_script_data.covers, cover)
			self:_safe_remove_unit(unit)
		end
	end
	
	self._covers = covers
	
	if not self.has_registered_cover_units_for_LIES then
		if #self._covers > 0 then
			self.has_registered_cover_units_for_LIES = true
			log("LIES: " .. tostring(#self._covers) .. " cover points.")
		else
			self.has_registered_cover_units_for_LIES = true
			log("LIES: Map has no cover points. ...How!?")
		end
	end
	
	self:_change_funcs()

	local ok, err = pcall(function()
		self:_schedule_LIES_cover_generation()
	end)

	if not ok then
		log("LIES: cover generation schedule failed: " .. tostring(err))
	end

	managers.enemy:add_delayed_clbk("NavigationManager._do_nav_fixes", callback(self, self, "_do_nav_fixes"), TimerManager:game():time() + 2)
end

function NavigationManager:insert_cover(covers_table, location_script_data, cover)
	if not covers_table or not location_script_data then
		return
	end
	
	t_ins(location_script_data.covers, cover)
	t_ins(covers_table, cover)
end

-- Nav-B: runtime cover generation rebuilt on nav v6 segments (248.2).
-- Algorithm, risks and probe design: dev/reports/nav-b-feasibility.md.
-- Delayed, sliced and host-only. Covers are visible to the LIES Lua search
-- only: 248.2 exposes no engine add_cover, so lua_cover < 2 must not pay for it.
local LIES_COVER_GEN_PER_SEGMENT = 16
local LIES_COVER_GEN_TOTAL_CAP = 2048
local LIES_COVER_GEN_SEGMENTS_PER_SLICE = 4
local LIES_COVER_GEN_CANDIDATES_PER_SLICE = 32
local LIES_COVER_GEN_DEDUPE_DIS = 90
local LIES_COVER_GEN_RANDOM_SAMPLES = 4
local LIES_COVER_GEN_MIN_CANDIDATES = 6
local LIES_COVER_GEN_FAN_RAYS = 8
local LIES_COVER_GEN_FAN_LENGTH = 1000
local LIES_COVER_GEN_WALL_RAYS = 8
local LIES_COVER_GEN_WALL_DIS = 100
local LIES_COVER_GEN_START_DELAY = 1
local LIES_COVER_GEN_SLICE_DELAY = 0.1
local LIES_COVER_GEN_CLBK_ID = "NavigationManager.LIES_cover_gen"

local function _lies_cover_mode()
	local mode = LIES and LIES.settings and LIES.settings.lua_cover
	
	if type(mode) ~= "number" then
		return mode and 2 or 1
	end
	
	return mode
end

local function _lies_grid_key(x, y)
	return x .. ":" .. y
end

local function _lies_cover_too_close(grid, pos, dis)
	dis = dis or LIES_COVER_GEN_DEDUPE_DIS
	local gx = math_floor(pos.x / dis)
	local gy = math_floor(pos.y / dis)
	local dis_sq = dis * dis
	
	for x = gx - 1, gx + 1 do
		for y = gy - 1, gy + 1 do
			local bucket = grid[_lies_grid_key(x, y)]
			
			if bucket then
				for i = 1, #bucket do
					if mvec3_dis_sq(pos, bucket[i]) <= dis_sq then
						return true
					end
				end
			end
		end
	end
	
	return false
end

local function _lies_cover_grid_add(grid, pos, dis)
	dis = dis or LIES_COVER_GEN_DEDUPE_DIS
	local key = _lies_grid_key(math_floor(pos.x / dis), math_floor(pos.y / dis))
	local bucket = grid[key]
	
	if not bucket then
		bucket = {}
		grid[key] = bucket
	end
	
	bucket[#bucket + 1] = pos
end

function NavigationManager:_LIES_cover_gen_state_new(dry_run, nsegs, ncands)
	self._LIES_cover_gen_by_seg = self._LIES_cover_gen_by_seg or {}

	if not self._LIES_cover_gen_key_type_checked then
		self._LIES_cover_gen_key_type_checked = true
		local first_key = next(self._nav_segments)
		
		if first_key ~= nil and type(first_key) ~= "string" then
			log("LIES: cover gen expected string nav segment keys, got " .. type(first_key) .. " (" .. tostring(first_key) .. "); tracker:nav_segment() is compared against these keys.")
		end
	end
	
	local queue = {}
	
	for seg_id, seg in pairs(self._nav_segments) do
		if seg.pos and seg.neighbours and next(seg.neighbours) then
			queue[#queue + 1] = seg_id
		end
	end
	
	table.sort(queue, function(a, b)
		return tostring(a) < tostring(b)
	end)
	
	local state = {
		token = self._LIES_cover_gen_token,
		dry_run = dry_run and true or false,
		queue = queue,
		cursor = 1,
		segments_requested = nsegs or #queue,
		segments_done = 0,
		ncands = ncands or LIES_COVER_GEN_PER_SEGMENT,
		total_limit = math.min(LIES_COVER_GEN_PER_SEGMENT * table.size(self._nav_segments), LIES_COVER_GEN_TOTAL_CAP),
		grid = {},
		door_cache = {},
		seg_inserted = {},
		sample_arg = nil,
		sample_failures = 0,
		first_seg_id = nil,
		first_seg_type = nil,
		started_t = TimerManager:game():time(),
		candidates = 0,
		door_centers = 0,
		samples = 0,
		fan_hits = 0,
		tracker_lost = 0,
		tracker_ok = 0,
		seg_match = 0,
		seg_mismatch = 0,
		dedupe_skip = 0,
		wall_ok = 0,
		wall_fail = 0,
		fwd_ok = 0,
		fwd_fail = 0,
		valid = 0,
		inserted = 0,
		segments_full = 0,
		script_covers_max = 0,
		limit_reached = nil
	}
	
	-- Seed the per-segment counters from earlier passes on this nav field.
	for i = 1, #queue do
		local seg_id = queue[i]
		state.seg_inserted[seg_id] = self._LIES_cover_gen_by_seg[seg_id] or 0
	end
	
	-- Seed the dedupe grid with the covers Path A already registered so a
	-- generated cover never lands on top of a vanilla one.
	for i = 1, #self._covers do
		local cover = self._covers[i]
		
		if cover and cover[1] then
			_lies_cover_grid_add(state.grid, cover[1], LIES_COVER_GEN_DEDUPE_DIS)
		end
	end
	
	return state
end

function NavigationManager:_LIES_cover_gen_cover_total(state)
	return #self._covers + (state.dry_run and state.valid or 0)
end

function NavigationManager:_LIES_cover_gen_sample_position(state, seg_id, seg)
	if state.sample_arg == nil then
		state.sample_arg = "key"
	end
	
	local arg
	if state.sample_arg == "key" then
		arg = seg_id
	elseif state.sample_arg == "id" then
		arg = seg.id
	else
		return nil
	end
	
	if arg == nil then
		state.sample_arg = false
		
		return nil
	end
	
	-- The engine binding's argument form is undocumented in game Lua; try the
	-- string key first, then the numeric id, then give up (fan filler remains).
	local ok, pos = pcall(self._quad_field.random_position_in_nav_segment, self._quad_field, arg)
	
	if ok then
		if pos then
			return pos
		end
		
		state.sample_failures = state.sample_failures + 1
		
		return nil
	end
	
	state.sample_failures = state.sample_failures + 1
	state.sample_arg = state.sample_arg == "key" and "id" or false
	
	return nil
end

function NavigationManager:_LIES_cover_gen_collect_candidates(state, seg_id, seg, seg_tracker, doors)
	local candidates = {}
	local max_candidates = state.ncands
	local dedupe_sq = LIES_COVER_GEN_DEDUPE_DIS * LIES_COVER_GEN_DEDUPE_DIS
	
	local function _add(pos)
		if not pos or #candidates >= max_candidates then
			return
		end
		
		for i = 1, #candidates do
			if mvec3_dis_sq(pos, candidates[i]) <= dedupe_sq then
				return
			end
		end
		
		candidates[#candidates + 1] = mvec3_cpy(pos)
	end
	
	-- (a) Doorway centres: deterministic, matches the case generate_cover_fwd
	-- was written for, fed from the already-ported door lookup. Jitter into the
	-- segment so the cover does not sit inside the doorway opening.
	for i = 1, #doors do
		local center = doors[i].center

		if center then
			local angle = math.random() * math.pi * 2
			local dis = 60 + math.random() * 60

			_add(center + Vector3(math.cos(angle) * dis, math.sin(angle) * dis, 0))
		end
	end
	
	-- (b) Engine sampler: uniform walkable points inside this segment.
	for i = 1, LIES_COVER_GEN_RANDOM_SAMPLES do
		if #candidates >= max_candidates then
			break
		end
		
		local sample = self:_LIES_cover_gen_sample_position(state, seg_id, seg)
		
		if sample then
			state.samples = state.samples + 1
			_add(sample)
		end
	end
	
	-- (c) Radial wall scan from the segment centre, filler only: on maps where
	-- the sampler is sparse this still yields wall-adjacent points.
	if #candidates < LIES_COVER_GEN_MIN_CANDIDATES and #candidates < max_candidates then
		local fan_ref
		
		if #candidates > 0 then
			fan_ref = Vector3(candidates[1].x - seg.pos.x, candidates[1].y - seg.pos.y, 0)
		else
			fan_ref = Vector3(1, 0, 0)
			mvec3_rot(fan_ref, Rotation(math.random() * 360))
		end
		
		local fan_len = mvec3_length(fan_ref)
		
		if fan_len < 0.01 or fan_len ~= fan_len then
			fan_ref = Vector3(1, 0, 0)
			mvec3_rot(fan_ref, Rotation(math.random() * 360))
		else
			mvec3_set_l(fan_ref, LIES_COVER_GEN_FAN_LENGTH)
		end
		
		local wall_positions = self:find_walls_accross_tracker(seg_tracker, fan_ref, 360, LIES_COVER_GEN_FAN_RAYS)
		
		if wall_positions then
			for i = 1, #wall_positions do
				local hit_pos = wall_positions[i] and wall_positions[i][1]
				
				if hit_pos then
					state.fan_hits = state.fan_hits + 1
					_add(hit_pos)
				end
			end
		end
	end
	
	return candidates
end

function NavigationManager:_LIES_cover_gen_try_candidate(state, seg_id, candidate, location_script_data, doors)
	state.candidates = state.candidates + 1
	
	local tracker = self._quad_field:create_nav_tracker(candidate, true)
	
	if not tracker then
		state.tracker_lost = state.tracker_lost + 1
		
		return false
	end
	
	if tracker:lost() then
		state.tracker_lost = state.tracker_lost + 1
		self:destroy_nav_tracker(tracker)
		
		return false
	end
	
	state.tracker_ok = state.tracker_ok + 1
	
	local tracker_seg_id = tracker:nav_segment()
	
	if state.first_seg_id == nil then
		state.first_seg_id = tostring(seg_id)
		state.first_seg_type = type(tracker_seg_id)
	end
	
	if tracker_seg_id ~= seg_id then
		if not self._LIES_cover_gen_seg_type_warned and type(tracker_seg_id) ~= type(seg_id) then
			self._LIES_cover_gen_seg_type_warned = true
			log("LIES: cover gen segment key type mismatch: tracker:nav_segment() is " .. type(tracker_seg_id) .. ", _nav_segments key is " .. type(seg_id) .. ". Generation will insert nothing.")
		end
		
		state.seg_mismatch = state.seg_mismatch + 1
		self:destroy_nav_tracker(tracker)
		
		return false
	end
	
	state.seg_match = state.seg_match + 1
	
	local field_pos = mvec3_cpy(tracker:field_position())
	
	if _lies_cover_too_close(state.grid, field_pos, LIES_COVER_GEN_DEDUPE_DIS) then
		state.dedupe_skip = state.dedupe_skip + 1
		self:destroy_nav_tracker(tracker)
		
		return false
	end
	
	if not self:check_cover_close_to_wall(field_pos, LIES_COVER_GEN_WALL_RAYS, LIES_COVER_GEN_WALL_DIS) then
		state.wall_fail = state.wall_fail + 1
		self:destroy_nav_tracker(tracker)
		
		return false
	end
	
	state.wall_ok = state.wall_ok + 1
	
	local fwd = self:generate_cover_fwd(tracker, doors)
	
	if not fwd then
		state.fwd_fail = state.fwd_fail + 1
		self:destroy_nav_tracker(tracker)
		
		return false
	end
	
	state.fwd_ok = state.fwd_ok + 1
	state.valid = state.valid + 1
	
	if state.dry_run then
		-- Probe: reserve the spot for dedupe realism, ship nothing.
		_lies_cover_grid_add(state.grid, field_pos, LIES_COVER_GEN_DEDUPE_DIS)
		self:destroy_nav_tracker(tracker)
		
		return true
	end
	
	local cover = {
		field_pos,
		mvec3_cpy(fwd),
		tracker
	}
	
	self:insert_cover(self._covers, location_script_data, cover)
	_lies_cover_grid_add(state.grid, field_pos, LIES_COVER_GEN_DEDUPE_DIS)
	state.inserted = state.inserted + 1
	
	return true
end

function NavigationManager:_LIES_cover_gen_process_segment(state, seg_id)
	local seg = self._nav_segments[seg_id]
	
	if not seg or not seg.pos then
		return
	end
	
	local seg_tracker = self._quad_field:create_nav_tracker(seg.pos, true)
	
	if not seg_tracker or seg_tracker:lost() then
		if seg_tracker then
			self:destroy_nav_tracker(seg_tracker)
		end
		
		state.tracker_lost = state.tracker_lost + 1
		
		return
	end
	
	local location_script_data = self._quad_field:get_script_data(seg_tracker, true)
	
	if not location_script_data then
		self:destroy_nav_tracker(seg_tracker)
		
		return
	end
	
	if not location_script_data.covers then
		location_script_data.covers = {}
	end
	
	state.script_covers_max = math.max(state.script_covers_max, #location_script_data.covers)
	
	local seg_inserted = state.seg_inserted[seg_id] or 0
	
	if seg_inserted >= LIES_COVER_GEN_PER_SEGMENT then
		state.segments_full = state.segments_full + 1
		self:destroy_nav_tracker(seg_tracker)
		
		return
	end
	
	local doors = state.door_cache[seg_id]
	
	if not doors then
		doors = self:find_segment_doors(seg_id, nil, true)
		state.door_cache[seg_id] = doors
	end
	
	state.door_centers = state.door_centers + #doors
	
	local candidates = self:_LIES_cover_gen_collect_candidates(state, seg_id, seg, seg_tracker, doors)
	
	self:destroy_nav_tracker(seg_tracker)
	
	local seg_cover_count = seg_inserted
	
	for i = 1, #candidates do
		if seg_cover_count >= LIES_COVER_GEN_PER_SEGMENT then
			break
		end
		
		if self:_LIES_cover_gen_cover_total(state) >= state.total_limit then
			state.limit_reached = true
			
			break
		end
		
		if self:_LIES_cover_gen_try_candidate(state, seg_id, candidates[i], location_script_data, doors) then
			seg_cover_count = seg_cover_count + 1
			state.seg_inserted[seg_id] = seg_cover_count
			self._LIES_cover_gen_by_seg[seg_id] = seg_cover_count
		end
	end
end

function NavigationManager:_LIES_cover_gen_log(state, reason)
	local elapsed_ms = 0
	
	if TimerManager and TimerManager.game then
		local ok, t = pcall(function()
			return TimerManager:game():time()
		end)
		
		if ok and t then
			elapsed_ms = (t - state.started_t) * 1000
		end
	end
	
	log(string.format(
		"LIES: cover gen %s %s segs=%d/%d queue_left=%d seg0=%s seg0_type=%s cands=%d door_centers=%d samples=%d fan_hits=%d tracker_ok=%d seg_match=%d seg_mismatch=%d dedupe_skip=%d wall_ok=%d wall_fail=%d fwd_ok=%d fwd_fail=%d valid=%d inserted=%d covers=%d/%d per_seg=%d script_max=%d sample_fail=%d elapsed_ms=%.0f",
		state.dry_run and "probe" or "run",
		tostring(reason),
		state.segments_done,
		state.segments_requested,
		math.max(#state.queue - state.cursor + 1, 0),
		tostring(state.first_seg_id),
		tostring(state.first_seg_type),
		state.candidates,
		state.door_centers,
		state.samples,
		state.fan_hits,
		state.tracker_ok,
		state.seg_match,
		state.seg_mismatch,
		state.dedupe_skip,
		state.wall_ok,
		state.wall_fail,
		state.fwd_ok,
		state.fwd_fail,
		state.valid,
		state.inserted,
		#self._covers,
		state.total_limit,
		LIES_COVER_GEN_PER_SEGMENT,
		state.script_covers_max,
		state.sample_failures,
		elapsed_ms
	))
end

function NavigationManager:_LIES_cover_gen_step(token)
	local state = self._LIES_cover_gen_state
	
	if not state or state.token ~= token or self._LIES_cover_gen_token ~= token then
		return
	end
	
	if not self:is_data_ready() then
		self:_LIES_cover_gen_log(state, "not_ready")
		self._LIES_cover_gen_state = nil
		
		return
	end
	
	local processed = 0
	local candidates_used = 0
	
	while processed < LIES_COVER_GEN_SEGMENTS_PER_SLICE and state.segments_done < state.segments_requested and state.cursor <= #state.queue do
		if self:_LIES_cover_gen_cover_total(state) >= state.total_limit then
			state.limit_reached = true
			
			break
		end
		
		local seg_id = state.queue[state.cursor]
		local candidates_before = state.candidates
		
		state.cursor = state.cursor + 1
		processed = processed + 1
		
		self:_LIES_cover_gen_process_segment(state, seg_id)
		
		candidates_used = candidates_used + (state.candidates - candidates_before)
		state.segments_done = state.segments_done + 1
		
		if candidates_used >= LIES_COVER_GEN_CANDIDATES_PER_SLICE then
			break
		end
	end
	
	local finished = state.limit_reached or state.segments_done >= state.segments_requested or state.cursor > #state.queue
	
	if finished then
		self:_LIES_cover_gen_log(state, state.limit_reached and "limit" or "done")
		self._LIES_cover_gen_state = nil
		
		return
	end
	
	if state.dry_run then
		return
	end
	
	managers.enemy:add_delayed_clbk(LIES_COVER_GEN_CLBK_ID, callback(self, self, "_LIES_cover_gen_step", token), TimerManager:game():time() + LIES_COVER_GEN_SLICE_DELAY)
end

function NavigationManager:_LIES_cover_gen_remove_pending()
	if not (managers.enemy and managers.enemy.is_clbk_registered and managers.enemy.remove_delayed_clbk) then
		return
	end

	pcall(function()
		if managers.enemy:is_clbk_registered(LIES_COVER_GEN_CLBK_ID) then
			managers.enemy:remove_delayed_clbk(LIES_COVER_GEN_CLBK_ID)
		end
	end)
end

function NavigationManager:_LIES_cover_gen_abort()
	self._LIES_cover_gen_token = (self._LIES_cover_gen_token or 0) + 1
	self._LIES_cover_gen_state = nil
	self._LIES_cover_gen_by_seg = {}
	self:_LIES_cover_gen_remove_pending()
end

function NavigationManager:_LIES_cover_gen_start(dry_run, nsegs, ncands)
	if not self:is_data_ready() then
		return
	end
	
	self._LIES_cover_gen_token = (self._LIES_cover_gen_token or 0) + 1
	self._LIES_cover_gen_state = nil
	self:_LIES_cover_gen_remove_pending()

	local state = self:_LIES_cover_gen_state_new(dry_run, nsegs, ncands)
	
	self._LIES_cover_gen_state = state
	
	if dry_run then
		-- Probe: synchronous, bounded by the requested segment count.
		while self._LIES_cover_gen_state == state do
			local cursor_before = state.cursor
			
			self:_LIES_cover_gen_step(state.token)
			
			if self._LIES_cover_gen_state == state and state.cursor == cursor_before then
				self:_LIES_cover_gen_log(state, "stalled")
				self._LIES_cover_gen_state = nil
			end
		end
	else
		managers.enemy:add_delayed_clbk(LIES_COVER_GEN_CLBK_ID, callback(self, self, "_LIES_cover_gen_step", state.token), TimerManager:game():time() + LIES_COVER_GEN_START_DELAY)
	end
end

function NavigationManager:_schedule_LIES_cover_generation()
	if not Network:is_server() then
		return
	end
	
	if _lies_cover_mode() < 2 then
		return
	end
	
	self:_LIES_cover_gen_start(false, nil, LIES_COVER_GEN_PER_SEGMENT)
end

local nav_fixes_on_init = {
	red2 = { --fwb fix vault door open obstacle delays
		[101658] = function (self)
			local vault_blocker_id = 102362
			for i = 1, #self._values.on_executed do
				local on_executed_params = self._values.on_executed[i]
				
				if on_executed_params.id == vault_blocker_id then
					on_executed_params.delay = 10
					
					break
				end
			end
		end
	}
}

function NavigationManager:_do_nav_fixes()
	if nav_fixes_on_init[Global.level_data.level_id] then
		local stuff = nav_fixes_on_init[Global.level_data.level_id]
		
		for id, func in pairs(stuff) do
			local element
			
			for _, data in pairs(managers.mission._scripts) do
				element = data:element(id)
				
				if element then
					break
				end
			end
			
			if element then
				func(element)
			end
		end
	end
end

Hooks:PostHook(NavigationManager, "update", "lies_cover", function(self, t, dt)
	self:_update_LIES_cached_paths(t)

	--self:_draw_covers()
	--self:_draw_anim_nav_links()
	--self:_draw_coarse_graph()
	--self:_draw_coarse_graph_areas()
end)

Hooks:PostHook(NavigationManager, "_unregister_cover_units", "LIES_nav_gen_abort_unregister", function(self)
	self:_LIES_cover_gen_abort()
end)

Hooks:PostHook(NavigationManager, "_clear", "LIES_nav_gen_abort_clear", function(self)
	self:_LIES_cover_gen_abort()
end)

function NavigationManager:_add_LIES_cached_path(cached_path_data)
	if not self._cached_paths then
		self._cached_paths = {}
	end
	
	self._cached_paths[#self._cached_paths + 1] = cached_path_data
end

function NavigationManager:_update_LIES_cached_paths(t)
	if not self._cached_paths then
		self._cached_paths = {}
	end
	
	if #self._cached_paths == 0 then
		return
	end
	
	for i = #self._cached_paths, 1, -1 do
		local cached_path_data = self._cached_paths[i]

		if cached_path_data then
			if cached_path_data.invalidated or t - cached_path_data.last_useful_t > 60 then
				table.remove(self._cached_paths, i)
			end
		end
	end
end

function NavigationManager:_check_LIES_invalidated_navlink_cached_paths(element_id)
	if not self._cached_paths or #self._cached_paths == 0 then
		return
	end
	
	for i = 1, #self._cached_paths do
		local cached_path_data = self._cached_paths[i]
		
		if cached_path_data then
			local cached_path = cached_path_data.path
		
			for cached_path_i = 1, #cached_path do
				local check_navpoint = cached_path[cached_path_i]
				
				if not check_navpoint.x then
					if not alive(check_navpoint) or check_navpoint:script_data().element._id == element_id then
						cached_path_data.invalidated = true
						
						break
					end
				end
			end
		end
	end
end

local access_inclusions = {
	swat = {
		swat = true,
		taser = true,
		fbi = true,
		spooc = true
	},
	cop = {
		cop = true,
		swat = true,
		taser = true,
		fbi = true,
		spooc = true
	},
	fbi = {
		swat = true,
		taser = true,
		fbi = true,
		spooc = true
	}
}

function NavigationManager:search_pos_to_pos(params)
	if params.access_pos then
		params.blocked_nav_segs = params.access_pos
	end
	
	local start_pos, end_pos
	
	if params.tracker_from then
		start_pos = params.tracker_from:field_position()
	elseif params.pos_from then
		start_pos = params.pos_from
	end
	
	if params.tracker_to then
		end_pos = params.tracker_to:field_position()
	elseif params.pos_to then
		end_pos = params.pos_to
	end
	
	if LIES:_path_is_straight_line(start_pos, end_pos) then
		local path = {
			start_pos,
			end_pos
		}
		
		--managers.navigation:draw_path(path, nil, nil, 5)
		local result_clbk = params.result_clbk
		result_clbk(path, true)
		
		return
	elseif self._cached_paths and #self._cached_paths > 0 then
		local t = TimerManager:game():time()
	
		for i = 1, #self._cached_paths do
			local cached_path_info = self._cached_paths[i]
			
			local inclusions = access_inclusions[cached_path_info.access_pos_str]
			
			if not cached_path_info.invalidated and LIES:_path_is_straight_line(start_pos, cached_path_info.start_pos) and LIES:_path_is_straight_line(end_pos, cached_path_info.end_pos) and (inclusions and inclusions[params.access_pos_str] == true or cached_path_info.access_pos_str == params.access_pos_str) then
				local good_path = true
				
				for cached_path_i = 1, #cached_path_info.path do
					local check_navpoint = cached_path_info.path[cached_path_i]

					if check_navpoint.x and params.nav_segs then
						local check_seg = self:get_nav_seg_from_pos(check_navpoint, true)
						
						if not params.nav_segs[check_seg] then
							good_path = false
							
							break
						end
					elseif not check_navpoint.x and (not alive(check_navpoint) or check_navpoint:delay_time() > t) then
						good_path = false
						
						break
					end
				end

				if good_path then
					cached_path_info.last_useful_t = TimerManager:game():time()
				
					local result_path = {
						start_pos
					}
					
					--log(#cached_path_info.path)
					
					for cached_path_i = 1, #cached_path_info.path do
						result_path[#result_path + 1] = cached_path_info.path[cached_path_i]
					end
					
					result_path[#result_path + 1] = end_pos
					--managers.navigation:draw_path(result_path, nil, nil, 5)
					local result_clbk = params.result_clbk
					result_clbk(result_path, true)
					
					return
				end
			end
		end
	end

	self._quad_field:detailed_search(params)
end

function NavigationManager:draw_path(path, color_link, color_node, duration)
	if path then
		color_node = color_node and Color(unpack(color_node)) or Color(0.2, math.random(), math.random(), math.random())
		color_link = color_link and Color(unpack(color_link)) or Color(0.1, math.random(), math.random(), math.random())
		local brush_node = Draw:brush(color_node, duration)
		local brush_link = Draw:brush(color_link, duration)

		brush_node:sphere(CopActionWalk._nav_point_pos(path[1]), 15)

		for i = 2, #path do
			if path[i].x then
				brush_node:sphere(path[i], 8)

				if path[i - 1].x then
					brush_link:cylinder(path[i], path[i - 1], 5)
				else
					local prev_pos
					
					if path[i - 1].element then
						prev_pos = CopActionWalk._nav_point_pos(path[i - 1])
					else
						prev_pos = CopActionWalk._nav_point_pos(path[i - 1]:script_data())
					end
					
					brush_link:cylinder(path[i], prev_pos, 5)
				end
			else
				local nav_link = path[i]
				local start_pos, end_pos
				
				if nav_link.element then
					start_pos = CopActionWalk._nav_point_pos(nav_link)
					end_pos = start_pos + Rotation(path[i].element:value("rotation"), 0, 0):y() * 100
				else
					start_pos = CopActionWalk._nav_point_pos(nav_link:script_data())
					end_pos = start_pos + Rotation(nav_link:script_data().element:value("rotation"), 0, 0):y() * 100
				end

				brush_node:sphere(start_pos, 8)
				brush_node:sphere(end_pos, 8)
				brush_link:cone(end_pos, start_pos, 30)
				
				if path[i - 1].x then
					brush_link:cylinder(start_pos, path[i - 1], 5)
				else
					local prev_pos
					
					if path[i - 1].element then
						prev_pos = CopActionWalk._nav_point_pos(path[i - 1])
					else
						prev_pos = CopActionWalk._nav_point_pos(path[i - 1]:script_data())
					end
				
					brush_link:cylinder(start_pos, prev_pos, 5)
				end
			end
		end
	end
end

function NavigationManager:add_obstacle(obstacle_unit, obstacle_obj_name)
	if self._debug then
		for i, obs_data in ipairs(self._obstacles) do
			if obstacle_unit == obs_data.unit and obstacle_obj_name == obs_data.obstacle_obj_name then
				debug_pause_unit(obstacle_unit, "[NavigationManager:add_obstacle] obstacle added twice", obstacle_unit, obstacle_obj_name)

				return
			end
		end
	end

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
	
	if self._cached_paths and #self._cached_paths > 0 then
		for i = 1, #self._cached_paths do
			local cached_path_data = self._cached_paths[i]
			
			if cached_path_data then
				local cached_path = cached_path_data.path
			
				for cached_path_i = 1, #cached_path do
					local check_navpoint = cached_path[cached_path_i]
					
					if check_navpoint.x then
						if obstacle_obj:inside_bv(check_navpoint) then
							cached_path_data.invalidated = true
							
							break
						end
					end
				end
			end
		end
	end
	
	local id = self._quad_field:add_obstacle(obstacle_obj)

	table.insert(self._obstacles, {
		unit = obstacle_unit,
		obstacle_obj_name = obstacle_obj_name,
		id = id
	})
end

local function convert_bastards(ai_group_name)
	if ai_group_name == "chavez" or ai_group_name == "bank_manager_old_man" or ai_group_name == "escort_guy_1" or ai_group_name == "escort_guy_2" or ai_group_name == "escort_guy_3" or ai_group_name == "escort_guy_5" then
		return "bastards"
	end
	
	return ai_group_name
end

local ai_groups_so_accesses = {
	friendlies = {
		teamAI1 = true,
		teamAI2 = true,
		teamAI3 = true,
		teamAI4 = true
	},
	enemies = {
		cop = true,
		security_patrol = true,
		shield = true,
		tank = true,
		security = true,
		gangster = true,
		swat = true,
		fbi = true,
		taser = true,
		sniper = true,
		murky = true,
		spooc = true
	},
	civilians = {
		civ_male = true,
		civ_female = true,
		SO_ID1 = true,
		SO_ID2 = true,
		SO_ID3 = true
	},
	bastards = {
		SO_ID1 = true
	},
	escort_guy_4 = {
		SO_ID2 = true
	},
	unique_patrol_forbid = {
		security_patrol = true
	}
}

function NavigationManager:set_nav_segment_state(id, state, filter_group)
	local unique_id = tostring(id)

	if not self._nav_segments[unique_id] then
		log("[NavigationManager:set_nav_segment_state] nonexistent nav_segment " .. tostring(unique_id))
		debug_pause("[NavigationManager:set_nav_segment_state] nonexistent nav_segment", unique_id)

		return
	end

	if state == "forbid_custom" then
		local access_filter = self:convert_SO_AI_group_to_access(filter_group)

		self._quad_field:set_nav_segment_blocked_filter(unique_id, access_filter)

		self._nav_segments[unique_id].blocked_group = filter_group
		
		if self._nav_segments[unique_id].blocked_group and self._cached_paths and #self._cached_paths > 0 then
			local so_ai_group = convert_bastards(filter_group)
			local bad_accesses = ai_groups_so_accesses[so_ai_group]
			
			if bad_accesses then
				for i = 1, #self._cached_paths do
					local cached_path_data = self._cached_paths[i]
					
					if cached_path_data and bad_accesses[cached_path_data.access_pos_str] then
						local cached_path = cached_path_data.path
					
						for cached_path_i = 1, #cached_path do
							local check_navpoint = cached_path[cached_path_i]
							
							if check_navpoint.x then
								local check_seg = self:get_nav_seg_from_pos(check_navpoint, true)
								
								if check_seg == unique_id then
									cached_path_data.invalidated = true
									--log("path invalidated")
									
									break
								end
							end
						end
					end
				end
			end
		end

		return
	end

	self._quad_field:set_nav_segment_blocked_filter(unique_id, 0)

	self._nav_segments[unique_id].blocked_group = nil
	local wanted_state = state == "allow_access" and true or false
	local cur_state = self._quad_field:is_nav_segment_enabled(unique_id)
	local seg_disabled_state = nil

	if not wanted_state then
		seg_disabled_state = true
	end

	self._nav_segments[unique_id].disabled = seg_disabled_state

	if wanted_state ~= cur_state then
		self._quad_field:set_nav_segment_enabled(unique_id, wanted_state)
		managers.groupai:state():on_nav_segment_state_change(unique_id, wanted_state)
	end
	
	if seg_disabled_state and self._cached_paths and #self._cached_paths > 0 then
		for i = 1, #self._cached_paths do
			local cached_path_data = self._cached_paths[i]
			
			if cached_path_data then
				local cached_path = cached_path_data.path
			
				for cached_path_i = 1, #cached_path do
					local check_navpoint = cached_path[cached_path_i]
					
					if check_navpoint.x then
						local check_seg = self:get_nav_seg_from_pos(check_navpoint, true)
						
						if check_seg == unique_id then
							cached_path_data.invalidated = true
							--log("path invalidated")
							
							break
						end
					end
				end
			end
		end
	end
end

function NavigationManager:_draw_coarse_graph_areas()
	if not managers.groupai:state()._area_data then
		return	
	end
	
	local all_areas = managers.groupai:state()._area_data 
	local cone_height = Vector3(0, 0, 50)
	local color = {
		0,
		1,
		1
	}
	
	for area_id, area_data in pairs(all_areas) do
		Application:draw_cone(area_data.pos, area_data.pos + cone_height, 40, unpack(color))
		local neighbours = area_data.neighbours

		for neighbour_id, neighbour_data in pairs(neighbours) do
			local pos = neighbour_data.pos
			
			Application:draw_cone(pos, area_data.pos, 12, unpack(color))
		end
	end
end



function NavigationManager:_change_funcs()
	if LIES.settings.lua_cover < 2 and self._funcs_replaced then
		log("LIES: Cover through LUA disabled.")
		self._funcs_replaced = nil
		self.find_cover_in_cone_from_threat_pos_1 = NavigationManager.find_cover_in_cone_from_threat_pos_1
		self.find_cover_from_threat = NavigationManager.find_cover_from_threat
		self.find_cover_in_nav_seg_3 = NavigationManager.find_cover_in_nav_seg_3
	elseif LIES.settings.lua_cover > 1 then
		-- Nav-A: custom Lua cover search over the v6-registered _covers.
		-- Cover *generation* is still Nav-B; search-only works on vanilla covers.
		log("LIES: Cover through LUA enabled. Mode: " .. tostring(LIES.settings.lua_cover - 1))
		self._funcs_replaced = true
		self.find_cover_in_cone_from_threat_pos_1 = self.find_cover_in_cone_from_threat_pos_1_LUA
		self.find_cover_from_threat = self.find_cover_from_threat_LUA
		self.find_cover_in_nav_seg_3 = self.find_cover_in_nav_seg_3_LUA
		
		if not self._vis_check_slotmask then
			self._vis_check_slotmask = managers.slot:get_mask("AI_visibility") + managers.slot:get_mask("enemy_shield_check")
		end
	end
end


function NavigationManager:find_cover_in_cone_from_threat_pos_1_LUA(threat_pos, furthest_pos, near_pos, search_from_pos, angle, min_dis, nav_seg, optimal_threat_dis, rsrv_filter)
	local v3_dis_sq = mvec3_dis_sq
	local world_g = World
	min_dis = min_dis and min_dis * min_dis or 0
	local nav_segs
	
	if type(nav_seg) == "table" then
		nav_segs = nav_seg
	elseif nav_seg then
		nav_segs = {[nav_seg] = true}
	end
	
	local best_cover, best_dist, best_l_ray, best_h_ray, best_has_good_dir
	
	local function _f_check_cover_rays(cover, threat_pos) --this is a visibility check. first checking for crouching positions, then standing.
		local cover_pos = cover[1]
		local ray_from = temp_vec1

		mvec3_set(ray_from, math_up)
		mvec3_mul(ray_from, 82.5)
		mvec3_add(ray_from, cover_pos)
		
		local ray_to_pos = temp_vec2
		
		mvec3_set(ray_to_pos, math_up)
		mvec3_mul(ray_to_pos, 82.5)
		mvec3_add(ray_to_pos, threat_pos)

		local low_ray = world_g:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report")
		local high_ray = nil

		if low_ray then
			mvec3_set_z(ray_from, ray_from.z + 67.5)
			mvec3_set_z(ray_to_pos, ray_to_pos.z + 67.5)

			high_ray = world_g:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report")
		end

		return low_ray, high_ray
	end
	
	for i = 1, #self._covers do
		local cover = self._covers[i]
		
		if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then
			if not nav_segs or nav_segs[cover[3]:nav_segment()] then
				local cover_dis = mvec3_dis_sq(near_pos, cover[1])
				local threat_dir = threat_pos - cover[1]
				local threat_dist = mvec3_length(threat_dir)
				threat_dist = threat_dist * threat_dist
				
				local threat_dir_norm = threat_dir:normalized()
				
				if min_dis < threat_dist then
					if optimal_threat_dis then
						cover_dis = cover_dis - optimal_threat_dis
					end
					
					if not best_dist or cover_dis < best_dist then
						if math.cos(cone_angle) > mvec3_dot(threat_dir_norm, furthest_pos) then
							--local has_good_rotation = mvec3_dot(threat_dir_norm, cover[2]) >= 0.7
							
							if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then
								local low_ray, high_ray
							
								if threat_pos then
									low_ray, high_ray = _f_check_cover_rays(cover, threat_pos)
								end
								
								if not best_l_ray or low_ray then
									if not best_h_ray or high_ray then
										best_l_ray = low_ray
										--best_has_good_dir = has_good_rotation
										best_h_ray = high_ray
										best_cover = cover
										best_dist = cover_dis
								
										if cover_dis <= 160000 and low_ray then
											break
										end
									end
								end
							end
						end
					end
				end
			end
		end
	end
	
	if best_cover then
		return best_cover
	end
end

function NavigationManager:find_cover_from_threat_LUA(nav_seg_id, optimal_threat_dis, near_pos, threat_pos)
	local v3_dis_sq = mvec3_dis_sq
	local world_g = World
	optimal_threat_dis = optimal_threat_dis and optimal_threat_dis * optimal_threat_dis or 0
	local nav_segs
	
	if type(nav_seg_id) == "table" then
		nav_segs = nav_seg_id
	elseif nav_seg_id then
		nav_segs = {[nav_seg_id] = true}
	end
	
	local best_cover, best_dist, best_l_ray, best_h_ray, best_has_good_dir
	
	local function _f_check_cover_rays(cover, threat_pos) --this is a visibility check. first checking for crouching positions, then standing.
		local cover_pos = cover[1]
		local ray_from = temp_vec1

		mvec3_set(ray_from, math_up)
		mvec3_mul(ray_from, 82.5)
		mvec3_add(ray_from, cover_pos)
		
		local ray_to_pos = temp_vec2
		
		mvec3_set(ray_to_pos, math_up)
		mvec3_mul(ray_to_pos, 82.5)
		mvec3_add(ray_to_pos, threat_pos)

		local low_ray = world_g:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report")
		local high_ray = nil

		if low_ray then
			mvec3_set_z(ray_from, ray_from.z + 67.5)
			mvec3_set_z(ray_to_pos, ray_to_pos.z + 67.5)

			high_ray = world_g:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report")
		end

		return low_ray, high_ray
	end
	
	for i = 1, #self._covers do
		local cover = self._covers[i]
		
		if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then
			if not nav_segs or nav_segs[cover[3]:nav_segment()] then
				local cover_dis = v3_dis_sq(near_pos, cover[1])
				local threat_dist
				
				if threat_pos then
					threat_dist = v3_dis_sq(cover[1], threat_pos)
				end

				if threat_dist and optimal_threat_dis then
					cover_dis = math.abs(threat_dist - optimal_threat_dis)
				end
					
				if not best_dist or cover_dis < best_dist then
					local threat_dir = temp_vec3
					--local has_good_rotation
					
					--if threat_pos then
						--mvec3_dir(threat_dir, cover[1], threat_pos)
						--has_good_rotation = mvec3_dot(threat_dir, cover[2]) >= 0.7
					--end
				
					if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then
						local low_ray, high_ray
						
						if threat_pos then
							low_ray, high_ray = _f_check_cover_rays(cover, threat_pos)
						end
						
						if not best_l_ray or low_ray then
							if not best_h_ray or high_ray then
								best_l_ray = low_ray
								best_h_ray = high_ray
								best_cover = cover
								--best_has_good_dir = has_good_rotation
								best_dist = cover_dis
						
								if cover_dis <= 160000 and low_ray then
									break
								end
							end
						end
					end
				end
			end
		end
	end
	
	if best_cover then
		return best_cover
	end
end

function NavigationManager:find_cover_in_nav_seg_3_LUA(nav_seg_id, max_near_dis, near_pos, threat_pos)
	local v3_dis_sq = mvec3_dis_sq
	local world_g = World
	min_dis = min_dis and min_dis * min_dis or 0

	max_near_dis = max_near_dis and max_near_dis * max_near_dis
	local nav_segs
	
	if type(nav_seg_id) == "table" then
		nav_segs = nav_seg_id
	elseif nav_seg_id then
		nav_segs = {[nav_seg_id] = true}
	end
	
	local best_cover, best_dist, best_l_ray, best_h_ray, best_z
	
	local function _f_check_cover_rays(cover, threat_pos) --this is a visibility check. first checking for crouching positions, then standing.
		local cover_pos = cover[1]
		local ray_from = temp_vec1

		mvec3_set(ray_from, math_up)
		mvec3_mul(ray_from, 82.5)
		mvec3_add(ray_from, cover_pos)
		
		local ray_to_pos = temp_vec2
		
		mvec3_set(ray_to_pos, math_up)
		mvec3_mul(ray_to_pos, 82.5)
		mvec3_add(ray_to_pos, threat_pos)

		local low_ray = world_g:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report")
		local high_ray = nil

		if low_ray then
			mvec3_set_z(ray_from, ray_from.z + 67.5)
			mvec3_set_z(ray_to_pos, ray_to_pos.z + 67.5)

			high_ray = world_g:raycast("ray", ray_from, ray_to_pos, "slot_mask", self._vis_check_slotmask, "ray_type", "ai_vision", "report")
		end

		return low_ray, high_ray
	end
	
	for i = 1, #self._covers do
		local cover = self._covers[i]
		
		if not cover[self.COVER_RESERVED] and self._quad_field:is_nav_segment_enabled(cover[3]:nav_segment()) and not cover[3]:obstructed() and not cover[3]:lost() then
			if not nav_segs or nav_segs[cover[3]:nav_segment()] then
				local cover_dis = mvec3_dis_sq(near_pos, cover[1])
				local threat_dist
				
				if threat_pos then
					threat_dist = v3_dis_sq(cover[1], threat_pos)
				end
				
				if not threat_dist or min_dis < threat_dist then
					if not max_near_dis or cover_dis < max_near_dis then
						if not best_dist or cover_dis < best_dist then
							local threat_dir = temp_vec3
							--local has_good_rotation
							
							--if threat_pos then
							--	mvec3_dir(threat_dir, cover[1], threat_pos)
							--	has_good_rotation = mvec3_dot(threat_dir, cover[2]) >= 0.7
							--end
							
							local z_diff = math.abs(cover[1].z - near_pos.z)
							local has_good_z = z_diff <= 250
							--local dir_check = has_good_rotation or not best_has_good_dir
							
							if has_good_z then
								if self._quad_field:is_position_unreserved({radius = 40, position = cover[1], filter = rsrv_filter}) then
									local low_ray, high_ray
								
									if threat_pos then
										low_ray, high_ray = _f_check_cover_rays(cover, threat_pos)
									end

									if not best_l_ray or low_ray then
										if not best_h_ray or high_ray then
											best_l_ray = low_ray
											best_h_ray = high_ray
											best_cover = cover
											best_dist = cover_dis
											--best_has_good_dir = has_good_rotation
									
											if cover_dis <= max_near_dis and (not threat_pos or low_ray and has_good_z) then
												break
											end
										end
									end
								end
							end
						end
					end
				end
			end
		end
	end
	
	if best_cover then
		return best_cover
	end
end

function NavigationManager:clamp_position_to_field(position)
	if not position then
		return
	end
	
	local position_tracker = self._quad_field:create_nav_tracker(position)
	
	local new_pos = position_tracker:field_position()
	
	self._quad_field:destroy_nav_tracker(position_tracker)

	return new_pos
end

function NavigationManager:pad_out_position(position, nr_rays, dis)
	nr_rays = math.max(2, nr_rays or 4)
	dis = dis or 46.5
	local angle = 360
	local rot_step = angle / nr_rays
	local rot_offset = 1 * angle * 0.5
	local ray_rot = Rotation(-angle * 0.5 + rot_offset - rot_step)
	local vec_to = Vector3(dis, 0, 0)

	mvec3_rot(vec_to, ray_rot)

	local pos_to = Vector3()

	mrotation.set_yaw_pitch_roll(ray_rot, rot_step, 0, 0)

	local ray_params = {
		trace = true,
		pos_from = position,
		pos_to = pos_to
	}
	local i_ray = 1
	local tmp_vec = temp_vec1
	local altered_pos = mvec3_cpy(position)
	--local line = Draw:brush(Color.red:with_alpha(0.5), 2)
	--local line2 = Draw:brush(Color.green:with_alpha(0.5), 2)
	
	for i = 1, nr_rays do
		mvec3_rot(vec_to, ray_rot)
		mvec3_set(pos_to, vec_to)
		mvec3_add(pos_to, position)
		local hit = self:raycast(ray_params)
		
		if hit then
			if line then
				line:cylinder(position, pos_to, 1)
			end
			
			mvec3_dir(tmp_vec, pos_to, position)
			mvec3_mul(tmp_vec, dis)
			mvec3_add(altered_pos, tmp_vec)
		elseif line2 then
			line2:cylinder(position, ray_params.trace[1]:with_z(position.z), 1)
		end
	end
	
	local altered_pos = altered_pos:with_z(position.z)
	local position_tracker = self._quad_field:create_nav_tracker(altered_pos, true)
	
	if not position_tracker:lost() then
		altered_pos = position_tracker:field_position()
	end

	self._quad_field:destroy_nav_tracker(position_tracker)
	
	if line and line2 then
		line2:sphere(position, 10)
		line:sphere(altered_pos, 10)
	end
	
	return altered_pos
end

function NavigationManager:check_cover_close_to_wall(position, nr_rays, dis)
	nr_rays = math.max(2, nr_rays or 8)
	dis = dis or 100
	local angle = 360
	local rot_step = angle / nr_rays
	local rot_offset = 1 * angle * 0.5
	local ray_rot = Rotation(-angle * 0.5 + rot_offset - rot_step)
	local vec_to = Vector3(dis, 0, 0)

	mvec3_rot(vec_to, ray_rot)

	local pos_to = Vector3()

	mrotation.set_yaw_pitch_roll(ray_rot, rot_step, 0, 0)

	local ray_params = {
		pos_from = position,
		pos_to = pos_to
	}
	local i_ray = 1
	local tmp_vec = temp_vec1
	--local line = Draw:brush(Color.red:with_alpha(0.5), 2)
	--local line2 = Draw:brush(Color.green:with_alpha(0.5), 2)
	--local hits = 0
	
	for i = 1, nr_rays do
		mvec3_rot(vec_to, ray_rot)
		mvec3_set(pos_to, vec_to)
		mvec3_add(pos_to, position)
		local hit = self:raycast(ray_params)
		
		if hit then
			return true
		end
	end
end



function NavigationManager:_execute_coarce_search(search_data)
	local search_id = search_data.id
	local i = 0

	while true do
		if i == 500 then
			debug_pause("[NavigationManager:_execute_coarce_search] endless loop", inspect(search_data))

			return false
		else
			i = i + 1
		end

		local next_search_seg = search_data.seg_to_search[#search_data.seg_to_search]
		local next_search_i_seg = next_search_seg.i_seg

		table.remove(search_data.seg_to_search)

		local all_nav_segments = self._nav_segments
		local neighbours = all_nav_segments[next_search_i_seg].neighbours

		if neighbours[search_data.end_i_seg] then
			local entry_found, nav_link_element, has_multiple_navlink_elements

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

			if entry_found then
				local i_seg = next_search_i_seg
				local this_seg = next_search_seg
				local prev_seg = search_data.end_i_seg
				local path = {
					{
						search_data.end_i_seg,
						search_data.to_pos,
						nav_link_element,
						has_multiple_navlink_elements
					}
				}

				table.insert(path, 1, {
					next_search_i_seg,
					next_search_seg.pos,
					next_search_seg.nav_link,
					next_search_seg.multiple_nav_links
				})

				local searched = search_data.seg_searched

				while this_seg.from do
					i_seg = this_seg.from
					this_seg = searched[i_seg]

					table.insert(path, 1, {
						i_seg,
						this_seg.pos,
						this_seg.nav_link,
						this_seg.multiple_nav_links
					})
				end

				return path
			end
		end
		
		local from_pos = next_search_seg.pos
		local to_pos = search_data.to_pos
		local new_segments = self:_sort_nav_segs_after_pos(to_pos, from_pos, next_search_i_seg, search_data.discovered_seg, search_data.verify_clbk, search_data.access_pos, search_data.access_neg)

		if new_segments then
			if search_data.access_pos then
				for i_seg, data in pairs(new_segments) do
					if self._quad_field:is_nav_segment_blocked(i_seg, search_data.access_pos) then
						new_segments[i_seg] = nil
					end
				end
			end

			local to_search = search_data.seg_to_search

			for i_seg, seg_data in pairs(new_segments) do
				local new_seg_weight = seg_data.weight
				local search_index = #to_search

				while search_index > 0 and to_search[search_index].weight < new_seg_weight do
					search_index = search_index - 1
				end

				table.insert(to_search, search_index + 1, seg_data)
			end
		end

		local nr_seg_to_search = #search_data.seg_to_search

		if nr_seg_to_search == 0 then
			return false
		else
			search_data.seg_searched[next_search_i_seg] = next_search_seg
		end
	end
end

function NavigationManager:_sort_nav_segs_after_pos(to_pos, from_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)
	local all_segs = self._nav_segments
	local seg = all_segs[i_seg]
	local neighbours = seg.neighbours
	from_pos = from_pos or seg.pos
	local found_segs = nil

	for neighbour_seg_id, door_list in pairs(neighbours) do
		if not ignore_seg[neighbour_seg_id] and not all_segs[neighbour_seg_id].disabled and (not verify_clbk or verify_clbk(neighbour_seg_id)) then
			for _, door in ipairs(door_list) do
				local door_pos, nav_link

				if door.x then
					door_pos = door
				elseif alive(door) and not door:is_obstructed() and door:check_access(access_pos, access_neg) then
					door_pos = door:script_data().element:nav_link_end_pos()
					nav_link = door
				end

				if door_pos then
					local weight = mvec3_dis(from_pos, door_pos) + mvec3_dis(door_pos, to_pos)
					local segment_data = {
						weight = weight,
						from = i_seg,
						i_seg = neighbour_seg_id,
						pos = door_pos,
						nav_link = nav_link
					}

					if found_segs then
						if found_segs[neighbour_seg_id] then
							if weight < found_segs[neighbour_seg_id].weight then
								found_segs[neighbour_seg_id] = segment_data
							end
						else
							found_segs[neighbour_seg_id] = segment_data
							ignore_seg[neighbour_seg_id] = true
						end
					else
						found_segs = {
							[neighbour_seg_id] = segment_data
						}
						ignore_seg[neighbour_seg_id] = true
					end
				end
			end
		end
	end

	return found_segs
end

function NavigationManager:find_walls_across_pos(pos, across_vec, angle, nr_rays)
	local from_tracker = self._quad_field:create_nav_tracker(pos)
	angle = angle or 180
	local center_pos = from_tracker:field_position()
	nr_rays = math.max(2, nr_rays or 4)
	local rot_step = angle / (nr_rays - 1)
	local rot_offset = (math.random() * 2 - 1) * angle * 0.5
	local ray_rot = Rotation(-angle * 0.5 + rot_offset - rot_step)
	local vec_to = Vector3(across_vec.x, across_vec.y)

	mvec3_rot(vec_to, ray_rot)

	local pos_to = Vector3()

	mrotation.set_yaw_pitch_roll(ray_rot, rot_step, 0, 0)

	local tracker_from, pos_from = nil

	if from_tracker:lost() then
		pos_from = center_pos
	else
		tracker_from = from_tracker
	end

	local ray_params = {
		trace = true,
		tracker_from = tracker_from,
		pos_from = pos_from,
		pos_to = pos_to
	}
	local ray_results = {}
	local i_ray = 1

	while nr_rays >= i_ray do
		mvec3_rot(vec_to, ray_rot)
		mvec3_set(pos_to, vec_to)
		mvec3_add(pos_to, center_pos)

		local hit = self:raycast(ray_params)

		if hit then
			table.insert(ray_results, {
				ray_params.trace[1],
				true
			})
		else
			table.insert(ray_results, {
				ray_params.trace[1]
			})
		end

		i_ray = i_ray + 1
	end
	
	self._quad_field:destroy_nav_tracker(from_tracker)
	
	return #ray_results > 0 and ray_results
end

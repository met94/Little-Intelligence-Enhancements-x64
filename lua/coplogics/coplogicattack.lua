local mvec3_set = mvector3.set
local mvec3_add = mvector3.add
local mvec3_mul = mvector3.multiply
local mvec3_set_z = mvector3.set_z
local mvec3_sub = mvector3.subtract
local mvec3_dir = mvector3.direction
local mvec3_set_len = mvector3.set_length
local mvec3_dot = mvector3.dot
local mvec3_dis = mvector3.distance
local mvec3_dis_sq = mvector3.distance_sq
local mvec3_lerp = mvector3.lerp
local mvec3_norm = mvector3.normalize
local temp_vec1 = Vector3()
local temp_vec2 = Vector3()
local temp_vec3 = Vector3()

-- Trace window per call: spooc paths crash in ways that need sub-second detail.
-- These must stay local vars before every function that uses them, otherwise the
-- earlier call sites resolve to globals (nil).
local function lies_trace_window(data)
	if data and data.unit and data.unit:base() and data.unit:base()._tweak_table == "spooc" then
		return 0.2
	end
end

local function lies_aim_window(data)
	if data and data.unit and data.unit:base() and data.unit:base()._tweak_table == "spooc" then
		return 1
	end
end

-- The enemy's nav tracker is destroyed together with the enemy unit
-- (`CopMovement:pre_destroy` -> `NavigationManager:destroy_nav_tracker`), while
-- the attention object keeps the pointer (`AIAttentionObject:_register` stored
-- `unit:movement():nav_tracker()`). LIES also runs this aim pass from the
-- movement update (`CopBrain:check_upd_aim` via `CopMovement:_upd_actions`), i.e.
-- outside the logic update that refreshes `attention_obj`, so the cached tracker
-- can already be freed. Calling `nav_segment()`/`obstructed()` on it is an
-- engine access violation, not a catchable Lua error.
-- Crash report: 2026-10-31 11:03, heist `red2`, bot movement update ->
-- `check_upd_aim` -> `_upd_aim` line 998.
-- Rule: the cached tracker is only touched while its owner unit is alive.
local function lies_enemy_tracker(focus_enemy, data)
	if not focus_enemy then
		return
	end

	local unit = focus_enemy.unit

	if not unit then
		return
	end

	if alive(unit) then
		return focus_enemy.nav_tracker
	end

	-- The enemy is gone while its attention entry survives: everything the aim,
	-- cover and charge code would do with this tracker is unsafe, and seeing this
	-- phase in the breadcrumbs is how the 8.57.12 crash class gets confirmed.
	if data and LIES and LIES.Trace then
		LIES:Trace(data.unit, data, "stale_tracker", nil, lies_trace_window(data))
	end
end

-- One [LIES-WATCH] line per session proving the door probe produced a real
-- position, and from which source. `Watch` no-ops while `watch_log` is off.
local function lies_door_watch_first(src, data, enemy_seg)
	if LIES._door_watch_first then
		return
	end

	-- Consuming the flag while the channel is off would burn the one line a
	-- later test play needs: leave it unset until a Watch() would be written.
	if not LIES:WatchEnabled() then
		return
	end

	LIES._door_watch_first = true

	local unit = data.unit
	local base = unit and unit:base()

	LIES:Watch("door_watch_first", {
		src = src,
		seg = enemy_seg,
		u = unit and unit:key() or "?",
		tweak = base and base._tweak_table or "?"
	})
end

-- Door watch for the aim pass (ledger #1 and #2). Pre-port `_upd_aim` kept the
-- last good watch position, re-tested its line of sight on a 0.2/1.5 s cadence,
-- probed the enemy's nav segment for a doorway when the target sat in another
-- segment, and fell back to `_get_expected_pos`. The 248.2 port (`bbb30fa`)
-- dropped all of it, which is why cops stopped predicting a target through a
-- doorway. This is the same body with the retired `_nav_segments[seg].pos`
-- height read replaced by the attention object's position, and with one counter
-- per branch so a test play can prove which path ran. Deliberate deviations from
-- pre-port: the cadence re-test is not gated on `advancing` (the only call site
-- is reached while `my_data.advancing` is set, so the pre-port `not advancing`
-- term was unreachable and the watch position was never refreshed or cleared);
-- on the same nav segment the coarse-search fallback is skipped (see the
-- `dw_seg_same` note below), and vanilla owns that case; the cop's own tracker
-- is nil-guarded; the armed-path pre-step is cadence-gated (inside the 0.2/1.5 s
-- window and only when no saved position is held, because it can reach a coarse
-- search, `find_segment_doors` and one nav tracker per nav-link door); and there
-- are six outcome counters instead of five, because `dw_no_my_tracker` is its
-- own exit.
--
-- Outcome accounting: every call increments exactly one of `dw_gate_off`,
-- `dw_stale_bail`, `dw_outer_gate_skip`, `dw_no_my_tracker`, `dw_hit`,
-- `dw_none`. Everything else (`dw_cadence_skip`, `dw_path_prestep`,
-- `dw_path_prestep_hit`, `dw_raw_hit`, `dw_ray`, ...) is a sub-event. Order
-- matters: the enemy tracker
-- check runs before the `door_watch`/`highperformance` gate, because vanilla
-- `_get_expected_attention_position` (`248.2:1508`) dereferences
-- `attention_obj.nav_tracker` unguarded — with the feature off, handing it a
-- freed tracker is exactly the crash this helper exists to prevent. The cop's
-- own tracker is checked after the gate instead: it is only read by this helper
-- below the gate, and the asymmetry is deliberate because vanilla dereferences
-- that tracker unguarded as well (`248.2:1514`), so a nil there is an outcome
-- of its own (`dw_no_my_tracker`) rather than something the gate can dodge.
local function lies_upd_expected_pos(data, my_data, time_since_verification)
	LIES:Count("dw_call")

	local focus_enemy = data.attention_obj
	local enemy_tracker = lies_enemy_tracker(focus_enemy, data)

	if not enemy_tracker then
		-- The attention object outlived its unit. Vanilla
		-- `_get_expected_attention_position` (`1508-1516`) would read the same
		-- freed pointer, so this branch returns without calling it.
		LIES:Count("dw_stale_bail")

		return
	end

	if not (LIES.settings.door_watch and not LIES.settings.highperformance) then
		LIES:Count("dw_gate_off")

		return CopLogicAttack._get_expected_attention_position(data, my_data)
	end

	-- The cop's own tracker is dereferenced right below, and vanilla
	-- `_get_expected_attention_position` dereferences it too, so a nil here is an
	-- outcome of its own: no vanilla call, no guess.
	local my_tracker = data.unit:movement():nav_tracker()

	if not my_tracker then
		LIES:Count("dw_no_my_tracker")

		return
	end

	local my_seg = my_tracker:nav_segment()
	local enemy_seg = enemy_tracker:nav_segment()

	-- Author's outer gate, verbatim pre-port (`bbb30fa^:1099`): another segment
	-- is only worth watching when the target has not been lost, or when both
	-- units share a segment anyway. Note that this skips cross-segment probing
	-- while `focus_enemy.lost_track` is set — author behaviour, kept as-is and
	-- recorded as an open question in `dev/reports/door-watch-port.md` §7.
	if not ((time_since_verification and not focus_enemy.lost_track) or my_seg == enemy_seg) then
		LIES:Count("dw_outer_gate_skip")

		return CopLogicAttack._get_expected_attention_position(data, my_data)
	end

	local expected_pos = my_data.expected_pos
	local last_check_t = my_data.expected_pos_last_check_t
	-- A clock that moved backwards means a level change: re-test right away.
	local test_for_sight = not last_check_t or data.t - last_check_t > (data.important and 0.2 or 1.5) or data.t < last_check_t
	local cached = expected_pos and 1 or 0
	local src
	local height
	local raycast_f
	local head_pos
	-- `os.clock()` on Windows has ~1 ms granularity, so `dw_us`/`dw_us_max` are
	-- averages over many calls, not a per-call profile. `t0` is sampled once per
	-- armed call and read after the cadence block, so one sample covers the
	-- armed-path pre-step (it can reach an engine coarse search), the cached
	-- re-test ray and `find_segment_doors` together.
	local t0 = os.clock()

	-- Cadence block. The author re-tested the cached position and probed for a
	-- doorway only when the 0.2 s / 1.5 s window opened, then stamped
	-- `expected_pos_last_check_t` so the next window starts from that frame. The
	-- pre-port probe read `if not expected_pos and test_for_sight` only
	-- (`bbb30fa^:1223`); the `not my_data.advancing` term sat on the re-test
	-- (`bbb30fa^:1213`) and is the one thing that made the re-test dead at this
	-- call site (see the header note), so it is gone and the re-test runs on the
	-- window like the probe does.
	if test_for_sight then
		if expected_pos then
			raycast_f = data.unit.raycast
			head_pos = data.m_pos:with_z(data.unit:movement():m_head_pos().z)

			if raycast_f(data.unit, "ray", head_pos, expected_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
				expected_pos = nil
				my_data.expected_pos = nil

				LIES:Count("dw_cached_unsighted")
			end
		end

		if not expected_pos then
			-- Author's pre-step (`bbb30fa^:1198-1204`): an armed coarse path is
			-- the best watch position, and reading it here keeps
			-- `_get_expected_pos` from issuing a new search. It sits inside the
			-- cadence window and only runs when nothing is saved, so a nil
			-- result cannot discard a held position and the re-test above always
			-- sees the cache.
			if my_data.expected_pos_path then
				LIES:Count("dw_path_prestep")

				local pre = CopLogicAttack._get_expected_pos(data, my_data)

				if pre then
					expected_pos = pre
					src = "expected"

					LIES:Count("dw_path_prestep_hit")
				end
			end

			if not expected_pos then
				if my_seg ~= enemy_seg then
					head_pos = head_pos or data.m_pos:with_z(data.unit:movement():m_head_pos().z)
					raycast_f = raycast_f or data.unit.raycast

					-- Tracker-free height gate: `focus_enemy.m_pos` is the last known
					-- position, so no nav segment table and no engine pointer.
					local enemy_z = focus_enemy.m_pos and focus_enemy.m_pos.z or data.m_pos.z
					local try_watch_enemy_seg = data.m_pos.z >= enemy_z or math.abs(data.m_pos.z - enemy_z) < 250 or (focus_enemy.dis or 0) >= 2000

					height = try_watch_enemy_seg and 1 or 0

					if try_watch_enemy_seg then
						local nav = managers and managers.navigation
						-- 2-arg form: raw Vector3 positions only, no segment filter.
						local doors = nav and nav.find_segment_doors and nav:find_segment_doors(enemy_seg)

						if doors then
							for i = 1, #doors do
								local door = doors[i]

								-- Nil test for explicit intent, not a behaviour change:
								-- Lua has no falsy `0`, so `if door.x` accepts the
								-- same values. It says which shape is expected — a
								-- raw `Vector3` has `.x`, a unit door does not.
								if door.x ~= nil then
									local test_pos = door:with_z(door.z + 140)

									LIES:Count("dw_ray")

									if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
										LIES:Count("dw_raw_hit")
										LIES:Count("door_raw")

										expected_pos = test_pos
										src = "raw"

										break
									end
								end
							end
						end
					else
						LIES:Count("dw_height_skip")
					end
				else
					LIES:Count("dw_seg_same")
				end

				-- Same-segment delegates to vanilla: `_get_expected_pos` would run
				-- `search_coarse` with from_seg == to_seg, which can never satisfy its
				-- `i_to_seg ~= i_from_seg` check, so it burns a search and returns
				-- nothing. Vanilla `_get_expected_attention_position` handles the
				-- same-segment case with `m_pos + 140`.
				if not expected_pos and my_seg ~= enemy_seg and not enemy_tracker:obstructed() and not my_tracker:obstructed() then
					local fallback = CopLogicAttack._get_expected_pos(data, my_data)

					if fallback then
						expected_pos = fallback
						src = "expected"

						LIES:Count("dw_expected_pos_hit")
					end
				end
			end
		end

		my_data.expected_pos_last_check_t = data.t
	else
		LIES:Count("dw_cadence_skip")

		if my_data.advancing then
			LIES:Count("dw_advancing_skip")
		end

		-- The window is closed, so the pre-step cannot have run: the only way
		-- `expected_pos` is set here is the saved position read above
		-- (`cached == 1`). Counting the reuse only in that case keeps the
		-- counter honest — a pre-step-derived position on a closed window is
		-- impossible by construction, not by luck.
		if expected_pos and cached == 1 then
			LIES:Count("dw_cached_reuse")
		end
	end

	local elapsed_us = (os.clock() - t0) * 1000000

	LIES:Sum("dw_us", elapsed_us)
	LIES:Gauge("dw_us_max", elapsed_us)

	if expected_pos then
		my_data.expected_pos = expected_pos

		LIES:Count("dw_hit")

		-- Provenance for the caller: `_upd_aim` adopts this position a few lines
		-- later, and the adoption trace has to say whether the cop aimed at a
		-- door position or at vanilla's `m_pos + 140`. Every watch return is
		-- stamped, including a cached reuse: the cop *did* aim at a watch
		-- position, and leaving the cached arm unstamped is what made a
		-- room-heavy play read as zero adoptions. The reuse gets its own source
		-- (`cached`) so the adoption line and `watch_aim_cached` can tell an old
		-- decision from one derived on this pass.
		my_data.lies_watch_src = src or "cached"
		my_data.lies_watch_seg = enemy_seg

		if src then
			-- The computed-position line stays fresh-only: a cached reuse would
			-- repeat the same decision on every pass.
			lies_door_watch_first(src, data, enemy_seg)

			LIES:Trace(data.unit, data, "door_watch", string.format("src=%s seg=%s dis=%d cached=%d height=%d",
				src, tostring(enemy_seg), math.floor((focus_enemy.dis or 0) + 0.5), cached, height or 0), 2.5)
		end

		return expected_pos
	end

	LIES:Count("dw_none")

	-- Vanilla still owns the coarse-path scheduling; `dw_path_kick` proves the
	-- search id was armed on this call instead of being inherited.
	local had_id = my_data.expected_pos_path_search_id
	local pos = CopLogicAttack._get_expected_attention_position(data, my_data)

	LIES:Count("dw_vanilla_call")

	if not had_id and my_data.expected_pos_path_search_id then
		LIES:Count("dw_path_kick")
	end

	return pos
end

function CopLogicAttack.enter(data, new_logic_name, enter_params)
	CopLogicBase.enter(data, new_logic_name, enter_params)
	data.unit:brain():cancel_all_pathing_searches()

	local old_internal_data = data.internal_data
	local my_data = {
		unit = data.unit
	}
	data.internal_data = my_data
	my_data.detection = data.char_tweak.detection.combat

	if old_internal_data then
		my_data.turning = old_internal_data.turning
		my_data.firing = old_internal_data.firing
		my_data.shooting = old_internal_data.shooting
		my_data.attention_unit = old_internal_data.attention_unit
		my_data.expected_pos = old_internal_data.expected_pos
		my_data.expected_pos_path = old_internal_data.expected_pos_path
		my_data.expected_pos_last_check_t = old_internal_data.expected_pos_last_check_t
		my_data.start_shoot_t = old_internal_data.start_shoot_t

		CopLogicAttack._set_best_cover(data, my_data, old_internal_data.best_cover)
	end

	my_data.cover_test_step = 0
	local key_str = tostring(data.key)

	CopLogicIdle._chk_has_old_action(data, my_data)

	if data.unit:base():has_tag("medic") then
		my_data.attitude = "avoid"
	elseif not data.unit:character_damage():can_kill() or data.is_converted or data.unit:base()._tweak_table == "marshal_shield_break" then
		my_data.attitude = "engage"
	else
		my_data.attitude = data.objective and data.objective.attitude or "avoid"
	end
	
	if data.char_tweak.weapon and data.char_tweak.weapon[data.unit:inventory():equipped_unit():base():weapon_tweak_data().usage] then
		my_data.weapon_range = data.char_tweak.weapon[data.unit:inventory():equipped_unit():base():weapon_tweak_data().usage].range
	end
	
	if not my_data.weapon_range then
		my_data.weapon_range = {
			optimal = 2000,
			far = 5000,
			close = 1000
		}
	end

	data.unit:brain():set_update_enabled_state(true)

	if data.cool then
		data.unit:movement():set_cool(false)
	end

	if (not data.objective or not data.objective.stance) and data.unit:movement():stance_code() == 1 then
		data.unit:movement():set_stance("hos")
	end

	if my_data ~= data.internal_data then
		return
	end
	
	CopLogicAttack._upd_enemy_detection(data, true)
	
	if my_data ~= data.internal_data then
		return
	end
	
	if data.objective and (data.objective.action_duration or data.objective.action_timeout_t and data.t < data.objective.action_timeout_t) then
		my_data.action_timeout_clbk_id = "CopLogicIdle_action_timeout" .. tostring(data.key)
		local action_timeout_t = data.objective.action_timeout_t or data.t + data.objective.action_duration
		data.objective.action_timeout_t = action_timeout_t

		CopLogicBase.add_delayed_clbk(my_data, my_data.action_timeout_clbk_id, callback(CopLogicIdle, CopLogicIdle, "clbk_action_timeout", data), action_timeout_t)
	end

	data.unit:brain():set_attention_settings({
		cbt = true
	})
end

function CopLogicAttack.queued_update(data)
	-- A queued update can outlive its unit; the rest of this body dereferences
	-- it (8.57.28 engine-AV fix). Live units never take this branch.
	if not alive(data.unit) or not data.unit:movement() then
		return
	end

	local my_data = data.internal_data
	data.t = TimerManager:game():time()
	
	CopLogicAttack._upd_enemy_detection(data, true)
	
	if data.internal_data == my_data then
		if data.attention_obj and AIAttentionObject.REACT_AIM <= data.attention_obj.reaction then
			CopLogicAttack.update(data)
		end
	end

	if data.internal_data == my_data then
		CopLogicAttack.queue_update(data, data.internal_data)
	end
end

function CopLogicAttack.queue_update(data, my_data)
	CopLogicBase.queue_task(my_data, my_data.update_queue_id, data.logic.queued_update, data, data.t + (data.important and 0 or 0.2), true)
end

local safe_dmg_types = {
	bullet = true,
	explosion = true,
	fire = true,
	melee = true
}

function CopLogicAttack.damage_clbk(data, damage_info)
	CopLogicIdle.damage_clbk(data, damage_info)
	
	if not safe_dmg_types[damage_info.variant] then
		return
	end

	if data.important and not data.is_converted then
		if not data.unit:movement():chk_action_forbidden("walk") then
			local my_data = data.internal_data

			if not my_data.tasing and not my_data.spooc_attack then
				CopLogicBase.chk_start_action_dodge(data, "hit")
			end
		end
	end
end

function CopLogicAttack._upd_enemy_detection(data, is_synchronous)
	-- Dead unit: a queued detection callback can outlive it (8.57.28 engine-AV
	-- fix); live units never take this branch.
	if not alive(data.unit) or not data.unit:movement() then
		return 2
	end

	managers.groupai:state():on_unit_detection_updated(data.unit)

	data.t = TimerManager:game():time()
	local my_data = data.internal_data
	local min_reaction = AIAttentionObject.REACT_AIM	
	local delay = CopLogicBase._upd_attention_obj_detection(data, min_reaction, nil)
	local new_attention, new_prio_slot, new_reaction = CopLogicIdle._get_priority_attention(data, data.detected_attention_objects, nil)
	local old_att_obj = data.attention_obj

	CopLogicBase._set_attention_obj(data, new_attention, new_reaction)
	data.logic._chk_exit_attack_logic(data, new_reaction)

	if my_data ~= data.internal_data then
		return
	end

	if new_attention then
		if old_att_obj and old_att_obj.u_key ~= new_attention.u_key then
			CopLogicAttack._cancel_charge(data, my_data)
			
			my_data.cover_test_step = 0
			my_data.flank_cover = nil
			my_data.charging = nil
			my_data.expected_pos = nil
		end
	elseif old_att_obj then
		CopLogicAttack._cancel_charge(data, my_data)
		
		my_data.cover_test_step = 0
		my_data.flank_cover = nil
		my_data.charging = nil
	end

	CopLogicBase._chk_call_the_police(data)

	if my_data ~= data.internal_data then
		return
	end
	
	data.logic._upd_aim(data, my_data)

	if not is_synchronous then
		CopLogicBase.queue_task(my_data, my_data.detection_task_key, CopLogicAttack._upd_enemy_detection, data, delay and data.t + delay, data.important and true)
	end

	CopLogicBase._report_detections(data.detected_attention_objects)
end

function CopLogicAttack.update(data)
	local my_data = data.internal_data

	if my_data.has_old_action or my_data.old_action_advancing then
		CopLogicAttack._upd_stop_old_action(data, my_data)
		
		if my_data.has_old_action or my_data.old_action_advancing then
			if not my_data.update_queue_id then
				data.unit:brain():set_update_enabled_state(false)

				my_data.update_queue_id = "CopLogicAttack.queued_update" .. tostring(data.key)

				CopLogicAttack.queue_update(data, my_data)
			end
	
			return
		end
	end

	if CopLogicIdle._chk_relocate(data) then
		return
	end

	if CopLogicAttack._chk_exit_non_walkable_area(data) then
		return
	end

	CopLogicAttack._process_pathing_results(data, my_data)

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_AIM then
		CopLogicAttack._upd_enemy_detection(data, true)

		if my_data ~= data.internal_data or not data.attention_obj then
			return
		end
	end
	
	if AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction and not data.unit:movement():chk_action_forbidden("walk") then
		local want_to_take_cover = CopLogicAttack._chk_wants_to_take_cover(data, my_data)
			
		if data.char_tweak.chatter and data.char_tweak.chatter.suppress and my_data.attitude == "engage" and want_to_take_cover then
			if (data.important or data.unit:base():has_tag("special")) and want_to_take_cover ~= my_data.want_to_take_cover and not my_data.want_to_take_cover then
				local said = managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "wantcover")
				
				if not said and data.unit:base():has_tag("special") then
					if not data.next_priority_speak_t or data.next_priority_speak_t < data.t then
						if data.unit:sound():say("hlp", true) then
							data.next_priority_speak_t = data.t + 4
						end
					end
				end
			end
		end
		
		if data.attention_obj.hostage_blocked and not (data.tactics and data.tactics.hrt) then
			want_to_take_cover = true
		end
		
		my_data.want_to_take_cover = want_to_take_cover
		
		--log(tostring(my_data.attitude))

		CopLogicAttack._update_cover(data)
		
		if not data.next_mov_time or data.next_mov_time < data.t then
			CopLogicAttack._upd_combat_movement(data)
		end
	end
	
	if data.is_converted or data.check_crim_jobless or data.team.id == "criminal1" then
		if not data.objective or data.objective.type == "free" then
			if not data.path_fail_t or data.t > data.path_fail_t + 3 then
				managers.groupai:state():on_criminal_jobless(data.unit)

				if my_data ~= data.internal_data then
					return
				end
			end
		end
	end

	if not my_data.update_queue_id then
		data.unit:brain():set_update_enabled_state(false)

		my_data.update_queue_id = "CopLogicAttack.queued_update" .. tostring(data.key)

		CopLogicAttack.queue_update(data, my_data)
	end
end

function CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos(data, my_data, path, speed)
	LIES:Trace(data.unit, data, "action_walk_shoot", nil, lies_trace_window(data))

	CopLogicAttack._cancel_cover_pathing(data, my_data)
	CopLogicAttack._cancel_charge(data, my_data)
	CopLogicAttack._correct_path_start_pos(data, path)

	local new_action_data = {
		body_part = 2,
		type = "walk",
		nav_path = path,
		variant = speed or "walk"
	}
	my_data.cover_path = nil
	my_data.advancing = data.unit:brain():action_request(new_action_data)

	if my_data.advancing then
		my_data.walking_to_cover_shoot_pos = my_data.advancing
		my_data.at_cover_shoot_pos = nil
		my_data.in_cover = nil

		data.brain:rem_pos_rsrv("path")
		
		CopLogicAttack._upd_aim(data, my_data)
		
		return true
	end
end

function CopLogicAttack._upd_combat_movement(data)
	local my_data = data.internal_data
	local t = data.t
	local unit = data.unit
	local focus_enemy = data.attention_obj
	local in_cover = my_data.in_cover
	local best_cover = my_data.best_cover

	if not focus_enemy then
		-- Old code dereferenced it three lines down: this used to be a Lua error
		-- crash, and a missing attention object means there is no movement plan.
		LIES:Trace(data.unit, data, "combat_no_attention", nil, lies_trace_window(data))

		return
	end

	LIES:Trace(data.unit, data, "combat", nil, lies_trace_window(data))

	local enemy_visible = focus_enemy.verified
	local enemy_visible_soft = focus_enemy.verified_t and t - focus_enemy.verified_t < 7
	local enemy_visible_softer = focus_enemy.verified_t and t - focus_enemy.verified_t < 15
	local alert_soft = data.is_suppressed
	local action_taken = data.logic.action_taken(data, my_data)
	local want_to_take_cover = my_data.want_to_take_cover

	LIES:Trace(data.unit, data, "pose", nil, lies_trace_window(data))

	action_taken = action_taken or CopLogicAttack._upd_pose(data, my_data)
	local move_to_cover, want_flank_cover = nil
	local aggro_level = data.unit:base()._tweak_table == "marshal_shield_break" and 4 or LIES.settings.enemy_aggro_level
	local wanted_attack_range = my_data.wanted_attack_range

	--[[uncomment to draw cover stuff or whatever
		
	if my_data.moving_to_cover then
		local height = 41
		local line = Draw:brush(Color.blue:with_alpha(0.5), 0.2)
		line:cylinder(data.m_pos, my_data.moving_to_cover[1][1], 5)
		
		if my_data.moving_to_cover[5] then
			line:cylinder(my_data.moving_to_cover[5], my_data.moving_to_cover[1][1], 5)
			line:sphere(my_data.moving_to_cover[5], 8)
		end
		
		line:cylinder(my_data.moving_to_cover[1][1], my_data.moving_to_cover[1][1] + math.UP * height, 5)
	elseif my_data.in_cover then
		local height = my_data.in_cover[4] and 180 or 90
		local line = Draw:brush(Color.green:with_alpha(0.5), 0.2)
		if my_data.in_cover[5] then
			line:cylinder(my_data.in_cover[1][1], my_data.in_cover[5], 30)
			line:cylinder(my_data.in_cover[1][1], my_data.in_cover[1][1] + math.UP * height, 30)
		else
			line:cylinder(my_data.in_cover[1][1], my_data.in_cover[1][1] + math.UP * height, 30)
		end
	elseif my_data.best_cover then
		local height = 41
		local line = Draw:brush(Color.green:with_alpha(0.5), 0.2)
		line:cylinder(data.m_pos, my_data.best_cover[1][1], 5)
		
		if my_data.best_cover[5] then
			line:cylinder(my_data.best_cover[5], my_data.best_cover[1][1], 5)
			line:sphere(my_data.best_cover[5], 8)
		end
		
		line:cylinder(my_data.best_cover[1][1], my_data.best_cover[1][1] + math.UP * height, 5)
	end
	
	if data.attention_obj.verified then
		if my_data.surprised then
			local line = Draw:brush(Color.blue:with_alpha(0.25), 0.2)
			line:sphere(data.unit:movement():m_head_pos(), 30)
		elseif my_data.want_to_take_cover then
			local line = Draw:brush(Color.yellow:with_alpha(0.25), 0.2)
			line:sphere(data.unit:movement():m_head_pos(), 30)
		elseif my_data.walking_to_cover_shoot_pos or my_data.at_cover_shoot_pos then
			local line = Draw:brush(Color.red:with_alpha(0.25), 0.2)
			line:cylinder(data.m_pos, data.unit:movement():m_head_pos(), 60)
		end
	else
		if my_data.walking_to_cover_shoot_pos or my_data.at_cover_shoot_pos then
			local line = Draw:brush(Color.red:with_alpha(0.25), 0.2)
			line:cylinder(data.m_pos, data.unit:movement():m_head_pos(), 60)
		else
			local line = Draw:brush(Color.blue:with_alpha(0.25), 0.2)
			line:cylinder(data.m_pos, data.unit:movement():m_head_pos(), 60)
		end
	end]]

	if my_data.cover_test_step ~= 0 and not enemy_visible_softer and (action_taken or want_to_take_cover or not in_cover) then
		my_data.cover_test_step = 0
	end

	if my_data.stay_out_time and (enemy_visible and focus_enemy.aimed_at or not my_data.at_cover_shoot_pos or action_taken or want_to_take_cover) then
		my_data.stay_out_time = nil
	elseif my_data.attitude == "engage" and not my_data.stay_out_time and not enemy_visible and my_data.at_cover_shoot_pos and not action_taken and not want_to_take_cover then
		my_data.stay_out_time = t + 7
	end
	
	local can_charge = wanted_attack_range and focus_enemy.dis > wanted_attack_range or wanted_attack_range and not enemy_visible or data.unit:base()._tweak_table == "marshal_shield_break"
	
	if not can_charge and my_data.attitude == "engage" and not data.is_converted and (not data.objective or not data.objective.grp_objective or data.objective.grp_objective.type ~= "reenforce_area" and not data.objective.grp_objective.blockading) and (not data.tactics or not data.tactics.sniper) then
		can_charge = aggro_level > 3 or my_data.flank_cover and my_data.flank_cover.failed 
		can_charge = can_charge or data.tactics and data.tactics.charge and data.objective and data.objective.grp_objective and data.objective.grp_objective.pushed
	end

	if action_taken then
		-- Nothing
	elseif want_to_take_cover then
		move_to_cover = true
	elseif not enemy_visible then
		if can_charge and (not my_data.charge_path_failed_t or data.t - my_data.charge_path_failed_t > 2) then
			if my_data.charge_path then
				local path = my_data.charge_path
				my_data.charge_path = nil
				local haste = "walk"
				
				if not data.char_tweak.walk_only then
					if data.tactics and data.tactics.charge or aggro_level > 2 or wanted_attack_range then
						haste = "run"
					end
				end
				
				action_taken = CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos(data, my_data, path, haste)
				
				if action_taken then
					my_data.charging = true
				end
			else
				local enemy_tracker = lies_enemy_tracker(data.attention_obj, data)

				if not my_data.charge_path_search_id and enemy_tracker then
					LIES:Trace(data.unit, data, "charge_search", nil, lies_trace_window(data))

					my_data.charge_pos = CopLogicAttack._find_charge_pos(data, my_data, enemy_tracker, wanted_attack_range and wanted_attack_range * 0.9 or my_data.weapon_range.close)

					if my_data.charge_pos then
						my_data.charge_path_search_id = "charge" .. tostring(data.key)

						unit:brain():search_for_path(my_data.charge_path_search_id, my_data.charge_pos, nil, nil, nil)
					else
						debug_pause_unit(data.unit, "failed to find charge_pos", data.unit)

						my_data.charge_path_failed_t = TimerManager:game():time()
					end
				end
			end
		elseif aggro_level < 4 and focus_enemy.verified_t and t - focus_enemy.verified_t < 2 and best_cover and (not in_cover or best_cover[1] ~= in_cover[1]) then
			move_to_cover = true
		elseif in_cover then
			local my_tracker = unit:movement():nav_tracker()
			local m_tracker_pos = my_tracker:position()
			
			if my_data.in_cover[7] then
				local path = {
					m_tracker_pos,
					mvector3.copy(my_data.in_cover[5])
				}
				
				action_taken = CopLogicAttack._chk_request_action_walk_to_cover_offset_pos(data, my_data, path)
			elseif my_data.cover_test_step <= 2 then
				local height = nil

				if in_cover[4] then
					height = 140
				else
					height = 82.5
				end
				
				local aim_pos = not focus_enemy.lost_track and focus_enemy.last_verified_pos or focus_enemy.verified_pos
				
				--make this into a loop to save updates
				local reservation = {
					radius = 30,
					filter = data.pos_rsrv_id
				}
				
				while my_data.cover_test_step < 3 do
					local shoot_from_pos = CopLogicAttack._peek_for_pos_sideways(data, my_data, my_tracker, aim_pos, height)

					if shoot_from_pos then
						reservation.position = shoot_from_pos
						if not managers.navigation:is_pos_free(reservation) then
							local path = {
								m_tracker_pos,
								shoot_from_pos
							}
							action_taken = CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos(data, my_data, path, "walk")

							break
						end
					end
					
					my_data.cover_test_step = my_data.cover_test_step + 1
				end
				
				if not action_taken then 
					move_to_cover = true
				
					if not data.tactics or not data.tactics.sniper then
						want_flank_cover = true
					end
				end
			elseif not enemy_visible_soft then
				move_to_cover = true
				
				if not data.tactics or not data.tactics.sniper then
					want_flank_cover = true
				end
			end
		elseif my_data.walking_to_cover_shoot_pos then
			-- Nothing
		elseif my_data.at_cover_shoot_pos then
			if not my_data.stay_out_time or my_data.stay_out_time < t then
				move_to_cover = true
			end
		else
			move_to_cover = true
		end
	elseif my_data.at_cover_shoot_pos and aggro_level < 4 then
		if not my_data.stay_out_time or my_data.stay_out_time < t then
			move_to_cover = true
		end
	else
		if (not my_data.charge_path_failed_t or data.t - my_data.charge_path_failed_t > 2) then
			if can_charge then
				if my_data.charge_path then
					local path = my_data.charge_path
					my_data.charge_path = nil
					local haste = "walk"
				
					if not data.char_tweak.walk_only then
						if data.tactics and data.tactics.charge or aggro_level > 2 or wanted_attack_range then
							haste = "run"
						end
					end
					
					action_taken = CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos(data, my_data, path, haste)
					
					if action_taken then
						my_data.charging = true
					end
				else
					local enemy_tracker = lies_enemy_tracker(data.attention_obj, data)

					if not my_data.charge_path_search_id and enemy_tracker then
						LIES:Trace(data.unit, data, "charge_search", nil, lies_trace_window(data))

						my_data.charge_pos = CopLogicAttack._find_charge_pos(data, my_data, enemy_tracker, wanted_attack_range and wanted_attack_range * 0.9 or my_data.weapon_range.close)

						if my_data.charge_pos then
							my_data.charge_path_search_id = "charge" .. tostring(data.key)

							unit:brain():search_for_path(my_data.charge_path_search_id, my_data.charge_pos, nil, nil, nil)
						else
							debug_pause_unit(data.unit, "failed to find charge_pos", data.unit)

							my_data.charge_path_failed_t = TimerManager:game():time()
						end
					end
				end
			else
				move_to_cover = true
			end
		else
			move_to_cover = true
		end
	end
	
	local have_flank_cover = my_data.flank_cover and true

	LIES:Trace(data.unit, data, "flank", nil, lies_trace_window(data))
	
	if want_flank_cover then
		if not my_data.flank_cover then
			local sign = math.random() < 0.5 and -1 or 1
			local step = 30
			my_data.flank_cover = {
				step = step,
				angle = step * sign,
				sign = sign
			}
		end
	else
		my_data.flank_cover = nil
	end
	
	if not want_flank_cover or want_flank_cover and have_flank_cover then
		LIES:Trace(data.unit, data, "cover_path", nil, lies_trace_window(data))

		if not action_taken and move_to_cover and my_data.cover_path then
			if not best_cover then
				--log("path is outdated, something funky happened in taserlogicattack probably")
				my_data.cover_path = nil
			else
				action_taken = CopLogicAttack._chk_request_action_walk_to_cover(data, my_data)
			end
		elseif not my_data.cover_path and not my_data.cover_path_search_id and not action_taken and best_cover and (not in_cover or best_cover[1] ~= in_cover[1]) and (not my_data.cover_path_failed_t or data.t - my_data.cover_path_failed_t > 2) then
			LIES:Count("cover_issued_gate")

			if my_data.cover_path_failed_t then
				LIES:Count("cover_issued_failed_path")
			end

			if my_data.cover_walk_refused_t then
				LIES:Count("cover_issued_refused_walk")
				my_data.cover_walk_refused_t = nil
			end

			my_data.cover_path_search_id = tostring(unit:key()) .. "cover"
			my_data.cover_search_t = TimerManager:game():time()

			LIES:Trace(data.unit, data, "cover_path_search", nil, lies_trace_window(data))

			data.unit:brain():search_for_path_to_cover(my_data.cover_path_search_id, best_cover[1], best_cover[5])
		end
	end

	if not data.is_converted and not my_data.moving_to_cover and not data.unit:movement():chk_action_forbidden("walk") and CopLogicAttack._can_move(data) and data.attention_obj.verified and not action_taken then
		LIES:Trace(data.unit, data, "dodge", nil, lies_trace_window(data))

		if data.is_suppressed and data.t - data.unit:character_damage():last_suppression_t() < 0.7 then
			action_taken = CopLogicBase.chk_start_action_dodge(data, "scared")
		end

		if not action_taken and focus_enemy.is_person and focus_enemy.dis < 2000 then
			local dodge = nil

			if not (focus_enemy.unit and alive(focus_enemy.unit)) then
				-- Enemy died/despawned since the last detection pass: its movement
				-- and anim data are gone, and reading them is what took the game
				-- down (2026-11-01 05:46, spooc -> combat movement).
				LIES:Trace(data.unit, data, "dodge_dead_enemy", nil, lies_trace_window(data))
			elseif focus_enemy.is_local_player then
				local e_movement_state = focus_enemy.unit:movement():current_state()

				if not e_movement_state:_is_reloading() and not e_movement_state:_interacting() and not e_movement_state:is_equipping() then
					dodge = true
				end
			else
				local e_anim_data = focus_enemy.unit:anim_data()

				if (e_anim_data.move or e_anim_data.idle) and not e_anim_data.reload then
					dodge = true
				end
			end

			if dodge and focus_enemy.aimed_at then
				LIES:Trace(data.unit, data, "dodge_preemptive", nil, lies_trace_window(data))

				action_taken = CopLogicBase.chk_start_action_dodge(data, "preemptive")
			end
		end
	end

	if not action_taken and (want_to_take_cover or move_to_cover) and not best_cover then
		LIES:Trace(data.unit, data, "retreat", nil, lies_trace_window(data))

		action_taken = CopLogicAttack._chk_start_action_move_back(data, my_data, focus_enemy, false)
	end

	LIES:Trace(data.unit, data, "move_out", nil, lies_trace_window(data))

	action_taken = action_taken or CopLogicAttack._chk_start_action_move_out_of_the_way(data, my_data)
end

function CopLogicAttack.action_taken(data, my_data)
	return my_data.advancing or my_data.turning or my_data.moving_to_cover or my_data.walking_to_cover_shoot_pos or my_data.surprised or my_data.has_old_action or data.unit:movement():chk_action_forbidden("walk") or data.unit:anim_data().dodge or data.unit:anim_data().hurt
end

function CopLogicAttack._pathing_complete_clbk(data)
	local my_data = data.internal_data
	
	if my_data.exiting or my_data.spooc_attack or my_data.tasing then
		return
	end
	
	local focus_enemy = data.attention_obj

	if not focus_enemy or focus_enemy.reaction < AIAttentionObject.REACT_COMBAT then
		return
	end
	
	CopLogicAttack._process_pathing_results(data, my_data)
	CopLogicAttack._upd_combat_movement(data)
	local action_taken = data.logic.action_taken(data, my_data)
	
	if not action_taken then
		data.logic._update_cover(data)
	end
end

function CopLogicAttack._chk_wants_to_take_cover(data, my_data)
	local ammo_max, ammo = data.unit:inventory():equipped_unit():base():ammo_info()

	if ammo <= 0 then
		return true
	end

	if not data.attention_obj or data.attention_obj.reaction < AIAttentionObject.REACT_COMBAT then
		return
	end
	
	if data.tactics and data.tactics.sniper then
		if data.attention_obj.verified_t and data.t - data.attention_obj.verified_t < 2 and data.attention_obj.aimed_at then
			return true
		end
	end
	
	local aggro_level = LIES.settings.enemy_aggro_level
	
	if my_data.attitude ~= "engage" then
		return true
	end
	
	if aggro_level > 3 or data.unit:base()._tweak_table == "marshal_shield_break" then
		return
	end
	
	if data.unit:anim_data().reload then
		return true
	end
	
	if aggro_level < 3 then
		if data.is_suppressed then
			return true
		end
		
		if ammo / ammo_max < 0.2 then
			return true
		end
		
		if data.attention_obj.verified then
			if aggro_level < 2 and data.attention_obj.aimed_at or data.tactics and (data.tactics.ranged_fire or data.tactics.sniper) and my_data.weapon_range.close < data.attention_obj.verified_dis then
				if my_data.firing then
					return true
				end
			end
		end
	end
end

function CopLogicAttack.chk_should_turn(data, my_data)
	return not my_data.optimal_path and not my_data.turning and not my_data.has_old_action and not data.unit:movement():chk_action_forbidden("walk") and not my_data.moving_to_cover and not my_data.walking_to_cover_shoot_pos and not my_data.surprised and not my_data.advancing
end

-- Vanilla's `_upd_aim` body expects the running logic to provide this. Only the
-- attack/travel/phalanx families do, but LIES drives aim from the movement update
-- for every logic (idle sets `weapon_range` too). The attack rule only reads
-- pilot fields that are nil for those logics (nil is falsy) plus the unit's
-- walk-forbidden state, so it is a safe default; travel and the specials keep
-- their own overrides.
CopLogicBase.chk_should_turn = CopLogicBase.chk_should_turn or CopLogicAttack.chk_should_turn

function CopLogicAttack._check_needs_reload(data, my_data)
	if data.unit:anim_data().reload then
		return true
	end
	
	local weapon, weapon_base, ammo_max, ammo

	if alive(data.unit) and data.unit:inventory() then
		weapon = data.unit:inventory():equipped_unit()
	
		if weapon and alive(weapon) then
			weapon_base = weapon and weapon:base()
			ammo_max, ammo = weapon_base:ammo_info()
			local state = data.name
			
			if ammo / ammo_max > 0.2 then
				return true
			end
		end
	end
	
	if not ammo then
		return true
	end
	
	local needs_reload = nil
	
	if ammo <= 1 or ammo / ammo_max <= 0.2 then
		needs_reload = true
	end
	
	if needs_reload then
		local ammo_base = weapon_base and weapon_base:ammo_base()
		
		if ammo_base then
			ammo_base:set_ammo_remaining_in_clip(0)
			
			if not my_data.shooting then
				local shoot_action = {
					body_part = 3,
					type = "shoot"
				}

				my_data.shooting = data.unit:brain():action_request(shoot_action)
			end
		end
	end
end

-- ledger #5: charge abort reads this table (author: fugsystem 8.x)
local tankboss = {
	triad_boss = true,
	deep_boss = true
}

-- Distance, in Payday units (~1 cm each), within which the unit's current aim
-- target still counts as the position a settled sample was stashed for. The
-- stashed position is a doorway's world position, not the cop's own, so a
-- re-adoption of the same doorway reproduces it exactly: a cached return hands
-- back the same Vector3 and a fresh derivation the same door point. Anything the
-- cop turned to instead - another door, `focus_enemy.verified_pos` - is a
-- different place in the room, tens of units away. 20 is therefore chosen as a
-- jitter band for a raycast landing elsewhere on the same door frame, far below
-- the ~100 units that separate two doorways in a corridor.
local LIES_SETTLE_TARGET_DIS = 20

-- True when the unit's own aim target is still the position a settled sample was
-- taken for. The engine keeps the aim target as a typed table: `pos` is a
-- Vector3, `unit`/`u_key` are separate fields, and no target at all is nil - so
-- reading `pos` answers the question exactly. `CopMovement:attention()` returns
-- the table the aim was last told to hold, by reference and without allocating,
-- and the same getter is already used this way in
-- `lua/coplogics/coplogicidle.lua:1007`, `lua/coplogics/coplogictravel.lua:1075`,
-- `lua/coplogics/coplogicarrest.lua:198` and
-- `lua/civlogics/civilianlogicsurrender.lua:344` (mod line numbers, not game).
--
-- Vanilla's `my_data.attention_unit` mirror must not be read for this: it is an
-- untyped union of a Vector3 and an enemy `u_key`, and a `u_key` is an opaque
-- Idstring userdata with no `__index`, so `attention_unit.type_name` raises
-- "attempt to index local 'attention_unit' (a userdata value)" instead of
-- answering the question (`dev/reports/watch-settle-attention-unit-type-crash.md`,
-- taser crash 2026-11-05). The mirror is also behind the engine: the travel
-- logic sets an attention position without updating it
-- (`CopLogicTravel:1280/1309`), so every sample this helper keeps is one the
-- cop's real aim also kept.
--
-- `attention.pos` can alias a nav-ray or turn vector the caller mutates after
-- handing it over, so the 20-unit band can read a moved vector. That is jitter
-- in the measurement, never a crash: the three writers of that table -
-- `CopLogicBase._set_attention_on_pos`, `CopMovement:synch_attention` (network)
-- and `CopMovement:load` (save restore) - all store a Vector3.
local function lies_settle_target_held(data, pos)
	local movement = data.unit:movement()

	if not movement then
		return false
	end

	local attention = movement:attention()
	local aim_pos = attention and attention.pos

	if not aim_pos then
		return false
	end

	return mvec3_dis(aim_pos, pos) <= LIES_SETTLE_TARGET_DIS
end

-- Flat facing dot between the cop's forward vector and the direction to a
-- target position. Returns nil when either flattened vector has no length, i.e.
-- when there is no facing to measure: 0 is a real 90-degree miss and must not be
-- fabricated for an unknown facing, because folding such samples in as 0 would
-- report a miss that was never measured.
--
-- Both vectors are flattened to z = 0: the question is which way the cop looks
-- along the floor, not whether it aims at the doorway's height. One helper for
-- both facing samples (`adoption` and `settled`) so the two can never drift.
local function lies_flat_dot(data, target_pos)
	local fwd = data.unit:movement():m_fwd()

	if not fwd then
		return
	end

	local fwd_flat = temp_vec1
	local dir_flat = temp_vec2

	mvec3_set(fwd_flat, fwd)
	mvec3_set_z(fwd_flat, 0)

	local fwd_len = mvec3_norm(fwd_flat)

	mvec3_dir(dir_flat, data.m_pos, target_pos)
	mvec3_set_z(dir_flat, 0)

	local dir_len = mvec3_norm(dir_flat)

	if fwd_len > 0.001 and dir_len > 0.001 then
		return mvec3_dot(fwd_flat, dir_flat)
	end
end

-- Adoption side of the door watch. The helper above proves a position was
-- *computed* (`[LIES-TRACE] phase=door_watch`, `dw_*`); this proves the cop then
-- turned its attention to it. Without it a digest can show `dw_raw_hit > 0`
-- while nothing says the position became the unit's aim target.
--
-- Measured on the 2026-11-02 play (8.57.29): travel logics do reach `_upd_aim`
-- (`logic=travel ... phase=watch_aim`, 2,079 lines in a run), so a cop walking
-- between rooms can adopt a watch position too. What made a room-clearing test
-- look inconclusive was the facing sample, not the logic.
--
-- `dot` is the flat facing error at the moment of adoption: 1.0 means the cop
-- already faced the doorway, 0 means it looked at a wall, negative means the
-- watch position asked for a turn of more than 90 degrees. It is measured at the
-- instant of adoption, which is always off-target because the adoption *causes*
-- the turn; the settled sample (`watch_aim_settle`, at least 0.4 s later, on the
-- next aim pass, with `age` reporting the actual delay) is the "does the cop look
-- like it pre-aims" figure. `verified` / `nearly` are the enemy's visibility
-- flags at that instant — an adoption of a doorway position while the target is
-- *visible* cannot add anything, so the line has to expose it.
--
-- Every adoption of a watch position is counted, whether the helper derived the
-- position on this pass (`src=raw` / `src=expected`) or returned a cached one
-- (`src=cached`): a cop aiming at a doorway is the feature working either way,
-- and counting only fresh derivations made `watch_aim_adopted = 0` read as
-- "never pre-aimed" when it only meant "never derived on the adoption pass".
-- `watch_aim_cached` keeps the cached subset visible, because a run made only of
-- cached adoptions says the probe itself did not fire.
local function lies_watch_aim_trace(data, my_data, focus_enemy, expected_pos)
	local src = my_data.lies_watch_src
	local seg = my_data.lies_watch_seg

	LIES:Count("watch_aim_adopted")

	if src == "cached" then
		LIES:Count("watch_aim_cached")
	end

	if focus_enemy and (focus_enemy.verified or focus_enemy.nearly_visible) then
		LIES:Count("watch_aim_verified")
	end

	-- nil means "no facing this frame", not 0: a dot of 0 is a 90-degree miss
	-- and would bias the mean if an unknown facing were folded in as one.
	local dot = lies_flat_dot(data, expected_pos)

	if dot then
		LIES:Sum("watch_aim_dot", dot)
	end

	local verified = (focus_enemy and focus_enemy.verified) and 1 or 0
	local nearly = (focus_enemy and focus_enemy.nearly_visible) and 1 or 0
	local react = focus_enemy and tostring(focus_enemy.reaction) or "?"

	-- Cheap gate: `Trace` returns immediately when the switch is off, and the
	-- formatting plus the tracker read below are the expensive part of a
	-- per-adoption pass. The per-unit window check still lives inside `Trace`,
	-- so an adoption that passes here can still be throttled there.
	if LIES.settings.trace then
		-- The cop's own tracker is the live one (the helper above already bailed
		-- on a dead enemy), but vanilla dereferences it unguarded too, so a nil
		-- one is logged as `?` instead of crashing the trace.
		local my_tracker = data.unit:movement():nav_tracker()
		local my_seg = my_tracker and my_tracker:nav_segment() or "?"

		LIES:Trace(data.unit, data, "watch_aim", string.format(
			"src=%s door_seg=%s my_seg=%s dis=%d dot=%s verified=%d nearly=%d react=%s",
			tostring(src), tostring(seg), tostring(my_seg),
			math.floor(mvec3_dis(data.m_pos, expected_pos) + 0.5),
			dot and string.format("%.2f", dot) or "n/a",
			verified, nearly, react), 1.0)
	end

	-- Settled-facing follow-up, deliberately outside the trace switch: the
	-- counters are the evidence and must not depend on the line being written.
	-- `dot` above is measured at the adoption instant, which is always off-target
	-- because the adoption itself starts the turn; the follow-up taken on a later
	-- pass is the "does he look like he pre-aims" figure.
	--
	-- Stash only when nothing is pending: the *first* adoption of an episode
	-- starts the clock. Every aim pass re-adopts (the vanilla reference compare
	-- above never filters, because `attention_unit` is a fresh copy each time), so
	-- re-stashing per pass would land the sample 0.4 s after an arbitrary pass
	-- instead of after the turn request - a cop parked on a doorway would be
	-- sampled long after it settled and read `dot` ~ 1 by construction.
	local settle_brain = data.unit:brain()
	local settle = my_data.lies_watch_settle

	if not settle then
		-- One table and one scratch Vector3 per unit per logic, reused by every
		-- later episode: this function runs on the aim pass, so `mvector3.copy`
		-- plus a fresh table here would allocate on every adoption.
		settle = { pos = Vector3() }
		my_data.lies_watch_settle = settle
	end

	if not settle.t then
		settle.t = data.t + 0.4
		mvec3_set(settle.pos, expected_pos)
		-- Adoption instant and provenance are kept for the `age` field and for
		-- the logic-change check the consumer makes.
		settle.t0 = data.t
		settle.src = src
		settle.seg = seg
		settle.logic = settle_brain and settle_brain._current_logic_name
	end
end

function CopLogicAttack._upd_aim(data, my_data)
	LIES:Trace(data.unit, data, "aim", nil, lies_aim_window(data))

	local shoot, aim, expected_pos
	local focus_enemy = data.attention_obj
	-- Provenance of `expected_pos` is per pass, never carried over: the
	-- low-reaction branch sets `expected_pos` from vanilla without touching the
	-- helper at all, so a stamp left by an earlier pass would make vanilla's
	-- position look like a watch position. The helper re-stamps both on every
	-- watch return (a fresh derivation or a cached reuse).
	my_data.lies_watch_src = nil
	my_data.lies_watch_seg = nil

	-- Settled facing of the pending watch adoption, sampled at least 0.4 s later:
	-- the first aim pass that is due after it (passes arrive at the frame rate, so
	-- `age` is the real delay, not a fixed 0.4 s). The adoption-instant dot
	-- (`watch_aim_dot`) always looks off-target because the adoption is what
	-- starts the turn; this follow-up is the actual "did the cop end up looking at
	-- the doorway" measurement. A pending entry is kept across passes: only the
	-- first adoption of an episode stashes one, so the sample belongs to the turn
	-- request, not to the last pass that re-adopted the same position.
	local settle = my_data.lies_watch_settle

	if settle and settle.t then
		local settle_brain = data.unit:brain()
		local settle_logic = settle_brain and settle_brain._current_logic_name
		local age = data.t - settle.t0

		if settle.logic ~= settle_logic or age < 0 or age > 2 then
			-- Stale sample (paused frame, level change) or - in principle - a
			-- logic change. The logic compare is defensive and cannot normally
			-- fire: the sample lives in `my_data`, which `CopLogicAttack.enter`
			-- rebuilds from scratch (it copies `attention_unit` and the expected
			-- position, not `lies_watch_settle`), so a logic switch *orphans* the
			-- pending sample - it is dropped by never being read again, not by
			-- this arm, and it is uncounted either way.
			settle.t = nil
		elseif focus_enemy and (focus_enemy.verified or focus_enemy.nearly_visible) then
			-- The cop could see the enemy at sample time, so a turn away from the
			-- doorway was legitimate: counting that facing as a settled miss
			-- would under-report the feature. Dropped in silence.
			settle.t = nil
		elseif not lies_settle_target_held(data, settle.pos) then
			-- The unit aims at something else now (another position, or an enemy,
			-- i.e. no `pos` in the engine's aim record), so its facing says
			-- nothing about the doorway this sample was stashed for.
			settle.t = nil
		elseif data.t >= settle.t then
			local dot = lies_flat_dot(data, settle.pos)

			LIES:Count("watch_aim_settled")

			if dot then
				LIES:Sum("watch_aim_settled_dot", dot)
			end

			-- 0.7 is a cos(45 degrees) cut, i.e. the cop looks within 45 degrees
			-- of the doorway: a chosen, untuned threshold, cheap to move if the
			-- in-game sample disagrees. It is not "facing the enemy's half of the
			-- room" - it only says the settle went to the doorway rather than
			-- staying on the wall it started from.
			if dot and dot >= 0.7 then
				LIES:Count("watch_aim_settled_square")
			end

			if LIES.settings.trace then
				LIES:Trace(data.unit, data, "watch_aim_settle", string.format(
					"dot=%s age=%.2f src=%s door_seg=%s",
					dot and string.format("%.2f", dot) or "n/a",
					age, tostring(settle.src), tostring(settle.seg)), 1.0)
			end

			settle.t = nil
		end
	end

	if focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
		local last_sup_t = data.unit:character_damage():last_suppression_t()

		-- ledger #7: hostage safe weapon (author: fugsystem 7.35 / 7.36)
		if LIES.settings.hhtacs and (focus_enemy.verified_t and data.t - focus_enemy.verified_t < 2 or my_data.shooting) then
			if focus_enemy.hostage_blocked then
				if data.important then
					if data.char_tweak.chatter and data.char_tweak.chatter.ready then
						managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "hostageblock")
					end
				end

				if data.brain:request_switch_to_safe_weapon(3) then
					if my_data.shooting then
						local new_action = {
							body_part = 3,
							type = "idle"
						}

						data.unit:brain():action_request(new_action)
					end

					if my_data.firing then
						data.unit:movement():set_allow_fire(false)

						my_data.firing = nil
					end

					return
				end
			end
		end

		-- ledger #7, restore half: a cop that is already on its sidearm always tries to
		-- pick the main weapon back up, even outside the hhtacs window above. The
		-- hostage check keeps the pre-port `elseif` behaviour (no swap back while the
		-- shot is still blocked).
		if not focus_enemy.hostage_blocked and data.safe_equipped and data.brain:request_switch_to_normal_weapon(7) then
			if my_data.shooting then
				local new_action = {
					body_part = 3,
					type = "idle"
				}

				data.unit:brain():action_request(new_action)
			end

			if my_data.firing then
				data.unit:movement():set_allow_fire(false)

				my_data.firing = nil
			end

			return
		end

		-- ledger #12 (weapon-range self-heal) stays retired, but foreign logics
		-- (teamailogictravel.lua:189, teamailogicassault.lua:299) run this body with
		-- their own internal_data, which never had weapon_range: fall back to the same
		-- close value instead of faulting on nil.
		local weapon_range_close = my_data.weapon_range and my_data.weapon_range.close or 1000

		-- ledger #5: charge abort (author: fugsystem 8.x)
		local try_stop_charge
		local charge_aborted

		if focus_enemy.verified and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
			my_data.charging = my_data.charging or my_data.flank_cover

			-- stop the charge, we are not chargers we do not push unless nescessary
			if my_data.charging and not data.unit:movement():chk_action_forbidden("walk") then
				try_stop_charge = true

				if data.attention_obj.dis <= 200 or LIES.settings.enemy_aggro_level < 4 and (not data.tactics or not data.tactics.charge) and not data.unit:base():has_tag("tank") and not tankboss[data.unit:base()._tweak_table] then
					local new_action = {
						body_part = 2,
						type = "idle"
					}

					if data.unit:brain():action_request(new_action) then
						CopLogicAttack._cancel_charge(data, my_data)
						my_data.at_cover_shoot_pos = true
						try_stop_charge = nil
					end
				end
			end

			my_data.cover_test_step = 0
			my_data.flank_cover = nil
		end

		if focus_enemy.verified or focus_enemy.nearly_visible then
			-- pre-port `1005`: always-face units and dangerous specials never had the
			-- run-away-from-the-target aim suppression applied
			if not data.char_tweak.always_face_enemy and not focus_enemy.dangerous_special then
				if (my_data.low_value_att or data.unit:anim_data().run) and focus_enemy.dis > weapon_range_close and not (data.tactics and data.tactics.sniper) then
					local walk_to_pos = data.unit:movement():get_walk_to_pos()

					if walk_to_pos then
						mvector3.direction(temp_vec1, data.m_pos, walk_to_pos)
						mvector3.direction(temp_vec2, data.m_pos, focus_enemy.m_pos)

						local dot = mvector3.dot(temp_vec1, temp_vec2)

						if dot < 0.6 then
							-- ledger #5: aborted charge stops where it stands
							if try_stop_charge then
								local new_action = {
									body_part = 2,
									type = "idle"
								}

								if data.unit:brain():action_request(new_action) then
									CopLogicAttack._cancel_charge(data, my_data)
									my_data.at_cover_shoot_pos = true
									try_stop_charge = nil
									-- pre-port `1031-1032` dropped the running state too, so the
									-- firing range below stays `far` for the abort pass
									charge_aborted = true
								end
							else
								-- ledger #6: turn-to-shoot concessions (author: fugsystem 8.5 / 8.57)
								local can_turn_to_shoot = focus_enemy.dmg_t and data.t - focus_enemy.dmg_t < 5
								can_turn_to_shoot = can_turn_to_shoot or focus_enemy.acquire_t and data.t - focus_enemy.acquire_t < 4 and focus_enemy.dis <= weapon_range_close

								if not can_turn_to_shoot then
									shoot = false
									aim = false
								end
							end
						end
					end
				end
			end

			if aim == nil and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
				if focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT then
					local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run" and not charge_aborted
					local firing_range = 500

					if data.internal_data.weapon_range then
						firing_range = running and data.internal_data.weapon_range.close or data.internal_data.weapon_range.far
					end

					if last_sup_t and data.t - last_sup_t < 7 * (running and 0.3 or 1) * (focus_enemy.verified and 1 or focus_enemy.vis_ray and firing_range < focus_enemy.vis_ray.distance and 0.5 or 0.2) then
						shoot = true
					elseif focus_enemy.verified and data.internal_data.weapon_range and firing_range > focus_enemy.verified_dis then
						shoot = true
					elseif focus_enemy.verified and focus_enemy.criminal_record and focus_enemy.criminal_record.assault_t and data.t - focus_enemy.criminal_record.assault_t < 2 then
						shoot = true
					end

					if not shoot and my_data.attitude == "engage" then
						if focus_enemy.verified then
							if firing_range > focus_enemy.verified_dis or focus_enemy.reaction == AIAttentionObject.REACT_SHOOT then
								shoot = true
							end
						else
							local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t

							if my_data.firing and time_since_verification and time_since_verification < 3.5 then
								shoot = true
							else
								data.brain:search_for_path_to_unit("hunt" .. tostring(my_data.key), focus_enemy.unit)
							end
						end
					end

					aim = aim or shoot

					if not aim and firing_range > focus_enemy.verified_dis then
						aim = true
					end
				else
					aim = true
				end
			end
		elseif focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
			local time_since_verification = focus_enemy.verified_t and data.t - focus_enemy.verified_t
			local running = my_data.advancing and not my_data.advancing:stopping() and my_data.advancing:haste() == "run"

			if running then
				if time_since_verification and time_since_verification < math.lerp(5, 1, math.max(0, focus_enemy.verified_dis - 500) / 600) then
					aim = true
				end
			else
				aim = true
			end

			if aim and my_data.shooting and focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT and time_since_verification and time_since_verification < (running and 2 or 3) then
				shoot = true
			end

			if not aim then
				expected_pos = lies_upd_expected_pos(data, my_data, time_since_verification)

				if expected_pos then
					if running then
						local watch_dir = temp_vec1

						mvec3_set(watch_dir, expected_pos)
						mvec3_sub(watch_dir, data.m_pos)
						mvec3_set_z(watch_dir, 0)

						local watch_pos_dis = mvec3_norm(watch_dir)
						local walk_to_pos = data.unit:movement():get_walk_to_pos()

						if walk_to_pos then
							local walk_vec = temp_vec2

							mvec3_set(walk_vec, walk_to_pos)
							mvec3_sub(walk_vec, data.m_pos)
							mvec3_set_z(walk_vec, 0)
							mvec3_norm(walk_vec)

							local watch_walk_dot = mvec3_dot(watch_dir, walk_vec)

							if watch_pos_dis < 500 or watch_pos_dis < 1000 and watch_walk_dot > 0.85 then
								aim = true
							end
						end
					else
						aim = true
					end
				end
			end
		else
			expected_pos = CopLogicAttack._get_expected_attention_position(data, my_data)

			if expected_pos then
				aim = true
			end
		end
	end

	if not aim and data.char_tweak.always_face_enemy and focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_COMBAT then
		aim = true
	end

	if data.logic.chk_should_turn(data, my_data) and (focus_enemy or expected_pos) then
		local enemy_pos = expected_pos or (focus_enemy.verified or focus_enemy.nearly_visible) and focus_enemy.m_pos or focus_enemy.verified_pos

		CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, data.m_pos, enemy_pos)
	end

	if aim or shoot then
		if expected_pos then
			-- Vanilla's reference compare, kept verbatim: `my_data.attention_unit`
			-- is always a fresh `mvector3.copy` (or a `u_key`) on the line below,
			-- so it is never the same table as `expected_pos` and this test never
			-- filters. Do not lean on it as a guard — the branch runs on every
			-- pass that aims.
			if my_data.attention_unit ~= expected_pos then
				CopLogicBase._set_attention_on_pos(data, mvector3.copy(expected_pos))

				my_data.attention_unit = mvector3.copy(expected_pos)

				-- One line and two counters per adoption of a watch position,
				-- fresh or cached. `lies_watch_src` is only set by a watch return,
				-- so vanilla's position never feeds the counters.
				if my_data.lies_watch_src then
					lies_watch_aim_trace(data, my_data, focus_enemy, expected_pos)
				end
			end
		elseif focus_enemy.verified or focus_enemy.nearly_visible then
			if my_data.attention_unit ~= focus_enemy.u_key then
				CopLogicBase._set_attention(data, focus_enemy)

				my_data.attention_unit = focus_enemy.u_key
			end
		else
			local look_pos = focus_enemy.last_verified_pos or focus_enemy.verified_pos

			if my_data.attention_unit ~= look_pos then
				CopLogicBase._set_attention_on_pos(data, mvector3.copy(look_pos))

				my_data.attention_unit = mvector3.copy(look_pos)
			end
		end

		if not my_data.shooting and not my_data.spooc_attack and not data.unit:anim_data().reload and not data.unit:movement():chk_action_forbidden("action") then
			local shoot_action = {
				body_part = 3,
				type = "shoot"
			}

			if data.unit:brain():action_request(shoot_action) then
				my_data.shooting = true
			end
		end
	else
		if my_data.shooting then
			local new_action

			if data.unit:anim_data().reload then
				new_action = {
					body_part = 3,
					type = "reload"
				}
			else
				new_action = {
					body_part = 3,
					type = "idle"
				}
			end

			data.unit:brain():action_request(new_action)
		end

		if my_data.attention_unit then
			CopLogicBase._reset_attention(data)

			my_data.attention_unit = nil
		end
	end

	if not shoot and aim and data.tactics and data.tactics.provide_coverfire_LIES and focus_enemy.reaction >= AIAttentionObject.REACT_SHOOT and (focus_enemy.verified or focus_enemy.nearly_visible) and alive(focus_enemy.unit) and focus_enemy.verified_t and data.t - focus_enemy.verified_t < 7 then
		shoot = true
	end

	-- ledger #8: enrage meter for tanks / dozers (author: fugsystem 4.6)
	if focus_enemy and focus_enemy.reaction >= AIAttentionObject.REACT_AIM then
		CopLogicAttack._chk_enrage(data, focus_enemy)
	end

	-- ledger #9: reload callout (author: fugsystem v4). The aim pass also runs from
	-- the movement update, so both reads sit behind a liveness and nil check.
	if shoot and focus_enemy and data.tactics and data.tactics.harass and data.char_tweak.chatter and data.char_tweak.chatter.clear and focus_enemy.verified and alive(focus_enemy.unit) then
		local fe_unit = focus_enemy.unit

		if focus_enemy.is_local_player then
			local fe_movement = fe_unit:movement()
			local cur_state = fe_movement and fe_movement:current_state()

			if cur_state and cur_state:_is_reloading() then
				managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "calloutreload")
			end
		else
			local focus_anim_data = fe_unit:anim_data()

			if focus_anim_data and focus_anim_data.reload then
				managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "calloutreload")
			end
		end
	end

	-- ledger #10: reaction-level fire delay (author: fugsystem v4 `712387f`, 2/N
	-- divisor since 6.7 `6be9cb2`). LIES 7.84 `ab0d5e4` broke the gate with
	-- `and not data.team.id == "criminal1"`, which Lua parses as
	-- `(not data.team.id) == "criminal1"` and is therefore constant false. The
	-- intended terms are the converted-state flag `data.is_converted`, plus the
	-- `criminal1` team id for crew-AI bots (`TeamAIBrain` reuses
	-- `CopBrain:_reset_logic_data` and never sets `is_converted`). Coverfire is
	-- deliberate suppression fire and must win, so that tactic is exempt too.
	-- Only `shoot` is delayed, never `aim`.
	if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
		local react_t = LIES:ReactionDelay()
		local react_hold = false
		-- Verification clock, sampled above the exemption gate: the gap must
		-- measure verification, not how often this attack pass reaches the delay
		-- block. A coverfire stint or a converted/crew exemption would otherwise
		-- leave a stale stamp and arm a fresh hold the moment the exemption ends.
		-- Limitation: the clock is written only while this aim pass runs, so a
		-- logic that never calls `_upd_aim` (idle, spooc attack) for more than 2 s
		-- makes the next attack pass count as a new engagement.
		local react_seen = focus_enemy.verified and true or false
		local react_last_seen = focus_enemy.lies_react_last_seen_t

		if react_seen then
			focus_enemy.lies_react_last_seen_t = data.t
		end

		if react_t > 0 and not data.unit:in_slot(16) and not data.is_converted and not (data.team and data.team.id == "criminal1") and not (data.tactics and data.tactics.provide_coverfire_LIES) then
			-- One arm per engagement: re-arm only after a gap of more than 2 s
			-- without a verified pass. `verified` is re-sampled by the detection
			-- update (and by coplogicidle's low-performance path), so it flips
			-- false whenever the visibility ray is blocked; a bare rising edge
			-- would re-arm ~2x/s for a partly covered target and make the hold
			-- continuous again. A target seen again inside the 2 s window is the
			-- same engagement; a genuine re-acquisition - or a new attention
			-- object, whose fields are nil - arms once.
			if react_seen and (not focus_enemy.lies_react_t or not react_last_seen or data.t - react_last_seen > 2) then
				focus_enemy.lies_react_t = data.t

				LIES:Count("react_arm")

				-- The counters are the telemetry; this event is debug-only because it was 76% of the event volume.
				if LIES.settings.debug_log then
					LIES:Event("reaction_hold", data.unit, data, { level = LIES.settings.enemy_reaction_level, delay = react_t })
				end
			end

			if focus_enemy.lies_react_t and data.t - focus_enemy.lies_react_t < react_t then
				-- `shoot` is this pass's fire decision. `react_hold` counts every
				-- pass in the window, including idle aim passes, so only this
				-- counter can say a shot was actually suppressed.
				if shoot then
					LIES:Count("react_blocked")
				end

				shoot = nil
				react_hold = true
			end
		end

		-- Exactly one of the two per pass: `react_hold` when the hold window
		-- covered this pass, `react_allow` when it did not (timer elapsed, or the
		-- block is exempt / level >= 3). `react_blocked` above is the narrower
		-- count: only the passes where that window cleared a real `shoot`.
		if react_hold then
			LIES:Count("react_hold")
		else
			LIES:Count("react_allow")
		end
	end

	-- ledger #8: boss throwable (author: fugsystem 6). Self-gated on
	-- data.char_tweak.throwable, so non-boss units never reach the throw path.
	if shoot and focus_enemy and not data.safe_equipped and not focus_enemy.hostage_blocked then
		LIESBossLogicAttack._chk_use_throwable(data, my_data, focus_enemy)
	end

	CopLogicAttack.aim_allow_fire(shoot, aim, data, my_data)
end

function CopLogicAttack._get_expected_pos(data, my_data)
	local focus_enemy = data.attention_obj
	
	if focus_enemy and AIAttentionObject.REACT_COMBAT > focus_enemy.reaction then
		my_data.expected_pos_path = nil
		return
	end
	
	local my_tracker = data.unit:movement():nav_tracker()
	local my_seg = my_tracker:nav_segment()
	local enemy_tracker = lies_enemy_tracker(focus_enemy, data)

	if not enemy_tracker then
		-- Enemy already gone: no live tracker to search from. Vanilla 248.2
		-- bails out the same way (`_get_expected_attention_position`).
		my_data.expected_pos_path = nil

		return
	end

	local enemy_seg = enemy_tracker:nav_segment()

	local expected_path = my_data.expected_pos_path
							
	if not expected_path then
		local search_params = {
			id = "expected_pos_path_instant",
			from_seg = my_seg,
			to_seg = enemy_seg,
			access_pos = data.char_tweak.access
		}
		
		if focus_enemy.lost_track then
			search_params.to_seg = nil
			search_params.to_pos = focus_enemy.verified_m_pos
		end
		
		local coarse_path = managers.navigation:search_coarse(search_params)
		
		if coarse_path then
			expected_path = coarse_path
		end
	end
	
	if expected_path then
		local i_from_seg, i_to_seg, good_path
	
		for i, k in ipairs(expected_path) do
			if k[1] == my_seg then
				i_from_seg = i
			end
			
			if k[1] == enemy_seg then
				i_to_seg = i
			end
			
			if i_from_seg and not good_path and focus_enemy.lost_track then
				good_path = true
			end
			
			if i_to_seg and i_from_seg and i_to_seg ~= i_from_seg then
				good_path = true
				
				break
			end
		end

		if not good_path then
			my_data.expected_pos_path = nil
			
			return
		end
		
		local from_nav_seg = expected_path[i_from_seg][1]
		--log(tostring(from_nav_seg))
		local nav_point = i_to_seg and i_from_seg > i_to_seg and expected_path[i_from_seg - 1]
		nav_point = nav_point or expected_path[i_from_seg + 1] 
		nav_point = nav_point or expected_path[i_from_seg - 1]
		
		if not nav_point then
			my_data.expected_pos_path = nil
			
			return
		end
			
		to_nav_seg = nav_point[1]
		
		if not to_nav_seg then
			my_data.expected_pos_path = nil
			
			return
		end
		
		local found_doors = managers.navigation:find_segment_doors(from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", to_nav_seg), true)
		
		if #found_doors == 0 then
			if to_nav_seg ~= enemy_seg then
				found_doors = managers.navigation:find_segment_doors(from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", enemy_seg), true)
			end
			
			-- Still no doors after the retry: the armed path cannot be turned
			-- into a watch position, so drop it and return. The original line
			-- read `if not #found_doors == 0 then`, which Lua parses as
			-- `(not #found_doors) == 0` — always false — so an empty door list
			-- never cleared `expected_pos_path` and the dead path kept being
			-- re-walked on every cadence window.
			if #found_doors == 0 then
				my_data.expected_pos_path = nil
				
				return
			end
		end
		
		local head_pos = data.m_pos:with_z(data.unit:movement():m_head_pos().z)
		local verified_pos = focus_enemy.verified_pos
		local raycast_f = data.unit.raycast
		local expected_pos, best_dis

		for i = 1, #found_doors do
			local door = found_doors[i]
			
			if door.end_pos then
				local test_pos = door.end_pos:with_z(door.end_pos.z + 140)
				if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
					local dis = mvec3_dis_sq(focus_enemy.verified_pos, test_pos)
					
					if not best_dis or dis < best_dis then
						expected_pos = test_pos
						best_dis = dis
					end
				end
			elseif door.center then
				local test_pos = door.center:with_z(door.center.z + 140)
				if not raycast_f(data.unit, "ray", head_pos, test_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision", "report") then
					local dis = mvec3_dis_sq(focus_enemy.verified_pos, test_pos)
				
					if not best_dis or dis < best_dis then
						expected_pos = test_pos
						best_dis = dis
					end
				end
			end
		end
		
		if not expected_pos then		
			return
		end
		
		my_data.expected_pos_path = expected_path
		
		return expected_pos
	end
end

function CopLogicAttack._chk_request_action_turn_to_enemy(data, my_data, my_pos, enemy_pos)
	local fwd = data.unit:movement():m_fwd()
	local target_vec = temp_vec1
	mvector3.direction(target_vec, my_pos, enemy_pos)
	mvec3_set_z(target_vec, 0)
	local error_spin = target_vec:to_polar_with_reference(fwd, math.UP).spin

	if math.abs(error_spin) > 27 then
		local new_action_data = {
			type = "turn",
			body_part = 2,
			angle = error_spin
		}

		my_data.turning = data.unit:brain():action_request(new_action_data)
		
		if my_data.turning then
			return true
		end
	end
end

function CopLogicAttack._peek_for_pos_sideways(data, my_data, from_racker, peek_to_pos, height, short_back_vec)
	LIES:Trace(data.unit, data, "peek", nil, lies_trace_window(data))

	local unit = data.unit
	local my_tracker = from_racker
	local enemy_pos = peek_to_pos
	local my_pos = unit:movement():m_pos()
	local back_vec = my_pos - enemy_pos
	
	if short_back_vec then
		mvector3.set_z(back_vec, 0)
		mvector3.set_length(back_vec, 30)
	else
		mvector3.set_z(back_vec, 0)
		mvector3.set_length(back_vec, 75)
	end
	
	local back_pos = my_pos + back_vec
	local ray_params = {
		allow_entry = true,
		trace = true,
		tracker_from = my_tracker,
		pos_to = back_pos
	}
	local ray_res = managers.navigation:raycast(ray_params)
	back_pos = ray_params.trace[1]
	local back_polar = (back_pos - my_pos):to_polar()
	local right_polar = back_polar:with_spin(back_polar.spin + 90):with_r(100 + 80 * my_data.cover_test_step)
	local right_vec = right_polar:to_vector()
	local right_pos = back_pos + right_vec
	ray_params.pos_to = right_pos
	local ray_res = managers.navigation:raycast(ray_params)
	local shoot_from_pos, found_shoot_from_pos = nil
	local ray_softness = 60
	local stand_ray = World:raycast("ray", ray_params.trace[1] + math.UP * height, enemy_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

	if not stand_ray or mvector3.distance(stand_ray.position, enemy_pos) < ray_softness then
		shoot_from_pos = ray_params.trace[1]
		found_shoot_from_pos = true
	end

	if not found_shoot_from_pos then
		local left_pos = back_pos - right_vec
		ray_params.pos_to = left_pos
		local ray_res = managers.navigation:raycast(ray_params)
		local stand_ray = World:raycast("ray", ray_params.trace[1] + math.UP * height, enemy_pos, "slot_mask", data.visibility_slotmask, "ray_type", "ai_vision")

		if not stand_ray or mvector3.distance(stand_ray.position, enemy_pos) < ray_softness then
			shoot_from_pos = ray_params.trace[1]
			found_shoot_from_pos = true
		end
	end

	return shoot_from_pos
end

function CopLogicAttack._chk_enrage(data, focus_enemy)
	if not data.char_tweak or not data.char_tweak.enrages then
		return
	end
	
	local enrage_data = data.enrage_data or {
		enrage_meter = 0,
		last_chk_t = data.t - 0.2,
		enraged = false,
		enrage_max = 5 + math.random(0, 5)
	}
	
	local dt = data.t - enrage_data.last_chk_t

	local increase = nil
	
	if focus_enemy then
		if AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction and focus_enemy.dis < 1000 then
			if focus_enemy.verified or focus_enemy.verified_t and data.t - focus_enemy.verified_t < 2 then
				increase = true
			end
		end
	end
	
	if increase and not enrage_data.enraged then
		enrage_data.enrage_meter = enrage_data.enrage_meter + dt
		
		if enrage_data.enrage_meter >= enrage_data.enrage_max then
			enrage_data.enraged = true
			enrage_data.enrage_buff_id = data.unit:base():add_buff("base_damage", 1)
			
			if not data.internal_data.turning then
				if not data.unit:movement():chk_action_forbidden("walk") then
					local action_data = {
						variant = "surprised",
						body_part = 1,
						type = "act",
						blocks = {
							action = -1,
							walk = -1
						}
					}

					data.unit:brain():action_request(action_data)
					
				end
			end
			
			data.unit:sound():play("tire_blow", nil, true)
			data.unit:sound():play("kick_metal_door", nil, true)
			data.unit:sound():play("blender_loop_stop", nil, true)
			data.unit:sound():play("security_camera_explode", nil, true)
			data.unit:sound():play("pot_large_shatter", nil, true)
			
			if enrage_data.played_warning then
				data.unit:sound():play("slot_machine_win", nil, true)
				enrage_data.played_warning = nil
			end
			
			enrage_data.enrage_meter = 5
		elseif not enrage_data.played_warning and enrage_data.enrage_meter > enrage_data.enrage_max * 0.75 then
			data.unit:sound():play("slot_machine_rolling_loop", nil, true)
			data.unit:sound():play("blender_loop_start", nil, true)
			data.unit:sound():play("light_bulb_smash", nil, true)

			enrage_data.played_warning = true
		end
	else
		enrage_data.enrage_meter = enrage_data.enrage_meter - dt
		
		if enrage_data.enrage_meter <= 0 then
			if enrage_data.enraged then
				enrage_data.enrage_max = 5 + math.random(0, 5)
			end
			
			enrage_data.enrage_meter = 0
			enrage_data.enraged = false
			
			if enrage_data.enrage_buff_id then
				data.unit:base():remove_buff_by_id("base_damage", enrage_data.enrage_buff_id)
				
				enrage_data.enrage_buff_id = nil
			end
		end
		
		if enrage_data.played_warning then
			data.unit:sound():play("slot_machine_loose", nil, true)
			data.unit:sound():play("blender_loop_stop", nil, true)
			data.unit:sound():play("trombone_break", nil, true)
			enrage_data.played_warning = nil
		end
	end
	
	enrage_data.last_chk_t = data.t
	
	data.enrage_data = data.enrage_data or enrage_data
end

function CopLogicAttack.aim_allow_fire(shoot, aim, data, my_data)
	local focus_enemy = data.attention_obj
	
	if shoot then 	
		if not my_data.firing then		
			data.unit:movement():set_allow_fire(true)

			my_data.firing = true
			
			if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction and not data.unit:in_slot(16) and data.char_tweak.chatter then
				if alive(focus_enemy.unit) and focus_enemy.unit:base() and focus_enemy.unit:base().sentry_gun and data.char_tweak.chatter.ready then
					managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "sentry")
				elseif data.char_tweak.chatter.aggressive then
					if managers.groupai:state():is_detection_persistent() or not data.unit:base():has_tag("law") then
						if data.important or data.unit:base():has_tag("special") then
							local said = managers.groupai:state():chk_say_enemy_chatter(data.unit, data.m_pos, "aggressive")
							
							if not said and data.unit:base():has_tag("special") then
								if not data.next_priority_speak_t or data.next_priority_speak_t < data.t then
									if data.unit:sound():say("g90", true) then
										data.next_priority_speak_t = data.t + 4
									end
								end
							end
						end
					end
				end
			end
		end
	elseif my_data.firing then
		data.unit:movement():set_allow_fire(false)

		my_data.firing = nil
	end
	
	CopLogicBase.upd_falloff_sim(data)
end

function CopLogicAttack._move_back_into_field_position(data, my_data)
	local my_tracker = data.unit:movement():nav_tracker()
	
	if my_tracker:lost() then
		local field_position = my_tracker:field_position()
		
		if mvec3_dis_sq(data.m_pos, field_position) > 900 then	
			local path = {
				mvector3.copy(data.m_pos),
				field_position
			}

			return CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos(data, my_data, path, "walk")
		end
	else
		local position = managers.navigation:pad_out_position(data.m_pos, 4, data.char_tweak.wall_fwd_offset)
		
		if mvec3_dis_sq(data.m_pos, position) > 100 then	
			local path = {
				mvector3.copy(data.m_pos),
				position
			}

			return CopLogicAttack._chk_request_action_walk_to_cover_shoot_pos(data, my_data, path, "walk")
		end
	end
end

function CopLogicAttack._get_cover_offset_pos(data, cover_data, threat_pos) --not sure if this is even doing anything useful...
	do return end


	local threat_vec = threat_pos - cover_data[1][1]

	mvector3.set_z(threat_vec, 0)

	local threat_polar = threat_vec:to_polar_with_reference(cover_data[1][2], math.UP)
	local threat_spin = threat_polar.spin
	local rot = nil

	if threat_spin < -20 then
		rot = Rotation(90)
	elseif threat_spin > 20 then
		rot = Rotation(-90)
	else
		rot = Rotation(180)
	end

	local yaw = mvector3.copy(cover_data[1][2])

	mvector3.rotate_with(yaw, rot)
	
	local offset_pos = mvector3.copy(yaw)
	
	mvector3.set_length(offset_pos, 25)
	mvector3.add(offset_pos, cover_data[1][1])

	local ray_params = {
		trace = true,
		tracker_from = cover_data[1][3],
		pos_to = offset_pos
	}

	managers.navigation:raycast(ray_params)
	
	mvector3.normalize(yaw)
	
	return ray_params.trace[1], yaw
end

function CopLogicAttack._verify_cover(cover, threat_pos, min_dis, max_dis)
	local threat_dis = mvector3.direction(temp_vec1, cover[1], threat_pos)

	if min_dis and threat_dis < min_dis or max_dis and max_dis < threat_dis then
		return
	end
	
	local cover_dot = mvector3.dot(temp_vec1, cover[2])

	if LIES.settings.lua_cover < 2 and cover_dot < 0.7 then
		return
	end

	return true
end

function CopLogicAttack._process_pathing_results(data, my_data)
	if not data.pathing_results then
		return
	end

	local pathing_results = data.pathing_results
	data.pathing_results = nil
	
	local path = pathing_results[my_data.cover_path_search_id]

	if path then
		if my_data.cover_search_t then
			local age_ms = (TimerManager:game():time() - my_data.cover_search_t) * 1000

			LIES:Sum("cover_id_age_ms", age_ms)
			LIES:Gauge("cover_id_age_ms", age_ms)
			my_data.cover_search_t = nil
		end

		my_data.processing_cover_path = nil
		my_data.cover_path_search_id = nil
	
		if path ~= "failed" then
			my_data.cover_path = path
			my_data.cover_path_failed_t = nil
		else
			LIES:Count("cover_path_failed")

			CopLogicAttack._set_best_cover(data, my_data, nil)

			my_data.cover_path_failed_t = TimerManager:game():time()
			
			if my_data.flank_cover then
				my_data.flank_cover.failed = true
			end
		end
	end

	path = pathing_results[my_data.charge_path_search_id]

	if path then
		my_data.charge_path_search_id = nil
		my_data.charge_pos = nil
	
		if path ~= "failed" then
			my_data.charge_path = path
			my_data.charge_path_failed_t = nil
		else
			my_data.charge_path_failed_t = TimerManager:game():time()
		end	
	end
	
	path = pathing_results[my_data.hide_path_search_id]
	
	if path then
		my_data.hide_path_search_id = nil
	
		if path ~= "failed" then
			my_data.flank_path = path
			my_data.flank_path_failed_t = nil
		else
			my_data.flank_path_failed_t = TimerManager:game():time()
		end	
	end

	path = pathing_results[my_data.expected_pos_path_search_id]

	if path then
		if path ~= "failed" then
			my_data.expected_pos_path = path
		end

		my_data.expected_pos_path_search_id = nil
	end
end

function CopLogicAttack._find_charge_pos(data, my_data, enemy_tracker, max_dist)
	local pos = enemy_tracker:position()
	local vec_to_pos = pos - data.m_pos

	mvector3.set_z(vec_to_pos, 0)

	local max_dis = max_dist or 1500

	mvector3.set_length(vec_to_pos, max_dis)

	local accross_positions = managers.navigation:find_walls_accross_tracker(enemy_tracker, vec_to_pos, 360, 9)

	if accross_positions then
		local optimal_dis = max_dis
		local best_error_dis, best_pos, best_is_hit, best_is_miss, best_has_too_much_error = nil

		for _, accross_pos in ipairs(accross_positions) do
			local error_dis = math.abs(mvector3.distance(accross_pos[1], pos) - optimal_dis)
			local too_much_error = error_dis / optimal_dis > 0.2
			
			if not best_error_dis or error_dis < best_error_dis then
				local reservation = {
					radius = 30,
					position = accross_pos[1],
					filter = data.pos_rsrv_id
				}

				if managers.navigation:is_pos_free(reservation) then
					best_pos = accross_pos[1]
					best_error_dis = error_dis
					best_has_too_much_error = too_much_error
				end
			end
		end

		return best_pos
	end
end

function CopLogicAttack._find_flank_pos(data, my_data, flank_tracker, max_dist)
	local pos = flank_tracker:position()
	local vec_to_pos = pos - data.m_pos

	mvector3.set_z(vec_to_pos, 0)

	local max_dis = max_dist or 1500

	mvector3.set_length(vec_to_pos, max_dis)

	local accross_positions = managers.navigation:find_walls_accross_tracker(flank_tracker, vec_to_pos, 160, 9)

	if accross_positions then
		local optimal_dis = max_dis
		local best_error_dis, best_pos, best_is_hit, best_is_miss, best_has_too_much_error = nil

		for _, accross_pos in ipairs(accross_positions) do
			local error_dis = math.abs(mvector3.distance(accross_pos[1], pos) - optimal_dis)
			local too_much_error = error_dis / optimal_dis > 0.2
			
			if not best_error_dis or error_dis < best_error_dis then
				local reservation = {
					radius = 30,
					position = accross_pos[1],
					filter = data.pos_rsrv_id
				}

				if managers.navigation:is_pos_free(reservation) then
					best_pos = accross_pos[1]
					best_error_dis = error_dis
					best_has_too_much_error = too_much_error
				end
			end
		end

		return best_pos
	end
end

function CopLogicAttack._chk_start_action_move_out_of_the_way(data, my_data)
	if my_data.advancing then
		return
	end

	LIES:Trace(data.unit, data, "move_out_lost_test", nil, lies_trace_window(data))

	local my_tracker = data.unit:movement():nav_tracker()
	
	if my_tracker:lost() then
		local field_position = my_tracker:field_position()
		
		if mvec3_dis_sq(my_tracker:position(), field_position) > 900 then	
			local path = {
				mvector3.copy(data.m_pos),
				field_position
			}
			
			local new_action_data = {
				variant = "run",
				body_part = 2,
				type = "walk",
				nav_path = path
			}
			my_data.advancing = data.unit:brain():action_request(new_action_data)

			if my_data.advancing then
				return true
			end
		end
	end
	
	local reservation = {
		radius = 30,
		position = data.m_pos,
		filter = data.pos_rsrv_id
	}

	if not managers.navigation:is_pos_free(reservation) then
		local to_pos = CopLogicTravel._get_pos_on_wall(my_tracker:position(), 500, nil, nil, nil, data.pos_rsrv_id)

		if to_pos then
			local path = {
				my_tracker:position(),
				to_pos
			}

			local new_action_data = {
				variant = "run",
				body_part = 2,
				type = "walk",
				nav_path = path
			}
			my_data.advancing = data.unit:brain():action_request(new_action_data)

			if my_data.advancing then
				return true
			end
		end
	end
end

function CopLogicAttack._chk_start_action_move_back(data, my_data, focus_enemy, engage)
	local threat_tracker = lies_enemy_tracker(focus_enemy, data)

	if not my_data.advancing and focus_enemy and threat_tracker and focus_enemy.verified and CopLogicAttack._can_move(data) then
		local from_pos = mvector3.copy(data.m_pos)
		local threat_head_pos = focus_enemy.m_head_pos
		local max_walk_dis = 400
		local vis_required = engage
		local retreat_to, is_fail = CopLogicAttack._find_retreat_position(data, from_pos, focus_enemy.m_pos, threat_head_pos, threat_tracker, max_walk_dis, vis_required)
		
		if retreat_to then
			local to_pos = retreat_to
			local second_retreat_pos, retry_is_fail
			
			if is_fail then
				second_retreat_pos, retry_is_fail = CopLogicAttack._find_retreat_position(data, retreat_to, focus_enemy.m_pos, threat_head_pos, threat_tracker, max_walk_dis, vis_required)
				
				if not retry_is_fail then
					to_pos = second_retreat_pos
				else
					second_retreat_pos = nil
				end
			end
		
			local dis = mvec3_dis_sq(from_pos, to_pos)
			
			if dis > 10000 then
				local retreat_path = {
					retreat_to
				}
				
				if second_retreat_pos then
					retreat_path[#retreat_path + 1] = second_retreat_pos
				end
				
				CopLogicAttack._correct_path_start_pos(data, retreat_path)
			
				CopLogicAttack._cancel_cover_pathing(data, my_data)

				local end_pose = "crouch"

				if data.char_tweak.allowed_poses then
					if not data.char_tweak.allowed_poses.crouch then
						end_pose = "stand"
					elseif not data.char_tweak.allowed_poses.stand then
						end_pose = "crouch"
					end
				end
				
				local speed = "walk"
				
				if not vis_required and not is_fail and dis > 40000 then
					speed = "run"
					
					if dis > 160000 and (not data.char_tweak.allowed_poses or data.char_tweak.allowed_poses.stand) then
						pose = "stand"
					end
				end

				local new_action_data = {
					variant = speed,
					body_part = 2,
					type = "walk",	
					end_pose = end_pose,
					pose = pose,
					nav_path = retreat_path
				}
				my_data.advancing = data.unit:brain():action_request(new_action_data)

				if my_data.advancing then
					my_data.surprised = true

					return true
				end
			end
		end
	end
end

function CopLogicAttack._find_retreat_position(data, from_pos, threat_pos, threat_head_pos, threat_tracker, max_dist, vis_required)
	local nav_manager = managers.navigation
	local nr_rays = 9
	local ray_dis = max_dist or 1000
	local step = 216 / nr_rays
	local offset = math.random(step)
	local dir = math.random() < 0.5 and -1 or 1
	step = step * dir
	local step_rot = Rotation(step)
	local offset_rot = Rotation(offset)
	local offset_vec = mvector3.copy(threat_pos)

	mvector3.subtract(offset_vec, from_pos)
	mvector3.normalize(offset_vec)
	mvector3.multiply(offset_vec, ray_dis)
	mvector3.rotate_with(offset_vec, Rotation((90 + offset) * dir))

	local to_pos = nil
	local is_fail_condition = nil
	local from_tracker = nav_manager:create_nav_tracker(from_pos)
	local ray_params = {
		trace = true,
		tracker_from = from_tracker
	}
	local rsrv_desc = {
		filter = data.pos_rsrv_id,
		radius = 60
	}
	local fail_position = nil
	local confirm_retreat_f = data.logic._confirm_retreat_position and data.logic._confirm_retreat_position or CopLogicAttack._confirm_retreat_position
	local confirm_retreat_visless_f = data.logic._confirm_retreat_position_visless and data.logic._confirm_retreat_position_visless or CopLogicAttack._confirm_retreat_position_visless

	repeat
		to_pos = mvector3.copy(from_pos)

		mvector3.add(to_pos, offset_vec)

		ray_params.pos_to = to_pos
		local ray_res = nav_manager:raycast(ray_params)

		if ray_res then
			local position = ray_params.trace[1]
			
			if vis_required then
				position = confirm_retreat_f(position, threat_pos, threat_head_pos, threat_tracker)
				
				if not position then
					if not fail_position then
						rsrv_desc.position = ray_params.trace[1]
						local is_free = nav_manager:is_pos_free(rsrv_desc)

						if is_free then
							fail_position = ray_params.trace[1]
							is_fail_condition = true
						end
					end
				end
			elseif not confirm_retreat_visless_f(position, threat_pos, threat_head_pos, threat_tracker) then
				if not fail_position then
					rsrv_desc.position = ray_params.trace[1]
					local is_free = nav_manager:is_pos_free(rsrv_desc)

					if is_free then
						fail_position = ray_params.trace[1]
						is_fail_condition = true
					end
				elseif mvec3_dis_sq(ray_params.trace[1], threat_pos) > mvec3_dis_sq(fail_position, threat_pos) then
					rsrv_desc.position = ray_params.trace[1]
					local is_free = nav_manager:is_pos_free(rsrv_desc)

					if is_free then
						fail_position = ray_params.trace[1]
						is_fail_condition = true
					end
				end
				
				position = nil
			end
			
			if position then
				rsrv_desc.position = position
				local is_free = nav_manager:is_pos_free(rsrv_desc)

				if is_free then
					managers.navigation:destroy_nav_tracker(from_tracker)

					return position
				end
			end
		else
			local position = ray_params.trace[1]

			if vis_required then
				position = confirm_retreat_f(position, threat_pos, threat_head_pos, threat_tracker)
			elseif not confirm_retreat_visless_f(position, threat_pos, threat_head_pos, threat_tracker) then
				position = nil
			end
			
			if position and (not fail_position or is_fail_condition or mvec3_dis_sq(position, threat_pos) > mvec3_dis_sq(fail_position, threat_pos)) then
				rsrv_desc.position = position
				local is_free = nav_manager:is_pos_free(rsrv_desc)

				if is_free then
					fail_position = position
					is_fail_condition = nil
				end
			end
		end

		mvector3.rotate_with(offset_vec, step_rot)

		nr_rays = nr_rays - 1
	until nr_rays == 0

	managers.navigation:destroy_nav_tracker(from_tracker)

	if fail_position then
		return fail_position, is_fail_condition
	end

	return nil
end

function CopLogicAttack._confirm_retreat_position_visless(retreat_pos, threat_pos, threat_head_pos, threat_tracker)
	local retreat_head_pos = mvector3.copy(retreat_pos)

	mvector3.add(retreat_head_pos, Vector3(0, 0, 90))

	local slotmask = managers.slot:get_mask("AI_visibility") + managers.slot:get_mask("enemy_shield_check")
	local ray_res = World:raycast("ray", retreat_head_pos, threat_head_pos, "slot_mask", slotmask, "ray_type", "ai_vision", "report")

	if ray_res then
		return true
	end

	return false
end

function CopLogicAttack._upd_pose(data, my_data)
	LIES:Trace(data.unit, data, "pose_upd", nil, lies_trace_window(data))

	-- Ported to 248.2: vanilla dropped the sniper-style stand/crouch visibility
	-- raycasts this function used to run (`World:raycast` per pose decision).
	-- 2026-11-01 06:09: the log stops right after `pose_upd` for a cloaker with a
	-- live enemy, i.e. inside this function, and those raycasts were its only
	-- engine calls besides the pose requests.
	local unit_can_stand = not data.char_tweak.allowed_poses or data.char_tweak.allowed_poses.stand
	local unit_can_crouch = not data.char_tweak.allowed_poses or data.char_tweak.allowed_poses.crouch
	local stand_objective = data.objective and data.objective.pose == "stand"
	local crouch_objective = data.objective and data.objective.pose == "crouch"
	local need_cover = my_data.want_to_take_cover and (not my_data.in_cover or not my_data.in_cover[4])

	if not unit_can_stand or need_cover and not stand_objective or crouch_objective then
		if not data.unit:anim_data().crouch and unit_can_crouch then
			LIES:Trace(data.unit, data, "pose_req_crouch", nil, lies_trace_window(data))

			return CopLogicAttack._chk_request_action_crouch(data)
		end
	elseif (not unit_can_crouch or (my_data.cover_test_step or 0) > 2 and not crouch_objective or stand_objective) and data.unit:anim_data().crouch and unit_can_stand then
		LIES:Trace(data.unit, data, "pose_req_stand", nil, lies_trace_window(data))

		return CopLogicAttack._chk_request_action_stand(data)
	end
end

function CopLogicAttack.action_complete_clbk(data, action)
	local my_data = data.internal_data
	local action_type = action:type()
	local highperformance = LIES.settings.highperformance

	if action_type == "walk" then
		my_data.advancing = nil
		my_data.old_action_advancing = nil
		my_data.in_cover = nil
		
		CopLogicAttack._cancel_cover_pathing(data, my_data)
		CopLogicAttack._cancel_charge(data, my_data)
		
		if my_data.surprised then
			my_data.surprised = false
		elseif my_data.moving_to_cover then
			if action:expired() then
				my_data.in_cover = my_data.moving_to_cover
				my_data.in_cover[7] = nil
				my_data.cover_enter_t = data.t
				my_data.cover_test_step = 0
				my_data.flank_cover = nil
			end

			my_data.moving_to_cover = nil
		elseif my_data.walking_to_cover_shoot_pos then
			my_data.walking_to_cover_shoot_pos = nil
			my_data.charging = nil
			
			if action:expired() then
				my_data.at_cover_shoot_pos = true
			end
		end
		
		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "act" then
		if not my_data.advancing and action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "shoot" then
		my_data.shooting = nil
	elseif action_type == "turn" then
		my_data.turning = nil
		
		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "heal" then
		CopLogicAttack._cancel_cover_pathing(data, my_data)
		
		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	elseif action_type == "hurt" or action_type == "healed" then
		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if action:expired() and not highperformance then
			if data.is_converted or not CopLogicBase.chk_start_action_dodge(data, "hit") then
				if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
					data.logic._update_cover(data)
					data.logic._upd_combat_movement(data)
					data.logic._upd_aim(data, my_data)
				end
			end
		end
	elseif action_type == "dodge" then
		local timeout = action:timeout()

		if timeout then
			data.dodge_timeout_t = TimerManager:game():time() + math.rand(timeout[1], timeout[2])
		end

		CopLogicAttack._cancel_cover_pathing(data, my_data)

		if action:expired() and not highperformance then
			if data.attention_obj and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
				data.logic._update_cover(data)
				data.logic._upd_combat_movement(data)
				data.logic._upd_aim(data, my_data)
			end
		end
	end
end

function CopLogicAttack._correct_path_start_pos(data, path)
	local first_nav_point = path[1]
	local my_pos = data.m_pos

	if first_nav_point.x ~= my_pos.x or first_nav_point.y ~= my_pos.y then
		if path[2] then
			if LIES:_path_is_straight_line(my_pos, path[2], data) then
				path[1] = mvector3.copy(my_pos)
			else
				table.insert(path, 1, mvector3.copy(my_pos))
			end
		else
			table.insert(path, 1, mvector3.copy(my_pos))
		end
	end
end

function CopLogicAttack._chk_request_action_walk_to_cover_offset_pos(data, my_data, path)
	CopLogicAttack._correct_path_start_pos(data, path)

	local haste = nil
	local pose = nil
	local i = 1
	local travel_dis = 0
	
	repeat
		if path[i + 1] then
			travel_dis = travel_dis + mvector3.distance_sq(path[i], path[i + 1])
			i = i + 1
		else
			break
		end
	until travel_dis > 160000 or i >= #path
	
	if not data.char_tweak.walk_only then
		if travel_dis > 40000 then
			haste = "run"
		end
	end
		
	if travel_dis > 160000 then
		pose = "stand"
	else
		pose = data.unit:anim_data().crouch and "crouch"
	end

	haste = haste or "walk"
	pose = pose or "stand"

	if pose == "crouch" and data.char_tweak.crouch_move ~= true then
		pose = "stand"
	end
	
	local end_pose = my_data.in_cover[4] and "stand" or "crouch"

	if data.char_tweak.allowed_poses then
		if not data.char_tweak.allowed_poses.crouch then
			pose = "stand"
			end_pose = "stand"
		elseif not data.char_tweak.allowed_poses.stand then
			pose = "crouch"
			end_pose = "crouch"
		end
	end

	local new_action_data = {
		type = "walk",
		body_part = 2,
		nav_path = path,
		variant = haste,
		pose = pose,
		end_pose = end_pose
	}
	my_data.advancing = data.unit:brain():action_request(new_action_data)

	if my_data.advancing then
		my_data.moving_to_cover = my_data.in_cover
		my_data.at_cover_shoot_pos = nil
		my_data.in_cover = nil
		
		CopLogicAttack._upd_aim(data, my_data)

		data.brain:rem_pos_rsrv("path")
		
		return true
	end
end

function CopLogicAttack._chk_request_action_walk_to_cover(data, my_data)
	LIES:Trace(data.unit, data, "action_walk_cover", nil, lies_trace_window(data))

	CopLogicAttack._correct_path_start_pos(data, my_data.cover_path)

	local haste = nil
	local pose = nil
	local i = 1
	local travel_dis = 0
	
	repeat
		if my_data.cover_path[i + 1] then
			travel_dis = travel_dis + mvector3.distance_sq(my_data.cover_path[i], my_data.cover_path[i + 1])
			i = i + 1
		else
			break
		end
	until travel_dis > 160000 or i >= #my_data.cover_path
	
	if not data.char_tweak.walk_only then
		if travel_dis > 40000 then
			haste = "run"
		end
	end
	
	if travel_dis > 160000 then
		pose = "stand"
	else
		pose = data.unit:anim_data().crouch and "crouch"
	end

	haste = haste or "walk"
	pose = pose or "stand"

	if pose == "crouch" and data.char_tweak.crouch_move ~= true then
		pose = "stand"
	end
	
	local end_pose = my_data.best_cover[4] and "stand" or "crouch"

	if data.char_tweak.allowed_poses then
		if not data.char_tweak.allowed_poses.crouch then
			pose = "stand"
			end_pose = "stand"
		elseif not data.char_tweak.allowed_poses.stand then
			pose = "crouch"
			end_pose = "crouch"
		end
	end

	local new_action_data = {
		type = "walk",
		body_part = 2,
		nav_path = my_data.cover_path,
		variant = haste,
		pose = pose,
		end_pose = end_pose
	}
	
	my_data.cover_path = nil
	my_data.advancing = data.unit:brain():action_request(new_action_data)

	if my_data.advancing then
		my_data.moving_to_cover = my_data.best_cover
		my_data.at_cover_shoot_pos = nil
		my_data.in_cover = nil

		CopLogicAttack._upd_aim(data, my_data)

		data.brain:rem_pos_rsrv("path")
		
		return true
	end

	-- The walk was refused after the path had already been consumed above, so
	-- nothing re-arms a guard: the next logic update can issue another search.
	-- Count it, and remember why, so the next issue can be attributed.
	LIES:Count("cover_walk_refused")

	my_data.cover_walk_refused_t = TimerManager:game():time()

	if data.unit:movement():chk_action_forbidden("walk") then
		LIES:Count("cover_walk_refused_movement")
	else
		LIES:Count("cover_walk_refused_action")
	end
end

function CopLogicAttack.is_available_for_assignment(data, new_objective)
	local my_data = data.internal_data

	if my_data.exiting then
		return
	end
	
	if new_objective and new_objective.attitude then
		my_data.attitude = new_objective.attitude
	end

	if new_objective and new_objective.forced then
		return true
	end
	
	if new_objective and new_objective.is_default then
		return true
	end

	if data.is_suppressed then
		if not my_data._LIES_check_suppression_deny then
			my_data._LIES_check_suppression_deny = true
			LIES:LogCheck("suppression deny unit=" .. tostring(data.unit:base()._tweak_table), "suppression_deny")
		end

		return
	end

	if data.unit:movement():chk_action_forbidden("walk") then
		return
	end

	if data.path_fail_t and data.t < data.path_fail_t + 3 then
		return
	end
	
	if CopLogicBase.check_sabotage_objective_not_allowed(data, new_objective) then
		return
	end

	local att_obj = data.attention_obj

	if not att_obj or att_obj.reaction < AIAttentionObject.REACT_AIM then
		return true
	end

	if not new_objective or new_objective.type == "free" then
		return true
	end

	if new_objective then
		local allow_trans, obj_fail = CopLogicBase.is_obstructed(data, new_objective, 0.2)

		if obj_fail then
			return
		end
	end

	return true
end

function CopLogicAttack._chk_covered(data, cover_pos, threat_pos, slotmask)
	local ray_from = temp_vec1

	mvec3_set(ray_from, math.UP)
	mvec3_mul(ray_from, 90)
	mvec3_add(ray_from, cover_pos)

	local ray_to_pos = threat_pos

	local low_ray = data.unit:raycast("ray", ray_from, ray_to_pos, "slot_mask", slotmask, "ray_type", "ai_vision", "report")
	local high_ray = nil

	if low_ray then		
		mvec3_set_z(ray_from, ray_from.z + 90)

		high_ray = data.unit:raycast("ray", ray_from, ray_to_pos, "slot_mask", slotmask, "ray_type", "ai_vision", "report")
	end

	return low_ray, high_ray
end

function CopLogicAttack._can_move(data)
	return not data.objective or not data.objective.pos
end

function CopLogicAttack._upd_stop_old_action(data, my_data)
	if data.unit:anim_data().to_idle or data.unit:anim_data().hurt then
		return
	end
	
	if my_data.advancing and my_data.old_action_advancing then
		if not data.unit:movement():chk_action_forbidden("walk") then
			data.unit:brain():action_request({
				body_part = 2,
				type = "idle"
			})
		end
	end
	
	if data.unit:movement():chk_action_forbidden("walk") then
		if not data.unit:movement():chk_action_forbidden("idle") then
			CopLogicIdle._start_idle_action_from_act(data)
		end
	elseif data.unit:anim_data().act and data.unit:anim_data().needs_idle then
		CopLogicIdle._start_idle_action_from_act(data)
	end

	CopLogicIdle._chk_has_old_action(data, my_data)
end

function CopLogicAttack._find_friend_pos(data, my_data)
	local look_for_shields = true
	
	local best_pos, best_dis, has_shield, has_medic, has_tank, chosen_u_data, best_rank
	local m_tracker = data.unit:movement():nav_tracker()
	local m_field_pos = m_tracker:field_position()
	local dis_sq = mvec3_dis_sq
	local m_key = data.key
	local try_request_stillness
	local focus_enemy = data.attention_obj
	
	if data.group then
		for u_key, u_data in pairs(data.group.units) do
			if u_key ~= m_key then
				local is_shield = look_for_shields and u_data.unit:base():has_tag("shield")
				local is_medic = u_data.unit:base():has_tag("medic")
				local is_tank = u_data.unit:base():has_tag("tank")

				if is_medic and is_tank or is_shield or is_medic or not has_medic and is_tank then
					local buddy_logic_data = u_data.unit:brain()._logic_data
					
					if buddy_logic_data and buddy_logic_data.name ~= "inactive" and buddy_logic_data.name ~= "travel" then
						local advance_pos = u_data.unit:brain() and u_data.unit:brain():is_advancing()
						local follow_unit_pos = advance_pos or u_data.unit:movement():nav_tracker():field_position()
						
						if follow_unit_pos then
							local m_dis = dis_sq(m_field_pos, follow_unit_pos)
							
							if not best_dis or best_dis < m_dis then
								best_dis = m_dis
								best_pos = follow_unit_pos
								has_shield = is_shield
								has_medic = is_medic
								has_tank = is_tank
								best_rank = u_data.rank
								chosen_u_data = u_data
								look_for_shields = not is_medic
							end
						end
					end
				end
			end
		end
	end
	
	if not best_pos and data.important then
		for u_key, u_data in pairs(managers.enemy:all_enemies()) do
			if u_key ~= m_key and alive(u_data.unit) and not u_data.unit:movement():team().foes[data.team.id] then
				local is_shield = look_for_shields and u_data.unit:base():has_tag("shield")
				local is_medic = u_data.unit:base():has_tag("medic")
				local is_tank = u_data.unit:base():has_tag("tank")

				if is_medic and is_tank or is_shield or is_medic or not has_medic and is_tank then
					local buddy_logic_data = u_data.unit:brain()._logic_data
					
					if buddy_logic_data and buddy_logic_data.name ~= "inactive" and buddy_logic_data.name ~= "travel" then
						local advance_pos = u_data.unit:brain() and u_data.unit:brain():is_advancing()
						local follow_unit_pos = advance_pos or u_data.unit:movement():nav_tracker():field_position()
						
						if follow_unit_pos then
							local m_dis = dis_sq(m_field_pos, follow_unit_pos)
							
							if m_dis < 1000000 then
								if not best_dis or best_dis < m_dis then
									best_dis = m_dis
									best_pos = follow_unit_pos
									has_shield = is_shield
									has_medic = is_medic
									has_tank = is_tank
									best_rank = u_data.rank
									chosen_u_data = u_data
									look_for_shields = not is_medic
								end
							end
						end
					end
				end
			end
		end
	end
	
	if best_pos then
		if not has_medic and not has_tank then
			try_request_stillness = true
		end
		
		return best_pos, chosen_u_data.unit, try_request_stillness
	end
end

function CopLogicAttack._update_cover(data)
	LIES:Trace(data.unit, data, "cover_upd", nil, lies_trace_window(data))

	local my_data = data.internal_data
	local cover_release_dis_sq = 10000
	local best_cover = my_data.best_cover
	local satisfied = true
	local my_pos = data.m_pos
	local enemy_tracker = lies_enemy_tracker(data.attention_obj, data)

	if data.attention_obj and enemy_tracker and AIAttentionObject.REACT_COMBAT <= data.attention_obj.reaction then
		local find_new = not my_data.moving_to_cover and not my_data.walking_to_cover_shoot_pos and not my_data.surprised and not my_data.advancing and not my_data.processing_cover_path and not my_data.charge_path_search_id

		if find_new then
			local threat_pos = enemy_tracker:field_position()
			local want_to_take_cover = my_data.want_to_take_cover
			local friend_pos, friend_unit, try_stillness
			
			if want_to_take_cover then
				friend_pos, friend_unit, try_stillness = CopLogicAttack._find_friend_pos(data, my_data)
			end
			
			if friend_pos and mvec3_dis(friend_pos, threat_pos) > mvec3_dis(my_pos, threat_pos) then
				my_data.flank_cover = nil
				
				if not best_cover or mvec3_dis_sq(best_cover[1][1], friend_pos) > 40000 or not CopLogicAttack._verify_cover(best_cover[1], threat_pos) then
					local nav_seg_id = managers.navigation:get_nav_seg_from_pos(friend_pos, true)
					local found_cover
					
					if LIES.settings.lua_cover > 1 then
						local optimal_threat_dis = mvec3_dis(friend_pos, threat_pos) + 30
						
						found_cover = managers.navigation:find_cover_from_threat(nav_seg_id, optimal_threat_dis, friend_pos, threat_pos)
					else
						found_cover = managers.navigation:find_cover_away_from_pos(friend_pos, threat_pos, nav_seg_id)
					end

					if found_cover and (not best_cover or best_cover[1] ~= found_cover) then
					
						if try_stillness then
							if alive(friend_unit) and friend_unit:brain() then
								if friend_unit:brain().request_stillness then
									friend_unit:brain():request_stillness(7.5)
								end
							end
						end
					
						--log("IT'S HAPPY HOUR!!!")
						satisfied = true
						local better_cover = {
							found_cover
						}
						
						if not best_cover or best_cover[1] ~= found_cover then
							CopLogicAttack._set_best_cover(data, my_data, better_cover)
						end

						local offset_pos, yaw = CopLogicAttack._get_cover_offset_pos(data, better_cover, threat_pos)

						if offset_pos then
							my_data.best_cover[5] = offset_pos
							my_data.best_cover[6] = yaw
						end
					end
				end
			elseif data.objective and data.objective.follow_unit and alive(data.objective.follow_unit) then
				my_data.flank_cover = nil
				
				local advance_pos = data.objective.follow_unit:brain() and data.objective.follow_unit:brain():is_advancing() --this is fucking crashing
				local near_pos = advance_pos or data.objective.follow_unit:movement():m_newest_pos()
				local dis = data.objective.distance and data.objective.distance * 0.6 or 450
				local needs_vis_cover = want_to_take_cover and LIES.settings.lua_cover > 1 and my_data.in_cover and not my_data.in_cover[3]
				
				if not best_cover or needs_vis_cover or mvec3_dis_sq(near_pos, best_cover[1][1]) > dis * dis or math.abs(best_cover[1][1].z - near_pos.z) > 250 or not CopLogicAttack._verify_cover(best_cover[1], threat_pos) then
					local follow_unit_seg = data.objective.follow_unit:movement():nav_tracker():nav_segment()
					local found_cover = managers.navigation:find_cover_in_nav_seg_3(follow_unit_seg, dis, near_pos, threat_pos)

					if found_cover and (not best_cover or best_cover[1] ~= found_cover) then
						satisfied = true
						local better_cover = {
							found_cover
						}

						if not best_cover or best_cover[1] ~= found_cover then
							CopLogicAttack._set_best_cover(data, my_data, better_cover)
							
							my_data.flank_cover = nil
						elseif my_data.flank_cover then
							my_data.flank_cover.failed = true
						end

						local offset_pos, yaw = CopLogicAttack._get_cover_offset_pos(data, better_cover, threat_pos)

						if offset_pos then
							my_data.best_cover[5] = offset_pos
							my_data.best_cover[6] = yaw
						end
					end
				end
			else
				local want_to_take_cover = my_data.want_to_take_cover
				local flank_cover = my_data.flank_cover
				local min_dis, max_dis = nil

				if want_to_take_cover then
					min_dis = my_data.weapon_range.close
				else
					max_dis = my_data.weapon_range.far
					min_dis = 100
				end

				if not best_cover or flank_cover or not CopLogicAttack._verify_cover(best_cover[1], threat_pos, min_dis, max_dis) then
					satisfied = false
					local my_vec = my_pos - threat_pos

					if flank_cover then
						local angle = flank_cover.angle
						local sign = flank_cover.sign

						if math.sign(angle) ~= sign then
							angle = -angle + flank_cover.step * sign

							if math.abs(angle) > 90 then
								flank_cover.failed = true
							else
								flank_cover.angle = angle
							end
						else
							flank_cover.angle = -angle
						end
						
						if not flank_cover.failed then
							mvector3.rotate_with(my_vec, Rotation(flank_cover.angle))
						end
					end

					local optimal_dis = my_vec:length()

					if want_to_take_cover then
						if optimal_dis < my_data.weapon_range.far then
							optimal_dis = optimal_dis < 750 and 1000 or optimal_dis + 500

							mvector3.set_length(my_vec, optimal_dis)
						end
					elseif my_data.wanted_attack_range and optimal_dis > my_data.wanted_attack_range then
						optimal_dis = my_data.wanted_attack_range
						
						mvector3.set_length(my_vec, optimal_dis)
					elseif optimal_dis > my_data.weapon_range.close then
						optimal_dis = math.max(optimal_dis - 500, optimal_dis * 0.9)

						mvector3.set_length(my_vec, optimal_dis)
					end
					
					local max_dis = optimal_dis + 800

					local my_side_pos = threat_pos + my_vec

					mvector3.set_length(my_vec, max_dis)

					local furthest_side_pos = threat_pos + my_vec

					local min_threat_dis = 100
					local cone_angle = nil

					if flank_cover then
						cone_angle = flank_cover.step
					else
						cone_angle = math.lerp(90, 30, math.min(1, optimal_dis / 3000))
					end

					local search_nav_seg = nil

					if data.objective and data.objective.type == "defend_area" then
						if data.objective.grp_objective and data.objective.grp_objective.type == "reenforce_area" or data.objective.stay_at_seg then
							search_nav_seg = data.objective.grp_objective and data.objective.grp_objective.area and data.objective.grp_objective.area.nav_segs or data.objective.nav_seg
						end
					end
					
					local found_cover
					
					if not search_nav_seg or LIES.settings.lua_cover > 1 then
						found_cover = managers.navigation:find_cover_in_cone_from_threat_pos_1(threat_pos, furthest_side_pos, my_side_pos, nil, cone_angle, min_threat_dis, search_nav_seg, nil, data.pos_rsrv_id)
					else
						if type(search_nav_seg) == "table" then
							search_nav_seg = managers.navigation._convert_nav_seg_map_to_vec(search_nav_seg)
						end
					
						local search_params = {
							variation_z = 250,
							near_pos = my_side_pos,
							threat_pos = threat_pos,
							cone_angle = cone_angle,
							min_threat_distance = min_threat_dis,
							cone_base = furthest_side_pos,
							in_nav_seg = search_nav_seg,
							rsrv_filter = data.pos_rsrv_id
						}
						
						found_cover = managers.navigation._quad_field:find_cover(search_params)
					end

					if found_cover and (not best_cover or best_cover[1] ~= found_cover) then
						satisfied = true
						local better_cover = {
							found_cover
						}

						CopLogicAttack._set_best_cover(data, my_data, better_cover)

						local offset_pos, yaw = CopLogicAttack._get_cover_offset_pos(data, better_cover, threat_pos)

						if offset_pos then
							my_data.best_cover[5] = offset_pos
							my_data.best_cover[6] = yaw
						end
					elseif my_data.flank_cover then
						my_data.flank_cover.failed = true
					end
				end
			end
		end
		
		if my_data.best_cover and cover_release_dis_sq >= mvector3.distance_sq(my_data.best_cover[1][1], my_pos) and (not my_data.in_cover or my_data.in_cover[1] ~= my_data.best_cover[1]) then
			my_data.in_cover = my_data.best_cover
			
			my_data.cover_enter_t = data.t
		end

		local in_cover = my_data.in_cover

		if in_cover then
			if cover_release_dis_sq >= mvector3.distance_sq(in_cover[1][1], my_pos) then
				local threat_pos = data.attention_obj.verified_pos
				local offset_pos, yaw = CopLogicAttack._get_cover_offset_pos(data, in_cover, threat_pos)
				
				if offset_pos then
					if in_cover[6] then
						local cover_dot = mvector3.dot(yaw, in_cover[6])

						if cover_dot < 0.9 then
							my_data.in_cover[7] = true
						end
					else
						my_data.in_cover[7] = true
					end
					
					my_data.in_cover[5] = offset_pos
					my_data.in_cover[6] = yaw
				end
				
				local peek_pos = offset_pos or in_cover[1][1]
				
				local slotmask = data.visibility_slotmask + managers.slot:get_mask("enemy_shield_check")
				
				in_cover[3], in_cover[4] = CopLogicAttack._chk_covered(data, peek_pos, threat_pos, data.visibility_slotmask)
			else
				my_data.in_cover = nil
			end
		end
	elseif best_cover and cover_release_dis_sq < mvector3.distance_sq(best_cover[1][1], my_pos) then
		CopLogicAttack._set_best_cover(data, my_data, nil)
	end
end

function CopLogicAttack._chk_exit_attack_logic(data, new_reaction)
	if not data.unit:movement():chk_action_forbidden("walk") then
		local wanted_state = CopLogicBase._get_logic_state_from_reaction(data, new_reaction)

		if wanted_state ~= data.name then
			local allow_trans, obj_failed = CopLogicBase.is_obstructed(data, data.objective, nil, nil)

			if allow_trans then
				if obj_failed then
					data.objective_failed_clbk(data.unit, data.objective)
				elseif wanted_state ~= "idle" or not managers.groupai:state():on_cop_jobless(data.unit) then
					CopLogicBase._exit(data.unit, wanted_state)
				end

				CopLogicBase._report_detections(data.detected_attention_objects)
				
				return
			end
		end
		
		if data.is_converted or data.check_crim_jobless or data.team.id == "criminal1" then
			return
		end
		
		local att_obj = data.attention_obj
		
		if data.objective and (data.objective.nav_seg or data.objective.type == "follow") and att_obj and AIAttentionObject.REACT_COMBAT <= att_obj.reaction then
			if not att_obj.lost_track then
				if att_obj.verified or att_obj.verified_t and data.t - att_obj.verified_t < 15 then
					return
				end
			end
			
			if CopLogicIdle._chk_objective_needs_travel(data, data.objective) then
				CopLogicBase._exit(data.unit, "travel")
			end
		end
	end
end
-- Instrumentation: LIES calls _cancel_cover_pathing in six places but never
-- defines it, so vanilla's body runs and — because LIES never sets
-- processing_cover_path — the cancel is a no-op. Count how often a cop abandons
-- a cover while its search is still in flight; that is the number that decides
-- whether fixing the cancel is worth any code.
if not LIES._cancel_cover_pathing_instrumented then
	LIES._cancel_cover_pathing_instrumented = true

	local lies_cancel_cover_pathing_original = CopLogicAttack._cancel_cover_pathing

	function CopLogicAttack._cancel_cover_pathing(data, my_data)
		if my_data and my_data.cover_path_search_id then
			LIES:Count("cover_abandoned_inflight")
		end

		if lies_cancel_cover_pathing_original then
			return lies_cancel_cover_pathing_original(data, my_data)
		end
	end
end

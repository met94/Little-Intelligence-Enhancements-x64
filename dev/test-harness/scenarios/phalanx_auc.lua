-- LIES dev card: put a real phalanx group on `auc` (Under the Hammer) solo,
-- then measure the wall-reservation counters.
--
-- Why this card exists: 8.57.36 made the `_get_pos_on_wall` reservation filter
-- live (the 5th argument had been ignored since 7.544). `wall_rsrv_hit` counts
-- every successful wall search made with the unit's own filter,
-- `wall_own_rsrv_hit` the subset whose only reservations belong to the unit
-- itself (points vanilla rejected before 8.57.36). The counters need a phalanx
-- group on the map, because that is where the wall searches are dense.
--
-- Two rig facts found by the first run (job-122111-685):
--   * Under the Hammer's scripted phalanx center did not fire in the rig, so the
--     position is synthesized from the player's segment.
--   * Even with `_check_spawn_phalanx_LIES` bound and running, the heist's
--     `_find_spawn_group_near_area` returns nil on `auc` solo: only a handful of
--     areas get `spawn_groups` once the assault starts and none is reachable for
--     a phalanx spawn. The search's `Application:error` is not captured in the
--     BLT log, so it fails silently.
-- The normal spawn route is therefore attempted and tuned exactly as it should
-- be, and only if it stays empty does the card promote a live assault group to
-- the phalanx group (`_phalanx_spawn_group`). That is a rig fallback, but it
-- exercises the same production path afterwards: `create_phalanx` objective ->
-- `CopLogicPhalanxMinion` travel -> wall searches and counters.
--
-- Dev-only. Run with the resident rig from the workspace root:
--   tools\pd2session.ps1 -Start -Mod .worktrees\LIES-lies-249
--   tools\pd2session.ps1 -Run .worktrees\LIES-lies-249\dev\test-harness\scenarios\phalanx_auc.lua
--
-- Game-time budget: <= 15 x 5 s of spawn waiting + 60 s of measurement = 135 s,
-- which is ~34 s of real time at 4x and well inside the 240 s job timeout.
--
-- The heist load reboots the Lua state, so this body runs twice: once at the
-- menu (it asks for the load) and once in the level (it does the measuring).
return function(H)
	H:assert_not_nil(_G.LIES, "LIES global")

	-- hhtacs is what binds `_check_spawn_phalanx_LIES` / `_spawn_phalanx_LIES`
	-- (groupaistatebesiege.lua), the variants without vanilla's
	-- `Global.game_settings.single_player` gate - a solo session otherwise never
	-- spawns a phalanx group at all. Settings live in the Lua state and are
	-- re-read from the save file after a heist load, so this line runs on both
	-- passes; in-level the `GroupAIStateBesiege` update hook repairs the binding
	-- if `init` ran before it.
	LIES.settings.hhtacs = true
	H:log("hhtacs=%s", tostring(LIES.settings.hhtacs))

	H:ensure_heist("auc", "overkill_290")
	H:await_heist(300000)

	H:wait(2000)

	-- Deterministic spawn: first chance is 100%, the ceiling is the same, and the
	-- check runs every 2 s instead of every 120 s. `chance_increase_intervall` is
	-- irrelevant once start == max.
	local phalanx_tweak = tweak_data.group_ai.phalanx
	phalanx_tweak.spawn_chance.start = 1
	phalanx_tweak.spawn_chance.max = 1
	phalanx_tweak.check_spawn_intervall = 2
	H:log("phalanx tweak: spawn_chance.start=1 max=1 check_spawn_intervall=2")

	H:log("force_assault -> %s", tostring(H:force_assault()))
	H:log("begin_assault_at_player -> %s", tostring(H:begin_assault_at_player("phalanx auc")))

	-- Game time: `H:wait` and the assault clock both use it, so a 5 s cycle costs
	-- 1.25 s of real time at 4x.
	H:speed_up("phalanx_auc", 4, 900)

	local state = managers.groupai:state()
	local binding = state._check_spawn_phalanx == state._check_spawn_phalanx_LIES
	H:log("phalanx binding=%s", binding and "LIES" or "VANILLA")

	local function minion_count()
		local ok, minions = pcall(function()
			return managers.groupai:state():phalanx_minions()
		end)

		if not ok or type(minions) ~= "table" then
			return 0
		end

		local count = 0

		for _ in pairs(minions) do
			count = count + 1
		end

		return count
	end

	local function counters()
		local watch = LIES.watch_counters or {}

		return watch.wall_rsrv_hit or 0, watch.wall_own_rsrv_hit or 0
	end

	-- One readable snapshot per cycle: the gates the phalanx spawn walks (center,
	-- assault phase, spawn group, spawned) plus the minion count.
	local function snapshot(cycle)
		local group_ai = managers.groupai:state()
		local assault = group_ai._task_data and group_ai._task_data.assault
		local group = group_ai._phalanx_spawn_group
		local snap = {
			center = group_ai._phalanx_center_pos ~= nil,
			phase = assault and tostring(assault.phase) or "nil",
			spawn_group = group ~= nil,
			spawned = group and group.has_spawned or false,
			minions = minion_count()
		}

		H:log("cycle=%d center=%s phase=%s spawn_group=%s spawned=%s minions=%d",
			cycle, tostring(snap.center), snap.phase, tostring(snap.spawn_group),
			tostring(snap.spawned), snap.minions)

		return snap
	end

	local function player_field_pos()
		local ok, pos = pcall(function()
			local player = H:player()
			local tracker = managers.navigation:create_nav_tracker(player:movement():m_pos())
			local field_pos = mvector3.copy(tracker:field_position())
			managers.navigation:destroy_nav_tracker(tracker)

			return field_pos
		end)

		if not ok or not pos then
			H:log("nav-tracker field position unavailable: %s", tostring(pos))

			return nil
		end

		return pos
	end

	-- Under the Hammer normally sets `_phalanx_center_pos` through a scripted
	-- phalanx special objective (GroupAIStateBase:add_special_objective). That
	-- event did not fire in the rig, so synthesize the position from the player's
	-- segment once instead of failing on scenario setup.
	local function synthesize_center()
		local pos = player_field_pos()

		if not pos then
			return false
		end

		managers.groupai:state()._phalanx_center_pos = pos
		H:log("center synthesized from the player's nav-tracker field position")

		return true
	end

	-- Rig fallback: promote the live assault group with the most living units to
	-- the phalanx group. `_check_phalanx_group_has_spawned` then assigns the real
	-- `create_phalanx` objective, the units become phalanx minions and the normal
	-- travel logic runs; only the heist's spawn-group search is bypassed.
	local function promote_live_group()
		local group_ai = managers.groupai:state()
		local chosen

		for id, group in pairs(group_ai._groups or {}) do
			local live = 0

			for _, group_unit in pairs(group.units or {}) do
				if group_unit.unit and H:unit_alive(group_unit.unit) then
					live = live + 1
				end
			end

			if live > 0 and (not chosen or live > chosen.live) then
				chosen = { id = id, group = group, live = live }
			end
		end

		if not chosen then
			H:log("promotion fallback: no live assault group to promote")

			return false
		end

		if not group_ai._phalanx_center_pos then
			H:log("promotion fallback: no center position, not promoting")

			return false
		end

		chosen.group.has_spawned = true
		group_ai._phalanx_spawn_group = chosen.group
		H:log("promotion fallback (rig only): group=%s live=%d promoted to the phalanx group; the heist's spawn-group search finds nothing on auc solo",
			tostring(chosen.id), chosen.live)

		return true
	end

	local SYNTH_AFTER_CYCLES = 10
	local SPAWN_CYCLES = 15
	local MEASURE_CYCLES = 12
	local last = nil
	local found = false

	for cycle = 1, SPAWN_CYCLES do
		H:wait(5000)
		last = snapshot(cycle)

		if cycle == SYNTH_AFTER_CYCLES then
			if not last.center then
				synthesize_center()
				last = snapshot(cycle)
			end

			if not last.spawn_group then
				promote_live_group()
			end
		end

		if last.minions > 0 then
			found = true

			break
		end
	end

	if not found then
		H:finish("FAIL", string.format(
			"no phalanx minions after %d cycles; last center=%s phase=%s spawn_group=%s spawned=%s minions=%d",
			SPAWN_CYCLES, tostring(last and last.center), tostring(last and last.phase),
			tostring(last and last.spawn_group), tostring(last and last.spawned),
			last and last.minions or 0))

		return
	end

	-- Measurement window: 60 s of game time (12 x 5 s) with the counters logged
	-- every cycle, so a read can see when they move instead of only the total.
	-- The promotion lands at ~50 s, so the whole card stays under 135 s of game
	-- time.
	local wall_rsrv_hit, wall_own_rsrv_hit = 0, 0

	for cycle = 1, MEASURE_CYCLES do
		H:wait(5000)
		wall_rsrv_hit, wall_own_rsrv_hit = counters()
		H:log("measure=%d minions=%d wall_rsrv_hit=%d wall_own_rsrv_hit=%d",
			cycle, minion_count(), wall_rsrv_hit, wall_own_rsrv_hit)
	end

	local minions = minion_count()
	wall_rsrv_hit, wall_own_rsrv_hit = counters()
	H:log("result minions=%d wall_rsrv_hit=%d wall_own_rsrv_hit=%d",
		minions, wall_rsrv_hit, wall_own_rsrv_hit)

	-- PASS means "the end-to-end path produced a live phalanx group and the
	-- counters were readable". The counter values are the measurement, and zero
	-- on `wall_own_rsrv_hit` is a result, not a failure.
	H:finish("PASS", string.format(
		"phalanx minions=%d wall_rsrv_hit=%d wall_own_rsrv_hit=%d after 60 s",
		minions, wall_rsrv_hit, wall_own_rsrv_hit))
end

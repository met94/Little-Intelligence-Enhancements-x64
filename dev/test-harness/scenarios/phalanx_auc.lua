-- LIES dev card: spawn a real phalanx group on `auc` (Under the Hammer) solo,
-- then read the wall-reservation counters.
--
-- Why this card exists: 8.57.36 made the `_get_pos_on_wall` reservation filter
-- live (the 5th argument had been ignored since 7.544). `wall_rsrv_hit` counts
-- every successful wall search made with the unit's own filter,
-- `wall_own_rsrv_hit` the subset whose only reservations belong to the unit
-- itself (points vanilla rejected before 8.57.36). The counters need a phalanx
-- group on the map, because that is where the wall searches are dense.
--
-- Dev-only. Run with the resident rig from the workspace root:
--   tools\pd2session.ps1 -Start -Mod .worktrees\LIES-lies-249
--   tools\pd2session.ps1 -Run .worktrees\LIES-lies-249\dev\test-harness\scenarios\phalanx_auc.lua
--
-- The heist load reboots the Lua state, so this body runs twice: once at the
-- menu (it asks for the load) and once in the level (it does the measuring).
return function(H)
	H:assert_not_nil(_G.LIES, "LIES global")

	-- hhtacs is what binds `_check_spawn_phalanx_LIES` / `_spawn_phalanx_LIES`
	-- (groupaistatebesiege.lua), the variants without vanilla's
	-- `Global.game_settings.single_player` gate - a solo session otherwise never
	-- spawns a phalanx group. Settings live in the Lua state and are re-read from
	-- the save file after a heist load, so this line runs on both passes; in-level
	-- the `GroupAIStateBesiege` update hook repairs the binding if `init` ran
	-- before it.
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

	-- Under the Hammer normally sets `_phalanx_center_pos` through a scripted
	-- phalanx special objective (GroupAIStateBase:add_special_objective). If that
	-- event did not fire, synthesize the position from the player's segment once,
	-- so the card measures the wall search instead of failing on scenario setup.
	local function synthesize_center()
		local ok, pos = pcall(function()
			local player = H:player()
			local tracker = managers.navigation:create_nav_tracker(player:movement():m_pos())
			local field_pos = mvector3.copy(tracker:field_position())
			managers.navigation:destroy_nav_tracker(tracker)

			return field_pos
		end)

		if not ok or not pos then
			H:log("center synthesis failed: %s", tostring(pos))

			return false
		end

		managers.groupai:state()._phalanx_center_pos = pos
		H:log("center synthesized from the player's nav-tracker field position")

		return true
	end

	local SYNTH_AFTER_CYCLES = 10
	local last = nil
	local found = false

	for cycle = 1, 60 do
		H:wait(5000)
		last = snapshot(cycle)

		if cycle == SYNTH_AFTER_CYCLES and not last.center then
			synthesize_center()
			last = snapshot(cycle)
		end

		if last.minions > 0 then
			found = true

			break
		end
	end

	if not found then
		H:finish("FAIL", string.format(
			"no phalanx minions after 60 cycles; last center=%s phase=%s spawn_group=%s spawned=%s",
			tostring(last and last.center), tostring(last and last.phase),
			tostring(last and last.spawn_group), tostring(last and last.spawned)))

		return
	end

	-- Let the squad search for wall positions for a few seconds of game time
	-- (10 s at 4x is 2.5 s real) before reading the counters.
	H:wait(10000)

	local minions = minion_count()
	local counters = LIES.watch_counters or {}
	local wall_rsrv_hit = counters.wall_rsrv_hit or 0
	local wall_own_rsrv_hit = counters.wall_own_rsrv_hit or 0
	H:log("result minions=%d wall_rsrv_hit=%d wall_own_rsrv_hit=%d",
		minions, wall_rsrv_hit, wall_own_rsrv_hit)

	-- PASS means "the end-to-end path produced a live phalanx group and the
	-- counters were readable". The counters are the measurement, and they
	-- legitimately start at zero on a group that has not searched walls yet.
	if minions > 0 then
		H:finish("PASS", string.format("phalanx minions=%d wall_rsrv_hit=%d wall_own_rsrv_hit=%d",
			minions, wall_rsrv_hit, wall_own_rsrv_hit))
	else
		H:finish("FAIL", string.format(
			"minions dropped to 0 in the 10 s window; wall_rsrv_hit=%d wall_own_rsrv_hit=%d",
			wall_rsrv_hit, wall_own_rsrv_hit))
	end
end

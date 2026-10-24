# SDD progress — plan: dev/port-248-plan.md

Baseline: 246.1 (`a3180fc`). Target: 248.2 (`e3a8b616`). Mod: V8.57 (`4215a39`).

Docs: `dev/reports/port-status.md` (status/backlog), `dev/reports/port-decisions.md` (keep/merge per function), `dev/reports/port-drop-log.md` (dropped/removed functions and why), `dev/reports/nav-b-feasibility.md` (Nav-B design), `dev/reports/future-updates.md` (next game update), `dev/reports/handoff-2026-10-24.md` (next-session handoff), `dev/reports/phalanx-marshal-decision.md` (open decisions).

## P0

- Task 1: import + worktree + plan — complete.
- Task 2: fn-ledger — complete. Tests: `node --test dev/tools/test/fn-ledger.test.mjs` 17/17. Output: `dev/port-248-ledger.md`, `dev/reports/port-248-ledger.json`. Counts: 548 top-level functions (509 overrides/helpers + 39 top-level hook callbacks), 34 PORT, 183 MOD_ONLY, 39 hook callbacks, 287 keep, 2 delete, 1 local-helper keep, 2 drop/rewrite, 3 unhooked files (`copinventory`, `elementnavobstacle`, `playerfatal`).
- Task 3: fn-workbench — complete. Tests: `node --test dev/tools/test/fn-workbench.test.mjs` 4/4. Sample dossier: `dev/reports/dossiers/coplogicattack.is_available_for_assignment.md`.
- Task 4: api-audit — complete. Tests: `node --test dev/tools/test/api-audit.test.mjs` 8/8. Report: `dev/reports/api-audit.md` (68/68 hooks ok, 44/44 hook methods ok, 50 errors, 154 review). Cross-file nav findings: `groupaistatebesiege` uses removed `get_nav_segments_in_direction` (3x) and `_room_doors` (2x); `coplogictravel` uses `_room_doors` (1x).
- Task 5: log-scan — complete. Tests: `node --test dev/tools/test/log-scan.test.mjs` 10/10. Sample report: `dev/reports/log-scan-sample.md` (correctly FAIL: LIES not loaded). Exact `Setting up mod 'LIES'` match excludes the Joker Tweaks standalone and test harness; `[LIES-TEST] ERROR` fails the scan.
- Task 6: test harness — complete. Lua parser test: `tools\luajit\luajit.exe dev/test-harness/test/test_commands.lua` pass. Commands: nav, cover, assault, setting, dump, help.
- Task 7: generate ledger + reports + gates — complete. `dev/tools/gates.ps1` passes: 35 Node tests, Lua parser test, 71/71 runtime Lua files compile, ledger and API audit regenerate. API audit gates on a 50-error baseline; increases fail the gate.
- Task 8: build + baseline instructions — complete. `dev/build.ps1` produces `dist/LIES` (71 Lua files, dev excluded); marker is written before copy so failed builds remain cleanable. `dev/BASELINE.md` has the 2-minute run.
- Task 9: reviewer pass + baseline log — reviewer FIX-REQUIRED, fixes applied. Baseline log captured: native crash at load-in.

## P1 bootstrap

- Baseline: native crash while loading `Jewelry Store`. Log ends at `Map has 58 cover points, setting generation limit to 640 cover points.` No Lua traceback. This line is LIES `register_cover_units`; the next code is the v5 room/cover generation loop. Evidence: `dev/reports/baseline-crash.md`.
- Patch: disabled the v5 generation block (`if false and Network:is_server()`), added lost-tracker/nil-segment/tracker-leak guards, made `_covers` registration unconditional in the no-cover-data branch, and disabled the custom LUA cover swap for the bootstrap.
- Reviewer verdict: PASS for the bootstrap goal. Remaining nit: 91 lines of dead v5 generation retained for Nav-B reference.
- Static gates: 49 API errors (down 1), 154 review, 68/68 hooks, 44/44 methods, 71/71 Lua compile.
- Smoke 2 (build `0e4709c`): no crash. Loaded `Jewelry Store`; harness reports `nav segments=40 missing_neighbours=0 doors(vector=0 numeric=0 links=555) covers=58 bad_covers=0`; cover probe found cover. `!lies assault` set assault mode, but no units spawned. Likely alarm not actually triggered; `set_assault_mode` alone is not a spawn trigger.
- Ported `GroupAIStateBesiege:_queue_police_upd_task` to the 248.2 timestamp scheduler and removed the reschedule call from `_upd_police_activity`. This is the known 247 police-activity breakage. Harness gained `!lies alarm` and `!lies state`.
- Smoke 3: use `!lies alarm`, then `!lies state` before/after 45 s. `state` reports server, police-called, weapons-hot, assault mode/task, scheduler value/type, groups, spawning, cops.
- Smoke 3 result: no load crash. State before alarm: `is_server=true police_called=nil weapons_hot=nil assault_mode=false queued=10.0(number) groups=3 spawning=0 cops=5`. After alarm: `police_called=true weapons_hot=true assault_mode=true queued=18.0(number) groups=3 spawning=0 cops=5`. No SWAT yet. Crash occurred ~20 s later while shooting a guard.
- Crash root cause from `%LOCALAPPDATA%\PAYDAY 2\crash.txt`: `enemymanager.lua:760: attempt to compare number with nil`, stack `chk_queue_disposal() @mods/LIES/lua/managers/enemymanager.lua:42` -> `add_delayed_clbk(..., t)` with nil `t`. LIES's v246 disposal overrides are incompatible with 248.2 timers.
- Fix: removed LIES's EnemyManager overrides entirely; vanilla 248.2 timer-based disposal/task queue handles it. API audit errors drop 46 -> 21.
- Smoke 4 result: no load crash; alarm raised; after 60 s `groups=1 spawning=1 cops=1`, then native crash as SWAT should arrive. Crash stack: `_set_assault_objective_to_group()` at `groupaistatebesiege.lua:2880` -> `_assign_enemy_groups_to_assault()` -> vanilla `_upd_assault_task`.
- Fix: ported the smoke/flash grenade door handling to v6 vectors (no `_room_doors`, handle `door.x` vs nav links) and added a v6 `NavigationManager:get_nav_segments_in_direction` helper (direct neighbours by dot product). Nil-guarded segment-area lookups in the two blockade loops. API audit errors 21 -> 20.
- Smoke 5 (build `db45f63`): success. `!lies alarm`, waited 60 s, then shot a guard. State: `assault_active=true`, `groups=3->4`, `spawning=0`, `cops=12->11`, scheduler timestamp. SWAT arrived; guard death did not crash; `%LOCALAPPDATA%\PAYDAY 2\crash.txt` timestamp unchanged. Basic loud flow works.
- Next: opt-in Nav-A test. Re-enable the custom LUA cover search branch (`lua_cover >= 2`) over vanilla `_covers`; leave default off. Harness `!lies setting lua_cover 2` calls `_change_funcs`, and `!lies cover` exercises the custom search.
- Smoke 6 (build `1cd6baa`): success. `lua_cover=2`, custom LUA search ran (`mode=2`, seg 15/20), found cover, SWAT reached 16 cops / 7 groups / assault active, no crash; `crash.txt` unchanged. Nav-A custom search over vanilla v6 covers works.
- Nav-B implemented behind `lua_cover >= 2`: delayed/sliced generation from nav segments, doorway seeds + engine sampler + wall fan, 90-unit spatial-hash dedupe, per-segment 16 / total 2048 caps, tracker ownership via `insert_cover`. Harness `!lies gen probe|run`. Spec: `dev/reports/nav-b-feasibility.md`. Gates pass; reviewer findings fixed (Path A door cache, per-segment cap, candidate budget, jitter, sample-fail counting, probe clamp).
- Nav-B smoke: automatic pass on Jewelry Store inserted 95 covers (58 -> 272) across 33 segments in 1221 ms; `sample_fail=0`, `seg_mismatch=70`, `wall_fail=41`, `fwd_fail=32`; no crash; custom LUA search found a cover. Harness `gen` clamp used `math_clamp` (nil) — fixed to `math.clamp`.
- Cleanup: removed temporary `[LIES-TRACE]` logs; removed 7 dead v5 functions (`find_segment_doors_with_nav_links`, `_draw_rooms_LIES`, `_draw_doors_LIES`, `_LIES_register_cover`, `send_nav_field_to_engine`, `_strip_nav_field_for_gameplay`, `CopLogicTravel.find_door_pos_nearest_to_next_nav_seg`). Tuned generation slices to 4 segments / 32 candidates / 0.1 s. API audit errors 20 -> 0.
- Ported `GroupAIStateBesiege.force_end_assault_phase` to the 248.2 timestamp poke (no delayed-clbk reschedule).
- Dossiers generated for the remaining core-AI/special/carry port functions; status/backlog in `dev/reports/port-status.md`.
- P0 nav fixes: `set_nav_segment_state` now stringifies ids (`tostring(id)`) for `_nav_segments`/`_quad_field`; `add_obstacle` adopts the 248.2 nil guard + destroy listener and keeps LIES cache invalidation.
- Nav-B review fixes: persistent per-segment generated-cover counter, abort on `_clear`/`_unregister_cover_units`, bounded/pcall pending-clbk cleanup, pcall schedule, removed unused `math_clamp`/`_LIES_navlink_elements`/dead comments, probe clamp 4 segments/16 candidates.
- Offline safe pass: restored `_LIES_navlink_elements` (elementspecialobjective writer), logged nonexistent nav segments, ported `set_nav_segment_state` string keys and `add_obstacle` 248.2 guards/listener, added `MENU_OPTIONS.md`, added freevars gate (68 files, 0 findings), API errors 0. Build `2f54644`.
- Next test when available: level-change/abort check (load heist, `lua_cover 2`, `gen run`, quit to menu, load another heist, `!lies nav`/`!lies cover`), then a specials/hostage/bot smoke.
- Static merges applied: `CopLogicAttack.action_complete_clbk` (`math.rand`), `CopLogicAttack.is_available_for_assignment` (suppression gate), `CopLogicIdle.damage_clbk` (`data.t = t`), `TaserLogicAttack._chk_play_charge_weapon_sound` (vertical guard). These need a suppression/taser smoke.
- Shield/Carry merges applied: `ShieldLogicAttack.queued_update` reservation split (70 radius kept) and `CarryData._chk_register_steal_SO` 248.2 guard/helper merge plus nil drop-point fall-through fix. Need shield/bag smoke.
- Compatibility audit: NavFixes hard-conflicts (signature overwrite); LIES absorbed its two remaining nav guards but NavFixes must still be disabled. Keepers owns two idle functions; Useful Bots owns bot AI; pin Monkeepers to 99. Report: `dev/reports/compatibility.md`.
- Core AI gap audit: AI-01 `_upd_aim` raw v6 doors fixed; AI-02 `find_segment_doors` raw nav-link positions fixed (vanilla phalanx crash route removed); AI-03 phalanx aliases deferred; AI-04 marshal downgrade documented; AI-05 no change; AI-06 latent. Report: `dev/reports/core-ai-gap-audit.md`.
- HHTACS H-01/H-09 fixed. Phalanx decisions: keep solo behavior; move respawn key to `spawn_chance.respawn_delay`; leave phalanx aliases vanilla. Marshal mapping kept (intentional LIES behavior); revisit only if stuck.
- HHTACS H-02/H-03/H-04/H-05 closed (`9dec81a`): hhtacs-only respawn key; phalanx spawn call dropped the unsupported 6th arg; `_find_spawn_group_near_area` enforces linear `max_dis` while keeping it as the weight scale; deleted the five-function dead recon-sweep subsystem and its fork. Regression tests: `dev/tools/test/runtime-audit.test.mjs`. Gates: 45 Node tests, 71/71 Lua compile, freevars 0, API errors 0.


## Rulings

- Task 2: Ledger scope is top-level function definitions; nested helpers are folded into their parent body. Cost if wrong: a nested helper with independent API drift is not visible as its own row, but the parent is marked PORT and its dossier shows the full body.
- Task 2: Local helpers identical to vanilla are `SAME_AS_OLD_VANILLA_LOCAL` and kept, not deleted. Cost if wrong: unused local helper remains in the shipped file (harmless); deleting it would risk breaking LIES callers.
- Task 2: Progress ledger is `dev/progress.md`; function ledger is `dev/port-248-ledger.md`. Cost if wrong: confusion between generated and hand-maintained files.
- Task 2: Top-level hook callbacks are `MOD_ONLY_HOOK` rows. Five more registrations are nested inside `GroupAIStateBesiege.init` and are ported with that parent; `playerfatal.lua` is currently unhooked and flagged as dead code. Cost if wrong: a nested hook could be missed, but its parent dossier contains the full body.
- Task 4: Hook-method checks fall back to any class defining the method; two inherited methods (`GroupAIStateBesiege.on_criminal_nav_seg_change`, `MenuNodeGui._setup_item_rows`) pass as `ok (base)`. Cost if wrong: a method removed from the concrete class but present on an unrelated class could pass; the report shows `ok (base)` for review.
- Task 5: LIES-context errors are any Lua error in a LIES-hooked file after the LIES setup line. This is intentionally conservative; cost if wrong: an unrelated vanilla error in a hooked file can fail the smoke gate.
- Task 7: API audit gate uses a recorded 50-error baseline; increases fail. Cost if wrong: a new error that replaces an old error without changing the count passes; the report still lists it for review.
- H-04: `_find_spawn_group_near_area` compares the linear cached path distance to the linear `max_dis`, not vanilla's `max_dis * max_dis`. Vanilla's squared comparison is inert because the cached distance is linear; no current caller passes `max_dis`. Cost if wrong: a future caller gets a true cap rather than vanilla's effectively-unbounded one.

## Review fixes (P0)

Reviewer verdict: FIX-REQUIRED (1 critical, 13 important).

- Fixed critical: `log-scan` now fails when LIES never loads (`setup=0`).
- Fixed: build marker written before copy; failed builds remain cleanable.
- Fixed: harness `dump` guards nil `LIES.settings`.
- Fixed: API audit masks long comments and strings across lines.
- Fixed: API audit extracts and verifies 44 `Hooks:PostHook/PreHook` methods; 44/44 pass (2 inherited).
- Fixed: removed dead `session():peer` symbol entry.
- Fixed: tools resolve the workspace root and game clone after merge into `mods/LIES`.
- Fixed: ledger records 39 top-level hook callbacks and flags 3 unhooked files.
- Fixed: gates guard missing LuaJIT and fail API-audit regressions above baseline.
- Fixed: log-scan exact setup match, harness-error failure, and setup-before-error ordering.


# SDD progress — plan: dev/port-248-plan.md

Baseline: 246.1 (`a3180fc`). Target: 248.2 (`e3a8b616`). Mod: V8.57 (`4215a39`).

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


## Rulings

- Task 2: Ledger scope is top-level function definitions; nested helpers are folded into their parent body. Cost if wrong: a nested helper with independent API drift is not visible as its own row, but the parent is marked PORT and its dossier shows the full body.
- Task 2: Local helpers identical to vanilla are `SAME_AS_OLD_VANILLA_LOCAL` and kept, not deleted. Cost if wrong: unused local helper remains in the shipped file (harmless); deleting it would risk breaking LIES callers.
- Task 2: Progress ledger is `dev/progress.md`; function ledger is `dev/port-248-ledger.md`. Cost if wrong: confusion between generated and hand-maintained files.
- Task 2: Top-level hook callbacks are `MOD_ONLY_HOOK` rows. Five more registrations are nested inside `GroupAIStateBesiege.init` and are ported with that parent; `playerfatal.lua` is currently unhooked and flagged as dead code. Cost if wrong: a nested hook could be missed, but its parent dossier contains the full body.
- Task 4: Hook-method checks fall back to any class defining the method; two inherited methods (`GroupAIStateBesiege.on_criminal_nav_seg_change`, `MenuNodeGui._setup_item_rows`) pass as `ok (base)`. Cost if wrong: a method removed from the concrete class but present on an unrelated class could pass; the report shows `ok (base)` for review.
- Task 5: LIES-context errors are any Lua error in a LIES-hooked file after the LIES setup line. This is intentionally conservative; cost if wrong: an unrelated vanilla error in a hooked file can fail the smoke gate.
- Task 7: API audit gate uses a recorded 50-error baseline; increases fail. Cost if wrong: a new error that replaces an old error without changing the count passes; the report still lists it for review.

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


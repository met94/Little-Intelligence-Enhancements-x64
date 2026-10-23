# SDD progress — plan: dev/port-248-plan.md

Baseline: 246.1 (`a3180fc`). Target: 248.2 (`e3a8b616`). Mod: V8.57 (`4215a39`).

## P0

- Task 1: import + worktree + plan — complete.
- Task 2: fn-ledger — complete. Tests: `node --test dev/tools/test/fn-ledger.test.mjs` 15/15. Output: `dev/port-248-ledger.md`, `dev/reports/port-248-ledger.json`. Counts: 509 top-level functions, 34 PORT, 183 audit, 287 keep, 2 delete, 1 local-helper keep, 2 drop/rewrite.
- Task 3: fn-workbench — complete. Tests: `node --test dev/tools/test/fn-workbench.test.mjs` 4/4. Sample dossier: `dev/reports/dossiers/coplogicattack.is_available_for_assignment.md`.
- Task 4: api-audit — complete. Tests: `node --test dev/tools/test/api-audit.test.mjs` 5/5. Report: `dev/reports/api-audit.md` (68/68 hooks ok, 51 errors, 156 review). Cross-file nav findings: `groupaistatebesiege` uses removed `get_nav_segments_in_direction` (3x) and `_room_doors` (2x); `coplogictravel` uses `_room_doors` (1x).
- Task 5: log-scan — todo.
- Task 6: test harness — todo.
- Task 7: generate ledger + reports + gates — todo.
- Task 8: build + baseline instructions — todo.
- Task 9: reviewer pass + baseline log — todo.

## Rulings

- Task 2: Ledger scope is top-level function definitions; nested helpers are folded into their parent body. Cost if wrong: a nested helper with independent API drift is not visible as its own row, but the parent is marked PORT and its dossier shows the full body.
- Task 2: Local helpers identical to vanilla are `SAME_AS_OLD_VANILLA_LOCAL` and kept, not deleted. Cost if wrong: unused local helper remains in the shipped file (harmless); deleting it would risk breaking LIES callers.
- Task 2: Progress ledger is `dev/progress.md`; function ledger is `dev/port-248-ledger.md`. Cost if wrong: confusion between generated and hand-maintained files.

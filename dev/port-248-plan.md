# LIES 248.2 port — execution plan

Status: P0 in progress.
Baseline: LIES V8.57 (`4215a39`), authored against game 246.1 (`a3180fc`).
Target: game 248.2 (`e3a8b616`).

## Rules

- 248.2 vanilla is the source of truth. Never carry a stale 246.1 body unless the ledger says `keep` for a deliberate LIES edit.
- Every mod-defined function has a ledger row. No unlogged changes.
- One writer per file. Feature work in a linked worktree, never in `mods/LIES` main.
- Static gates before review; reviewer before merge; user approves merges.
- Agents never deploy to the game. The user copies builds.

## Phases

| Phase | Scope | Hours | Gate |
|---|---|---:|---|
| P0 | Bootstrap: import, ledger, workbench, API audit, log scanner, test harness, baseline build | 12 | P0 tools tested; ledger generated; baseline log captured |
| P1a | Nav spike: prove custom search + cover generation on v6 | 4 | Go/no-go doc |
| P1b | Nav-A: v6 doors, coarse search, path cache, custom cover scoring | 20 | Nav probe smoke test |
| P1c | Nav-B: runtime cover generation from nav segments | 10 | Generated covers on test maps |
| P1d | Nav call sites: Attack/Travel/Besiege/CivTravel/Base | 6 | Zero v5 assumptions |
| P2 | Crash/API: EnemyManager, Besiege scheduler, GroupAIManager, lifecycles, network | 12 | 15-min loud heist clean |
| P3 | Core AI: CopLogicBase/Attack/Idle/Travel, Brain/Movement/Damage/Actions, specials | 16 | Combat checklist |
| P4 | Group AI + data: GroupAIStateBase/Besiege, tweak data, hhtacs | 12 | Full assault cycle |
| P5 | Periphery: team AI, civilians, props, mission, menu, player | 8 | Bots/hostages/props |
| P6 | Integration: static suite, ledger closure, settings, compatibility | 8 | Reviewer + suite |
| P7 | Stabilization: deep matrix, fixes, docs, package | 16 | User sign-off |

## P0 tasks

1. Import upstream V8.57, create worktree, write plan + progress ledger.
2. `dev/tools/fn-ledger.mjs`: classify every mod function vs 246.1/248.2; tests first.
3. `dev/tools/fn-workbench.mjs`: dump three bodies + two diffs for one function; tests first.
4. `dev/tools/api-audit.mjs`: removed-symbol grep, hook existence, numeric segment audit; tests first.
5. `dev/tools/log-scan.mjs`: parse BLT log for LIES errors; tests first.
6. `dev/test-harness/`: chat commands `!lies nav|cover|assault|setting|dump|help`.
7. Generate `dev/port-248-ledger.md` and `dev/reports/*`; run static gates.
8. `dev/build.ps1`: package clean `dist/LIES`; `dev/BASELINE.md`: 2-min baseline test.
9. Reviewer pass over P0 diff; user runs baseline; capture log.

## Test model

- Smoke: 2–3 min after every merged unit. Boot, load `Jewelry Store` Normal, run `!lies nav`, `!lies cover`, trigger alarm, `!lies assault`, observe, quit, send log.
- Deep: 15–30 min at phase gates. Full matrix: stealth, loud, specials, hostages, bots, props, player states, settings.
- Static: `luajit -bl`, `lua-check.mjs`, `lua-freevars`, `api-audit`, ledger completeness.

## Known decisions

- Nav first after bootstrap. Full parity including custom nav is the target.
- Nav-A (custom search/cache) before Nav-B (runtime cover generation). Spike gates Nav-B.
- Absorb `NavFixes` guards into LIES; `NavFixes` is redundant when LIES is installed.
- Test in a clean profile first: no `NavFixes`, `Useful Bots`, `Keepers`, `Iter Lite`.
- Mod name `LIES` stays unchanged (dependency key).

# LIES — future game-update guide

Use this when PAYDAY 2 ships a new build and LIES needs another port. It assumes
the workspace layout at `D:\Programowanie\payday\2\v2`.

## 0. Ground rules

- LIES files are **full-function overrides loaded after the vanilla file**, not
  small wrappers. Any function copied from an old game build silently reverts
  newer vanilla behaviour. The port is a function-level rebase, not a file
  merge.
- Keep the `mod.txt` `name` exactly `LIES`. SuperBLT resolves
  `simple_dependencies` by that name; renaming breaks dependents.
- Never diff across a decompiler pivot. Let `tools\pd2diff.ps1` /
  `tools\pd2mod.ps1` split the range; style-only segments are marked
  `style/excluded`.
- The deployed game copy is not authoritative. Work from the mod repo/worktree.
- Do not enable Nav-B generation by default. It is gated on
  `lua_cover >= 2` and host-only.

## 1. Refresh the game source

```powershell
git -C game-data\Payday-2-LuaJIT-Complete pull
node tools\workspace-manifest.mjs
```

Bump `activeVersion` in `workspace.json` to the new version, then:

```powershell
node tools\workspace-status.mjs
```

Add the workspace `CHANGELOG.md` entry as a glue commit after the mod merge.

## 2. Find the mod's true baseline

The latest LIES version was authored against **246.1 (`a3180fc`)**. Do not
assume that stays true after an upstream LIES release.

Rule: the newest game version whose unmodified function bodies match the mod is
the diff baseline. Use `dev\tools\fn-ledger.mjs` with candidate `--old` values
and compare exact-match counts; or spot-check with:

```powershell
tools\pd2fn.ps1 -From <version> -Path <game/file.lua> -Class <Class> -Name <fn>
```

If upstream LIES has a newer release, import it first and repeat this step.
Newer upstream may already contain part of the port.

## 3. Run the port tools

From the mod worktree:

```powershell
node dev\tools\fn-ledger.mjs --old <baseline> --new <target> `
  --out dev\port-248-ledger.md --json dev\reports\port-248-ledger.json

node dev\tools\api-audit.mjs --new <target> `
  --out dev\reports\api-audit.md --json dev\reports\api-audit.json

powershell -NoProfile -ExecutionPolicy Bypass -File dev\tools\gates.ps1
```

`gates.ps1` runs:

- Node tool tests
- Lua test-harness parser
- LuaJIT syntax on every runtime Lua file
- `lua-freevars` for all hook files against their game sources
- ledger regeneration
- API audit with a recorded error baseline

Read the ledger categories:

| Category | Action |
|---|---|
| `LIES_EDIT_VANILLA_CHANGED` | Real port. Use `fn-workbench` and decide keep / adopt / merge. |
| `SAME_AS_OLD_VANILLA` | Stale vanilla copy. Delete unless intentional. |
| `SAME_AS_OLD_VANILLA_LOCAL` | Local helper; keep even if identical. |
| `VANISHED_IN_NEW` | Drop or re-home. |
| `MOD_ONLY` / `MOD_ONLY_HOOK` | LIES-only; audit API calls. |
| `LIES_EDIT_CLEAN` | Keep, but still run the API audit. |

Per-function workbench:

```powershell
node dev\tools\fn-workbench.mjs --file lua\coplogics\coplogicattack.lua `
  --name CopLogicAttack.is_available_for_assignment
```

It prints LIES, 246.1, target and both diffs, plus a porter checklist.

## 4. Triage policy

For every `LIES_EDIT_VANILLA_CHANGED` function:

1. What did LIES change vs its baseline? (LIES intent.)
2. What did the game change vs the same baseline? (new fields, callbacks,
   order.)
3. Decide:
   - `keep LIES` — vanilla change is cosmetic or irrelevant.
   - `adopt vanilla` — the game now supersedes the LIES behaviour.
   - `merge` — re-apply LIES intent onto the target body.
4. Record the decision in `dev\reports\port-decisions.md`.
5. If something is dropped, record it in `dev\reports\port-drop-log.md` with
   reason, evidence, player impact and a review trigger.

## 5. Navigation checklist (most fragile area)

Nav v6 at 248.2:

- `_nav_segments` keyed by `tostring(id)`; never index with a raw number.
- Neighbour door lists contain **Vector3 door positions** or **nav-link units**,
  not numeric `_room_doors` indices.
- `_room_doors`, `_rooms`, `_geog_segments`, `_visibility_groups` are absent at
  runtime; `NavFieldBuilder` is editor-only.
- `_quad_field` owns the graph and cover search. There is no engine `add_cover`;
  Lua-generated covers only help LIES's own search.
- `NavigationManager:raycast` is `_quad_field:test_walkability`; truthy means
  blocked. Do not pass `trace = false`.
- `find_segment_doors` returns vectors (or `{center=...}` in `center_only`
  mode). `set_nav_segment_state` needs `tostring(id)`.
- `add_obstacle` needs the 248.2 nil guard + destroy listener; keep LIES cache
  invalidation.
- Nav-B generation: `lua_cover >= 2`, host only, delayed/sliced, 4 segments /
  32 candidates / 0.1 s, 16 per segment / 2048 total, persistent per-segment
  counters, abort on `_clear` / `_unregister_cover_units`.

In-game nav probe:

```
!lies nav
!lies setting lua_cover 2
!lies gen probe 1 8
!lies gen run 40 8
!lies nav
!lies cover
```

Watch for:

- `nonexistent nav_segment` in the log (`set_nav_segment_state` string fix).
- `missing_neighbours > 0` in `!lies nav`.
- `seg_mismatch` / `sample_fail` in the generation funnel.
- `LEAKING POS RESERVATION` after shield pathing.
- Crashes on level change (Nav-B abort hooks).

## 6. AI checklist

High-risk groups, in order:

1. `EnemyManager` disposal/task queue — 248.2 uses timer fields
   (`_corpse_disposal_t`, `_shield_disposal_t`, `no_disposal`). LIES's v246
   overrides crashed; leave them dropped unless a measured need returns.
2. `GroupAIStateBesiege` — police scheduler timestamp, `_upd_police_activity`,
   `force_end_assault_phase`, smoke/flash grenade door handling.
3. `CopLogicBase._upd_attention_obj_detection` — detection fields/flow.
4. `CopLogicAttack._upd_aim` / `is_available_for_assignment` /
   `action_complete_clbk`.
5. Specials: taser detection/cancel/charge sound, tank update, shield
   reservations.
6. `CarryData._chk_register_steal_SO` — body activation helper + LIES sabotage
   markers.
7. `GroupAIStateBase`, tweak data, `hhtacs` tactics/spawn groups.
8. Team AI, civilians, props, mission elements, menu, player states.

Always keep LIES-only sabotage markers (`sabotage`, `sabo_voiceline`) when
adopting a vanilla objective/table.

## 7. Testing

Clean profile first. Disable/rename overlapping mods:

- `NavFixes` (redundant with LIES; same nav methods)
- `Useful Bots`
- `Keepers`
- `Iter` / `Iter Lite`

2-minute smoke:

1. Load `Jewelry Store` Normal.
2. `!lies nav`, `!lies cover`.
3. `!lies alarm`; wait for SWAT.
4. Shoot a guard; `!lies state`.
5. Quit.

Deep test (15–30 min):

- Loud assault on a special-heavy heist.
- Tasers, shields, cloakers, dozers.
- Hostages/escorts, Joker, team AI.
- Drill, camera, sentry, carry bags.
- `lua_cover 2` for part of the run.
- Level change / restart to test Nav-B abort.

Crash evidence:

```
%LOCALAPPDATA%\PAYDAY 2\crash.txt      -- Lua stack, best signal
%LOCALAPPDATA%\PAYDAY 2\crashlog.txt
...\PAYDAY 2\mods\logs\*.txt
```

`dev\tools\log-scan.mjs <log>` prints setup/FATAL/LIES errors/harness output.

## 8. Release

When the port is stable:

1. Update `MENU_OPTIONS.md` for any option behaviour changes.
2. Bump the version in `menumanager.lua` and add a `changelog.txt` entry
   (`Revision N:`, newest first, `Player notes:` at the end). `mod.txt` has no
   version field.
3. Repoint or disable the LIES auto-updater URL in `menumanager.lua`. It points
   at the original upstream repo; leaving it active may overwrite the port.
4. Keep `LICENSE` (AGPL-3.0) and publish the modified source if distributing.
5. Package `dist\LIES` with `dev\build.ps1`; the user deploys.
6. Optionally open a PR/fork upstream; keep the upstream remote for future
   rebases.

## 9. Known pitfalls

- `debug_pause` is a no-op in retail; use `log()` for diagnostics.
- LIES full-file copies can carry stale vanilla bodies. The ledger's
  `SAME_AS_OLD_VANILLA` category catches exact copies; `LIES_EDIT_CLEAN` may
  still hide stale code, so always run the API audit.
- Do not delete local helpers (`SAME_AS_OLD_VANILLA_LOCAL`); other LIES
  functions may call them.
- `The Fixes` hooks `EnemyManager:on_enemy_died`; test guard deaths with it
  enabled.
- `NavFixes` and LIES override the same nav methods; do not run both.
- Native crashes often have no Lua stack in the mod log; read `crash.txt`.
- Decompiler pivots: `pd2diff`/`pd2mod` segment automatically; raw `git diff`
  across them is style noise.

## 10. File map

| Path | Purpose |
|---|---|
| `dev\port-248-plan.md` | Phase plan. |
| `dev\progress.md` | Session progress/decisions. |
| `dev\reports\port-status.md` | Current green/open status. |
| `dev\reports\port-decisions.md` | Per-function keep/adopt/merge. |
| `dev\reports\port-drop-log.md` | Dropped/removed functions and why. |
| `dev\reports\nav-b-feasibility.md` | Nav-B design/risk. |
| `dev\reports\api-audit.md` | Removed/changed API hits. |
| `dev\port-248-ledger.md` | Function ledger. |
| `dev\tools\fn-ledger.mjs` | Function classification. |
| `dev\tools\fn-workbench.mjs` | Per-function diffs. |
| `dev\tools\api-audit.mjs` | Removed-symbol/hook audit. |
| `dev\tools\log-scan.mjs` | BLT log scan. |
| `dev\tools\gates.ps1` | Static gates. |
| `dev\test-harness\` | Dev-only chat commands. |
| `dev\build.ps1` | Package `dist\LIES`. |

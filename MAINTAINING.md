# Maintaining the LIES 248.2 x64 fork

Public-facing documentation is [`README.md`](README.md) and
[`MENU_OPTIONS.md`](MENU_OPTIONS.md). This file is for whoever works on the
fork: ownership details, port provenance, gates and the release procedure.

## What this repository is

The 248.2 x64 port of upstream LIES **8.57** (`4215a39`, 2026-06-06). The
upstream design is kept; the port rewrites what 248.2 changed underneath it
(navigation v6, actor/AI managers, tweak data). Upstream
[fuglore/Little-Intelligence-Enhancements](https://github.com/fuglore/Little-Intelligence-Enhancements)
is the design source, not a branch that can be fast-forwarded.

## Compatibility and ownership

LIES is a large AI overlay, so each subsystem needs one owner. Load order is
fixed and ships in each `mod.txt`; never change a mod's `priority`, and never
rename a folder (names are SuperBLT dependency keys and load-time gates).

In the suite, LIES loads first, then Monkeepers, Iter and Keepers, then Useful
Bots and finally The Fixes. Composition rules:

- **Iter** owns nav congestion, coarse search and the animated nav-link queue.
  It supersedes LIES' `_execute_coarce_search`, `CopLogicTravel:_check_start_path_ahead`
  and `CopLogicTravel:_chk_stop_for_follow_unit`, and wraps LIES'
  `NavigationManager` entry points. LIES keeps
  `CopLogicTravel.chk_group_ready_to_move` (squad push coordination) — Iter
  does not replace it. LIES' `[4]` multi-navlink branch is dead in LIES itself
  (`has_multiple_navlink_elements` is declared and never assigned;
  `segment.multiple_nav_links` is only read), so nothing is lost when Iter owns
  the search. LIES' `[3]` navlink wait still reads the single link Iter's
  streamliner picks.
- **Keepers** loads after LIES and chains the current function; it contributes
  the keeper order block and a narrow `kpr_done` path in
  `CopLogicIdle.clbk_action_timeout`, then delegates. LIES carries the
  `my_data.action_expired` guard Keepers relies on (8.57.2+).
- **Monkeepers** loads after LIES; its `is_obstructed` and `CarryData` wrappers
  compose. It no longer overrides `TeamAILogicIdle.action_complete_clbk`
  (retired in 87.3) — LIES owns that callback.
- **Useful Bots** loads after LIES and owns bot intimidation, marking and target
  priority where installed. LIES does not hook that surface.
- **The Fixes** loads last and owns `CopActionWalk._init` in the full profile;
  LIES' own `_init` keeps a standalone `self._nav_path` nil guard so it is safe
  without The Fixes.

Function-level matrix, evidence and test profiles:
`dev/reports/compatibility.md`. The workspace-side contract (ownership JSON +
`crossmod-check`) lives outside this repository, in the modding workspace.

## Versioning provenance

Versions are `<upstream release>.<fork patch>`. The patch counter is ours only;
upstream numbers are never continued. On a new upstream release the fork
rebases and the counter restarts.

- `dev/upstream-base.json` records the current upstream base and patch number.
- `dev/version-map.json` maps the pre-2026-11-03 labels (`V8.57_x64` …
  `V8.86_x64`) to the current scheme (`8.57.1` … `8.57.30`). GitHub tags, old
  assets and old logs keep the old labels, so the report tool resolves version
  strings through that map.
- GitHub tags are `v<version>` (e.g. `v8.57.32`).

## Known deviations from the original 246.1 build

Intentional port decisions, not missing files:

- LIES' incompatible EnemyManager v246 disposal/task-queue overrides were
  removed; vanilla 248.2 timers are used.
- Dead v5 navigation code and the unused recon-sweep subsystem were removed.
- Generated covers are LIES-search-only and opt-in.
- Marshal marksmen keep the long-standing LIES `CopLogicAttack` mapping.

## Auto-updater

`LIES.update_url` (`menumanager.lua`) points at
`https://raw.githubusercontent.com/met94/Little-Intelligence-Enhancements-x64/main/autoupdate.json`,
fetched with `dohttpreq`. The JSON is a one-element array with `ident`
(`LIES-AI-MOD`) and `version`. The prompt compares versions for **equality**
(not ordering) and links to the GitHub releases page; there is no silent
download or install.

`autoupdate.json` is served from raw GitHub and is **not** part of the mod
folder: `dev/build.ps1` copies an explicit item list that excludes `dev/`,
`dist/`, `.git/`, `autoupdate.json` and this file.

## Repository layout

```text
lua/        ported game code (hooks into cop, team-AI, civilian, nav, tweak data)
menu/       SuperBLT options menu definition
loc/        translations
dev/        port ledgers, reports, build script, gates, test harness
mod.txt     hooks, version, priority
```

## Gates

From the repository root (LuaJIT is provisioned in the workspace, not here):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File dev\tools\gates.ps1
node --test dev\tools\test\compat.test.mjs
tools\luajit\luajit.exe -bl <changed .lua files>
```

`dev\tools\gates.ps1` runs the static gates and the in-repo tests. For any file
that copies a game function body, also run the workspace free-variable check
(`node tools\lua-freevars.mjs <modfile> --game <gamefile>`) — that class of bug
(`mvec3_dis` and friends) is invisible to syntax checks.

The test harness (`dev/test-harness/`) is dev-only and must never ship.

## Release checklist

1. Port/fix the code; keep `changelog.txt` newest-first with
   `Revision <version> — <date>` blocks ending in a `Player notes:` line.
2. Bump the version in `mod.txt`, `autoupdate.json`, `menumanager.lua`
   (`LIES.version`), `README.md` (`**Current release:**`),
   `dev/upstream-base.json` (`patch`), `dev/version-map.json`, and the pins in
   `dev/tools/test/compat.test.mjs` / `dev/tools/test/door-watch-report.test.mjs`.
3. Run the gates above; all green.
4. `dev/build.ps1` -> `dist/LIES`; verify the folder has `mod.txt` at its root
   and no `dev/`, `dist/`, `.git`, `autoupdate.json`, `MAINTAINING.md`.
5. Tag `v<version>`, publish the zip from `dist/`, push `main` to the `x64`
   remote (keep `origin` = upstream), and confirm the raw `autoupdate.json`
   advertises the new version.
6. The user deploys into the game; agents never copy mods into the install.

## Licensing

Fork changes: AGPL-3.0 (see [`LICENSE`](LICENSE)).
Upstream LIES, retained code, localization and assets remain credited to
fugsystem and their original authors.

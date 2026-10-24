# LIES 248.2 — release readiness checklist

Status: `V8.57_x64` published. GitHub release and fork updater feed are live;
merge to the workspace remains pending explicit approval. Diagnostic logging is
gated behind the Debug Logging option (default OFF).

## Metadata

| Item | State | Action |
|---|---|---|
| `mod.txt` name | `LIES` | Keep unchanged (dependency key). |
| `mod.txt` hooks | 68, all targets exist at 248.2 | Verified by API audit. |
| Version | `V8.57_x64` in `menumanager.lua` and `mod.txt` | Set for release. |
| `changelog.txt` | present, `Revision V8.57_x64` | Ships in the package. |
| `MENU_OPTIONS.md` | present, Debug Logging documented | Ships in the package. |
| License | `LICENSE` = AGPL-3.0 | Keep; publish modified source if distributing. |
| Remotes | `origin` = upstream; `x64` = `met94/Little-Intelligence-Enhancements-x64` | Push release branch to `x64/main`. |

## Auto-updater

`menumanager.lua` points at the fork:

```lua
LIES.update_url = "https://raw.githubusercontent.com/met94/Little-Intelligence-Enhancements-x64/main/autoupdate.json"
```

The fork's `autoupdate.json` advertises `V8.57_x64`. The update prompt links to
the GitHub releases page. Verify the raw URL returns the JSON after pushing
`main`.

## Build contents

`dev/build.ps1` packages:

- `mod.txt`, `menumanager.lua`, `menunodegui.lua`, `logo.png`, `LICENSE`
- `loc/`, `lua/`, `menu/`, `changelog.txt`, `MENU_OPTIONS.md`
- excludes `dev/`, `dist/`, `.git/`, `autoupdate.json` (served separately)

`dist/LIES` is generated; never edit it by hand. The build marker
`.lies-build` is written before copying so failed builds remain cleanable.

## Static gates

`dev/tools/gates.ps1` must pass:

- Node tool tests
- test-harness parser
- LuaJIT syntax for every runtime Lua file
- `lua-freevars` for all 68 hook files
- function ledger regeneration
- API audit (currently 0 errors)

Current evidence: 55 Node tests, 68/68 hooks, 50/50 hook methods, 0 API errors,
68 freevar files / 0 findings, 71/71 LuaJIT compile.

## Gameplay regression still required

- Basic loud: load, SWAT spawn, assault, guard death — passed.
- Nav-A custom search — passed.
- Nav-B generation + custom search — passed.
- Level change / Nav-B abort — passed after latest build.
- **Passed 2026-10-24 (`70ec89f`):** suppression gate (128 denials),
  taser vertical guard (14 allowed / 7 blocked), shield reservation split
  (53 set / 4 fallback), bag steal-SO guard/helper (12 registered / 5 expected
  skips), hhtacs phalanx spawn + buff enable/disable, raw-door aim branch.
- **Still pending:** dodge `math.rand` and idle damage `data.t` (no dedicated
  log/trigger); phalanx buff increase (VIP died before the 15 s tick).
- **Pending deep:** specials (partial), hostages, team AI, holdout skirmish,
  marshal marksman movement, level restart.
- **Pending compatibility:** clean profile vs `NavFixes`, `Useful Bots`,
  `Keepers`, `Iter Lite`, `The Fixes`.

## Known deviations to document in release notes

- EnemyManager v246 disposal/task-queue overrides removed; vanilla 248.2
  timer-based behavior.
- Nav-B generated covers are visible only to LIES's Lua cover search, not the
  engine.
- `lua_cover` defaults to OFF; generation is opt-in and host-only.
- `NavFixes` is redundant when LIES is installed; do not run both.
- LIES's cover facing convention is preserved (points at the wall).

## Release candidate

- Version: `V8.57_x64`
- Build: `dist\LIES` at `331406f`
- Package: `dist\LIES-V8.57_x64.zip`
- SHA-256: `F497CA2E06EA792FB3B06B0A7DCBDA76CACF61736A671DDAD9309B37179D592C`
- Release page: `https://github.com/met94/Little-Intelligence-Enhancements-x64/releases/tag/V8.57_x64`
- Auto-update feed: `https://raw.githubusercontent.com/met94/Little-Intelligence-Enhancements-x64/main/autoupdate.json` (200; advertises `V8.57_x64`)
- Published asset: `LIES-V8.57_x64.zip`, 308,204 bytes, matching SHA-256
- Final review: release diff reviewed; 3 release risks (missing remote, 404 feed decode, load-time diagnostic) fixed; static gates 55/55.

## Merge / workspace

- Feature work lives on `feat/port-248` in `.worktrees/LIES-port-248`.
- Merge only with explicit user approval:
  `tools\worktrees.ps1 merge LIES-port-248 -Approve`.
- After merge, add the workspace `CHANGELOG.md` glue entry and refresh
  `workspace.lock.json`.
- Promote the port docs into `v2\docs\investigations\` at merge time if they
  should be workspace-level reference.

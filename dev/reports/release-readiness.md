# LIES 248.2 — release readiness checklist

Status: not ready to publish. Port is playable on the tested paths; release
metadata and final regression are still open.

## Metadata

| Item | State | Action |
|---|---|---|
| `mod.txt` name | `LIES` | Keep unchanged (dependency key). |
| `mod.txt` hooks | 68, all targets exist at 248.2 | Verified by API audit. |
| Version | `menumanager.lua` says `V8.57` | Bump at release; no version field in `mod.txt`. |
| `changelog.txt` | **missing** | Create before publishing; newest first, `Revision N:` matching the version, end with `Player notes:`. |
| `MENU_OPTIONS.md` | present | Update if option behaviour changes. |
| License | `LICENSE` = AGPL-3.0 | Keep; publish modified source if distributing. |
| Upstream remote | `origin` = original LIES repo | Keep for rebases; do not push without intent. |

## Auto-updater

`menumanager.lua` contains:

```lua
LIES.update_url = "https://raw.githubusercontent.com/fuglore/Little-Intelligence-Enhancements/auto-updates/autoupdate.json"
```

The upstream JSON currently advertises `V8.57`. A ported build with a higher
version will not be overwritten by the prompt, but the updater still points at
the original project.

Before publishing:

- repoint it to the fork's own `autoupdate.json`, or
- disable the update check in the release build.

Do not leave it pointing at upstream while shipping a modified build.

## Build contents

`dev/build.ps1` packages:

- `mod.txt`, `menumanager.lua`, `menunodegui.lua`, `logo.png`, `LICENSE`
- `loc/`, `lua/`, `menu/`
- excludes `dev/`, `dist/`, `.git/`

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

Current evidence: 68/68 hooks, 46/46 hook methods, 0 API errors, 68 freevar
files / 0 findings.

## Gameplay regression still required

- Basic loud: load, SWAT spawn, assault, guard death — passed.
- Nav-A custom search — passed.
- Nav-B generation + custom search — passed.
- Level change / Nav-B abort — passed after latest build.
- **Pending smoke:** suppression gate, dodge `math.rand`, idle damage `data.t`,
  taser charge vertical guard.
- **Pending smoke:** shield reservation split, bag steal-SO guard/helper.
- **Pending deep:** specials, hostages, team AI, hhtacs, level restart.
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

## Merge / workspace

- Feature work lives on `feat/port-248` in `.worktrees/LIES-port-248`.
- Merge only with explicit user approval:
  `tools\worktrees.ps1 merge LIES-port-248 -Approve`.
- After merge, add the workspace `CHANGELOG.md` glue entry and refresh
  `workspace.lock.json`.
- Promote the port docs into `v2\docs\investigations\` at merge time if they
  should be workspace-level reference.

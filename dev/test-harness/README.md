# LIES test harness (dev-only)

Not shipped. Used for 2–3 minute smoke tests during the 248.2 port.

## Install

1. Package or export the mod build to `dist/LIES` (see `dev/build.ps1`).
2. Copy `dist/LIES` into `…\PAYDAY 2\mods\LIES`.
3. Copy this folder into `…\PAYDAY 2\mods\LIES-TestHarness`.
4. Launch the game, load `Jewelry Store` on Normal.

## Commands

Type in chat:

| Command | Effect |
|---|---|
| `!lies nav` | Log nav segment count, missing neighbours, door types, cover count. |
| `!lies cover` | Validate `_covers` and run `find_cover_near_pos_1` from the player. |
| `!lies alarm` | Force `on_police_called` + `on_police_weapons_hot` + `set_assault_mode(true)`. |
| `!lies assault` | `set_assault_mode(true)` only; weaker than `alarm`. |
| `!lies state` | Dump group AI state: server, police called, weapons hot, assault, scheduler, groups, spawning, cops. |
| `!lies gen probe [nsegs] [ncands]` | Dry-run Nav-B cover generation on `nsegs` (default 1) segments, up to `ncands` (default 8) candidates each; logs the funnel, ships nothing. |
| `!lies gen run [nsegs] [ncands]` | Schedule the real Nav-B generation pass (defaults: whole map, 8 candidates/segment); funnel line when it finishes. |
| `!lies setting <key> <value>` | Change a LIES setting at runtime. |
| `!lies dump` | Log LIES settings, cached-nav size, cover count. |
| `!lies help` | List commands. |

All output is prefixed `[LIES-TEST]` so `dev/tools/log-scan.mjs` can extract it.

## 2-minute smoke script

1. Load `Jewelry Store` Normal.
2. `!lies nav` → expect `segments>0`, `missing_neighbours=0`, door vectors, `covers>0`.
3. `!lies cover` → expect either a cover or a clean “no cover found”, never a Lua error.
4. Shoot once to trigger the alarm; `!lies alarm`, then `!lies state`.
5. Wait ~45 seconds; `!lies state` again. Watch cop pathing and cover use.
6. Quit; send the latest `mods\logs\*.txt`.

## Static test

```
tools\luajit\luajit.exe dev/test-harness/test/test_commands.lua
```

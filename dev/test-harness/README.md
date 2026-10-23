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
| `!lies assault` | `set_assault_mode(true)` to force a loud test. |
| `!lies setting <key> <value>` | Change a LIES setting at runtime. |
| `!lies dump` | Log LIES settings, cached-nav size, cover count. |
| `!lies help` | List commands. |

All output is prefixed `[LIES-TEST]` so `dev/tools/log-scan.mjs` can extract it.

## 2-minute smoke script

1. Load `Jewelry Store` Normal.
2. `!lies nav` → expect `segments>0`, `missing_neighbours=0`, door vectors, `covers>0`.
3. `!lies cover` → expect either a cover or a clean “no cover found”, never a Lua error.
4. Shoot once to trigger the alarm; `!lies assault`.
5. Wait ~45 seconds; watch cop pathing and cover use.
6. Quit; send the latest `mods\logs\*.txt`.

## Static test

```
tools\luajit\luajit.exe dev/test-harness/test/test_commands.lua
```

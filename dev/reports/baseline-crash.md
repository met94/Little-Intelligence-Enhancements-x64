# P0 baseline crash — 2026-10-23 17:03

Log: `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_10_23_log.txt`

## Evidence

- LIES loaded: `Setting up mod 'LIES'` at 05:03:26.
- LIES initialized tweak data: `LIES: Initializing tweak_data...` at 05:03:29.
- Last line before the crash:

```
05:03:30 PM Lua: Map has 58 cover points, setting generation limit to 640 cover points.
```

- No Lua `attempt to` error and no `stack traceback`.
- Game crashed while loading into the heist.

## Attribution

The "Map has ... cover points" line exists only in LIES's
`NavigationManager:register_cover_units` (mod line 482), not in 248.2 vanilla.
The next code is the v5 runtime cover-generation loop, which reads
`res.rooms`, `_rooms`, `_room_doors`, and `NavFieldBuilder` state that no
longer exists at runtime in nav v6. The crash is native (no Lua traceback),
consistent with an engine access violation inside that loop.

## Immediate action

Disable the v5 generation block in the bootstrap build:

```lua
if false and Network:is_server() then
```

Keep the vanilla-registered `_covers` (58 cover units) and the default
engine cover search (`lua_cover` off). Rebuild the generator against nav
segments in Nav-B, after the spike.

## Baseline status

- P0 tooling: complete.
- Baseline failure: captured (native crash at load-in).
- P1a nav spike: next.

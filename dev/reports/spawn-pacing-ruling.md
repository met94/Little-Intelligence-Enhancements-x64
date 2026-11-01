# Ruling: `instant_spawn_groups` (fork switch, V8.60-V8.65) — removed

Date: 2026-10-30 · Game: PAYDAY 2 248.2 x64 · Source of truth:
`game-data\Payday-2-LuaJIT-Complete` @ `e3a8b616` (248.2) and the mod worktree
`feat/ai-suite-compat`.

## Question

The fork added an **Instant Spawn Groups** toggle (V8.60) in front of an upstream
LIES call in `ElementSpawnEnemyGroup:on_executed`. Does the toggle actually
change the game, and should the option stay?

## What the code does

Upstream LIES **7.1** (`b0207e5`, 2023-04-05) replaced the game's
`ElementSpawnEnemyGroup:on_executed` and, in the `spawn_type == "group"` branch,
added one call after `force_spawn_group`:

```lua
local spawn_task = managers.groupai:state()._spawning_groups[1]
if spawn_task then
    managers.groupai:state():_perform_group_spawning(spawn_task, true)
end
```

The stated intent (and the fork's menu text) was that `force = true` bypasses
`GroupAIStateBesiege._MAX_SIMULTANEOUS_SPAWNS` and makes the whole group appear
at once.

## Why it cannot work

1. `force_spawn_group` calls `_spawn_in_group`, which sets **every** spawn point
   of the freshly created group to
   `delay_t = self._t + math.rand(0.5)`
   (`lib\managers\group_ai_states\groupaistatebesiege.lua:1275-1277`;
   `math.rand(0.5) = math.random() * 0.5`, `core\lib\utils\coremath.lua:204-209`,
   so the value is in `[0, 0.5)`).
2. `_perform_group_spawning` spawns from a point only when its delay has
   expired: `sp_data.delay_t < self._t` (LIES
   `lua\groupaistate\groupaistatebesiege.lua:4623`; game `:1409`). `force` guards
   only the cap check (`not force` at `:4610` / `:1396`) — it never touches the
   delay gate.
3. Both calls happen in the same frame with the same `self._t`
   (`groupaistatebase.lua:146` is the only per-frame assignment; nothing in the
   call chain reassigns it). A delay of `self._t + [0, 0.5)` is therefore always
   in the future, so the forced pass spawns **zero** units of its own group. The
   game's own `_upd_group_spawning(true)` inside `force_spawn_group` is inert for
   the same reason.
4. `_spawn_in_group` appends the new task with `table.insert(...)`
   (`:1287`), so `_spawning_groups[1]` is the **oldest** queued task, not the new
   one. The extra call therefore force-spawns a few cops of an *unrelated*
   already-queued group, ignoring the cap. Backlog is normal:
   `_POLICE_ACTIVITY_DELAY_FAST = 0.4 s` and 2-3 units per pass against groups of
   4-8 units.

Net: the option cannot accelerate the group whose element fired. It can only add
a small, uncapped early burst of some other pending group.

## Evidence

- Static: all four points above verified line by line (also by an independent
  read-only verification pass over both trees, which listed every `delay_t`
  write and every `_perform_group_spawning` call site — `force` is used from
  exactly three places: game `elementspawnenemygroup.lua:109` (`group_guaranteed`,
  vanilla), LIES `:75` (the removed one) and `:86` (`group_guaranteed`).
- Measured: legs with the switch **off** still held 85-100 live cops
  (`moon` 96-103, `dah` 87-90, `pbr` 50) on 4-player Death Wish. The suite's
  density is not attributable to this call.
- History: upstream commit `b0207e5` is titled only "7.1"; there is no upstream
  changelog or README, and the ModWorkshop page never advertised spawn pacing.
  No document in this fork justified the call beyond the (incorrect) density
  attribution in `MENU_OPTIONS.md` and `dev/tools/test/spawn-pacing.test.mjs`.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the toggle, rewrite the text | The only honest text would be "adds an uncapped early burst of a random queued group" — no player-facing value, and the menu promise cannot be delivered in any configuration. |
| Fix the target (`#_spawning_groups` + identity check) and keep the toggle | Provably inert: the fresh group's delays have not expired, so the call becomes a guaranteed no-op. A switch that does nothing is worse than no switch. |
| Remove only the toggle, keep the upstream call | Keeps an uncapped spawn burst of an unrelated group as a pure side effect, with no option and no rationale. |

## Ruling

Remove the switch **and** the `group`-branch forced call (V8.66). The
`spawn_type == "group_guaranteed"` branch keeps its forced call because that
branch is vanilla's own code, and the `else` branch is untouched. Removed
artifacts: `settings.instant_spawn_groups` and its comment, the menu entry in
`menu\options.txt`, `callback_lies_instant_spawn_groups`, the two `loc\en.txt`
keys, the `MENU_OPTIONS.md` option section (replaced by a removal record), and
the `spawn-pacing` test's switch assertions (now pin the vanilla shape).

**Player POV:** scripted group spawns behave exactly like vanilla — the group is
queued and arrives at the game's normal rate. The only difference is that a
handful of already-queued cops no longer pops out early when a spawn element
fires. The option disappears from Mod Options; a leftover key in the save file is
ignored.

## Open follow-ups

- The suite's actual cop-count driver is still unattributed. The previous
  candidate (this call) is ruled out; `groupaitweakdata` force/force_pool were
  checked and are *lower* than vanilla on Death Wish 4-player (LIES
  `force_pool` 72/108/144 vs vanilla 150/175/225), so the next candidates are the
  HHTACS drama/balancing overrides and group-element frequency per heist.
- A per-heist `spawn_type` census cannot be done statically: level mission data
  lives in the game's `.crate` bundles, not in the decompiled Lua repo. It is
  also no longer required for this decision.

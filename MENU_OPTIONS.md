# LIES menu options

Menu path: **Options → Mod Options → Little Intelligence EnhancementS Options**.
Settings are stored in `LittleIntelligenceEnhancementS.txt` in the game's save
folder. Options marked **heist restart** only take effect on the next heist.

## Take Cover Through LUA (`lua_cover`)

| Value | Effect |
|---|---|
| OFF | Engine cover search only. Lowest overhead. |
| Vis-Check | LIES's Lua cover search over the registered cover set, plus optional runtime cover generation. Heavier, but cops evaluate cover with LIES's visibility/rotation checks. |

248.2 port notes:

- Generated covers are only visible to LIES's Lua search; the engine's own cover
  search ignores them.
- Cover generation only runs on the host and only when this option is set to
  `Vis-Check`. It is delayed and sliced to avoid a load-time freeze.
- Default is OFF.
- **Heist restart** recommended after changing this option.

## No Joker Stagger (`jokerhurts`)

Jokers cannot be staggered by enemy attacks, so they follow players more
reliably. Not vanilla-accurate.

## Extra Chatter (`extra_chatter`)

Adds extra guard/civilian voice lines, mostly in stealth. Not vanilla-accurate.

## Spawngroup Tweaks (`fixed_spawngroups`)

| Value | Effect |
|---|---|
| Vanilla | No spawn-group fixes. |
| Fixed | Repairs missing/non-functional spawn groups. |

**Heist restart** required.

## Allow Assault Groups To Retire (`copsretire`)

Lets assault groups leave the assault area when the assault is ending. Not
vanilla-accurate.

## Spicy Tactics (`hhtacs`)

Adds LIES-specific AI behaviours and tactics. Large behaviour change, not
vanilla-balanced, and the most complex part of the 248.2 port. Use as an
experimental option until the full hhtacs audit is complete.

## Aggression Level (`enemy_aggro_level`)

| Value | Effect |
|---|---|
| LOW | Least aggressive. |
| MEDIUM | Moderate. |
| HIGH | Closest to vanilla aggression. |
| MOSH PIT | Maximum pressure. |

## Movement Frequency (`enemy_travel_level`)

| Value | Effect |
|---|---|
| SLOWEST | Closest to vanilla travel delays. |
| SLOW | Slightly faster. |
| NORMAL | Fast. |
| NO DELAYS | Intended LIES speed; enemies relocate almost immediately. |

## Reaction Level (`enemy_reaction_level`)

| Value | Effect |
|---|---|
| SLOW | Closest to vanilla reaction speed. |
| NORMAL | Faster reactions. |
| ULTRA-VIOLENCE | Fastest. |

## Navlink Delays (`nav_link_interval`)

Scales the pause a cop spends playing an animated nav-link action (vaulting a
window, climbing a fence). **This option works as of V8.58_x64** — before that
it was a menu entry with no effect.

| Value | Effect |
|---|---|
| 1x (Vanilla) | No change to nav-link animation delays. |
| 0.5x (Half) | Half delays. |
| 0.25x (One Third) | Quarter of the vanilla delay (the menu label is historical; the multiplier is 0.25). |
| NO CHILL | Removes delays; may cause cops to stack up on the same link. |

How it works: only animated nav-link elements are scaled. The vanilla interval
is capped at 3 seconds first, then multiplied once, when the map element
finalizes its values. Because the scaled value is stored on the element itself,
it feeds both consumers — the engine's own
`ElementSpecialObjective:nav_link_delay()` and, when
[Iter](https://github.com/met94/payday2-mod-Iter) is installed, Iter's nav-link
queue (`values.itr_interval`). Iter re-clamps the value per `so_action` (1-2
seconds for jumps, ladders, climbs and `e_nl_*` links) and zeroes the engine
delay while its `nav_streamline` option is on (the default); with Iter the queue
therefore runs on the capped value, so the 0.5x/0.25x multipliers are partly
absorbed. Elements whose interval is unset or `-1` keep the vanilla default, so
the setting only touches links that actually have a delay.

**NO CHILL** writes an interval of `0`. Iter treats a zero interval as "no
reservation needed", so with Iter installed multiple cops can walk the same
link at once — this is the intended effect, but it is also why cops can bunch
up in a doorway or on a ladder.

**Heist restart** recommended: elements are finalized when a heist loads.

## Team AI Shouters (`teamaihelpers`)

Lets team AI help with escorting and surrendering cops. Not vanilla-accurate.

## Smart Engagement (`interruptoncontact`)

Reduces the tendency for enemies to keep moving into danger when a
distance engagement starts. Not vanilla-accurate.

## High Performance Mode (`highperformance`)

Sacrifices some LIES-specific AI work for steadier frame times. Turn on if the
mod causes stutter; OFF gives more responsive AI.

## Debug Logging (`debug_log`)

Writes `[LIES-CHECK]` diagnostic events to the PAYDAY 2 log. Default is OFF.
Turn it on only while collecting a test log; normal play stays quiet. The
option affects diagnostics, not AI behaviour.

## Watch digest (`watch_log`) and alarms

Same channel shape as Iter's, so one reader handles both mods:

- **Alarms** are always on and need no setting. They fire only on a hard
  failure, at most once per name per 60 s and at most 20 per heist:
  `lies_cover_fallback_rate` (more than half of ≥40 cover reservations in a
  minute fell back) and `lies_suppression_deny_rate` (more than 80% of ≥40
  suppression checks in a minute were denied). A healthy heist writes **zero**
  `[LIES-WATCH]` lines.
- **Digest** is opt-in: add `"watch_log": true` to
  `mods\saves\LittleIntelligenceEnhancementS.txt` with the game closed. With it
  on, LIES writes a header at heist start and one `[LIES-WATCH] evt=digest`
  line per 60 s of play, carrying the per-minute counts for cover
  set/fallback, suppression denies, taser allowed/blocked, bag steal-SO
  registered/skipped/deferred, marshal mapping and civilian follow fallbacks.

`[LIES-CHECK]` remains the per-event detail channel and still needs
`debug_log`; the watch counters run regardless, which is why a normal session
now leaves evidence behind for the alarm tier.

## Crash breadcrumbs (`trace`)

On by default, settings file only, no menu entry. A native access violation
kills the game without a Lua error, so nothing can be logged *after* the fault;
the breadcrumbs are what was written *before* it. Add `"trace": false` to
`mods\saves\LittleIntelligenceEnhancementS.txt` (game closed) to silence them.

Each line looks like:

```
[LIES-TRACE] v=V8.69_x64 t=143.27 u=1081 tweak=spooc logic=attack phase=combat att=769 att_alive=true att_trk=true dropped=0
```

- `u` is the acting unit, `tweak` its character type, `logic` its current logic,
  `phase` the AI step that just started (`combat`, `charge_search`,
  `cover_path_search`, `cover_upd`, `peek`, `retreat`, `aim`, `spooc`), `att` the
  enemy it is working with (`att_alive`, `att_trk` = an enemy nav tracker is
  present), `dropped` how many lines were suppressed so far.
- Throttle: one line per unit per phase per 2.5 s, plus a global cap of 25 lines
  per second. A sustained worst case is ~1500 lines per minute; a normal heist
  stays in the low hundreds. `dropped` tells you when the cap was hit.
- Failure phases are exempt from the cap because they are the ones a crash
  report cannot be reconstructed without: `combat_no_attention` (no attention
  object at all), `dodge_dead_enemy` / `spooc_dead_enemy` (AI met a dead enemy
  and skipped it), `stale_tracker` (the V8.68 freed-nav-tracker guard refused a
  tracker), `exit_missing_logic` / `exit_no_fallback` (the V8.67 logic-state
  guard downgraded an exit). These mean the guard did its job; the game keeps
  running and the line names the unit.

Report a crash by attaching `crash.txt` plus the last `[LIES-TRACE]` lines from
`mods\logs\<date>_log.txt`.

## Instant Spawn Groups (`instant_spawn_groups`) - removed in V8.66

The fork exposed an upstream code path as a toggle in V8.60-V8.65 and retired
the option in V8.66. What it was, and why it is gone:

- Upstream LIES **7.1** (`b0207e5`, 2023-04-05) overrode
  `ElementSpawnEnemyGroup:on_executed` and, for `spawn_type == "group"`, added
  an extra `_perform_group_spawning(spawn_task, true)` right after
  `force_spawn_group`. The intent was to bypass
  `GroupAIStateBesiege._MAX_SIMULTANEOUS_SPAWNS` (3 per tick) so the whole
  group appears at once.
- It could never do that for the group it was called for. `_spawn_in_group`
  sets every spawn point of the fresh group to
  `delay_t = self._t + math.rand(0.5)` (`groupaistatebesiege.lua:1275-1277`),
  and `_perform_group_spawning` skips any point whose delay has not expired
  (`sp_data.delay_t < self._t`, `:4623` in LIES, `:1409` vanilla). `force` only
  lifts the per-tick cap, not the delay gate, and both calls happen in the same
  frame with the same `self._t`.
- The only task the extra call could reach was `_spawning_groups[1]` - the
  **oldest** queued group, because the new task is appended at the tail
  (`:1287`). So it could only spawn a few cops of an unrelated, already queued
  group ahead of schedule, ignoring the cap.
- Density was therefore never this line's doing: it cannot speed up the group
  whose element fired. Measured legs with the switch off still showed 85-100
  live cops on Death Wish 4-player, so the suite's cop counts come from
  elsewhere. An earlier version of this document claimed "~35 vanilla vs ~100
  suite, this is the switch that isolates it" - that attribution was wrong.
- `spawn_type == "group_guaranteed"` keeps its forced call: that branch is
  vanilla's own code, not a LIES addition.

Player POV: scripted group spawns now arrive exactly like vanilla - the group is
queued and trickles in at the game's normal rate (LIES lowers the per-tick cap
to 2). The only visible difference is that a handful of already-queued cops no
longer pops out early when a spawn element fires.

### Dead options and their upstream history

| key | what it did | removed upstream |
| --- | --- | --- |
| `coplimit` ("Max Enemies Multiplier") | multiplied `besiege.assault.force[1..3]` and `force_pool[]` in `groupaitweakdata.lua` | **6.4** (2023-01-08) - code and menu entry deleted |
| `spawngroupdelays` ("Forced Spawn Delays") | lengthened randomized spawn-group delays in `groupaistatebesiege.lua`, "reducing cases of enemies constantly pouring out of nearby spawn points" | **8.51** (2026-05-07) - code and menu entry deleted |

Both are vestigial in the V8.57 tree: only the settings key, the menu callback
and the localization strings remain, and nothing reads them. The ModWorkshop page
for V8.57 still advertises "Forced Spawn Delays ... Toggleable", which no longer
exists - a stale description upstream, not something this port removed.

The fork's own `instant_spawn_groups` switch (V8.60-V8.65) joined the retired
list in V8.66 - see the section above.

## Path-cache lookup (`cache_lookup`)

Settings file only, no menu entry. Default **true**, which is upstream LIES
behaviour.

| value | effect |
| --- | --- |
| `true` | Before asking the engine for a path, `NavigationManager:search_pos_to_pos` scans the cached paths and reuses one whose endpoints are still in a straight walkable line. The cop gets a path in the same frame. |
| `false` | Skip the scan and always ask the engine. The path arrives about one frame later, and the lookup costs ~10 us instead of a scan of ~900 entries (~3.5 ms of CPU on a measured 4-player heist). |

Why it exists: the cache is an upstream optimisation that was never bounded
(measured 927-975 entries, 20-24% hit rate, two navworld raycasts per entry). The
switch lets the cost be measured against the benefit without changing any code
path that the engine or the cover search depends on.

`Ruling` in the investigation doc: this is an unadvertised internal optimisation,
so any change to it ships default-off; `true` keeps the author's behaviour.

## Legacy localization keys

`loc/en.txt` also contains strings for `fixed_specialspawncaps`, `coplimit`
and `spawngroupdelays`. They are not exposed by the current
`menu/options.txt`; treat them as historical unless a future menu revision adds
them.

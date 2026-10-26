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

## Instant Spawn Groups (`instant_spawn_groups`)

Upstream LIES force-spawns every executed spawn group at once
(`ElementSpawnEnemyGroup:on_executed` → `_perform_group_spawning(spawn_task, true)`),
and that `true` bypasses the game's `_MAX_SIMULTANEOUS_SPAWNS` of 3 per tick.
That is why a LIES session carries several times the live cop count of a vanilla
one (measured 2026-10-26: ~35 vanilla, ~100 with the suite, peak 130).

**Origin:** not a flag and never documented. The call is unconditional code,
introduced in upstream **7.1** (2023-04-05, `b0207e5`) and byte-identical in the
V8.57 tree; the upstream repo has no README or changelog, and the ModWorkshop
page never mentions spawn pacing. Turning it OFF is fork-only (V8.60/61).

`"instant_spawn_groups": false` in
`mods\saves\LittleIntelligenceEnhancementS.txt` (game closed), or the
**Instant Spawn Groups** toggle in Mod Options, restores vanilla pacing and
leaves the normal `force_spawn_group` path as the only spawner. Default is `true`
(unchanged LIES behaviour). The change applies to the next spawn group; restart
the heist for a clean comparison.

### Dead options and their upstream history

| key | what it did | removed upstream |
| --- | --- | --- |
| `coplimit` ("Max Enemies Multiplier") | multiplied `besiege.assault.force[1..3]` and `force_pool[]` in `groupaitweakdata.lua` | **6.4** (2023-01-08) - code and menu entry deleted |
| `spawngroupdelays` ("Forced Spawn Delays") | lengthened randomized spawn-group delays in `groupaistatebesiege.lua`, "reducing cases of enemies constantly pouring out of nearby spawn points" | **8.51** (2026-05-07) - code and menu entry deleted |

Both are vestigial in the V8.57 tree: only the settings key, the menu callback
and the localization strings remain, and nothing reads them. The ModWorkshop page
for V8.57 still advertises "Forced Spawn Delays ... Toggleable", which no longer
exists - a stale description upstream, not something this port removed.

## Legacy localization keys

`loc/en.txt` also contains strings for `fixed_specialspawncaps`, `coplimit`
and `spawngroupdelays`. They are not exposed by the current
`menu/options.txt`; treat them as historical unless a future menu revision adds
them.

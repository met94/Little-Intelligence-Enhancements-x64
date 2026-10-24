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

| Value | Effect |
|---|---|
| 1x (Vanilla) | No change to nav-link animation delays. |
| 0.5x (Half) | Half delays. |
| 0.25x (One Third) | Quarter delays. |
| NO CHILL | Removes delays; may cause cops to stack up. |

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

## Legacy localization keys

`loc/en.txt` also contains strings for `fixed_specialspawncaps`, `coplimit`
and `spawngroupdelays`. They are not exposed by the current
`menu/options.txt`; treat them as historical unless a future menu revision adds
them.

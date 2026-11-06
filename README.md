<p align="center">
  <img src="logo.png" alt="LIES logo" width="180">
</p>

# LIES — Little Intelligence EnhancementS

**Updated for PAYDAY 2 248.2 x64 (Diesel 3).**

LIES is an enemy-AI overhaul: it rewrites how cops detect, evaluate, aim, take
cover, path, suppress and coordinate, without replacing the game's core combat
loop.

- **Current release:** `8.57.32`
- **Download:** [GitHub Releases](https://github.com/met94/Little-Intelligence-Enhancements-x64/releases)
- **Original project:** [fuglore/Little-Intelligence-Enhancements](https://github.com/fuglore/Little-Intelligence-Enhancements)

## Part of the AI suite

Tested as one stack and meant to run with it. One download for all four:
[**AI Suite**](https://github.com/met94/payday2-ai-suite/releases).

| Mod | Repo | Role |
| --- | --- | --- |
| **LIES** (this mod) | [met94/Little-Intelligence-Enhancements-x64](https://github.com/met94/Little-Intelligence-Enhancements-x64) | enemy AI: detection, aim, cover, travel |
| **Iter** | [met94/payday2-mod-Iter](https://github.com/met94/payday2-mod-Iter) | navigation, coarse search, nav-link queue, level nav fixes |
| **Keepers** | [met94/payday2-mod-Keepers](https://github.com/met94/payday2-mod-Keepers) | bot orders, revives, jokers |
| **Monkeepers** | [met94/payday2-mod-Monkeepers](https://github.com/met94/payday2-mod-Monkeepers) | bot bag logistics |
| **Useful Bots** 2.6.3 (by Hoppip, not part of this set) | [ModWorkshop #31221](https://modworkshop.net/mod/31221) | bot combat and utility; requires HopLib |
| The Fixes (optional) | [ModWorkshop #23732](https://modworkshop.net/mod/23732) | general game fixes |

## Features

- **Smarter detection and reaction** — cops see, lose track of and re-acquire
  you plausibly instead of always knowing where you are.
- **Custom navigation** — door handling, LIES' own cover search, and optional
  runtime cover generation for maps with sparse cover.
- **Better cover use** — cops evaluate cover against the threat instead of
  taking the first available slot.
- **Special unit handling** — shields, tasers, tanks and phalanx units get
  LIES-compatible logic where it helps.
- **HHTACS / Spicy Tactics** — optional aggressive spawn groups, tactics and
  group-level pressure. Off by default.
- **Group AI repairs** — assault, recon, HRT, drill sabotage, reenforce and
  retreat behaviour preserved and fixed for 248.2.
- **Periphery fixes** — camera line-of-sight, team-AI hold/revive, civilian
  follow, drill tracker, mission-element and difficulty guards.

## Requirements

- PAYDAY 2 **248.2 x64** (Diesel 3)
- [SuperBLT](https://superblt.znix.xyz/) installed and working
- A clean `mods/LIES` folder (remove older LIES versions before updating)

LIES does **not** require BeardLib.

## Installation

1. Install SuperBLT if you have not already.
2. Remove or rename any existing `PAYDAY 2/mods/LIES` folder.
3. Extract `LIES-8.57.32.zip` so the final path is:
   `PAYDAY 2/mods/LIES/mod.txt`
4. Start the game and open **Options → Mod Options → Little Intelligence
   EnhancementS Options**.

Settings are stored in `LittleIntelligenceEnhancementS.txt` in the PAYDAY 2
save folder.

## Configuration

Most players can leave the defaults alone. The full list is in
[MENU_OPTIONS.md](MENU_OPTIONS.md); the ones that matter:

- **Take Cover Through LUA** — opt-in custom cover search plus generated covers.
  Higher CPU cost.
- **HHTACS / Spicy Tactics** — large non-vanilla AI behaviour change, off by
  default.
- **Navlink Delays** — `1x` / `0.5x` / `0.25x` / `NO CHILL`. Scales the time cops
  spend on ladders, vaults and jumps. `NO CHILL` removes it and can stack cops
  on one link.
- **Debug Logging** — off by default; enable it only while collecting a bug
  report.

## Compatibility

LIES is a large AI overlay, so pairing it with other AI mods needs a defined
owner per subsystem. These combinations are validated:

- **Iter** — recommended. Iter handles nav congestion, coarse search and the
  nav-link queue; LIES keeps squad push coordination.
- **Keepers** — compatible. Bot orders run on top of LIES' logic.
- **Monkeepers** — compatible. Bot bag logistics run alongside LIES.
- **Useful Bots** — compatible; it owns bot intimidation, marking and target
  priority, and is left untouched.
- **The Fixes** — compatible and optional; it loads last and owns the cop
  walk-action initialisation in the full stack.

If you run several AI mods, install them all and leave their priorities alone —
the order ships inside each mod and is what makes them cooperate.

Function-level details and the test profiles: [`MAINTAINING.md`](MAINTAINING.md).

## Updates

LIES checks its update feed at startup and, if the advertised version differs
from the installed one, shows a prompt that links to the GitHub releases page.
It never downloads or installs anything by itself, and the comparison cannot
tell a newer build from an older one — check the release notes before updating.

## Versioning

`<upstream release>.<fork patch>`: `8.57.32` is the 32nd fork release on
upstream LIES 8.57. When upstream ships a new release the fork rebases onto it
and the patch counter restarts (`8.60.1`, `8.60.2`, …). Releases published
before 2026-11-03 keep their old `V8.xx_x64` labels; the mapping is in
[`MAINTAINING.md`](MAINTAINING.md).

## Credits

- **Original LIES author and AI design:** [fugsystem](https://github.com/fuglore)
  — [Little-Intelligence-Enhancements](https://github.com/fuglore/Little-Intelligence-Enhancements)
- **248.2 x64 port and maintenance:** [met94](https://github.com/met94)
- **Decompiled PAYDAY 2 Lua reference:** [steam-test1/Payday-2-LuaJIT-Complete](https://github.com/steam-test1/Payday-2-LuaJIT-Complete)
- **SuperBLT and the PAYDAY 2 modding community**

LIES is licensed under the **GNU Affero General Public License v3.0**. See
[LICENSE](LICENSE).

This fork is not affiliated with Starbreeze Studios or Overkill Software.
Report fork-specific issues to this repository, not the original author.

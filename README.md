<p align="center">
  <img src="logo.png" alt="LIES logo" width="180">
</p>

# LIES — Little Intelligence EnhancementS

**Updated for PAYDAY 2 248.2 x64 (Diesel 3).**

LIES is an enemy-AI overhaul for PAYDAY 2. It rewrites how cops detect,
evaluate, aim, take cover, path, suppress, and coordinate — without replacing
the game's core combat loop. This fork ports the original LIES V8.57 design to
the current 64-bit 248.2 game build.

- **Current release:** `V8.57_x64`
- **Download:** [GitHub Releases](https://github.com/met94/Little-Intelligence-Enhancements-x64/releases)
- **Original project:** [fuglore/Little-Intelligence-Enhancements](https://github.com/fuglore/Little-Intelligence-Enhancements)

## Features

- **Smarter detection and reaction** — LIES keeps its own attention, aim,
  suppression, dodge, idle, and travel logic, adapted to 248.2.
- **Custom navigation** — v6 door handling, LIES Lua cover search, and optional
  runtime Nav-B cover generation for maps with sparse cover.
- **Better cover use** — cops evaluate cover against the threat instead of
  taking the first available slot.
- **Special unit handling** — shields, tasers, tanks, and phalanx units receive
  LIES-compatible logic where intended.
- **HHTACS / Spicy Tactics** — optional aggressive spawn groups, tactics,
  phalanx behavior, and group-level pressure. Off by default.
- **Group AI repairs** — assault, recon, HRT, drill sabotage, reenforce, and
  retreat logic preserved and fixed for 248.2.
- **Periphery fixes** — camera line-of-sight, team-AI hold/revive, civilian
  follow, drill tracker, mission-element, and difficulty guards.

## Requirements

- PAYDAY 2 **248.2 x64** (Diesel 3)
- [SuperBLT](https://superblt.znix.xyz/) installed and working
- A clean `mods/LIES` folder (remove older LIES versions before updating)

LIES does **not** require BeardLib. Other AI mods may overlap; see
[Compatibility](#compatibility).

## Installation

1. Install SuperBLT if you have not already.
2. Remove or rename any existing `PAYDAY 2/mods/LIES` folder.
3. Extract `LIES-V8.57_x64.zip` so the final path is:
   `PAYDAY 2/mods/LIES/mod.txt`
4. Start the game.

The mod options appear under:

**Options → Mod Options → Little Intelligence EnhancementS Options**

Settings are stored in `LittleIntelligenceEnhancementS.txt` in the PAYDAY 2
save folder.

## Important compatibility notes

- **Do not run NavFixes with LIES.** Both modify the same navigation functions
  with incompatible signatures. LIES already includes the relevant nav guards.
- **Keepers** remains compatible, but it owns two `CopLogicIdle` functions; its
  versions win when both are installed.
- **Useful Bots** remains compatible, but it owns bot intimidation/marking
  behavior when installed.
- **Monkeepers:** set its `mod.txt` priority to `99` so it loads after LIES.
- **The Fixes / Iter Lite** load-order interactions are documented in
  `dev/reports/compatibility.md` in the source repository.

## Configuration

Most players can leave the defaults alone.

- **Take Cover Through LUA** — opt-in custom cover search plus Nav-B generation.
  Higher CPU cost; generated covers are visible only to LIES's Lua search.
- **HHTACS / Spicy Tactics** — large, non-vanilla AI behavior change. Off by
  default; enable only if you want the full LIES experience.
- **Debug Logging** — off by default. When enabled, writes `[LIES-CHECK]`
  diagnostic events to `mods/logs`. Enable it only while collecting a bug
  report.

Full option descriptions: [MENU_OPTIONS.md](MENU_OPTIONS.md).

## Auto-updater

LIES checks the fork's update feed at startup:

`https://raw.githubusercontent.com/met94/Little-Intelligence-Enhancements-x64/main/autoupdate.json`

If the feed advertises a newer version, the update prompt links to the GitHub
releases page. The mod does **not** silently download or install updates.

## Known deviations from the original 246.1 build

These are intentional 248.2 port decisions, not missing files:

- LIES's incompatible EnemyManager v246 disposal/task-queue overrides were
  removed; vanilla 248.2 timers are used.
- Dead v5 navigation code and the unused recon-sweep subsystem were removed.
- Nav-B generated covers are LIES-search-only and opt-in.
- Marshal marksmen keep the long-standing LIES `CopLogicAttack` mapping.
- NavFixes must not be installed alongside LIES.

## Credits

- **Original LIES author and AI design:** [fugsystem](https://github.com/fuglore)
  — [Little-Intelligence-Enhancements](https://github.com/fuglore/Little-Intelligence-Enhancements)
- **248.2 x64 port and maintenance:** [met94](https://github.com/met94)
- **Decompiled PAYDAY 2 Lua reference:** [steam-test1/Payday-2-LuaJIT-Complete](https://github.com/steam-test1/Payday-2-LuaJIT-Complete)
- **SuperBLT and the PAYDAY 2 modding community**

LIES is licensed under the **GNU Affero General Public License v3.0**. See
[LICENSE](LICENSE).

This fork is not affiliated with Starbreeze Studios or Overkill Software.
Please report fork-specific issues to this repository, not the original author.

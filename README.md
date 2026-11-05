<p align="center">
  <img src="logo.png" alt="LIES logo" width="180">
</p>

# LIES — Little Intelligence EnhancementS

**Updated for PAYDAY 2 248.2 x64 (Diesel 3).**

LIES is an enemy-AI overhaul for PAYDAY 2. It rewrites how cops detect,
evaluate, aim, take cover, path, suppress, and coordinate — without replacing
the game's core combat loop. This fork ports the original LIES V8.57 design to
the current 64-bit 248.2 game build.

- **Current release:** `8.57.31`
- **Download:** [GitHub Releases](https://github.com/met94/Little-Intelligence-Enhancements-x64/releases)
- **Original project:** [fuglore/Little-Intelligence-Enhancements](https://github.com/fuglore/Little-Intelligence-Enhancements)

## Part of the AI suite

This mod is tested as one stack with the rest of our 248.2 AI suite, and is
intended to be run together with it:

| Mod | Repo | Role |
| --- | --- | --- |
| **LIES** (this mod) | [met94/Little-Intelligence-Enhancements-x64](https://github.com/met94/Little-Intelligence-Enhancements-x64) | enemy AI: detection, aim, cover, travel |
| **Iter** | [met94/payday2-mod-Iter](https://github.com/met94/payday2-mod-Iter) | navigation, coarse search, nav-link queue, level nav fixes |
| **Keepers** | [met94/payday2-mod-Keepers](https://github.com/met94/payday2-mod-Keepers) | bot orders, revives, jokers |
| **Monkeepers** | [met94/payday2-mod-Monkeepers](https://github.com/met94/payday2-mod-Monkeepers) | bot bag logistics |
| **Useful Bots** 2.6.3 (by Hoppip, not part of this set) | [ModWorkshop #31221](https://modworkshop.net/mod/31221) | bot combat and utility; requires HopLib |
| The Fixes (optional) | - | general game fixes |

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
3. Extract `LIES-8.57.31.zip` so the final path is:
   `PAYDAY 2/mods/LIES/mod.txt`
4. Start the game.

The mod options appear under:

**Options → Mod Options → Little Intelligence EnhancementS Options**

Settings are stored in `LittleIntelligenceEnhancementS.txt` in the PAYDAY 2
save folder.

## Compatibility

LIES is a large AI overlay, so the AI mods you pair it with need a defined
owner per subsystem. These are the combinations validated in this fork.

- **Iter (full nav) — recommended, Option 1 navigation owner.** Iter owns nav
  congestion, coarse search, and the animated nav-link queue; LIES keeps its
  own squad push coordination (`CopLogicTravel.chk_group_ready_to_move`), which
  Iter does not replace. LIES' Navlink Delays setting feeds Iter's queue: the
  scaled interval is written at element finalization, then Iter min-caps it per
  `so_action` (1-2 s) into `values.itr_interval` and zeroes the engine delay
  while `nav_streamline` is on (the default), so the lower multipliers are
  partly absorbed by Iter's cap.
- **Keepers — compatible, target `priority: 10`.** Keepers should load after
  LIES so its wrappers compose on top. Phase 3 removes its `CopLogicIdle`
  overrides (`queued_update`, `clbk_action_timeout`); LIES now carries Keepers'
  `kpr_done` guard in `clbk_action_timeout`, so the behavior survives the
  removal.
- **Monkeepers — compatible, set `priority: 99`.** 99 loads after LIES (100)
  and before Keepers (10), so Monkeepers' `is_obstructed` and `CarryData`
  wrappers survive. Phase 4 removes its `TeamAILogicIdle.action_complete_clbk`
  override; LIES now carries the `my_data.action_expired` guard it relied on.
- **Useful Bots — compatible, untouched.** Useful Bots owns bot-side
  intimidation and marking when installed (it loads after LIES and replaces
  those functions). LIES' LIES-specific bot tweaks are only observable without
  it. LIES adds no new hooks into that surface.
- **The Fixes — compatible.** The Fixes loads last and owns `CopActionWalk._init`
  in the full profile; its body replaces LIES'. LIES' own `_init` carries a
  standalone nil guard (`self._nav_path` / `self._nav_path[1]`) so it stays
  safe without The Fixes.

Full function-level matrix, evidence, and test profiles:
`dev/reports/compatibility.md` in the source repository.

## Configuration

Most players can leave the defaults alone.

- **Take Cover Through LUA** — opt-in custom cover search plus Nav-B generation.
  Higher CPU cost; generated covers are visible only to LIES's Lua search.
- **HHTACS / Spicy Tactics** — large, non-vanilla AI behavior change. Off by
  default; enable only if you want the full LIES experience.
- **Navlink Delays** — 1x / 0.5x / 0.25x / NO CHILL. Scales the animation
  delay cops spend on animated nav links. NO CHILL removes the delay and can
  stack cops on the same link.
- **Debug Logging** — off by default. When enabled, writes `[LIES-CHECK]`
  diagnostic events to `mods/logs`. Enable it only while collecting a bug
  report.

Full option descriptions: [MENU_OPTIONS.md](MENU_OPTIONS.md).

## Auto-updater

LIES checks the fork's update feed at startup:

`https://raw.githubusercontent.com/met94/Little-Intelligence-Enhancements-x64/main/autoupdate.json`

If the feed advertises a version that differs from the installed one, the update
prompt links to the GitHub releases page. The comparison is equality, not
ordering (`menunodegui.lua`), so it cannot tell a newer build from an older one;
the mod does **not** silently download or install updates.

## Versioning

Versions use `<upstream release>.<fork patch>`:

- `8.57.31` is the 31st fork release built on upstream LIES **8.57**
  (`4215a39`, 2026-06-06). The patch counter is ours and only ours; upstream
  numbers are never continued.
- When upstream ships a new release, the fork's changes are rebased onto it and
  the patch counter restarts: upstream `8.60` becomes `8.60.1`, then `8.60.2`,
  and so on. The base of the current release is recorded in
  `dev/upstream-base.json`, the whole relabeled history in
  `dev/version-map.json`.
- Releases published before the 2026-11-03 relabel keep their old labels
  (`V8.86_x64` = `8.57.30`, mapped in `dev/version-map.json`) in GitHub tags,
  assets and old logs.

## Known deviations from the original 246.1 build

These are intentional 248.2 port decisions, not missing files:

- LIES's incompatible EnemyManager v246 disposal/task-queue overrides were
  removed; vanilla 248.2 timers are used.
- Dead v5 navigation code and the unused recon-sweep subsystem were removed.
- Nav-B generated covers are LIES-search-only and opt-in.
- Marshal marksmen keep the long-standing LIES `CopLogicAttack` mapping.

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

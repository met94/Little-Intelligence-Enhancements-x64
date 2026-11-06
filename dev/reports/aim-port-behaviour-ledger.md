# Behaviour ledger: what the `CopLogicAttack._upd_aim` port removed

One-line summary: the 248.2 port of `_upd_aim` (`bbb30fa`, 8.57.19) deleted twelve
behaviour blocks; three are load-bearing and cheap to restore (`_chk_enrage`, the
hostage safe-weapon swap, the charge abort), one is load-bearing but was **already
inert since V7.84** because of an operator-precedence mistake (`enemy_reaction_level`
fire delay), and the rest are either covered by vanilla's expected-position helper or
should stay retired.

Analysis only at the time of writing — no code was changed then. The verdict column
records the restores that followed (8.57.21/8.57.22) and the 8.57.23 door-watch restore;
the per-block detail keeps the pre-restore evidence. Report path:
`dev/reports/aim-port-behaviour-ledger.md`.

## 1. Method

Every claim below comes from one of these commands, run against the pre-port state
`d5cb206` (= `bbb30fa^`) unless stated otherwise:

```powershell
# provenance inside the function (not just inside the file)
git -C mods\LIES log --date=short --format='%h %ad %an %s' -S '<identifier>' -- lua/coplogics/coplogicattack.lua
# exact line ownership of the pre-port body
git -C mods\LIES blame --date=short -L 861,1440 d5cb206 -- lua/coplogics/coplogicattack.lua
# what the function looked like before the 2025 sync
git -C mods\LIES show 46a93f2^:lua/coplogics/coplogicattack.lua
# vanilla 248.2 equivalents
Get-ChildItem -Recurse -Filter *.lua game-data\Payday-2-LuaJIT-Complete |
  Select-String -Pattern '<symbol>'
```

`-S` alone is not enough: it reports the first commit that changed the token count
*anywhere in the file*, while several identifiers (`nav_segment`, `_cancel_charge`,
`in_slot(16)`) existed in other functions years before they entered `_upd_aim`. The
per-block provenance below therefore also states when the token first appears **inside
the `_upd_aim` body**, obtained by extracting
`function CopLogicAttack._upd_aim ... ` from every one of the 101 commits that touched
the file and testing for the token.

Two structural facts about the history:

- `d5cb206` (pre-port) and `46a93f2` (2025-10-22) are the two states that matter.
  `46a93f2` is a single non-merge commit by **fugsystem** ("i forgot about all of this
  tbh now its up to date", 787 lines changed in this file). Its parent `ada35d8`
  ("7.91", Fuglore, 2024-03-13) has a `_upd_aim` of ~200 lines with **none** of blocks
  1–5, 11. So those blocks entered the mod *in the 2025 sync*, not in the Fuglore era.
- There is **no changelog history to quote**. `changelog.txt` does not exist in git
  history before 2026: `git show <any pre-2026 commit>:changelog.txt` fails with
  `path 'changelog.txt' exists on disk, but not in '<commit>'`. Fuglore-era commit
  messages are bare version numbers (`7.35`, `v4`, `6`, `4.6`, and once `ugh`). Author
  purpose for those blocks is therefore reconstructed from the code, the menu text
  (`MENU_OPTIONS.md`, `loc/en.txt`, `menu/options.txt`) and the later audit documents
  in `dev/reports/`.

Version numbers are taken from the commit message where it is a release number;
`46a93f2` and `997e95e` are pre-release development commits inside the 8.49 cycle.

Anchor line numbers are for the **current worktree file**
(`.worktrees\LIES-ai-suite-compat\lua\coplogics\coplogicattack.lua`, 2482 lines; commit
`703c9af` did not touch this file, so the numbers are identical to `bbb30fa`).

## 2. Verdict table

| # | Block (removed) | Provenance (commit / date / author / version) | Author purpose | Setting contract | Vanilla 248.2 equivalent | Tracker-dependent | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Cached-tracker aim path: `nav_segment()`, `obstructed()`, `_nav_segments[seg].pos` height preference | `46a93f2` 2025-10-22 fugsystem (8.49 cycle); `nav_segment` file-wide first `083c856` 2022-04-30 Fuglore; guarded form `f67323c` 2026-10-31 met94 | Aim at last known pos when both units share a segment; otherwise watch the enemy's segment | `highperformance` (off-gate only) | `_get_expected_attention_position`, `coplogicattack.lua:1506-1523` (same-seg `+140` z), `1525-1618` (path/doors) | **Yes** (enemy tracker; guard test forbids `.nav_tracker[.:]`) | **PORT** (segment gate) + **RE-ADD** (height preference, tracker-free substitute; 8.57.23) |
| 2 | Door probing: `find_segment_doors(enemy_nav_seg)`, raw-door `with_z(+140)` rays, `door_raw` counter | `46a93f2` 2025-10-22 fugsystem; raw-position branch `78dab8a` 2026-10-23 met94 (AI-01); counter `4a80b5f` 2026-10-26 met94 | Predict the target through a doorway when it is in another segment ("cops never predict a target through a doorway") | `highperformance` (off-gate only) | `_get_expected_attention_position` `1544` `find_segment_doors(..., "_chk_is_right_segment", to_nav_seg)` + door `+140` pick (`1549-1580`) | **Yes** (`enemy_nav_seg`) | **RE-ADD (8.57.23)** — the LIES layer watches the enemy segment's doors, including nav-link doors vanilla skips; `door_raw` has a producer again |
| 3 | Lateral sight search: `find_walls_across_pos`, per-position `ai_vision` rays, writes to `focus_enemy.last_verified_pos/_m_pos/_dis` | `46a93f2` 2025-10-22 fugsystem | Re-authorise aim around cover by finding a nearby position with a clear line to the target's last known position | `highperformance` (off-gate only) | **None** in aim; nearest analogue `find_walls_accross_tracker` at vanilla `coplogicattack.lua:1312`, `coplogictravel.lua:591` | **No** (pure position math) — but it *mutates* shared attention state | **RETIRE** — deferred planned future work under the door-watch umbrella (`dev/reports/door-watch-port.md`) |
| 4 | Expected-position machinery: `_get_expected_pos`, `my_data.expected_pos*`, `_set_attention_on_pos` | `46a93f2` 2025-10-22 fugsystem (`_set_attention_on_pos` itself from base `083c856` 2022-04-30) | Keep a look position on the nav graph across segments | `highperformance` (off-gate only) | `_get_expected_attention_position` `1506-1618`, `_chk_is_right_segment` `1620`, search kick-off `1613-1616` | **Yes**, but vanilla reads `main_enemy.nav_tracker` (`1508/1516`) and the current body is gated by `CopBrain:check_upd_aim` `copbrain.lua:267-275` | **RE-ADD** (caller restored; no longer dead code) — 8.57.23 |
| 5 | Charge abort: `try_stop_charge`, aggro/`dis <= 200` condition, `_cancel_charge`, `cover_test_step`, `at_cover_shoot_pos` | `_cancel_charge` fn `cb9f15d` 2022-07-05 Fuglore (4.5); in-aim block + condition `46a93f2` / `997e95e` 2025-10-22 fugsystem | Code comment: "stop the charge, we are not chargers we do not push unless nescessary" | **`enemy_aggro_level`** (default 2; only `MOSH PIT`/4 keeps charging) + `data.tactics.charge`, `has_tag("tank")`, `tankboss` | `_cancel_charge` exists and is called at vanilla `561/873/884/1011`, but vanilla `_upd_aim` (`1051-1200`) has **no** charge handling | **No** | **RE-ADD** at `_upd_aim` line **872**, plus restore `local tankboss = { triad_boss, deep_boss }` above `864` |
| 6 | Turn-to-shoot concessions: `dmg_t < 5`, `acquire_t < 4` + `weapon_range.close` | `dot<0.7` base `083c856` 2022-04-30 / `cb9f15d` (4.5); `acquire_t` `712387f` 2022-06-20 (v4); `dmg_t` `997e95e` 2025-10-22 fugsystem; `can_turn_to_shoot` `a3b79a1` 2026-01-03 fugsystem (8.5); distance clause `4215a39` 2026-06-06 (8.57) | Do not stop to shoot a target you are running away from — unless you were just damaged or just acquired it at close range | none | Run-direction gate only: vanilla `1068-1071` (`dot < 0.6` → `shoot = false; aim = false`), adopted at current line `883` | **No** | **RE-ADD** inside the existing `dot < 0.6` branch, current lines **883-887** |
| 7 | Hostage safe weapon: `request_switch_to_safe_weapon(3)` / `request_switch_to_normal_weapon(7)`, `safe_equipped`, `hhtacs` + `hostageblock` chatter | `df5d673` 2023-09-05 Fuglore (**7.35**); restore half `29488f1` 2023-09-06 (**7.36**); `verified_t`/`shooting` window `2080f65` 2023-12-01 (**7.61**) | A cop whose shot is blocked by a hostage drops to its `char_tweak.safe_weapon`, stops firing, and swaps back 7 s later | **`hhtacs`** (default `false`; "Adds LIES-specific AI behaviours") | **None.** `request_switch_to_safe_weapon` does not exist in 248.2 (`Select-String` over the whole game-data tree: no hits). They are LIES `CopBrain` methods, `copbrain.lua:1141` / `1193`; `hostage_blocked` is LIES-only too (`coplogicidle.lua:1465-1510`) | **No** | **RE-ADD** at `_upd_aim` line **872** — both halves together (see §3.7) |
| 8 | Boss features from aim: `LIESBossLogicAttack._chk_use_throwable`, `CopLogicAttack._chk_enrage` | `_chk_use_throwable` `15c25c6` 2022-10-19 Fuglore (**6**); `_chk_enrage` `102511a` 2022-07-10 Fuglore (**4.6**) | `_chk_enrage`: enrage meter for `char_tweak.enrages` units (tanks/dozers) → `base_damage` buff + "surprised" act + warning chatter. `_chk_use_throwable`: frag for `char_tweak.throwable` units | none directly (`hhtacs` shapes `zeal_heavy_swat` tweaks) | `BossLogicAttack._chk_use_throwable` at vanilla `bosslogicattack.lua:792` (called `730`) — boss-only. `_chk_enrage`: **absent from 248.2** | **No** | `_chk_enrage`: **RE-ADD** at current line **1062** (before `aim_allow_fire`). `_chk_use_throwable`: **RE-ADD** with its `shoot and not safe_equipped and not hostage_blocked` guard |
| 9 | Reload callout: `chk_say_enemy_chatter(..., "calloutreload")` for `is_local_player` / `anim_data.reload` | `712387f` 2022-06-20 Fuglore (**v4**) | Harass-tactic cops call out that the target is reloading | none (needs `data.tactics.harass`) | **None.** `calloutreload` has no hits in 248.2; the chatter type is LIES data, `groupaitweakdata.lua:4741`, now producer-less | **No**, but a dead-unit hazard (needs the `alive()` gate from `cef3fef`) | **RE-ADD (deferred)**; alternative is **RETIRE** *and* delete `groupaitweakdata.lua:4741` + its `loc` lines |
| 10 | Reaction-level fire delay: `enemy_reaction_level < 3`, `react_t = 2 / level`, `in_slot(16)`, team gate | gate + `0.7/N` `712387f` 2022-06-20 (v4); `2/N` `6be9cb2` 2023-02-22 (**6.7**); team clause `ab0d5e4` 2024-02-09 Fuglore (**7.84**) | Docs: hold fire for `2 / enemy_reaction_level` seconds after verification ("Reaction Level") | **`enemy_reaction_level`** (default `1`; SLOW/NORMAL/ULTRA-VIOLENCE, `loc/en.txt:41-45`) | **None** (no player-facing reaction pacing; vanilla paces via `focus_enemy.reaction` and suppression `1084`) | **No** | **RE-ADD (fixed)** — `not data.team.id == "criminal1"` made the gate a constant `false` (see §3.10); restored in 8.57.22 with `not data.is_converted` and a guarded divisor |
| 11 | Shoot-stop guard: `my_data.start_shoot_t`, 0.5 s hold | `46a93f2` 2025-10-22 fugsystem | Keep the reload decision from flapping when the target flickers in and out of the aim window | none | **None**; vanilla requests `idle`/`reload` immediately (`1033-1050`, current `1033-1050`) | **No** | **RETIRE** (the state it guarded no longer exists: `my_data.shooting` is now the vanilla boolean, set at current `1030`) |
| 12 | Weapon-range self-heal: 2000/5000/1000 backup + `complained_about_invalid_range` logs | `4215a39` 2026-06-06 fugsystem (**8.57**) | Rebuild `weapon_range` from the equipped weapon when it was unset | none | Not needed: `CopBrain:check_upd_aim` returns early without `internal_data.weapon_range` (`copbrain.lua:248-250`, from `49d4d9e` 2024-01-27 Fuglore **7.81**); vanilla body reads it only at `874` (guarded by that caller) and `895` (nil-checked) | **No** | **RETIRE** (`port-decisions.md:119` already called it "belt-and-braces") |

Counts (12 blocks): **RE-ADD** 8 — block 1's height preference (tracker-free
substitute), blocks 2 and 4 (8.57.23), 5 and 7 unconditional, 6 and 8 with
conditions, 9 deferred, 10 in corrected form (§3.10, restored in 8.57.22 as
**RE-ADD (fixed)**); **PORT** 1 — block 1's segment gate itself, reached through
vanilla `_get_expected_attention_position`; **RETIRE** 3 — blocks 3, 11, 12
(block 3 is deferred planned future work under the door-watch umbrella, not
deleted).

## 3. Per-block detail

### 3.1 Cached-tracker aim path

Pre-port text (`d5cb206:1094-1097`, `1227-1231`, `1271`):

```lua
local my_tracker = data.unit:movement():nav_tracker()
local my_seg = my_tracker:nav_segment()
local enemy_tracker = lies_enemy_tracker(focus_enemy, data)
local enemy_nav_seg = enemy_tracker and enemy_tracker:nav_segment()
...
local all_nav_segs = managers.navigation._nav_segments
local seg_pos = all_nav_segs[enemy_nav_seg].pos
local height_preference = data.m_pos.z >= seg_pos.z
local try_watch_enemy_seg = height_preference or math.abs(data.m_pos.z - seg_pos.z) < 250 or focus_enemy.dis >= 2000
```

```powershell
git -C mods\LIES log --date=short --format='%h %ad %an %s' -S 'nav_segment' -- lua/coplogics/coplogicattack.lua
# 8be8890 2022-06-04 Fuglore Revert "3.3" / f3b8441 2022-06-04 Fuglore 3.3 / 7f69928 ...
```

The function-body scan puts the first appearance **inside `_upd_aim`** at `46a93f2`
(2025-10-22, fugsystem). `46a93f2^` (`ada35d8`, "7.91") contains no `nav_segment` inside
`_upd_aim` at all, so this is a 2025 addition, not a Fuglore-era one. Blame confirms:
`d5cb206:1094-1099` and `1227-1231` are all `46a93f2`, except `1096-1097` and `1271`,
which are met94's 2026 guards.

Vanilla covers the *functional* half — same-segment targeting and the `+140` head offset
— in `_get_expected_attention_position` (`coplogicattack.lua:1506-1523`):

```lua
local e_nav_seg = e_nav_tracker:nav_segment()
if e_nav_seg == my_nav_seg then
    mvec3_set(temp_vec1, e_pos)
    mvec3_set_z(temp_vec1, temp_vec1.z + 140)
    return temp_vec1
end
```

The height preference has no vanilla counterpart and reads a private manager field
(`NavigationManager._nav_segments`, `navigationmanager.lua:94`) to decide whether to
bother watching the enemy segment. Verdict: the segment gate is **PORTed already**
(reached through `_get_expected_attention_position`: the vanilla arm at
`lua/coplogics/coplogicattack.lua:1371` and the door-watch helper's two vanilla calls at
`134`/`159`); the height preference is **RE-ADD (tracker-free substitute)** in 8.57.23. It
keeps the author's three conditions (`data.m_pos.z >= enemy_z`, `|Δz| < 250`, target
distance `>= 2000`) but reads Z from `focus_enemy.m_pos` (the attention object's last known
position, falling back to the cop's own `m_pos.z`) — no `_nav_segments` lookup and no
enemy tracker. Details, plus the other deviations: `dev/reports/door-watch-port.md` §4.

Player POV: cops still stop and watch the last known spot when the target breaks line of
sight, and they again bother watching a target that is below them instead of ignoring it.
Not yet observed in game in the restored form.

### 3.2 Door probing

Two layers, introduced eight months apart:

- the door loop itself, `46a93f2` (2025-10-22, fugsystem) — `find_segment_doors(enemy_nav_seg)`
  with `door.end_pos` / `door.center` branches;
- the raw-position branch `if door.x then ... door:with_z(door.z + 140)`, `78dab8a`
  (2026-10-23, met94) — commit body: *"AI-01: `_upd_aim` now handles raw Vector3 doors.
  AI-02: `find_segment_doors` default branch returns raw `nav_link_end_pos()` positions;
  `center_only` still returns tables. Removes the vanilla phalanx `mvec3_set` type-error
  route."* That is the fix for `dev/reports/core-ai-gap-audit.md` AI-01: *"Door watching is
  dead for every ordinary door; cops never predict a target through a doorway."*
- the `door_raw` counter, `4a80b5f` (2026-10-26, met94) — watch-channel instrumentation.

```powershell
git show 4a80b5f -- lua/coplogics/coplogicattack.lua | Select-String -Pattern 'door' -Context 3,3
# - LIES:LogCheck("door watch raw position used")
# + LIES:LogCheck("door watch raw position used", "door_raw")
```

Vanilla does the same job from the nav graph, inside `_get_expected_attention_position`
(`1544`):

```lua
local found_doors = managers.navigation:find_segment_doors(
    from_nav_seg, callback(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", to_nav_seg))
```

with the `+140` sight test applied to `door.end_pos` (`1552-1560`). Vanilla's door list is
already the "raw position" shape (AI-02 in the gap audit says 248.2 callers assume
`Vector3`), so the port inherits AI-01's fix rather than losing it.

Verdict: **RE-ADD (8.57.23)**. The restore is a LIES layer *around* the vanilla helper,
gated by `door_watch and not highperformance`, not a method override: the game's
`lib/units/enemies/boss/logics/bosslogicattack.lua:694` calls the vanilla
`_get_expected_attention_position` directly (and LIES' own
`lua/coplogics/boss/bosslogicattack.lua` delegates to `CopLogicAttack._upd_aim` at
`245`/`935`), so the watch runs inside the shared `_upd_aim` body
(`lies_upd_expected_pos`, `lua/coplogics/coplogicattack.lua`). Deliberate deviations from
the pre-port probe: it calls the 2-arg `find_segment_doors(enemy_seg)` so nav-link doors
arrive as raw `Vector3` (vanilla's default branch shape); it probes on cadence only —
the pre-port probe itself was gated on `not expected_pos and test_for_sight`
(`bbb30fa^:1223`), and the `not my_data.advancing` term lived on the cached re-test
(`bbb30fa^:1213`) where it was unreachable at the only call site, so the re-test now runs
on the window too (`dev/reports/door-watch-port.md` §4); and the height gate is
tracker-free (§3.1). `door_raw` has a producer again and is
un-retired in `dev/reports/smoke-check-logging.md`. Evidence table and test-play
procedure: `dev/reports/door-watch-port.md` §5-§6.

Player POV: cops pre-aim at doorways of the segment the target is in again, including
animated nav-link doors vanilla's own door list skips, and `[LIES-CHECK] door_raw` smoke
events appear again when `debug_log` is on. Not yet observed in game.

### 3.3 Lateral sight search

`46a93f2` only (2025-10-22, fugsystem), `d5cb206:1109-1184`. It is not tracker-dependent:
it uses `data.unit:raycast`, `managers.navigation:find_walls_across_pos(last_verified_pos,
vec_to_pos, 360, 9)` and `pad_out_position`, and it **writes** the attention object:

```lua
focus_enemy.last_verified_pos = best_head_pos
focus_enemy.last_verified_m_pos = best_pos
focus_enemy.last_verified_dis = mvec3_dis(data.m_pos, focus_enemy.last_verified_m_pos)
```

Vanilla has no equivalent in aim. The closest constructs are
`find_walls_accross_tracker` at `coplogicattack.lua:1312` (flank position) and
`coplogictravel.lua:591` (door positions) — both tracker-fed and for movement, not aim.

Reasons to keep it retired rather than restore it: it rewrites `last_verified_pos` from a
**movement-driven** pass whose view of `attention_obj` can be one detection tick stale (the
same class of staleness that produced the 2026-10-31 crash, see
`dev/reports/aim-stale-nav-tracker-crash.md` §2); `last_verified_pos` is consumed by other
LIES code (`coplogicbase.lua:1044/1048/1342`, `copbrain.lua:1379`,
`coplogicidle.lua:2006`), so a stale write propagates; and up to 9 `ai_vision` rays per
0.2–1.5 s per unit is exactly the kind of work `highperformance` exists to avoid. Its output
(the "aim at a watch position instead of nothing") is what vanilla's
`_get_expected_attention_position` now provides. Verdict: **RETIRE**.

Recorded as **deferred planned future work** under the door-watch umbrella: if the watch
layer's write target ever moves off `focus_enemy.last_verified_*` (e.g. a private
`lies_last_verified_*` field), the lateral search becomes safe to evaluate again. It is not
part of the 8.57.23 restore and needs its own play test (`dev/reports/door-watch-port.md` §1).

Player POV: cops no longer sidestep to peek around cover to keep a bead on a hidden target;
they watch the last known position or the likely doorway instead. Not a regression of the
8.57.23 restore — the watch-position layer covers the same outcome.

### 3.4 Expected-position machinery

Introduced with `46a93f2` (2025-10-22, fugsystem) — both `_get_expected_pos` (the function,
`d5cb206:1437-1520`) and its call sites (`1200-1210`, `1223-1278`, `1338-1346`). `_set_attention_on_pos`
itself is base-level (`083c856`, 2022-04-30, Fuglore).

Vanilla's replacement is `_get_expected_attention_position` (`coplogicattack.lua:1506-1618`)
plus `_chk_is_right_segment` (`1620`) and the coarse-path kick-off (`1613-1616`). In the
current body it is reached at `lua/coplogics/coplogicattack.lua:1371` (the
`reaction < REACT_AIM` arm) and at `134`/`159` from inside `lies_upd_expected_pos` (the
feature-off and outer-gate fallbacks). Through 8.57.22 that was a genuine PORT, not
a retirement: the port's own changelog states it, and the vanilla helper does the same job
(same segment → `m_pos + 140`; else walk `expected_pos_path` and pick the door towards the
enemy segment).

8.57.23 restores the LIES caller as well (**RE-ADD**, caller restored): the pre-port body's
armed-path pre-step (`my_data.expected_pos_path` → `CopLogicAttack._get_expected_pos`) and
the cross-segment fallback both call it again from `lies_upd_expected_pos`, so
`_get_expected_pos` is no longer dead code. The pre-port state snapshot below is kept as
the provenance record:

```powershell
Get-ChildItem -Recurse -Filter *.lua lua | Select-String -Pattern '_get_expected_pos\b'
# before 8.57.23: coplogicattack.lua:1066 definition only, no caller
```

```powershell
Select-String -Path lua\coplogics\coplogicattack.lua -Pattern 'expected_pos'
# 82: my_data.expected_pos = old_internal_data.expected_pos
# 83: my_data.expected_pos_path = old_internal_data.expected_pos_path
# 84: my_data.expected_pos_last_check_t = old_internal_data.expected_pos_last_check_t
# 218: my_data.expected_pos = nil
```

`_get_expected_pos` still passes the tracker-guard tests
(`dev/tools/test/aim-tracker-guard.test.mjs` asserts its `lies_enemy_tracker` bail-out);
`expected_pos`, `expected_pos_path` and `expected_pos_last_check_t` are copied between logic
re-entries and now read again by the restored pre-step and re-test.

Residual risk to watch in game: vanilla's helper reads `main_enemy.nav_tracker`
**without** a liveness check (`1508`, `1516`), and LIES runs the helper from the movement
update. Two guards stand between that read and a freed tracker: the
`CopBrain:check_upd_aim` gate (`copbrain.lua:267-275`, 8.57.19), and — since 8.57.23 — the
liveness check at the top of `lies_upd_expected_pos`, which runs *before* the feature gate
so the feature-off path cannot hand a freed tracker to vanilla either
(`dw_stale_bail`). Vanilla is safe because it only ever calls the helper inside a logic
update, right after detection. Verdict: **RE-ADD** (8.57.23), with the guard order pinned by
`dev/tools/test/door-watch.test.mjs`.

Player POV: cops keep aiming at the doorway or corner the player is expected to reappear
from, now using LIES's watch position when the target is in another segment and the
game's own nav-graph prediction otherwise. Not yet observed in game.

### 3.5 Charge abort

`_cancel_charge` is old (`cb9f15d`, 2022-07-05, Fuglore, 4.5) but the abort *policy* in
`_upd_aim` is from the 2025 sync: blame puts `d5cb206:975-1000` on `46a93f2` (fugsystem)
with the condition line on `997e95e` (2025-10-22, fugsystem, "the soil gave me warmth"):

```lua
--stop the charge, we are not chargers we do not push unless nescessary
if my_data.charging and not data.unit:movement():chk_action_forbidden("walk") then
    try_stop_charge = true
    if data.attention_obj.dis <= 200 or LIES.settings.enemy_aggro_level < 4
        and (not data.tactics or not data.tactics.charge)
        and not data.unit:base():has_tag("tank") and not tankboss[data.unit:base()._tweak_table] then
```

Vanilla has the mechanic but not the policy. `_cancel_charge` is defined at
`coplogicattack.lua:446` and called at `561` (`_chk_request_action_walk_to_cover_shoot_pos`),
`873`/`884` (`_upd_enemy_detection`: new target / attention lost) and `1011`
(`action_complete_clbk`, walk finished) — and **at no point** inside vanilla `_upd_aim`
(`1051-1200`, checked by scanning the range for `charging|flank_cover|at_cover_shoot_pos|
cover_test_step`: no hits).

The setting contract is explicit: `enemy_aggro_level` (default `2`), documented as
"Aggression Level … HIGH is the closest to Vanilla" (`loc/en.txt:27-32`), and the gate reads
`< 4`, i.e. the policy is "only MOSH PIT keeps charging". Since the port removed it, level 4
and level 2 now behave identically for charging cops — the option loses one of its few
concrete behaviours.

Tracker dependency: none (`data.attention_obj.dis`, `data.tactics`, unit tags).

Verdict: **RE-ADD** at line `872` (immediately after `local last_sup_t`, before the
`focus_enemy.verified or focus_enemy.nearly_visible` branch), and restore
`local tankboss = { triad_boss = true, deep_boss = true }` above line `864` — the port
deleted it (diff hunk at `-856`) because nothing referenced it any more
(`Get-ChildItem -Recurse lua | Select-String tankboss` now hits only `teamailogicidle.lua:141`).
Two writes must come with it: `my_data.at_cover_shoot_pos = true` and
`my_data.cover_test_step = 0`, or the cop keeps re-entering the charge branch from
`_upd_combat_movement`.

Player POV: on the default aggression a charging cop stops at a sensible distance and shoots
instead of bulldozing into the player; at MOSH PIT it keeps charging. That distinction is
currently missing.

### 3.6 Turn-to-shoot concessions

Three layers over five years: the run-direction gate (`dot < 0.7` → `shoot = false; aim =
false`) is base behaviour from `083c856`/`cb9f15d` (2022); `acquire_t` and `low_value_att`
arrive with `712387f` (2022-06-20, Fuglore, v4); `dmg_t` with `997e95e` (2025-10-22,
fugsystem); `can_turn_to_shoot` with `a3b79a1` (2026-01-03, fugsystem, 8.5); the
`weapon_range.close` distance clause with `4215a39` (2026-06-06, fugsystem, 8.57). Blame:
`d5cb206:1035-1041` = `a3b79a1` + `4215a39`.

```lua
local can_turn_to_shoot = focus_enemy.dmg_t and data.t - focus_enemy.dmg_t < 5
can_turn_to_shoot = can_turn_to_shoot or focus_enemy.acquire_t and data.t - focus_enemy.acquire_t < 4 and focus_enemy.dis <= weapon_range.close
if not can_turn_to_shoot then shoot = false; aim = false end
```

Vanilla has the outer gate with a different threshold and no concessions: `1068-1071`
`if dot < 0.6 then shoot = false; aim = false end` — adopted by the port at current
`883-887`. No vanilla equivalent for the concessions, and no setting.

Tracker dependency: none. This is the cheapest of the behavioural re-adds: two lines nested
in a branch that already exists. The only decision is the threshold — vanilla `0.6`, LIES
`0.7` (current line `883` already says `0.6`).

Verdict: **RE-ADD** at `883-887`. Note the task listing lumps `in_slot(16)` and
`team.id == "criminal1"` into this block; both actually live in the block-10 gate
(`d5cb206:1417`) and are treated there.

Player POV: a cop running past the player currently never snap-shoots; with the concessions
back, a cop that was just hit or just acquired the player at point-blank range turns and
fires instead of running on.

### 3.7 Hostage safe weapon

Fuglore-era, fully documented by version: `df5d673` (**7.35**, 2023-09-05) added
`hhtacs` + `hostageblock` chatter + `request_switch_to_safe_weapon`; `29488f1` (**7.36**,
2023-09-06) added the restore half; `2080f65` (**7.61**, 2023-12-01) added the
`verified_t`/`my_data.shooting` window. Blame: `d5cb206:928-973`.

This is a two-sided feature whose other side is still in the tree and now unreachable:

```powershell
Get-ChildItem -Recurse -Filter *.lua lua | Select-String -Pattern 'request_switch_to_(safe|normal)_weapon|safe_equipped'
# copbrain.lua:1141 function CopBrain:request_switch_to_safe_weapon(t)
# copbrain.lua:1146/1162      safe_equipped reads/writes
# copbrain.lua:1193 function CopBrain:request_switch_to_normal_weapon(t)
# copbrain.lua:1194/1198      safe_equipped reads/writes
```

Zero call sites. Vanilla 248.2 has neither method:

```powershell
Get-ChildItem -Recurse -Filter *.lua game-data\Payday-2-LuaJIT-Complete | Select-String -Pattern 'request_switch_to'
# (no output)
```

`hostage_blocked` is equally LIES-only, produced by `coplogicidle.lua:1465-1510` under
`hhtacs`. The affected units are those with `char_tweak.safe_weapon`:
`charactertweakdata.lua:161/171/175/176` (swat family, medic, spooc) and
`copextensions\copbase.lua:64/129` (mp5, `zeal_heavy_swat` → `raging_bull`).

Two traps if this is restored:

1. `request_switch_to_normal_weapon` has **no other caller**. Restoring only the safe-weapon
   half leaves the cop on the revolver/sidearm for the rest of the heist; the pair must go
   back together (the pre-port code called the restore on the `elseif data.safe_equipped`
   path, `d5cb206:955`).
2. Both halves `return` out of `_upd_aim`, so the placement matters: they must sit *before*
   the aim decision (pre-port position: after `last_sup_t`, i.e. current line `872`), or
   the cop evaluates a shot it will not take. The pre-port code also flushed
   `my_data.firing` via `set_allow_fire(false)`, which the restored block has to keep.

Verdict: **RE-ADD** at line `872`, both halves, with the `hhtacs` gate and the
`request_switch_to_safe_weapon(3)` / `(7)` seconds preserved.

Player POV: with Spicy Tactics on, a cop behind a human shield drops to a sidearm, stops
shooting, and picks its main weapon back up a few seconds after the hostage is no longer in
the way. Without the re-add, cops simply keep holding fire.

### 3.8 Boss features called from the generic aim body

`_chk_enrage` is in the attack logic since `102511a` (**4.6**, 2022-07-10, Fuglore);
`_chk_use_throwable` since `15c25c6` (**6**, 2022-10-19, Fuglore). Vanilla comparison:

- `_chk_use_throwable`: vanilla has `BossLogicAttack._chk_use_throwable`
  (`bosslogicattack.lua:792`, called at `730`). LIES's copy
  (`lua/coplogics/boss/bosslogicattack.lua:786`) also reads `data.char_tweak.throwable`, so
  the generic aim body only ever fired for units whose char tweak carries it:
  `charactertweakdata.lua:151-152` (`tank_mini` → `frag`, `drug_lord_boss` →
  `launcher_frag`) and `copextensions\copbase.lua:126-136` (`zeal_heavy_swat` →
  `launcher_frag`, paired with `safe_weapon = "raging_bull"`).
- `_chk_enrage`: **absent from 248.2** (`Select-String -Pattern 'chk_enrage'` over the
  whole game-data tree: no hits). It is LIES-only, and still present in the tree at
  `coplogicattack.lua:1292` with exactly one caller left:

```powershell
Get-ChildItem -Recurse -Filter *.lua lua | Select-String -Pattern '_chk_enrage'
# coplogicattack.lua:1292 definition
# bosslogicattack.lua:393 CopLogicAttack._chk_enrage(data, focus)
```

So the 8.57.19 changelog line "`BossLogicAttack.upd_aim` still calls both for bosses" is
**true** — but it hides the real loss. `char_tweak.enrages` is set for **tanks**
(`charactertweakdata.lua:206: self.tank.enrages = true`), i.e. ordinary bulldozers in the
attack logic; their enrage meter (5–10 s of sustained close combat → `base_damage` buff,
"surprised" act, and the pre-enrage warning line read at `coplogicbase.lua:1420` /
`bosslogicattack.lua:493/649`) no longer builds. Only dozers routed through the boss logic
still enrage.

Tracker dependency: none for either. `_chk_enrage` reads `focus_enemy.reaction`, `dis`,
`verified`, `verified_t` only.

Verdict: `_chk_enrage` → **RE-ADD**, one line at current `1062` (before
`CopLogicAttack.aim_allow_fire`), matching the pre-port tail position (`d5cb206:1306`).
`_chk_use_throwable` → **RE-ADD** with its original guard
`if shoot and focus_enemy and not data.safe_equipped and not focus_enemy.hostage_blocked`
(`d5cb206:1430`) — note the guard only becomes meaningful again once block 7 is back.

Player POV: bulldozers build up to their damage boost again while they keep you in sight,
and minigun dozers / the drug lord throw grenades from the generic aim path again.

### 3.9 Reload callout

`712387f` (**v4**, 2022-06-20, Fuglore), blame `d5cb206:1309-1323`. It is the only block in
this ledger whose data half is still in the tree with no producer:

```powershell
Get-ChildItem -Recurse -Include *.lua,*.txt | Select-String -Pattern 'calloutreload'
# lua/managers/groupaitweakdata.lua:4741: self.enemy_chatter.calloutreload = {
# changelog.txt:27 (the 8.57.19 removal note)
Get-ChildItem -Recurse -Filter *.lua game-data\Payday-2-LuaJIT-Complete | Select-String -Pattern 'calloutreload'
# (no output)
```

Vanilla has no reload callout, and `chk_say_enemy_chatter`
(`groupaistatebase.lua:4174`) is **not** nil-safe for an unknown type: it dereferences
`chatter_tweak.radius` at `4201` after `local chatter_tweak =
tweak_data.group_ai.enemy_chatter[chatter_type]` at `4179`. So the LIES tweak entry at
`groupaitweakdata.lua:4741` is currently inert only because nobody calls it; if the call is
restored the entry must stay, and if the behaviour is retired the entry plus its `loc`
strings should go, otherwise a future caller crashes.

Restoring it is cheap (no tracker, no state) but it does collide with the guard test: the
pre-port code called `focus_enemy.unit:movement():current_state()` and
`focus_enemy.unit:anim_data()`, and `dev/tools/test/aim-tracker-guard.test.mjs` asserts
`assert.doesNotMatch(aim, /focus_enemy\.unit:/)`. A restore must either route through a
local (`local fe_unit = focus_enemy.unit`) or update that assertion. `cef3fef`
(2026-10-31) already added the `alive(focus_enemy.unit)` gate that makes the read safe, and
that gate must be preserved.

Verdict: **RE-ADD (deferred)** — last in the restore order, or **RETIRE** with the
`groupaitweakdata.lua:4741` entry removed. Do not leave the tweak entry orphaned.

Player POV: harass-tactic cops call "he's reloading" again when the player reloads in their
line of sight.

### 3.10 Reaction-level fire delay — inert since 7.84

The block itself is old: `712387f` (**v4**, 2022-06-20, Fuglore) introduced
`enemy_reaction_level` + `in_slot(16)` + `0.7 / level`; `6be9cb2` (**6.7**, 2023-02-22,
Fuglore) changed the divisor to `2 / level`; `ab0d5e4` (**7.84**, 2024-02-09, Fuglore)
added the team clause:

```powershell
git show ab0d5e4 -- lua/coplogics/coplogicattack.lua | Select-String -Pattern 'in_slot' -Context 2,2
# -  if LIES.settings.enemy_reaction_level < 3 and not data.unit:in_slot(16) then
# +  if LIES.settings.enemy_reaction_level < 3 and not data.unit:in_slot(16) and not data.team.id == "criminal1" then
```

`not data.team.id == "criminal1"` parses as `(not data.team.id) == "criminal1"`; a non-empty
string is truthy, so the left side is `false`, and `false == "criminal1"` is `false`. The
whole conjunction is therefore constant `false`. Verified with the workspace LuaJIT:

```powershell
tools\luajit\luajit.exe <temp>\prec.lua
# enemy1   -> false
# criminal1-> false
# full gate (level<3, in_slot=false) -> false
```

Consequence: from V7.84 (2024-02-09) until the port, the ordinary-cop reaction delay never
executed. Both statements about it in the 8.57.19 changelog are therefore off — nothing was
"removed" from the player's experience, and "scheduled to come back" would be scheduling a
no-op if copied verbatim.

It is not dead mod-wide, which is why the menu option still does something: boss logic has
the same block **without** the team clause (`lua/coplogics/boss/bosslogicattack.lua:451-468`).
The cloaker instance is not a second copy of the delay — its
`enemy_reaction_level < 3` gate only guards `_chk_play_charge_spooc_sound`
(`lua/coplogics/specials/spooc/spooclogicattack.lua:340`, `372`). Only the
attack-logic instance was inert.

One more instance of the same precedence mistake exists and is *not* in this ledger's scope:
`coplogicidle.lua:1575` `if reaction < AIAttentionObject.REACT_COMBAT and not reaction ==
AIAttentionObject.REACT_ARREST then` — same shape, also constant `false`.

Verdict: **RE-ADD (fixed)** — restored in 8.57.22 (`lua/coplogics/coplogicattack.lua`,
inside `_upd_aim` at `1210-1236`, immediately before the boss-throwable guard/call at
`1240-1241`). It is a re-derivation, not a re-copy:

```lua
if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then
    local level = math.max(1, tonumber(LIES.settings.enemy_reaction_level) or 1)

    if level < 3 and not data.unit:in_slot(16) and not data.is_converted
        and not (data.team and data.team.id == "criminal1")
        and not (data.tactics and data.tactics.provide_coverfire_LIES) then
        -- re-arm rule kept verbatim, but on the private `focus_enemy.lies_react_t`
        -- 2 / level delay, `shoot = nil` only
    end
end
```

The broken `and not data.team.id == "criminal1"` is replaced by the two terms the
author meant: the converted-state flag `data.is_converted`, plus the `criminal1`
team id (nil-safe `data.team and ...`) because `TeamAIBrain` reuses
`CopBrain:_reset_logic_data` and never sets `is_converted`, so crew-AI bots (which
reach this body via `teamailogicassault.lua:299/463/478/481`) would otherwise eat
the hold. The `in_slot(16)` exclusion and the `verified_t` re-arm rule are kept.

Two further corrections over the pre-port body:

- **coverfire exemption** — with an unverified target the re-arm rule
  (`data.t - verified_t > 2`) is true every frame, so `shoot` would stay nil for
  exactly the window the coverfire tactic exists to cover. `provide_coverfire_LIES`
  is exempt: suppression fire is deliberate and must win.
- **private timer** — `focus_enemy.react_t` is also written by
  `coplogicbase.lua:608-618` (future deadline on re-pick) and
  `spooclogicidle.lua:30/72/85` (`data.t - 1` bypass), so the delays could stack.
  The block uses `focus_enemy.lies_react_t` with identical re-arm semantics.

The divisor is computed before the gate (`local level = math.max(1, tonumber(...) or 1)`,
then `if level < 3`), so a nil setting no longer errors on the comparison and a zero
setting cannot produce an infinite hold. Placement is at the pre-port position —
after the callout, before the throwable call and `aim_allow_fire`. Boss logic runs
this block (`LIESBossLogicAttack._upd_aim` delegates to `CopLogicAttack._upd_aim`
at `bosslogicattack.lua:245`) and also carries its own copy
(`bosslogicattack.lua:451-466`), which never had the broken clause; the cloaker
instance is unrelated (it gates `_chk_play_charge_spooc_sound`,
`lua/coplogics/specials/spooc/spooclogicattack.lua:340/372`). Needs in-game
verification at each of the three menu values, as noted above.

**In-game reading and follow-up (2026-11-06).** The first test play at SLOW
(`dev/reports/door-watch-port.md` §10, 8.57.23) returned
`react_hold=42043` vs `react_allow=2713`: 94 % of aim passes sat inside the hold
window. The re-arm rule is the cause — `data.t - verified_t > 2` re-stamps the
timer on every pass where the target's last verification is stale, including
while it cannot be seen at all, so an unverified target is held continuously and
every peek pays the window again. The single-arm reading ("hold fire for `2 / level`
seconds after verification") therefore understates the effect. The 2026-11-06
instrumentation (same `8.57.31` tree) keeps the behaviour and adds `react_arm` (one count per timer arm) and `react_blocked` (held
passes that cleared a real `shoot`) so a play can show whether the hold eats shots
or only idle aim passes; the reader prints the hold share and warns above 80 %.
A NORMAL-vs-ULTRA-VIOLENCE A/B on the same heist and difficulty is the next step,
and a one-arm rework is the fallback if `react_blocked` says real shots are being
lost in bulk.

Player POV: "Reaction Level" now changes regular SWAT and crew-AI first-shot timing
as well as the boss pacing — SLOW holds fire for roughly 2 s after verification,
NORMAL about 1 s, ULTRA-VIOLENCE not at all — while aiming and turning are
unaffected, Jokers are exempt, and cops laying down cover fire keep firing.

### 3.11 Shoot-stop guard

`46a93f2` only (2025-10-22, fugsystem), blame `d5cb206:1378` and `1382`:

```lua
if my_data.shooting then my_data.start_shoot_t = data.t end
...
if not my_data.start_shoot_t or data.t - my_data.start_shoot_t > 0.5 then
    ... CopLogicAttack._check_needs_reload(data, my_data) ...
```

Vanilla requests `idle`/`reload` immediately in the else-branch (`1033-1050`; current
`1033-1050`). No setting, no vanilla equivalent. Beyond "superseded", the guard's premise
is gone: it was written against `my_data.shooting` holding the **action handle** returned by
`action_request` (`d5cb206:1375`), whereas the adopted vanilla body stores a boolean
(`= true`, current `1030`) and clears it in `action_complete_clbk`. A verbatim restore would
compare timestamps that no longer exist. Verdict: **RETIRE**.

Player POV: none — this was anti-flicker pacing inside the aim body, and vanilla's immediate
idle/reload request is what the game already ships.

### 3.12 Weapon-range self-heal

`4215a39` (**8.57**, 2026-06-06, fugsystem), blame `d5cb206:875-920`. Three log lines
("weapon invalid", "range unset", "weapon dead") plus the `optimal/far/close =
2000/5000/1000` backup, guarded by the sticky `my_data.complained_about_invalid_range`.

Superseded twice over:

```powershell
git blame --date=short -L 244,252 lua/copextensions/copbrain.lua
# 49d4d9ea (Fuglore 2024-01-27 248) if not self._logic_data.internal_data or not self._logic_data.internal_data.weapon_range then
# 49d4d9ea (Fuglore 2024-01-27 249)     return
```

`my_data` *is* `data.internal_data` at every LIES call site (`copbrain.lua:283/285/287`
pass `self._logic_data.internal_data`), so the movement path can never see a nil
`weapon_range`; and `CopLogicAttack.enter` sets it for the attack family
(`coplogicattack.lua:49`), the only logic where the vanilla logic-update path reaches
`_upd_aim` with this body. `dev/reports/port-decisions.md:119-122` already reached the same
conclusion ("belt-and-braces … no change is needed for 248.2").

One caveat worth recording: the adopted body dereferences `my_data.weapon_range.close` at
current line `874` **without** a nil check (vanilla `1059` does the same). It is safe only
because of the caller gate. Any future direct `_upd_aim` call that bypasses
`CopBrain:check_upd_aim` re-opens the original failure. Verdict: **RETIRE** (optionally keep
a two-line `local wr = my_data.weapon_range` at the top if that invariant ever weakens).

Player POV: none; the three "range unset" log lines disappear from the log.

## 4. Cross-cutting findings

1. **The drop contradicts two existing written decisions.**
   `dev/reports/port-drop-log.md:128-137` lists `CopLogicAttack._upd_aim` under "Do not drop
   without review (kept LIES bodies)", and `dev/reports/port-decisions.md:119` records
   "**Decision: keep LIES**". Neither document was updated by `bbb30fa`; the replacement is
   only explained in `changelog.txt` 8.57.19. The crash justification is sound
   (`dev/reports/aim-stale-nav-tracker-crash.md`), but the two decision records now describe
   a state that no longer exists and should be amended when the re-adds land.

2. **The 8.57.19 follow-up list is three items; evidence says four, and one of the three is
   wrong.** The changelog schedules "the hostage safe-weapon swap, the charge abort and the
   `enemy_reaction_level` fire delay". Correct: hostage swap (block 7) and charge abort
   (block 5) are both live features with live contracts. Incorrect: the reaction delay was
   already inert (block 10, §3.10). Missing: `_chk_enrage` for tanks (block 8), which is a
   player-visible dozer behaviour and costs one line.

3. **Dead code and orphaned data left by the port** (all verified, none of it behaviour):
   `CopLogicAttack._get_expected_pos` (`1066`, no caller, still covered by the guard test);
   `expected_pos` / `expected_pos_last_check_t` carried through `enter` (`82-84`, no
   readers); `groupaitweakdata.lua:4741` `enemy_chatter.calloutreload` (no producer);
   `CopBrain:request_switch_to_safe_weapon` / `request_switch_to_normal_weapon`
   (`copbrain.lua:1141` / `1193`, no callers); the `tankboss` local (correctly removed with
   its only user). Each is either a re-add target or a deletion candidate — leaving them
   undecided is what makes the next port ambiguous.

4. **The guard test encodes the current shape, so re-adds will need it updated.**
   `dev/tools/test/aim-tracker-guard.test.mjs` asserts the `lies_enemy_tracker` call count
   (1 definition + 5 sites), forbids `focus_enemy.unit:` method calls inside `_upd_aim`,
   forbids `nav_tracker|nav_segment|obstructed|World:raycast` there, and requires
   `_get_expected_attention_position` to be used. Blocks 5, 6, 7, 8 and 10 pass those
   constraints as written; block 9 needs a local variable or an assertion change; deleting
   `_get_expected_pos` changes the call-count assertion.

5. **Vanilla's own tracker read is now on the movement path.** `_get_expected_attention_position`
   reads `main_enemy.nav_tracker` unguarded (`coplogicattack.lua:1508/1516`) and LIES calls
   it from `check_upd_aim`. The 8.57.19 liveness gate is the only protection, and it is a
   *caller* invariant, not an API guarantee. Worth an explicit smoke assertion
   (`movement_aim_stale` counter) rather than a comment.

## 5. Restore order

Cheap and safe first — none of these need a tracker, none can fault, and each restores a
setting or unit behaviour that is currently lost:

1. **`_chk_enrage` call** (block 8, one line at current `1062`). No state, no setting, no
   tracker; the function is already in the file and already unit-tested by boss logic usage.
   Verify: dozer takes sustained close-range fire → damage boost + warning line.
2. **Turn-to-shoot concessions** (block 6, inside `883-887`). Two lines in an existing
   branch; the only judgement call is `0.6` (vanilla, current) vs `0.7` (LIES), and either
   is safe.
3. **Charge abort** (block 5, at `872` + `tankboss` table). Restores an
   `enemy_aggro_level` distinction that currently does not exist. Must carry
   `at_cover_shoot_pos` / `cover_test_step` writes or the abort is cosmetic.
4. **Hostage safe weapon** (block 7, at `872`). Restores an `hhtacs` feature whose host-side
   methods are still present. Must be added as a pair; needs `hhtacs` on to test at all.

Needs in-game verification before shipping, in this order:

5. **`_chk_use_throwable`** (block 8b, at `1062`): check that a `tank_mini` dozer and the
   drug lord throw frags, and that the `safe_equipped`/`hostage_blocked` guard does not
   suppress throws permanently once block 7 is live (they interact — this is the one pair
   that must be tested together).
6. **Reaction delay, corrected form** (block 10) — **done in 8.57.22**, restored at
   `_upd_aim` just before the throwable call with `not data.is_converted` and a guarded
   divisor. Still to verify in game: all three values (`SLOW` / `NORMAL` /
   `ULTRA-VIOLENCE`) show different first-shot timing on ordinary cops, and nothing
   regressed at `enemy_aggro_level` 2 vs 4.
7. **Reload callout** (block 9): cosmetic; restore it or delete
   `groupaitweakdata.lua:4741`. Do not leave it orphaned.

Keep retired, and say so in the changelog so the next port does not re-litigate them:
block 3's lateral wall search (deferred under the door-watch umbrella, not deleted),
block 11's 0.5 s hold, block 12's range self-heal.

Blocks 1, 2 and 4 were restored in 8.57.23 (`dev/reports/door-watch-port.md`) as a LIES
layer around the vanilla expected-position helper: the height preference is tracker-free
(`focus_enemy.m_pos`), the door probe uses the 2-arg `find_segment_doors` so nav-link doors
arrive as raw `Vector3`, and `door_raw` has a producer again. The vanilla helper at
`1371` (plus the two gated calls at `134`/`159`) is still the fallback, not the only path.

Regression gate for the re-adds: `dev/tools/test/aim-tracker-guard.test.mjs` will need its
`_upd_aim` token list and call-count assertions reviewed (finding 4), plus the usual
`node --test dev/tools/test`, LuaJIT compile, `lua-freevars`, and a 2–3 minute loud run at
`enemy_aggro_level` default and 4 with `hhtacs` on (the pre-port smoke plan in
`port-decisions.md:124-132` still applies).

## 6. Where the evidence is inconclusive

- **No upstream release notes exist for any block older than 2026.** `changelog.txt` is not
  in git history (`git show <commit>:changelog.txt` fails for every pre-2026 commit), and
  Fuglore-era commit messages are bare version numbers. "Author purpose" for blocks 5–12 is
  reconstructed from the code, `MENU_OPTIONS.md`, `loc/en.txt`, `menu/options.txt` and the
  later `dev/reports/` audits — not from a quoted changelog line, because there is none.
- **`46a93f2` cannot be decomposed.** It is one non-merge 2025-10-22 commit touched by a
  single author that rewrote 787 lines of this file. Whether blocks 1–5 and 11 were written
  then or transplanted from an unmerged branch is not recoverable from this repository.
- **`in_slot(16)` has no named constant** anywhere in the vanilla tree. LIES uses the literal
  bit to skip certain units (`aim_allow_fire` also uses it, `coplogicattack.lua:1399`); the
  exact unit class it excludes is inferred from the crash report (team-AI bots) and not
  proven. This does not change any verdict, but a corrected block 10 should keep the literal
  rather than invent a name.
- **`door_raw` first appeared in `4a80b5f`** by direct inspection (`git show 4a80b5f` diff
  hunk), while the automated per-commit body scan reported "never" for that token. The
  direct diff is authoritative; the scan discrepancy was not chased further because the
  token is a diagnostics name with no behavioural weight.
- **Whether restoring block 7 actually re-enables the "hostage blocked" scenario in practice**
  could not be settled statically: `hostage_blocked` is computed in `coplogicidle.lua`
  (`1465-1510`) under `hhtacs`, and the aim body only consumes it. The re-add is justified by
  the still-present host code (`copbrain.lua:1141/1193`) and the menu contract, but the
  end-to-end path needs a live test.

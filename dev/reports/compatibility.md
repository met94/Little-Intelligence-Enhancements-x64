# LIES 248.2 — compatibility audit (installed mod set)

Scope: LIES in this worktree (`mod.txt`, 68 hook entries, `priority: 100`) against the
mods installed in `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods` and the
workspace checkouts in `v2\mods\`. Read-only audit; no runtime Lua was changed.

Method:

1. Intersect LIES `mod.txt` `hook_id`s with every installed/workspace `mod.txt`
   (`supermod.xml` for The Fixes).
2. For each shared hook file, compare the set of functions each overlay defines
   (`function Class:fn`) and the set it post/pre-hooks (`Hooks:PostHook`/`PreHook`).
3. Compare bodies against the 248.2 snapshot
   (`payday2_248.2_9_25_2026\...`) to tell "identical copy" from "different implementation".
4. Apply SuperBLT load semantics: `mods\base\req\BLTMod.lua:116-150` pushes every
   mod's script into a per-`hook_id` list, so **all** overlays run, in priority-descending
   order (higher `priority` = loads earlier); the **last definition of a function wins**.
   A wrap that captures `orig` composes with whatever was there; a bare re-definition
   replaces it wholesale.

Evidence commands are in the appendix.

## 0. Phase 2 delta (2026-10-25, V8.58_x64)

Phase 2 makes LIES carry the guards that Keepers/Monkeepers needed in their own
overrides, so those overrides can be removed in Phase 3/4. It also restores the
dead `Navlink Delays` setting.

| Change | Where | Why |
| --- | --- | --- |
| Navlink Delays multiplier + 3 s cap applied at element finalization, nav-links only | `lua/managers/mapelements/elementspecialobjective.lua` (`lies_send_navlink_element` post-hook) | Dead code before: the menu wrote `LIES.settings.nav_link_interval` and nothing read it. The block is gated on `self:_is_nav_link()` so regular SOs keep their `so_descriptor.interval` polling cooldown. Finalization runs before `init` clones `_values` and before `on_executed` → `register_anim_nav_link`, so the capped-then-scaled value reaches both `nav_link_delay()` and Iter's `itr_interval` (Iter re-clamps per `so_action` and zeroes the engine value under `nav_streamline`) |
| `kpr_done` guard in `clbk_action_timeout` | `lua/coplogics/coplogicidle.lua` | Keepers' own `clbk_action_timeout` skipped `objective_complete_clbk` for objectives it had already completed via `Keepers:on_completed_SO`; LIES must keep that once Phase 3 deletes Keepers' copy |
| `action_expired` guard in `action_complete_clbk` | `lua/teamailogics/teamailogicidle.lua` | Exact guard from Monkeepers' override (`elseif not my_data.action_expired`); Phase 4 deletes Monkeepers' copy |
| `self._nav_path` / `self._nav_path[1]` nil guards | `lua/copactions/copactionwalk.lua` (`_init`) | Vanilla had `not self._nav_path`; standalone LIES would index an empty path. The Fixes still owns `_init` in the full profile |

Null/no-op by construction: `interval` must be `> 0` (the default is `-1`), the
multiplier table is `{1, 0.5, 0.25, 0}` indexed by the menu's 1-based
`item:value()`, and a `_LIES_nav_interval_scaled` flag prevents double scaling.
`my_data.action_expired` is never set by team AI in 248.2, so that guard changes
nothing at runtime today.

## 1. Matrix

| Mod | Priority (loads) | Shared hook files | Same-function overlap | Who wins | Class | Test profile |
| --- | --- | --- | --- | --- | --- | --- |
| **NavFixes** | 0 (after LIES) | `lib/managers/navigationmanager` | `find_segment_doors` (LIES 3-arg vs NF 2-arg), `_sort_nav_segs_after_pos` (LIES 7-arg vs NF 6-arg) | NavFixes | **Hard conflict** — argument shift kills LIES coarse pathing + doorway cover/aim lookup (silent, no crash) | **do-not-run-together** |
| **Keepers** | 0 (after LIES; Phase 3 target `10`) | 19 files (cop*/teamai*/nav/menumanager) | 19 same-name fns; 17 wrap, **2 full replaces** (`CopLogicIdle.queued_update`, `clbk_action_timeout`) | Keepers on the 2 replaces; wraps compose | **Load-order-dependent** (LIES idle rewrite lost on 2 fns) — Phase 2 gave LIES Keepers' `kpr_done` guard, Phase 3 removes the overrides | compatible |
| **Monkeepers** | 100 → **99 (pinned)** | 6 files | `CopLogicBase.is_obstructed` (wrap), `CarryData:_chk_register_steal_SO` (wrap), `TeamAILogicIdle.action_complete_clbk` (**replace**) | LIES (99 loads after 100) | **Resolved by pinning to 99** — Phase 2 gave LIES Monkeepers' `action_expired` guard, Phase 4 removes the override | compatible **after pinning priority** |
| **Useful Bots** (+ HopLib 499) | 0 (after LIES) | 18 files | 16 same-name fns; 12 wrap, **4 replaces** (`TeamAILogicBase._get_logic_state_from_reaction`, `TeamAILogicIdle._find_intimidateable_civilians`, `TeamAILogicIdle.intimidate_civilians`, `TeamAILogicAssault.mark_enemy`) | Useful Bots | **Load-order-dependent**, no ordering preserves both (implementation clash); LIES adds no new hooks here (Phase 2 gated guards only) | compatible; choose bot-AI owner |
| **Iter** (full nav, 200.x, `nav_search` + `navlink_queue` on) | 40 (after LIES) | 20+ files incl. `navigationmanager`, `coplogictravel`, `copactionwalk`, `copbrain`, `coplogicidle`, `elementspecialobjective` | mostly `itr_original_*` capture-and-call wraps around LIES; `NavigationManager._execute_coarce_search` is a straight assignment when `nav_search` is on; `CopActionWalk._init` is wrapped and re-wrapped after The Fixes loads | Iter (nav owner), LIES bodies still run underneath | **Additive/safe** — Iter is the navigation owner (Option 1); LIES keeps its `_finalize_values` post-hook and `CopLogicTravel.chk_group_ready_to_move` (Iter does not define it) | compatible |
| **The Fixes** (`supermod.xml`) | -10 (last) | 14 files | `CopActionWalk:_init` (**replace**), `_perform_group_spawning`, `CopLogicAttack._upd_aim`, `aim_allow_fire` (wraps) | The Fixes | **Load-order-dependent** (LIES walk `_init` lost); guards otherwise compose. Phase 2 restored LIES' standalone `_init` nil guard; The Fixes still owns the body in the full profile | compatible, verify walk/cover feel |
| **Anticrash** | 500 (before LIES) | `lib/managers/menumanager` | none | n/a | **Additive/safe** | compatible |
| **pd2-hoplib** | 499 (before LIES) | `groupaistatebase`, `charactertweakdata`, `copdamage` | none (HopLib adds pre/post-hooks + `CharacterTweakData:character_map`) | n/a | **Additive/safe** | compatible |
| **JokerNoStagger** (LIES's Joker Tweaks Standalone) | 0 (after LIES) | `lib/units/enemies/cop/copbrain` | both post-hook `CopBrain:convert_to_criminal`; no definition clash | JNS runs after LIES | **Additive/safe** | compatible |
| **VanillaHUD Plus** | 1 (after LIES) | 10 AI hook files + `menumanager` | none | n/a | **Additive/safe** (HUD/menu only) | compatible |
| **Celer** | 0 (after LIES) | `coreworlddefinition`, `menumanager` | none | n/a | **Additive/safe** | compatible |
| **GoonmodCustomWaypoints** | 0 (after LIES) | `carrydata`, `menumanager` | none (`pre_destroy` vs LIES `_chk_register_steal_SO`) | n/a | **Additive/safe** | compatible |
| Other menu/weapon-tweak mods¹ | 0–20 (after LIES) | `menumanager`, `weapontweakdata` | none (LIES adds only `LIES:*` helpers and `WeaponTweakData:setup_hhtacs`) | n/a | **Additive/safe** | compatible |
| **Saw Helper**, `Who's there` | 0 | `playerstandard` only | LIES does not hook `playerstandard` | n/a | **No overlap** | n/a |

¹ Extra Profiles and Skill Sets, Hide Duplicate Skins, Optional Skin Attachments,
Super Duper Skin Swapper, More Weapon Stats, Low Ammo Indicator, Reload Then Run,
Mod-Hider, MethHelperUpdated, Get EXP from Kills, pd2-floating-healthbars, BerserkerQOL.

Installed and workspace checkouts are byte-identical for NavFixes, Keepers, Monkeepers,
Iter, JokerNoStagger, Celer, GoonmodCustomWaypoints (hash-compared). Exception:
**Anticrash** — the installed copy has an extra `lua\basenetworkhandler.lua`; this audit
used the installed copy. Useful Bots, VanillaHUD Plus and HopLib exist only in the
installed tree.

## 2. Details

### 2.1 NavFixes — hard conflict (the one that matters)

> Post-audit action: LIES now also carries the `register_anim_nav_link` and
> `remove_obstacle` guards, so it is self-sufficient without NavFixes. Still do
> **not** run both: NavFixes overwrites `find_segment_doors` and
> `_sort_nav_segs_after_pos` with incompatible signatures.

Same file, same two functions, **incompatible signatures**:

| Function | 248.2 vanilla | LIES | NavFixes |
| --- | --- | --- | --- |
| `NavigationManager:find_segment_doors` | `(from_seg_id, approve_clbk)` | `(from_seg_id, approve_clbk, center_only)` | `(from_seg_id, approve_clbk)` |
| `NavigationManager:_sort_nav_segs_after_pos` | `(to_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)` | `(to_pos, from_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)` | `(to_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)` |

LIES loads first (100), NavFixes second (0), so NavFixes' 6-argument body replaces LIES'
7-argument body while LIES' own caller still passes 7 arguments:

- LIES `_execute_coarce_search` (overlay, `lua/managers/navigationmanager.lua:2115`) calls
  `_sort_nav_segs_after_pos(to_pos, from_pos, i_seg, ...)`; under NavFixes' body
  `i_seg` receives a `Vector3`, `all_segs[i_seg]` is `nil`, and NavFixes returns early.
  `new_segments` is then `nil` — tolerated by `if new_segments then`, so **no error is
  logged**: coarse path searches simply never expand. Enemies/bots stop finding paths.
- LIES calls `find_segment_doors(seg, nil, true)` in three places
  (`navigationmanager.lua:164,383,907`) and with `center_only=true` for doorway
  aiming (`lua/coplogics/coplogicattack.lua:1398,1402`). NavFixes' body ignores the third
  argument and returns raw door entries; LIES' consumers read `door.center` /
  `door.end_pos` (`navigationmanager.lua:708`, `coplogicattack.lua:~1398-1415`) and get
  `nil` — doorway cover generation and the aim wall-peek path silently degrade.

Both are *silent* failures: nothing in the log points at the mod pair, which makes this
worse than a crash for diagnosis.

### 2.2 Keepers — load-order-dependent, 2 real losses

19 shared files, 19 same-name functions. 17 are wraps (`local kpr_original_... = Class.fn`
then call it), so they compose on top of LIES' overlays:

- `CopBrain`: `add_pos_rsrv`, `set_objective` (wrap); `convert_to_criminal` is Keepers-only,
  LIES does not define it (LIES only post-hooks it) — no clash.
- `CopLogicAttack`: `action_taken`, `_chk_wants_to_take_cover`, `_update_cover` (wrap).
- `CopLogicTravel`: `enter`, `_determine_destination_occupation`, `get_pathing_prio`,
  `_on_destination_reached`, `_chk_request_action_walk_to_advance_pos` (wrap).
- `TeamAIMovement.chk_action_forbidden`, `TeamAILogicIdle.action_complete_clbk`,
  `TeamAILogicTravel.enter`, `TeamAILogicDisabled._register_revive_SO`,
  `PlayerBleedOut._register_revive_SO`, `GroupAIStateBase._determine_objective_for_criminal_AI`,
  `NavigationManager.register_cover_units` (wrap).

Two functions are **bare re-definitions with no `orig` call** in Keepers
(`mods\Keepers\lua\coplogicidle.lua:4,88`), and Keepers always loads after LIES:

- `CopLogicIdle.queued_update` — LIES 109 lines vs vanilla 54 (a real rewrite), Keepers
  replaces it with its own body.
- `CopLogicIdle.clbk_action_timeout` — LIES 23 vs vanilla 21.

Effect: LIES' idle/bot-search rewrite is inert while Keepers is installed. No ordering
fixes this (raising Keepers above 100 would drop Keepers' own idle logic instead). Keep
Keepers as the owner of `CopLogicIdle`; treat LIES' version as superseded.

**Phase 2 (V8.58_x64):** LIES' `CopLogicIdle.clbk_action_timeout` now carries Keepers'
`kpr_done` guard (`... and not data.objective.kpr_done`), and Keepers' target priority is
`10` so its wrappers keep composing on top of LIES. Phase 3 removes Keepers'
`queued_update`/`clbk_action_timeout` overrides; the guard LIES adopted is what makes that
removal behavior-neutral.

### 2.3 Monkeepers — undefined order (priority tie)

Both `mod.txt` files declare `priority: 100`. The tie-break happens in SuperBLT's native
sort and has no documented secondary key (directory enumeration order, not exposed to Lua),
so the resulting order is not knowable from the files. Three functions actually collide:

- `CopLogicBase.is_obstructed` — Monkeepers wraps (`local mkp_original_..._isobstructed`),
  so safe **only if Monkeepers loads after LIES**.
- `CarryData:_chk_register_steal_SO` — Monkeepers wraps LIES' 121-line body with a 15-line
  body; safe only if Monkeepers loads after LIES.
- `TeamAILogicIdle.action_complete_clbk` — Monkeepers **full replace** (48 lines, no orig)
  vs LIES 61 lines (near-vanilla 58). Whoever loads second wins outright.

Recommendation: pin Monkeepers to **99** (loads after LIES, still before Keepers at its
current default 0 and its Phase 3 target of 10).
Result: LIES → Monkeepers → Keepers, both wrappers live, and only LIES' near-vanilla
`action_complete_clbk` is dropped instead of Monkeepers' bag/objective logic.
The reverse pin (101) would be worse: Monkeepers' `is_obstructed`/`carrydata` wrappers
would be discarded.

**Phase 2 (V8.58_x64):** LIES' `TeamAILogicIdle.action_complete_clbk` now uses
`elseif not my_data.action_expired then`, the exact guard Monkeepers' override used
(`mods\Monkeepers\lua\teamailogicidle.lua:46`). Monkeepers' target priority stays `99`.
Phase 4 removes its override; `action_expired` is never set by team AI in 248.2, so the
guard is behavior-neutral today and only preserves intent for the removal.

### 2.4 Useful Bots — load-order-dependent, needs an owner decision

18 shared files; its per-hook scripts live in `mods\Useful Bots\lua\` and are loaded
through `HopLib:run_required` (mod is inert if HopLib is missing). 12 of the 16 same-name
functions wrap LIES (coplogictravel ×4, coplogicattack, groupaistatebase, groupaistatebesiege,
teamailogicidle ×3, teamailogictravel, playerbleedout). Four are independent re-implementations:

| Function | LIES | Useful Bots |
| --- | --- | --- |
| `TeamAILogicBase._get_logic_state_from_reaction` | 9 lines | 11 lines (replace) |
| `TeamAILogicIdle._find_intimidateable_civilians` | LIES-defined | replace |
| `TeamAILogicIdle.intimidate_civilians` | 98 lines (vanilla 85) | 33 lines (replace) |
| `TeamAILogicAssault.mark_enemy` | 21 lines (vanilla 25) | 8 lines (replace) |

No priority ordering preserves both implementations — each pair is a different design, not
a wrapper. Since Useful Bots loads after LIES (0 < 100), **UB owns bot intimidation/marking
behavior** and LIES' versions are inert. That is the sane outcome for a bot overhaul, but it
must be stated in release notes: LIES' bot-side tweaks are only observable without UB.

### 2.5 The Fixes — last-loaded supermod, one full replace

`The Fixes` has no `mod.txt`; it ships `supermod.xml` (supported by
`mods\base\req\BLTMod.lua:18-35`) with `priority="-10"`, so it loads after every other mod
and its wrappers sit outermost. It shares 14 hook files with LIES (11 AI/unit, 2 tweak data,
1 menu), but only one function is a bare re-definition:

- `CopActionWalk:_init` (`mods\The Fixes\copactionwalk.lua`) — LIES 168 lines vs The Fixes
  173 lines, no orig call → LIES' walk init is replaced.
- Wraps that compose: `GroupAIStateBesiege:_perform_group_spawning`,
  `CopLogicAttack._upd_aim`, `CopLogicAttack.aim_allow_fire`, `CopActionShoot:update`,
  `CopDamage:*`, `GroupAIStateBase.on_criminal_objective_complete`,
  `CharacterAttentionObject`, `SecurityCamera`, `SentryGunBase`, `GroupAITweakData`,
  `LevelsTweakData`, `EnemyManager`.

Note the TheFixes' `_upd_aim` wrapper early-returns when `my_data.weapon_range` is nil — it
runs *outside* LIES' rewritten aim, so the crash fix still applies; that is intended
composition, not a conflict. Symptom to watch if walk/pathing behaviour regresses:
units sliding or failing to align to nav links (`nav_point.element` methods come from The
Fixes' file for that local class).

### 2.6 Iter (full nav) — the navigation owner

Iter is the full-nav option, not Iter Lite: the workspace checkout is Iter 200.1
(`priority: 40`) and its `mod.txt` hooks 20+ files including `navigationmanager`,
`coplogictravel`, `copactionwalk`, `copbrain`, `coplogicidle` and
`elementspecialobjective`. Named-function overlap with LIES is real (9 in
`coplogictravel`, 4 in `navigationmanager`, plus `CopActionWalk._init`,
`CopBrain.clbk_pathing_results`, `CopLogicIdle._perform_objective_action`).

Composition: Iter's nav functions are almost all capture-and-call wraps
(`local itr_original_* = Class.fn` then call it), so they sit outside LIES' overlay
and both run. The exception is `NavigationManager._execute_coarce_search`, which Iter
assigns outright when `Iter.settings.nav_search` is on. `CopActionWalk._init` is wrapped,
and re-wrapped after The Fixes loads (`Iter_rewrap_copactionwalk_init` on
`GameSetupUpdate`), so the winning `_init` stays inside Iter's path expansion. LIES
functions Iter does not define — notably `CopLogicTravel.chk_group_ready_to_move` — remain
LIES-only, which is why LIES squad push coordination still works with Iter full nav.

**Phase 2 (V8.58_x64):** the Navlink Delays multiplier is applied at
`ElementSpecialObjective:_finalize_values` to nav-link elements only (gated on
`_is_nav_link()`; a regular SO keeps its vanilla polling interval), i.e. before
`register_anim_nav_link` runs. Iter's wrapper then re-clamps the value: it
min-caps `values.interval` per `so_action` (1-2 s, `navigationmanager.lua:216-236`),
stores that as `values.itr_interval` (`:238`) and, with `nav_streamline`
(default on), sets `values.interval = 0` (`:240-242`). The queue therefore runs
on the capped `itr_interval` (`navigationmanager.lua:238,811,876,965`) while the
engine delay is 0; the 0.5x/0.25x multipliers are partly swallowed by Iter's
cap. A `0` interval makes Iter's `CopActionWalk:itr_reserve_navlink` return
immediately (`copactionwalk.lua:187-190`).

### 2.7 Additive/safe set

- **Anticrash (500)**: `lib/managers/menumanager` only, 17 `Anticrash:*`/`MenuCallbackHandler:*`
  functions — none collide with LIES' `LIES:*` helper set. Loads *before* LIES, harmless.
- **pd2-hoplib (499)**: `GroupAIStateBase.convert_hostage_to_criminal`/`_set_converted_police`
  post/pre-hooks, `CopDamage._call_listeners`/`load`/`destroy` hooks,
  `CharacterTweakData:character_map` — LIES defines none of these.
- **JokerNoStagger**: single post-hook on `CopBrain:convert_to_criminal`; LIES registers its
  own post-hook on the same function earlier (`lua/copextensions/copbrain.lua:122`). JNS
  clones the live `_logic_data.char_tweak`, so it composes both with LIES and with Keepers'
  `convert_to_criminal` override.
- **VanillaHUD Plus (1)**: shares 10 AI hook ids but only loads HUD/menu modules
  (`GameInfoManager.lua`, `KillCounter.lua`, `DownCounter.lua`, `Scripts.lua`, …); no AI
  function definitions overlap LIES. Menu scripts (`MenuTweaks`, `FastNet`, `PrePlanManager`)
  define `MenuCallbackHandler:*`/`MenuManager:*`, disjoint from LIES' `LIES:*`.
- **Celer, GoonmodCustomWaypoints, all menu/weapon-tweak mods**: disjoint names. LIES'
  `weapontweakdata.lua` is 22 lines that only add `WeaponTweakData:setup_hhtacs` — no tweak
  table rewrite, so skin/profiles mods cannot clash with it.
- **Saw Helper / Who's there**: hook `playerstandard`, which LIES does not hook — no overlap
  at all.

## 3. NavFixes: replace, absorb, or keep both?

Verdict: **do not keep both.** LIES does not "contain equivalent nav guards" in full — it
absorbed **2 of NavFixes' 4 functions**:

| NavFixes function | In LIES? | Consequence if both installed |
| --- | --- | --- |
| `find_segment_doors` | yes (3-arg variant, `if not from_seg` guard) | NavFixes' 2-arg body wins → `center_only` ignored → doorway cover/aim lookup returns no usable entries |
| `_sort_nav_segs_after_pos` | yes (7-arg variant) | NavFixes' 6-arg body wins → LIES `_execute_coarce_search` gets `nil` → coarse pathing dead |
| `register_anim_nav_link` | **no** | disjoint, would work fine alongside |
| `remove_obstacle` | **no** (LIES only overrides `add_obstacle`) | disjoint, would work fine alongside |

So the real fix is: **absorb the two missing guards into LIES, then drop NavFixes.**

1. Port NavFixes' `register_anim_nav_link` start/end-segment guard (`Application:error` before
   touching `self._nav_segments[...]`) into `lua/managers/navigationmanager.lua`.
2. Port NavFixes' `remove_obstacle` fix (`_quad_field:remove_obstacle(obs_data.id)`, no
   `obstacle_obj` variant) into the same file.
3. Uninstall/disable NavFixes. LIES then owns all four nav functions, and its internal
   3-/7-argument contracts stay consistent.

Interim (before step 1-2): run **LIES without NavFixes**. The two missing guards are
rare-path fixes (animated nav links, obstacle teardown); the pair as-is actively breaks
pathing, which is far worse.

Root cause worth recording: LIES' nav overlay is written against a newer `NavigationManager`
contract (extra `center_only` / `from_pos` parameters, plus its own callers). It is
internally consistent but **not** signature-compatible with any other overlay of
`find_segment_doors`/`_sort_nav_segs_after_pos` on 248.2 — a future nav mod would break it
the same way.

## 4. Recommended test profiles

| Profile | Contents | Purpose |
| --- | --- | --- |
| **clean** | LIES only (+ base/BeardLib if required by load) | Reference behaviour, baseline logs |
| **compatible** | LIES, Keepers, Keepers deps (GoonmodCustomWaypoints, NoDuplicatedBullets), Iter (full nav), Anticrash, VanillaHUD Plus, Celer, JokerNoStagger | First "real" profile; all overlaps are wrap-compatible |
| **with bot ownership** | compatible + Useful Bots + HopLib + Monkeepers (pin Monkeepers 99) | Accepts: UB owns bot intimidation/marking, Monkeepers owns AI idle completion; LIES bot-side tweaks inert |
| **optional** | with bot ownership + The Fixes | Adds crash fixes; only cost is LIES' `CopActionWalk:_init` being replaced |
| **do-not-run** | LIES + NavFixes (any order) | NavFixes' 2 shared overrides break LIES pathing/cover silently |

Priority pins to make the set deterministic:

- LIES `100` (unchanged), Monkeepers `99` (was `100`), Keepers `10` (Phase 3 target;
  currently unset = `0`), Useful Bots `0`, Iter `40`, Anticrash `500`, HopLib `499`,
  The Fixes `-10` (supermod).
- Without the Monkeepers pin, LIES-vs-Monkeepers is undefined order on 3 functions.

## 5. Log / error signatures to watch

Normal (LIES healthy): `Lua: [INFO] [BLT] Setting up mod 'LIES'` repeated for the 68 hook
files, then `LIES: <n> cover points.` after a heist loads.

| Pair | Signature | Meaning |
| --- | --- | --- |
| LIES + NavFixes | *no error*; missing `LIES: <n> cover points.`, enemies/bots standing with no path, `LIES: cover generation schedule failed: …` or `stalled` in `_LIES_cover_gen_log` | coarse pathing / cover lookup degraded by the arg shift |
| LIES + NavFixes | `attempt to index a nil value (field 'center')` or `(field 'end_pos')` in `coplogicattack` | NavFixes' door list consumed by LIES' doorway aim |
| LIES + NavFixes | `[NavigationManager:register_anim_nav_link] Navigation link is already registered` / `Nav link start or end point is not in the navigation mesh.` | nav-link guard path; check which copy is active |
| LIES (any) | `[NavigationManager:add_pos_reservation] LEAKING POS RESERVATION!!` | position-reservation flow (shield/AI movement); see `dev/reports/port-decisions.md` §11 |
| LIES + Monkeepers | `attempt to call a nil value (field 'objective_failed_clbk')` / `(field 'objective_complete_clbk')` in `teamailogicidle` | the other side's `action_complete_clbk` replaced one that expected different callbacks |
| LIES + Keepers/UB | no error; bots stop using intimidation beyond ~10 m, or police conversions behave differently | LIES' bot functions superseded by the later full replacements |
| Any | `Lua: [ERROR]` at `…\PAYDAY 2\mods\logs\…txt`, `FATAL ERROR`, `[Updates]` | generic loader check; `LIES` errors before 248.2 fixes showed as `attempt to compare number with nil` |

Log location: `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\<date>_log.txt`
(the current `2026_10_23_log.txt` is 0 bytes — rotated/truncated, so this audit relied on
hook-file evidence, not a live run).

## 6. Open items / limits

1. **Monkeepers tie-break** — equal `priority: 100` means BLT's native sort decides; not
   determinable statically. Pin to 99 (recommended) or 101 (worse) and re-check.
2. **Priority-0 internal order** (Keepers / Useful Bots / NavFixes / Celer / GCW) is equally
   unspecified; all their mutual overlaps are captures-and-calls, so composition holds, but
   the outermost layer is arbitrary — do not depend on it.
3. **The Fixes** ships as a legacy `supermod.xml` with no `mod.txt`. It loads (BLT supports
   it), but it is unmanaged by modern BLT update/UI paths; re-verify after any The Fixes
   update whether `CopActionWalk:_init` is still a bare replace.
4. **Useful Bots** is inert without HopLib (`mod.lua` returns at the top) — a missing-HopLib
   profile silently disables all its AI hooks; check the log for its setup line before
   blaming LIES.
5. Not exercised: live heist behaviour (no game run in this pass). All findings are static —
   hook maps, function sets and body diffs against the 248.2 snapshot.

## Appendix — reproduction

```powershell
# hook map of every installed + workspace mod
Get-ChildItem "C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods","D:\Programowanie\payday\2\v2\mods" -Directory |
  ForEach-Object { $m = Join-Path $_.FullName "mod.txt"; if (Test-Path $m) { ... } }

# LIES nav signatures vs 248.2
Select-String -Path "D:\Programowanie\payday\2\v2\.worktrees\LIES-port-248\lua\managers\navigationmanager.lua" `
  -Pattern "^function NavigationManager:(find_segment_doors|_sort_nav_segs_after_pos)"
Select-String -Path "D:\Programowanie\payday\2\v2\payday2_248.2_9_25_2026\Payday-2-LuaJIT-Complete-master\lib\managers\navigationmanager.lua" `
  -Pattern "^function NavigationManager:(find_segment_doors|_sort_nav_segs_after_pos)"

# who calls what
Select-String -Path "...\navigationmanager.lua" -Pattern "_sort_nav_segs_after_pos\(|find_segment_doors\("

# priorities
Select-String -Path "...\mods\*\mod.txt" -Pattern '"priority"'
```

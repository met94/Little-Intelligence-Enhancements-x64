# Group AI audit — LIES 248.2 port

Read-only function audit plus fixes for `GroupAIStateBase` and
`GroupAIStateBesiege`. Baseline 246.1 `a3180fc`, target 248.2 `e3a8b616`,
LIES V8.57 `4215a39`.

## Structural result

All 39 `LIES_EDIT_CLEAN` bodies in these two files are token-identical between
246.1 and 248.2. There is no in-function drift to merge. Remaining risk was
callee/contract drift and LIES logic whose producer was lost.

## Fixed LIES-side defects

| Severity | File:line | Defect | Player effect | Fix |
|---|---|---|---|---|
| Medium | `lua\groupaistate\groupaistatebesiege.lua:3709` | Recon truncation used `#coarse_path - i` in the loop bound, so the bound was evaluated once and the path was emptied; `coarse_path[#coarse_path][1]` then indexed nil | Recon group throws inside `_upd_police_activity`; remaining group/spawn work skipped, recon group not re-tasked | Use `#coarse_path - forwardmost_i_nav_point`, matching 248.2 |
| Medium | `lua\groupaistate\groupaistatebesiege.lua:2295` | `hrt` and `sabotage` tactic branches were nested inside the flank `if alive(follow_unit)` block instead of the outer tactic chain | HRT/drill groups were re-tasked as plain assault after one tick; cops moved toward hostages/drills then abandoned | Closed the flank block; `hrt`/`sabotage` are now outer `elseif` branches; hrt got its missing `else` |
| Low-Med | `lua\groupaistate\groupaistatebesiege.lua` recon objective | `group.objective.moved_in` was never written, so the 15 s re-target condition was permanently false and `_voice_movedin_civs` never fired | Recon groups camped one area; hostage-area voice cue missing | Set `moved_in = true` with `moving_in`, matching 248.2 |
| Low | `lua\groupaistate\groupaistatebesiege.lua:1206` | Hostage callback ran before `table.remove`; `_hostage_upd_key` was never cleared and re-armed forever | Callback could add/remove a hostage and corrupt the wrong entry; permanent 5 Hz timer | Clear key, remove before callback, re-arm only when data remains and key is unset |
| Low | `lua\groupaistate\groupaistatebesiege.lua:503` | Retreat hook retried `_voice_retreat` every tick and cleared `dialogue_data` while it returned nil, suppressing other group voice cues | Audio-only: flank/push/move-in/open-fire cues could be suppressed indefinitely for a group | Retry for up to 3 s, then clear; reset deadline when a new retreat is requested |

Source regression tests: `dev\tools\test\runtime-audit.test.mjs` (12/12).

## 248.2 drift, no code change

| Severity | Item | Decision |
|---|---|---|
| Low | `ElementSpecialObjective:choose_followup_SO` now returns a backup followup when all weights are 0; LIES's `if not new_objective` idle branch is reached less often | Accept vanilla; only affects authored `base_chance = 0` rvd1 edge case. Cosmetic idle selection. |
| Low | `GroupAIStateBase:on_criminal_nav_seg_change`: 248.2 `_on_area_safety_status` returns early in whisper mode; LIES still clears `area.is_safe` first | No change. `is_area_safe()` recomputes from criminals; pathing/spawn checks unaffected. |
| Low | `GroupAIStateBase:_get_spawn_unit_name` drops vanilla's boss-type gate | Document as intentional LIES behavior; do not change blind. Default `max_nr_simultaneous_boss_types = 0` makes the gate ambiguous. |

## Checked clean

- Spawn queue / police activity: 248.2 timestamp model exactly; no double-run.
- Group spawning: `_spawn_group_timers`, `_spawning_groups`, `_MAX_SIMULTANEOUS_SPAWNS`, cooldowns, H-03/H-04 intact; `_spawn_in_group` still returns group.
- Recruit, assault/retire, reenforce: vanilla bodies unchanged; coarse-search params valid at 248.2.
- Recon driver: `_upd_recon_tasks` unchanged; sweep subsystem already removed (H-05).
- Phalanx: all 248.2 keys exist; H-02/H-03 fixes intact.
- Timed groups: fields exist; H-08 `has_spawned` is read by the marshal harasser swap (corrected).
- Area/nav ids: LIES uses string ids consistently; no direct `_area_data`/`_nav_seg_to_area_map` indexing.
- Removed vanilla functions `_find_nearest_safe_area` / `find_occupation_in_area`: zero LIES call sites.
- Chatter keys: all added by LIES `_init_chatter_data` PostHook; target exists.
- Debug draw: inherited `_draw_enemy_importancies` exists.

## Rulings

- **Recon loop:** keep the vanilla 248.2 `for i = 0, #cp - forwardmost_i_nav_point` form, including its one-extra removal. It is parity-safe and leaves the intended re-target node. Cost if wrong: recon path may stop one node earlier than ideal.
- **HRT else:** added `else current_objective.tactic = nil` so a group that stops going for hostages/drill reassigns instead of holding a stale tactic. Cost if wrong: one extra tactic reassignment.
- **Retreat retry:** 3 s bounded retry, not single-shot and not forever. Cost if wrong: a retreat line can be lost after 3 s, but group voice cues resume.

## Verification

`tools\gates.ps1` PASS: 54 Node tests, 71/71 Lua compile, 68/68 freevars,
API errors 0, review 152. No game run for these logic fixes yet; targeted
heists: HRT/hostage rescue, drill sabotage, recon-heavy assault, camera-loud
area, a bot hold/revive, and a civilian follow target dying.

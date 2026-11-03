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

How long a cop holds fire after verifying a target. The delay is `2 / level`
seconds, so SLOW waits about two seconds before the first shot, NORMAL about one
second, and ULTRA-VIOLENCE does not wait at all (the delay is off from level 3
upwards). Cops still aim and turn during the pause — only the shot is held.

Exempt: converted criminals (Jokers — one category, caught by both the
`is_converted` flag and slot 16), crew-AI bots (their `criminal1` team id, since
`TeamAIBrain` never sets the conversion flag), and any unit running the LIES
coverfire tactic, because that suppression fire is deliberate and must not be
silenced. Bosses run this block through `CopLogicAttack._upd_aim` and also carry
their own copy of it in boss logic.

**History:** the option itself dates back to v4, but from LIES 7.84 (2024-02-09)
until 8.57.22 its gate read `and not data.team.id == "criminal1"`. Lua parses that
as `(not data.team.id) == "criminal1"`, always `false`, so ordinary cops ignored
the option for every build in between; 8.57.19 then dropped the block with the aim
port. 8.57.22 restores it with the two terms the author meant
(`not data.is_converted` and `not (data.team and data.team.id == "criminal1")`).
See `dev/reports/aim-port-behaviour-ledger.md` block 10.

| Value | Effect |
|---|---|
| SLOW | Holds fire ~2 s after verifying a target. |
| NORMAL | Holds fire ~1 s. |
| ULTRA-VIOLENCE | No hold; fires as soon as the target is aimable. |

## Navlink Delays (`nav_link_interval`)

Scales the pause a cop spends playing an animated nav-link action (vaulting a
window, climbing a fence). **This option works as of 8.57.2** — before that
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

High Performance Mode is becoming a section header over the individual
performance-gated options, and `door_watch` is the first flag placed under it.
Interim behaviour: the flag is honoured only while High Performance Mode is
off.

## Door Watching (`door_watch`)

Default: ON. Settings file and menu.

Cops that have lost sight of a target keep a pre-aim position on the doorways of
the segment the target is in, not only on the doorway of the segment the cop is
walking through. That is the difference between "watch where I am going" (vanilla)
and "watch where the target will appear".

- Honoured only while **High Performance Mode is OFF**. Turning High Performance
  Mode on force-disables door watching; the toggle stays where you left it.
- Costs up to a handful of `ai_vision` raycasts per cop per 1.5 s (0.2 s for
  important units) while it runs; instant for doors without a nav-link element.
- Player POV: cops peek-aim at the door the enemy is about to step through, so
  walking into a room can meet an already-aimed cop instead of one still turning.

How to verify it from a log (needs `"watch_log": true`, see the next section):

| Counter (per-minute digest) | What it means |
|---|---|
| `dw_call` | Aim passes that reached the door-watch helper (the denominator) |
| `dw_gate_off` | Calls that returned because the setting or High Performance Mode was off; with door watching off, this must equal `dw_call` |
| `dw_stale_bail` | The feature refused to touch a freed enemy tracker and used no position; informational, the guard working |
| `dw_outer_gate_skip` | The target is lost (or was never verified) and is in another segment, so the watch was not attempted |
| `dw_no_my_tracker` | The cop's own nav tracker was nil, so nothing was attempted and vanilla was not called either |
| `dw_hit` / `dw_none` | A watch position was produced / nothing was found |
| `dw_gap` | Must be `0`: a call that returned without landing in one of the six outcomes above |
| `dw_raw_hit` / `dw_ray` | Door position raycast that hit / door raycasts attempted |
| `dw_expected_pos_hit` | The fallback nav-graph position was used |
| `dw_path_prestep` | A coarse path was already armed and read for a watch position (an attempt: counted before `_get_expected_pos`, so it does not prove a position) |
| `dw_path_prestep_hit` | That pre-step actually produced a watch position; only runs inside the 0.2/1.5 s window, and only when no saved position is held |
| `dw_cached_reuse` | The 0.2/1.5 s window had not elapsed, so the saved position was reused as-is (no re-test, no probe on that call) |
| `dw_height_skip` | The height gate rejected the enemy segment (target far below) |
| `dw_seg_same` | Same nav segment, so vanilla handles it (`m_pos + 140`) |
| `dw_cadence_skip` / `dw_advancing_skip` | The 0.2/1.5 s window had not elapsed / the helper was also reached while running. The second is implied by the first at the only call site (it is reached only while running), so it never adds information on its own |
| `dw_us`, `dw_us_max` | Average and worst time of the armed path (pre-step, re-test and door probe) in microseconds |
| `watch_aim_adopted` | Aim passes that turned the cop's attention to a watch position, freshly derived (`src=raw` / `src=expected`) or reused from the cache (`src=cached`); vanilla's `m_pos + 140` is not counted |
| `watch_aim_cached` | Of those, the ones whose position came from the cache, i.e. from a doorway derived on an earlier pass. Every adoption cached with no fresh derivation in the same run means the adoption fired but the probe itself did not |
| `watch_aim_verified` | Of `watch_aim_adopted`, the ones adopted while the enemy was visible (`verified` / `nearly_visible`): the cop could see the target anyway, so these cannot help. A `watch_aim_adopted - watch_aim_verified` of 0 means the feature fired but never while the target was unseen |
| `watch_aim_dot` | Mean flat facing dot at adoption: `1.0` = already facing the doorway, `0` = looking along the wall, negative = a turn past 90°. A per-window mean, weighted by each window's **measured** dots (`watch_aim_dot_n`), not by its adoptions. Adoptions with no measurable facing are logged as `dot=n/a` and neither averaged in nor weighed |
| `watch_aim_dot_n` | The measured subset behind `watch_aim_dot`: adoptions whose facing could actually be measured. The session mean is weighted by this count, so a `dot=n/a` adoption cannot outvote a measured one |
| `watch_aim_settled` | Follow-up facing samples of the door watch: the first aim pass at least 0.4 s after the first adoption of an episode (`age` in the trace reports the actual delay). This is the "does the cop look like it pre-aims" figure; the adoption dot above cannot answer it. Dropped (uncounted) when the target became visible, the aim target moved more than 20 units away, or the unit changed logic |
| `watch_aim_settled_square` | Of `watch_aim_settled`, the samples within 45° of the doorway (dot ≥ 0.7 - a chosen, untuned cut, cheap to move if the in-game sample disagrees). Reads "the cop settled towards the doorway", not "the cop is facing the enemy" |
| `watch_aim_settled_dot` | Mean settled facing dot, weighted by each window's **measured** dots (`watch_aim_settled_dot_n`). A sample logged `n/a` in the trace (no measurable facing) is counted but not averaged |
| `watch_aim_settled_dot_n` | The measured subset behind `watch_aim_settled_dot`, and the denominator of the `square` share in the report: `square / watch_aim_settled_dot_n` |

`[LIES-WATCH] evt=door_watch_first` and `[LIES-TRACE] … phase=door_watch`
name the first produced position (`src=raw` or `src=expected`) and the per-unit
branch; `[LIES-TRACE] … phase=watch_aim` names the adoption itself (`src`, `dot`,
`verified`, `nearly`), including an adoption of a cached position (`src=cached`).
`[LIES-TRACE] … phase=watch_aim_settle` names the follow-up sample at least
0.4 s later (the first aim pass that is due after the first adoption of an
episode; 8.57.30): `dot` is where the aim settled, `age` the actual delay since
the adoption.
The 8.57.29 adoption figures were measured on 2026-11-02; the settled sample is
not yet observed in game.

Door watching runs inside the attack logic while a cop is running and not
aiming. Travel logics reach that pass too (the 2026-11-02 play logged
`logic=travel ... phase=watch_aim`), so a room-heavy test showing no adoptions
means none were counted, not that `travel` is excluded: the adoption-instant
facing is always off-target because the adoption starts the turn.

## Debug Logging (`debug_log`)

Writes `[LIES-CHECK]` diagnostic events to the PAYDAY 2 log. Default is OFF.
It also gates the few inherited upstream debug prints (the civilian
`common_data` dump on every walk action, the phalanx spawn banner and the unsafe
coarse-path failure line), so a release log carries none of them.
Turn it on only while collecting a test log; normal play stays quiet. The
option affects diagnostics, not AI behaviour.

## Watch digest (`watch_log`) and alarms

Same channel shape as Iter's, so one reader handles both mods:

- **Alarms** are always on and need no setting. They fire only on a hard
  failure, at most once per name per 60 s and at most 20 per heist:
  `lies_cover_fallback_rate` (more than half of ≥40 cover reservations in a
  minute fell back) and `lies_suppression_deny_spike` (more than 90 suppression
  denials in one minute). The spike is absolute, not a rate: nothing in the mod
  produces the matching "allow" counter, so the old deny/(deny+allow) ratio was
  1.00 by construction and fired on six of 22 windows in one 22-minute run. The
  cut is 90 because that same healthy run peaked at 65 denials in a minute at
  high cop counts: the counter is "distinct cops denied once per episode", so a
  busy assault wave legitimately reaches the sixties. A healthy heist therefore
  usually writes **no** `[LIES-WATCH]` line, but it is no longer a claim that it
  cannot: a 90-plus minute is the shape worth reporting.
- **Digest** is opt-in: add `"watch_log": true` to
  `mods\saves\LittleIntelligenceEnhancementS.txt` with the game closed. With it
  on, LIES writes a header at heist start and one `[LIES-WATCH] evt=digest`
  line per 60 s of play, carrying the per-minute counts for cover
  set/fallback, suppression denies, taser allowed/blocked, bag steal-SO
  registered/skipped/deferred, marshal mapping and civilian follow fallbacks.
  8.57.23 adds three more groups to the same line:
  - `dw_*` — door watching: the six outcome counters (`dw_call`,
    `dw_gate_off`, `dw_stale_bail`, `dw_outer_gate_skip`, `dw_no_my_tracker`,
    `dw_hit`, `dw_none`), the derived `dw_gap` (must be 0), the branch
    sub-events (`dw_raw_hit`, `dw_expected_pos_hit`, `dw_path_prestep`,
    `dw_path_prestep_hit`, `dw_cached_reuse`, `dw_cadence_skip`,
    `dw_advancing_skip`, `dw_height_skip`, `dw_seg_same`, `dw_vanilla_call`,
    `dw_path_kick`, `dw_ray`) and the timing (`dw_us`, `dw_us_max`).
  - `fsd_*` — `find_segment_doors`: why the door list shrank
    (`fsd_door_dead`, `fsd_door_obstructed`, `fsd_nil_element`,
    `fsd_nil_position`, `fsd_nil_tracker`, `fsd_nil_end_pos`), which nav-link
    doors were accepted (`fsd_navlink_seg_ok`/`_mismatch`), tracker churn
    (`fsd_tracker_created`/`_destroyed`) and the `Vector3` contract
    (`fsd_bad_shape`, must be 0).
  - `react_*` — `react_hold` / `react_allow` / `react_level`: whether the
    Reaction Level fire delay actually held frames.
  The counter meanings are also listed under "Door Watching" above.
  The digest is the cheap channel — one header plus one line per minute — so a
  routine play should run `watch_log` on and `trace` off; the per-unit
  `reaction_hold` `[LIES-EVENT]` line additionally needs `debug_log` (8.57.27).

Read a play mechanically — the tool turns the digest into PASS/FAIL claims
(exit 0 PASS, 1 FAIL, 2 INCOMPLETE — no header or the feature was disarmed — and
3 for a usage error):

```powershell
node dev\tools\door-watch-report.mjs "…\PAYDAY 2\mods\logs\2026_11_02_log.txt" `
  --ab "…\PAYDAY 2\mods\logs\2026_11_03_log.txt" `
  --out dev\reports\door-watch-run-a.md --json dev\reports\door-watch-run-a.json
```

`--ab` prints the same cost figures for a control log (door watching off) next
to the run. Claim -> counter mapping and the test-play procedure:
`dev/reports/door-watch-port.md`.

`[LIES-CHECK]` remains the per-event detail channel and still needs
`debug_log`; the watch counters run regardless, which is why a normal session
now leaves evidence behind for the alarm tier.

## Crash breadcrumbs (`trace`)

**Off by default**, settings file only, no menu entry. A native access violation
kills the game without a Lua error, so nothing can be logged *after* the fault;
the breadcrumbs are what was written *before* it. Turn it on before you reproduce
a crash: add `"trace": true` to
`mods\saves\LittleIntelligenceEnhancementS.txt` (game closed). At its 120 lines/s
cap this channel is what makes a log tens of MB, which is why a release build
leaves it off; routine plays should run `"watch_log": true` and keep `trace` off,
and `reaction_hold` `[LIES-EVENT]` lines also need `debug_log` (8.57.27).

Each line looks like:

```
[LIES-TRACE] v=V8.74_x64 t=143.27 u=1081 tweak=spooc logic=attack phase=combat att=769 att_alive=true att_trk=true dropped=0
```

- `u` is the acting unit, `tweak` its character type, `logic` its current logic,
  `phase` the AI step that just started (`combat`, `pose`, `pose_upd`,
  `pose_req_crouch`, `pose_req_stand`, `flank`, `cover_path`, `dodge`,
  `dodge_preemptive`, `move_out`, `charge_search`, `cover_upd`, `peek`,
  `retreat`, `aim`, `door_watch`, `watch_aim`, `spooc`, `spooc_combat`), `att` the
  enemy it is working with (`att_alive`, `att_trk` = an enemy nav tracker is
  present), `dropped` how many lines were suppressed so far.
- Throttle: one line per unit per phase per 2.5 s, and per call where the phase
  needs it (`spooc_combat` and the spooc combat sub-steps use 0.2 s, spooc `aim`
  1 s, `watch_aim` 1 s), plus a global cap of 40 lines/s for low-value phases
  (`aim`, `peek`, `cover_upd`) and 120 lines/s overall. A saturated minute adds
  roughly 3-6k lines; `dropped` tells you how many were suppressed.
- Failure phases are exempt from the cap because they are the ones a crash
  report cannot be reconstructed without: `combat_no_attention` (no attention
  object at all), `dodge_dead_enemy` / `spooc_dead_enemy` (AI met a dead enemy
  and skipped it), `stale_tracker` (the 8.57.12 freed-nav-tracker guard refused a
  tracker), `exit_missing_logic` / `exit_no_fallback` (the 8.57.11 logic-state
  guard downgraded an exit). These mean the guard did its job; the game keeps
  running and the line names the unit.

Report a crash by attaching `crash.txt` plus the last `[LIES-TRACE]` lines from
`mods\logs\<date>_log.txt`.

## Lifecycle events (`[LIES-EVENT]`)

Same switch (`trace`), separate tag, one line per unit and kind per second:

```
[LIES-EVENT] v=V8.74_x64 kind=objective t=143.20 u=1081 tweak=spooc logic=travel att=769 old=defend_area new=nil forced=false follow=n
[LIES-EVENT] v=V8.74_x64 kind=logic     t=143.21 u=1081 tweak=spooc logic=travel att=769 from=travel to=idle obj=nil obj_forced=false
[LIES-EVENT] v=V8.74_x64 kind=exit      t=143.21 u=1081 tweak=spooc logic=travel att=769 req=idle obj=nil internal=y
```

- `objective` - every objective assignment (old/new type, no objective = `nil`).
- `logic` - every logic switch with the objective that was present.
- `exit` - every logic exit with the requested state and the objective.
- `travel_no_objective` - travel ran with no objective: `advancing`, `old_action`, `coarse=index/len`, `cover`.
- `spooc_start` - cloaker tackle started: `dis`, `reaction`, `cover`.
- `group_retire` / `group_recon` - group-level retire/recon assignment: `group`, `units`, `area`/`phase`.
- `reaction_hold` - one line when the reaction-level fire delay arms for a unit: `level`. It needs `debug_log` on top of `trace` (8.57.27), because it was 76 % of this channel; the `react_hold` / `react_allow` digest counters cover the same behaviour without it.

Together they reconstruct the chain: which group event produced which objective change, which logic switch followed, and which exit the unit took. That is the evidence needed when a native fault names only one frame.

## Instant Spawn Groups (`instant_spawn_groups`) - removed in 8.57.10

The fork exposed an upstream code path as a toggle in 8.57.4-8.57.9 and retired
the option in 8.57.10. What it was, and why it is gone:

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

The fork's own `instant_spawn_groups` switch (8.57.4-8.57.9) joined the retired
list in 8.57.10 - see the section above.

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

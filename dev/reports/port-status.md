# LIES 248.2 port — status and backlog

Last updated: 2026-11-01 (after the V8.81 nav-v6 close-out).

Related: `dev/reports/port-decisions.md` (keep/merge), `dev/reports/port-drop-log.md` (drops), `dev/reports/nav-b-feasibility.md` (Nav-B), `dev/reports/future-updates.md` (next game update).

## Green

- Import: LIES V8.57 (`4215a39`), baseline 246.1 (`a3180fc`), target 248.2 (`e3a8b616`).
- Basic loud flow: load, SWAT spawn, assault task, guard damage/death — verified in game.
- Nav v6 bootstrap: cover registration, coarse search, door lookup, `_sort_nav_segs_after_pos`.
- Nav-A: custom LUA cover search over vanilla `_covers` — verified with `lua_cover=2`.
- Nav-B: runtime cover generation on nav segments — verified; Jewelry Store 95 generated covers (58 -> 272), no crash.
- EnemyManager v246 disposal overrides removed; vanilla timer disposal/task queue used.
- Besiege police scheduler ported to 248.2 timestamps; smoke/flash grenade door handling ported; `force_end_assault_phase` timestamp poke ported.
- Dead v5 nav functions removed. API audit: **0 errors**, 152 review.
- HHTACS leftovers H-02/H-03/H-04/H-05 closed in `9dec81a`: hhtacs-only
  `spawn_chance.respawn_delay`; five-argument phalanx spawn search; linear
  `max_dis` cap; dead recon-sweep subsystem deleted. Regression tests:
  `dev/tools/test/runtime-audit.test.mjs`.
- Group AI audit (`8e7ec60`): all 39 LIES_EDIT_CLEAN bodies token-identical
  to 248.2; fixed recon path truncation, HRT/sabotage tactic nesting,
  `moved_in`, hostage-task ordering/timer, and bounded retreat retry.
- Periphery audit (`ae89d04`): fixed camera loud LOS, team-AI hold/revive
  guard, civilian follow guard, drill tracker guard, mission obstacle init,
  difficulty removal lookup; corrected H-08 (`has_spawned` is read by the
  marshal harasser swap).
- API review triage: 147 known-safe, 5 engine/uncertain, 0 confirmed drift
  (`dev/reports/api-audit-triage.md`).
- Static gates (V8.81): 179 Node test cases (0 fail), 71/71 LuaJIT syntax,
  68/68 freevars, ledger (`errors=0`, 580 functions), API audit
  (`hooks=68/68`, `errors=0`, `review=151`). Report:
  `dev/reports/static-gates.md`.
- Door watching restored (V8.79, `0edc8bc` + `e389d5e` + `189a053`): ledger
  blocks #1/#2/#4 are back as a LIES layer over vanilla
  `_get_expected_attention_position`, gated by
  `door_watch and not highperformance`, plus the `find_segment_doors` guards
  (`a9bfba0`). Report, deviations and the test-play procedure:
  `dev/reports/door-watch-port.md`. Code and static gates are green.
- Door watch, in-game verification — **done for the armed and gated paths**
  (2026-11-01, level `auc`, deployed `V8.79_x64`). Armed run: watch positions
  from all three sources (`dw_raw_hit=24`, `dw_expected_pos_hit=37`,
  `dw_path_prestep_hit=4`), `dw_gap=0` on every digest,
  `fsd_navlink_seg_ok=158` with tracker create/destroy balanced and
  `fsd_bad_shape=0`. High Performance run: the gate held — `dw_call=30085`
  split into `dw_gate_off=23339` + `dw_stale_bail=6746` +
  `dw_no_my_tracker=0` with every work counter 0. The one crash's stack was
  entirely Iter's (follow-unit UAF after a queued coarse search; fixed out of
  tree as Iter 200.2 on `feat/iter-follow-unit-uaf`, `ea7732a` + `aa6211c`), no
  LIES frame involved. **A repeat armed run is still wanted**: Run A lasted
  about two minutes before that crash, so the cost figure is a lower bound, and
  the `--ab` control has not been run. Evidence: `door-watch-port.md` §10; open
  questions §7.
- Nav v6 closed (V8.81, `cbc4a29`): the audit-first pass
  (`dev/reports/nav-v6-remaining-audit.md`) found four of the seven backlog rows
  already satisfied or dead, and merged the three real gaps —
  `register_cover_units`' `get_script_data(nav_tracker, true)` create flag and
  the nav-link `delay_time()` gate in `_execute_coarce_search` and
  `_sort_nav_segs_after_pos`. Code and static gates green; **not observed in
  game** (Iter's nav search owns the only call site, so the gates only bite with
  it off; the flag only on maps shipping legacy cover units).

## Open — core AI (needs in-game testing)

Backlog order: door watching — **done (V8.79)**
(`dev/reports/door-watch-port.md`); `CopLogicBase._upd_attention_obj_detection`
— **done (V8.80)** (`dev/reports/port-decisions.md`, "Near-visible probe
height"); `CopLogicAttack.action_complete_clbk` — **done** (merged in
`f0370d4`, re-verified complete 2026-11-01).

Next block: the **`NavigationManager` nav-v6 set** in
`lua/managers/navigationmanager.lua` — **done (V8.81)**. The audit
(`dev/reports/nav-v6-remaining-audit.md`) closed four of the seven rows before
any Lua was written, and the three real gaps landed in `cbc4a29`:
`register_cover_units`' create flag, and the nav-link `delay_time()` gate in
both `_execute_coarce_search` and `_sort_nav_segs_after_pos`
(`dev/reports/port-decisions.md`, "Nav-v6 audit outcome"; test:
`dev/tools/test/nav-gates.test.mjs`). Deliberately not ported, recorded so it is
not re-litigated: `_draw_covers` (dead code on both sides), the
`remove_obstacle` object-call parity line, the 248.2 `for i = 1, 500` loop
restyle, and the `check_segment` closure. The ledger rows still read `PORT` —
`dev/port-248-ledger.md` records the *proposed* action per function, not
completion, so it is not the "is it done" source; this file and
`port-decisions.md` are.

Next block: **re-verify `TankCopLogicAttack.update` and
`TaserLogicAttack._upd_enemy_detection` against 248.2 and record verdicts — do
not port.** `port-decisions.md` decides `keep LIES` on both (§9 and §6): the
tank body is a deliberate LIES rewrite (`old_action_advancing`, per-frame
`attitude`, `next_mov_time` gate, walk/run chase choice) and the taser body
deliberately returns `delay` and drops the wind-up focus lock. Neither has been
re-read since the 246.1 baseline, so the task is a `pd2fn` 246.1 → 248.2 delta
plus a recorded verdict, the same shape as the nav-v6 audit. Expect restyle
only (`within_z_distance` refactor, inline action table, `unit:movement()` on
the tank; local declaration order on the taser) — verify, then write it down.

Dossiers in `dev/reports/dossiers/`:

| Function | Size | Why it matters |
|---|---:|---|
| `CopLogicBase._upd_attention_obj_detection` | 531L | Detection core; 248.2 changed fields/flow. **Done** — kept the LIES rewrite, merged only the 248.2 near-visible probe height (V8.80, `c409ba4`; `dev/reports/port-decisions.md` "Near-visible probe height"). In-game feel not yet observed. |
| `CopLogicAttack._upd_aim` | 560L | Aim/cover/fire; **done** — V8.75 port + V8.77/V8.78 restores, V8.79 door watch (`dev/reports/door-watch-port.md`). |
| `CopLogicAttack.action_complete_clbk` | 101L | Action completion + state transitions. **Done** — merged in `f0370d4` (`math.rand` dodge timeout); re-verified 2026-11-01 that this is the function's only 246.1→248.2 delta and the LIES body carries it (`port-decisions.md` §3). |
| `CopLogicAttack.is_available_for_assignment` | 51L | Assignment gating. |
| `CopLogicIdle.damage_clbk` | 61L | Damage reaction / relocation. |
| `TaserLogicAttack._upd_enemy_detection` | 75L | Taser target selection. |
| `TaserLogicAttack._cancel_tase_attempt` | 12L | Taser cancel; LIES uses `tasing_action` vs vanilla `tasing`. |
| `TaserLogicAttack._chk_play_charge_weapon_sound` | 7L | Balance timings. |
| `TankCopLogicAttack.update` | 106L | Dozer logic. |
| `ShieldLogicAttack.queued_update` | 117L | Shield logic. |
| `CarryData._chk_register_steal_SO` | 128L | Carry/steal objective registration. |

Policy: port one function at a time; preserve LIES intent; use the dossier's `246.1 -> LIES` and `246.1 -> 248.2` diffs; run gates + `cavecrew-reviewer`; test in game before shipping default-on.

## Decisions applied (static, no game test)

- `set_nav_segment_state`: stringified `tostring(id)` keys; LIES cache invalidation kept.
- `add_obstacle`: 248.2 nil guard + destroy listener; LIES cache invalidation kept.
- nav-v6 close-out (V8.81, `cbc4a29`): `register_cover_units` create flag on the
  legacy cover-unit branch; nav-link `delay_time()` gate in
  `_execute_coarce_search` and `_sort_nav_segs_after_pos`. `remove_obstacle`
  and `_draw_covers` stay LIES (dead-code / no-reachable-state; see
  `port-decisions.md` "Nav-v6 audit outcome").
- `force_end_assault_phase`: 248.2 timestamp poke.
- `CopLogicAttack.action_complete_clbk`: `math.rand` dodge timeout (applied
  `f0370d4`; verified complete 2026-11-01 via `pd2fn`).
- `CopLogicAttack.is_available_for_assignment`: restored the 248.2 `data.is_suppressed` gate ahead of walk-forbidden/path-fail; LIES 3 s lockout and sabotage gate kept. Smoke 2026-10-24: 128 suppression denials, no stuck assignments observed.
- `CopLogicIdle.damage_clbk`: `data.t = t` before `identify_attention_obj_instant`.
- `TaserLogicAttack._chk_play_charge_weapon_sound`: restored the 300-unit vertical guard; LIES distance-scaled cooldown and 3000 range kept. Smoke 2026-10-24: 14 allowed, 7 cross-floor blocked.
- `ShieldLogicAttack.queued_update`: adopted 248.2's reservation split (`set_pos_rsrv` success / `add_pos_rsrv` fallback), kept LIES 70 radius and movement gates. Smoke 2026-10-24: 53 set, 4 fallback, no leak.
- `CarryData._chk_register_steal_SO`: adopted 248.2's guard order + `_add_body_activation_clbk()`, kept LIES `sabotage`/`sabo_voiceline`; fixed the nil drop-point fall-through so no broken drop objective is registered. Smoke 2026-10-24: 12 registered, 5 expected skips.
- Keep LIES body (no edit): `CopLogicAttack._upd_aim`, `TaserLogicAttack._upd_enemy_detection`, `TaserLogicAttack._cancel_tase_attempt`, `TankCopLogicAttack.update`, `CopLogicIdle.damage_clbk`. `CopLogicBase._upd_attention_obj_detection` keeps the LIES body but now carries the 248.2 near-visible probe height (V8.80, `c409ba4`).
- Merge pending: none from the current decisions doc.

## Group AI / data / periphery — audited

- `GroupAIStateBase` / `GroupAIStateBesiege`: audited; 39 LIES_EDIT_CLEAN
  bodies are token-identical to 248.2. Report: `dev/reports/groupai-audit.md`.
- HHTACS tactics/spawn groups/unit categories: audit closed; no missing keys.
- Team AI, civilians, props, mission elements, menu, player states: audited;
  no 248.2 contract drift; clear LIES-side guards fixed in `ae89d04`. Report:
  `dev/reports/periphery-audit.md`.
- 152 API review hits triaged: 147 known-safe, 5 engine/uncertain, 0 confirmed
  drift. Report: `dev/reports/api-audit-triage.md`. Watch list: custom
  `_quad_field:find_cover` cone keys, `is_position_unreserved` descriptor.

## Known deviations

- LIES EnemyManager disposal/task-queue overrides removed. Vanilla 248.2 behavior.
- Nav-B generated covers are only visible to LIES's LUA search; engine `find_cover` ignores them.
- `lua_cover` default is off; Nav-B runs only when `lua_cover >= 2`.
- LIES's `covers` facing convention is preserved (points at the wall); engine covers point away.
- `NavFixes` is redundant when LIES is installed; do not run both.
  LIES now carries the NavFixes nav-link/obstacle guards, but NavFixes still
  overwrites `find_segment_doors` / `_sort_nav_segs_after_pos` with incompatible
  signatures. Compatibility matrix: `dev/reports/compatibility.md`.
- Temporary `[LIES-TRACE]` logs removed.

## Gates / harness

```
powershell -NoProfile -ExecutionPolicy Bypass -File dev\tools\gates.ps1
```

Harness commands: `!lies nav`, `!lies cover`, `!lies alarm`, `!lies assault`, `!lies state`, `!lies setting <key> <value>`, `!lies dump`, `!lies gen probe|run`.

Crash evidence: `%LOCALAPPDATA%\PAYDAY 2\crash.txt` (Lua stack) and `mods\logs\*.txt`.

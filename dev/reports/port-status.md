# LIES 248.2 port — status and backlog

Last updated: 2026-10-24 (after Group AI and periphery parity audits).

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
- Static gates: 54 Node tests, 71/71 LuaJIT syntax, 68/68 freevars, ledger,
  API audit pass.

## Open — core AI (needs in-game testing)

Dossiers in `dev/reports/dossiers/`:

| Function | Size | Why it matters |
|---|---:|---|
| `CopLogicBase._upd_attention_obj_detection` | 512L | Detection core; 248.2 changed fields/flow. |
| `CopLogicAttack._upd_aim` | 560L | Aim/cover/fire; 248.2 changed door/aim flow. |
| `CopLogicAttack.action_complete_clbk` | 101L | Action completion + state transitions. |
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
- `force_end_assault_phase`: 248.2 timestamp poke.
- `CopLogicAttack.action_complete_clbk`: `math.rand` dodge timeout.
- `CopLogicAttack.is_available_for_assignment`: restored the 248.2 `data.is_suppressed` gate ahead of walk-forbidden/path-fail; LIES 3 s lockout and sabotage gate kept. Smoke 2026-10-24: 128 suppression denials, no stuck assignments observed.
- `CopLogicIdle.damage_clbk`: `data.t = t` before `identify_attention_obj_instant`.
- `TaserLogicAttack._chk_play_charge_weapon_sound`: restored the 300-unit vertical guard; LIES distance-scaled cooldown and 3000 range kept. Smoke 2026-10-24: 14 allowed, 7 cross-floor blocked.
- `ShieldLogicAttack.queued_update`: adopted 248.2's reservation split (`set_pos_rsrv` success / `add_pos_rsrv` fallback), kept LIES 70 radius and movement gates. Smoke 2026-10-24: 53 set, 4 fallback, no leak.
- `CarryData._chk_register_steal_SO`: adopted 248.2's guard order + `_add_body_activation_clbk()`, kept LIES `sabotage`/`sabo_voiceline`; fixed the nil drop-point fall-through so no broken drop objective is registered. Smoke 2026-10-24: 12 registered, 5 expected skips.
- Keep LIES body (no edit): `CopLogicBase._upd_attention_obj_detection`, `CopLogicAttack._upd_aim`, `TaserLogicAttack._upd_enemy_detection`, `TaserLogicAttack._cancel_tase_attempt`, `TankCopLogicAttack.update`, `CopLogicIdle.damage_clbk`.
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

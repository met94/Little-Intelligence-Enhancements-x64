# LIES signature audit — game order, LIES context trailing

Durable record of the 8.57.36 stale-signature pass (the Phalanx crash, issue
#4). Written so a future port does **not** re-flag the twelve mismatches below
and does not "fix" the intentional trailing arguments.

Scope: LIES functions that copy a game body but change its parameter list.
Source of truth for the game side is `game-data/Payday-2-LuaJIT-Complete` at
`ccabb39e` (249); the 248.2 readings are unchanged for every entry.

Branch: `feat/lies-249`. Version: 8.57.36 (unreleased at audit time; no version
bump for this pass).

## Convention

- **Game parameter order first.** A LIES function that the game also calls keeps
  the game's slots exactly, in the game's order.
- **LIES-only context is optional and trailing.** `data`, `pos_rsrv_id`,
  `from_pos`, `short_back_vec`, `target_area`, `center_only`, `do_not_cache` are
  appended after the last game parameter and default to `nil`/falsy.
- **Never type-sniff.** No `if type(x) == 'table'` dispatch between "game call"
  and "LIES call". A shifted argument is a bug to fix at the call site, not to
  paper over at runtime: with a leading `data`, the game's own call delivers a
  `Vector3` where `data` is expected and `nil` where the second game argument is
  expected, so the first index of a table argument crashes.
- A LIES function whose *meaning* diverges from the game's (different input, a
  different heuristic) is renamed private instead of sharing the vanilla name.

`dev/tools/test/signature-compat.test.mjs` pins eleven declarations - the table
entries except #6, which is the renamed helper and is pinned by its own test
(`_find_enemy_to_mark_from_data(data)` plus both of its call sites). It also
pins call-site order and arity for the six families that were renamed or
reordered in this pass, or whose call sites were re-aligned - `_get_pos_on_wall`,
`calc_initial_phalanx_pos`,
`_calc_pos_on_phalanx_circle`, `_find_retreat_position`,
`_sort_nav_segs_after_pos` and `_find_enemy_to_mark_from_data` - across
`lua/**/*.lua`. The other six entries (`queued_update`, `clbk_pathing_results`,
`_peek_for_pos_sideways`, the two grenade checks, `find_segment_doors`) are
declaration-only pins: their call sites are game- or mod-owned and were already
correct, so only the declaration guards them against a future re-copy.

## The twelve audit entries

Mechanical scan of every LIES definition against the game's, then caller
coverage. Status is at 8.57.36 (all fixed/decided).

| # | Function | Game 249 | LIES 8.57.36 | Decision |
| --- | --- | --- | --- | --- |
| 1 | `CopLogicPhalanxMinion.calc_initial_phalanx_pos` | `(own_pos, objective)` | `(own_pos, objective, data)` | **Fixed — confirmed crash.** Was `(data, own_pos, objective)`; reproduced pre-fix on the rig, probe `job-081716-304` (`sess-20261125-081438`): `attempt to index local 'objective' (a nil value)` |
| 2 | `CopLogicPhalanxMinion._calc_pos_on_phalanx_circle` | `(center_pos, angle, phalanx_minion_count)` | `(center_pos, angle, phalanx_minion_count, data)` | **Fixed — same pattern.** Was `(data, …)`; proven by direct call |
| 3 | `CopLogicAttack._find_retreat_position` | `(from_pos, threat_pos, threat_head_pos, threat_tracker, max_dist, vis_required)` | same + trailing `data` | **Fixed.** Was leading `data` (7 params). LIES callers pass `data`; the game caller sits in a LIES-overridden function, so the shift was latent, not harmless |
| 4 | `NavigationManager:_sort_nav_segs_after_pos` | `(to_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)` | same + trailing `from_pos` | **Fixed.** Was `(to_pos, from_pos, i_seg, …)` — an *inserted* second parameter. LIES caller is `_execute_coarce_search`; the game caller is `navigationmanager.lua:1306` |
| 5 | `CopLogicIntimidated.queued_update` | `(rubbish, data)` | `(rubbish, data)` | **Fixed.** Was `(data)` — a dropped leading parameter. Latent: LIES removed the `add_to_surrendered` registration that fed it |
| 6 | `TeamAILogicAssault.find_enemy_to_mark` | `(enemies)` | `_find_enemy_to_mark_from_data(data)` | **Renamed private.** Same arity, different meaning: the vanilla helper receives the detected-attention-object table, the LIES one the logic `data` and a different heuristic. Sharing the name would silently replace vanilla behaviour. Neither Useful Bots nor The Fixes call it (grep checked) |
| 7 | `CopBrain:clbk_pathing_results` | `(search_id, path)` | same + trailing `do_not_cache` | **Keep.** Optional trailing argument, safe by construction |
| 8 | `CopLogicAttack._peek_for_pos_sideways` | `(data, my_data, from_racker, peek_to_pos, height)` | same + trailing `short_back_vec` | **Keep.** Optional trailing argument |
| 9 | `CopLogicTravel._get_pos_on_wall` | `(from_pos, max_dist, step_offset, is_recurse)` | same + trailing `pos_rsrv_id` | **Keep** — but the call sites were wrong; see below |
| 10 | `GroupAIStateBesiege:_chk_group_use_flash_grenade` | `(group, task_data, detonate_pos)` | same + trailing `target_area` | **Keep.** Optional trailing argument |
| 11 | `GroupAIStateBesiege:_chk_group_use_smoke_grenade` | `(group, task_data, detonate_pos)` | same + trailing `target_area` | **Keep.** Optional trailing argument |
| 12 | `NavigationManager:find_segment_doors` | `(from_seg_id, approve_clbk)` | same + trailing `center_only` | **Keep.** Optional trailing argument |

### Why #1/#2 crashed

The Phalanx minion logic is called by game code that LIES does not (and should
not) replace: `coplogictravel.lua:831` (249) calls
`logic.calc_initial_phalanx_pos(data.m_pos, objective)` with two arguments. With
LIES' `(data, own_pos, objective)` declaration that call bound `data` to a
`Vector3`, `own_pos` to the objective table and `objective` to `nil`, and the
first `objective.angle` read raised `attempt to index local 'objective' (a nil
value)`.
`CopLogicPhalanxVip` still makes its own two-argument call
(`lua/coplogics/coplogicphalanxvip.lua:54`), which is why the declaration must
keep the game order and only *append* the LIES context.

`data` exists in LIES for the position-reservation check inside
`_calc_pos_on_phalanx_circle` (`data.pos_rsrv_id`, `is_pos_free`,
`_get_pos_on_wall`). That feature arrived in 2025 (`46a93f2`) and is kept: it is
a trailing argument, not a leading one, and the block runs only when `data` is
present, so game-convention callers check nothing.

### Why #6 is a rename, not a reorder

`find_enemy_to_mark` has the same arity in both versions, so a shift would not
crash; vanilla would simply receive a logic `data` where it expects the
detected-attention-object table. LIES overrides both of its own callers
(`teamailogicassault.lua:330`, `:480`). Renaming the private helper keeps the
vanilla symbol intact for game code and for any mod that calls it with the
vanilla contract.

## Extra finding: the `_get_pos_on_wall` reservation filter was dead

Not in the original twelve (the *declaration* was correct), found while auditing
call sites:

- `CopLogicTravel._get_pos_on_wall` gained its 5th parameter `pos_rsrv_id` in
  7.544 (`85495bf`, 2023-10-24), in the same commit that added the reservation
  calls.
- Every LIES call site passed **six** arguments —
  `(pos, 700, nil, nil, nil, data.pos_rsrv_id)` — with the id in the ignored 6th
  slot. The function therefore always ran with `pos_rsrv_id = nil`,
  `rsrv_desc.filter = nil`. `filter` is the owner-exclusion id, so with a nil
  filter the unit's own reservation counted as occupied and the wall/fallback
  search treated its own spot as blocked.
- All twelve LIES call sites are aligned to the 5-argument form. Two
  game-convention callers stay at two arguments
  (`shieldlogicattack.lua:368`, `coplogicidle.lua:2085`) and the internal retry
  recursion passes the id through.

Player-visible effect: a cop or shield picking a wall/fallback position now
ignores its own (per-unit) reservation, so it may settle on the spot it already
reserved instead of picking a second one. Phalanx (shield-wall) formations and
cover/fallback movement can differ slightly from 8.57.35. Nothing else changes
in gameplay. This is recorded in `changelog.txt` under 8.57.36.

What is actually verified: the arity alignment (id in the 5th slot) is pinned by
`signature-compat.test.mjs`, and the 70 s soak shows no LIES, phalanx or
reservation error with the aligned calls live. The filter's *meaning* is
confirmed empirically by vanilla probe `job-112005-417` (session
`sess-20261125-111846`): with one reservation owned by `id_a` at the player's
field position, `is_pos_free` returns true for `filter = id_a`, and false for
`filter = id_b` or `filter = nil`. So `filter` is the owner-exclusion id, and the
id is per-unit, not per-group. What was *not* measured is how often a cop in
normal play now picks its own reserved spot instead of a second one; the soak
only shows the absence of errors.

## Cross-mod note: Iter truncates `clbk_pathing_results`' trailing argument

Iter wraps this function with a fixed two-parameter signature, in both trees
that exist in this workspace: 205.4 at
`.worktrees\Iter-suite-guard\lua\copbrain.lua:136` and 205.3 at
`mods\Iter\lua\copbrain.lua:136`. The wrapper is active by default
(`path_extender = true`):

```lua
function CopBrain:clbk_pathing_results(search_id, path)
```

A third `do_not_cache` argument is dropped at the wrapper, and the wrapper
forwards only `(self, search_id, path)` to the original as well. Latent, not
live: the game registers two-argument callbacks only (249 `copbrain.lua:435`,
`:452`, `:471`, `:490`) and LIES never passes a third argument at its own
registration sites (`lua/copextensions/copbrain.lua:937`, `:963`, `:993`), so
`do_not_cache` is always falsy today. If LIES ever uses it, Iter's wrapper must
forward varargs (`function CopBrain:clbk_pathing_results(search_id, path, ...)`
and `itr_original_...(self, search_id, path, ...)`) or the flag is silently
lost.

## Verification

### Static gates

`powershell -File dev\tools\gates.ps1` — all sections PASS, exit 0
(`dev/reports/static-gates.md`):

- Node tool tests — PASS (`pass 256`, `fail 0`; includes the new pin test, 5
  tests)
- Test-harness Lua tests — PASS (`find_segment_doors.lua`,
  `phalanx_signatures.lua`, `test_commands.lua`, `watch_settle_target.lua`)
- LuaJIT syntax (runtime files) — PASS (70 files, 0 failures)
- Free identifiers (game-file locals) — PASS (67 files, 0 findings)
- Function ledger — PASS (`files=70 functions=586 errors=0 unhooked=3`)
- API audit — PASS (`hooks=67/67 methods=49/49 errors=0 review=151`,
  baseline errors 50 / current 0)

The pin test fails on positional drift, proven by moving `data` back to the
first parameter in `calc_initial_phalanx_pos` (declaration) and in its `enter`
call site: two tests failed with the shifted lists, then both edits were reverted
and `git status` was clean again.

### Rig (2026-11-25, session `sess-20261125-102216`)

Direct calls, `job-102406-554` — every assertion `ok=true`:

- game 2-argument `calc_initial_phalanx_pos` → `Vector3(1, 2, 3)`
- LIES 3-argument `calc_initial_phalanx_pos` → `Vector3(1, 2, 3)`
- full-path position, both conventions → `angle=144 pos=Vector3(400, -600, 47.5)`
- `_calc_pos_on_phalanx_circle` 3-argument and 4-argument →
  `Vector3(400, -600, 47.5)`

Owner matrix, `job-102426-750` — the load-once guard still holds after the
signature pass:

- `CopLogicTravel._determine_destination_occupation`, `get_pathing_prio` →
  Keepers
- `upd_advance`, `CopMovement.action_request` → `mods/base/req/core/Hooks.lua`
- `TeamAIMovement.set_cool` → Keepers
- `CopBrain.post_init`, `GroupAIStateBase.register_criminal`,
  `CopLogicIdle.on_alert` → LIES

Soak, `job-102445-432` — 70.3 s loud, `alive=49 engaged=15`, PASS. Log scan
after `10:22:16` shows no LIES, phalanx or reservation errors; the only entries
are pre-existing (`vrplus` boot FATAL, a BeardLib asset warning, `[Updates]`
meta warnings).

Honest limit: the soak did not spawn a phalanx group (`phalanx_spawn=0`), so the
shield-wall path was not exercised end to end. The helpers are proven by the
direct-call probe above, and the call sites by the new pin test. For the
surrounding AI stack (attack, retreat, travel, nav sort) the soak shows the
absence of errors over 70 s with those paths live - not per-path coverage, and no
isolated exercise of any single call site.

## How to re-run

```powershell
powershell -File dev\tools\gates.ps1
node --test dev/tools/test/signature-compat.test.mjs
node dev/tools/fn-ledger.mjs --mod . --out dev\port-248-ledger.md --json dev\reports\port-248-ledger.json
```

## When porting a game body

1. Keep the game declaration byte-for-byte; append LIES context after it.
2. Update every LIES caller so the context is the trailing argument, and leave
   game-convention callers on the game's arity.
3. Run `node --test dev/tools/test/signature-compat.test.mjs`. If the function
   is not pinned there yet, add it (declaration plus call sites) — that is the
   guard against the next silent shift.

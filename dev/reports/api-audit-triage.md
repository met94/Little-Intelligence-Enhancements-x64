# API review triage — LIES 248.2 port

Read-only triage of the 152 `review` hits in `dev/reports/api-audit.md`
(API errors are 0). Baseline 246.1 `a3180fc`, target 248.2 `e3a8b616`, LIES
V8.57 `4215a39`.

## Counts

| Class | Hits |
|---|---:|
| Known-safe | 147 |
| Uncertain, engine/arg-shape only | 5 |
| Confirmed real drift | **0** |

Per symbol: `queue_task` 45, `_nav_segments` 30, `_quad_field` 36,
`search_coarse` 25, `find_segment_doors` 7, `_police_upd_task_queued` 5,
`search_pos_to_pos` 4.

## Uncertain — leave for targeted smoke

| Severity | Symbol / location | Evidence | Player impact if wrong | Action |
|---|---|---|---|---|
| Med–Low | `_quad_field:find_cover` table keys (`coplogicattack.lua:2883`) | Method live at 248.2; `cone_angle` / `cone_base` / `rsrv_filter` appear in no vanilla table at 246.1 or 248.2 | `lua_cover=1` `defend_area` search may accept cover without the intended threat-side cone → cops take cover facing the player | Only test if group defend-cover looks wrong; otherwise keep pre-existing LIES behavior |
| Low | `_quad_field:is_position_unreserved` desc (`navigationmanager.lua:1789/1888/1990`) | Vanilla descriptors include `expire_t`; LIES passes `position`, `radius`, `filter` | Only `lua_cover>1`; could reject free cover or leak reservations | Watch `LEAKING POS RESERVATION` + cover behavior on a Nav-A/Nav-B run |
| Low | `_quad_field:random_position_in_nav_segment` (`navigationmanager.lua:668`) | Method exists; string-vs-number arg form is engine-side | Nav-B density falls back to fan/wall rays | `!lies gen run` already reports sample failures; no code change |
| Low | `search_coarse` nil contract (25 sites) | All LIES sites nil-guard; 248.2 now logs `Application:error` for invalid start/end segment | No path instead of hard error; possible error log noise | Add `Invalid start/end segment for coarse search` to smoke grep |
| Low | `_execute_coarce_search` door delay | LIES omits the 248.2 `door:delay_time()` gate; same in V8.57; delay enforced downstream in `coplogictravel` | No behavior change expected | No action |

## Known-safe groups

- `queue_task` (45): signature unchanged; one no-`execute_t` call (`tankcoplogicattack.lua:21`) still resolves same tick. LIES ships its own `CopLogicBase.queue_task`/`on_queued_task`; duplicate-key cases are in mutually exclusive branches.
- `_quad_field` (36 minus the 5 above): all 15 called methods exist at 248.2; call shapes match 246.1→248.2 vanilla. `access_filter_union` is vanilla at 248.2, so `GroupAIStateBase._get_group_acces_mask` is safe.
- `_nav_segments` (30): 248.2 keys are `tostring(id)`; every LIES index derives from a string source. The P0 `set_nav_segment_state` fix is applied, not pending.
- `search_coarse` (25): parameter shapes match vanilla 248.2; all returns nil-guarded.
- `find_segment_doors` (7): LIES owns the 3-arg method; non-`center_only` returns vectors, `center_only` returns center/end tables; internal consumers match.
- `_police_upd_task_queued` (5): LIES already matches 248.2 timestamp semantics.
- `search_pos_to_pos` (4): vanilla bodies unchanged; LIES falls through to `detailed_search` with the 248.2 param keys.

## Decision

No code change from this triage. The five uncertain items are pre-existing or
engine-only and need targeted gameplay evidence, not a port rewrite. Keep
`find_cover`/`is_position_unreserved` on the watch list for custom-cover and
group-defend smoke; do not change them without a reproducible symptom.

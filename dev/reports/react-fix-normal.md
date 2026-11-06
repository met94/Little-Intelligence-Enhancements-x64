# LIES door-watch report

- Log: `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_11_06_log.txt`
- Session: 2 of 2 (header at line 1560)
- Mod: `D:\Programowanie\payday\2\v2\.worktrees\LIES-watch-settle-type-crash` (8.57.31)
- Digest windows: 3
- `[LIES-TRACE] phase=door_watch` lines: 0
- `[LIES-EVENT] kind=reaction_hold` lines: 0
- First door position: src=expected seg=2 (line 1564)

| claim | result | evidence |
|---|---|---|
| mod loaded | PASS | line 83: 10:00:37 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 188: 10:00:37 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 307: 10:00:38 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 497: 10:01:00 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 602: 10:01:00 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 707: 10:01:01 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 860: 10:01:31 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 965: 10:01:32 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1070: 10:01:32 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1257: 10:01:46 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1362: 10:01:46 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1467: 10:01:46 AM Lua: [INFO] [BLT] Setting up mod 'LIES' |
| version | PASS | log 8.57.31 vs mod.txt 8.57.31 |
| door watch enabled | INFO | door_watch=on highperformance=off (log spells it door_watch=true highperformance=false) |
| watch positions produced | PASS | dw_raw_hit=201 dw_expected_pos_hit=71 dw_path_prestep_hit=56 (sum 328) |
| door pre-step | INFO | dw_path_prestep=206 dw_path_prestep_hit=56: cadence-window frames with an armed coarse path; the attempt counter runs before _get_expected_pos, the hit counter proves a position came out |
| watch aim adopted | PASS | watch_aim_adopted=166, watch_aim_cached=112, watch_aim_verified=0, adopted_while_unseen=166, before_dot=0.41 |
| settled facing | PASS | watch_aim_settled=104, measured=104, square=91/104 (87.5%), dot=0.81 |
| aim accounting | PASS | adopted=166, verified=0, settled=104: every subset is inside the adoption total |
| near-visible probe | PASS | near_vis_probe=654, near_vis_h_max=81 |
| gate respected | INFO | not applicable: the feature is armed |
| outcome accounting | PASS | dw_gap sum 0 over 3 window(s) (call=28156) |
| tracker safety | PASS | dw_stale_bail=0 (informational: the guard refused a freed tracker); 0 FATAL, 0 LIES-attributable Lua error (2 unrelated Lua error line(s)) |
| tracker bails | INFO | dw_stale_bail=0 of dw_call=28156 (0%): the liveness guard runs before the feature gate, so a disarmed run and an enemy that died both land here; a share near 100 % means the guard is misclassifying live trackers |
| nav-link doors | INFO | fsd_navlink_seg_ok=4830 fsd_navlink_seg_mismatch=0 fsd_nil_element=0 fsd_nil_tracker=0 fsd_raw=90378 (a map with no nav-link doors legitimately shows 0) |
| contract | PASS | fsd_bad_shape=0: every door handed to a caller was a Vector3 |
| cost | INFO | dw_us avg 5.43 us, dw_us_max 1000 us, dw_ray 10505 (3501.67/min) over 3 minute window(s), dw_call=28156 |
| reaction level | PASS | react_level=2 (<3), react_hold=8293, react_allow=64743, react_arm=390, react_blocked=4428, hold share 11.4% |
| alarms | PASS | none |
| crash-free | PASS | 0 FATAL, 0 LIES-attributable Lua error (2 unrelated Lua error line(s)) |

verdict: PASS

## Raw numbers

```json
{
  "file": "C:\\Program Files (x86)\\Steam\\steamapps\\common\\PAYDAY 2\\mods\\logs\\2026_11_06_log.txt",
  "files": [
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\PAYDAY 2\\mods\\logs\\2026_11_06_log.txt"
  ],
  "modDir": "D:\\Programowanie\\payday\\2\\v2\\.worktrees\\LIES-watch-settle-type-crash",
  "modVersion": "8.57.31",
  "session": {
    "requested": "last",
    "mode": "last",
    "count": 1,
    "merged": false,
    "total": 2,
    "index": 2,
    "header_line": 1560,
    "selected": [
      {
        "file": "C:\\Program Files (x86)\\Steam\\steamapps\\common\\PAYDAY 2\\mods\\logs\\2026_11_06_log.txt",
        "total": 2,
        "indexes": [
          2
        ],
        "header_lines": [
          1560
        ]
      }
    ]
  },
  "session_label": "2 of 2 (header at line 1560)",
  "verdict": "PASS",
  "verdict_reason": "",
  "armed": true,
  "claims": [
    {
      "id": "loaded",
      "claim": "mod loaded",
      "result": "PASS",
      "evidence": "line 83: 10:00:37 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 188: 10:00:37 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 307: 10:00:38 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 497: 10:01:00 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 602: 10:01:00 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 707: 10:01:01 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 860: 10:01:31 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 965: 10:01:32 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1070: 10:01:32 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1257: 10:01:46 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1362: 10:01:46 AM Lua: [INFO] [BLT] Setting up mod 'LIES'; line 1467: 10:01:46 AM Lua: [INFO] [BLT] Setting up mod 'LIES'"
    },
    {
      "id": "version",
      "claim": "version",
      "result": "PASS",
      "evidence": "log 8.57.31 vs mod.txt 8.57.31"
    },
    {
      "id": "enabled",
      "claim": "door watch enabled",
      "result": "INFO",
      "evidence": "door_watch=on highperformance=off (log spells it door_watch=true highperformance=false)"
    },
    {
      "id": "positions",
      "claim": "watch positions produced",
      "result": "PASS",
      "evidence": "dw_raw_hit=201 dw_expected_pos_hit=71 dw_path_prestep_hit=56 (sum 328)"
    },
    {
      "id": "prestep",
      "claim": "door pre-step",
      "result": "INFO",
      "evidence": "dw_path_prestep=206 dw_path_prestep_hit=56: cadence-window frames with an armed coarse path; the attempt counter runs before _get_expected_pos, the hit counter proves a position came out"
    },
    {
      "id": "watchaim",
      "claim": "watch aim adopted",
      "result": "PASS",
      "evidence": "watch_aim_adopted=166, watch_aim_cached=112, watch_aim_verified=0, adopted_while_unseen=166, before_dot=0.41"
    },
    {
      "id": "settled",
      "claim": "settled facing",
      "result": "PASS",
      "evidence": "watch_aim_settled=104, measured=104, square=91/104 (87.5%), dot=0.81"
    },
    {
      "id": "aimaccount",
      "claim": "aim accounting",
      "result": "PASS",
      "evidence": "adopted=166, verified=0, settled=104: every subset is inside the adoption total"
    },
    {
      "id": "nearvis",
      "claim": "near-visible probe",
      "result": "PASS",
      "evidence": "near_vis_probe=654, near_vis_h_max=81"
    },
    {
      "id": "gate",
      "claim": "gate respected",
      "result": "INFO",
      "evidence": "not applicable: the feature is armed"
    },
    {
      "id": "gaps",
      "claim": "outcome accounting",
      "result": "PASS",
      "evidence": "dw_gap sum 0 over 3 window(s) (call=28156)"
    },
    {
      "id": "tracker",
      "claim": "tracker safety",
      "result": "PASS",
      "evidence": "dw_stale_bail=0 (informational: the guard refused a freed tracker); 0 FATAL, 0 LIES-attributable Lua error (2 unrelated Lua error line(s))"
    },
    {
      "id": "bails",
      "claim": "tracker bails",
      "result": "INFO",
      "evidence": "dw_stale_bail=0 of dw_call=28156 (0%): the liveness guard runs before the feature gate, so a disarmed run and an enemy that died both land here; a share near 100 % means the guard is misclassifying live trackers"
    },
    {
      "id": "navlink",
      "claim": "nav-link doors",
      "result": "INFO",
      "evidence": "fsd_navlink_seg_ok=4830 fsd_navlink_seg_mismatch=0 fsd_nil_element=0 fsd_nil_tracker=0 fsd_raw=90378 (a map with no nav-link doors legitimately shows 0)"
    },
    {
      "id": "contract",
      "claim": "contract",
      "result": "PASS",
      "evidence": "fsd_bad_shape=0: every door handed to a caller was a Vector3"
    },
    {
      "id": "cost",
      "claim": "cost",
      "result": "INFO",
      "evidence": "dw_us avg 5.43 us, dw_us_max 1000 us, dw_ray 10505 (3501.67/min) over 3 minute window(s), dw_call=28156"
    },
    {
      "id": "reaction",
      "claim": "reaction level",
      "result": "PASS",
      "evidence": "react_level=2 (<3), react_hold=8293, react_allow=64743, react_arm=390, react_blocked=4428, hold share 11.4%"
    },
    {
      "id": "alarms",
      "claim": "alarms",
      "result": "PASS",
      "evidence": "none"
    },
    {
      "id": "crash",
      "claim": "crash-free",
      "result": "PASS",
      "evidence": "0 FATAL, 0 LIES-attributable Lua error (2 unrelated Lua error line(s))"
    }
  ],
  "header": {
    "debug_log": "false",
    "door_watch": "true",
    "enemy_reaction_level": "2",
    "hhtacs": "false",
    "highperformance": "false",
    "level": "mad",
    "lua_cover": "2",
    "nav_link_interval": "2",
    "trace": "false",
    "version": "8.57.31",
    "watch_log": "true"
  },
  "digest_windows": 3,
  "counters": {
    "bag_registered": 0,
    "bag_skipped": 0,
    "cache_hit": 0,
    "cache_hit_inclusions": 0,
    "cache_miss": 0,
    "cover_abandoned_inflight": 9,
    "cover_fallback": 0,
    "cover_issued_failed_path": 3,
    "cover_issued_gate": 295,
    "cover_issued_refused_walk": 0,
    "cover_path_failed": 3,
    "cover_set": 3,
    "cover_stale_applied": 0,
    "cover_walk_refused": 0,
    "cover_walk_refused_action": 0,
    "cover_walk_refused_movement": 0,
    "cover_walk_refused_other": 0,
    "dw_advancing_skip": 13740,
    "dw_cached_reuse": 12200,
    "dw_cached_unsighted": 163,
    "dw_cadence_skip": 13740,
    "dw_call": 28156,
    "dw_expected_pos_hit": 71,
    "dw_gap": 0,
    "dw_gate_off": 0,
    "dw_height_skip": 15,
    "dw_hit": 13652,
    "dw_no_my_tracker": 0,
    "dw_none": 1723,
    "dw_outer_gate_skip": 12781,
    "dw_path_kick": 54,
    "dw_path_prestep": 206,
    "dw_path_prestep_hit": 56,
    "dw_raw_hit": 201,
    "dw_ray": 10505,
    "dw_seg_same": 46,
    "dw_stale_bail": 0,
    "dw_vanilla_call": 1723,
    "fsd_bad_shape": 0,
    "fsd_call_2arg": 5460,
    "fsd_call_center": 426,
    "fsd_disabled": 1,
    "fsd_door_dead": 0,
    "fsd_door_obstructed": 0,
    "fsd_navlink_seg_mismatch": 0,
    "fsd_navlink_seg_ok": 4830,
    "fsd_neighbour_missing": 0,
    "fsd_nil_element": 0,
    "fsd_nil_end_pos": 0,
    "fsd_nil_position": 0,
    "fsd_nil_tracker": 0,
    "fsd_no_from_seg": 0,
    "fsd_raw": 90378,
    "fsd_tracker_created": 4830,
    "fsd_tracker_destroyed": 4830,
    "lookup_cover": 304,
    "lookup_nil_seg": 0,
    "lookup_path": 444,
    "marshal": 1,
    "near_vis_probe": 654,
    "phalanx_spawn": 0,
    "react_allow": 64743,
    "react_arm": 390,
    "react_blocked": 4428,
    "react_hold": 8293,
    "search_engine": 634,
    "search_sync_cache": 0,
    "search_sync_line": 122,
    "suppression_deny": 0,
    "taser_allowed": 2,
    "taser_blocked": 2,
    "watch_aim_adopted": 166,
    "watch_aim_cached": 112,
    "watch_aim_dot_n": 166,
    "watch_aim_settled": 104,
    "watch_aim_settled_dot_n": 104,
    "watch_aim_settled_square": 91,
    "watch_aim_verified": 0
  },
  "cost": {
    "log": {
      "windows": 3,
      "dw_call": 28156,
      "dw_us_avg": 5.43,
      "dw_us_max": 1000,
      "dw_ray": 10505,
      "dw_ray_per_min": 3501.67
    }
  },
  "door_watch_first": {
    "line": 1564,
    "fields": {
      "seg": "2",
      "src": "expected",
      "tweak": "city_swat",
      "u": "userdata:_0x00000e41"
    }
  },
  "door_watch_traces": 0,
  "door_watch_trace_src": {},
  "reaction_hold_events": 0,
  "reaction_level": 2,
  "alarms": {},
  "alarm_budget_exhausted": 0,
  "version_seen": "8.57.31",
  "digests": [
    {
      "line": 1561,
      "fields": {
        "bag_registered": "0",
        "bag_skipped": "0",
        "cache_hit": "0",
        "cache_hit_inclusions": "0",
        "cache_hits0": "0",
        "cache_hits1": "0",
        "cache_hits2_7": "0",
        "cache_hits8p": "0",
        "cache_keys": "0",
        "cache_len": "0",
        "cache_miss": "0",
        "cache_scan_n": "0",
        "cache_scan_us": "0",
        "cover_abandoned_inflight": "0",
        "cover_fallback": "0",
        "cover_id_age_max_ms": "0",
        "cover_id_age_ms": "0",
        "cover_issued_failed_path": "0",
        "cover_issued_gate": "0",
        "cover_issued_refused_walk": "0",
        "cover_path_failed": "0",
        "cover_set": "0",
        "cover_stale_applied": "0",
        "cover_walk_refused": "0",
        "cover_walk_refused_action": "0",
        "cover_walk_refused_movement": "0",
        "cover_walk_refused_other": "0",
        "dw_advancing_skip": "0",
        "dw_cached_reuse": "0",
        "dw_cached_unsighted": "0",
        "dw_cadence_skip": "0",
        "dw_call": "0",
        "dw_expected_pos_hit": "0",
        "dw_gap": "0",
        "dw_gate_off": "0",
        "dw_height_skip": "0",
        "dw_hit": "0",
        "dw_no_my_tracker": "0",
        "dw_none": "0",
        "dw_outer_gate_skip": "0",
        "dw_path_kick": "0",
        "dw_path_prestep": "0",
        "dw_path_prestep_hit": "0",
        "dw_raw_hit": "0",
        "dw_ray": "0",
        "dw_seg_same": "0",
        "dw_stale_bail": "0",
        "dw_us": "0",
        "dw_us_max": "0",
        "dw_vanilla_call": "0",
        "engine_us": "0",
        "fsd_bad_shape": "0",
        "fsd_call_2arg": "0",
        "fsd_call_center": "0",
        "fsd_disabled": "0",
        "fsd_door_dead": "0",
        "fsd_door_obstructed": "0",
        "fsd_navlink_seg_mismatch": "0",
        "fsd_navlink_seg_ok": "0",
        "fsd_neighbour_missing": "0",
        "fsd_nil_element": "0",
        "fsd_nil_end_pos": "0",
        "fsd_nil_position": "0",
        "fsd_nil_tracker": "0",
        "fsd_no_from_seg": "0",
        "fsd_raw": "0",
        "fsd_tracker_created": "0",
        "fsd_tracker_destroyed": "0",
        "level": "mad",
        "lookup_cover": "0",
        "lookup_nil_seg": "0",
        "lookup_path": "0",
        "marshal": "0",
        "near_vis_h_max": "0",
        "near_vis_probe": "0",
        "phalanx_spawn": "0",
        "react_allow": "0",
        "react_arm": "0",
        "react_blocked": "0",
        "react_hold": "0",
        "react_level": "2",
        "search_engine": "0",
        "search_sync_cache": "0",
        "search_sync_line": "0",
        "suppression_deny": "0",
        "t": "0",
        "taser_allowed": "0",
        "taser_blocked": "0",
        "watch_aim_adopted": "0",
        "watch_aim_cached": "0",
        "watch_aim_dot": "0",
        "watch_aim_dot_n": "0",
        "watch_aim_settled": "0",
        "watch_aim_settled_dot": "0",
        "watch_aim_settled_dot_n": "0",
        "watch_aim_settled_square": "0",
        "watch_aim_verified": "0"
      }
    },
    {
      "line": 1606,
      "fields": {
        "bag_registered": "0",
        "bag_skipped": "0",
        "cache_hit": "0",
        "cache_hit_inclusions": "0",
        "cache_hits0": "0",
        "cache_hits1": "0",
        "cache_hits2_7": "0",
        "cache_hits8p": "0",
        "cache_keys": "0",
        "cache_len": "0",
        "cache_miss": "0",
        "cache_scan_n": "0",
        "cache_scan_us": "0",
        "cover_abandoned_inflight": "1",
        "cover_fallback": "0",
        "cover_id_age_max_ms": "62",
        "cover_id_age_ms": "27.717820133071",
        "cover_issued_failed_path": "0",
        "cover_issued_gate": "83",
        "cover_issued_refused_walk": "0",
        "cover_path_failed": "0",
        "cover_set": "2",
        "cover_stale_applied": "0",
        "cover_walk_refused": "0",
        "cover_walk_refused_action": "0",
        "cover_walk_refused_movement": "0",
        "cover_walk_refused_other": "0",
        "dw_advancing_skip": "3470",
        "dw_cached_reuse": "2854",
        "dw_cached_unsighted": "53",
        "dw_cadence_skip": "3470",
        "dw_call": "10848",
        "dw_expected_pos_hit": "16",
        "dw_gap": "0",
        "dw_gate_off": "0",
        "dw_height_skip": "1",
        "dw_hit": "3293",
        "dw_no_my_tracker": "0",
        "dw_none": "705",
        "dw_outer_gate_skip": "6850",
        "dw_path_kick": "16",
        "dw_path_prestep": "100",
        "dw_path_prestep_hit": "21",
        "dw_raw_hit": "69",
        "dw_ray": "3474",
        "dw_seg_same": "0",
        "dw_stale_bail": "0",
        "dw_us": "7.2536268134165",
        "dw_us_max": "1000",
        "dw_vanilla_call": "705",
        "engine_us": "0",
        "fsd_bad_shape": "0",
        "fsd_call_2arg": "3715",
        "fsd_call_center": "260",
        "fsd_disabled": "1",
        "fsd_door_dead": "0",
        "fsd_door_obstructed": "0",
        "fsd_navlink_seg_mismatch": "0",
        "fsd_navlink_seg_ok": "3354",
        "fsd_neighbour_missing": "0",
        "fsd_nil_element": "0",
        "fsd_nil_end_pos": "0",
        "fsd_nil_position": "0",
        "fsd_nil_tracker": "0",
        "fsd_no_from_seg": "0",
        "fsd_raw": "67120",
        "fsd_tracker_created": "3354",
        "fsd_tracker_destroyed": "3354",
        "level": "mad",
        "lookup_cover": "90",
        "lookup_nil_seg": "0",
        "lookup_path": "163",
        "marshal": "1",
        "near_vis_h_max": "51",
        "near_vis_probe": "159",
        "phalanx_spawn": "0",
        "react_allow": "21221",
        "react_arm": "120",
        "react_blocked": "1048",
        "react_hold": "2652",
        "react_level": "2",
        "search_engine": "227",
        "search_sync_cache": "0",
        "search_sync_line": "26",
        "suppression_deny": "0",
        "t": "60",
        "taser_allowed": "0",
        "taser_blocked": "0",
        "watch_aim_adopted": "37",
        "watch_aim_cached": "18",
        "watch_aim_dot": "0.37047043523273",
        "watch_aim_dot_n": "37",
        "watch_aim_settled": "25",
        "watch_aim_settled_dot": "0.59272273302078",
        "watch_aim_settled_dot_n": "25",
        "watch_aim_settled_square": "18",
        "watch_aim_verified": "0"
      }
    },
    {
      "line": 1640,
      "fields": {
        "bag_registered": "0",
        "bag_skipped": "0",
        "cache_hit": "0",
        "cache_hit_inclusions": "0",
        "cache_hits0": "0",
        "cache_hits1": "0",
        "cache_hits2_7": "0",
        "cache_hits8p": "0",
        "cache_keys": "0",
        "cache_len": "0",
        "cache_miss": "0",
        "cache_scan_n": "0",
        "cache_scan_us": "0",
        "cover_abandoned_inflight": "8",
        "cover_fallback": "0",
        "cover_id_age_max_ms": "635",
        "cover_id_age_ms": "29.654934721173",
        "cover_issued_failed_path": "3",
        "cover_issued_gate": "212",
        "cover_issued_refused_walk": "0",
        "cover_path_failed": "3",
        "cover_set": "1",
        "cover_stale_applied": "0",
        "cover_walk_refused": "0",
        "cover_walk_refused_action": "0",
        "cover_walk_refused_movement": "0",
        "cover_walk_refused_other": "0",
        "dw_advancing_skip": "10270",
        "dw_cached_reuse": "9346",
        "dw_cached_unsighted": "110",
        "dw_cadence_skip": "10270",
        "dw_call": "17308",
        "dw_expected_pos_hit": "55",
        "dw_gap": "0",
        "dw_gate_off": "0",
        "dw_height_skip": "14",
        "dw_hit": "10359",
        "dw_no_my_tracker": "0",
        "dw_none": "1018",
        "dw_outer_gate_skip": "5931",
        "dw_path_kick": "38",
        "dw_path_prestep": "106",
        "dw_path_prestep_hit": "35",
        "dw_raw_hit": "132",
        "dw_ray": "7031",
        "dw_seg_same": "46",
        "dw_stale_bail": "0",
        "dw_us": "3.603761975921",
        "dw_us_max": "1000",
        "dw_vanilla_call": "1018",
        "engine_us": "0",
        "fsd_bad_shape": "0",
        "fsd_call_2arg": "1745",
        "fsd_call_center": "166",
        "fsd_disabled": "0",
        "fsd_door_dead": "0",
        "fsd_door_obstructed": "0",
        "fsd_navlink_seg_mismatch": "0",
        "fsd_navlink_seg_ok": "1476",
        "fsd_neighbour_missing": "0",
        "fsd_nil_element": "0",
        "fsd_nil_end_pos": "0",
        "fsd_nil_position": "0",
        "fsd_nil_tracker": "0",
        "fsd_no_from_seg": "0",
        "fsd_raw": "23258",
        "fsd_tracker_created": "1476",
        "fsd_tracker_destroyed": "1476",
        "level": "mad",
        "lookup_cover": "214",
        "lookup_nil_seg": "0",
        "lookup_path": "281",
        "marshal": "0",
        "near_vis_h_max": "81",
        "near_vis_probe": "495",
        "phalanx_spawn": "0",
        "react_allow": "43522",
        "react_arm": "270",
        "react_blocked": "3380",
        "react_hold": "5641",
        "react_level": "2",
        "search_engine": "407",
        "search_sync_cache": "0",
        "search_sync_line": "96",
        "suppression_deny": "0",
        "t": "120",
        "taser_allowed": "2",
        "taser_blocked": "2",
        "watch_aim_adopted": "129",
        "watch_aim_cached": "94",
        "watch_aim_dot": "0.42530457086341",
        "watch_aim_dot_n": "129",
        "watch_aim_settled": "79",
        "watch_aim_settled_dot": "0.88356307148933",
        "watch_aim_settled_dot_n": "79",
        "watch_aim_settled_square": "73",
        "watch_aim_verified": "0"
      }
    }
  ],
  "scan": {
    "setup": 12,
    "fatal": [],
    "luaErrors": [
      {
        "line": 411,
        "text": "10:00:47 AM Log:  (D:\\a\\PAYDAY2-SuperBLT\\PAYDAY2-SuperBLT\\src\\InitiateState.cpp:98) mods/BeardLib/Modules/Utils/ModAssetsModule.lua:156: attempt to compare number with nil"
      },
      {
        "line": 1189,
        "text": "10:01:35 AM Log:  (D:\\a\\PAYDAY2-SuperBLT\\PAYDAY2-SuperBLT\\src\\InitiateState.cpp:98) mods/BeardLib/Modules/Utils/ModAssetsModule.lua:156: attempt to compare number with nil"
      }
    ],
    "liesErrors": []
  }
}
```

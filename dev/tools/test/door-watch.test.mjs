import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the door watch restored in the aim pass (`dev/reports/aim-port-behaviour-ledger.md`
// blocks #1 and #2) and the per-branch counters that make it provable from a
// [LIES-WATCH] digest. The pre-port block lived inline in `_upd_aim`; it now lives
// in the local helper `lies_upd_expected_pos` so the stale-tracker rule from
// `dev/reports/aim-stale-nav-tracker-crash.md` can bail before vanilla is called.

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function stripLuaComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('--[[', i)) {
      const end = source.indexOf(']]', i + 4);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (source.startsWith('--', i)) {
      const eol = source.indexOf('\n', i);
      if (eol === -1) break;
      i = eol;
      continue;
    }
    out += source[i];
    i++;
  }
  return out;
}

const attackSource = () => stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));
const managerSource = () => stripLuaComments(read('menumanager.lua'));

function sliceFunction(source, header) {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `${header} is missing`);
  const next = source.indexOf('\nfunction ', start + header.length);
  const nextLocal = source.indexOf('\nlocal function ', start + header.length);
  const ends = [next, nextLocal].filter((index) => index !== -1);
  const end = ends.length ? Math.min(...ends) : source.length;

  return source.slice(start, end);
}

const helper = () => sliceFunction(attackSource(), 'local function lies_upd_expected_pos(data, my_data, time_since_verification)');

const watchAimBody = () => sliceFunction(attackSource(), 'local function lies_watch_aim_trace(data, my_data, focus_enemy, expected_pos)');

const aimBody = () => sliceFunction(attackSource(), 'function CopLogicAttack._upd_aim(data, my_data)');

const expectedPosBody = () => sliceFunction(attackSource(), 'function CopLogicAttack._get_expected_pos(data, my_data)');

test('the helper is a local declared before CopLogicAttack.enter', () => {
  const text = attackSource();
  const helperAt = text.indexOf('local function lies_upd_expected_pos(data, my_data, time_since_verification)');
  const enterAt = text.indexOf('function CopLogicAttack.enter(data, new_logic_name, enter_params)');
  const trackerAt = text.indexOf('local function lies_enemy_tracker(focus_enemy, data)');

  assert.notEqual(helperAt, -1, 'lies_upd_expected_pos is missing');
  assert.ok(trackerAt < helperAt, 'the helper sits after lies_enemy_tracker');
  assert.ok(helperAt < enterAt, 'the helper sits before CopLogicAttack.enter');
  assert.match(text.slice(helperAt, helperAt + 40), /^local function /, 'the helper must be a local, not a global');
});

test('the aim pass uses the helper, the low-reaction branch stays vanilla', () => {
  const aim = aimBody();
  const calls = [...aim.matchAll(/expected_pos = (lies_upd_expected_pos|CopLogicAttack\._get_expected_attention_position)\(data, my_data/g)];

  assert.equal(calls.length, 2, 'both expected-position call sites must still be present');
  assert.equal(calls[0][1], 'lies_upd_expected_pos', 'the `if not aim` site must use the door watch helper');
  assert.equal(calls[1][1], 'CopLogicAttack._get_expected_attention_position', 'the `reaction < REACT_AIM` site stays vanilla');

  // The helper call sits inside the `if not aim then` arm of the REACT_AIM branch,
  // and is handed the verification age the branch already computed.
  assert.match(aim, /if not aim then\s*expected_pos = lies_upd_expected_pos\(data, my_data, time_since_verification\)/);
});

test('the switch gate needs door_watch and must be off under highperformance', () => {
  const body = helper();

  assert.match(body, /if not \(LIES\.settings\.door_watch and not LIES\.settings\.highperformance\) then/);
  assert.match(body, /LIES:Count\("dw_gate_off"\)/);
  assert.match(body, /return CopLogicAttack\._get_expected_attention_position\(data, my_data\)/);
});

test('tracker liveness runs before the setting gate', () => {
  const body = helper();
  const callAt = body.indexOf('LIES:Count("dw_call")');
  const trackerAt = body.indexOf('local enemy_tracker = lies_enemy_tracker(focus_enemy, data)');
  const bailAt = body.indexOf('LIES:Count("dw_stale_bail")');
  const gateAt = body.indexOf('if not (LIES.settings.door_watch and not LIES.settings.highperformance) then');
  const gateOffAt = body.indexOf('LIES:Count("dw_gate_off")');

  for (const [name, at] of [['dw_call', callAt], ['tracker', trackerAt], ['dw_stale_bail', bailAt], ['gate', gateAt], ['dw_gate_off', gateOffAt]]) {
    assert.notEqual(at, -1, `${name} is missing`);
  }

  assert.ok(callAt < trackerAt, 'the tracker read must come after the call counter');
  assert.ok(trackerAt < bailAt && bailAt < gateAt, 'the stale bail must run before the setting gate');
  assert.ok(gateAt < gateOffAt);

  // The bail must not reach vanilla: with the feature off, vanilla
  // `_get_expected_attention_position` dereferences the same freed tracker.
  const bailBranch = body.slice(bailAt, gateAt);
  assert.doesNotMatch(bailBranch, /_get_expected_attention_position/, 'the stale branch must not dereference the freed tracker through vanilla');
  assert.match(bailBranch, /return\s*\n?\s*end/);
});

test('a freed enemy tracker bails without calling vanilla', () => {
  const body = helper();
  const bailAt = body.indexOf('LIES:Count("dw_stale_bail")');
  assert.notEqual(bailAt, -1, 'dw_stale_bail is missing');

  // `end` of the `if not enemy_tracker` block: the first bare `end` after the count.
  const bailEnd = body.indexOf('\n\tend', bailAt);
  assert.notEqual(bailEnd, -1, 'the stale bail has no closing end');
  const branch = body.slice(bailAt, bailEnd);
  assert.doesNotMatch(branch, /_get_expected_attention_position/, 'the stale branch must not dereference the freed tracker through vanilla');
  assert.match(branch, /return/);

  // The trackers it does use come from lies_enemy_tracker / the unit itself.
  assert.match(body, /local enemy_tracker = lies_enemy_tracker\(focus_enemy, data\)/);
  assert.match(body, /local my_tracker = data\.unit:movement\(\):nav_tracker\(\)/);
  assert.match(body, /local my_seg = my_tracker:nav_segment\(\)/);
  assert.match(body, /local enemy_seg = enemy_tracker:nav_segment\(\)/);
});

test('the cached watch position is read, re-tested, cleared and written back', () => {
  const body = helper();

  assert.match(body, /local expected_pos = my_data\.expected_pos/);
  assert.match(body, /local last_check_t = my_data\.expected_pos_last_check_t/);
  // 0.2 s while the pass is important, 1.5 s otherwise.
  assert.match(body, /data\.t - last_check_t > \(data\.important and 0\.2 or 1\.5\)/);
  // A clock that moved backwards (level change) re-tests immediately.
  assert.match(body, /or data\.t < last_check_t/);
  // Blocked sight ray clears the cache.
  assert.match(body, /expected_pos = nil\s*my_data\.expected_pos = nil\s*\n?[\s\S]{0,80}?LIES:Count\("dw_cached_unsighted"\)/);
  assert.match(body, /my_data\.expected_pos_last_check_t = data\.t/);
  assert.match(body, /my_data\.expected_pos = expected_pos/);
  assert.match(body, /LIES:Count\("dw_advancing_skip"\)/);
});

test('the cadence re-test is not gated on advancing', () => {
  const body = helper();
  const cadenceAt = body.indexOf('if test_for_sight then');
  const stampAt = body.indexOf('my_data.expected_pos_last_check_t = data.t', cadenceAt);

  assert.notEqual(cadenceAt, -1, 'the cadence block is missing');
  assert.notEqual(stampAt, -1, 'the cadence block must stamp expected_pos_last_check_t');

  // The window-open arm (re-test + probe) must not read `advancing`: the only
  // call site is reached while running, so such a gate would make the re-test
  // and the probe dead code. The `advancing` read belongs to the skip arm only.
  const openArm = body.slice(cadenceAt, stampAt);
  assert.doesNotMatch(openArm, /my_data\.advancing/, 'the cadence arm must not be gated on advancing');
  assert.match(openArm, /if expected_pos then[\s\S]*?ai_vision/, 'the re-test ray runs whenever a position is held');
  assert.match(body.slice(stampAt), /LIES:Count\("dw_cadence_skip"\)[\s\S]{0,160}?if my_data\.advancing then\s*LIES:Count\("dw_advancing_skip"\)/);
});

test('the probe is reachable: cadence only, never advancing', () => {
  const body = helper();
  const probeAt = body.indexOf('if not expected_pos then');

  assert.notEqual(probeAt, -1, 'the probe block is gated on expected_pos only');
  const probeEnd = body.indexOf('my_data.expected_pos_last_check_t = data.t', probeAt);
  assert.notEqual(probeEnd, -1, 'the probe block ends at the cadence stamp');
  const probe = body.slice(probeAt, probeEnd);
  assert.doesNotMatch(probe, /my_data\.advancing/, 'the probe must not be gated on advancing');
  assert.doesNotMatch(probe, /test_for_sight/, 'the probe sits inside the cadence block, it does not re-test the window');
  // The engine work really sits inside that block.
  assert.match(probe, /find_segment_doors/);
  assert.match(probe, /local test_pos = door:with_z\(door\.z \+ 140\)/);
  // `dw_cached_reuse` only counts the window-closed arm, so it cannot claim a
  // reuse on a frame that ran the probe.
  const cachedReuseAt = body.indexOf('LIES:Count("dw_cached_reuse")');
  assert.ok(cachedReuseAt > probeEnd, 'the cached-reuse counter sits in the else arm, after the cadence block');
});

test('the path pre-step runs inside the cadence window, only with nothing saved', () => {
  const body = helper();
  const cadenceAt = body.indexOf('if test_for_sight then');
  const retestAt = body.indexOf('if expected_pos then', cadenceAt);
  const prestepAt = body.indexOf('LIES:Count("dw_path_prestep")');
  const stampAt = body.indexOf('my_data.expected_pos_last_check_t = data.t', cadenceAt);
  const skipAt = body.indexOf('LIES:Count("dw_cadence_skip")');

  assert.ok(cadenceAt !== -1 && stampAt !== -1 && skipAt !== -1, 'the cadence block is missing');
  // Inside the window, not before it: the pre-step does an engine coarse search
  // and per-door trackers, so it must not run on every armed frame.
  assert.ok(prestepAt > cadenceAt, 'the pre-step must sit inside the cadence block');
  assert.ok(prestepAt < stampAt, 'the pre-step must sit inside the window-open arm');
  assert.ok(prestepAt < skipAt, 'the pre-step must not run in the window-closed arm');
  // After the cached re-test, and only when the re-test left nothing behind:
  // a nil pre-step result must never discard a held position.
  assert.ok(retestAt < prestepAt, 'the cached re-test comes first');
  const prestepGuardAt = body.indexOf('if my_data.expected_pos_path then');
  assert.ok(prestepGuardAt > retestAt && prestepGuardAt < prestepAt, 'the pre-step is guarded by an armed path');
  assert.match(
    body.slice(prestepGuardAt, prestepAt + 400),
    /if my_data\.expected_pos_path then\s*LIES:Count\("dw_path_prestep"\)\s*local pre = CopLogicAttack\._get_expected_pos\(data, my_data\)\s*if pre then\s*expected_pos = pre\s*src = "expected"\s*LIES:Count\("dw_path_prestep_hit"\)\s*end\s*end/
  );
  // Nested under `if not expected_pos then` after the re-test, and guarded again
  // before the door probe so a pre-step hit skips the engine work.
  const outerGuardAt = body.indexOf('if not expected_pos then', retestAt);
  assert.ok(outerGuardAt !== -1 && outerGuardAt < prestepAt, 'the pre-step hangs off `if not expected_pos then`');
  assert.ok(body.indexOf('if not expected_pos then', prestepAt) > prestepAt, 'the door probe is guarded again after the pre-step');
  // Exactly one pre-step attempt per call at most: no `_get_expected_pos` call
  // before the guard.
  assert.doesNotMatch(body.slice(cadenceAt, prestepAt), /_get_expected_pos\(/, 'no pre-step call before the guard');
});

test('dw_cached_reuse only counts a saved position on a closed window', () => {
  const body = helper();
  const skipAt = body.indexOf('LIES:Count("dw_cadence_skip")');
  const reuse = body.indexOf('if expected_pos and cached == 1 then', skipAt);

  assert.notEqual(skipAt, -1, 'dw_cadence_skip is missing');
  assert.notEqual(reuse, -1, 'dw_cached_reuse must be gated on `cached == 1`');
  assert.match(body, /local cached = expected_pos and 1 or 0/);
  // The counter is in the window-closed arm only.
  assert.ok(reuse > skipAt, 'dw_cached_reuse belongs to the window-closed arm');
  assert.doesNotMatch(body.slice(0, skipAt), /LIES:Count\("dw_cached_reuse"\)/, 'no reuse count inside the cadence window');
});

test('_get_expected_pos drops the armed path when the door retry finds nothing', () => {
  const body = expectedPosBody();

  // The original guard read `if not #found_doors == 0 then`, which Lua parses as
  // `(not #found_doors) == 0` — always false — so an empty door list after the
  // retry never cleared `expected_pos_path` and the dead path was re-walked on
  // every cadence window.
  assert.doesNotMatch(body, /not\s+#found_doors\s*==\s*0/, 'the dead `not #found_doors == 0` guard must stay gone');
  assert.match(
    body,
    /if #found_doors == 0 then\s*if to_nav_seg ~= enemy_seg then\s*found_doors = managers\.navigation:find_segment_doors\(from_nav_seg, callback\(CopLogicAttack, CopLogicAttack, "_chk_is_right_segment", enemy_seg\), true\)\s*end\s*if #found_doors == 0 then\s*my_data\.expected_pos_path = nil\s*return\s*end\s*end/
  );
});

test('the height gate is tracker-free and no nav segment table is read', () => {
  const body = helper();

  assert.match(body, /local enemy_z = focus_enemy\.m_pos and focus_enemy\.m_pos\.z or data\.m_pos\.z/);
  assert.match(body, /data\.m_pos\.z >= enemy_z or math\.abs\(data\.m_pos\.z - enemy_z\) < 250 or \(focus_enemy\.dis or 0\) >= 2000/);
  assert.match(body, /LIES:Count\("dw_height_skip"\)/);
  assert.doesNotMatch(attackSource(), /_nav_segments/, 'the private nav segment table must not be read anywhere in this file');
});

test('find_segment_doors is called with exactly two arguments', () => {
  const body = helper();
  const call = /find_segment_doors\(([^)]*)\)/.exec(body);

  assert.ok(call, 'find_segment_doors(enemy_seg) is missing');
  assert.equal(call[1].trim(), 'enemy_seg', 'the 2-arg form takes only the enemy segment (raw Vector3 doors)');
  assert.doesNotMatch(body, /find_segment_doors\([^)]*_chk_is_right_segment/, 'no segment filter: that shape returns tables');
  assert.doesNotMatch(body, /find_segment_doors\([^)]*,\s*true\s*\)/, 'no center_only: that shape returns tables');
});

test('the door probe counts its rays and its hit, and the armed path is timed once', () => {
  const body = helper();

  assert.match(body, /local test_pos = door:with_z\(door\.z \+ 140\)/);
  assert.match(body, /LIES:Count\("dw_ray"\)/);
  assert.match(body, /LIES:Count\("dw_raw_hit"\)/);
  assert.match(body, /LIES:Count\("door_raw"\)/, 'the watch-channel tag for a raw door position');
  assert.match(body, /local t0 = os\.clock\(\)/);
  assert.match(body, /LIES:Sum\("dw_us", elapsed_us\)/);
  assert.match(body, /LIES:Gauge\("dw_us_max", elapsed_us\)/);
  // The clock starts before the pre-step and the engine call, so both are priced.
  const t0At = body.indexOf('local t0 = os.clock()');
  assert.ok(t0At < body.indexOf('LIES:Count("dw_path_prestep")'), 't0 must precede the pre-step');
  assert.ok(t0At < body.indexOf('find_segment_doors'), 't0 must precede the engine call');
  assert.ok(t0At < body.indexOf('local elapsed_us = (os.clock() - t0)'));
  // One sample per armed call, read after the cadence block, so a frame that
  // stops at the cached re-test or the pre-step is still priced.
  const elapsedAt = body.indexOf('local elapsed_us = (os.clock() - t0)');
  const stampAt = body.indexOf('my_data.expected_pos_last_check_t = data.t');
  assert.ok(stampAt < elapsedAt, 'the timing sample sits after the cadence block');
  assert.ok(elapsedAt < body.indexOf('LIES:Count("dw_hit")'), 'the timing sample precedes the outcome return');
  assert.equal((body.match(/os\.clock\(\)/g) || []).length, 2, 'one start and one read per call');
});

test('the six outcome counters and every sub-event are present', () => {
  const body = helper();

  for (const kind of ['dw_gate_off', 'dw_stale_bail', 'dw_outer_gate_skip', 'dw_no_my_tracker', 'dw_hit', 'dw_none']) {
    assert.match(body, new RegExp(`LIES:Count\\("${kind}"\\)`), `${kind} is an outcome counter here; it is missing`);
  }

  for (const kind of [
    'dw_call',
    'dw_cadence_skip',
    'dw_advancing_skip',
    'dw_cached_reuse',
    'dw_cached_unsighted',
    'dw_height_skip',
    'dw_seg_same',
    'dw_path_prestep',
    'dw_path_prestep_hit',
    'dw_raw_hit',
    'dw_expected_pos_hit',
    'dw_vanilla_call',
    'dw_path_kick',
    'dw_ray',
  ]) {
    assert.match(body, new RegExp(`LIES:Count\\("${kind}"\\)`), `${kind} sub-event counter is missing`);
  }

  // The cop's own tracker is dereferenced twice below the gate, so a nil one is
  // its own outcome and must not reach vanilla.
  assert.match(body, /local my_tracker = data\.unit:movement\(\):nav_tracker\(\)\s*\n\s*\n\tif not my_tracker then\s*\n\s*LIES:Count\("dw_no_my_tracker"\)\s*\n\s*\n\t\treturn\s*\n\tend/);

  // The counter that proves vanilla's coarse-path scheduling still runs.
  assert.match(body, /local had_id = my_data\.expected_pos_path_search_id/);
  assert.match(body, /if not had_id and my_data\.expected_pos_path_search_id then\s*LIES:Count\("dw_path_kick"\)/);

  // The fallback still calls the previously dead `_get_expected_pos`, but never
  // on the same segment: `search_coarse` with from_seg == to_seg cannot succeed.
  assert.match(body, /not enemy_tracker:obstructed\(\) and not my_tracker:obstructed\(\)/);
  assert.match(body, /local fallback = CopLogicAttack\._get_expected_pos\(data, my_data\)/);
  assert.match(body, /if not expected_pos and my_seg ~= enemy_seg and not enemy_tracker:obstructed\(\)/, 'the same-segment case must delegate to vanilla instead of searching');
  assert.match(body, /LIES:Count\("dw_seg_same"\)/);
});

test('one trace per fresh position, and one watch line per session', () => {
  const body = helper();

  assert.match(body, /LIES:Trace\(data\.unit, data, "door_watch", string\.format\("src=%s seg=%s dis=%d cached=%d height=%d"/);
  assert.match(body, /2\.5\)/, 'the trace window must be passed');
  // The trace is behind the `src` flag, so a cached reuse does not emit one.
  const traceAt = body.indexOf('"door_watch"');
  const srcGateAt = body.indexOf('if src then');
  assert.notEqual(srcGateAt, -1, 'the trace must be gated on a freshly computed position');
  assert.ok(srcGateAt < traceAt);

  assert.match(body, /lies_door_watch_first\(/);
  assert.match(attackSource(), /local function lies_door_watch_first\(src, data, enemy_seg\)/);
  assert.match(attackSource(), /if LIES\._door_watch_first then\s*return\s*end\s*if not LIES:WatchEnabled\(\) then\s*return\s*end\s*LIES\._door_watch_first = true/);
  assert.match(attackSource(), /LIES:Watch\("door_watch_first", \{\s*src = src,\s*seg = enemy_seg,\s*u = unit and unit:key\(\) or "\?",\s*tweak = base and base\._tweak_table or "\?"\s*\}\)/);
});

test('the digest reports the door watch, the door list and the reaction hold', () => {
  const manager = managerSource();

  for (const field of [
    'dw_call',
    'dw_hit',
    'dw_gate_off',
    'dw_stale_bail',
    'dw_outer_gate_skip',
    'dw_no_my_tracker',
    'dw_none',
    'dw_cadence_skip',
    'dw_advancing_skip',
    'dw_cached_reuse',
    'dw_cached_unsighted',
    'dw_height_skip',
    'dw_seg_same',
    'dw_path_prestep',
    'dw_path_prestep_hit',
    'dw_raw_hit',
    'dw_expected_pos_hit',
    'dw_vanilla_call',
    'dw_path_kick',
    'dw_ray',
    'watch_aim_adopted',
    'watch_aim_cached',
    'watch_aim_verified',
    'fsd_call_2arg',
    'fsd_call_center',
    'fsd_no_from_seg',
    'fsd_neighbour_missing',
    'fsd_disabled',
    'fsd_raw',
    'fsd_door_dead',
    'fsd_door_obstructed',
    'fsd_nil_element',
    'fsd_nil_position',
    'fsd_nil_tracker',
    'fsd_nil_end_pos',
    'fsd_navlink_seg_ok',
    'fsd_navlink_seg_mismatch',
    'fsd_tracker_created',
    'fsd_tracker_destroyed',
    'fsd_bad_shape',
    'react_hold',
    'react_allow',
    'react_level',
  ]) {
    assert.match(manager, new RegExp(`\\b${field} = `), `digest field ${field} is missing`);
  }

  assert.match(manager, /dw_us = self:_avg_sum\("dw_us"\)/);
  assert.match(manager, /dw_us_max = math\.floor\(\(self\.watch_gauges\.dw_us_max or 0\) \+ 0\.5\)/);
  assert.match(manager, /dw_path_prestep = d\.dw_path_prestep or 0/);
  // The adoption facing error is a per-window mean, not a delta.
  assert.match(manager, /watch_aim_dot = self:_avg_sum\("watch_aim_dot"\)/);
  // The tracker balance was 0 by construction (both counters move in the same
  // block), so the field and its alarm are gone; the harness test owns the
  // invariant.
  assert.doesNotMatch(manager, /fsd_balance/);
  // The gap is computed from the six outcome counters, not hardcoded.
  assert.match(manager, /dw_gap = \(d\.dw_call or 0\) - \(\(d\.dw_gate_off or 0\) \+ \(d\.dw_stale_bail or 0\) \+ \(d\.dw_outer_gate_skip or 0\) \+ \(d\.dw_no_my_tracker or 0\) \+ \(d\.dw_hit or 0\) \+ \(d\.dw_none or 0\)\)/);
});

test('the watchdog alarms cover outcome gaps and bad door shapes', () => {
  const manager = managerSource();
  const tick = manager.slice(manager.indexOf('function LIES:WatchTick(t)'));

  assert.doesNotMatch(tick, /door_tracker_leak/, 'the impossible balance alarm must not come back');
  assert.match(tick, /if dw_gap ~= 0 and dw_call > 0 then\s*self:Alarm\("door_outcome_gap", \{\s*call = dw_call,\s*outcomes = dw_outcomes,\s*gap = dw_gap\s*\}, t\)/);
  assert.match(tick, /if fsd_bad_shape > 0 then\s*self:Alarm\("door_contract_violation", \{\s*bad_shape = fsd_bad_shape\s*\}, t\)/);

  // With the digest off, the alarm window must still advance per minute.
  assert.match(tick, /if self:WatchEnabled\(\) then\s*self:WatchDigest\(t\)\s*else\s*for key, value in pairs\(self\.watch_counters\) do\s*self\.watch_prev\[key\] = value\s*end\s*end\s*end/);
});

test('the header records the switches a digest reader needs', () => {
  const manager = managerSource();
  const header = manager.slice(manager.indexOf('self:Watch("header", {'), manager.indexOf('})', manager.indexOf('self:Watch("header", {')));

  for (const field of ['door_watch', 'trace', 'watch_log', 'enemy_reaction_level']) {
    assert.match(header, new RegExp(`${field} = tostring\\(self\\.settings\\.${field}\\)`), `header must log ${field}`);
  }
});

test('the reaction block counts held and allowed passes', () => {
  const aim = aimBody();
  const gateAt = aim.indexOf('if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then');
  assert.notEqual(gateAt, -1, 'the REACT_COMBAT gate is missing');
  const gateEnd = aim.indexOf('\n\tend', gateAt);
  const block = aim.slice(gateAt, gateEnd);

  assert.match(block, /LIES:Count\("react_hold"\)/);
  assert.match(block, /LIES:Count\("react_allow"\)/);
  // The event exists but is debug-only: it was 76 % of the event channel.
  assert.match(block, /if LIES\.settings\.debug_log then\s*LIES:Event\("reaction_hold", data\.unit, data, \{ level = level \}\)\s*end/);

  // One of each per pass: a single if/else, not one count per condition term.
  const counts = [...block.matchAll(/LIES:Count\("react_(?:hold|allow)"\)/g)];
  assert.equal(counts.length, 2, 'exactly two counter calls, in the if/else');
  assert.match(block, /if react_hold then\s*LIES:Count\("react_hold"\)\s*else\s*LIES:Count\("react_allow"\)\s*end/);

  // The event rides the arm, not every frame.
  const eventAt = block.indexOf('LIES:Event("reaction_hold"');
  const armEnd = block.indexOf('\n\t\t\tend', eventAt);
  assert.ok(eventAt < armEnd, 'the event must sit inside the arm block');
  assert.ok(block.indexOf('focus_enemy.lies_react_t = data.t') < eventAt, 'the event fires alongside the arm');
});

// The V8.79 instrumentation proved a watch position was *computed*; nothing
// said a cop then adopted it as its attention target. That is the downstream
// link these tests pin: one trace phase, one line, three counters.
test('adopting a watch position is traced at the adoption site', () => {
  const aim = aimBody();

  // The adoption branch is the only place `expected_pos` becomes the cop's
  // attention target: the trace hangs off `lies_watch_src`, which only a watch
  // return sets (fresh or cached — vanilla's `m_pos + 140` leaves it nil). The
  // `attention_unit ~= expected_pos` test above it is vanilla's reference
  // compare and never filters: `attention_unit` is always a fresh copy.
  assert.match(
    aim,
    /if my_data\.attention_unit ~= expected_pos then\s*CopLogicBase\._set_attention_on_pos\(data, mvector3\.copy\(expected_pos\)\)\s*my_data\.attention_unit = mvector3\.copy\(expected_pos\)\s*if my_data\.lies_watch_src then\s*lies_watch_aim_trace\(data, my_data, focus_enemy, expected_pos\)\s*end\s*end/,
    'the trace must sit inside the adoption branch, after the attention change'
  );

  const trace = watchAimBody();

  // Field names: a log reader keys on them.
  assert.match(
    trace,
    /LIES:Trace\(data\.unit, data, "watch_aim", string\.format\(\s*"src=%s door_seg=%s my_seg=%s dis=%d dot=%s verified=%d nearly=%d react=%s"/
  );
  assert.match(trace, /tostring\(src\), tostring\(seg\), tostring\(my_seg\)/);
  assert.match(trace, /math\.floor\(mvec3_dis\(data\.m_pos, expected_pos\) \+ 0\.5\)/, 'dis is rounded');
  assert.match(trace, /focus_enemy and tostring\(focus_enemy\.reaction\)/, 'react comes from the attention object');
  // Tight window: an adoption is worth seeing on its own, not once per 2.5 s.
  assert.match(trace, /, 1\.0\)/, 'the watch_aim trace must use a 1.0 s window');
});

test('the adoption counters separate adoptions from visible-target adoptions', () => {
  const trace = watchAimBody();

  assert.match(trace, /LIES:Count\("watch_aim_adopted"\)/);
  // A cached adoption is still an adoption, but the subset is its own counter so
  // a run whose adoptions all came from the cache can be told apart.
  assert.match(trace, /if src == "cached" then\s*LIES:Count\("watch_aim_cached"\)\s*end/);
  // An adoption made while the enemy is visible cannot help the feature, so it
  // is counted separately instead of being folded into the total.
  assert.match(
    trace,
    /if focus_enemy and \(focus_enemy\.verified or focus_enemy\.nearly_visible\) then\s*LIES:Count\("watch_aim_verified"\)\s*end/
  );
  // The facing dot is stored, and the stored value is the one that was logged.
  const sumAt = trace.indexOf('LIES:Sum("watch_aim_dot", dot)');
  assert.notEqual(sumAt, -1, 'watch_aim_dot must accumulate the facing dot');
  assert.ok(trace.indexOf('dot = mvec3_dot(fwd_flat, dir_flat)') < sumAt, 'the sum reads the computed dot');
  assert.ok(sumAt < trace.indexOf('LIES:Trace('), 'the sum is taken before the line is formatted');
});

test('an unknown facing logs dot=n/a and stays out of the mean', () => {
  const trace = watchAimBody();

  // `dot` starts nil, not 0: 0 is a real 90-degree miss. A window where either
  // flattened vector has no length has no facing to measure, so it must neither
  // be averaged in as a miss nor printed as one.
  assert.match(trace, /local dot\r?\n/, 'the dot starts unset');
  assert.doesNotMatch(trace, /local dot = 0/);
  assert.match(trace, /if dot then\s*LIES:Sum\("watch_aim_dot", dot\)\s*end/, 'an unknown facing must not be summed');
  assert.match(trace, /dot and string\.format\("%\.2f", dot\) or "n\/a"/, 'an unknown facing is logged as dot=n\/a');
});

test('the expensive formatting waits for the trace switch', () => {
  const trace = watchAimBody();
  const guardAt = trace.indexOf('if LIES.settings.trace then');
  const formatAt = trace.indexOf('LIES:Trace(');
  const trackerAt = trace.indexOf('nav_tracker()');

  assert.notEqual(guardAt, -1, 'the trace call needs the cheap settings gate');
  assert.ok(guardAt < formatAt, 'the format is built only when Trace can write');
  assert.ok(guardAt < trackerAt, 'the tracker read sits behind the same gate');
  // Everything the counters need (`Count`, `Sum`) stays outside the gate: the
  // digest is the evidence, the line is optional.
  for (const at of [trace.indexOf('LIES:Count("watch_aim_adopted")'), trace.indexOf('LIES:Sum("watch_aim_dot", dot)')]) {
    assert.ok(at !== -1 && at < guardAt, 'counters must not depend on trace');
  }
  // The per-unit window check is still inside `Trace`; this guard only avoids
  // paying for a string that would be dropped.
  assert.match(managerSource(), /function LIES:Trace\(unit, logic_data, phase, extra, window\)\s*if not \(self\.settings and self\.settings\.trace\) then\s*return\s*end/);
});

test('the adoption trace is a trace phase, not a debug-gated event', () => {
  const trace = watchAimBody();

  // `debug_log` is off in routine plays and the event channel needs it; the
  // adoption must be observable from the same switch as the door_watch phase.
  assert.doesNotMatch(trace, /debug_log/, 'the adoption line must not need debug_log');
  assert.doesNotMatch(trace, /LIES:Event\(/, 'an adoption is a per-unit phase, not a lifecycle event');
  assert.match(trace, /LIES:Trace\(data\.unit, data, "watch_aim"/);
});

test('the helper stamps provenance on every watch return, cached included', () => {
  const body = helper();
  const aim = aimBody();

  // Exactly one stamp per call, and it is unconditional inside the returning
  // arm: a cached reuse is still a watch position the cop aimed at, so it is
  // stamped `cached` instead of staying silent. Only the computed-position line
  // (`phase=door_watch`) stays behind `if src then`.
  const stamps = [...body.matchAll(/my_data\.lies_watch_src = src or "cached"/g)];
  assert.equal(stamps.length, 1, 'one provenance stamp per watch return');
  assert.match(body, /my_data\.lies_watch_src = src or "cached"\s*my_data\.lies_watch_seg = enemy_seg/);
  assert.equal((body.match(/my_data\.lies_watch_seg = enemy_seg/g) || []).length, 1);
  const stampAt = body.indexOf('my_data.lies_watch_src = src or "cached"');
  assert.ok(
    body.indexOf('LIES:Count("dw_hit")') < stampAt,
    'the stamp belongs to the returning arm only'
  );
  // The cached-reuse arm runs on a closed window, i.e. before that return, and
  // the stamp must not sit inside the fresh-only `if src then` block.
  assert.ok(body.indexOf('LIES:Count("dw_cached_reuse")') < stampAt);
  assert.ok(stampAt < body.indexOf('if src then'), 'the stamp is not nested inside the fresh-only block');
  assert.match(
    helper(),
    /if src then\s*lies_door_watch_first\(src, data, enemy_seg\)/,
    'the computed-position line stays fresh-only'
  );

  // The consumer clears the stamp every pass: the low-reaction branch produces
  // `expected_pos` without touching the helper at all, so a stamp from an
  // earlier pass would be read as this pass's source.
  assert.match(
    aim,
    /local focus_enemy = data\.attention_obj\s*[\s\S]{0,300}?my_data\.lies_watch_src = nil\s*my_data\.lies_watch_seg = nil/
  );
  const clearAt = aim.indexOf('my_data.lies_watch_src = nil');
  assert.ok(clearAt < aim.indexOf('lies_upd_expected_pos(data, my_data'), 'the clear must precede the helper call');
  assert.ok(clearAt < aim.indexOf('if my_data.lies_watch_src then'), 'the clear must precede the adoption read');
});

test('a cached watch return is traced and counted with src=cached', () => {
  const trace = watchAimBody();
  const body = helper();

  // The helper's closed-window arm returns the saved position with no `src`, and
  // the funnel stamps it as `cached`; the adoption trace then reports that
  // source verbatim, so a log can separate a fresh derivation from a reuse.
  assert.match(body, /my_data\.lies_watch_src = src or "cached"/);
  assert.match(trace, /local src = my_data\.lies_watch_src/);
  assert.match(trace, /src=%s door_seg=%s/, 'the source is the first field of the adoption line');
  // Counted: one adoption for every return, and the cached subset on its own.
  assert.match(trace, /LIES:Count\("watch_aim_adopted"\)[\s\S]{0,200}?if src == "cached" then\s*LIES:Count\("watch_aim_cached"\)/);
  // The digest only carries the field if `menumanager.lua` writes it.
  assert.match(managerSource(), /\bwatch_aim_cached = d\.watch_aim_cached or 0/);
});


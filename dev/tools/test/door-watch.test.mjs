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

const aimBody = () => sliceFunction(attackSource(), 'function CopLogicAttack._upd_aim(data, my_data)');

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
  // The advancing branch is skipped, and it says so.
  assert.match(body, /if test_for_sight and not my_data\.advancing then/);
  assert.match(body, /LIES:Count\("dw_advancing_skip"\)/);
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

test('the door probe counts its rays and its hit, and times the loop', () => {
  const body = helper();

  assert.match(body, /local test_pos = door:with_z\(door\.z \+ 140\)/);
  assert.match(body, /LIES:Count\("dw_ray"\)/);
  assert.match(body, /LIES:Count\("dw_raw_hit"\)/);
  assert.match(body, /LIES:Count\("door_raw"\)/, 'the watch-channel tag for a raw door position');
  assert.match(body, /local t0 = os\.clock\(\)/);
  assert.match(body, /LIES:Sum\("dw_us", elapsed_us\)/);
  assert.match(body, /LIES:Gauge\("dw_us_max", elapsed_us\)/);
});

test('the five outcome counters and every sub-event are present', () => {
  const body = helper();

  for (const kind of ['dw_gate_off', 'dw_stale_bail', 'dw_outer_gate_skip', 'dw_hit', 'dw_none']) {
    assert.match(body, new RegExp(`LIES:Count\\("${kind}"\\)`), `${kind} is the only outcome counter here; it is missing`);
  }

  for (const kind of [
    'dw_call',
    'dw_cadence_skip',
    'dw_advancing_skip',
    'dw_cached_reuse',
    'dw_cached_unsighted',
    'dw_height_skip',
    'dw_seg_same',
    'dw_raw_hit',
    'dw_expected_pos_hit',
    'dw_vanilla_call',
    'dw_path_kick',
    'dw_ray',
  ]) {
    assert.match(body, new RegExp(`LIES:Count\\("${kind}"\\)`), `${kind} sub-event counter is missing`);
  }

  // The counter that proves vanilla's coarse-path scheduling still runs.
  assert.match(body, /local had_id = my_data\.expected_pos_path_search_id/);
  assert.match(body, /if not had_id and my_data\.expected_pos_path_search_id then\s*LIES:Count\("dw_path_kick"\)/);

  // The fallback still calls the previously dead `_get_expected_pos`.
  assert.match(body, /not enemy_tracker:obstructed\(\) and not my_tracker:obstructed\(\)/);
  assert.match(body, /local fallback = CopLogicAttack\._get_expected_pos\(data, my_data\)/);
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
  assert.match(attackSource(), /if LIES\._door_watch_first then\s*return\s*end\s*LIES\._door_watch_first = true/);
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
    'dw_none',
    'dw_cadence_skip',
    'dw_advancing_skip',
    'dw_cached_reuse',
    'dw_cached_unsighted',
    'dw_height_skip',
    'dw_seg_same',
    'dw_raw_hit',
    'dw_expected_pos_hit',
    'dw_vanilla_call',
    'dw_path_kick',
    'dw_ray',
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
  assert.match(manager, /fsd_balance = \(d\.fsd_tracker_created or 0\) - \(d\.fsd_tracker_destroyed or 0\)/);
  // The gap is computed from the five outcome counters, not hardcoded.
  assert.match(manager, /dw_gap = \(d\.dw_call or 0\) - \(\(d\.dw_gate_off or 0\) \+ \(d\.dw_stale_bail or 0\) \+ \(d\.dw_outer_gate_skip or 0\) \+ \(d\.dw_hit or 0\) \+ \(d\.dw_none or 0\)\)/);
});

test('the watchdog alarms cover tracker leaks, outcome gaps and bad door shapes', () => {
  const manager = managerSource();
  const tick = manager.slice(manager.indexOf('function LIES:WatchTick(t)'));

  assert.match(tick, /if fsd_balance ~= 0 then\s*self:Alarm\("door_tracker_leak", \{\s*created = fsd_created,\s*destroyed = fsd_destroyed,\s*balance = fsd_balance\s*\}, t\)/);
  assert.match(tick, /if dw_gap ~= 0 and dw_call > 0 then\s*self:Alarm\("door_outcome_gap", \{\s*call = dw_call,\s*outcomes = dw_outcomes,\s*gap = dw_gap\s*\}, t\)/);
  assert.match(tick, /if fsd_bad_shape > 0 then\s*self:Alarm\("door_contract_violation", \{\s*bad_shape = fsd_bad_shape\s*\}, t\)/);
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
  assert.match(block, /LIES:Event\("reaction_hold", data\.unit, data, \{ level = level \}\)/);

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

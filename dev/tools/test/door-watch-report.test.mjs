// Door-watch report tool: the claims a test play is adjudicated by.
//
// Every fixture is a synthetic SuperBLT log string, shaped exactly like the
// lines `menumanager.lua` writes (`[LIES-WATCH] evt=digest ...`,
// `[LIES-TRACE] ... phase=door_watch ...`, `[LIES-EVENT] kind=reaction_hold`).
// No files are read, so the test cannot drift with a developer's own log.
//
// Design and the counter -> claim map: dev/reports/door-watch-port.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeLog,
  aggregateDigests,
  parseLog,
  renderReport
} from '../door-watch-report.mjs';

const VERSION = 'V8.79_x64';

function watch(event, fields = {}) {
  const parts = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort();

  return `[LIES-WATCH] v=${VERSION} evt=${event}${parts.length ? ` ${parts.join(' ')}` : ''}`.trimEnd();
}

function header(overrides = {}) {
  return watch('header', {
    level: 'red2',
    lua_cover: 0,
    highperformance: 'off',
    hhtacs: 'off',
    nav_link_interval: 1,
    debug_log: 'off',
    door_watch: 'on',
    trace: 'on',
    watch_log: 'on',
    enemy_reaction_level: 1,
    version: VERSION,
    ...overrides
  });
}

function digest(overrides = {}) {
  return watch('digest', {
    level: 'red2',
    t: 60,
    dw_call: 10,
    dw_gate_off: 0,
    dw_stale_bail: 0,
    dw_outer_gate_skip: 0,
    dw_hit: 4,
    dw_none: 6,
    dw_gap: 0,
    dw_cadence_skip: 2,
    dw_cached_reuse: 1,
    dw_path_prestep: 2,
    dw_raw_hit: 1,
    dw_expected_pos_hit: 3,
    dw_ray: 20,
    dw_us: 12.5,
    dw_us_max: 180,
    fsd_call_2arg: 4,
    fsd_navlink_seg_ok: 5,
    fsd_navlink_seg_mismatch: 1,
    fsd_nil_element: 0,
    fsd_nil_tracker: 0,
    fsd_raw: 7,
    fsd_bad_shape: 0,
    react_hold: 5,
    react_allow: 5,
    react_level: 1,
    ...overrides
  });
}

function trace(src, extra = '') {
  return `[LIES-TRACE] v=${VERSION} t=61.00 u=100 tweak=swat logic=attack phase=door_watch ` +
    `att=5 att_alive=true att_trk=true dropped=0 src=${src} seg=42 dis=800 cached=1 height=1${extra}`;
}

function reactionEvent(level) {
  return `[LIES-EVENT] v=${VERSION} kind=reaction_hold t=61.00 u=100 tweak=swat logic=attack att=5 level=${level}`;
}

const SETUP = "Setting up mod 'LIES'";

const happyLog = [
  SETUP,
  header(),
  watch('door_watch_first', { src: 'raw', seg: 42, u: 100, tweak: 'swat' }),
  digest(),
  trace('raw'),
  trace('expected'),
  reactionEvent(1),
  digest({
    t: 120,
    dw_call: 5,
    dw_hit: 2,
    dw_none: 3,
    dw_cadence_skip: 4,
    dw_cached_reuse: 2,
    dw_path_prestep: 0,
    dw_raw_hit: 0,
    dw_expected_pos_hit: 1,
    dw_ray: 10,
    dw_us: 9.5,
    dw_us_max: 120,
    react_hold: 1,
    react_allow: 4
  })
].join('\n');

function claimOf(report, id) {
  const found = report.claims.find(entry => entry.id === id);

  assert.ok(found, `claim ${id} is missing`);
  return found;
}

test('a healthy armed run passes every claim', () => {
  const report = analyzeLog(happyLog, { file: 'happy_log.txt', modVersion: VERSION });

  assert.equal(report.verdict, 'PASS');
  assert.equal(claimOf(report, 'loaded').result, 'PASS');
  assert.equal(claimOf(report, 'version').result, 'PASS');
  assert.equal(claimOf(report, 'enabled').result, 'INFO');
  assert.match(claimOf(report, 'enabled').evidence, /door_watch=on highperformance=off/);
  assert.equal(claimOf(report, 'positions').result, 'PASS');
  assert.equal(claimOf(report, 'gaps').result, 'PASS');
  assert.equal(claimOf(report, 'tracker').result, 'PASS');
  assert.equal(claimOf(report, 'contract').result, 'PASS');
  assert.equal(claimOf(report, 'reaction').result, 'PASS');
  assert.equal(claimOf(report, 'alarms').result, 'PASS');
  assert.equal(claimOf(report, 'crash').result, 'PASS');
  // Armed, so the "gate respected" claim is not applicable rather than PASS.
  assert.equal(claimOf(report, 'gate').result, 'INFO');

  // Per-window deltas are summed across digests, not read from the last one.
  assert.equal(report.counters.dw_call, 15);
  assert.equal(report.counters.dw_none, 9);
  assert.equal(report.digest_windows, 2);

  // Derived evidence: positions, trace summary, first-proof line.
  assert.equal(report.door_watch_traces, 2);
  assert.deepEqual(report.door_watch_trace_src, { raw: 1, expected: 1 });
  assert.equal(report.door_watch_first.fields.src, 'raw');
  assert.equal(report.reaction_hold_events, 1);

  // Cost: mean of the per-window averages, max gauge, rays per minute.
  assert.equal(report.cost.log.dw_us_avg, 11);
  assert.equal(report.cost.log.dw_us_max, 180);
  assert.equal(report.cost.log.dw_ray, 30);
  assert.equal(report.cost.log.dw_ray_per_min, 15);
});

test('the rendered report is a table, a verdict line and the raw JSON', () => {
  const markdown = renderReport(analyzeLog(happyLog, { file: 'happy_log.txt', modVersion: VERSION }));

  assert.match(markdown, /\| claim \| result \| evidence \|/);
  assert.match(markdown, /\| watch positions produced \| PASS \|/);
  assert.match(markdown, /^verdict: PASS$/m);
  assert.match(markdown, /## Raw numbers/);
  assert.match(markdown, /"dw_call": 15/);
});

test('a high-performance run proves the gate instead of the feature', () => {
  const log = [
    SETUP,
    header({ highperformance: 'on', enemy_reaction_level: 3 }),
    digest({ dw_call: 20, dw_gate_off: 20, dw_hit: 0, dw_none: 0, dw_cadence_skip: 0, dw_cached_reuse: 0, dw_path_prestep: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0, dw_ray: 0, react_hold: 0, react_allow: 9, react_level: 3 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'hp_log.txt', modVersion: VERSION });

  assert.equal(report.verdict, 'PASS');
  assert.equal(claimOf(report, 'gate').result, 'PASS');
  assert.match(claimOf(report, 'gate').evidence, /dw_call=20 dw_gate_off=20/);
  assert.equal(claimOf(report, 'positions').result, 'INFO');
  // High Performance on, but the feature still did something: the gate failed.
  const leaky = analyzeLog(log.replace('dw_gate_off=20', 'dw_gate_off=19'), {
    file: 'hp_log.txt',
    modVersion: VERSION
  });

  assert.equal(claimOf(leaky, 'gate').result, 'FAIL');
  assert.equal(leaky.verdict, 'FAIL');
});

test('a door_watch=off run must also land in dw_gate_off', () => {
  const log = [
    SETUP,
    header({ door_watch: 'off', enemy_reaction_level: 3 }),
    digest({ dw_call: 6, dw_gate_off: 6, dw_hit: 0, dw_none: 0, dw_cadence_skip: 0, dw_cached_reuse: 0, dw_path_prestep: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0, dw_ray: 0, react_hold: 0, react_allow: 2, react_level: 3 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'off_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'gate').result, 'PASS');
  assert.equal(claimOf(report, 'positions').result, 'INFO');
  assert.equal(report.verdict, 'PASS');
});

test('an unreached door branch fails the position claim and names the hint', () => {
  const log = [
    SETUP,
    header(),
    digest({ dw_path_prestep: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'cold_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'positions').result, 'FAIL');
  assert.match(claimOf(report, 'positions').evidence, /no call reached the door branch/);
  assert.equal(report.verdict, 'FAIL');
});

test('a non-zero dw_gap fails outcome accounting and prints the windows', () => {
  const log = [
    SETUP,
    header(),
    digest({ dw_call: 10, dw_hit: 4, dw_none: 4, dw_gap: 2 }),
    digest({ t: 120, dw_call: 5, dw_hit: 2, dw_none: 2, dw_gap: 1 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'gap_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'gaps').result, 'FAIL');
  assert.match(claimOf(report, 'gaps').evidence, /t=60 gap=2/);
  assert.match(claimOf(report, 'gaps').evidence, /t=120 gap=1/);
  assert.equal(report.verdict, 'FAIL');
});

test('fsd_bad_shape fails the Vector3 contract', () => {
  const log = [SETUP, header(), digest({ fsd_bad_shape: 2 })].join('\n');
  const report = analyzeLog(log, { file: 'shape_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'contract').result, 'FAIL');
  assert.match(claimOf(report, 'contract').evidence, /non-Vector3/);
  assert.equal(report.verdict, 'FAIL');
});

test('a log without the watch header is INCOMPLETE and names the setting', () => {
  const log = [SETUP, trace('raw'), reactionEvent(1)].join('\n');
  const report = analyzeLog(log, { file: 'quiet_log.txt', modVersion: VERSION });
  const markdown = renderReport(report);

  assert.equal(report.verdict, 'INCOMPLETE');
  assert.equal(claimOf(report, 'enabled').result, 'INFO');
  assert.match(markdown, /verdict: INCOMPLETE/);
  assert.match(markdown, /"watch_log": true/);
  assert.match(markdown, /LittleIntelligenceEnhancementS\.txt/);
  // The version still came from the breadcrumbs.
  assert.equal(report.version_seen, VERSION);
  assert.equal(claimOf(report, 'version').result, 'PASS');
});

test('a version mismatch against mod.txt fails', () => {
  const report = analyzeLog(happyLog, { file: 'happy_log.txt', modVersion: 'V8.78_x64' });

  assert.equal(claimOf(report, 'version').result, 'FAIL');
  assert.match(claimOf(report, 'version').evidence, /V8\.79_x64 vs mod\.txt V8\.78_x64/);
  assert.equal(report.verdict, 'FAIL');
});

test('--ab prints the control figures and the delta', () => {
  const control = [
    SETUP,
    header({ door_watch: 'off' }),
    digest({ dw_call: 10, dw_gate_off: 10, dw_hit: 0, dw_none: 0, dw_ray: 10, dw_us: 8, dw_us_max: 90 })
  ].join('\n');
  const report = analyzeLog(happyLog, { file: 'a.txt', modVersion: VERSION, controlText: control, controlFile: 'b.txt' });

  assert.equal(report.cost.control.dw_us_avg, 8);
  assert.equal(report.cost.control.dw_us_max, 90);
  assert.equal(report.cost.control.dw_ray_per_min, 10);
  assert.match(claimOf(report, 'cost').evidence, /control dw_us avg 8 us \(\+3 us\)/);
  assert.match(claimOf(report, 'cost').evidence, /delta dw_ray\/min \+5/);
  assert.equal(claimOf(report, 'cost').result, 'INFO');
  // The control log is not adjudicated: its own verdict is irrelevant here.
  assert.equal(report.verdict, 'PASS');
});

test('reaction level is judged on both sides of the 3 boundary', () => {
  const slow = analyzeLog([SETUP, header({ enemy_reaction_level: 1 }), digest({ react_hold: 4 })].join('\n'), {
    file: 'slow.txt',
    modVersion: VERSION
  });

  assert.equal(claimOf(slow, 'reaction').result, 'PASS');

  const slowNoHold = analyzeLog([SETUP, header({ enemy_reaction_level: 1 }), digest({ react_hold: 0 })].join('\n'), {
    file: 'slow.txt',
    modVersion: VERSION
  });

  assert.equal(claimOf(slowNoHold, 'reaction').result, 'FAIL');
  assert.match(claimOf(slowNoHold, 'reaction').evidence, /no hold counted/);

  const fast = analyzeLog([SETUP, header({ enemy_reaction_level: 3 }), digest({ react_hold: 0, react_level: 3 })].join('\n'), {
    file: 'fast.txt',
    modVersion: VERSION
  });

  assert.equal(claimOf(fast, 'reaction').result, 'PASS');

  const fastHeld = analyzeLog([SETUP, header({ enemy_reaction_level: 3 }), digest({ react_hold: 2, react_level: 3 })].join('\n'), {
    file: 'fast.txt',
    modVersion: VERSION
  });

  assert.equal(claimOf(fastHeld, 'reaction').result, 'FAIL');
});

test('alarms are surfaced by name, and the hard ones fail the run', () => {
  const benign = analyzeLog(
    [SETUP, header(), digest(), watch('alarm', { name: 'lies_cover_fallback_rate', rate: '0.61', fallback: 30, total: 49 })].join('\n'),
    { file: 'alarm.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(benign, 'alarms').result, 'PASS');
  assert.deepEqual(benign.alarms, { lies_cover_fallback_rate: 1 });
  assert.match(claimOf(benign, 'alarms').evidence, /lies_cover_fallback_rate/);

  const hard = analyzeLog(
    [SETUP, header(), digest(), watch('alarm', { name: 'door_outcome_gap', call: 10, outcomes: 8, gap: 2 })].join('\n'),
    { file: 'alarm.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(hard, 'alarms').result, 'FAIL');
  assert.match(claimOf(hard, 'alarms').evidence, /door_outcome_gap/);
  assert.equal(hard.verdict, 'FAIL');
});

test('only LIES-attributable errors fail the crash claim', () => {
  const unrelated = [
    'ModAssetsModule.lua:156: attempt to compare number with nil',
    SETUP,
    header(),
    digest()
  ].join('\n');
  const report = analyzeLog(unrelated, { file: 'beardlib.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'crash').result, 'PASS');
  assert.equal(claimOf(report, 'crash').evidence.includes('1 unrelated Lua error line'), true);

  const lies = [
    SETUP,
    header(),
    digest(),
    'lua/coplogics/coplogicattack.lua:1: attempt to index a nil value (LIES:Count)',
    'stack traceback:',
    '[LIES] hook coplogicattack'
  ].join('\n');
  const failing = analyzeLog(lies, { file: 'lies.txt', modVersion: VERSION });

  assert.equal(claimOf(failing, 'crash').result, 'FAIL');
  assert.equal(claimOf(failing, 'tracker').result, 'FAIL');
  assert.equal(failing.verdict, 'FAIL');
});

test('several logs are adjudicated as one play', () => {
  const second = [header({ level: 'mus' }), digest({ t: 60, dw_call: 3, dw_hit: 1, dw_none: 2 })].join('\n');
  const report = analyzeLog(happyLog, {
    file: 'a.txt',
    otherFiles: [{ file: 'b.txt', text: second }],
    modVersion: VERSION
  });

  assert.deepEqual(report.files, ['a.txt', 'b.txt']);
  assert.equal(report.digest_windows, 3);
  assert.equal(report.counters.dw_call, 18);
});

test('parseLog keeps the per-window fields the digest is judged on', () => {
  const parsed = parseLog(happyLog, { file: 'happy_log.txt' });
  const aggregate = aggregateDigests(parsed.digests);

  assert.equal(parsed.header.fields.door_watch, 'on');
  assert.equal(parsed.digests.length, 2);
  assert.equal(parsed.digests[0].fields.dw_call, '10');
  // Gauges are not counters: a sum of cache_len/dw_us would be meaningless.
  assert.equal(aggregate.counters.dw_us, undefined);
  assert.equal(aggregate.counters.dw_us_max, undefined);
  assert.equal(aggregate.counters.dw_call, 15);
  assert.equal(aggregate.dw_us_max, 180);
});

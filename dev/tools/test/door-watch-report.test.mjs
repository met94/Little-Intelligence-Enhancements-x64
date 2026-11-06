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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_VERSIONS,
  SessionRangeError,
  VALUE_FLAGS,
  analyzeLog,
  aggregateDigests,
  parseArgs,
  parseLog,
  renderReport,
  selectSessions
} from '../door-watch-report.mjs';

const VERSION = '8.57.32';
const CLI = fileURLToPath(new URL('../door-watch-report.mjs', import.meta.url));

function watch(event, fields = {}) {
  const parts = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort();

  return `[LIES-WATCH] v=${VERSION} evt=${event}${parts.length ? ` ${parts.join(' ')}` : ''}`.trimEnd();
}

function header(overrides = {}) {
  // Real header shape: `menumanager.lua` writes `tostring(boolean)`, so the
  // values are `true`/`false`, not the menu's `on`/`off`.
  return watch('header', {
    level: 'red2',
    lua_cover: 0,
    highperformance: 'false',
    hhtacs: 'false',
    nav_link_interval: 1,
    debug_log: 'false',
    door_watch: 'true',
    trace: 'true',
    watch_log: 'true',
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

// A disarmed run does no watch work: every work counter is zero and every call
// ends in one of the three termination counters (`dw_gate_off`,
// `dw_stale_bail`, `dw_no_my_tracker`).
const IDLE_COUNTERS = {
  dw_call: 0,
  dw_gate_off: 0,
  dw_stale_bail: 0,
  dw_no_my_tracker: 0,
  dw_outer_gate_skip: 0,
  dw_hit: 0,
  dw_none: 0,
  dw_cadence_skip: 0,
  dw_advancing_skip: 0,
  dw_cached_reuse: 0,
  dw_cached_unsighted: 0,
  dw_height_skip: 0,
  dw_seg_same: 0,
  dw_path_prestep: 0,
  dw_path_prestep_hit: 0,
  dw_raw_hit: 0,
  dw_expected_pos_hit: 0,
  dw_vanilla_call: 0,
  dw_path_kick: 0,
  dw_ray: 0,
  dw_us: 0,
  dw_us_max: 0,
  dw_gap: 0,
  react_hold: 0,
  react_allow: 9,
  react_level: 3
};

function disarmedDigest(overrides = {}) {
  return digest({ ...IDLE_COUNTERS, ...overrides });
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
  assert.equal(report.armed, true);
  assert.equal(claimOf(report, 'loaded').result, 'PASS');
  assert.equal(claimOf(report, 'version').result, 'PASS');
  assert.equal(claimOf(report, 'enabled').result, 'INFO');
  assert.match(claimOf(report, 'enabled').evidence, /door_watch=on highperformance=off/);
  assert.match(claimOf(report, 'enabled').evidence, /log spells it door_watch=true highperformance=false/);
  assert.equal(claimOf(report, 'positions').result, 'PASS');
  assert.equal(claimOf(report, 'prestep').result, 'INFO');
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
    header({ highperformance: 'true', enemy_reaction_level: 3 }),
    digest({ dw_call: 20, dw_gate_off: 20, dw_hit: 0, dw_none: 0, dw_cadence_skip: 0, dw_cached_reuse: 0, dw_path_prestep: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0, dw_ray: 0, react_hold: 0, react_allow: 9, react_level: 3 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'hp_log.txt', modVersion: VERSION });

  // Disarmed: the gate claim can pass, but the run cannot prove the feature.
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.equal(report.armed, false);
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
    header({ door_watch: 'false', enemy_reaction_level: 3 }),
    digest({ dw_call: 6, dw_gate_off: 6, dw_hit: 0, dw_none: 0, dw_cadence_skip: 0, dw_cached_reuse: 0, dw_path_prestep: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0, dw_ray: 0, react_hold: 0, react_allow: 2, react_level: 3 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'off_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'gate').result, 'PASS');
  assert.equal(claimOf(report, 'positions').result, 'INFO');
  // Disarmed: still not a proof of the feature, and the report says why.
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.match(report.verdict_reason, /door_watch=off/);
  assert.match(renderReport(report), /header shows it disarmed/);
});

test('a disarmed run that bails on stale trackers still respects the gate', () => {
  // The enemy-tracker liveness guard runs before the `door_watch`/
  // `highperformance` gate by design, so a correct disarmed run splits its calls
  // between `dw_stale_bail` and `dw_gate_off`. The 2026-11-01 High Performance
  // run (90869 calls: 83168 gated, 7701 stale, every work counter 0) was such a
  // run; the old `dw_gate_off === dw_call` rule marked it FAIL.
  const log = [
    SETUP,
    header({ highperformance: 'true', enemy_reaction_level: 3 }),
    disarmedDigest({ dw_call: 20, dw_gate_off: 12, dw_stale_bail: 8 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'hp_log.txt', modVersion: VERSION });
  const gate = claimOf(report, 'gate');

  assert.equal(gate.result, 'PASS');
  assert.match(gate.evidence, /dw_call=20 dw_gate_off=12 dw_stale_bail=8 dw_no_my_tracker=0/);
  assert.match(gate.evidence, /sum 20 vs dw_call 20/);
  // Informational, not a failure: a third of the calls bailed on a dying enemy.
  assert.match(gate.evidence, /stale-bail share 40%/);
  assert.match(gate.evidence, /work counters all zero/);
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.match(report.verdict_reason, /highperformance=on/);
});

test('a disarmed run whose calls do not all terminate fails the gate', () => {
  // 12 + 7 of 20: one call reached the door branch without incrementing a
  // termination counter, so the gate cannot be proven.
  const log = [
    SETUP,
    header({ highperformance: 'true', enemy_reaction_level: 3 }),
    disarmedDigest({ dw_call: 20, dw_gate_off: 12, dw_stale_bail: 7 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'hp_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'gate').result, 'FAIL');
  assert.match(claimOf(report, 'gate').evidence, /19 of 20 calls ended in a termination counter/);
  assert.equal(report.verdict, 'FAIL');
});

test('a disarmed run that did any watch work fails the gate', () => {
  // The terminations add up, but a `dw_hit` proves the door branch ran while the
  // feature was off.
  const log = [
    SETUP,
    header({ door_watch: 'false', enemy_reaction_level: 3 }),
    disarmedDigest({ dw_call: 20, dw_gate_off: 20, dw_hit: 1 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'off_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'gate').result, 'FAIL');
  assert.match(claimOf(report, 'gate').evidence, /work counters ran while the feature was off: dw_hit=1/);
  assert.equal(report.verdict, 'FAIL');
});

test('the tracker-bail share is an always-on INFO claim, armed runs included', () => {
  const report = analyzeLog(happyLog, { file: 'happy_log.txt', modVersion: VERSION });
  const bails = claimOf(report, 'bails');

  assert.equal(bails.result, 'INFO');
  assert.match(bails.evidence, /dw_stale_bail=0 of dw_call=15 \(0%\)/);
  assert.equal(report.verdict, 'PASS');

  // A guard firing while the feature is armed is expected, so it stays INFO.
  const bailing = analyzeLog(happyLog.replace('dw_stale_bail=0', 'dw_stale_bail=3'), {
    file: 'happy_log.txt',
    modVersion: VERSION
  });

  assert.equal(bailing.armed, true);
  assert.match(claimOf(bailing, 'bails').evidence, /dw_stale_bail=3 of dw_call=15 \(20%\)/);
  assert.equal(bailing.verdict, 'PASS');
});

test('a hand-edited on/off header is normalised like the real true/false one', () => {
  const armed = analyzeLog(happyLog, { file: 'a.txt', modVersion: VERSION });
  const handEdited = analyzeLog(
    happyLog.replace('door_watch=true', 'door_watch=on').replace('highperformance=false', 'highperformance=off'),
    { file: 'a.txt', modVersion: VERSION }
  );

  assert.equal(handEdited.armed, true);
  assert.equal(handEdited.verdict, 'PASS');
  assert.equal(claimOf(handEdited, 'positions').result, claimOf(armed, 'positions').result);
  // The evidence names the spelling the log used.
  assert.match(claimOf(handEdited, 'enabled').evidence, /door_watch=on highperformance=off/);
  assert.doesNotMatch(claimOf(handEdited, 'enabled').evidence, /log spells it/);

  // 1/0 and mixed case mean the same thing.
  const numeric = analyzeLog(
    happyLog.replace('door_watch=true', 'door_watch=1').replace('highperformance=false', 'highperformance=OFF'),
    { file: 'a.txt', modVersion: VERSION }
  );

  assert.equal(numeric.armed, true);
  assert.equal(numeric.verdict, 'PASS');
});

test('a no-activity log with the feature armed is a FAIL, not a PASS', () => {
  // Every counter exists but nothing happened: this is exactly the run that
  // must not be reported as a pass.
  const log = [
    SETUP,
    header(),
    digest({ dw_call: 0, dw_gate_off: 0, dw_hit: 0, dw_none: 0, dw_cadence_skip: 0, dw_cached_reuse: 0, dw_path_prestep: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0, dw_ray: 0 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'idle_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'positions').result, 'FAIL');
  assert.match(claimOf(report, 'positions').evidence, /no call reached the door branch/);
  assert.equal(report.verdict, 'FAIL');
});

test('dw_path_prestep alone does not prove a position', () => {
  const log = [
    SETUP,
    header(),
    digest({ dw_path_prestep: 7, dw_path_prestep_hit: 0, dw_raw_hit: 0, dw_expected_pos_hit: 0 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'prestep_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'positions').result, 'FAIL');
  assert.match(claimOf(report, 'positions').evidence, /dw_raw_hit=0 dw_expected_pos_hit=0 dw_path_prestep_hit=0 \(sum 0\)/);
  // The pre-step is reported, but only as INFO.
  assert.equal(claimOf(report, 'prestep').result, 'INFO');
  assert.match(claimOf(report, 'prestep').evidence, /dw_path_prestep=7/);
  assert.equal(report.verdict, 'FAIL');
});

test('a pre-step-only run still passes the positions claim', () => {
  // The pre-step is the armed-path branch: a healthy run whose positions all
  // come from it must PASS, so `dw_path_prestep_hit` is a position counter.
  const log = [
    SETUP,
    header(),
    digest({
      dw_call: 10,
      dw_hit: 5,
      dw_none: 5,
      dw_gap: 0,
      dw_cadence_skip: 4,
      dw_cached_reuse: 2,
      dw_path_prestep: 5,
      dw_path_prestep_hit: 5,
      dw_raw_hit: 0,
      dw_expected_pos_hit: 0,
      dw_ray: 0
    })
  ].join('\n');
  const report = analyzeLog(log, { file: 'prestep_hit_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'positions').result, 'PASS');
  assert.match(claimOf(report, 'positions').evidence, /dw_path_prestep_hit=5 \(sum 5\)/);
  // Both halves of the pre-step are surfaced: attempts and hits.
  assert.match(claimOf(report, 'prestep').evidence, /dw_path_prestep=5 dw_path_prestep_hit=5/);
  assert.equal(report.verdict, 'PASS');
});

test('parseArgs rejects a flag with no value instead of passing undefined on', () => {
  for (const flag of ['--ab', '--out', '--json', '--mod']) {
    assert.throws(() => parseArgs(['log.txt', flag]), /requires a value/, `${flag} at the end must be a usage error`);
    // A following flag is not a value: `--out --json x` would otherwise write a
    // file literally named "--json".
    assert.throws(() => parseArgs([flag, '--out', 'x']), /requires a value/, `${flag} followed by a flag must be a usage error`);
    assert.throws(() => parseArgs([flag, '']), /requires a value/, `${flag} with an empty value must be a usage error`);
  }

  assert.throws(() => parseArgs(['--nope']), /unknown argument/);
});

test('parseArgs collects logs and flag values', () => {
  const args = parseArgs(['a.txt', 'b.txt', '--ab', 'control.txt', '--out', 'r.md', '--json', 'r.json', '--mod', 'm', '--session', '2']);

  assert.deepEqual(args.logs, ['a.txt', 'b.txt']);
  assert.equal(args.ab, 'control.txt');
  assert.equal(args.out, 'r.md');
  assert.equal(args.json, 'r.json');
  assert.equal(args.mod, 'm');
  assert.equal(args.session, '2');
  assert.equal(args.help, false);
  // The default is the newest session, not the whole file.
  assert.equal(parseArgs(['a.txt']).session, 'last');
  // Every value flag is declared once, in the exported table.
  assert.deepEqual([...VALUE_FLAGS.keys()].sort(), ['--ab', '--json', '--mod', '--out', '--session']);
});

test('parseArgs rejects a --session value that is not last, all or an index', () => {
  assert.throws(() => parseArgs(['a.txt', '--session', 'first']), /--session expects/);
  assert.throws(() => parseArgs(['a.txt', '--session', '-1']), /requires a value/);
  assert.throws(() => parseArgs(['a.txt', '--session', '--out', 'x']), /requires a value/);
  assert.equal(parseArgs(['a.txt', '--session', 'all']).session, 'all');
});

test('a missing flag value exits 3 through the CLI', () => {
  const result = spawnSync(process.execPath, [CLI, 'log.txt', '--out'], { encoding: 'utf8' });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /--out requires a value/);
  assert.match(result.stderr, /Usage:/);
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
  const report = analyzeLog(happyLog, { file: 'happy_log.txt', modVersion: '8.57.22' });

  assert.equal(claimOf(report, 'version').result, 'FAIL');
  // Built from the fixture version so a release bump does not have to touch this
  // assertion (the log version is what the tool reports back).
  assert.ok(
    claimOf(report, 'version').evidence.includes(`${VERSION} vs mod.txt 8.57.22`),
    claimOf(report, 'version').evidence
  );
  assert.equal(report.verdict, 'FAIL');
});

test('a log written under a pre-relabel label still matches the current mod.txt', () => {
  // The fork relabeled every release on 2026-11-03; a log keeps the label its
  // build shipped with. The label is read from dev/version-map.json so this test
  // never hardcodes one.
  const legacyLabel = [...LEGACY_VERSIONS].find(([, version]) => version === VERSION)[0];
  const legacy = happyLog.replaceAll(`v=${VERSION}`, `v=${legacyLabel}`);
  const report = analyzeLog(legacy, { file: 'legacy_log.txt', modVersion: VERSION });

  assert.equal(claimOf(report, 'version').result, 'PASS');
  assert.equal(
    claimOf(report, 'version').evidence,
    `log ${legacyLabel} (=${VERSION}) vs mod.txt ${VERSION}`
  );
  // The raw label is still reported, so the log stays identifiable.
  assert.equal(report.version_seen, legacyLabel);
});

test('--ab prints the control figures and the delta', () => {
  const control = [
    SETUP,
    header({ door_watch: 'false' }),
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

test('--ab with a control that has no digest window reports it as unusable', () => {
  // A control log with no `evt=digest` (e.g. watch_log left off) must not be
  // printed as a set of deltas against zero â€” those numbers would look like a
  // real cost comparison.
  const control = [SETUP, header({ door_watch: 'false' }), trace('raw')].join('\n');
  const report = analyzeLog(happyLog, { file: 'a.txt', modVersion: VERSION, controlText: control, controlFile: 'b.txt' });

  assert.equal(report.cost.control.windows, 0);
  assert.equal(claimOf(report, 'cost').result, 'INFO');
  assert.match(claimOf(report, 'cost').evidence, /control unusable/);
  assert.match(claimOf(report, 'cost').evidence, /b\.txt/);
  assert.doesNotMatch(claimOf(report, 'cost').evidence, /delta dw_ray\/min/);
  assert.doesNotMatch(claimOf(report, 'cost').evidence, /control dw_us avg/);
  // The run's own numbers are still reported.
  assert.match(claimOf(report, 'cost').evidence, /dw_us avg 11 us/);
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

test('reaction level separates a held shot from a held aim pass', () => {
  const heldShot = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 1 }), digest({ react_hold: 94, react_allow: 6, react_arm: 12, react_blocked: 7 })].join('\n'),
    { file: 'slow.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(heldShot, 'reaction').result, 'PASS');
  assert.match(claimOf(heldShot, 'reaction').evidence, /react_arm=12, react_blocked=7/);
  assert.match(claimOf(heldShot, 'reaction').evidence, /hold share 94\.0%/);
  // A near-total hold is reported, not silently accepted: it is the signature
  // of the timer re-arming on stale verifications.
  assert.match(claimOf(heldShot, 'reaction').evidence, /WARN hold share above 80%/);

  const idleAim = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 1 }), digest({ react_hold: 94, react_allow: 6, react_arm: 12, react_blocked: 0 })].join('\n'),
    { file: 'slow.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(idleAim, 'reaction').result, 'FAIL');
  assert.match(claimOf(idleAim, 'reaction').evidence, /never suppressed a fire decision/);
  assert.match(claimOf(idleAim, 'reaction').evidence, /hold share 94\.0%/, 'the share stays visible on a failed claim');

  const normal = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 2 }), digest({ react_hold: 10, react_allow: 90, react_arm: 4, react_blocked: 2 })].join('\n'),
    { file: 'normal.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(normal, 'reaction').result, 'PASS');
  assert.match(claimOf(normal, 'reaction').evidence, /hold share 10\.0%/);
  assert.doesNotMatch(claimOf(normal, 'reaction').evidence, /WARN/);

  const legacy = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 1 }), digest({ react_hold: 4 })].join('\n'),
    { file: 'old.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(legacy, 'reaction').result, 'PASS');
  assert.match(claimOf(legacy, 'reaction').evidence, /pre-instrumentation/);
});

test('reaction level uses react_delay and falls back for old logs', () => {
  const high = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 3 }), digest({ react_hold: 40, react_allow: 60, react_arm: 2, react_blocked: 5, react_delay: 0.5, react_level: 3 })].join('\n'),
    { file: 'high.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(high, 'reaction').result, 'PASS');
  assert.match(claimOf(high, 'reaction').evidence, /react_delay=0\.5s/);
  assert.match(claimOf(high, 'reaction').evidence, /delay on/);

  const ultra = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 4 }), digest({ react_hold: 0, react_allow: 100, react_arm: 0, react_blocked: 0, react_delay: 0, react_level: 4 })].join('\n'),
    { file: 'ultra.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(ultra, 'reaction').result, 'PASS');
  assert.match(claimOf(ultra, 'reaction').evidence, /react_delay=0s/);
  assert.match(claimOf(ultra, 'reaction').evidence, /delay off/);

  // Pre-8.57.32 logs have no react_delay; there, 3 still means ULTRA.
  const legacy = analyzeLog(
    [SETUP, header({ enemy_reaction_level: 3 }), digest({ react_hold: 0, react_allow: 10 })].join('\n'),
    { file: 'old.txt', modVersion: VERSION }
  );

  assert.equal(claimOf(legacy, 'reaction').result, 'PASS');
  assert.match(claimOf(legacy, 'reaction').evidence, /pre-8\.57\.32 log/);
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

  assert.equal(parsed.header.fields.door_watch, 'true');
  assert.equal(parsed.digests.length, 2);
  assert.equal(parsed.digests[0].fields.dw_call, '10');
  // Gauges are not counters: a sum of cache_len/dw_us would be meaningless.
  assert.equal(aggregate.counters.dw_us, undefined);
  assert.equal(aggregate.counters.dw_us_max, undefined);
  assert.equal(aggregate.counters.dw_call, 15);
  assert.equal(aggregate.dw_us_max, 180);
});

// --- near-visible probe (8.57.24 probe height) -------------------------------
//
// The merge in `_nearly_visible_chk` is only observable if the probe fired, and
// "the digest has no such field" (an older build) must not read as a clean play.
test('a fired near-visible probe passes and prints the height', () => {
  const log = [SETUP, header(), digest({ near_vis_probe: 3, near_vis_h_max: 96 })].join('\n');
  const report = analyzeLog(log, { file: 'probe.txt', modVersion: VERSION });
  const probe = claimOf(report, 'nearvis');

  assert.equal(probe.claim, 'near-visible probe');
  assert.equal(probe.result, 'PASS');
  assert.match(probe.evidence, /near_vis_probe=3, near_vis_h_max=96/);
  assert.equal(report.verdict, 'PASS');
});

test('a probe field that never fired is INFO, not a failure', () => {
  // A play where no target was ever covered by low cover: the merge is wired,
  // the probe simply never ran.
  const log = [SETUP, header(), digest({ near_vis_probe: 0, near_vis_h_max: 0 })].join('\n');
  const report = analyzeLog(log, { file: 'probe_idle.txt', modVersion: VERSION });
  const probe = claimOf(report, 'nearvis');

  assert.equal(probe.result, 'INFO');
  assert.match(probe.evidence, /no near-visible probe fired in these windows/);
  assert.match(probe.evidence, /near_vis_probe=0/);
  // Still a healthy armed run: nothing failed.
  assert.equal(report.verdict, 'PASS');
});

test('a digest without the near_vis_* fields is named as a pre-8.57.24 log', () => {
  // The build under test is wired for the merge; a log that never mentions it
  // cannot prove anything, so it must be INFO and say why.
  const log = [SETUP, header(), digest()].join('\n');
  const report = analyzeLog(log, { file: 'old_build.txt', modVersion: VERSION });
  const probe = claimOf(report, 'nearvis');

  assert.equal(probe.result, 'INFO');
  assert.match(probe.evidence, /digest has no near_vis_\* fields: pre-8\.57\.24 log/);
  assert.equal(report.verdict, 'PASS');
});

test('near_vis_h_max is a high-water gauge, not a summed counter', () => {
  // Two windows: the probe fired 3 + 2 times, but the reported height is the
  // taller of the two windows (100), not 160.
  const aggregate = aggregateDigests([
    { fields: { near_vis_probe: '3', near_vis_h_max: '100' } },
    { fields: { near_vis_probe: '2', near_vis_h_max: '60' } }
  ]);

  assert.equal(aggregate.counters.near_vis_probe, 5);
  assert.equal(aggregate.counters.near_vis_h_max, undefined);
  assert.equal(aggregate.near_vis_h_max, 100);

  const log = [
    SETUP,
    header(),
    digest({ near_vis_probe: 3, near_vis_h_max: 100 }),
    digest({ t: 120, near_vis_probe: 2, near_vis_h_max: 60 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'probe.txt', modVersion: VERSION });

  assert.equal(report.counters.near_vis_probe, 5);
  assert.equal(report.counters.near_vis_h_max, undefined);
  assert.match(claimOf(report, 'nearvis').evidence, /near_vis_probe=5, near_vis_h_max=100/);
});

// --- game sessions ---------------------------------------------------------
//
// One SuperBLT log file accumulates every launch that day. This fixture is two
// launches in one file: an armed run (High Performance off, a raw position) and
// after it a High Performance run whose calls all land in `dw_gate_off`. Reading
// both as one play was the bug: the armed verdict could never be trusted.
const twoRunLines = [
  SETUP, // 1
  header(), // 2 â€” session 1
  digest({ t: 60 }), // 3
  header({ highperformance: 'true', level: 'auc', enemy_reaction_level: 3 }), // 4 â€” session 2
  digest({ // 5
    t: 60,
    level: 'auc',
    dw_call: 20,
    dw_gate_off: 20,
    dw_hit: 0,
    dw_none: 0,
    dw_cadence_skip: 0,
    dw_cached_reuse: 0,
    dw_path_prestep: 0,
    dw_raw_hit: 0,
    dw_expected_pos_hit: 0,
    dw_ray: 0,
    dw_us: 0,
    dw_us_max: 0,
    react_hold: 0,
    react_allow: 9,
    react_level: 3
  })
];
const twoRunLog = twoRunLines.join('\n');

test('a two-launch log is split at each watch header', () => {
  const parsed = parseLog(twoRunLog, { file: 'two_runs.txt' });

  assert.equal(parsed.sessions.length, 2);
  assert.equal(parsed.sessions[0].index, 1);
  assert.equal(parsed.sessions[0].header_line, 2);
  assert.equal(parsed.sessions[0].digests.length, 1);
  assert.equal(parsed.sessions[1].index, 2);
  assert.equal(parsed.sessions[1].header_line, 4);
  assert.equal(parsed.sessions[1].digests.length, 1);
  // The whole-log view is unchanged for callers that still read it.
  assert.equal(parsed.digests.length, 2);
  // The first launch's setup line is before the first header: pre-session, and
  // outside both session segments.
  assert.equal(parsed.sessions[0].start_line, 2);
  assert.equal(parsed.setup.length, 1);
});

test('session last reads only the newest launch and keeps its verdict', () => {
  const report = analyzeLog(twoRunLog, { file: 'two_runs.txt', modVersion: VERSION });

  assert.equal(report.session.mode, 'last');
  assert.equal(report.session.count, 1);
  assert.equal(report.session.index, 2);
  assert.equal(report.session.total, 2);
  assert.equal(report.session.merged, false);
  assert.equal(report.session.header_line, 4);

  // Only the High Performance digest counts: 20 calls, all gated off.
  assert.equal(report.digest_windows, 1);
  assert.equal(report.counters.dw_call, 20);
  assert.equal(report.counters.dw_raw_hit, 0);
  assert.equal(claimOf(report, 'gate').result, 'PASS');
  assert.match(claimOf(report, 'gate').evidence, /dw_call=20 dw_gate_off=20/);
  assert.equal(report.armed, false);
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.match(renderReport(report), /Session: 2 of 2 \(header at line 4\)/);
});

test('session 1 reads the armed launch, not the later control one', () => {
  const report = analyzeLog(twoRunLog, { file: 'two_runs.txt', modVersion: VERSION, session: '1' });
  const markdown = renderReport(report);

  assert.equal(report.session.index, 1);
  assert.equal(report.session.total, 2);
  assert.equal(report.digest_windows, 1);
  assert.equal(report.counters.dw_call, 10);
  assert.equal(report.counters.dw_raw_hit, 1);
  assert.equal(report.armed, true);
  assert.equal(claimOf(report, 'positions').result, 'PASS');
  assert.equal(report.verdict, 'PASS');
  assert.match(markdown, /Session: 1 of 2 \(header at line 2\)/);
  // The second launch's settings are not in the header block.
  assert.match(markdown, /door_watch=on highperformance=off/);
});

test('session all sums both launches, the last header wins and the report says so', () => {
  const report = analyzeLog(twoRunLog, { file: 'two_runs.txt', modVersion: VERSION, session: 'all' });
  const markdown = renderReport(report);

  assert.equal(report.session.mode, 'all');
  assert.equal(report.session.count, 2);
  assert.equal(report.session.merged, true);
  assert.deepEqual(report.session.selected[0].indexes, [1, 2]);
  assert.equal(report.digest_windows, 2);
  assert.equal(report.counters.dw_call, 30);
  assert.equal(report.counters.dw_gate_off, 20);
  assert.equal(report.counters.dw_raw_hit, 1);
  // Merged headers: the newest one is the run's settings.
  assert.equal(report.header.highperformance, 'true');
  assert.equal(report.armed, false);
  // Merging an armed launch with a gated one cannot pass the gate claim: the
  // summed counters show sub-events next to `dw_gate_off` calls. That is honest
  // â€” `all` is for "how much did this file do", not for a verdict.
  assert.equal(claimOf(report, 'gate').result, 'FAIL');
  assert.equal(report.verdict, 'FAIL');
  assert.match(markdown, /Session: all \(merged 2 of 2 sessions; headers at 2, 4\)/);
});

test('an out-of-range session index exits 3 through the CLI', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lies-session-'));
  const log = path.join(dir, 'two_runs.txt');

  fs.writeFileSync(log, twoRunLog);

  try {
    const last = spawnSync(process.execPath, [CLI, log, '--session', '2'], { encoding: 'utf8' });

    assert.equal(last.status, 2, last.stderr);
    assert.match(last.stdout, /Session: 2 of 2 \(header at line 4\)/);
    assert.match(last.stdout, /session=2\/2/);

    for (const index of ['3', '0']) {
      const result = spawnSync(process.execPath, [CLI, log, '--session', index], { encoding: 'utf8' });

      assert.equal(result.status, 3, `--session ${index} must be a usage error`);
      assert.match(result.stderr, /out of range: .*two_runs\.txt has 2 session\(s\)/);
      assert.match(result.stderr, /Usage:/);
      assert.equal(result.stdout, '');
    }

    // A bad value is a usage error before any log is read.
    const bad = spawnSync(process.execPath, [CLI, 'missing.txt', '--session', 'newest'], { encoding: 'utf8' });

    assert.equal(bad.status, 3);
    assert.match(bad.stderr, /--session expects last, all or a 1-based index/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // The API reports the same thing without exiting.
  assert.throws(() => analyzeLog(twoRunLog, { file: 'two_runs.txt', session: '3' }), SessionRangeError);
  assert.throws(() => selectSessions(parseLog(twoRunLog), '0'), /out of range/);
  assert.throws(() => selectSessions(parseLog(twoRunLog), 'nope'), /--session expects/);
});

test('a header-less log is one session holding everything and stays INCOMPLETE', () => {
  const log = [SETUP, digest()].join('\n');
  const report = analyzeLog(log, { file: 'no_header.txt', modVersion: VERSION });
  const markdown = renderReport(report);

  assert.equal(report.session.count, 1);
  assert.equal(report.session.index, 1);
  assert.equal(report.session.total, 1);
  assert.equal(report.session.header_line, null);
  // No header means no session boundary: every digest line is still read.
  assert.equal(report.digest_windows, 1);
  assert.equal(report.verdict, 'INCOMPLETE');
  assert.match(markdown, /Session: 1 of 1 \(no watch header: the whole log is one session\)/);
  assert.match(markdown, /"watch_log": true/);
});

test('--ab applies the session selection to the control log too', () => {
  const control = [
    SETUP,
    header({ door_watch: 'false' }),
    digest({ dw_call: 10, dw_gate_off: 10, dw_hit: 0, dw_none: 0, dw_ray: 10, dw_us: 100, dw_us_max: 900 }),
    header({ door_watch: 'false', highperformance: 'true' }),
    digest({ dw_call: 10, dw_gate_off: 10, dw_hit: 0, dw_none: 0, dw_ray: 10, dw_us: 8, dw_us_max: 90 })
  ].join('\n');
  const report = analyzeLog(happyLog, {
    file: 'a.txt',
    modVersion: VERSION,
    controlText: control,
    controlFile: 'b.txt'
  });

  // The newest control launch is the comparison, not the 100 us one before it.
  assert.equal(report.cost.control.dw_us_avg, 8);
  assert.match(claimOf(report, 'cost').evidence, /control dw_us avg 8 us/);
  assert.match(claimOf(report, 'cost').evidence, /control session 2 of 2/);
  assert.equal(report.verdict, 'PASS');

  const earlier = analyzeLog(happyLog, {
    file: 'a.txt',
    modVersion: VERSION,
    controlText: control,
    controlFile: 'b.txt',
    session: '1'
  });

  assert.equal(earlier.cost.control.dw_us_avg, 100);
  assert.match(claimOf(earlier, 'cost').evidence, /control session 1 of 2/);
  assert.equal(earlier.verdict, 'PASS');
});

// The 8.57.29 link: a digest can prove a watch position was *computed*
// (`positions`) while saying nothing about whether a cop adopted it. This claim
// reads the adoption counters, and the facing dot is a mean, not a delta.
test('watch aim adopted passes when a cop adopted a computed position', () => {
  const log = [
    SETUP,
    header(),
    digest({ watch_aim_adopted: 3, watch_aim_verified: 0, watch_aim_cached: 1, watch_aim_dot: 0.4 }),
    digest({ t: 120, watch_aim_adopted: 2, watch_aim_verified: 1, watch_aim_cached: 2, watch_aim_dot: 0.1 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'adopt_log.txt', modVersion: VERSION });
  const adopted = claimOf(report, 'watchaim');

  assert.equal(adopted.claim, 'watch aim adopted');
  assert.equal(adopted.result, 'PASS');
  assert.match(adopted.evidence, /watch_aim_adopted=5/);
  assert.match(adopted.evidence, /watch_aim_cached=3/);
  assert.match(adopted.evidence, /watch_aim_verified=1/);
  // PASS reads the difference, not the raw total: 5 adoptions, 1 made while the
  // target was visible, 4 while it was unseen.
  assert.match(adopted.evidence, /adopted_while_unseen=4/);
  // Weighted by each window's adoptions: (0.4*3 + 0.1*2) / 5 = 0.28, not the
  // unweighted mean of the two window means (0.25).
  assert.match(adopted.evidence, /before_dot=0\.28/);
  assert.equal(report.counters.watch_aim_adopted, 5);
  assert.equal(report.counters.watch_aim_cached, 3, 'the cached subset is summed like the other counters');
  // Subset arithmetic: `watch_aim_verified` is counted per adoption pass, so it
  // can never exceed the adoption total. Pinned as an assertion, not a comment,
  // because the PASS above is a difference of the two.
  assert.ok(report.counters.watch_aim_verified <= report.counters.watch_aim_adopted);
  assert.equal(report.counters.watch_aim_dot, undefined, 'the dot is a mean, never summed');
  assert.equal(report.verdict, 'PASS');
});

test('a zero-adoption window does not weigh on the session dot', () => {
  // `LIES:_avg_sum` prints `watch_aim_dot=0` for a window that counted no
  // adoption. That 0 is an empty sentinel, not a sample: folding it in as one
  // would drag the session dot towards "looked at a wall". The contributing
  // window count is what makes the guard observable â€” deleting `adopted > 0`
  // turns this into 3.
  const aggregate = aggregateDigests([
    { fields: { watch_aim_adopted: '3', watch_aim_dot: '0.4' } },
    { fields: { watch_aim_adopted: '2', watch_aim_dot: '0.1' } },
    { fields: { watch_aim_adopted: '0', watch_aim_dot: '0' } }
  ]);

  assert.equal(aggregate.watch_aim_dot_windows, 2, 'only windows that counted an adoption contribute');
  // (0.4*3 + 0.1*2) / 5, unchanged by the empty window.
  assert.equal(aggregate.watch_aim_dot_avg, 0.28);
});

test('watch aim adopted is INFO when every adoption had the target visible', () => {
  // The feature fired (adoptions counted) but never while the target was
  // unseen: nothing in this run can be attributed to the watch position. Not a
  // failure, but it must not read as the PASS above.
  const log = [
    SETUP,
    header(),
    digest({ watch_aim_adopted: 4, watch_aim_cached: 1, watch_aim_verified: 4, watch_aim_dot: 0.8 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'visible_log.txt', modVersion: VERSION });
  const adopted = claimOf(report, 'watchaim');

  assert.equal(adopted.result, 'INFO');
  assert.match(adopted.evidence, /watch_aim_adopted=4/);
  assert.match(adopted.evidence, /watch_aim_verified=4/);
  assert.match(adopted.evidence, /adopted_while_unseen=0/);
  assert.match(adopted.evidence, /every adoption was made while the target was visible/);
  assert.match(adopted.evidence, /never while the target was unseen/);
  // INFO, so the run's verdict still comes from the other claims.
  assert.equal(report.verdict, 'PASS');
});

test('watch aim adopted is INFO when the position was computed but never adopted', () => {
  const log = [
    SETUP,
    header(),
    digest({ watch_aim_adopted: 0, watch_aim_cached: 0, watch_aim_verified: 0, watch_aim_dot: 0 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'no_adopt_log.txt', modVersion: VERSION });
  const adopted = claimOf(report, 'watchaim');

  assert.equal(adopted.result, 'INFO');
  assert.match(adopted.evidence, /watch_aim_adopted=0/);
  // The claim names what the counters show â€” no counted adoption â€” not why the
  // cop never adopted; a pre-8.57.29 log has no `watch_aim_*` field at all, and
  // that case is named separately below.
  assert.match(adopted.evidence, /no adoption of a watch position was counted/);
  // INFO, so the run's verdict still comes from the other claims.
  assert.equal(report.verdict, 'PASS');
});

test('watch aim adopted is INFO (not PASS) for a digest without the fields', () => {
  // Pre-8.57.29 builds write no watch_aim_* field: "cannot tell" must not read as
  // a clean pass, the same rule the near-visible probe claim follows.
  const log = [SETUP, header(), digest()].join('\n');
  const report = analyzeLog(log, { file: 'old_log.txt', modVersion: VERSION });
  const adopted = claimOf(report, 'watchaim');

  assert.equal(adopted.result, 'INFO');
  assert.match(adopted.evidence, /no watch_aim_\* fields/);
  assert.match(adopted.evidence, /pre-8\.57\.28/);
  assert.equal(report.verdict, 'PASS');
});

// 8.57.30: the settled sample is the "does the cop look like it pre-aims" figure.
// The adoption dot is always off-target because adoption starts the turn, so the
// report keeps the two numbers apart instead of re-judging the adoption claim.
test('settled facing passes once a measured follow-up sample was counted', () => {
  const log = [
    SETUP,
    header(),
    digest({
      watch_aim_adopted: 3,
      watch_aim_settled: 2,
      watch_aim_settled_square: 1,
      watch_aim_settled_dot: 0.6,
      watch_aim_settled_dot_n: 2
    }),
    digest({
      t: 120,
      watch_aim_adopted: 3,
      watch_aim_settled: 3,
      watch_aim_settled_square: 2,
      watch_aim_settled_dot: 0.3,
      watch_aim_settled_dot_n: 2
    })
  ].join('\n');
  const report = analyzeLog(log, { file: 'settled_log.txt', modVersion: VERSION });
  const settled = claimOf(report, 'settled');

  assert.equal(settled.claim, 'settled facing');
  assert.equal(settled.result, 'PASS');
  assert.match(settled.evidence, /watch_aim_settled=5/);
  // `measured` is the number of dots that could be measured, not the number of
  // samples: `square` shares that denominator, so the two cannot contradict.
  assert.match(settled.evidence, /measured=4/);
  assert.match(settled.evidence, /square=3\/4 \(75%\)/);
  // Weighted by each window's measured dots, not by its sample count:
  // (0.6*2 + 0.3*2) / 4 = 0.45, while sample weighting would give 0.42.
  assert.match(settled.evidence, /dot=0\.45/);
  assert.equal(report.counters.watch_aim_settled, 5);
  assert.equal(report.counters.watch_aim_settled_square, 3);
  assert.equal(report.counters.watch_aim_settled_dot_n, 4);
  assert.equal(report.counters.watch_aim_settled_dot, undefined, 'the dot is a mean, never summed');
  // Every subset is inside the adoption total, so the accounting claim holds.
  assert.equal(claimOf(report, 'aimaccount').result, 'PASS');
  // The adoption claim keeps its own rules.
  assert.equal(claimOf(report, 'watchaim').result, 'PASS');
  assert.equal(report.verdict, 'PASS');
});

test('settled facing is INFO when the digest has no settled field', () => {
  // Pre-8.57.30 builds write no watch_aim_settled* field: "cannot tell" must not
  // read as a clean pass, the same rule as the adoption and probe claims.
  const log = [SETUP, header(), digest({ watch_aim_adopted: 2, watch_aim_dot: 0.3 })].join('\n');
  const report = analyzeLog(log, { file: 'pre_settled.txt', modVersion: VERSION });
  const settled = claimOf(report, 'settled');

  assert.equal(settled.result, 'INFO');
  assert.match(settled.evidence, /no watch_aim_settled\* fields/);
  assert.match(settled.evidence, /pre-8\.57\.30/);
  assert.equal(report.verdict, 'PASS');
});

test('settled facing is INFO when the field is present but zero', () => {
  const log = [
    SETUP,
    header(),
    digest({
      watch_aim_settled: 0,
      watch_aim_settled_square: 0,
      watch_aim_settled_dot: 0
    })
  ].join('\n');
  const report = analyzeLog(log, { file: 'no_settled.txt', modVersion: VERSION });
  const settled = claimOf(report, 'settled');

  assert.equal(settled.result, 'INFO');
  assert.match(settled.evidence, /watch_aim_settled=0/);
  assert.match(settled.evidence, /square=0\/0 \(n\/a\)/);
  // No dot was measured, so the figure is not invented as 0.
  assert.match(settled.evidence, /dot=n\/a/);
  assert.match(settled.evidence, /no settled sample with a measurable facing was counted/);
  // A zero-settled window does not weigh on the settled mean.
  assert.equal(report.verdict, 'PASS');
});

test('a settled sample with no measurable facing is counted but prints dot=n/a', () => {
  // The follow-up ran (two samples) and neither could measure a facing: the
  // sample counter is real evidence, but the facing claim must not PASS on it,
  // and the dot must read `n/a` instead of a fabricated 0.
  const log = [
    SETUP,
    header(),
    digest({
      watch_aim_adopted: 2,
      watch_aim_settled: 2,
      watch_aim_settled_square: 0,
      watch_aim_settled_dot: 0,
      watch_aim_settled_dot_n: 0
    })
  ].join('\n');
  const report = analyzeLog(log, { file: 'no_dot.txt', modVersion: VERSION });
  const settled = claimOf(report, 'settled');

  assert.equal(settled.result, 'INFO', 'samples alone cannot PASS a facing claim');
  assert.match(settled.evidence, /watch_aim_settled=2, measured=0/);
  assert.match(settled.evidence, /square=0\/0 \(n\/a\)/);
  assert.match(settled.evidence, /dot=n\/a/);
  assert.doesNotMatch(settled.evidence, /dot=0\b/);
  // The samples are still inside the adoption total, so the bookkeeping holds.
  assert.equal(claimOf(report, 'aimaccount').result, 'PASS');
  assert.equal(report.verdict, 'PASS');
});

test('a run whose cops all settled facing away is visibly not a success', () => {
  // PASS is about the measurement; the headline is the result. `square=0/4 (0%)`
  // is what keeps a fully failed pre-aim from reading like a win.
  const log = [
    SETUP,
    header(),
    digest({
      watch_aim_adopted: 4,
      watch_aim_settled: 4,
      watch_aim_settled_square: 0,
      watch_aim_settled_dot: -0.2,
      watch_aim_settled_dot_n: 4
    })
  ].join('\n');
  const report = analyzeLog(log, { file: 'facing_away.txt', modVersion: VERSION });
  const settled = claimOf(report, 'settled');

  assert.equal(settled.result, 'PASS');
  assert.match(settled.evidence, /square=0\/4 \(0%\)/);
  assert.match(settled.evidence, /dot=-0\.2/);
});

test('settled samples above the adoption total fail the accounting claim, not the facing one', () => {
  // Impossible in the Lua (a sample is consumed at most once per pending
  // adoption), so it means the two counter groups came from different states.
  const log = [
    SETUP,
    header(),
    digest({
      watch_aim_adopted: 2,
      watch_aim_settled: 3,
      watch_aim_settled_square: 2,
      watch_aim_settled_dot: 0.5,
      watch_aim_settled_dot_n: 3
    })
  ].join('\n');
  const report = analyzeLog(log, { file: 'mismatch.txt', modVersion: VERSION });
  const accounting = claimOf(report, 'aimaccount');

  assert.equal(accounting.claim, 'aim accounting');
  assert.equal(accounting.result, 'FAIL');
  assert.match(accounting.evidence, /impossible state, 3 settled samples from 2 adoptions/);
  // The facing itself is not in question: the settled claim still judges it.
  assert.equal(claimOf(report, 'settled').result, 'PASS');
  assert.equal(report.verdict, 'FAIL');
});

test('a zero-settled window does not weigh on the settled mean', () => {
  const aggregate = aggregateDigests([
    { fields: { watch_aim_settled: '2', watch_aim_settled_dot: '0.6' } },
    { fields: { watch_aim_settled: '0', watch_aim_settled_dot: '0' } }
  ]);

  assert.equal(aggregate.watch_aim_settled_dot_windows, 1, 'only windows that counted a sample contribute');
  assert.equal(aggregate.watch_aim_settled_dot_avg, 0.6);
});

test('the settled mean weights each window by its measured dots, not its samples', () => {
  // One measured dot out of two samples in the first window, four out of five in
  // the second: (1*1 + 0*4) / 5 = 0.2. Weighting by `watch_aim_settled` would
  // give (1*2 + 0*5) / 7 = 0.29, i.e. the unmeasured samples would decide the
  // answer.
  const aggregate = aggregateDigests([
    { fields: { watch_aim_settled: '2', watch_aim_settled_dot_n: '1', watch_aim_settled_dot: '1' } },
    { fields: { watch_aim_settled: '5', watch_aim_settled_dot_n: '4', watch_aim_settled_dot: '0' } }
  ]);

  assert.equal(aggregate.watch_aim_settled_dot_avg, 0.2);
  assert.equal(aggregate.watch_aim_settled_dot_windows, 2);
});

test('the adoption mean weights each window by its measured dots too', () => {
  const aggregate = aggregateDigests([
    { fields: { watch_aim_adopted: '2', watch_aim_dot_n: '1', watch_aim_dot: '1' } },
    { fields: { watch_aim_adopted: '5', watch_aim_dot_n: '4', watch_aim_dot: '0' } }
  ]);

  // (1*1 + 0*4) / 5 = 0.2; weighting by `watch_aim_adopted` would give 2/7.
  assert.equal(aggregate.watch_aim_dot_avg, 0.2);

  // And the evidence prints `n/a`, not 0, when no adoption had a measurable
  // facing at all.
  const log = [
    SETUP,
    header(),
    digest({ watch_aim_adopted: 2, watch_aim_dot: 0, watch_aim_dot_n: 0 })
  ].join('\n');
  const report = analyzeLog(log, { file: 'no_adopt_dot.txt', modVersion: VERSION });

  assert.match(claimOf(report, 'watchaim').evidence, /before_dot=n\/a/);
  assert.equal(claimOf(report, 'watchaim').result, 'PASS');
});


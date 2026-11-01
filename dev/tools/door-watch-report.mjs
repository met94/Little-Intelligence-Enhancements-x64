#!/usr/bin/env node
// Adjudicate a LIES test play from a SuperBLT log.
//
// The door watch restored in V8.79 is only "working" if a log says it ran, so
// this turns the [LIES-WATCH] digest, the door_watch trace phase and the
// fsd_*/react_* counters into PASS/FAIL claims. Design and the counter ->
// claim mapping: dev/reports/door-watch-port.md.
//
// Usage:
//   node dev/tools/door-watch-report.mjs <log...> [--ab <control-log>] [--mod DIR]
//                                        [--session last|all|<n>]
//                                        [--json out.json] [--out out.md]
//
// A SuperBLT log file can hold more than one play (the header is written at
// each level load), so the report reads one game session by default instead of
// every `evt=digest` in the file: a control play (High Performance Mode on) in
// the same file would otherwise contaminate the armed play's verdict. A session
// starts at each `[LIES-WATCH] evt=header` line; the header also repeats after a
// level change, which splits the play into one segment per level — a new segment
// with its own digest windows, which is what we want. Lines before the first
// header are a pre-session segment and only feed the "mod loaded" claim. A log
// with no header at all (watch_log off) is one session holding everything, and
// the verdict stays INCOMPLETE.
//
// `--session last` (default) reads the highest-numbered session, `all` merges
// every session (counters summed, the last header wins, the report says how many
// were merged), `<n>` reads the 1-based session `n`. `--ab` applies the same
// selection to the control log.
//
// Exit codes: 0 PASS, 1 FAIL, 2 INCOMPLETE (the run cannot prove the feature:
// no header, or the header shows it disarmed), 3 usage error (unknown flag,
// missing/unreadable log, session index out of range).
//
// Digest counters are per-window DELTAS (`menumanager.lua` `WatchDigest`), so
// every counter below is summed across digests before it is judged.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanLog } from './log-scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USAGE = 'Usage: node dev/tools/door-watch-report.mjs <log...> [--ab <control-log>] [--mod DIR] [--session last|all|<n>] [--json out.json] [--out out.md]';

// What the six outcome counters are, and what a "sub-event" is. Every call to
// `lies_upd_expected_pos` increments exactly one outcome (menumanager.lua
// `dw_gap`); everything else is instrumentation.
const DW_OUTCOMES = [
  'dw_gate_off',
  'dw_stale_bail',
  'dw_outer_gate_skip',
  'dw_no_my_tracker',
  'dw_hit',
  'dw_none'
];
// The three counters that end a call before any watch work. `dw_stale_bail`
// comes first in the helper by design: the enemy-tracker liveness check runs
// before the `door_watch`/`highperformance` gate, because vanilla dereferences a
// freed tracker unguarded. A correctly disarmed run therefore splits its calls
// between `dw_stale_bail` and `dw_gate_off`, plus `dw_no_my_tracker` when the
// cop's own tracker is nil just under the gate, so "gate respected" cannot be
// judged on `dw_gate_off` alone.
const DW_TERMINATIONS = ['dw_gate_off', 'dw_stale_bail', 'dw_no_my_tracker'];
// Anything that proves the feature actually did work. A disarmed run must show
// every one of these at zero, together with the terminations summing to
// `dw_call`: no work, and no call unaccounted for.
const DW_WORK_COUNTERS = [
  'dw_raw_hit',
  'dw_expected_pos_hit',
  'dw_path_prestep',
  'dw_path_prestep_hit',
  'dw_hit',
  'dw_ray',
  'dw_cached_reuse',
  'dw_cached_unsighted',
  'dw_height_skip',
  'dw_seg_same',
  'dw_path_kick',
  'dw_vanilla_call',
  'dw_none',
  'dw_outer_gate_skip',
  'dw_cadence_skip',
  'dw_advancing_skip'
];
// Every counter that proves a watch position was actually produced.
// `dw_path_prestep` is deliberately NOT here: it increments before
// `_get_expected_pos` runs, so it proves the attempt, not a position.
// `dw_path_prestep_hit` is: it counts the pre-step returning a position inside
// the cadence window, which is a position the run really produced.
const POSITION_COUNTERS = ['dw_raw_hit', 'dw_expected_pos_hit', 'dw_path_prestep_hit'];

const HARD_ALARMS = ['door_outcome_gap', 'door_contract_violation'];

// Digest fields that are gauges/averages/settings rather than per-window
// deltas. Summing them would be meaningless (`dw_us` is a mean, `cache_len` a
// high-water mark, `react_level` a setting).
const NON_COUNTER_FIELDS = new Set([
  't',
  'level',
  'react_level',
  'cache_len',
  'cache_keys',
  'cache_scan_n',
  'cache_scan_us',
  'engine_us',
  'cover_id_age_ms',
  'cover_id_age_max_ms',
  'cache_hits0',
  'cache_hits1',
  'cache_hits2_7',
  'cache_hits8p',
  'dw_us',
  'dw_us_max'
]);

const WATCH_RE = /\[LIES-WATCH\]\s+v=(\S+)\s+evt=(\S+)\s*(.*)$/;
const TRACE_RE = /\[LIES-TRACE\]\s+(.*)$/;
const EVENT_RE = /\[LIES-EVENT\]\s+(.*)$/;

function parseFields(text) {
  const fields = {};

  for (const token of String(text || '').trim().split(/\s+/)) {
    if (!token) continue;
    const eq = token.indexOf('=');

    if (eq <= 0) continue;
    fields[token.slice(0, eq)] = token.slice(eq + 1);
  }

  return fields;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function counter(counters, key) {
  return Number.isFinite(counters[key]) ? counters[key] : 0;
}

// `menumanager.lua` writes the header switches with `tostring(boolean)`, i.e.
// `true`/`false`, while the menu stores `on`/`off` strings. Both spellings (and
// 1/0) mean the same thing, so normalise before any comparison — otherwise
// every `=== 'off'` test is false and a run with the feature off can never
// prove a thing.
function switchState(value) {
  const text = String(value ?? '').trim().toLowerCase();

  if (text === 'true' || text === 'on' || text === '1') return 'on';
  if (text === 'false' || text === 'off' || text === '0') return 'off';

  return 'unknown';
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// A SuperBLT log file can hold several plays, so a `[LIES-WATCH] evt=header`
// line is the only reliable session boundary: `menumanager.lua` writes it when
// the level loads (and repeats it after a level change, which splits the play
// into one segment per level — a new segment with its own digest windows).
// Lines before the first header form a pre-session segment: they hold the
// `Setting up mod 'LIES'` line and nothing this tool judges, so only the "mod
// loaded" claim reads them.
function buildSessions({ lineCount, watch, traces, events }) {
  const headers = watch.filter(entry => entry.event === 'header');
  const within = (list, start, end) => list.filter(entry => entry.line >= start && entry.line <= end);
  const make = (index, total, header, start, end) => {
    const picked = within(watch, start, end);

    return {
      index,
      total,
      header,
      header_line: header ? header.line : null,
      start_line: start,
      end_line: end === Infinity ? lineCount : end,
      watch: picked,
      digests: picked.filter(entry => entry.event === 'digest'),
      alarms: picked.filter(entry => entry.event === 'alarm'),
      alarm_budget_exhausted: picked.filter(entry => entry.event === 'alarm_budget_exhausted').length,
      first: picked.find(entry => entry.event === 'door_watch_first') || null,
      traces: within(traces, start, end),
      events: within(events, start, end)
    };
  };

  if (!headers.length) {
    // `watch_log` off: no header, and no digest either. Everything is one
    // session so the verdict stays INCOMPLETE with the "enable the digest" hint,
    // exactly as before sessions existed.
    return [make(1, 1, null, 1, Infinity)];
  }

  return headers.map((header, i) => make(
    i + 1,
    headers.length,
    header,
    header.line,
    i + 1 < headers.length ? headers[i + 1].line - 1 : Infinity
  ));
}

// Parse one log (or several concatenated) into the shapes the claims need.
export function parseLog(text, { file = '' } = {}) {
  const lines = String(text || '').split(/\r?\n/);
  const setup = [];
  const watch = [];
  const traces = [];
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/Setting up mod 'LIES'\s*$/.test(line)) {
      setup.push({ line: i + 1, text: line.trim() });
    }

    const watchMatch = WATCH_RE.exec(line);

    if (watchMatch) {
      watch.push({
        line: i + 1,
        version: watchMatch[1],
        event: watchMatch[2],
        fields: parseFields(watchMatch[3])
      });
      continue;
    }

    const traceMatch = TRACE_RE.exec(line);

    if (traceMatch) {
      traces.push({ line: i + 1, fields: parseFields(traceMatch[1]) });
      continue;
    }

    const eventMatch = EVENT_RE.exec(line);

    if (eventMatch) {
      events.push({ line: i + 1, fields: parseFields(eventMatch[1]) });
    }
  }

  return {
    file,
    lines: lines.length,
    setup,
    watch,
    digests: watch.filter(entry => entry.event === 'digest'),
    header: watch.find(entry => entry.event === 'header') || null,
    alarms: watch.filter(entry => entry.event === 'alarm'),
    alarmBudgetExhausted: watch.filter(entry => entry.event === 'alarm_budget_exhausted').length,
    first: watch.find(entry => entry.event === 'door_watch_first') || null,
    sessions: buildSessions({ lineCount: lines.length, watch, traces, events }),
    traces,
    events,
    version: (watch.find(entry => entry.event === 'header') || {}).version
      || (watch.length ? watch[0].version : '')
      || (traces.length ? traces[0].fields.v : '')
      || ''
  };
}

// Bad `--session` value or index: a usage error (exit 3), not a bad play.
export class SessionRangeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SessionRangeError';
  }
}

function sessionMode(selector) {
  const text = String(selector ?? 'last').trim().toLowerCase();

  if (text === 'last' || text === 'all') return text;
  if (/^\d+$/.test(text)) return Number(text);

  throw new SessionRangeError(`--session expects last, all or a 1-based index (got "${selector}")`);
}

// Which sessions of one parsed log the report reads. `last` is the default and
// is the whole point of the flag: the newest launch in the file, not every
// launch the file happens to hold.
export function selectSessions(parsed, selector = 'last') {
  const mode = sessionMode(selector);
  const total = parsed.sessions.length;

  if (mode === 'all') {
    return { mode, total, sessions: parsed.sessions.slice() };
  }

  const index = mode === 'last' ? total : mode;

  if (index < 1 || index > total) {
    throw new SessionRangeError(
      `--session ${index} is out of range: ${parsed.file || 'the log'} has ${total} session(s)`
    );
  }

  return { mode, index, total, sessions: [parsed.sessions[index - 1]] };
}

// Short "which sessions" label for the report, the CLI summary and the control.
export function describeSession(info) {
  if (info.count === 1 && info.selected.length === 1) {
    const only = info.selected[0];
    const index = only.indexes[0];

    if (only.header_lines[0] === null) {
      return `${index} of ${only.total} (no watch header: the whole log is one session)`;
    }

    return `${index} of ${only.total} (header at line ${only.header_lines[0]})`;
  }

  if (info.selected.length === 1) {
    const only = info.selected[0];
    const lines = only.header_lines.filter(line => line !== null);

    return `all (merged ${only.indexes.length} of ${only.total} sessions; ` +
      `header${lines.length === 1 ? '' : 's'} at ${lines.join(', ') || 'none'})`;
  }

  // Several logs, each with its own session numbering.
  return info.selected
    .map(entry => `${path.basename(entry.file || 'log')}: ${entry.indexes.join('+')} of ${entry.total}`)
    .join('; ') + ` (merged ${info.count} sessions)`;
}

// Sum the per-window deltas across digests; keep the gauges as gauges.
export function aggregateDigests(digests) {
  const counters = {};
  const dwUsValues = [];
  let dwUsMax = 0;

  for (const digest of digests) {
    for (const [key, raw] of Object.entries(digest.fields)) {
      const value = num(raw);

      if (value === null) continue;
      if (key === 'dw_us_max') {
        dwUsMax = Math.max(dwUsMax, value);
        continue;
      }
      if (key === 'dw_us') {
        // The digest averages only the windows that timed at least one call.
        if (value > 0) dwUsValues.push(value);
        continue;
      }
      if (NON_COUNTER_FIELDS.has(key)) continue;

      counters[key] = counter(counters, key) + value;
    }
  }

  return {
    counters,
    dw_us_avg: mean(dwUsValues),
    dw_us_max: dwUsMax,
    dw_us_windows: dwUsValues.length,
    windows: digests.length
  };
}

// One digest per minute window (`WatchTick` fires every 60 s; the first window
// starts at level load, so a rate computed this way is a mild upper bound).
function perMinute(total, windows) {
  return windows > 0 ? total / windows : 0;
}

function costFigures(aggregate) {
  const counters = aggregate.counters;

  return {
    windows: aggregate.windows,
    dw_call: counter(counters, 'dw_call'),
    dw_us_avg: round(aggregate.dw_us_avg, 2),
    dw_us_max: round(aggregate.dw_us_max, 0),
    dw_ray: counter(counters, 'dw_ray'),
    dw_ray_per_min: round(perMinute(counter(counters, 'dw_ray'), aggregate.windows), 2)
  };
}

function formatGaps(digests) {
  const rows = [];

  for (const digest of digests) {
    const gap = num(digest.fields.dw_gap);

    if (gap === null || gap === 0) continue;
    rows.push(`t=${digest.fields.t ?? '?'} gap=${gap} call=${digest.fields.dw_call ?? '?'}`);
  }

  return rows.length ? rows.join(', ') : 'none';
}

function listCounters(counters, keys) {
  return keys
    .filter(key => counter(counters, key) !== 0)
    .map(key => `${key}=${counter(counters, key)}`)
    .join(' ');
}

// Turn a parsed log into the claim table. `modVersion` is the `mod.txt` version
// of the build under test; `controlText` is another analysed log for `--ab`;
// `session` picks the game session(s) of every input log (`last`/`all`/`<n>`).
export function analyzeLog(text, {
  file = '',
  otherFiles = [],
  modVersion = null,
  modDir = '',
  controlText = null,
  controlFile = '',
  session = 'last'
} = {}) {
  const logs = [{ file, text }, ...otherFiles];
  const parsedLogs = logs.map(log => parseLog(log.text, { file: log.file }));
  const selections = parsedLogs.map(parsed => selectSessions(parsed, session));
  const chosen = selections.flatMap(selection => selection.sessions);

  // The selected sessions are adjudicated as one play: counters add up, and the
  // last header wins (it is the newest launch's settings). The `Setting up mod`
  // lines are collected log-wide, because a later launch's setup line sits
  // before that launch's header, i.e. outside its own session segment.
  const parsed = {
    file,
    setup: parsedLogs.flatMap(entry => entry.setup),
    watch: chosen.flatMap(entry => entry.watch),
    traces: chosen.flatMap(entry => entry.traces),
    events: chosen.flatMap(entry => entry.events)
  };

  parsed.digests = parsed.watch.filter(entry => entry.event === 'digest');
  parsed.header = [...chosen].reverse().map(entry => entry.header).find(Boolean) || null;
  parsed.alarms = parsed.watch.filter(entry => entry.event === 'alarm');
  parsed.alarmBudgetExhausted = chosen.reduce((sum, entry) => sum + entry.alarm_budget_exhausted, 0);
  parsed.first = parsed.watch.find(entry => entry.event === 'door_watch_first') || null;
  parsed.version = (parsed.header && parsed.header.version)
    || (parsed.watch.length ? parsed.watch[0].version : '')
    || (parsed.traces.length ? parsed.traces[0].fields.v : '')
    || '';

  const sessionInfo = {
    requested: String(session ?? 'last'),
    mode: selections[0].mode === 'all' ? 'all' : (selections[0].mode === 'last' ? 'last' : 'index'),
    count: chosen.length,
    merged: chosen.length > 1,
    total: parsedLogs[0].sessions.length,
    index: chosen.length === 1 ? chosen[0].index : null,
    header_line: chosen.length === 1 ? chosen[0].header_line : null,
    selected: selections.map((selection, index) => ({
      file: parsedLogs[index].file,
      total: selection.total,
      indexes: selection.sessions.map(entry => entry.index),
      header_lines: selection.sessions.map(entry => entry.header_line)
    }))
  };

  const aggregate = aggregateDigests(parsed.digests);
  const counters = aggregate.counters;
  const header = parsed.header ? parsed.header.fields : null;
  const doorWatchRaw = header ? header.door_watch ?? 'unknown' : 'unknown';
  const highPerformanceRaw = header ? header.highperformance ?? 'unknown' : 'unknown';
  const doorWatch = switchState(doorWatchRaw);
  const highPerformance = switchState(highPerformanceRaw);
  const armed = doorWatch === 'on' && highPerformance === 'off';
  const rawSpelling = doorWatchRaw === doorWatch && highPerformanceRaw === highPerformance
    ? ''
    : ` (log spells it door_watch=${doorWatchRaw} highperformance=${highPerformanceRaw})`;
  const digestLevel = [...parsed.digests].reverse()
    .map(digest => num(digest.fields.react_level))
    .find(value => value !== null);
  const reactLevel = num(header && header.enemy_reaction_level) ?? digestLevel ?? null;

  // Same rules as dev/tools/log-scan.mjs, reusing its exported scanner so the
  // fatal/Lua-error definitions cannot drift between the two tools.
  const modTxt = readModTxt(modDir);
  const hookFiles = modTxt && Array.isArray(modTxt.hooks) ? modTxt.hooks.map(hook => hook.hook_id) : [];
  const scan = { setup: [], harness: [], harnessErrors: [], fatal: [], luaErrors: [], liesErrors: [], ok: true };

  for (const log of logs) {
    const found = scanLog(log.text, { file: log.file, hookFiles });

    for (const key of Object.keys(scan)) {
      if (!Array.isArray(scan[key])) continue;
      scan[key] = scan[key].concat(found[key] || []);
    }
    scan.ok = scan.ok && found.ok;
  }

  const traceDoors = parsed.traces.filter(trace => trace.fields.phase === 'door_watch');
  const traceSources = {};

  for (const trace of traceDoors) {
    const src = trace.fields.src || '?';

    traceSources[src] = (traceSources[src] || 0) + 1;
  }

  const reactionHolds = parsed.events.filter(event => event.fields.kind === 'reaction_hold');
  const claims = [];
  const claim = (id, name, result, evidence) => claims.push({ id, claim: name, result, evidence });

  // --- mod loaded ---------------------------------------------------------
  claim(
    'loaded',
    'mod loaded',
    parsed.setup.length ? 'PASS' : 'FAIL',
    parsed.setup.length
      ? parsed.setup.map(entry => `line ${entry.line}: ${entry.text}`).join('; ')
      : "no \"Setting up mod 'LIES'\" line: the mod did not load (or another mod aborted the loader)"
  );

  // --- version ------------------------------------------------------------
  if (!parsed.version) {
    claim('version', 'version', 'INFO', 'no version field in the log (no watch header and no [LIES-TRACE] lines)');
  } else if (!modVersion) {
    claim('version', 'version', 'INFO', `log says ${parsed.version}; mod.txt was not found (--mod)`);
  } else {
    claim(
      'version',
      'version',
      parsed.version === modVersion ? 'PASS' : 'FAIL',
      `log ${parsed.version} vs mod.txt ${modVersion}`
    );
  }

  // --- door watch enabled -------------------------------------------------
  if (!header) {
    claim('enabled', 'door watch enabled', 'INFO', 'unknown: no watch header');
  } else {
    claim(
      'enabled',
      'door watch enabled',
      'INFO',
      `door_watch=${doorWatch} highperformance=${highPerformance}` +
        (doorWatch === 'on' && highPerformance === 'on'
          ? ' (honoured OFF while High Performance Mode is on)'
          : '') +
        rawSpelling
    );
  }

  // --- watch positions produced ------------------------------------------
  const produced = POSITION_COUNTERS.reduce((sum, key) => sum + counter(counters, key), 0);
  const producedDetail = POSITION_COUNTERS.map(key => `${key}=${counter(counters, key)}`).join(' ');

  if (!header || !parsed.digests.length) {
    claim('positions', 'watch positions produced', 'INFO', `no digest: ${producedDetail}`);
  } else if (armed) {
    claim(
      'positions',
      'watch positions produced',
      produced > 0 ? 'PASS' : 'FAIL',
      produced > 0
        ? `${producedDetail} (sum ${produced})`
        : `${producedDetail} (sum 0): no call reached the door branch. Check that cops lost sight of a target across a nav segment on a map with nav-link doors`
    );
  } else {
    claim('positions', 'watch positions produced', 'INFO', `not applicable: door_watch=${doorWatch} highperformance=${highPerformance}`);
  }

  // The pre-step is a separate INFO claim: `dw_path_prestep` counts armed
  // `expected_pos_path` frames inside the cadence window (an attempt), while the
  // position it sometimes produces is judged in `positions` through
  // `dw_path_prestep_hit`.
  claim(
    'prestep',
    'door pre-step',
    'INFO',
    `dw_path_prestep=${counter(counters, 'dw_path_prestep')} ` +
      `dw_path_prestep_hit=${counter(counters, 'dw_path_prestep_hit')}: cadence-window frames with an armed coarse path; ` +
      `the attempt counter runs before _get_expected_pos, the hit counter proves a position came out`
  );

  // --- gate respected -----------------------------------------------------
  const workTotal = DW_WORK_COUNTERS.reduce((sum, key) => sum + counter(counters, key), 0);
  const workDetail = listCounters(counters, DW_WORK_COUNTERS) || 'all zero';
  const calls = counter(counters, 'dw_call');
  const staleBail = counter(counters, 'dw_stale_bail');

  if (!header || !parsed.digests.length) {
    claim('gate', 'gate respected', 'INFO', `no digest: ${workDetail}`);
  } else if (highPerformance === 'on' || doorWatch === 'off') {
    const terminationDetail = DW_TERMINATIONS
      .map(key => `${key}=${counter(counters, key)}`)
      .join(' ');
    const terminated = DW_TERMINATIONS.reduce((sum, key) => sum + counter(counters, key), 0);
    const share = calls > 0 ? `${round((staleBail / calls) * 100, 1)}%` : 'n/a (no calls)';
    const ok = terminated === calls && workTotal === 0;
    const reasons = [];

    if (terminated !== calls) reasons.push(`${terminated} of ${calls} calls ended in a termination counter`);
    if (workTotal !== 0) reasons.push(`work counters ran while the feature was off: ${workDetail}`);

    claim(
      'gate',
      'gate respected',
      ok ? 'PASS' : 'FAIL',
      `dw_call=${calls} ${terminationDetail} (sum ${terminated} vs dw_call ${calls}), ` +
        `stale-bail share ${share}; work counters ${workDetail}` +
        (ok ? '' : `: ${reasons.join('; ')}`)
    );
  } else {
    claim('gate', 'gate respected', 'INFO', 'not applicable: the feature is armed');
  }

  // --- outcome accounting -------------------------------------------------
  const gaps = parsed.digests
    .map(digest => num(digest.fields.dw_gap))
    .filter(value => value !== null);

  if (!gaps.length) {
    claim('gaps', 'outcome accounting', 'INFO', 'no dw_gap field in any digest (pre-V8.79 log?)');
  } else {
    const gapSum = gaps.reduce((sum, value) => sum + value, 0);

    claim(
      'gaps',
      'outcome accounting',
      gapSum === 0 ? 'PASS' : 'FAIL',
      gapSum === 0
        ? `dw_gap sum 0 over ${gaps.length} window(s) (call=${counter(counters, 'dw_call')})`
        : `dw_gap sum ${gapSum} over ${gaps.length} window(s): ${formatGaps(parsed.digests)}`
    );
  }

  // --- tracker safety -----------------------------------------------------
  const errors = scan.fatal.length + scan.liesErrors.length;

  claim(
    'tracker',
    'tracker safety',
    errors === 0 ? 'PASS' : 'FAIL',
    `dw_stale_bail=${staleBail} (informational: the guard refused a freed tracker)` +
      (errors === 0
        ? `; 0 FATAL, 0 LIES-attributable Lua error${scan.luaErrors.length ? ` (${scan.luaErrors.length} unrelated Lua error line(s))` : ''}`
        : `; ${scan.fatal.length} FATAL, ${scan.liesErrors.length} LIES-attributable Lua error(s)`)
  );

  // --- tracker bails ------------------------------------------------------
  // Always printed, armed runs included: an enemy dying between the attention
  // update and the door branch legitimately trips the liveness guard, so a
  // non-zero share is expected. A share near 100 % would mean the guard is
  // misclassifying live enemies as stale — worth a look, never a failure.
  claim(
    'bails',
    'tracker bails',
    'INFO',
    `dw_stale_bail=${staleBail} of dw_call=${calls} ` +
      `(${calls > 0 ? `${round((staleBail / calls) * 100, 1)}%` : 'n/a: no calls'}): ` +
      `the liveness guard runs before the feature gate, so a disarmed run and an enemy that died both land here; ` +
      `a share near 100 % means the guard is misclassifying live trackers`
  );

  // --- nav-link doors -----------------------------------------------------
  claim(
    'navlink',
    'nav-link doors',
    'INFO',
    [
      `fsd_navlink_seg_ok=${counter(counters, 'fsd_navlink_seg_ok')}`,
      `fsd_navlink_seg_mismatch=${counter(counters, 'fsd_navlink_seg_mismatch')}`,
      `fsd_nil_element=${counter(counters, 'fsd_nil_element')}`,
      `fsd_nil_tracker=${counter(counters, 'fsd_nil_tracker')}`,
      `fsd_raw=${counter(counters, 'fsd_raw')}`
    ].join(' ') + ' (a map with no nav-link doors legitimately shows 0)'
  );

  // --- contract -----------------------------------------------------------
  const badShape = counter(counters, 'fsd_bad_shape');

  if (!parsed.digests.length) {
    claim('contract', 'contract', 'INFO', 'no digest: fsd_bad_shape not reported');
  } else {
    claim(
      'contract',
      'contract',
      badShape === 0 ? 'PASS' : 'FAIL',
      badShape === 0
        ? 'fsd_bad_shape=0: every door handed to a caller was a Vector3'
        : `fsd_bad_shape=${badShape}: a non-Vector3 reached a caller (mvec3_set/distance)`
    );
  }

  // --- cost ---------------------------------------------------------------
  // `--ab` reads the same session(s) as the log under test: a control file that
  // holds both an armed launch and a High Performance one would otherwise
  // compare against the wrong window.
  const cost = costFigures(aggregate);
  const controlParsed = controlText ? parseLog(controlText, { file: controlFile }) : null;
  const controlSelection = controlParsed ? selectSessions(controlParsed, session) : null;
  const controlDigests = controlSelection ? controlSelection.sessions.flatMap(entry => entry.digests) : [];
  const controlCost = controlParsed ? costFigures(aggregateDigests(controlDigests)) : null;
  const controlSession = controlSelection
    ? `; control session ${controlSelection.mode === 'all'
      ? `all (merged ${controlSelection.sessions.length} of ${controlSelection.total})`
      : `${controlSelection.sessions[0].index} of ${controlSelection.total}`}`
    : '';
  const controlUsable = !controlCost || controlCost.windows > 0;

  if (!parsed.digests.length) {
    claim('cost', 'cost', 'INFO', 'no digest: no dw_us/dw_ray figures');
  } else if (!controlUsable) {
    claim(
      'cost',
      'cost',
      'INFO',
      `dw_us avg ${cost.dw_us_avg} us, dw_us_max ${cost.dw_us_max} us, dw_ray ${cost.dw_ray} (${cost.dw_ray_per_min}/min) ` +
        `over ${cost.windows} minute window(s), dw_call=${cost.dw_call}; control unusable: ` +
        `no digest window in \`${controlFile}\` (watch_log off?), so no delta is printed${controlSession}`
    );
  } else {
    const usDelta = controlCost ? round(cost.dw_us_avg - controlCost.dw_us_avg, 2) : null;
    const rayDelta = controlCost ? round(cost.dw_ray_per_min - controlCost.dw_ray_per_min, 2) : null;
    const sign = value => (value >= 0 ? `+${value}` : `${value}`);
    const delta = controlCost
      ? `; control dw_us avg ${controlCost.dw_us_avg} us (${sign(usDelta)} us), ` +
        `dw_us_max ${controlCost.dw_us_max} us, dw_ray ${controlCost.dw_ray} (${controlCost.dw_ray_per_min}/min)` +
        `; delta dw_ray/min ${sign(rayDelta)}${controlSession}`
      : '';

    claim(
      'cost',
      'cost',
      'INFO',
      `dw_us avg ${cost.dw_us_avg} us, dw_us_max ${cost.dw_us_max} us, dw_ray ${cost.dw_ray} (${cost.dw_ray_per_min}/min) ` +
        `over ${cost.windows} minute window(s), dw_call=${cost.dw_call}${delta}`
    );
  }

  // --- reaction level -----------------------------------------------------
  const holds = counter(counters, 'react_hold');

  if (reactLevel === null || !parsed.digests.length) {
    claim('reaction', 'reaction level', 'INFO', `react_level unknown, react_hold=${holds}`);
  } else if (reactLevel < 3) {
    claim(
      'reaction',
      'reaction level',
      holds > 0 ? 'PASS' : 'FAIL',
      `react_level=${reactLevel} (<3), react_hold=${holds}, react_allow=${counter(counters, 'react_allow')}` +
        (holds > 0 ? '' : ': no hold counted; check that cops acquired targets during the run')
    );
  } else {
    claim(
      'reaction',
      'reaction level',
      holds === 0 ? 'PASS' : 'FAIL',
      `react_level=${reactLevel} (>=3), react_hold=${holds}, react_allow=${counter(counters, 'react_allow')}`
    );
  }

  // --- alarms -------------------------------------------------------------
  const alarmCounts = {};
  const alarmDetail = [];

  for (const alarm of parsed.alarms) {
    alarmCounts[alarm.fields.name || '?'] = (alarmCounts[alarm.fields.name || '?'] || 0) + 1;
  }

  for (const [name, count] of Object.entries(alarmCounts)) {
    alarmDetail.push(count > 1 ? `${name} x${count}` : name);
  }

  const hard = HARD_ALARMS.filter(name => alarmCounts[name]);

  claim(
    'alarms',
    'alarms',
    hard.length ? 'FAIL' : 'PASS',
    (alarmDetail.length ? alarmDetail.join(' ') : 'none') +
      (parsed.alarmBudgetExhausted ? `; budget exhausted after ${parsed.alarmBudgetExhausted} event(s)` : '') +
      (hard.length ? `: ${hard.join(', ')} means a door outcome or contract failure` : '')
  );

  // --- crash-free ---------------------------------------------------------
  claim(
    'crash',
    'crash-free',
    scan.fatal.length === 0 && scan.liesErrors.length === 0 ? 'PASS' : 'FAIL',
    scan.fatal.length === 0 && scan.liesErrors.length === 0
      ? `0 FATAL, 0 LIES-attributable Lua error (${scan.luaErrors.length} unrelated Lua error line(s))`
      : [
          ...scan.fatal.map(entry => `FATAL line ${entry.line}`),
          ...scan.liesErrors.map(entry => `LIES error line ${entry.line}: ${entry.text}`)
        ].join('; ')
  );

  const hasFail = claims.some(entry => entry.result === 'FAIL');
  // A disarmed run cannot prove the feature, so it is INCOMPLETE even when the
  // checks it can make (the gate above all) pass. A hard failure still wins.
  const verdict = hasFail ? 'FAIL' : (armed ? 'PASS' : 'INCOMPLETE');
  const verdictReason = hasFail || armed
    ? ''
    : (!header
      ? 'no watch header: the digest was off'
      : `door_watch=${doorWatch} highperformance=${highPerformance}`);

  return {
    file,
    files: [file, ...otherFiles.map(other => other.file)].filter(Boolean),
    modDir,
    modVersion,
    session: sessionInfo,
    session_label: describeSession(sessionInfo),
    verdict,
    verdict_reason: verdictReason,
    armed,
    claims,
    header,
    digest_windows: parsed.digests.length,
    counters,
    cost: controlCost ? { log: cost, control: controlCost } : { log: cost },
    door_watch_first: parsed.first ? { line: parsed.first.line, fields: parsed.first.fields } : null,
    door_watch_traces: traceDoors.length,
    door_watch_trace_src: traceSources,
    reaction_hold_events: reactionHolds.length,
    reaction_level: reactLevel,
    alarms: alarmCounts,
    alarm_budget_exhausted: parsed.alarmBudgetExhausted,
    version_seen: parsed.version,
    digests: parsed.digests.map(digest => ({ line: digest.line, fields: digest.fields })),
    scan: {
      setup: scan.setup.length,
      fatal: scan.fatal,
      luaErrors: scan.luaErrors,
      liesErrors: scan.liesErrors
    }
  };
}

function readModTxt(modDir) {
  if (!modDir) return null;
  const file = path.join(modDir, 'mod.txt');

  if (!fs.existsSync(file)) return null;

  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'));
  }
}

function escapeCell(text) {
  return String(text).replace(/\|/g, '\\|');
}

export function renderReport(report) {
  const lines = [];

  lines.push('# LIES door-watch report');
  lines.push('');
  lines.push(`- Log: \`${report.files.join('`, `') || '(none)'}\``);
  lines.push(`- Session: ${report.session_label}`);
  lines.push(`- Mod: \`${report.modDir || '(unknown)'}\`${report.modVersion ? ` (${report.modVersion})` : ''}`);
  lines.push(`- Digest windows: ${report.digest_windows}`);
  lines.push(`- \`[LIES-TRACE] phase=door_watch\` lines: ${report.door_watch_traces}` +
    (report.door_watch_traces ? ` (${Object.entries(report.door_watch_trace_src).map(([src, n]) => `${src}=${n}`).join(' ')})` : ''));
  lines.push(`- \`[LIES-EVENT] kind=reaction_hold\` lines: ${report.reaction_hold_events}`);
  lines.push(`- First door position: ${report.door_watch_first ? `src=${report.door_watch_first.fields.src} seg=${report.door_watch_first.fields.seg} (line ${report.door_watch_first.line})` : 'not yet observed in game'}`);
  lines.push('');
  lines.push('| claim | result | evidence |');
  lines.push('|---|---|---|');

  for (const entry of report.claims) {
    lines.push(`| ${escapeCell(entry.claim)} | ${entry.result} | ${escapeCell(entry.evidence)} |`);
  }

  lines.push('');
  lines.push(`verdict: ${report.verdict}`);

  if (report.verdict === 'INCOMPLETE') {
    lines.push('');

    if (report.armed === false && report.header) {
      lines.push('The run cannot prove the feature: the header shows it disarmed' +
        (report.verdict_reason ? ` (${report.verdict_reason})` : '') + '.');
      lines.push('Re-run with `door_watch` on and High Performance Mode off.');
    } else {
      lines.push('Enable the digest before the next play: with the game closed, set `"watch_log": true` in');
      lines.push('`mods\\saves\\LittleIntelligenceEnhancementS.txt`, and `"debug_log": true` for the per-event');
      lines.push('`[LIES-CHECK]` lines. `trace` is on by default; without it there is no `phase=door_watch` line.');
    }
  }

  lines.push('');
  lines.push('## Raw numbers');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

// Flags that take a value, mapped to the result key. Shared with the tests so
// "missing value" is pinned in one place.
export const VALUE_FLAGS = new Map([
  ['--mod', 'mod'],
  ['--out', 'out'],
  ['--json', 'json'],
  ['--ab', 'ab'],
  ['--session', 'session']
]);

// Pure: no process.exit, no console output, so the parser can be unit-tested.
// A flag with no value (end of argv, or the next token is another `--flag`) is a
// usage error instead of a silent `undefined` that would turn `--out` into a
// write to the string "--json".
export function parseArgs(argv) {
  const args = { logs: [], mod: path.resolve(HERE, '..', '..'), out: '', json: '', ab: '', session: 'last', help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const key = VALUE_FLAGS.get(arg);

    if (key) {
      const value = argv[i + 1];

      if (value === undefined || value === '' || (value.startsWith('-') && value !== '-')) {
        throw new Error(`${arg} requires a value`);
      }
      if (arg === '--session' && !/^(last|all|\d+)$/i.test(value)) {
        throw new Error('--session expects last, all or a 1-based index');
      }
      args[key] = value;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('-') && arg !== '-') throw new Error(`unknown argument: ${arg}`);
    else args.logs.push(arg);
  }

  return args;
}

// 3 = the invocation was wrong, not the run: printed with the usage line so a
// wrapper script can tell "bad command" from "bad play".
function usageError(message) {
  console.error(`door-watch-report: ${message}`);
  console.error(USAGE);
  process.exitCode = 3;
}

function main() {
  let args;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    usageError(err.message);
    return;
  }

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (!args.logs.length) {
    usageError('at least one log file is required');
    return;
  }

  // Only the reads are inside the try: an exception thrown by the analysis is
  // a bug in this tool and must surface as one, not as "cannot read a log".
  const read = log => fs.readFileSync(path.resolve(log), 'utf8');
  const [first, ...rest] = args.logs;
  let texts;
  let modTxt;
  let controlText = null;

  try {
    texts = [read(first), ...rest.map(read)];
    modTxt = readModTxt(path.resolve(args.mod));
    controlText = args.ab ? read(args.ab) : null;
  } catch (err) {
    usageError(`cannot read an input file: ${err.message}`);
    return;
  }

  const report = (() => {
    try {
      return analyzeLog(texts[0], {
        file: path.resolve(first),
        otherFiles: rest.map((log, index) => ({ file: path.resolve(log), text: texts[index + 1] })),
        modVersion: modTxt ? modTxt.version || null : null,
        modDir: path.resolve(args.mod),
        controlText,
        controlFile: args.ab ? path.resolve(args.ab) : '',
        session: args.session
      });
    } catch (err) {
      // A session index outside the log is a bad command, not a bad play.
      if (err instanceof SessionRangeError) {
        usageError(err.message);
        return null;
      }
      throw err;
    }
  })();

  if (!report) return;

  const markdown = renderReport(report);

  if (args.out) {
    const out = path.resolve(args.out);

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown);
  }
  if (args.json) {
    const out = path.resolve(args.json);

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
  }
  if (!args.out && !args.json) process.stdout.write(markdown);

  const fails = report.claims.filter(entry => entry.result === 'FAIL').map(entry => entry.claim);
  const sessionTag = report.session.count === 1
    ? `${report.session.index}/${report.session.total}`
    : `merged(${report.session.count})`;

  console.log(`verdict=${report.verdict} session=${sessionTag} digests=${report.digest_windows} door_watch_traces=${report.door_watch_traces}` +
    (fails.length ? ` failed=${fails.join(',')}` : '') +
    (report.verdict_reason ? ` reason="${report.verdict_reason}"` : ''));

  if (report.verdict === 'FAIL') process.exitCode = 1;
  else if (report.verdict === 'INCOMPLETE') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

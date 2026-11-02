// LIES watch channel: opt-in digest + always-on failure alarms.
//
// Same shape as Iter's channel ([ITER-WATCH]) so one reader handles both mods.
// Why: the [LIES-CHECK] lines only appear with debug_log on, so a normal player
// session recorded nothing. Counters now run always; the digest is opt-in and
// the alarms fire only on a hard failure.
//
// Runtime proof: a loud heist with watch_log=false must produce zero
// [LIES-WATCH] lines, and one with watch_log=true must show a header plus
// digests (see TEST-RESULTS.md).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

const manager = fs.readFileSync(path.join(repoRoot, 'menumanager.lua'), 'utf8');
const nav = read('lua', 'managers', 'navigationmanager.lua');

test('watch_log is opt-in and off by default', () => {
  assert.match(manager, /watch_log = false/, 'watch_log must default to false');
  assert.match(manager, /function LIES:WatchEnabled\(\)[\s\S]*?watch_log[\s\S]*?\n\tend/, 'WatchEnabled missing');
});

test('counters run even with debug logging off', () => {
  const logCheck = /function LIES:LogCheck\(message, kind\)([\s\S]*?)\n\tend/.exec(manager);
  assert.ok(logCheck, 'LogCheck must accept an optional kind');
  const body = logCheck[1];
  const countAt = body.indexOf('self:Count(kind)');
  const debugAt = body.indexOf('self.settings.debug_log');
  assert.ok(countAt >= 0, 'LogCheck must count tagged events');
  assert.ok(debugAt > countAt, 'the counter must run before the debug_log gate');
  assert.match(body, /if kind then/, 'only tagged events are counted');
});

test('the digest is gated, the alarm is not', () => {
  const watch = /function LIES:Watch\(event_name, fields\)([\s\S]*?)\n\tend/.exec(manager);
  assert.ok(watch, 'LIES:Watch missing');
  assert.match(watch[1], /if not self:WatchEnabled\(\) then\s*\n\s*return/, 'digest must be gated');
  assert.match(watch[1], /\[LIES-WATCH\]/, 'digest prefix missing');

  const alarm = /function LIES:Alarm\(name, fields, now\)([\s\S]*?)\n\tend/.exec(manager);
  assert.ok(alarm, 'LIES:Alarm missing');
  assert.doesNotMatch(alarm[1], /WatchEnabled/, 'alarms must not be gated by the opt-in switch');
  assert.match(alarm[1], /evt=alarm/, 'alarm event missing');
});

test('alarms are rate limited per name and per level', () => {
  const alarm = /function LIES:Alarm\(name, fields, now\)([\s\S]*?)\n\tend/.exec(manager)[1];
  assert.match(alarm, /self\.watch_alarm_window/, 'window constant missing');
  assert.match(alarm, /if last and now - last < self\.watch_alarm_window then/, 'per-name window missing');
  assert.match(alarm, /self\.watch_alarm_budget = self\.watch_alarm_budget - 1/, 'per-level budget missing');
  assert.match(alarm, /evt=alarm_budget_exhausted/, 'budget exhaustion must be reported');
  const reset = /function LIES:WatchReset\(\)([\s\S]*?)\n\tend/.exec(manager);
  assert.ok(reset && /watch_alarm_budget = 20/.test(reset[1]), 'reset must restore the budget');
});

test('the tick is driven from the once-per-frame navigation update', () => {
  const hook = nav.slice(nav.indexOf('Hooks:PostHook(NavigationManager, "update", "lies_cover"'));
  const body = hook.slice(0, hook.indexOf('\nend)'));
  assert.match(body, /LIES:WatchTick\(t\)/, 'watch tick not driven');
});

test('the channel resets on a level change', () => {
  const hook = nav.slice(nav.indexOf('Hooks:PostHook(NavigationManager, "_clear", "LIES_nav_gen_abort_clear"'));
  const body = hook.slice(0, hook.indexOf('\nend)'));
  assert.match(body, /LIES:WatchReset\(\)/, 'level change must reset the watch channel');
});

test('the digest is one line per minute and the alarms have thresholds', () => {
  const tick = /function LIES:WatchTick\(t\)([\s\S]*?)\n\tend/.exec(manager);
  assert.ok(tick, 'WatchTick missing');
  assert.match(tick[1], /self\.watch_next_t = t \+ 60/, 'digest cadence must be 60 s');
  assert.match(tick[1], /if t < \(self\.watch_next_t or 0\) then\s*\n\s*return/, 'cadence gate missing');
  assert.match(tick[1], /if self:WatchEnabled\(\) then\s*\n\s*self:WatchDigest\(t\)/, 'digest not gated in the tick');
  assert.match(tick[1], /lies_cover_fallback_rate/, 'cover fallback alarm missing');
  assert.match(tick[1], /lies_suppression_deny_spike/, 'suppression spike alarm missing');
  // No per-frame output: both alarms sit after the cadence gate.
  const gateAt = tick[1].indexOf('if t < (self.watch_next_t or 0) then');
  assert.ok(tick[1].indexOf('lies_cover_fallback_rate') > gateAt, 'alarms must run after the cadence gate');
});

test('the suppression alarm is an absolute spike, not a dead ratio', () => {
  const tick = /function LIES:WatchTick\(t\)([\s\S]*?)\n\tend/.exec(manager);
  assert.ok(tick, 'WatchTick missing');
  const body = tick[1];

  // Nothing in the mod ever increments `suppression_allow`, so the old
  // deny/(deny+allow) ratio was 1.00 by construction and fired on six of 22
  // windows in one 22-minute run. The alarm must not read the missing
  // denominator at all.
  assert.doesNotMatch(body, /lies_suppression_deny_rate/, 'the ratio alarm must stay gone');
  assert.doesNotMatch(body, /suppression_allow/, 'nothing produces suppression_allow, so the alarm cannot read it');
  assert.match(body, /local suppression_deny = lies_delta\(self\.watch_counters, self\.watch_prev, "suppression_deny"\)/);

  const shape = /if suppression_deny > (\d+) then\s*self:Alarm\("lies_suppression_deny_spike", \{\s*deny = suppression_deny,\s*threshold = (\d+)\s*\}, t\)\s*end/.exec(body);
  assert.ok(shape, 'the spike alarm shape is missing');
  // The comparison and the reported field come from the same literal, so they
  // cannot drift apart. 90 is not arbitrary: the observed healthy maximum of the
  // 2026-11-02 session was 65 denials in a minute at high cop counts, so any cut
  // below that fires on a normal assault wave.
  assert.equal(shape[1], '90');
  assert.equal(shape[2], shape[1]);

  // Evaluated exactly as the Lua does: a minute with exactly the threshold does
  // not fire, one denial above it does.
  const threshold = Number(shape[1]);
  const fires = delta => delta > threshold;

  assert.equal(fires(threshold), false, 'exactly 90 denials must not fire');
  assert.equal(fires(threshold + 1), true, '91 denials must fire');
  // The observed healthy maximum stays quiet.
  assert.equal(fires(65), false, 'the healthy 65-denial minute must not fire');
});

test('the tagged call sites feed the digest counters', () => {
  const kinds = {
    'lua/coplogics/coplogicattack.lua': ['suppression_deny', 'door_raw'],
    'lua/coplogics/specials/shieldlogicattack.lua': ['cover_set', 'cover_fallback'],
    'lua/coplogics/specials/taserlogicattack.lua': ['taser_allowed', 'taser_blocked'],
    'lua/props/carrydata.lua': ['bag_registered', 'bag_skipped', 'bag_deferred'],
    'lua/copextensions/copbrain.lua': ['marshal'],
    'lua/civlogics/civilianlogictravel.lua': ['civ_follow_fallback']
  };

  for (const [file, tags] of Object.entries(kinds)) {
    const source = read(...file.split('/'));
    for (const tag of tags) {
      assert.ok(
        source.includes(`"${tag}")`),
        `${file} must tag its LogCheck with "${tag}"`
      );
    }
  }
});

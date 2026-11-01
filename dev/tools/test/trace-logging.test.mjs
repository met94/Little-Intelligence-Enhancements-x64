import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const readStripped = (...parts) => stripLuaComments(read(...parts));
const traceBody = () => {
  const match = readStripped('menumanager.lua').match(/function LIES:Trace\(unit, logic_data, phase, extra, window\)([\s\S]*?)\n\tend/);
  assert.ok(match, 'LIES:Trace is missing');
  return match[1];
};

// Native access violations cannot be caught, so the only record of what a unit
// was doing is the line written just before the fault. The trace must therefore
// be cheap, survive level-clock restarts, and keep the failure phases even when
// the rate cap is saturated.
test('LIES:Trace throttles per phase and stays opt-outable', () => {
  const body = traceBody();
  const manager = readStripped('menumanager.lua');

  assert.match(manager, /trace = true/, 'trace must default on: a crash cannot opt in afterwards');
  assert.match(body, /self\.settings\.trace/, 'must be switchable off from the settings file');
  assert.match(body, /state\.phases\[phase\]/, 'throttle must be per phase, phases alternate every frame');
  assert.match(body, /t - last < \(window or 2\.5\)/, 'per-phase dedupe window');
  assert.match(body, /\[LIES-TRACE\] v=%s t=%\.2f u=%s tweak=%s logic=%s phase=%s att=%s att_alive=%s att_trk=%s dropped=%d/);
});

test('the trace survives a level clock restart and caps normal lines only', () => {
  const body = traceBody();
  const manager = readStripped('menumanager.lua');

  assert.match(body, /t < self\.trace_window_t or t > self\.trace_window_t \+ 1/, 'clock moving backwards starts a new window');
  assert.match(manager, /self\.trace_window_t = 0[\s\S]{0,80}?self\.trace_window_n = 0/, 'WatchReset must restart the rate window');
  assert.match(body, /trace_failure_phases\[phase\]/, 'failure phases must bypass the cap');
  assert.match(manager, /exit_missing_logic = true[\s\S]{0,120}?exit_no_fallback = true/, 'guard failures must be exempt too');
  assert.match(body, /self\.trace_dropped = self\.trace_dropped \+ 1/, 'dropped lines must be counted');
  assert.match(body, /entry\.last or 0\) > 60/, 'stale units must be pruned mid-heist');
  assert.match(body, /att and att\.u_key/, 'log must not call into the (possibly dead) attention unit');
  assert.doesNotMatch(body, /att_unit:key\(\)/);
});

test('the crash-prone phases are instrumented', () => {
  const attack = readStripped('lua', 'coplogics', 'coplogicattack.lua');
  const spooc = readStripped('lua', 'coplogics', 'specials', 'spooc', 'spooclogicattack.lua');
  const base = readStripped('lua', 'coplogics', 'coplogicbase.lua');

  for (const phase of ['combat', 'combat_no_attention', 'charge_search', 'cover_path_search', 'cover_upd', 'peek', 'retreat', 'aim', 'dodge_dead_enemy', 'stale_tracker', 'pose', 'flank', 'cover_path', 'dodge', 'dodge_preemptive', 'move_out', 'pose_upd', 'move_out_lost_test']) {
    assert.match(attack, new RegExp(`"${phase}"`), `missing trace phase ${phase}`);
  }

  assert.match(spooc, /"spooc"/);
  assert.match(spooc, /"spooc_dead_enemy"/);
  assert.match(spooc, /LIES:Trace\(data\.unit, data, "spooc_combat", nil, 0\.2\)/, 'the spooc combat step needs a tight window');
  assert.match(spooc, /chk_action_forbidden\("walk"\)[\s\S]{0,200}?"spooc_no_walk"/, 'spooc must not run movement while walking is forbidden');
  assert.match(base, /"exit_missing_logic" or "exit_no_fallback"|exit_missing_logic"\), "wanted=/, 'the V8.67 exit guard must leave a breadcrumb');
});

// Same family as the V8.68 crash: code reading an enemy that died between the
// detection pass and this update.
test('combat movement and spooc attack never read a dead enemy', () => {
  const attack = readStripped('lua', 'coplogics', 'coplogicattack.lua');
  const spooc = readStripped('lua', 'coplogics', 'specials', 'spooc', 'spooclogicattack.lua');

  assert.match(attack, /if not focus_enemy then[\s\S]{0,200}?return[\s\S]{0,40}?end/, 'missing attention must bail before dereference');

  const combat = attack.match(/function CopLogicAttack\._upd_combat_movement\(data\)([\s\S]*?)\nfunction /);
  assert.ok(combat, '_upd_combat_movement not found');

  const guardAt = combat[1].indexOf('dodge_dead_enemy');
  const movementAt = combat[1].indexOf('focus_enemy.unit:movement():current_state()');
  const animAt = combat[1].indexOf('focus_enemy.unit:anim_data()');

  assert.ok(guardAt !== -1, 'dodge guard phase is missing');
  assert.ok(movementAt !== -1 && animAt !== -1);
  assert.ok(guardAt < movementAt && guardAt < animAt, 'enemy unit reads must sit behind the liveness branch');

  const spoocAttack = spooc.match(/function SpoocLogicAttack\._upd_spooc_attack\(data, my_data\)([\s\S]*)$/);
  assert.ok(spoocAttack, '_upd_spooc_attack not found');

  const aliveAt = spoocAttack[1].indexOf('alive(focus_enemy.unit)');
  const ziplineAt = spoocAttack[1].indexOf('focus_enemy.unit:movement():zipline_unit()');

  assert.ok(aliveAt !== -1 && ziplineAt !== -1 && aliveAt < ziplineAt, 'the guard must run before the engine calls');
});

test('the tracker guard logs when it refuses a dead enemy', () => {
  const attack = readStripped('lua', 'coplogics', 'coplogicattack.lua');
  const helper = attack.match(/local function lies_enemy_tracker\(focus_enemy, data\)([\s\S]*?)\nend/);

  assert.ok(helper, 'lies_enemy_tracker is missing');

  const aliveAt = helper[1].indexOf('if alive(unit) then');
  const traceAt = helper[1].indexOf('LIES:Trace(data.unit, data, "stale_tracker")');

  assert.ok(aliveAt !== -1 && traceAt !== -1 && aliveAt < traceAt, 'trace only when the unit is not alive');
});

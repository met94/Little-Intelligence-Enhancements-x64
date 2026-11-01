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

// Native access violations cannot be caught, so the only record of what a unit
// was doing is the line written just before the fault. The trace must therefore
// be cheap (dedupe + global cap), always on by default, and carry enough context
// to name the unit, its logic and the enemy it was working with.
test('LIES:Trace is bounded, opt-outable and carries crash context', () => {
  const manager = readStripped('menumanager.lua');
  const body = manager.match(/function LIES:Trace\(unit, logic_data, phase, extra\)([\s\S]*?)\n\tend/);

  assert.ok(body, 'LIES:Trace is missing');
  assert.match(manager, /trace = true/, 'trace must default on: a crash cannot opt in afterwards');
  assert.match(body[1], /self\.settings\.trace/, 'must be switchable off from the settings file');
  assert.match(body[1], /state\.phase == phase and t - state\.t < 2\.5/, 'per-unit dedupe window');
  assert.match(body[1], /self\.trace_window_n >= 25/, 'global lines-per-second cap');
  assert.match(body[1], /\[LIES-TRACE\] v=%s t=%\.2f u=%s tweak=%s logic=%s phase=%s att=%s att_alive=%s att_trk=%s/);
  assert.match(manager, /self\.trace_state = \{\}/, 'trace state must reset with the watch channel');
});

test('the crash-prone phases are instrumented', () => {
  const attack = readStripped('lua', 'coplogics', 'coplogicattack.lua');
  const spooc = readStripped('lua', 'coplogics', 'specials', 'spooc', 'spooclogicattack.lua');
  const brain = readStripped('lua', 'copextensions', 'copbrain.lua');

  for (const phase of ['combat', 'combat_no_attention', 'charge_search', 'cover_path_search', 'cover_upd', 'peek', 'retreat', 'aim', 'dodge_dead_enemy']) {
    assert.match(attack, new RegExp(`LIES:Trace\\(data\\.unit, data, "${phase}"\\)`), `missing trace phase ${phase}`);
  }

  assert.match(spooc, /LIES:Trace\(data\.unit, data, "spooc"\)/);
  assert.match(spooc, /LIES:Trace\(data\.unit, data, "spooc_dead_enemy"\)/);
  assert.match(brain, /LIES:Trace\(self\._unit, self\._logic_data, "movement_aim"\)/);
});

// Same family as the previous crash: code reading an enemy that died between the
// detection pass and this update.
test('combat movement and spooc attack never read a dead enemy', () => {
  const attack = readStripped('lua', 'coplogics', 'coplogicattack.lua');
  const spooc = readStripped('lua', 'coplogics', 'specials', 'spooc', 'spooclogicattack.lua');

  assert.match(attack, /if not focus_enemy then[\s\S]{0,200}?return[\s\S]{0,40}?end/, 'missing attention must bail before dereference');
  assert.match(
    attack,
    /if not \(focus_enemy\.unit and alive\(focus_enemy\.unit\)\) then[\s\S]{0,120}?dodge_dead_enemy/,
    'dodge must check the enemy unit before movement/anim data',
  );
  assert.match(
    spooc,
    /if not \(focus_enemy\.unit and alive\(focus_enemy\.unit\)\) then[\s\S]{0,120}?spooc_dead_enemy/,
    'spooc attack must check the enemy unit before movement calls',
  );

  const spoocAttack = spooc.match(/function SpoocLogicAttack\._upd_spooc_attack\(data, my_data\)([\s\S]*)$/);
  assert.ok(spoocAttack, '_upd_spooc_attack not found');
  const aliveAt = spoocAttack[1].indexOf('alive(focus_enemy.unit)');
  const ziplineAt = spoocAttack[1].indexOf('focus_enemy.unit:movement():zipline_unit()');
  assert.ok(aliveAt !== -1 && ziplineAt !== -1 && aliveAt < ziplineAt, 'the guard must run before the engine calls');
});

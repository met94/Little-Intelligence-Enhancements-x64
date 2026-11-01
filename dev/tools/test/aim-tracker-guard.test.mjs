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

const source = () => stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));

function funcBody(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is missing`);
  const next = text.indexOf('\nfunction ', start + signature.length);
  return text.slice(start, next === -1 ? text.length : next);
}

// `CopMovement:pre_destroy` destroys the unit's nav tracker while attention
// objects keep the pointer (`AIAttentionObject:_register` stored it). LIES also
// runs the aim pass from the movement update, outside the logic update that
// refreshes `attention_obj`, so a cached tracker can be freed. Any method call
// on it (`nav_segment()`, `obstructed()`, `field_position()`, `position()`) is
// an engine access violation, not a catchable Lua error.
// Crash: 2026-10-31 11:03, `_upd_aim` line 998, driven by team AI movement.
test('the tracker helper returns the cached pointer only for a live unit', () => {
  const helper = source().match(/local function lies_enemy_tracker\(focus_enemy, data\)([\s\S]*?)\nend/);

  assert.ok(helper, 'lies_enemy_tracker helper is missing');

  const body = helper[1];
  const aliveAt = body.indexOf('alive(unit)');
  const returnAt = body.indexOf('return focus_enemy.nav_tracker');

  assert.notEqual(aliveAt, -1, 'tracker must be gated on unit liveness');
  assert.notEqual(returnAt, -1, 'helper must hand back the cached tracker');
  assert.ok(aliveAt < returnAt, 'the return must sit behind the liveness check, not before it');
});

test('no code in the file calls a method on a cached nav tracker', () => {
  assert.doesNotMatch(source(), /\.nav_tracker[.:]/, 'direct tracker calls can hit freed engine memory');
});

test('every tracker read goes through the helper', () => {
  const text = source();
  const calls = text.match(/lies_enemy_tracker\(/g) || [];

  assert.equal(calls.length, 7, `expected 1 definition + 6 call sites, found ${calls.length}`);

  // Aim pass: same-segment check and the obstruction test.
  const aim = funcBody(text, 'function CopLogicAttack._upd_aim(');
  assert.match(aim, /local enemy_tracker = lies_enemy_tracker\(focus_enemy, data\)\r?\n\s*local enemy_nav_seg = enemy_tracker and enemy_tracker:nav_segment\(\)/);
  assert.match(aim, /focus_enemy\.reaction and enemy_tracker and not LIES\.settings\.highperformance/);
  assert.match(aim, /not enemy_tracker:obstructed\(\)/);

  // Charge branches (both copies) and cover selection.
  assert.equal(
    (text.match(/local enemy_tracker = lies_enemy_tracker\(data\.attention_obj, data\)/g) || []).length,
    3,
    'two charge sites plus cover selection',
  );
  assert.match(funcBody(text, 'function CopLogicAttack._update_cover('), /enemy_tracker:field_position\(\)/);
  assert.equal(
    (text.match(/_find_charge_pos\(data, my_data, enemy_tracker,/g) || []).length,
    3,
    'definition plus the two charge calls must receive the guarded tracker',
  );

  // Retreat search.
  assert.match(funcBody(text, 'function CopLogicAttack._chk_start_action_move_back('), /local threat_tracker = lies_enemy_tracker\(focus_enemy, data\)/);
});

test('missing tracker bails out instead of searching from nil', () => {
  const expected = funcBody(source(), 'function CopLogicAttack._get_expected_pos(');

  assert.match(expected, /local enemy_tracker = lies_enemy_tracker\(focus_enemy, data\)/);
  assert.match(expected, /if not enemy_tracker then[\s\S]{0,160}?return[\s\S]{0,40}?end/, 'must return before nav_segment');
  assert.match(expected, /local enemy_seg = enemy_tracker:nav_segment\(\)/);
});

test('the aim pass does not touch a dead enemy unit', () => {
  const aim = funcBody(source(), 'function CopLogicAttack._upd_aim(');

  assert.match(aim, /focus_enemy\.unit:movement\(\):current_state\(\)/);
  assert.match(
    aim,
    /focus_enemy\.verified and alive\(focus_enemy\.unit\) then/,
    'state/chatter reads of the enemy unit must be gated on liveness',
  );
});

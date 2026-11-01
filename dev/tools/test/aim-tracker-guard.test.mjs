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

  // 1 definition + 6 call sites. The aim pass is one of them again: the restored
  // door watch resolves the enemy tracker through the liveness rule.
  assert.equal(calls.length, 7, `expected 1 definition + 6 call sites, found ${calls.length}`);

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

test('the aim pass uses the vanilla expected-position helper, not a cached tracker', () => {
  const aim = funcBody(source(), 'function CopLogicAttack._upd_aim(');

  for (const token of ['nav_tracker', 'nav_segment', 'obstructed', 'World:raycast']) {
    assert.ok(!aim.includes(token), `_upd_aim must not reference ${token}`);
  }

  assert.match(aim, /CopLogicAttack\._get_expected_attention_position\(data, my_data\)/);
});

test('the aim pass keeps the breadcrumb first and hands the enemy unit on untouched', () => {
  const aim = funcBody(source(), 'function CopLogicAttack._upd_aim(');
  const firstStatement = aim.split('\n').map((line) => line.trim()).filter(Boolean)[1];

  assert.equal(
    firstStatement,
    'LIES:Trace(data.unit, data, "aim", nil, lies_aim_window(data))',
    'the crash breadcrumb must stay the first statement',
  );

  // The 248.2 body never calls a method on the attention unit itself, but it does
  // hand `focus_enemy.unit` to `search_for_path_to_unit`, which resolves the target
  // through `unit:movement():nav_tracker()`. A unit that died between the detection
  // pass and this update would fault there, so the caller has to gate it (the
  // second use below is that liveness check on the coverfire branch).
  assert.doesNotMatch(aim, /focus_enemy\.unit:/, 'no method calls on the (possibly dead) attention unit');
  // The reload callout (ledger #9) reads the unit through a local, and its liveness
  // gate has to sit inside the callout condition itself.
  assert.match(aim, /local fe_unit = focus_enemy\.unit/, 'the reload callout must read the unit through a local');
  assert.match(aim, /data\.tactics\.harass[\s\S]{0,200}?alive\(focus_enemy\.unit\)/, 'the callout must check liveness before it reads');
  assert.match(aim, /alive\(focus_enemy\.unit\)/, 'the coverfire branch must check liveness before it fires');
  assert.match(aim, /search_for_path_to_unit\("hunt" \.\. tostring\(my_data\.key\), focus_enemy\.unit\)/);
});

test('the movement-driven aim pass is gated on attention liveness before it runs', () => {
  const brain = stripLuaComments(read('lua', 'copextensions', 'copbrain.lua'));
  const body = funcBody(brain, 'function CopBrain:check_upd_aim(');

  const gateAt = body.indexOf('if att and att.unit and not alive(att.unit) then');

  assert.notEqual(gateAt, -1, 'check_upd_aim must refuse a dead attention unit');
  assert.match(body.slice(gateAt, gateAt + 400), /"movement_aim_stale"/, 'the refusal must leave a breadcrumb');

  for (const call of ['self._logics.attack._upd_aim', 'CopLogicAttack._upd_aim']) {
    const callAt = body.indexOf(call);

    assert.notEqual(callAt, -1, `${call} is missing from check_upd_aim`);
    assert.ok(gateAt < callAt, `the liveness gate must precede ${call}`);
  }
});

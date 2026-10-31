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

// `CopMovement:pre_destroy` destroys the unit's nav tracker; attention objects
// keep the pointer. LIES's aim pass also runs from the movement update, outside
// the logic update that refreshes `attention_obj`, so a cached tracker can be
// freed - `nav_segment()`/`obstructed()` on it is an engine access violation.
// Crash: 2026-10-31 11:03, `_upd_aim` line 998, driven by team AI movement.
test('enemy nav trackers are read only while their unit is alive', () => {
  const source = stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));

  const helper = source.match(/local function lies_enemy_tracker\(focus_enemy\)([\s\S]*?)\nend/);

  assert.ok(helper, 'lies_enemy_tracker helper is missing');
  assert.match(helper[1], /alive\(unit\)/, 'tracker must be gated on unit liveness');
  assert.match(helper[1], /return focus_enemy\.nav_tracker/, 'must hand back the cached tracker only when the unit is alive');
});

test('no aim path dereferences the cached attention tracker', () => {
  const source = stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));

  assert.doesNotMatch(source, /focus_enemy\.nav_tracker[.:]/, 'cached tracker method calls can hit freed memory');
  assert.doesNotMatch(source, /focus_enemy\.nav_tracker\s*(and|\))/, 'cached tracker reads are unguarded too');

  // Every tracker use in the aim path must come from the helper.
  const used = source.match(/lies_enemy_tracker\(/g) || [];
  assert.ok(used.length >= 3, `expected helper use at each tracker site, found ${used.length}`);
});

test('missing tracker bails out instead of searching from nil', () => {
  const source = stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));
  const expected = source.match(/function CopLogicAttack\._get_expected_pos\(data, my_data\)([\s\S]*?)\nend/);

  assert.ok(expected, '_get_expected_pos not found');
  assert.match(expected[1], /local enemy_tracker = lies_enemy_tracker\(focus_enemy\)/);
  assert.match(expected[1], /if not enemy_tracker then[\s\S]{0,160}?return[\s\S]{0,40}?end/, 'must return before nav_segment');
  assert.match(expected[1], /local enemy_seg = enemy_tracker:nav_segment\(\)/);
});

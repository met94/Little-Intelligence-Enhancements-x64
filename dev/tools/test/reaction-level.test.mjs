import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('the four Reaction Level values map to the four delays', () => {
  const manager = read('menumanager.lua');

  // 8.57.32 moved the values: HIGH took 3 and ULTRA moved to 4, with no save
  // migration. Keep the exact table so a reorder cannot silently change a
  // player's selection.
  assert.match(manager, /LIES\.reaction_delays = \{ \[1\] = 2, \[2\] = 1, \[3\] = 0\.5, \[4\] = 0 \}/);
  assert.match(manager, /function LIES:ReactionDelay\(\)/);
});

test('the menu lists HIGH between NORMAL and ULTRA, in value order', () => {
  // options.txt is menu JSON with the loader's trailing commas, so read the
  // option's item list as text instead of parsing the whole file.
  const options = read('menu', 'options.txt');
  const start = options.indexOf('"id" : "lies_enemy_reaction_level"');
  const end = options.indexOf('"value" : "enemy_reaction_level"', start);
  const block = options.slice(start, end);

  assert.notEqual(start, -1, 'the reaction option is missing');
  assert.ok(end > start, 'the reaction option has no value key');

  const items = [...block.matchAll(/"menu_lies_enemy_reaction_[a-z]+"/g)].map(match => match[0]);
  assert.deepEqual(items, [
    '"menu_lies_enemy_reaction_low"',
    '"menu_lies_enemy_reaction_normal"',
    '"menu_lies_enemy_reaction_high"',
    '"menu_lies_enemy_reaction_none"'
  ]);
  // No `item_values`: the stored value is the item index, so SLOW=1, NORMAL=2,
  // HIGH=3, ULTRA=4 — the same keys as the delay table.
  assert.doesNotMatch(block, /item_values/);
});

test('HIGH has a label and the description names the four values', () => {
  const loc = read('loc', 'en.txt');

  assert.match(loc, /"menu_lies_enemy_reaction_high" : "HIGH"/);
  assert.match(loc, /"menu_lies_enemy_reaction_level_desc" : "[^"]*High[^"]*"/);
});

test('every consumer reads the delay, not the raw level', () => {
  const cop = read('lua', 'coplogics', 'coplogicattack.lua');
  const boss = read('lua', 'coplogics', 'boss', 'bosslogicattack.lua');
  const spooc = read('lua', 'coplogics', 'specials', 'spooc', 'spooclogicattack.lua');

  for (const [name, source] of [['cop', cop], ['boss', boss], ['spooc', spooc]]) {
    assert.match(source, /LIES:ReactionDelay\(\)/, `${name} must read the delay helper`);
    assert.doesNotMatch(source, /enemy_reaction_level < 3/, `${name} still range-checks the old values`);
    assert.doesNotMatch(source, /2 \/ level/, `${name} still uses the divisor formula`);
  }

  assert.match(cop, /local react_t = LIES:ReactionDelay\(\)/);
  assert.match(cop, /if react_t > 0 and not data\.unit:in_slot\(16\)/);
  assert.doesNotMatch(cop, /local level = math\.max\(1, tonumber\(LIES\.settings\.enemy_reaction_level\)/);
});

test('the digest reports the delay in seconds', () => {
  const manager = read('menumanager.lua');

  assert.match(manager, /react_delay = self:ReactionDelay\(\)/);
});

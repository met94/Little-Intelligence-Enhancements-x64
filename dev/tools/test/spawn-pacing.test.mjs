// Scripted group spawning: the retired `instant_spawn_groups` switch.
//
// History: the fork shipped a toggle in 8.57.4-8.57.9 in front of an upstream
// LIES 7.1 addition (`b0207e5`) that calls
//
//   managers.groupai:state():_perform_group_spawning(spawn_task, true)
//
// right after `force_spawn_group` in `ElementSpawnEnemyGroup:on_executed`.
// The claim was that `force` bypasses `_MAX_SIMULTANEOUS_SPAWNS` and dumps the
// whole group at once. It cannot: `_spawn_in_group` sets every spawn point of
// the fresh group to `delay_t = self._t + math.rand(0.5)`, and
// `_perform_group_spawning` skips points whose delay has not expired
// (`sp_data.delay_t < self._t`). `force` only lifts the per-tick cap, and both
// calls run in the same frame with the same `self._t`. The only task the extra
// call could reach was `_spawning_groups[1]` - the oldest queued group, since
// the new task is appended at the tail - so it could only force an unrelated
// group. The switch and that extra call were removed in 8.57.10.
//
// `spawn_type == "group_guaranteed"` keeps its forced call: that branch is
// vanilla's own code.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

const manager = read('menumanager.lua');
const spawnerRaw = read('lua', 'managers', 'mapelements', 'elementspawnenemygroup.lua');

// Strip Lua comments so a claim cannot be satisfied (or broken) by prose: the
// removal rationale in this file quotes the retired call.
const stripLuaComments = (source) =>
  source.replace(/--\[\[[\s\S]*?\]\]/g, '').replace(/--[^\n]*/g, '');

const spawner = stripLuaComments(spawnerRaw);
const onExecuted = /function ElementSpawnEnemyGroup:on_executed\(instigator\)([\s\S]*?)\nend/.exec(spawner);
const body = onExecuted ? onExecuted[1] : '';
const groupBranch = body.slice(
  body.indexOf('if self._group_data.spawn_type == "group" then'),
  body.indexOf('elseif self._group_data.spawn_type == "group_guaranteed"')
);
const guaranteedBranch = body.slice(body.indexOf('elseif self._group_data.spawn_type == "group_guaranteed"'));

test('the toggle and its plumbing are gone', () => {
  assert.doesNotMatch(manager, /instant_spawn_groups/, 'setting or callback still in menumanager.lua');
  assert.doesNotMatch(read('menu', 'options.txt'), /instant_spawn_groups/, 'menu entry still exists');
  assert.doesNotMatch(read('loc', 'en.txt'), /menu_lies_instant_spawn_groups/, 'localisation keys still exist');
});

test('on_executed survives and is the vanilla shape', () => {
  assert.ok(onExecuted, 'on_executed override missing');
  assert.match(groupBranch, /create_spawn_group\(self\._id, self, self\._spawn_points\)/, 'group data creation lost');
  assert.match(
    groupBranch,
    /managers\.groupai:state\(\):force_spawn_group\(spawn_group_data, self\._values\.preferred_spawn_groups\)/,
    'vanilla force_spawn_group call lost'
  );
});

test('the group branch makes no forced spawn call', () => {
  assert.doesNotMatch(groupBranch, /_perform_group_spawning/, 'the retired forced spawn is back in the group branch');
  assert.doesNotMatch(groupBranch, /_spawning_groups/, 'the group branch must not poke the spawn queue directly');
});

test('group_guaranteed keeps vanilla forced spawning', () => {
  assert.match(
    guaranteedBranch,
    /force_spawn_group\(spawn_group_data, self\._values\.preferred_spawn_groups, true\)/,
    'guaranteed branch lost its guarantee flag'
  );
  assert.match(guaranteedBranch, /_perform_group_spawning\(spawn_task, true\)/, 'guaranteed branch lost its forced spawn');
});

test('no other code path reintroduces a forced spawn', () => {
  for (const [file, source] of [
    ['lua/managers/mapelements/elementspawnenemygroup.lua', spawner],
    ['menumanager.lua', manager]
  ]) {
    const forced = [...source.matchAll(/_perform_group_spawning\([^)]*true\)/g)];
    const expected = file.includes('elementspawnenemygroup') ? 1 : 0;
    assert.equal(forced.length, expected, `${file}: unexpected forced-spawn call count`);
  }
});

test('the retired switch is documented as removed', () => {
  const doc = read('MENU_OPTIONS.md');
  assert.match(doc, /Instant Spawn Groups \(`instant_spawn_groups`\) - removed in 8\.57\.10/, 'removal record missing');
  assert.doesNotMatch(doc, /restores vanilla pacing and\s+leaves the normal `force_spawn_group` path/, 'stale description survived');
});

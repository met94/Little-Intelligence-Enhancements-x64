// Instant spawn groups: the density switch behind "3x more cops with mods".
//
// Player measurement (2026-10-26): live cops ~35 on vanilla, ~100 with the
// suite (peaks 130) on the same heist and difficulty.
//
// Cause, verified in source: `ElementSpawnEnemyGroup:on_executed` in LIES (an
// upstream override, `git blame` -> 2023-04-05) force-spawns the whole group
// right after `force_spawn_group`:
//
//   managers.groupai:state():_perform_group_spawning(spawn_task, true)
//
// Vanilla only calls `force_spawn_group`, which goes through `_upd_group_spawning`
// and therefore respects `GroupAIStateBesiege._MAX_SIMULTANEOUS_SPAWNS = 3`.
// The `true` argument is the `force` flag, and `_perform_group_spawning` skips
// the cap when it is set, so every executed `spawn_type == "group"` element
// dumps its group at once instead of trickling 3 per tick.
//
// The switch keeps upstream behaviour by default (LIES has always done this) and
// offers a vanilla-paced mode for A/B: `instant_spawn_groups = false` skips the
// forced call and leaves only the vanilla `force_spawn_group` path.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

const manager = fs.readFileSync(path.join(repoRoot, 'menumanager.lua'), 'utf8');
const spawner = read('lua', 'managers', 'mapelements', 'elementspawnenemygroup.lua');

test('the switch exists and keeps upstream behaviour by default', () => {
  assert.match(
    manager,
    /instant_spawn_groups = true/,
    'instant_spawn_groups must default to true (upstream LIES behaviour)'
  );
});

test('the forced spawn call is gated, the vanilla path is not', () => {
  const onExecuted = /function ElementSpawnEnemyGroup:on_executed\(instigator\)([\s\S]*?)\nend/.exec(spawner);
  assert.ok(onExecuted, 'on_executed override missing');
  const body = onExecuted[1];

  // Vanilla path stays in every configuration.
  assert.match(body, /managers\.groupai:state\(\):force_spawn_group\(spawn_group_data, self\._values\.preferred_spawn_groups\)/, 'vanilla force_spawn_group lost');

  // The extra forced spawn is behind the switch.
  const gate = /if\s+LIES\.settings\.instant_spawn_groups\s*~=\s*false\s+and\s+has_spawned_group\s+then/.exec(body);
  assert.ok(gate, 'the forced spawn must be gated by instant_spawn_groups ~= false');

  const forced = body.indexOf('_perform_group_spawning(spawn_task, true)');
  const gateAt = body.search(/instant_spawn_groups/);
  assert.ok(gateAt >= 0 && forced > gateAt, 'the forced spawn must sit inside the gate');
});

test('group_guaranteed keeps its vanilla force path', () => {
  const onExecuted = /function ElementSpawnEnemyGroup:on_executed\(instigator\)([\s\S]*?)\nend/.exec(spawner)[1];
  const guaranteed = onExecuted.slice(onExecuted.indexOf('elseif self._group_data.spawn_type == "group_guaranteed"'));
  assert.match(guaranteed, /force_spawn_group\(spawn_group_data, self\._values\.preferred_spawn_groups, true\)/, 'guaranteed branch changed');
  assert.match(guaranteed, /_perform_group_spawning\(spawn_task, true\)/, 'guaranteed branch lost its forced spawn');
});

test('the menu exposes the switch', () => {
  const options = fs.readFileSync(path.join(repoRoot, 'menu', 'options.txt'), 'utf8');
  const entry = /\{[^{}]*"lies_instant_spawn_groups"[^{}]*\}/.exec(options);
  assert.ok(entry, 'menu item missing');
  assert.match(entry[0], /"type"\s*:\s*"toggle"/, 'must be a toggle');
  assert.match(entry[0], /"callback"\s*:\s*"callback_lies_instant_spawn_groups"/, 'menu callback missing');
  assert.match(entry[0], /"value"\s*:\s*"instant_spawn_groups"/, 'menu value binding missing');

  // The callback persists the setting, like every other LIES toggle.
  const callback = /callback_lies_instant_spawn_groups = function\(self, item\)([\s\S]*?)\n\t\tend/.exec(manager);
  assert.ok(callback, 'callback missing');
  assert.match(callback[1], /LIES\.settings\.instant_spawn_groups = on/, 'callback must set the setting');
  assert.match(callback[1], /LIES:Save\(\)/, 'callback must persist');

  // Localization keys exist, or the menu shows raw ids.
  const loc = fs.readFileSync(path.join(repoRoot, 'loc', 'en.txt'), 'utf8');
  assert.match(loc, /"menu_lies_instant_spawn_groups_title"/, 'title loc missing');
  assert.match(loc, /"menu_lies_instant_spawn_groups_desc"/, 'description loc missing');
});

test('gate predicate truth table', () => {
  // JS mirror of `if LIES.settings.instant_spawn_groups ~= false and has_spawned_group then`
  const forces = (setting, hasGroup) => setting !== false && Boolean(hasGroup);

  assert.equal(forces(true, true), true, 'default keeps upstream behaviour');
  assert.equal(forces(undefined, true), true, 'a missing key behaves like upstream');
  assert.equal(forces(false, true), false, 'vanilla-paced mode skips the forced spawn');
  assert.equal(forces(true, false), false, 'no group means nothing to force');
});

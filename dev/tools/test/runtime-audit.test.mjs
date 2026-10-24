import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const besiegePath = path.join(root, 'lua', 'groupaistate', 'groupaistatebesiege.lua');
const besiege = fs.readFileSync(besiegePath, 'utf8');

function stripCommentedLines(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

function luaFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? luaFiles(full) : entry.name.endsWith('.lua') ? [full] : [];
  });
}

test('spawn search caps linear path distance with the linear max_dis', () => {
  const active = stripCommentedLines(besiege);
  assert.match(active, /\n\s*if not max_dis or my_dis < max_dis then\r?\n/);
  assert.match(active, /\n\s*local dis_limit = max_dis or tweak_data\.group_ai\.ai_spawn_distance_limit\r?\n/);
});

test('every spawn-search call passes only the supported arguments', () => {
  const calls = [...besiege.matchAll(/self:_find_spawn_group_near_area\(([^)]*)\)/g)]
    .map((match) => match[1].trim());

  assert.equal(calls.length, 2);
  for (const args of calls) {
    assert.equal(args.split(',').length, 5, `wrong argument count: (${args})`);
    assert.doesNotMatch(args, /"phalanx"/);
  }
});

test('dead recon-sweep subsystem is removed', () => {
  const names = [
    '_begin_recon_sweep_task',
    '_upd_recon_sweep_task',
    '_assign_enemy_group_to_recon_sweep',
    '_set_recon_sweep_objective_to_group',
    '_assign_enemy_groups_to_recon_sweep'
  ];

  for (const file of luaFiles(path.join(root, 'lua'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const name of names) {
      assert.equal(source.includes(name), false, `${name} still present in ${path.relative(root, file)}`);
    }
    assert.equal(source.includes('recon.sweep_task'), false, `sweep_task still present in ${path.relative(root, file)}`);
  }
});

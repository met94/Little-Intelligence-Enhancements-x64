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

test('group AI recon truncation and HRT/sabotage branches are correctly nested', () => {
  assert.match(besiege, /for i = 0, #current_objective\.coarse_path - forwardmost_i_nav_point do/);
  assert.doesNotMatch(besiege, /#current_objective\.coarse_path - i/);
  assert.match(besiege, /^\t{3}elseif current_objective\.tactic == "hrt" then$/m);
  assert.match(besiege, /^\t{3}elseif current_objective\.tactic == "sabotage" then$/m);
  assert.match(besiege, /group\.objective\.moving_in = true\s*\n\s*group\.objective\.moved_in = true/);

  const hrtStart = besiege.indexOf('elseif current_objective.tactic == "hrt" then');
  const sabotageStart = besiege.indexOf('elseif current_objective.tactic == "sabotage" then');
  const hrtBlock = besiege.slice(hrtStart, sabotageStart);
  assert.match(hrtBlock, /else\s+current_objective\.tactic = nil\s+end\s*$/);
});

test('hostage task removes before callback and stops when empty', () => {
  assert.match(besiege, /self\._hostage_upd_key = nil/);
  assert.match(besiege, /table\.remove\(self\._hostage_data, best_hostage_task_i\)\s*\n\s*best_hostage_task\.clbk\(\)/);
  assert.match(besiege, /if not self\._hostage_upd_key and next\(self\._hostage_data\) then/);
});

test('retreat announcement retries briefly, then clears the retry flag', () => {
  assert.match(besiege, /group\._LIES_retreat_announce_deadline = deadline/);
  assert.match(besiege, /self:_voice_retreat\(group\) or self\._t >= deadline/);
  assert.doesNotMatch(besiege, /group\.needs_announce_retreat = not self:_voice_retreat\(group\)/);
});

test('security camera loud detection uses the matching criminal key', () => {
  const source = fs.readFileSync(path.join(root, 'lua', 'props', 'securitycamera.lua'), 'utf8');
  assert.match(source, /vis_ray\.unit:key\(\) == c_key/);
  assert.match(source, /local angle_multiplier = angle \/ angle_max/);
  assert.match(source, /self\._visibility_slotmask = self\._visibility_slotmask or managers\.slot:get_mask\("AI_visibility"\)/);
});

test('team AI movement restores the should-stay walk guard', () => {
  const source = fs.readFileSync(path.join(root, 'lua', 'teamaiextensions', 'teamaimovement.lua'), 'utf8');
  assert.match(source, /if action_type == "walk" and self\._should_stay then/);
});

test('civilian follow travel guards a dead follow unit', () => {
  const source = fs.readFileSync(path.join(root, 'lua', 'civlogics', 'civilianlogictravel.lua'), 'utf8');
  assert.match(source, /objective\.type == "follow" and alive\(objective\.follow_unit\)/);
});

test('drill sabotage objective guards a missing nav tracker', () => {
  const source = fs.readFileSync(path.join(root, 'lua', 'props', 'drill.lua'), 'utf8');
  assert.match(source, /not self\._sabotage_align_obj_name or not self\._nav_tracker then/);
});

test('both obstacle-placement branches initialise obstacle_units', () => {
  const source = fs.readFileSync(path.join(root, 'lua', 'managers', 'mapelements', 'missionscriptelement.lua'), 'utf8');
  const guards = source.match(/if not disable_obstacles\._obstacle_units/g) || [];
  assert.ok(guards.length >= 2, `obstacle_units guards: ${guards.length}`);
});

test('difficulty removal checks the level-specific adjustment table', () => {
  const source = fs.readFileSync(path.join(root, 'lua', 'managers', 'mapelements', 'elementdifficulty.lua'), 'utf8');
  const checks = source.match(/if to_adjust\[self\._id\] then/g) || [];
  assert.ok(checks.length >= 2, `to_adjust checks: ${checks.length}`);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the blocks `dev/reports/aim-port-behaviour-ledger.md` marks RE-ADD after the
// 8.57.19 port (ledger block numbers are the ones in that report). Removing any of
// these silently drops a behaviour, so they are asserted one by one.

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

const rawAim = () => {
  const text = stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));
  const start = text.indexOf('function CopLogicAttack._upd_aim(');
  assert.notEqual(start, -1, 'CopLogicAttack._upd_aim is missing');
  const next = text.indexOf('\nfunction ', start + 10);

  return text.slice(start, next === -1 ? text.length : next);
};

test('ledger #5: the charge abort is back, with its tankboss table', () => {
  const aim = rawAim();

  assert.match(aim, /local try_stop_charge/);
  assert.match(aim, /my_data\.charging and not data\.unit:movement\(\):chk_action_forbidden\("walk"\)/);
  assert.match(aim, /data\.attention_obj\.dis <= 200 or LIES\.settings\.enemy_aggro_level < 4/);
  assert.match(aim, /not data\.tactics\.charge/);
  assert.match(aim, /not data\.unit:base\(\):has_tag\("tank"\)/);
  assert.match(aim, /not tankboss\[data\.unit:base\(\)\._tweak_table\]/);
  assert.match(aim, /CopLogicAttack\._cancel_charge\(data, my_data\)/);
  assert.match(aim, /my_data\.at_cover_shoot_pos = true/);
  assert.match(aim, /my_data\.cover_test_step = 0/);
  assert.doesNotMatch(aim, /charge_aggro_level/, 'the condition is the pre-port expression, no per-unit aggro override');

  // The table itself lives above the function and only guards the abort.
  const text = stripLuaComments(read('lua', 'coplogics', 'coplogicattack.lua'));
  assert.match(text, /local tankboss = \{\s*triad_boss = true,\s*deep_boss = true\s*\}/);

  // The abort pass must not keep the running firing range (pre-port dropped it).
  assert.match(aim, /haste\(\) == "run" and not charge_aborted/);
});

test('ledger #6: the turn-to-shoot concessions are back', () => {
  const aim = rawAim();

  assert.match(aim, /local can_turn_to_shoot = focus_enemy\.dmg_t and data\.t - focus_enemy\.dmg_t < 5/);
  assert.match(
    aim,
    /can_turn_to_shoot = can_turn_to_shoot or focus_enemy\.acquire_t and data\.t - focus_enemy\.acquire_t < 4 and focus_enemy\.dis <= weapon_range_close/,
  );
  assert.match(aim, /if not can_turn_to_shoot then\s*shoot = false\s*aim = false\s*end/);
  // The pre-port wrapper (`1005`) and the run-block exemptions travel with it.
  assert.match(aim, /if not data\.char_tweak\.always_face_enemy and not focus_enemy\.dangerous_special then/);
  assert.match(aim, /if \(my_data\.low_value_att or data\.unit:anim_data\(\)\.run\)/);
  assert.match(aim, /and not \(data\.tactics and data\.tactics\.sniper\) then/);
  // Foreign logics call this body without `weapon_range`; the reads stay guarded.
  assert.match(aim, /local weapon_range_close = my_data\.weapon_range and my_data\.weapon_range\.close or 1000/);
});

test('ledger #7: both hostage safe-weapon halves and the chatter branch are back', () => {
  const aim = rawAim();
  const aimAllowFireAt = aim.indexOf('CopLogicAttack.aim_allow_fire(');

  assert.match(aim, /if LIES\.settings\.hhtacs and \(focus_enemy\.verified_t and data\.t - focus_enemy\.verified_t < 2 or my_data\.shooting\) then/);
  assert.match(aim, /if focus_enemy\.hostage_blocked then/);
  assert.match(aim, /chk_say_enemy_chatter\(data\.unit, data\.m_pos, "hostageblock"\)/);
  assert.match(aim, /data\.brain:request_switch_to_safe_weapon\(3\)/);
  assert.match(aim, /if not focus_enemy\.hostage_blocked and data\.safe_equipped and data\.brain:request_switch_to_normal_weapon\(7\) then/);

  // The restore half is a separate `if` after the hhtacs window, so a cop that is
  // already on its sidearm always tries to swap back.
  const hhtacsAt = aim.indexOf('if LIES.settings.hhtacs and');
  const restoreAt = aim.indexOf('if not focus_enemy.hostage_blocked and data.safe_equipped');
  assert.notEqual(hhtacsAt, -1);
  assert.notEqual(restoreAt, -1);
  assert.ok(restoreAt > hhtacsAt, 'the restore half must sit outside the hhtacs window');
  assert.doesNotMatch(aim, /elseif data\.safe_equipped and data\.brain:request_switch_to_normal_weapon/, 'the restore half is hoisted, not an elseif');

  // Both halves stop firing for the swap, and do it before the fire decision.
  const flushes = [...aim.matchAll(/data\.unit:movement\(\):set_allow_fire\(false\)/g)].map((m) => m.index);
  assert.equal(flushes.length, 2);
  assert.ok(flushes.at(-1) < aimAllowFireAt, 'every set_allow_fire(false) flush happens before aim_allow_fire');

  // The host-side methods still exist and now have a caller again.
  const brain = stripLuaComments(read('lua', 'copextensions', 'copbrain.lua'));
  assert.match(brain, /function CopBrain:request_switch_to_safe_weapon\(t\)/);
  assert.match(brain, /function CopBrain:request_switch_to_normal_weapon\(t\)/);
});

test('ledger #8: enrage and boss throwable are called from the aim body again', () => {
  const aim = rawAim();

  assert.match(aim, /CopLogicAttack\._chk_enrage\(data, focus_enemy\)/);
  assert.match(aim, /if shoot and focus_enemy and not data\.safe_equipped and not focus_enemy\.hostage_blocked then\s*LIESBossLogicAttack\._chk_use_throwable\(data, my_data, focus_enemy\)\s*end/);

  // The throwable call keeps its char-tweak gate, so only units whose char tweak
  // carries `throwable` (mini dozer, drug lord, zeal heavy swat) reach the throw path.
  const boss = stripLuaComments(read('lua', 'coplogics', 'boss', 'bosslogicattack.lua'));
  assert.match(boss, /function LIESBossLogicAttack\._chk_use_throwable\(data, my_data, focus\)\s*local throwable = data\.char_tweak\.throwable\s*if not throwable then\s*return\s*end/);

  // Enrage must stay ahead of the fire decision.
  assert.ok(aim.indexOf('CopLogicAttack._chk_enrage') < aim.indexOf('CopLogicAttack.aim_allow_fire'), 'enrage runs before aim_allow_fire');
});

test('ledger #9: the reload callout is back behind liveness guards', () => {
  const aim = rawAim();
  const aimAllowFireAt = aim.indexOf('CopLogicAttack.aim_allow_fire(');

  // The liveness gate must sit inside the callout condition, not just somewhere in
  // the body, so deleting it fails even while other `alive()` checks remain.
  assert.match(aim, /data\.tactics\.harass[\s\S]{0,200}?alive\(focus_enemy\.unit\)/);
  assert.match(aim, /local fe_unit = focus_enemy\.unit/);
  assert.match(aim, /local fe_movement = fe_unit:movement\(\)/);
  assert.match(aim, /local cur_state = fe_movement and fe_movement:current_state\(\)/);
  assert.match(aim, /if cur_state and cur_state:_is_reloading\(\) then/);
  assert.match(aim, /local focus_anim_data = fe_unit:anim_data\(\)/);

  const callouts = [...aim.matchAll(/chk_say_enemy_chatter\(data\.unit, data\.m_pos, "calloutreload"\)/g)].map((m) => m.index);
  assert.equal(callouts.length, 2, 'local-player and non-player branches both call out');
  assert.ok(callouts.at(-1) < aimAllowFireAt, 'the callout happens before aim_allow_fire, not after the fire decision');

  // The chatter type must stay in the tweak data, otherwise the call dereferences nil.
  const tweak = read('lua', 'tweak_data', 'groupaitweakdata.lua');
  assert.match(tweak, /self\.enemy_chatter\.calloutreload = \{/);
});

test('ledger #10: the reaction-level fire delay is restored with a working gate', () => {
  const aim = rawAim();
  const aimAllowFireAt = aim.indexOf('CopLogicAttack.aim_allow_fire(');
  const throwableAt = aim.indexOf('LIESBossLogicAttack._chk_use_throwable(');

  // Computed before the gate, clamped, so a nil/zero setting cannot error or divide by zero.
  assert.match(aim, /local level = math\.max\(1, tonumber\(LIES\.settings\.enemy_reaction_level\) or 1\)/);
  assert.ok(aim.indexOf('local level = math.max') < aim.indexOf('if level < 3'), 'the level is clamped before the comparison');
  assert.match(aim, /if level < 3 and not data\.unit:in_slot\(16\) and not data\.is_converted and not \(data\.team and data\.team\.id == "criminal1"\)/);
  // Coverfire is deliberate suppression fire: it must not be silenced by the hold.
  assert.match(aim, /and not \(data\.tactics and data\.tactics\.provide_coverfire_LIES\) then/);
  // The 7.84 operator-precedence bug must not come back.
  assert.doesNotMatch(aim, /not data\.team\.id ==/, 'the constant-false team clause must stay out');
  assert.doesNotMatch(aim, /charge_aggro_level/);
  // Private timer, so it cannot stack with the shared `react_t` writes elsewhere.
  assert.match(aim, /local react_t = 2 \/ level/);
  assert.match(aim, /if not focus_enemy\.lies_react_t or not focus_enemy\.verified_t or data\.t - focus_enemy\.verified_t > 2 then\s*focus_enemy\.lies_react_t = data\.t\s*if LIES\.settings\.debug_log then\s*LIES:Event\("reaction_hold", data\.unit, data, \{ level = level \}\)\s*end\s*end/);
  assert.match(aim, /if data\.t - focus_enemy\.lies_react_t < react_t then\s*shoot = nil\s*react_hold = true\s*end/);
  // Both pass counters exist so a test play can see held vs allowed frames.
  assert.match(aim, /if react_hold then\s*LIES:Count\("react_hold"\)\s*else\s*LIES:Count\("react_allow"\)\s*end/);
  // The event exists but is debug-only: it was 76 % of the event channel, and
  // the counters above are the telemetry a normal play leaves behind.
  assert.match(aim, /if LIES\.settings\.debug_log then\s*LIES:Event\("reaction_hold", data\.unit, data, \{ level = level \}\)\s*end/);
  assert.match(aim, /LIES:Event\("reaction_hold", data\.unit, data, \{ level = level \}\)/);
  const debugGate = /if LIES\.settings\.debug_log then\s*([\s\S]*?)\s*end/.exec(aim);
  assert.ok(debugGate, 'the reaction_hold event must sit behind debug_log');
  assert.doesNotMatch(debugGate[1], /LIES:Count\(/, 'the counters must stay unconditional');
  assert.doesNotMatch(aim, /focus_enemy\.react_t/, 'the shared react_t field must not be used here');

  // Placement: inside the `REACT_COMBAT` gate, before the throwable call and the fire decision.
  const gateAt = aim.indexOf('if focus_enemy and AIAttentionObject.REACT_COMBAT <= focus_enemy.reaction then');
  const gateEnd = aim.indexOf('\n\tend', gateAt);
  const delayAt = aim.indexOf('local level = math.max');
  assert.notEqual(gateAt, -1, 'the REACT_COMBAT gate is missing');
  assert.notEqual(gateEnd, -1, 'the REACT_COMBAT gate is unterminated');
  assert.ok(delayAt > gateAt && delayAt < gateEnd, 'the delay sits inside the REACT_COMBAT gate');
  assert.ok(delayAt < throwableAt, 'the delay runs before the boss throwable call');
  assert.ok(delayAt < aimAllowFireAt, 'the delay runs before aim_allow_fire');
  // `shoot = nil` is the last write to `shoot` before the fire decision.
  const lastShootNil = aim.lastIndexOf('shoot = nil');
  assert.ok(lastShootNil !== -1 && lastShootNil < aimAllowFireAt);
  assert.doesNotMatch(aim.slice(lastShootNil + 'shoot = nil'.length, aimAllowFireAt), /shoot =/, 'nothing writes shoot after the hold and before aim_allow_fire');
  // No tracker access.
  assert.doesNotMatch(aim.slice(gateAt, gateEnd), /nav_tracker|nav_segment\(|obstructed\(/);
});

test('the retired tracker machinery did not come back with the re-adds', () => {
  const aim = rawAim();

  for (const token of [
    'nav_tracker',
    'nav_segment(',
    'obstructed(',
    'find_segment_doors',
    '_nav_segments',
    'find_walls_across_pos',
    'expected_pos_path',
    'door_raw',
  ]) {
    assert.ok(!aim.includes(token), `_upd_aim must not reference ${token} again`);
  }

  // Retired on purpose (ledger blocks 11-12), not accidentally dropped again.
  assert.ok(!aim.includes('start_shoot_t'), 'the 0.5 s shoot-stop hold stays retired');
  assert.ok(!aim.includes('complained_about_invalid_range'), 'the weapon-range self-heal stays retired');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

// Same rule as compat.test.mjs: a claim cannot be satisfied by commentary.
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

// `CopBrain:set_logic` does `local logic = self._logics[name]` and then
// `logic.enter(...)`; a state the brain does not hold is a nil index and closes
// the game. Bots and civilians do not own the whole cop logic set, so every
// exit has to be checked against the brain table it will actually be read from.
test('CopLogicBase._exit downgrades a missing logic state instead of crashing', () => {
  const source = stripLuaComments(read('lua', 'coplogics', 'coplogicbase.lua'));

  assert.match(source, /local exit_original = CopLogicBase\._exit/, 'original must be captured before wrapping');
  assert.match(source, /function CopLogicBase\._exit\(unit, state_name, params\)/);
  assert.match(source, /local function lies_logic_exists\(brain, name\)/);
  assert.match(source, /brain and brain\._logics/, 'guard must read the same table set_logic reads');

  // The downgrade is conditional on the state actually being absent, and the
  // happy path must still reach the game function untouched.
  assert.match(
    source,
    /if brain and not lies_logic_exists\(brain, state_name\) then/,
    'missing state must be the condition, not every exit',
  );
  assert.match(source, /return exit_original\(unit, state_name, params\)/, 'guard must still call the game function');
  assert.match(
    source,
    /if not fallback then[\s\S]{0,120}?return[\s\S]{0,120}?state_name = fallback/,
    'fallback must be assigned before the call, and unsafe brains must not be switched',
  );
});

test('the guard reports the offending unit and survives a suppressed alarm', () => {
  const source = stripLuaComments(read('lua', 'coplogics', 'coplogicbase.lua'));

  assert.match(source, /LIES:Alarm\(fallback and "exit_missing_logic" or "exit_no_fallback"/);
  assert.match(source, /tweak = base and base\._tweak_table/, 'alarm must name the unit type');
  assert.match(source, /logics = table\.concat\(available, "\."\)/, 'comma is stripped by the log field encoder');
  assert.match(source, /\(LIES\.watch_alarm_budget or 0\) <= 0/, 'no list building once the alarm budget is gone');
  assert.match(source, /\}, lies_game_time\(\)\)/, 'alarm must be throttled by game time, not fired once ever');
});

test('guard does not gate on alive(), which is false for the units that need it', () => {
  const source = stripLuaComments(read('lua', 'coplogics', 'coplogicbase.lua'));
  const guard = source.match(/function CopLogicBase\._exit\(unit, state_name, params\)([\s\S]*?)\nend/);

  assert.ok(guard, 'wrapped _exit not found');
  assert.doesNotMatch(guard[1], /alive\(unit\)/, 'alive() would skip the check for dead/mid-destroy units');
  assert.match(guard[1], /unit and unit:brain\(\)/);
});

test('every LIES travel exit goes through the guard, never straight to set_logic', () => {
  const travel = stripLuaComments(read('lua', 'coplogics', 'coplogictravel.lua'));

  assert.equal((travel.match(/unit:brain\(\):set_logic\(/g) || []).length, 0);
  assert.equal((travel.match(/CopLogicBase\._exit\(/g) || []).length, 10, 'travel exit sites changed');
});

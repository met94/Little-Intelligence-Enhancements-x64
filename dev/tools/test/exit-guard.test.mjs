import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

// `CopBrain:set_logic` does `local logic = self._logics[name]` and then
// `logic.enter(...)`; a state the brain does not hold is a nil index and closes
// the game. Bots and civilians do not own the whole cop logic set, so every
// exit has to be checked against the brain table it will actually be read from.
test('CopLogicBase._exit downgrades a missing logic state instead of crashing', () => {
  const source = read('lua', 'coplogics', 'coplogicbase.lua');

  assert.match(source, /local exit_original = CopLogicBase\._exit/);
  assert.match(source, /function CopLogicBase\._exit\(unit, state_name, params\)/);
  assert.match(source, /local function lies_logic_exists\(brain, name\)/);
  assert.match(source, /brain and brain\._logics/, 'guard must read the same table set_logic reads');
  assert.match(source, /local exit_fallback_name = "idle"/);
  assert.match(source, /LIES:Alarm\("exit_missing_logic"/, 'missing state must be reported');
  assert.match(source, /tweak = base and base\._tweak_table/, 'alarm must name the unit type');
  assert.match(source, /return exit_original\(unit, state_name, params\)/, 'guard must still call the game function');
});

test('travel exits go through the guard, never straight to set_logic', () => {
  const travel = read('lua', 'coplogics', 'coplogictravel.lua');

  assert.equal((travel.match(/unit:brain\(\):set_logic\(/g) || []).length, 0);
  assert.ok((travel.match(/CopLogicBase\._exit\(/g) || []).length >= 7, 'travel exit sites were lost');
});

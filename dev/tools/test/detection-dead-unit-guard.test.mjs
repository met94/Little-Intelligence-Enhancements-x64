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

function funcBody(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is missing`);
  const next = text.indexOf('\nfunction ', start + signature.length);
  return text.slice(start, next === -1 ? text.length : next);
}

const GUARD = 'if not alive(data.unit) or not data.unit:movement() then';

// The V8.57 crash (2026-10-24, reported 2026-11-02) was an engine access
// violation at the `my_pos` read in `_upd_attention_obj_detection`, reached from
// a queued `TeamAILogicTravel._upd_enemy_detection` task. EnemyManager keeps
// queued callbacks across a unit's destruction (`unqueue_task` removes one entry
// per id), so a callback can be handed a logic data whose unit is already gone.
// Any dereference then faults in engine code, not in Lua, so the fix is a
// liveness gate at the callback entry, not a pcall.
test('the shared detection pass refuses a dead unit before the first deref', () => {
  const body = funcBody(
    stripLuaComments(read('lua', 'coplogics', 'coplogicbase.lua')),
    'function CopLogicBase._upd_attention_obj_detection(',
  );

  const guardAt = body.indexOf(GUARD);
  const derefAt = body.indexOf('local my_pos = data.cool and data.unit:movement()');

  assert.notEqual(guardAt, -1, 'the liveness guard is missing from the detection pass');
  assert.notEqual(derefAt, -1, 'the crashing my_pos read must stay in the function');
  assert.ok(guardAt < derefAt, 'the guard must run before the my_pos deref');

  // `alive()` first: it is the predicate that stays safe on a destroyed unit,
  // and the movement extension is only read once liveness is established.
  assert.ok(
    body.indexOf('alive(data.unit)', guardAt) < body.indexOf('data.unit:movement()', guardAt),
    'alive(data.unit) must short-circuit before movement() is read',
  );

  assert.match(
    body,
    new RegExp(`${GUARD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*return 2\\s*end`),
    'a skipped detection pass must return a number (callers add the delay to data.t)',
  );
});

test('the travel detection callback refuses a dead unit before it touches data.t', () => {
  const body = funcBody(
    stripLuaComments(read('lua', 'teamailogics', 'teamailogictravel.lua')),
    'function TeamAILogicTravel._upd_enemy_detection(',
  );

  const guardAt = body.indexOf(GUARD);
  const callbackStart = body.indexOf('data.t = TimerManager:game():time()');

  assert.notEqual(guardAt, -1, 'the travel callback has no liveness guard');
  assert.notEqual(callbackStart, -1, 'the travel callback body changed shape');
  assert.ok(guardAt < callbackStart, 'the guard must run before the callback does any work');

  // Returning (not returning a delay) also stops the unit from re-queuing its
  // own detection task, so a destroyed bot cannot keep waking up the queue.
  assert.match(
    body,
    new RegExp(`${GUARD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*return\\s*end`),
  );
});

test('both guards sit at the very top of their callback, before any other statement', () => {
  for (const [file, signature] of [
    ['lua/coplogics/coplogicbase.lua', 'function CopLogicBase._upd_attention_obj_detection('],
    ['lua/teamailogics/teamailogictravel.lua', 'function TeamAILogicTravel._upd_enemy_detection('],
  ]) {
    const body = funcBody(stripLuaComments(read(...file.split('/'))), signature);
    const firstStatement = body.slice(body.indexOf(')') + 1).trimStart();

    assert.ok(
      firstStatement.startsWith(GUARD),
      `${file}: the liveness guard must be the first statement of the callback`,
    );
  }
});

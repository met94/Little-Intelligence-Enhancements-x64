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

function luaFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...luaFiles(full));
    else if (entry.name.endsWith('.lua')) out.push(full);
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
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The V8.57 crash (reported 2026-11-02) was an engine access violation at the
// `my_pos` read in `_upd_attention_obj_detection`, reached from a queued
// `TeamAILogicTravel._upd_enemy_detection` task. EnemyManager keeps a queued
// callback across its unit's destruction (`queue_task` appends with no id
// dedupe, `unqueue_task` removes one entry per id), so a callback can be handed
// a logic data whose unit is already gone. Any dereference then faults in engine
// code, not in Lua, so every detection entry point needs a liveness gate, and a
// pcall would not help.
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
    new RegExp(`${escape(GUARD)}\\s*return 2\\s*end`),
    'a skipped detection pass must return a number (callers add the delay to data.t)',
  );
});

// Every logic that owns a detection callback. The list is discovered from the
// source rather than hardcoded, so a new `_upd_enemy_detection`/`_upd_detection`
// cannot be added without the gate.
const entries = luaFiles(path.join(root, 'lua')).flatMap((file) => {
  const text = stripLuaComments(fs.readFileSync(file, 'utf8'));
  const found = [];
  const re = /^function ([A-Za-z0-9_.]+)\.(_upd_enemy_detection|_upd_detection)\(([^)]*)\)/gm;
  let match;
  while ((match = re.exec(text))) {
    const signature = match[0];
    const start = text.indexOf(signature, match.index);
    const next = text.indexOf('\nfunction ', start + signature.length);
    found.push({
      file: path.relative(root, file),
      name: `${match[1]}.${match[2]}`,
      body: text.slice(start, next === -1 ? text.length : next),
    });
  }
  return found;
});

test('every detection callback is gated on unit liveness before it does anything', () => {
  assert.ok(entries.length >= 12, `expected the whole detection class, found ${entries.length}`);

  for (const entry of entries) {
    const firstStatement = entry.body.slice(entry.body.indexOf(')') + 1).trimStart();

    assert.ok(
      firstStatement.startsWith(GUARD),
      `${entry.file}: ${entry.name} must start with the liveness guard`,
    );
  }
});

test('a gated callback that reports a delay returns a number, not nil', () => {
  // Callers do `data.t + delay` (or `delay = 0.5 + delay * 1.5`); a bare return
  // there would be a nil arithmetic error instead of a skipped update.
  for (const entry of entries) {
    const returnsDelay = /return delay\b/.test(entry.body);
    const guardReturnsNumber = new RegExp(`${escape(GUARD)}\\s*return 2\\s*end`).test(entry.body);

    assert.equal(
      guardReturnsNumber,
      returnsDelay,
      `${entry.file}: ${entry.name} ${returnsDelay ? 'returns a delay and needs `return 2`' : 'has no delay contract and should return bare'}`,
    );
  }
});

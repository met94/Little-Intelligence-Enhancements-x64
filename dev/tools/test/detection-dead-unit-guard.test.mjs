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
const firstStatement = (body) => body.slice(body.indexOf(')') + 1).trimStart();

// The V8.57 crash (reported 2026-11-02) was an engine access violation at the
// `my_pos` read in `_upd_attention_obj_detection`, reached from a queued
// `TeamAILogicTravel._upd_enemy_detection` task. EnemyManager keeps a queued
// callback across its unit's destruction (`queue_task` appends with no id
// dedupe, `unqueue_task` removes one entry per id), so a callback can be handed
// a logic data whose unit is already gone. Any dereference then faults in engine
// code, not in Lua, so every detection entry point and every queued update that
// owns one needs a liveness gate, and a pcall would not help.

const DETECTION_ENTRIES = [
  ['lua/teamailogics/teamailogictravel.lua', 'TeamAILogicTravel._upd_enemy_detection'],
  ['lua/teamailogics/teamailogicidle.lua', 'TeamAILogicIdle._upd_enemy_detection'],
  ['lua/teamailogics/teamailogicassault.lua', 'TeamAILogicAssault._upd_enemy_detection'],
  ['lua/coplogics/coplogicidle.lua', 'CopLogicIdle._upd_enemy_detection'],
  ['lua/coplogics/coplogictravel.lua', 'CopLogicTravel._upd_enemy_detection'],
  ['lua/coplogics/coplogicattack.lua', 'CopLogicAttack._upd_enemy_detection'],
  ['lua/coplogics/coplogicarrest.lua', 'CopLogicArrest._upd_enemy_detection'],
  ['lua/coplogics/coplogicsniper.lua', 'CopLogicSniper._upd_enemy_detection'],
  ['lua/coplogics/specials/taserlogicattack.lua', 'TaserLogicAttack._upd_enemy_detection'],
  ['lua/coplogics/specials/shieldlogicattack.lua', 'ShieldLogicAttack._upd_enemy_detection'],
  ['lua/coplogics/specials/spooc/spooclogicidle.lua', 'SpoocLogicIdle._upd_enemy_detection'],
  ['lua/coplogics/boss/bosslogicattack.lua', 'LIESBossLogicAttack._upd_enemy_detection'],
  ['lua/civlogics/civilianlogicidle.lua', 'CivilianLogicIdle._upd_detection'],
];

// The task the queue actually runs for the logics above: it calls the detection
// entry, then keeps dereferencing the unit.
const QUEUED_UPDATES = [
  ['lua/coplogics/coplogicidle.lua', 'CopLogicIdle.queued_update'],
  ['lua/coplogics/coplogictravel.lua', 'CopLogicTravel.queued_detection_update'],
  ['lua/coplogics/coplogicattack.lua', 'CopLogicAttack.queued_update'],
  ['lua/coplogics/coplogicarrest.lua', 'CopLogicArrest.queued_update'],
  ['lua/coplogics/specials/taserlogicattack.lua', 'TaserLogicAttack.queued_update'],
  ['lua/coplogics/specials/shieldlogicattack.lua', 'ShieldLogicAttack.queued_update'],
  ['lua/coplogics/coplogicphalanxminion.lua', 'CopLogicPhalanxMinion.queued_update'],
  ['lua/coplogics/boss/bosslogicattack.lua', 'LIESBossLogicAttack.queued_update'],
  ['lua/civlogics/civilianlogicsurrender.lua', 'CivilianLogicSurrender.queued_update'],
];

// Vanilla owns these bodies, so LIES wraps them instead of copying them.
// [file, name, captured local, delay returned instead of bare return]
const VANILLA_WRAPPERS = [
  ['lua/civlogics/civilianlogicflee.lua', 'CivilianLogicFlee._upd_detection', 'civ_flee_upd_detection', false],
  ['lua/civlogics/civilianlogicidle.lua', 'CivilianLogicIdle._upd_outline_detection', 'civ_idle_outline_detection', false],
  ['lua/teamailogics/teamailogicdisabled.lua', 'TeamAILogicDisabled._upd_enemy_detection', 'teamai_disabled_upd_enemy_detection', true],
  ['lua/coplogics/coplogicphalanxvip.lua', 'CopLogicPhalanxVip.queued_update', 'phalanx_vip_queued_update', false],
];

const stripped = (file) => stripLuaComments(read(...file.split('/')));

test('the shared detection pass refuses a dead unit before the first deref', () => {
  const body = funcBody(stripped('lua/coplogics/coplogicbase.lua'), 'function CopLogicBase._upd_attention_obj_detection(');

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
});

test('every detection entry is gated first and reports a delay, never nil', () => {
  for (const [file, name] of DETECTION_ENTRIES) {
    const body = funcBody(stripped(file), `function ${name}(`);

    assert.ok(
      firstStatement(body).startsWith(GUARD),
      `${file}: ${name} must start with the liveness guard`,
    );

    // A bare return here is a nil where callers do `data.t + delay`
    // (`CopLogicIdle.queued_update`) or `delay = 0.5 + delay * 1.5`, and
    // `data.logic._upd_enemy_detection` is polymorphic, so a stale task can hit
    // any logic's version. 2 is the shared pass's own default delay.
    assert.match(
      body,
      new RegExp(`${escape(GUARD)}\\s*return 2\\s*end`),
      `${file}: ${name} must return the 2 s default delay, not nil`,
    );
  }
});

test('the queued updates that run those entries are gated too', () => {
  for (const [file, name] of QUEUED_UPDATES) {
    const body = funcBody(stripped(file), `function ${name}(`);

    assert.ok(
      firstStatement(body).startsWith(GUARD),
      `${file}: ${name} must start with the liveness guard (it dereferences the unit after the detection call)`,
    );
    assert.match(
      body,
      new RegExp(`${escape(GUARD)}\\s*return\\s*end`),
      `${file}: ${name} must bail with a bare return`,
    );
  }
});

test('the vanilla-owned detection callbacks are wrapped, not copied', () => {
  for (const [file, name, captured, returnsDelay] of VANILLA_WRAPPERS) {
    const text = stripped(file);
    const body = funcBody(text, `function ${name}(`);

    const captureAt = text.indexOf(`local ${captured} = ${name}`);
    const wrapperAt = text.indexOf(`function ${name}(`);

    assert.notEqual(captureAt, -1, `${file}: the vanilla body must be captured before the wrapper replaces it`);
    assert.ok(captureAt < wrapperAt, `${file}: the capture must precede the wrapper (self-capture recurses)`);

    assert.ok(firstStatement(body).startsWith(GUARD), `${file}: ${name} wrapper must start with the guard`);
    assert.match(body, new RegExp(`return ${captured}\\(data\\)`), `${file}: the wrapper must delegate to vanilla`);
    assert.match(
      body,
      returnsDelay
        ? new RegExp(`${escape(GUARD)}\\s*return 2\\s*end`)
        : new RegExp(`${escape(GUARD)}\\s*return\\s*end`),
      `${file}: the wrapper's early return must match the callback's contract`,
    );
  }
});

test('no detection callback or queued update escapes the gate', () => {
  // Discovery is deliberately textual: it covers `lua/**` and the
  // `^function Table.name(` form that this codebase uses for logic methods.
  // The vanilla-owned entries that LIES queues are named explicitly in
  // VANILLA_WRAPPERS above instead, because their definition lives in the game
  // clone, not in this repo.
  const discovered = luaFiles(path.join(root, 'lua')).flatMap((file) => {
    const text = stripLuaComments(fs.readFileSync(file, 'utf8'));
    const found = [];
    const re = /^function ([A-Za-z0-9_.]+)\.(_upd_[a-z_]*detection|queued_update|queued_detection_update)\(/gm;
    let match;
    while ((match = re.exec(text))) found.push(`${match[1]}.${match[2]}`);
    return found;
  });

  const expected = [
    ...DETECTION_ENTRIES.map(([, name]) => name),
    ...QUEUED_UPDATES.map(([, name]) => name),
    ...VANILLA_WRAPPERS.map(([, name]) => name),
    'CopLogicBase._upd_attention_obj_detection',
    // Intimidated has carried its own liveness guard since 2a8bbb1; it is not
    // part of this list because its guard sits after the detection helper.
    'CopLogicIntimidated.queued_update',
  ].sort();

  assert.deepEqual(discovered.sort(), expected, 'a detection entry or queued update is missing from the gate');
});

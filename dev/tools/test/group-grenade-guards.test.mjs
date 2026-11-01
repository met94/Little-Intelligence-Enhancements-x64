import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the crash-class guards shipped in V8.82_x64 for the two group grenade
// checks, and pins the one shape nobody may "fix" without a recorded decision.
//
// Evidence: `dev/reports/group-grenade-audit.md` (sections 4 and 6).
//
// 1. `_chk_group_use_smoke_grenade` / `_chk_group_use_flash_grenade` dereference
//    `u_data.tracker:nav_segment()` with no liveness check, while the same file
//    guards the same field at `lua/groupaistate/groupaistatebesiege.lua:3877`
//    (`if u_data.tracker and alive(u_data.tracker) then`). `tracker:nav_segment()`
//    on a freed tracker is exactly the V8.68 engine-AV shape
//    (`dev/reports/aim-stale-nav-tracker-crash.md`). The guard is folded into the
//    enclosing per-unit condition - no extra nesting block - so the eye can read
//    one condition per unit gate.
// 2. The explicit-`detonate_pos` `else` branch in both functions reads `objective`
//    as an undefined global (`local objective` is declared only in the
//    `if not detonate_pos` branch), so no shooter is ever selected there and the
//    branch is dead. That is inherited pre-port behaviour present in every 8.x
//    build and matches vanilla's own "no throw when a position is handed in"
//    outcome. Reviving it turns charge-specific flashes/smokes back on - a real
//    difficulty change on Death Wish+ - so it stays dead until an explicit
//    decision, and this test keeps it dead by accident-proofing the shape.
//
// The fix spec, should that decision land: declare
// `local objective = u_data.unit:brain():objective()` inside the `else` loop of
// both functions (one line each), which also flips the dead-branch assertion
// below - intentionally, as the visible marker that the decision was taken.

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

const siegeSource = () => stripLuaComments(read('lua', 'groupaistate', 'groupaistatebesiege.lua'));

// Same extraction rule as `dev/tools/test/nav-gates.test.mjs`: every
// `GroupAIStateBesiege:` body starts at column 0, so the next `\nfunction ` opens
// the next definition.
function funcBody(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is missing`);
  const next = text.indexOf('\nfunction ', start + signature.length);
  return text.slice(start, next === -1 ? text.length : next);
}

const smokeBody = () => funcBody(siegeSource(), 'function GroupAIStateBesiege:_chk_group_use_smoke_grenade(');

const flashBody = () => funcBody(siegeSource(), 'function GroupAIStateBesiege:_chk_group_use_flash_grenade(');

// The innermost `if … then` that encloses a given source line: the first
// condition line found walking upward. Both tracker reads sit directly under
// their per-unit gate, so this resolves to the gate itself.
function enclosingCondition(lines, index) {
  for (let i = index; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('if ') && trimmed.endsWith('then')) {
      return trimmed;
    }
  }
  return null;
}

const trackerReads = (body) => {
  const lines = body.split('\n');
  const reads = [];
  lines.forEach((line, index) => {
    if (line.includes('u_data.tracker:nav_segment()')) {
      reads.push({ line, condition: enclosingCondition(lines, index) });
    }
  });
  return reads;
};

// The `else` arm of the `if not detonate_pos … else … end` split, i.e. the dead
// branch. Bounded by the shared tail (`detonate_pos = detonate_pos or to_det_pos`).
function detonateElseBranch(body) {
  const ifAt = body.indexOf('if not detonate_pos then');
  assert.notEqual(ifAt, -1, 'the detonate_pos split is missing');

  const elseAt = body.indexOf('\n\t\telse', ifAt);
  assert.notEqual(elseAt, -1, 'the explicit-detonate_pos else branch is missing');

  const endAt = body.indexOf('detonate_pos = detonate_pos or to_det_pos', elseAt);
  assert.notEqual(endAt, -1, 'the shared detonate tail is missing');

  return body.slice(elseAt, endAt);
}

// The `if not detonate_pos` arm, for the positive half of the same pin.
function detonateIfBranch(body) {
  const ifAt = body.indexOf('if not detonate_pos then');
  const elseAt = body.indexOf('\n\t\telse', ifAt);
  return body.slice(ifAt, elseAt);
}

for (const [label, bodyFn] of [
  ['_chk_group_use_smoke_grenade', smokeBody],
  ['_chk_group_use_flash_grenade', flashBody]
]) {
  test(`${label} guards every tracker nav_segment read with alive()`, () => {
    const reads = trackerReads(bodyFn());

    assert.ok(reads.length > 0, 'the tracker read is the whole point of the guard');
    for (const read of reads) {
      assert.ok(read.condition, 'the tracker read must sit under an if condition');
      assert.match(
        read.condition,
        /u_data\.tracker and alive\(u_data\.tracker\)/,
        `unguarded tracker read: "${read.line.trim()}" would fault on a freed tracker (V8.68 shape)`
      );
    }
  });

  test(`${label} keeps the per-unit gates that the tracker guard was folded into`, () => {
    const reads = trackerReads(bodyFn());

    for (const read of reads) {
      assert.match(
        read.condition,
        /chk_action_forbidden\("action"\)/,
        'the tray/mid-action gate is still on the same condition line'
      );
      assert.match(
        read.condition,
        /_anim_global ~= "shield"/,
        'the shield exclusion is still on the same condition line'
      );
      assert.match(
        read.condition,
        /mvec3_dis\(u_data\.m_pos, target_area\.pos\) < 4000000/,
        'the 2000-unit target-area range gate is still on the same condition line'
      );
    }

    // The guard is folded in, not a new nested block: no standalone liveness
    // block wrapping the read.
    const body = bodyFn();
    assert.doesNotMatch(
      body,
      /^\s*if u_data\.tracker and alive\(u_data\.tracker\) then\s*$/m,
      'keep the guard on the enclosing per-unit condition (no extra nesting)'
    );
  });

  test(`${label} keeps the explicit-detonate_pos branch dead (decision pending)`, () => {
    const elseBranch = detonateElseBranch(bodyFn());

    // The dead shape: `objective` is read as an undefined global here.
    assert.match(
      elseBranch,
      /objective and objective\.grp_objective == group\.objective/,
      'the else arm still tests the (currently undefined) objective'
    );

    // ...and it is NOT declared in this loop. Declaring it is the one-line fix
    // that makes charge flashes/smokes land on campers; that is a difficulty
    // change and needs an explicit decision (`dev/reports/group-grenade-audit.md`).
    assert.doesNotMatch(
      elseBranch,
      /local objective = u_data\.unit:brain\(\):objective\(\)/,
      'reviving the detonate_pos branch changes difficulty - record a decision first'
    );

    // The live branch still declares it per unit; a guard edit must not have
    // moved it out of scope there.
    assert.match(
      detonateIfBranch(bodyFn()),
      /local objective = u_data\.unit:brain\(\):objective\(\)/,
      'the door-based branch must keep resolving objective per unit'
    );
  });
}

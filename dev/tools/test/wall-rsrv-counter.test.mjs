import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the measurement invariant fixed after the 8.57.36 phalanx run:
//
// 1. Inside `lies_count_wall_rsrv`, `LIES:Count("wall_rsrv_hit")` must run
//    BEFORE the `recheck_own` `is_pos_free` test. The recheck exists for the
//    `fail_position` exit, where the point was chosen up to nine raycasts
//    earlier. Counting after the recheck dropped exactly those searches from the
//    denominator whenever a foreign reservation appeared meanwhile, which biased
//    `own_share` up (`own_delta / rsrv_delta` with the noisy hits removed).
// 2. `_get_pos_on_wall` calls the helper exactly twice - the ray-success exit and
//    the `fail_position` exit - and both calls sit behind the outer-call gate by
//    passing `is_outer`. A third call site, or an ungated one, changes what the
//    published delta means without changing any test that reads the counters.
//
// Evidence: `dev/reports/signature-audit.md` "Extra finding: the
// `_get_pos_on_wall` reservation filter was dead", and the card that produced
// the published run, `dev/test-harness/scenarios/phalanx_auc.lua`.

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

const travelSource = () =>
  stripLuaComments(read('lua', 'coplogics', 'coplogictravel.lua'));

// Every `function CopLogicTravel...` body starts at column 0, so the next
// `\nfunction ` opens the next definition (same rule as the other source pins).
function funcBody(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is missing`);
  const next = text.indexOf('\nfunction ', start + signature.length);
  return text.slice(start, next === -1 ? text.length : next);
}

const helperBody = () =>
  funcBody(travelSource(), 'local function lies_count_wall_rsrv(');

const wallBody = () =>
  funcBody(travelSource(), 'function CopLogicTravel._get_pos_on_wall(');

const COUNT = 'LIES:Count("wall_rsrv_hit")';
const RECHECK = 'if recheck_own and not managers.navigation:is_pos_free({';

test('the hit counter precedes the own-filter recheck', () => {
  const body = helperBody();
  const countAt = body.indexOf(COUNT);
  const recheckAt = body.indexOf(RECHECK);

  assert.notEqual(countAt, -1, `${COUNT} is missing from lies_count_wall_rsrv`);
  assert.notEqual(recheckAt, -1, 'the recheck_own is_pos_free test is missing');

  // Denominator first: a search that lost the point to a foreign reservation
  // during the ray loop still counts as a successful search and only loses the
  // own-hit classification.
  assert.ok(
    countAt < recheckAt,
    'wall_rsrv_hit must be counted before the recheck, or own_share is biased up',
  );
});

test('the own-hit counter stays behind the recheck and the probe filter', () => {
  const body = helperBody();
  const ownCount = body.indexOf('LIES:Count("wall_own_rsrv_hit")');
  const probeAt = body.indexOf('local probe_id = managers.navigation:get_pos_reservation_id()');
  const releaseAt = body.indexOf('managers.navigation:release_pos_reservation_id(probe_id)');

  assert.notEqual(ownCount, -1, 'wall_own_rsrv_hit is missing');
  assert.notEqual(probeAt, -1, 'the probe id allocation is missing');
  assert.notEqual(releaseAt, -1, 'the probe id release is missing');

  // The classification must read a freshly allocated id and give it back: a
  // cached id holds a `_pos_rsrv_filters` slot and a nav-manager re-init could
  // reissue it to a real unit.
  assert.ok(probeAt < releaseAt, 'the probe id must be released after the check');
  assert.ok(releaseAt < ownCount, 'the id must be released before the own-hit count');
});

test('_get_pos_on_wall calls the helper exactly twice, both gated by is_outer', () => {
  const body = wallBody();
  const calls = [...body.matchAll(/lies_count_wall_rsrv\(([^)]*)\)/g)];

  assert.equal(calls.length, 2, 'expected the ray-success and fail_position call sites only');

  const [rayCall, failCall] = calls.map((match) => match[1]);

  // 1. ray-success exit: `return ray_params.trace[1]` right after the call.
  assert.match(rayCall, /ray_params\.trace\[1\]/, 'the first call must pass the ray hit');
  assert.match(rayCall, /\bis_outer\b/, 'the first call must pass the outer-call gate');

  // 2. `fail_position` exit: the stored point plus the `recheck_own` flag.
  assert.match(failCall, /fail_position/, 'the second call must pass fail_position');
  assert.match(failCall, /\bis_outer\b/, 'the second call must pass the outer-call gate');
  assert.match(failCall, /\btrue\b/, 'the save-position exit must ask for the own-filter recheck');

  const failReturn = 'return fail_position';
  assert.ok(
    body.indexOf(COUNT) === -1,
    'the counter must not be incremented outside the helper',
  );
  assert.ok(
    body.indexOf(failCall) < body.indexOf(failReturn),
    'the fail_position call must run before its return',
  );
});

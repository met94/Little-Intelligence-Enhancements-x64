import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the 8.57.37 crash fix for the travel coarse-path index, and the recovery
// rule chosen for it.
//
// Crash: `mods/LIES/lua/coplogics/coplogictravel.lua:286: attempt to index a nil
// value`, reached via `CopLogicTravel.upd_advance` -> `_chk_start_pathing_to_next_nav_point`
// from an Iter `_advance_simplified_path` action callback. `coarse_path` can be
// replaced by a shorter path while a walk action is in flight (LinkLane's
// `beeline` installs a 2-point path; LIES `_upd_pathing` replaces it too), so
// `coarse_path[coarse_path_index + 1]` was nil.
//
// The recovery distinguishes two states, because the caller can reach the helper
// without its own arrival check:
//  - `index == #coarse_path` is a genuine end of path -> `_on_destination_reached`
//    and `travel_index_end` (the revive diagnostic, Safe House Raid, showed the
//    earlier blanket reset re-pathing a travelling bot in a loop, `travel_index_reset`
//    1 -> 4, so the revive never started);
//  - `index > #coarse_path` (or no usable path / a hole) is not an arrival - the
//    unit is not there - so the path is dropped (`coarse_path = nil`,
//    `coarse_path_index = nil`, plus the stale advance state) and
//    `travel_index_reset` is counted, letting the next travel update re-path from
//    the unit's actual position. Marking arrival there would complete a `free`
//    objective the unit never reached.
//
// Pinned here:
// 1. The walk-completion increment in `action_complete_clbk`: vanilla behaviour
//    is "increment, then clamp an over-range result to `#path`" (arrival). Only a
//    stale `going_to_index` from a shorter replacement path, or a missing/empty
//    path, is a reset. Dropping the path on a normal completion is what made the
//    revive bot loop (every loop logged `idx=3 len=2 going=nil`).
// 2. The cover-wait length read is nil-safe (`path_len`), because the reset can
//    run before it.
// 3. The three-way branch in `_chk_start_pathing_to_next_nav_point` (empty ->
//    end -> over-range), the counters, and no `_on_destination_reached` on the
//    reset branches.
// 4. `upd_advance`'s three arrival checks stay `>=`, and its path branch mirrors
//    the arrival check before asking for a next nav point.
// 5. Every path replacement clears `going_to_index`; `advancing` stays.

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

const resetBody = () => funcBody(travelSource(), 'function CopLogicTravel.action_complete_clbk(');
const advanceBody = () => funcBody(travelSource(), 'function CopLogicTravel.upd_advance(');
const beginAdvanceBody = () => funcBody(travelSource(), 'function CopLogicTravel._chk_begin_advance(');
const navPointBody = () =>
  funcBody(travelSource(), 'function CopLogicTravel._chk_start_pathing_to_next_nav_point(');
const pathAheadBody = () =>
  funcBody(travelSource(), 'function CopLogicTravel._check_start_path_ahead(');
const pathingBody = () => funcBody(travelSource(), 'function CopLogicTravel._upd_pathing(');
const enterBody = () => funcBody(travelSource(), 'function CopLogicTravel.enter(');

const RESET_COUNTER = 'LIES:Count("travel_index_reset")';
const PATH_NIL = 'my_data.coarse_path = nil';
const INDEX_NIL = 'my_data.coarse_path_index = nil';

test('walk completion clamps at the last point and resets only stale or broken indexes', () => {
  const body = resetBody();
  const targetAt = body.indexOf('local target = my_data.going_to_index or (my_data.coarse_path_index + 1)');
  const brokenAt = body.indexOf('if path_len == 0 or target < 1 then');
  const overAt = body.indexOf('elseif target > path_len then');
  const jumpAt = body.indexOf('if my_data.going_to_index then', overAt);
  const clampAt = body.indexOf('my_data.coarse_path_index = path_len', overAt);

  assert.notEqual(targetAt, -1, 'the completion target must come from going_to_index or the next index');
  assert.notEqual(brokenAt, -1, 'the broken-path branch is missing');
  assert.notEqual(overAt, -1, 'the over-range branch is missing');
  assert.notEqual(jumpAt, -1, 'the stale-jump test is missing');
  assert.notEqual(clampAt, -1, 'the vanilla clamp at the last point is missing');
  assert.ok(targetAt < brokenAt && brokenAt < overAt && overAt < clampAt, 'branch order must be broken -> over-range -> clamp');

  // Normal completion at the last point is arrival (vanilla clamps to #path):
  // it must not drop the path or count a reset.
  const clampBranch = body.slice(clampAt, body.indexOf('end', clampAt) + 3);

  assert.ok(!clampBranch.includes(PATH_NIL), 'the clamp must keep the path');
  assert.ok(!clampBranch.includes(RESET_COUNTER), 'the clamp is not a reset');
  assert.doesNotMatch(
    body,
    /my_data\.coarse_path_index = my_data\.coarse_path_index - 1/,
    'the old subtract-one clamp must not come back',
  );
  assert.doesNotMatch(body, /travel_index_clamped/, 'the counter is travel_index_reset / travel_index_end');

  // A stale jump index (path replaced by a shorter one) is still a reset, and so
  // is a missing/empty path or an impossible target.
  const jumpBranch = body.slice(jumpAt, body.indexOf('else', jumpAt));

  assert.ok(jumpBranch.includes(PATH_NIL), 'a stale jump must drop coarse_path');
  assert.ok(jumpBranch.includes(INDEX_NIL), 'a stale jump must drop coarse_path_index');
  assert.ok(jumpBranch.includes(RESET_COUNTER), 'a stale jump must count travel_index_reset');
  assert.ok(jumpBranch.includes('my_data.advance_path = nil'), 'a stale jump must clear advance_path');
  assert.ok(
    jumpBranch.includes('my_data.processing_advance_path = nil'),
    'a stale jump must clear processing_advance_path',
  );

  const brokenBranch = body.slice(brokenAt, overAt);

  assert.ok(brokenBranch.includes(PATH_NIL), 'a broken path must drop coarse_path');
  assert.ok(brokenBranch.includes(RESET_COUNTER), 'a broken path must count travel_index_reset');
});

test('the cover-wait length read tolerates a nil path', () => {
  const body = resetBody();
  const nilSafeReads = body.match(/local path_len = my_data\.coarse_path and #my_data\.coarse_path or 0/g) ?? [];

  // One for the reset test, one for the cover-wait comparison.
  assert.ok(nilSafeReads.length >= 2, 'both the reset test and the cover wait must use the nil-safe length');
  assert.match(
    body,
    /local cover_wait_time = my_data\.coarse_path_index == path_len - 1/,
    'the cover-wait comparison must read the nil-safe length, not #coarse_path',
  );
  assert.doesNotMatch(
    body,
    /my_data\.coarse_path_index == #my_data\.coarse_path - 1/,
    'the raw #coarse_path read would raise after the reset',
  );
});

test('upd_advance treats an index at or past the end as arrival', () => {
  const body = advanceBody();
  const atEnd = body.match(/my_data\.coarse_path_index >= #my_data\.coarse_path/g) ?? [];
  const exact = body.match(/my_data\.coarse_path_index == #my_data\.coarse_path/g) ?? [];

  assert.equal(atEnd.length, 3, 'all three arrival checks must use >=');

  // The one `==` is the mirrored arrival check in the path branch (pinned by the
  // next test); it must not replace any of the three `>=` checks.
  assert.equal(exact.length, 1, 'only the mirrored path-branch arrival check may use ==');
  assert.ok(
    body.indexOf('my_data.coarse_path_index == #my_data.coarse_path') >
      body.indexOf('elseif my_data.coarse_path and not my_data.advancing then'),
    'the == check must live in the path branch, not in an arrival check',
  );
});

test('_chk_start_pathing_to_next_nav_point treats the last index as arrival', () => {
  const body = navPointBody();

  // The revive diagnostic (Safe House Raid) showed this helper resetting at the
  // last point (`travel_index_reset` 1 -> 4) while the bot oscillated: the
  // caller can reach the helper without its own arrival check, so the helper has
  // to branch on the index itself.
  const emptyAt = body.indexOf('if not index or path_len == 0 then');
  const endAt = body.indexOf('elseif index == path_len then');
  const overAt = body.indexOf('elseif index > path_len then');

  assert.notEqual(emptyAt, -1, 'the empty/no-index branch is missing');
  assert.notEqual(endAt, -1, 'the end-of-path arrival branch is missing');
  assert.notEqual(overAt, -1, 'the over-range reset branch is missing');
  assert.ok(emptyAt < endAt && endAt < overAt, 'the branches must be ordered empty -> end -> over-range');

  const emptyBranch = body.slice(emptyAt, endAt);

  assert.ok(emptyBranch.includes(RESET_COUNTER), 'no usable path must count a reset');

  const endBranch = body.slice(endAt, overAt);

  assert.ok(endBranch.includes('LIES:Count("travel_index_end")'), 'arrival must count travel_index_end');
  assert.match(
    endBranch,
    /CopLogicTravel\._on_destination_reached\(data\)/,
    'arrival at the last point must finish the leg',
  );
  assert.ok(!endBranch.includes(PATH_NIL), 'the arrival branch must not drop the path');

  const overBranch = body.slice(overAt, body.indexOf('local next_entry', overAt));

  assert.ok(overBranch.includes(PATH_NIL), 'the over-range branch must drop coarse_path');
  assert.ok(overBranch.includes(INDEX_NIL), 'the over-range branch must drop coarse_path_index');
  assert.ok(overBranch.includes(RESET_COUNTER), 'the over-range branch must count travel_index_reset');
  assert.doesNotMatch(
    overBranch,
    /_on_destination_reached/,
    'an over-range index is not an arrival (the unit is not there)',
  );

  // A hole mid-path still resets; end-of-path is handled above and cannot reach it.
  const holeAt = body.indexOf('local next_entry = my_data.coarse_path[my_data.coarse_path_index + 1]');

  assert.notEqual(holeAt, -1, 'the next-entry read must be guarded');

  const hole = body.slice(holeAt, body.indexOf('local nav_link', holeAt));

  assert.match(hole, /if not next_entry then/, 'a missing entry must be tested');
  assert.ok(hole.includes(RESET_COUNTER), 'a hole must count travel_index_reset');
  assert.match(hole, /\breturn\b/, 'the hole guard must return before touching the entry');
  assert.doesNotMatch(hole, /_on_destination_reached/, 'a hole must not mark arrival');

  // The immediately following read uses the guarded local.
  assert.match(body, /local nav_link = next_entry\[3\]/, 'the nav-link read must use the guarded entry');
});

test('upd_advance finishes the leg before asking for a next nav point', () => {
  const body = advanceBody();
  const branchAt = body.indexOf('elseif my_data.coarse_path and not my_data.advancing then');

  assert.notEqual(branchAt, -1, 'the path branch is missing');

  assert.match(
    body.slice(branchAt, branchAt + 1200),
    /if my_data\.coarse_path_index == #my_data\.coarse_path then\s*CopLogicTravel\._on_destination_reached\(data\)\s*else\s*CopLogicTravel\._chk_start_pathing_to_next_nav_point\(data, my_data\)\s*end/,
    'the branch must mirror the arrival check instead of always asking for a next nav point',
  );
});

test('every reset site also clears the stale advance path', () => {
  // A reset that leaves `advance_path` set makes the same action callback run
  // `_chk_begin_advance` with a nil index and crash at `coarse_path_index + 1`
  // (live crash, 17:10:43 on 868d48f). `processing_coarse_path` is deliberately
  // kept: an in-flight coarse search installs a fresh path in its callback.
  for (const [label, body] of [
    ['action_complete_clbk', resetBody()],
    ['_chk_start_pathing_to_next_nav_point', navPointBody()],
  ]) {
    const counterAt = body.indexOf(RESET_COUNTER);

    assert.notEqual(counterAt, -1, `${label}: the reset counter is missing`);

    const reset = body.slice(Math.max(0, counterAt - 400), counterAt);

    assert.ok(reset.includes('my_data.advance_path = nil'), `${label}: the reset must clear advance_path`);
    assert.ok(
      reset.includes('my_data.processing_advance_path = nil'),
      `${label}: the reset must clear processing_advance_path`,
    );
    assert.ok(
      !reset.includes('my_data.processing_coarse_path = nil'),
      `${label}: the reset must not cancel an in-flight coarse search`,
    );
  }
});

test('_chk_begin_advance bails before any index arithmetic', () => {
  const body = beginAdvanceBody();
  const guardAt = body.indexOf('if not my_data.coarse_path or not my_data.coarse_path_index then');
  const arithmeticAt = body.indexOf('my_data.going_to_index or my_data.coarse_path_index + 1');

  assert.notEqual(guardAt, -1, 'the advance guard is missing');
  assert.notEqual(arithmeticAt, -1, 'the to_index expression must stay in the function');
  assert.ok(guardAt < arithmeticAt, 'the guard must run before the index arithmetic');

  const guard = body.slice(guardAt, body.indexOf('\n', body.indexOf('return', guardAt)));

  assert.ok(guard.includes('my_data.advance_path = nil'), 'the bail must clear advance_path');
  assert.ok(
    guard.includes('my_data.processing_advance_path = nil'),
    'the bail must clear processing_advance_path so the next update starts a fresh path',
  );
  assert.doesNotMatch(guard, /coarse_path_index \+ 1/, 'the bail must not do arithmetic first');
});

test('_check_start_path_ahead bails on a nil path or jump index', () => {
  const body = pathAheadBody();
  const guardAt = body.indexOf('if not coarse_path or not my_data.going_to_index then');
  const nextIndexAt = body.indexOf('local next_index = my_data.going_to_index + 1');
  const totalAt = body.indexOf('local total_nav_points = #coarse_path');

  assert.notEqual(guardAt, -1, 'the coarse-path / going_to_index guard is missing');
  assert.ok(guardAt < nextIndexAt, 'the guard must sit before `going_to_index + 1`');
  assert.ok(guardAt < totalAt, 'the guard must sit before the path length read');
  assert.match(
    body.slice(guardAt),
    /if not coarse_path or not my_data\.going_to_index then\s*return\s*end/,
    'a nil path or jump index must simply return',
  );
});

test('_check_start_path_ahead guards its next entry too', () => {
  const body = pathAheadBody();
  const nextIndexAt = body.indexOf('local next_index = my_data.going_to_index + 1');
  const guardAt = body.indexOf('local next_entry = coarse_path[next_index]');

  assert.notEqual(guardAt, -1, 'the next-entry guard is missing');
  assert.ok(nextIndexAt !== -1 && nextIndexAt < guardAt, 'the guard must follow the index computation');
  assert.match(
    body.slice(guardAt),
    /if not next_entry then\s*return\s*end/,
    'a missing next entry must simply return',
  );
  assert.ok(
    body.indexOf('if next_index > total_nav_points then') < guardAt,
    'the guard must sit after the existing bounds check',
  );
});

test('_chk_close_to_criminal guards the area lookup', () => {
  // Open issue #2 (Safe House Raid MP): `get_area_from_nav_seg_id` can return nil
  // while the unit's nav segment is not mapped to an area, and the unguarded
  // `my_area.nav_segs[u_data_seg]` read raised "attempt to index a nil value".
  // The next-area branch keeps working when `my_area` is nil.
  const body = funcBody(travelSource(), 'function CopLogicTravel._chk_close_to_criminal(');

  assert.match(
    body,
    /if my_area and my_area\.nav_segs\[u_data_seg\] then/,
    'the own-area read must test my_area first',
  );
  assert.match(
    body,
    /elseif next_area and next_area\.nav_segs\[u_data_seg\] then/,
    'the next-area fallback must keep its own guard',
  );

  // No unguarded `my_area.nav_segs` read anywhere: every occurrence must be
  // preceded by the `my_area and` guard (the `next_area` symbol is separate).
  const unguarded = [...body.matchAll(/(?<!my_area and )my_area\.nav_segs\[/g)];

  assert.equal(
    unguarded.length,
    0,
    'an unguarded my_area.nav_segs read remains (it raises when the area lookup returns nil)',
  );
});

test('every coarse-path replacement clears the pending jump index', () => {
  // `enter`: both path styles assign a new path/index.
  const enter = enterBody();
  const enterClears = enter.match(/my_data\.going_to_index = nil/g) ?? [];

  assert.equal(enterClears.length, 2, 'both enter path branches must clear going_to_index');
  assert.doesNotMatch(
    enter,
    /my_data\.advancing = nil/,
    'replacing a path must not clear advancing (the walk action may still run on the new path)',
  );

  // `_upd_pathing`: the async search result installs the new path and index.
  const pathing = pathingBody();

  assert.match(
    pathing,
    /my_data\.coarse_path = path\s*my_data\.coarse_path_index = 1\s*my_data\.going_to_index = nil/,
    '_upd_pathing must clear going_to_index when it installs a new path',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the three nav-v6 merge leftovers reported by
// `dev/reports/nav-v6-remaining-audit.md` ("Real gaps"):
//
// 1. `register_cover_units` must pass the create flag to `get_script_data`, as
//    vanilla 248.2 does (`lib/managers/navigationmanager.lua:849`). Without it a
//    legacy cover-unit map gets no script-data extension and the following
//    `.covers` write indexes nil.
// 2. `_execute_coarce_search` must gate nav-link candidates on
//    `t > door:delay_time()` (`248.2:1257`, `246.1@a3180fc:1829`). A nav link
//    that is still cooling down is otherwise treated as traversable immediately.
// 3. `_sort_nav_segs_after_pos` needs the same gate (`248.2:1368`,
//    `246.1@a3180fc:1952`), with one timestamp per search/sort.
//
// `246.1@...` citations name the commit the line was read from, the 246.1
// restyle pivot `a3180fc`; the manifest baseline `b36f5fbb` (what `pd2fn -From
// 246.1` reads) carries the same bodies at different offsets (1801/1924).
//
// The two delay-gate checks are asserted on the condition line itself, because
// the cheap timestamp comparison must come before the engine calls - and on
// EVERY line carrying `delay_time()` in each function, so a second nav-link
// branch cannot slip in with the gate in the wrong order.
//
// Deliberate LIES constructs this test also guards: the 4-tuple path with
// `is_obstructed()` in `_execute_coarce_search` (AI-06), the 7-argument
// `_sort_nav_segs_after_pos` signature, its two-term A*-style weight, and the
// 246.1 loop/found_segs shapes. A stray 248.2 restyle would drop those.

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

const navSource = () => stripLuaComments(read('lua', 'managers', 'navigationmanager.lua'));

// Every `NavigationManager:` body in this file starts at column 0, so the next
// `\nfunction ` is the next definition. Comments are stripped first, which is
// what keeps the `-- vanilla 248.2:...` citations out of the assertions.
function funcBody(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is missing`);
  const next = text.indexOf('\nfunction ', start + signature.length);
  return text.slice(start, next === -1 ? text.length : next);
}

const coverUnitsBody = () => funcBody(navSource(), 'function NavigationManager:register_cover_units()');

const coarseBody = () => funcBody(navSource(), 'function NavigationManager:_execute_coarce_search(search_data)');

const sortBody = () =>
  funcBody(
    navSource(),
    'function NavigationManager:_sort_nav_segs_after_pos(to_pos, from_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)'
  );

// Every source line carrying a marker; condition ordering is positional inside
// that one line, and every match is checked so a second nav-link branch cannot
// hide a mis-ordered gate behind the first.
function linesWith(body, marker) {
  const lines = body.split('\n').filter((candidate) => candidate.includes(marker));
  assert.ok(lines.length > 0, `no line carries ${marker}`);
  return lines;
}

// The first such line, for assertions that only describe the branch shape.
function lineWith(body, marker) {
  return linesWith(body, marker)[0];
}

test('register_cover_units passes the 248.2 create flag to get_script_data', () => {
  const body = coverUnitsBody();

  assert.match(
    body,
    /get_script_data\(nav_tracker, true\)/,
    'the legacy cover-unit branch must create the script-data extension (248.2:849)'
  );

  assert.doesNotMatch(
    body,
    /get_script_data\(nav_tracker\)/,
    'the flag-less 1-argument form would leave location_script_data nil'
  );

  // The `.covers` write the flag protects is still there.
  assert.match(body, /location_script_data\.covers/);
});

test('_execute_coarce_search hoists one timestamp before the search loop', () => {
  const body = coarseBody();
  const tAt = body.indexOf('local t = TimerManager:game():time()');
  const loopAt = body.indexOf('while true do');

  assert.notEqual(tAt, -1, 'the search must read the timer once (248.2:1257 hoists it)');
  assert.notEqual(loopAt, -1, "LIES keeps the 246.1 'while true' loop");
  assert.ok(tAt < loopAt, 'the timestamp must be declared before the loop, not per iteration');
});

test('_sort_nav_segs_after_pos hoists one timestamp before the neighbour loop', () => {
  const body = sortBody();
  const tAt = body.indexOf('local t = TimerManager:game():time()');
  const loopAt = body.indexOf('for neighbour_seg_id, door_list in pairs(neighbours) do');

  assert.notEqual(tAt, -1, 'the sort must read the timer once (248.2:1368)');
  assert.notEqual(loopAt, -1, 'the neighbour loop is unchanged');
  assert.ok(tAt < loopAt, 'the timestamp must be declared before the loop, not per door');
});

test('the coarse search gates nav links on delay_time before check_access', () => {
  const lines = linesWith(coarseBody(), 'delay_time()');

  for (const line of lines) {
    const delayAt = line.indexOf('delay_time()');
    const accessAt = line.indexOf('check_access');

    assert.ok(delayAt !== -1 && accessAt !== -1, 'the nav-link branch must carry both the gate and the access check');
    assert.ok(delayAt < accessAt, 'the cheap timestamp comparison runs before the engine access check (248.2:1257 order)');
    assert.match(line, /^\s*elseif t > i_door:delay_time\(\) and i_door:check_access\(/, 'the gate is a strict greater-than on the hoisted t');
  }
});

test('_sort_nav_segs_after_pos gates nav links on delay_time before check_access', () => {
  const lines = linesWith(sortBody(), 'delay_time()');

  for (const line of lines) {
    const delayAt = line.indexOf('delay_time()');
    const accessAt = line.indexOf('check_access');

    assert.ok(delayAt !== -1 && accessAt !== -1, 'the nav-link branch must carry both the gate and the access check');
    assert.ok(delayAt < accessAt, 'the gate precedes the access check');
    assert.match(line, /t > door:delay_time\(\)/, 'the gate is a strict greater-than on the hoisted t');
  }
});

test('the delay gate is added to the existing conditions, not replacing their terms', () => {
  const coarseLine = lineWith(coarseBody(), 'delay_time()');
  const sortLine = lineWith(sortBody(), 'delay_time()');

  // LIES adds `is_obstructed()` to the nav-link entry test (248.2 has only
  // delay + access); it must survive the merge.
  assert.match(coarseLine, /not i_door:is_obstructed\(\)/, 'the AI-06 obstructed term stays in the coarse search');

  assert.match(sortLine, /alive\(door\) and not door:is_obstructed\(\) and t > door:delay_time\(\)/);

  // The sort keeps dead-link skipping instead of 248.2's debug_pause.
  assert.doesNotMatch(sortBody(), /debug_pause\(/, 'a debug_pause in the nav hot path is a deliberate non-port');
});

test('the deliberate LIES shapes survive: 4-tuple path and 246.1 loop', () => {
  const body = coarseBody();

  // 4-tuple path entries (AI-06): nav_link and multiple_nav_links are carried.
  assert.match(body, /search_data\.to_pos,\s*\n\s*nav_link_element,\s*\n\s*has_multiple_navlink_elements/);
  assert.match(body, /next_search_seg\.nav_link,\s*\n\s*next_search_seg\.multiple_nav_links/);
  assert.match(body, /this_seg\.nav_link,\s*\n\s*this_seg\.multiple_nav_links/);

  // The 248.2 `for i = 1, 500` restyle was not adopted.
  assert.match(body, /if i == 500 then/);
  assert.doesNotMatch(body, /for i = 1, 500 do/, 'the 248.2 loop restructure is out of scope');
  assert.match(body, /local all_nav_segments = self\._nav_segments/, 'the per-iteration lookup is LIES keeping 246.1 shape');
});

test('_sort_nav_segs_after_pos keeps its 7-argument signature and two-term weight', () => {
  const body = sortBody();

  assert.match(
    body,
    /^function NavigationManager:_sort_nav_segs_after_pos\(to_pos, from_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg\)/,
    'the extra from_pos parameter is LIES contract, never a 248.2 6-arg signature'
  );

  assert.match(
    body,
    /local weight = mvec3_dis\(from_pos, door_pos\) \+ mvec3_dis\(door_pos, to_pos\)/,
    'the two-term g+h weight is the cost-aware LIES search'
  );

  // The 248.2 `check_segment` closure restructure would displace both.
  assert.doesNotMatch(body, /local function check_segment\(/, 'keep the flat body; the closure port is out of scope');
  assert.match(body, /nav_link = nav_link/, 'the used nav link is still carried into segment data');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the LIES 8.57.36 stale-signature pass (Phalanx crash, issue #4) so a
// future port cannot re-introduce a positional shift by copying a game body or
// a LIES body across the two conventions.
//
// The convention, decided in `dev/reports/signature-audit.md`:
//
//   game parameter order first, LIES-only context as optional TRAILING
//   arguments, never type-sniffed at runtime.
//
// A leading or inserted LIES argument is invisible in game code: the game calls
// with its own order, the shifted values land in the wrong slots and the first
// dereference of an `objective`/count that is now nil crashes. That is exactly
// what `calc_initial_phalanx_pos(own_pos, objective)` hit when LIES declared
// `(data, own_pos, objective)`: `data` = Vector3, `own_pos` = objective,
// `objective` = nil -> `attempt to index local 'objective'`.
//
// Game 249 anchors for the four that carry LIES logic (source of truth:
// `game-data/Payday-2-LuaJIT-Complete` at `ccabb39e`):
//
//   lib/units/enemies/cop/logics/coplogicphalanxminion.lua:287
//     `(center_pos, angle, phalanx_minion_count)`
//   lib/units/enemies/cop/logics/coplogicphalanxminion.lua:414
//     `(own_pos, objective)`
//   lib/units/enemies/cop/logics/coplogicattack.lua:930
//     `(from_pos, threat_pos, threat_head_pos, threat_tracker, max_dist,
//      vis_required)`
//   lib/managers/navigationmanager.lua:1342
//     `(to_pos, i_seg, ignore_seg, verify_clbk, access_pos, access_neg)`
//
// The remaining seven keep their game arity and append one optional LIES
// argument (reservation id, side vector, target area, cache flag, center-only).

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

// Comment stripping that respects strings and long brackets, because several
// call sites sit next to explanatory `--` comments and a naive pass would
// either cut code at a `--` inside a string or count commented-out calls.
function stripLuaComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === '"' || ch === "'") {
      const start = i;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === ch) {
          i++;
          break;
        }
        i++;
      }
      out += source.slice(start, i);
      continue;
    }

    if (ch === '[') {
      const long = /^\[(=*)\[/.exec(source.slice(i));
      if (long) {
        const close = ']' + long[1] + ']';
        const end = source.indexOf(close, i + long[0].length);
        const stop = end === -1 ? source.length : end + close.length;
        out += source.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (source.startsWith('--', i)) {
      if (source.startsWith('--[[', i)) {
        const end = source.indexOf(']]', i + 4);
        i = end === -1 ? source.length : end + 2;
        continue;
      }
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    out += ch;
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

const rel = (file) => path.relative(root, file).replace(/\\/g, '/');
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineAt = (code, at) => code.slice(0, at).split('\n').length;

// A match on `name(` is a declaration when a `function` keyword is the only
// thing between the line start and the name (`function X.y(`, `local function
// X:y(`) - those are signatures, not calls.
function isDeclaration(code, at) {
  const head = code.slice(code.lastIndexOf('\n', at) + 1, at);
  return /(^|\s)(local\s+)?function\s+[\w.:]*$/.test(head);
}

// Depth-aware argument splitter: commas inside `(...)`, `[...]` and `{...}` do
// not separate arguments, so `unit:brain()._logic_data` and nested call
// arguments stay one argument. `openIndex` points at the opening parenthesis.
function callArguments(code, openIndex) {
  const args = [];
  let depth = 1;
  let current = '';
  let i = openIndex + 1;

  while (i < code.length) {
    const ch = code[i];

    if (ch === '"' || ch === "'") {
      const start = i;
      i++;
      while (i < code.length) {
        if (code[i] === '\\') {
          i += 2;
          continue;
        }
        if (code[i] === ch) {
          i++;
          break;
        }
        i++;
      }
      current += code.slice(start, i);
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
      i++;
      continue;
    }

    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        const last = current.replace(/\s+/g, ' ').trim();
        if (last) args.push(last);
        return args;
      }
      current += ch;
      i++;
      continue;
    }

    if (ch === ',' && depth === 1) {
      args.push(current.replace(/\s+/g, ' ').trim());
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  return null;
}

// Every call of a bare function name (class prefix ignored: LIES reaches the
// phalanx helpers both as `CopLogicPhalanxMinion.x(...)` and `logic.x(...)`),
// across `lua/**/*.lua`, definitions excluded.
function allCallSites(name) {
  const pattern = new RegExp(escapeRe(name) + '\\s*\\(', 'g');
  const sites = [];

  for (const file of luaFiles(path.join(root, 'lua'))) {
    const code = stripLuaComments(fs.readFileSync(file, 'utf8'));
    let match;

    while ((match = pattern.exec(code))) {
      if (isDeclaration(code, match.index)) continue;
      const args = callArguments(code, match.index + match[0].length - 1);
      assert.notEqual(args, null, `${rel(file)}:${lineAt(code, match.index)}: unbalanced ${name}( call`);
      sites.push({ file: rel(file), line: lineAt(code, match.index), args, where: `${rel(file)}:${lineAt(code, match.index)}` });
    }
  }

  return sites;
}

function declaration(code, qualified) {
  const pattern = new RegExp('function\\s+' + escapeRe(qualified) + '\\s*\\(', 'g');
  const found = [];
  let match;

  while ((match = pattern.exec(code))) {
    found.push({ at: match.index, args: callArguments(code, match.index + match[0].length - 1) });
  }

  return found;
}

// `args` is the complete parameter list in declaration order; the exactness is
// the point - a moved, inserted or dropped parameter fails here even when every
// caller was updated consistently.
const DEFINITIONS = [
  {
    file: 'lua/coplogics/coplogicphalanxminion.lua',
    qualified: 'CopLogicPhalanxMinion._calc_pos_on_phalanx_circle',
    args: ['center_pos', 'angle', 'phalanx_minion_count', 'data'],
  },
  {
    file: 'lua/coplogics/coplogicphalanxminion.lua',
    qualified: 'CopLogicPhalanxMinion.calc_initial_phalanx_pos',
    args: ['own_pos', 'objective', 'data'],
  },
  {
    file: 'lua/coplogics/coplogicattack.lua',
    qualified: 'CopLogicAttack._find_retreat_position',
    args: ['from_pos', 'threat_pos', 'threat_head_pos', 'threat_tracker', 'max_dist', 'vis_required', 'data'],
  },
  {
    file: 'lua/managers/navigationmanager.lua',
    qualified: 'NavigationManager:_sort_nav_segs_after_pos',
    args: ['to_pos', 'i_seg', 'ignore_seg', 'verify_clbk', 'access_pos', 'access_neg', 'from_pos'],
  },
  {
    file: 'lua/coplogics/coplogicintimidated.lua',
    qualified: 'CopLogicIntimidated.queued_update',
    args: ['rubbish', 'data'],
  },
  {
    file: 'lua/coplogics/coplogictravel.lua',
    qualified: 'CopLogicTravel._get_pos_on_wall',
    args: ['from_pos', 'max_dist', 'step_offset', 'is_recurse', 'pos_rsrv_id'],
  },
  {
    file: 'lua/copextensions/copbrain.lua',
    qualified: 'CopBrain:clbk_pathing_results',
    args: ['search_id', 'path', 'do_not_cache'],
  },
  {
    file: 'lua/coplogics/coplogicattack.lua',
    qualified: 'CopLogicAttack._peek_for_pos_sideways',
    args: ['data', 'my_data', 'from_racker', 'peek_to_pos', 'height', 'short_back_vec'],
  },
  {
    file: 'lua/groupaistate/groupaistatebesiege.lua',
    qualified: 'GroupAIStateBesiege:_chk_group_use_flash_grenade',
    args: ['group', 'task_data', 'detonate_pos', 'target_area'],
  },
  {
    file: 'lua/groupaistate/groupaistatebesiege.lua',
    qualified: 'GroupAIStateBesiege:_chk_group_use_smoke_grenade',
    args: ['group', 'task_data', 'detonate_pos', 'target_area'],
  },
  {
    file: 'lua/managers/navigationmanager.lua',
    qualified: 'NavigationManager:find_segment_doors',
    args: ['from_seg_id', 'approve_clbk', 'center_only'],
  },
];

test('the audited LIES definitions keep the game argument order', () => {
  for (const expected of DEFINITIONS) {
    const code = stripLuaComments(read(expected.file));
    const found = declaration(code, expected.qualified);

    assert.equal(found.length, 1, `${expected.file} must define ${expected.qualified} exactly once`);
    assert.deepEqual(
      found[0].args,
      expected.args,
      `${expected.qualified} (${expected.file}): the game order comes first and the LIES context is trailing`
    );
  }
});

test('TeamAILogicAssault.find_enemy_to_mark is not shadowed', () => {
  const shadows = [];

  for (const file of luaFiles(path.join(root, 'lua'))) {
    const code = stripLuaComments(fs.readFileSync(file, 'utf8'));
    if (/function\s+TeamAILogicAssault\.find_enemy_to_mark\s*\(/.test(code)) shadows.push(rel(file));
  }

  // The vanilla helper takes the detected-attention-object table and uses a
  // different heuristic; LIES' helper takes the logic `data`. Same arity, so a
  // definition would silently replace vanilla behaviour rather than crash.
  assert.deepEqual(shadows, [], 'the private helper must stay named _find_enemy_to_mark_from_data');

  const assault = stripLuaComments(read('lua', 'teamailogics', 'teamailogicassault.lua'));
  const helper = declaration(assault, 'TeamAILogicAssault._find_enemy_to_mark_from_data');

  assert.equal(helper.length, 1, 'the private helper must exist exactly once');
  assert.deepEqual(helper[0].args, ['data']);

  const calls = allCallSites('_find_enemy_to_mark_from_data');
  assert.equal(calls.length, 2, `both LIES call sites use the private helper, got ${calls.length}`);

  for (const call of calls) {
    assert.deepEqual(call.args, ['data'], `${call.where}: the private helper takes the logic data`);
  }
});

test('_get_pos_on_wall calls keep the reservation id in the 5th slot', () => {
  const sites = allCallSites('_get_pos_on_wall');

  // Twelve LIES callers + two game-convention 2-arg callers + the internal
  // retry recursion. A new caller must be reviewed against the reservation
  // contract, so the count is pinned.
  assert.equal(sites.length, 15, `expected the twelve LIES callers plus three others, got ${sites.length}`);

  for (const site of sites) {
    assert.ok(
      site.args.length <= 5,
      `${site.where}: ${site.args.length} arguments - the declaration takes 5, so a 6th lands in an ignored slot and the reservation filter dies`
    );

    if (site.args[site.args.length - 1] === 'data.pos_rsrv_id') {
      assert.equal(
        site.args.length,
        5,
        `${site.where}: data.pos_rsrv_id is the 5th argument (pos_rsrv_id), never a stray trailing 6th`
      );
    }
  }

  const withReservation = sites.filter((site) => site.args[site.args.length - 1] === 'data.pos_rsrv_id');
  assert.equal(withReservation.length, 12, 'every LIES caller passes its own reservation id');
});

test('the phalanx helpers are called with their LIES context last', () => {
  const initial = allCallSites('calc_initial_phalanx_pos');

  // The game's own two-argument call (PhalanxVip) must keep working, so the two
  // LIES callers can only append `data`.
  assert.deepEqual(
    initial.map((site) => `${site.file}: ${site.args.join(', ')}`).sort(),
    [
      'lua/coplogics/coplogicphalanxminion.lua: data.m_pos, objective, data',
      'lua/coplogics/coplogicphalanxvip.lua: data.m_pos, objective',
      'lua/coplogics/coplogictravel.lua: data.m_pos, objective, data',
    ].sort()
  );

  for (const site of initial) {
    assert.notEqual(
      site.args[0],
      'data',
      `${site.where}: a leading data argument hands the game Vector3 in the data slot and nil as objective`
    );
  }

  const circle = allCallSites('_calc_pos_on_phalanx_circle');

  assert.deepEqual(
    circle.map((site) => `${site.file}: ${site.args.join(', ')}`).sort(),
    [
      'lua/coplogics/coplogicphalanxminion.lua: center_pos, angle_to_move_to, total_minion_amount, data',
      'lua/coplogics/coplogicphalanxminion.lua: center_pos, angle_to_move_to, phalanx_minion_count, unit:brain()._logic_data',
      'lua/coplogics/coplogicphalanxvip.lua: center_pos, angle_to_move_to, phalanx_minion_count, unit:brain()._logic_data',
    ].sort()
  );

  for (const site of circle) {
    assert.equal(site.args.length, 4, `${site.where}: the game's 3 arguments plus the trailing LIES context`);
    assert.ok(
      ['data', 'unit:brain()._logic_data'].includes(site.args[3]),
      `${site.where}: the LIES context is the trailing 4th argument, not a prefix`
    );
  }
});

test('the retreat and nav-sort call sites pass their context last', () => {
  const retreat = allCallSites('_find_retreat_position');

  assert.equal(retreat.length, 4, `expected the four LIES call sites, got ${retreat.length}`);
  assert.equal(retreat.filter((site) => site.file === 'lua/coplogics/coplogicattack.lua').length, 2);
  assert.equal(retreat.filter((site) => site.file === 'lua/coplogics/boss/bosslogicattack.lua').length, 2);

  for (const site of retreat) {
    assert.equal(site.args.length, 7, `${site.where}: six game arguments plus the trailing LIES data`);
    assert.equal(site.args[6], 'data', `${site.where}: the LIES context is the trailing 7th argument`);
    assert.ok(
      !site.args.slice(0, 6).includes('data'),
      `${site.where}: data must not hold a game slot - the game's 6-argument call would shift every position`
    );
  }

  const sort = allCallSites('_sort_nav_segs_after_pos');

  assert.equal(sort.length, 1, `expected the single LIES call in _execute_coarce_search, got ${sort.length}`);
  assert.deepEqual(sort[0].args, [
    'to_pos',
    'next_search_i_seg',
    'search_data.discovered_seg',
    'search_data.verify_clbk',
    'search_data.access_pos',
    'search_data.access_neg',
    'from_pos',
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the 248.2 near-visible probe merge in
// `CopLogicBase._upd_attention_obj_detection`. The only functional vanilla change
// between 246.1 and 248.2 in that function is inside the nested
// `_nearly_visible_chk`: the vertical probe above the last known position scales
// from 100 units at contact range down to 10 near 2000 units, instead of a fixed
// 100. LIES keeps its own probe set (exact position, +/-30 lateral) and its
// `last_verified_*` bookkeeping; only the vertical fallback adopts the scaling.
// Reference: `game-data/.../lib/units/enemies/cop/logics/coplogicbase.lua:482-491`
// (248.2), function diff 246.1 -> 248.2 via `tools/pd2fn.ps1`.

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

const baseSource = () => stripLuaComments(read('lua', 'coplogics', 'coplogicbase.lua'));
const managerSource = () => stripLuaComments(read('menumanager.lua'));

// Blank out Lua comments and strings, keeping every offset (and every newline),
// so the block scan below cannot be shifted by a `-- end` comment or by a
// `"do"`/`[[if]]` literal. Long brackets (`--[[ … ]]`, `[[ … ]]`, `[==[ … ]==]`)
// and short quotes with backslash escapes are handled; anything else is copied.
function blankLuaNoise(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (char === '-' && source[i + 1] === '-') {
      const long = /^\[(=*)\[/.exec(source.slice(i + 2));

      if (long) {
        const close = `]${long[1]}]`;
        const found = source.indexOf(close, i + 2 + long[0].length);
        const stop = found === -1 ? source.length : found + close.length;

        blank(i, stop);
        i = stop;
      } else {
        const eol = source.indexOf('\n', i);
        const stop = eol === -1 ? source.length : eol;

        blank(i, stop);
        i = stop;
      }
      continue;
    }

    const long = char === '[' ? /^\[(=*)\[/.exec(source.slice(i)) : null;

    if (long) {
      const close = `]${long[1]}]`;
      const found = source.indexOf(close, i + long[0].length);
      const stop = found === -1 ? source.length : found + close.length;

      blank(i, stop);
      i = stop;
      continue;
    }

    if (char === '"' || char === "'") {
      let j = i + 1;

      while (j < source.length && source[j] !== char) j += source[j] === '\\' ? 2 : 1;

      const stop = Math.min(j + 1, source.length);

      blank(i, stop);
      i = stop;
      continue;
    }

    i++;
  }

  return out.join('');
}

// The nested helpers of the detection pass are not `local function` at column 0,
// so a "next top-level function" heuristic swallows the rest of the pass and
// every "helper-scoped" assertion silently becomes pass-scoped. Track Lua block
// depth instead: `function`/`if`/`for`/`while`/`do`/`repeat` open a block,
// `end`/`until` close one. `for … do` and `while … do` carry their own `do`, so
// that one is not counted twice; `then`, `else` and `elseif` belong to an `if`
// that is already open and do not change the depth. The slice ends where the
// depth returns to zero, i.e. on the helper's own closing `end`.
function sliceFunction(source, header) {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `${header} is missing`);
  const code = blankLuaNoise(source);
  const token = /\b(function|if|for|while|do|repeat|end|until)\b/g;
  let depth = 0;
  let opened = false;
  let closed = false;
  let loopHeader = false;
  let end = source.length;

  token.lastIndex = start;

  for (let match = token.exec(code); match !== null; match = token.exec(code)) {
    const word = match[0];

    if (word === 'for' || word === 'while') {
      depth++;
      opened = true;
      loopHeader = true;
      continue;
    }
    if (word === 'do') {
      if (loopHeader) loopHeader = false;
      else {
        depth++;
        opened = true;
      }
      continue;
    }

    loopHeader = false;

    if (word === 'function' || word === 'if' || word === 'repeat') {
      depth++;
      opened = true;
      continue;
    }

    // `end` / `until`
    depth--;
    if (opened && depth === 0) {
      end = match.index + word.length;
      closed = true;
      break;
    }
  }

  assert.ok(closed, `${header} is malformed: its block never closes`);

  return source.slice(start, end);
}

// The whole detection pass: it holds both the `MAX_DISTANCE` upvalue and the
// three call-site gates.
const detectionBody = () => sliceFunction(baseSource(), 'function CopLogicBase._upd_attention_obj_detection(data, min_reaction, max_reaction)');

const helper = () => sliceFunction(baseSource(), 'local function _nearly_visible_chk(attention_info, detect_pos)');

const digest = () => sliceFunction(managerSource(), 'function LIES:WatchDigest(');

test('the near-visible helper still exists exactly once', () => {
  const text = baseSource();
  const calls = [...text.matchAll(/_nearly_visible_chk\(/g)];

  // One definition plus three call sites in the detection pass.
  assert.equal(calls.length, 4, 'the helper definition and its three call sites must all be present');
  assert.match(text, /local function _nearly_visible_chk\(attention_info, detect_pos\)/);
});

test('the helper slice is helper-only, not the rest of the detection pass', () => {
  const body = helper();

  // `_chk_record_acquired_attention_importance_wgt` is the next nested function
  // of the pass. If the slicer swallowed it, every assertion below would really
  // be pass-scoped: a `lerp(100, 10,` or a `math.UP * 30` elsewhere in the pass
  // could pass or fail the helper checks.
  assert.doesNotMatch(body, /_chk_record_acquired_attention_importance_wgt/);
  assert.doesNotMatch(body, /_upd_attention_obj_detection/);
  // And it really is the helper: its header first, its own `end` last.
  assert.match(body, /^local function _nearly_visible_chk\(attention_info, detect_pos\)/);
  assert.match(body, /attention_info\.lost_track = nil[\s\S]*end$/);

  // The pass itself still contains both nested functions, so the assertion above
  // is about the slice and not about the file losing them.
  const pass = detectionBody();
  assert.match(pass, /_nearly_visible_chk\(/);
  assert.match(pass, /_chk_record_acquired_attention_importance_wgt\(/);
});

test('MAX_DISTANCE is 2000 and the call-site gate uses it', () => {
  const body = detectionBody();

  assert.match(body, /local MAX_DISTANCE = 2000/, 'MAX_DISTANCE must be declared as 2000');

  const gates = [...body.matchAll(/MAX_DISTANCE > attention_info\.dis/g)];
  assert.equal(gates.length, 3, 'all three nearly-visible call sites must gate on MAX_DISTANCE');

  // The literal must be gone: the constant is the single source.
  assert.doesNotMatch(body, /attention_info\.dis < 2000/, 'the gate must not keep a bare 2000 literal');
  assert.doesNotMatch(body, /attention_info\.verified_dis < 2000/, 'the gate must not keep a bare 2000 literal');

  // The declaration sits above the helper, so both the helper and the gates see it.
  const declAt = body.indexOf('local MAX_DISTANCE = 2000');
  const helperAt = body.indexOf('local function _nearly_visible_chk(');
  assert.ok(declAt !== -1 && helperAt !== -1 && declAt < helperAt, 'the constant is declared before the helper');
});

test('the probe height scales with distance, clamped instead of the identity math.max', () => {
  const body = helper();

  assert.match(
    body,
    /local height_over_target = math\.lerp\(100, 10, math\.clamp\(attention_info\.verified_dis \/ MAX_DISTANCE, 0, 1\)\)/,
    'the vanilla 248.2 scaling must be: lerp(100, 10, verified_dis / MAX_DISTANCE), clamped to 0..1'
  );

  // 100 at contact range, 10 at the far end of the gate.
  assert.match(body, /math\.lerp\(100, 10,/, 'the near height is 100 and the far height is 10');
});

test('the vertical probe uses the scaled height, not a literal 30', () => {
  const body = helper();

  assert.match(body, /mvector3\.add\(near_pos, math\.UP \* height_over_target\)/, 'the vertical probe must use height_over_target');
  assert.doesNotMatch(body, /math\.UP \* 30\b/, 'the fixed 30-unit vertical probe is gone');
  assert.doesNotMatch(body, /mvec3_set_z\(near_pos/, 'LIES adds a direction vector; it does not set z directly');
});

test('the lateral probes keep LIES\'s 30, not vanilla\'s 150', () => {
  const body = helper();

  const lengths = [...body.matchAll(/mvector3\.set_length\(side_vec, (\d+)\)/g)].map((match) => Number(match[1]));
  assert.deepEqual(lengths, [30], 'one lateral length, 30 units');
  assert.doesNotMatch(body, /set_length\(side_vec, 150\)/, 'the vanilla 150-unit lateral probe must not be adopted');
});

test('probe order is unchanged: exact, lateral +, lateral -, vertical', () => {
  const body = helper();

  const exactAt = body.indexOf('mvec3_set(near_pos, detect_pos)');
  const lateralPlusAt = body.indexOf('mvector3.add(near_pos, side_vec)');
  const lateralMinusAt = body.indexOf('mvector3.multiply(side_vec, -2)');
  const verticalAt = body.indexOf('math.UP * height_over_target');

  for (const [name, at] of [['exact', exactAt], ['lateral +', lateralPlusAt], ['lateral -', lateralMinusAt], ['vertical', verticalAt]]) {
    assert.notEqual(at, -1, `the ${name} probe is missing`);
  }

  assert.ok(exactAt < lateralPlusAt, 'the exact position is probed first');
  assert.ok(lateralPlusAt < lateralMinusAt, 'the + lateral probe comes before the - lateral probe');
  assert.ok(lateralMinusAt < verticalAt, 'the vertical probe is the last fallback');

  const raycasts = [...body.matchAll(/data\.unit:raycast\("ray", my_pos, near_pos/g)];
  assert.equal(raycasts.length, 4, 'exactly four probes: exact, + lateral, - lateral, vertical');
});

test('the near-visible bookkeeping is untouched', () => {
  const body = helper();

  assert.match(body, /if not near_vis_ray then\s*\n\s*attention_info\.nearly_visible = true/);
  assert.match(body, /attention_info\.release_t = nil/);
  assert.match(body, /if attention_info\.last_verified_pos then/);
  assert.match(body, /mvec3_set\(attention_info\.last_verified_pos, near_pos\)/);
  assert.match(body, /attention_info\.last_verified_m_pos = near_pos:with_z\(attention_info\.m_pos\.z\)/, 'the z-flattened mirror position is kept');
  assert.match(body, /attention_info\.last_verified_dis = mvec3_dis\(data\.m_pos, attention_info\.last_verified_m_pos\)/);
  assert.match(body, /attention_info\.last_verified_pos = mvector3\.copy\(near_pos\)/, 'the first-hit copy branch is kept');
  assert.match(body, /attention_info\.last_expected = nil/);
  assert.match(body, /attention_info\.lost_track = nil/);
});

test('the merge is observable: probe counter and height gauge', () => {
  const body = helper();
  const verticalAt = body.indexOf('math.UP * height_over_target');
  const countAt = body.indexOf('LIES:Count("near_vis_probe")');
  const gaugeAt = body.indexOf('LIES:Gauge("near_vis_h", height_over_target)');
  const lateralMinusAt = body.indexOf('mvector3.multiply(side_vec, -2)');

  assert.notEqual(countAt, -1, 'LIES:Count("near_vis_probe") is missing');
  assert.notEqual(gaugeAt, -1, 'LIES:Gauge("near_vis_h", height_over_target) is missing');
  assert.ok(lateralMinusAt < countAt, 'the counter fires only on the vertical fallback, after both lateral probes');
  assert.ok(countAt < verticalAt && gaugeAt < verticalAt, 'both fire before the vertical probe runs');
});

test('the digest carries the probe counter and the tallest probe height', () => {
  const text = digest();

  assert.match(text, /near_vis_probe = d\.near_vis_probe or 0/, 'the digest must carry near_vis_probe');
  assert.match(
    text,
    /near_vis_h_max = math\.floor\(\(self\.watch_gauges\.near_vis_h or 0\) \+ 0\.5\)/,
    'the digest must carry the rounded near_vis_h max'
  );

  // Grouped with the door-watch digests, not bolted on somewhere else.
  const dwGapAt = text.indexOf('dw_gap =');
  const probeAt = text.indexOf('near_vis_probe =');
  const hMaxAt = text.indexOf('near_vis_h_max =');
  assert.ok(dwGapAt !== -1 && dwGapAt < probeAt && probeAt < hMaxAt, 'the pair sits right after the dw_* group');
});

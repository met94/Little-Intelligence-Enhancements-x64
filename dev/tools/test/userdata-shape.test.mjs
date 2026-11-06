import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the mistake class behind the 2026-11-05 taser crash
// (dev/reports/watch-settle-attention-unit-type-crash.md): a value that may be
// an opaque engine userdata - an Idstring `u_key`, `unit:key()`, a nav link - is
// neither a table nor a vector. `type()` answers "userdata" for every one of
// them, and an Idstring has no `__index`, so a field read raises
// "attempt to index ... (a userdata value)" instead of returning nil.
//
// Rules, over comment-stripped lua/**/*.lua:
//   1. no `.type_name` read - the field that crashed;
//   2. `type(x) == "userdata"` is not accepted as proof of a Vector3 or a table;
//   3. no field is read off `attention_unit`, the untyped union in the aim path;
//   4. the union is never taken as a value (`x = my_data.attention_unit`,
//      `... or my_data.attention_unit`); it is only compared, copied into or
//      cleared. A consumer that needs the aim target asks the engine:
//      `data.unit:movement():attention().pos`.
//
// A site that genuinely needs a shape probe belongs in ALLOWED with its reason
// written next to it. The list is empty on purpose: LIES needs no probe.

const root = fileURLToPath(new URL('../../../', import.meta.url));
const LUA_ROOT = path.join(root, 'lua');

const ALLOWED = new Map();

const RULES = [
  {
    id: 'type_name read',
    pattern: /\.type_name\b/,
    why: 'an opaque userdata has no __index; read a field of a shape you know instead',
  },
  {
    id: 'type() used as a shape proof',
    pattern: /type\s*\([^()]*\)\s*[=~]=\s*['"]userdata['"]/,
    why: 'type() answers "userdata" for a Vector3, an Idstring, a unit and a nav link alike',
  },
  {
    id: 'attention_unit field read',
    pattern: /attention_unit\s*\./,
    why: 'the union holds a Vector3 or a u_key; use data.unit:movement():attention().pos',
  },
  {
    id: 'attention_unit taken as a value',
    // `==`/`~=` comparisons are the safe idiom and must not be caught by the
    // `=` arm, hence the lookbehind.
    pattern: /(?<![=~<>])=[ \t]*my_data\.attention_unit\b|\bor\s+my_data\.attention_unit\b/,
    why: 'a Vector3 or a u_key cannot be handed on; ask the engine for the typed field',
  },
];

// Blank a comment's text but keep its newlines, so reported line numbers stay
// true. String literals are copied verbatim: a `--[` inside one is not a comment.
function stripLuaComments(source) {
  let out = '';
  let i = 0;

  const blankTo = (end) => {
    out += source.slice(i, end).replace(/[^\n]/g, ' ');
    i = end;
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === ch) {
          j += 1;
          break;
        }
        j += 1;
      }
      const end = Math.min(j, source.length);
      out += source.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '[') {
      const longString = /^\[(=*)\[/.exec(source.slice(i, i + 64));

      if (longString) {
        const closer = `]${longString[1]}]`;
        const end = source.indexOf(closer, i + longString[0].length);
        if (end === -1) throw new Error(`unterminated long string at offset ${i}`);
        out += source.slice(i, end + closer.length);
        i = end + closer.length;
        continue;
      }
    }

    if (source.startsWith('--', i)) {
      // `--[=[ ... ]=]` and its levels, not just `--[[`.
      const long = /^--\[(=*)\[/.exec(source.slice(i, i + 64));

      if (long) {
        const closer = `]${long[1]}]`;
        const end = source.indexOf(closer, i + long[0].length);
        if (end === -1) throw new Error(`unterminated long comment at offset ${i}`);
        blankTo(end + closer.length);
        continue;
      }

      const eol = source.indexOf('\n', i);
      if (eol === -1) {
        blankTo(source.length);
        break;
      }

      blankTo(eol);
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.lua')) out.push(full);
  }

  return out;
}

const luaFiles = () => walk(LUA_ROOT).map((file) => ({
  rel: path.relative(root, file).replaceAll('\\', '/'),
  code: stripLuaComments(fs.readFileSync(file, 'utf8')),
}));

test('no code treats a possibly-opaque userdata as a table or a Vector3', () => {
  const findings = [];

  for (const { rel, code } of luaFiles()) {
    code.split(/\r?\n/).forEach((line, index) => {
      for (const rule of RULES) {
        if (!rule.pattern.test(line)) continue;

        const key = `${rel}:${index + 1}`;
        if (ALLOWED.has(key)) continue;

        findings.push(`${key}: ${rule.id}: ${line.trim()} (${rule.why})`);
      }
    });
  }

  assert.deepEqual(findings, [], `elidable userdata shape assumptions:\n${findings.join('\n')}`);
});

test('the scanner keeps string literals and drops comments', () => {
  // A `--[` inside a string is not an unterminated comment; a real one throws.
  assert.equal(stripLuaComments('local s = "--[ not a comment"\n').includes('--['), true);
  assert.doesNotMatch(stripLuaComments('local a = 1 -- attention_unit.type_name\n'), /type_name/);
  assert.throws(() => stripLuaComments('--[[ never closed\n'), /unterminated long comment/);
  // Line numbers survive comment removal.
  assert.equal(stripLuaComments('a\n-- b\nc').split('\n').length, 3);
});

test('the aim target comes from the engine record at every former union sink', () => {
  const byFile = new Map(luaFiles().map((entry) => [entry.rel, entry.code]));

  const attack = byFile.get('lua/coplogics/coplogicattack.lua');
  assert.match(attack, /local attention = movement:attention\(\)/);
  assert.match(attack, /return mvec3_dis\(aim_pos, pos\) <= LIES_SETTLE_TARGET_DIS/);

  const taser = byFile.get('lua/coplogics/specials/taserlogicattack.lua');
  assert.equal((taser.match(/movement\(\):attention\(\)/g) || []).length, 2, 'both taser turn sites');

  const boss = byFile.get('lua/coplogics/boss/bosslogicattack.lua');
  assert.match(boss, /movement\(\):attention\(\)/);
});

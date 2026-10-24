import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLua,
  classifySources,
  renderMarkdown
} from '../fn-ledger.mjs';

const OLD = `
local function helper(x)
  return x + 1
end

function A:foo(x)
  return x + 1
end

A.bar = function(self, y)
  return y * 2
end

if RequiredScript == "lib/managers/a" then
  function A:baz()
    return 3
  end
end

function A:outer()
  local function nested()
    return 9
  end
  return nested()
end
`;

test('normalizeLua strips comments and whitespace, keeps strings', () => {
  assert.equal(normalizeLua('function A:f() -- hi\n return "--not a comment" end'),
    'functionA:f()return"--not a comment"end');
  assert.equal(normalizeLua('--[[ long\ncomment ]] local x = 1'),
    'localx=1');
  assert.equal(normalizeLua('local s = [[ -- kept ]]'), 'locals=[[ -- kept ]]');
});

test('formatting-only difference is SAME_AS_OLD_VANILLA', () => {
  const old = 'function A:foo(x) return x + 1 end';
  const mod = 'function A:foo( x )\n -- comment\n return x+1\nend';
  const { rows } = classifySources(mod, old, old);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'A.foo');
  assert.equal(rows[0].category, 'SAME_AS_OLD_VANILLA');
});

test('colon and dot definitions with self are equivalent', () => {
  const old = 'function A:foo(x, y) return x + y end';
  const mod = 'A.foo = function(self, x, y) return x + y end';
  const { rows } = classifySources(mod, old, old);
  assert.equal(rows[0].name, 'A.foo');
  assert.equal(rows[0].category, 'SAME_AS_OLD_VANILLA');
});

test('intentional edit with unchanged vanilla is LIES_EDIT_CLEAN', () => {
  const old = 'function A:foo(x) return x + 1 end';
  const mod = 'function A:foo(x) return x + 2 end';
  const { rows } = classifySources(mod, old, old);
  assert.equal(rows[0].category, 'LIES_EDIT_CLEAN');
});

test('edit whose vanilla body changed is LIES_EDIT_VANILLA_CHANGED', () => {
  const old = 'function A:foo(x) return x + 1 end';
  const nw = 'function A:foo(x) return x + 1 + 0 end';
  const mod = 'function A:foo(x) return x + 2 end';
  const { rows } = classifySources(mod, old, nw);
  assert.equal(rows[0].category, 'LIES_EDIT_VANILLA_CHANGED');
});

test('stale copy of old vanilla is SAME_AS_OLD_VANILLA even if vanilla changed', () => {
  const old = 'function A:foo(x) return x + 1 end';
  const mod = 'function A:foo(x) return x + 1 end';
  const nw = 'function A:foo(x) return x + 5 end';
  const { rows } = classifySources(mod, old, nw);
  assert.equal(rows[0].category, 'SAME_AS_OLD_VANILLA');
});

test('mod matches new vanilla is SAME_AS_NEW_VANILLA', () => {
  const old = 'function A:foo(x) return x + 1 end';
  const nw = 'function A:foo(x) return x + 5 end';
  const mod = 'function A:foo(x) return x + 5 end';
  const { rows } = classifySources(mod, old, nw);
  assert.equal(rows[0].category, 'SAME_AS_NEW_VANILLA');
});

test('local helper identical to old vanilla is kept, not deleted', () => {
  const old = 'local function helper(x) return x end\nfunction A:foo() return helper(1) end';
  const mod = old;
  const { rows } = classifySources(mod, old, old);
  const helper = rows.find(r => r.name === 'helper');
  assert.equal(helper.category, 'SAME_AS_OLD_VANILLA_LOCAL');
});

test('Hooks:PostHook callbacks are ledger rows', () => {
  const source = 'Hooks:PostHook(CopBrain, "post_init", "lies_post_init", function(self) return 1 end)';
  const { rows } = classifySources(source, '', '');
  assert.equal(rows[0].name, 'Hooks.PostHook:CopBrain.post_init:lies_post_init');
  assert.equal(rows[0].category, 'MOD_ONLY_HOOK');
});

test('mod-only function is MOD_ONLY', () => {
  const old = 'function A:foo() return 1 end';
  const mod = 'function A:foo() return 1 end\nfunction A:extra() return 2 end';
  const { rows } = classifySources(mod, old, old);
  assert.equal(rows.find(r => r.name === 'A.extra').category, 'MOD_ONLY');
});

test('mod-only function that exists in new vanilla is MOD_ONLY_NEWALSO', () => {
  const old = 'function A:foo() return 1 end';
  const nw = 'function A:foo() return 1 end\nfunction A:newfn() return 3 end';
  const mod = 'function A:foo() return 1 end\nfunction A:newfn() return 4 end';
  const { rows } = classifySources(mod, old, nw);
  assert.equal(rows.find(r => r.name === 'A.newfn').category, 'MOD_ONLY_NEWALSO');
});

test('function removed from new vanilla is VANISHED_IN_NEW', () => {
  const old = 'function A:foo() return 1 end';
  const nw = 'function A:bar() return 2 end';
  const mod = 'function A:foo() return 1 end';
  const { rows } = classifySources(mod, old, nw);
  assert.equal(rows[0].category, 'VANISHED_IN_NEW');
});

test('top-level functions inside RequiredScript blocks are collected', () => {
  const { rows } = classifySources(OLD, OLD, OLD);
  const names = rows.map(r => r.name).sort();
  assert.ok(names.includes('A.foo'));
  assert.ok(names.includes('A.bar'));
  assert.ok(names.includes('A.baz'));
  assert.ok(names.includes('A.outer'));
  assert.ok(names.includes('helper'));
});

test('nested helper functions are not separate ledger rows', () => {
  const { rows } = classifySources(OLD, OLD, OLD);
  assert.equal(rows.filter(r => r.name === 'nested').length, 0);
});

test('parse failure is reported, not thrown', () => {
  const { rows, errors } = classifySources('function A:foo( end', 'function A:foo() end', 'function A:foo() end');
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /mod/i);
});

test('markdown flags unhooked files', () => {
  const md = renderMarkdown({
    oldRev: 'old', newRev: 'new', generated: 'now',
    files: [{ file: 'lua/dead.lua', rows: [], totals: {}, unhooked: true }]
  });
  assert.match(md, /UNHOOKED FILE/);
});

test('markdown contains totals and one row per function', () => {
  const old = 'function A:foo(x) return x + 1 end';
  const nw = 'function A:foo(x) return x + 2 end';
  const mod = 'function A:foo(x) return x + 3 end\nfunction A:extra() end';
  const { rows, totals } = classifySources(mod, old, nw);
  const md = renderMarkdown({ oldRev: 'old', newRev: 'new', generated: 'now', files: [{ file: 'lua/a.lua', rows, totals }] });
  assert.match(md, /lua\/a\.lua/);
  assert.match(md, /A\.foo/);
  assert.match(md, /A\.extra/);
  assert.match(md, /PORT/);
  assert.match(md, /audit/);
  assert.match(md, /Nested helpers/);
});

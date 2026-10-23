import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDossier, extractFunction } from '../fn-workbench.mjs';

const OLD = `function A:foo(x)
  return x + 1
end`;

const MOD = `function A:foo(x)
  return x + 2
end`;

const NEW = `function A:foo(x)
  return x + 3
end`;

test('extractFunction finds a class method', () => {
  const fn = extractFunction(MOD, 'A.foo');
  assert.equal(fn.params.join(','), 'x');
  assert.match(fn.bodyText, /return x \+ 2/);
});

test('extractFunction throws a clear error when missing', () => {
  assert.throws(() => extractFunction(MOD, 'A.missing'), /not found/i);
});

test('dossier contains all three bodies and both diffs', () => {
  const md = buildDossier({
    file: 'lua/a.lua',
    name: 'A.foo',
    modSource: MOD,
    oldSource: OLD,
    newSource: NEW
  });

  assert.match(md, /Function dossier/);
  assert.match(md, /lua\/a\.lua/);
  assert.match(md, /A\.foo/);
  assert.match(md, /LIES_EDIT_VANILLA_CHANGED/);
  assert.match(md, /## LIES body/);
  assert.match(md, /## 246\.1 vanilla/);
  assert.match(md, /## 248\.2 vanilla/);
  assert.match(md, /## Diff 246\.1 -> LIES/);
  assert.match(md, /## Diff 246\.1 -> 248\.2/);
  assert.match(md, /return x \+ 2/);
  assert.match(md, /^-return x \+ 1$/m);
  assert.match(md, /^\+return x \+ 2$/m);
});

test('dossier marks a missing old function', () => {
  const md = buildDossier({
    file: 'lua/a.lua',
    name: 'A.foo',
    modSource: MOD,
    oldSource: 'function B:other() end',
    newSource: NEW
  });
  assert.match(md, /246\.1: not found/);
});

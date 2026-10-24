import test from 'node:test';
import assert from 'node:assert/strict';
import { auditText, renderReport, extractHookDeclarations } from '../api-audit.mjs';

const SYMBOLS = [
  { symbol: '_room_doors', severity: 'error', reason: 'removed in nav v6' },
  { symbol: '_nav_segments', severity: 'review', reason: 'string-keyed in nav v6' }
];

test('auditText flags a removed symbol with a line number', () => {
  const source = 'local a = 1\nlocal doors = self._room_doors[1]\n';
  const findings = auditText(source, { file: 'a.lua', symbols: SYMBOLS });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, 'a.lua');
  assert.equal(findings[0].line, 2);
  assert.equal(findings[0].symbol, '_room_doors');
  assert.equal(findings[0].severity, 'error');
});

test('auditText ignores symbols thatonly appear in comments', () => {
  const source = '-- self._room_doors is gone\nlocal a = 1\n';
  const findings = auditText(source, { file: 'a.lua', symbols: SYMBOLS });
  assert.equal(findings.length, 0);
});

test('auditText respects identifier boundaries', () => {
  const boundarySymbols = [{ symbol: '_rooms', severity: 'error', reason: 'removed' }];
  assert.equal(auditText('self._rooms_to_draw = {}', { file: 'a.lua', symbols: boundarySymbols }).length, 0);
  assert.equal(auditText('self._rooms = {}', { file: 'a.lua', symbols: boundarySymbols }).length, 1);
});

test('auditText ignores long comments and strings', () => {
  const source = '--[[ self._room_doors\nstill comment ]]\nlocal s = "self._room_doors"\nlocal door = self._room_doors[1]\n';
  const findings = auditText(source, { file: 'a.lua', symbols: [{ symbol: '_room_doors', severity: 'error', reason: 'gone' }] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 4);
});

test('auditText reports review symbols separately', () => {
  const source = 'local seg = self._nav_segments[5]\n';
  const findings = auditText(source, { file: 'a.lua', symbols: SYMBOLS });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'review');
});

test('extractHookDeclarations finds PostHook and PreHook calls', () => {
  const source = `Hooks:PostHook(CopBrain, "post_init", "lies_post_init", function() end)
Hooks:PreHook(GroupAIManager, "set_state", "lies_set_state", function() end)
local x = 1
`;
  const hooks = extractHookDeclarations(source);
  assert.equal(hooks.length, 2);
  assert.deepEqual(hooks[0], { kind: 'PostHook', className: 'CopBrain', method: 'post_init', id: 'lies_post_init', line: 1 });
  assert.equal(hooks[1].kind, 'PreHook');
  assert.equal(hooks[1].className, 'GroupAIManager');
  assert.equal(hooks[1].line, 2);
});

test('renderReport includes hook method checks', () => {
  const md = renderReport({
    targetRev: 'e3a8b616',
    hookChecks: [],
    hookMethodChecks: [
      { className: 'CopBrain', method: 'post_init', id: 'lies_post_init', ok: true },
      { className: 'CopBrain', method: 'gone', id: 'lies_gone', ok: false }
    ],
    findings: []
  });
  assert.match(md, /method checks: 1\/2 ok/i);
  assert.match(md, /CopBrain\.gone/);
});

test('renderReport groups findings and prints counts', () => {
  const report = {
    targetRev: 'e3a8b616',
    hookChecks: [
      { hook: 'lib/a', file: 'lua/a.lua', ok: true },
      { hook: 'lib/b', file: 'lua/b.lua', ok: false, reason: 'missing mod file' }
    ],
    findings: [
      { file: 'lua/a.lua', line: 2, symbol: '_room_doors', severity: 'error', reason: 'gone', text: 'self._room_doors' },
      { file: 'lua/b.lua', line: 7, symbol: '_nav_segments', severity: 'review', reason: 'string keys', text: 'self._nav_segments[5]' }
    ]
  };
  const md = renderReport(report);
  assert.match(md, /api audit/i);
  assert.match(md, /e3a8b616/);
  assert.match(md, /errors: 1/i);
  assert.match(md, /review: 1/i);
  assert.match(md, /lua\/a\.lua:2/);
  assert.match(md, /lua\/b\.lua:7/);
  assert.match(md, /missing mod file/i);
});

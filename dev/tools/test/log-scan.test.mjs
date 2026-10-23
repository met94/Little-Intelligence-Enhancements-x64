import test from 'node:test';
import assert from 'node:assert/strict';
import { scanLog, renderReport, isOk } from '../log-scan.mjs';

const LOG = `08:57:00 AM Lua: [INFO] [BLT] Setting up mod 'LIES'
08:57:01 AM Lua: [INFO] [LIES-TEST] nav segments=42 covers=10
08:57:02 AM Lua: [ERROR] [Updates] Missing meta in provider 'meta_file'
08:57:03 AM Lua: Error: lib/managers/navigationmanager.lua:37: attempt to index a nil value (field '_room_doors')
stack traceback:
	lib/managers/navigationmanager.lua:37: in function 'find_segment_doors'
	lib/managers/navigationmanager.lua:50: in function 'update'
`;

test('scanLog finds setup, harness, Lua error, and LIES context', () => {
  const result = scanLog(LOG, { file: 'test.log', hookFiles: ['lib/managers/navigationmanager.lua'] });
  assert.equal(result.setup.length, 1);
  assert.equal(result.harness.length, 1);
  assert.equal(result.luaErrors.length, 1);
  assert.equal(result.liesErrors.length, 1);
  assert.equal(result.ok, false);
  assert.equal(result.liesErrors[0].line, 4);
});

test('scanLog flags FATAL as failure', () => {
  const result = scanLog("Lua: FATAL ERROR: boom\n", { file: 'test.log' });
  assert.equal(result.fatal.length, 1);
  assert.equal(result.ok, false);
});

test('clean log is ok even with unrelated update noise', () => {
  const log = `08:57:00 AM Lua: [INFO] [BLT] Setting up mod 'LIES'
08:57:01 AM Lua: [ERROR] [Updates] Missing meta in provider 'meta_file'
`;
  const result = scanLog(log, { file: 'test.log' });
  assert.equal(result.ok, true);
  assert.equal(isOk(result, { strict: true }), true);
});

test('strict mode fails on non-LIES Lua errors', () => {
  const result = scanLog("Lua: Error: attempt to call a nil value\n", { file: 'test.log' });
  assert.equal(result.ok, true);
  assert.equal(isOk(result, { strict: true }), false);
});

test('setup match does not count LIES-derived standalone mods', () => {
  const result = scanLog("Lua: [INFO] [BLT] Setting up mod 'LIES's Joker Tweaks Standalone'\n", { file: 'test.log' });
  assert.equal(result.setup.length, 0);
});

test('renderReport contains counts and line references', () => {
  const result = scanLog(LOG, { file: 'test.log', hookFiles: ['lib/managers/navigationmanager.lua'] });
  const md = renderReport(result);
  assert.match(md, /LIES log scan/);
  assert.match(md, /test\.log/);
  assert.match(md, /setup: 1/i);
  assert.match(md, /LIES errors: 1/i);
  assert.match(md, /navigationmanager\.lua:37/);
  assert.match(md, /LIES-TEST/);
});

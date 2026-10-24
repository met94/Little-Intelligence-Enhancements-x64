import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findWorkspaceRoot, defaultClone } from '../workspace.mjs';

test('findWorkspaceRoot walks up to workspace.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lies-ws-'));
  fs.writeFileSync(path.join(root, 'workspace.json'), '{}');
  const nested = path.join(root, 'a', 'b', 'c');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(findWorkspaceRoot(nested), root);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findWorkspaceRoot returns null when absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lies-ws-'));
  assert.equal(findWorkspaceRoot(root), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('defaultClone prefers the workspace game-data path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lies-ws-'));
  fs.writeFileSync(path.join(root, 'workspace.json'), '{}');
  const nested = path.join(root, 'mods', 'LIES', 'dev', 'tools');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(defaultClone(nested), path.join(root, 'game-data', 'Payday-2-LuaJIT-Complete'));
  fs.rmSync(root, { recursive: true, force: true });
});

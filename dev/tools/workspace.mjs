import fs from 'node:fs';
import path from 'node:path';

// Walk up from start until a directory containing workspace.json is found.
export function findWorkspaceRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'workspace.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function defaultClone(start) {
  const root = findWorkspaceRoot(start);
  if (root) return path.join(root, 'game-data', 'Payday-2-LuaJIT-Complete');
  return path.resolve(start, '../../../../game-data/Payday-2-LuaJIT-Complete');
}

export function luaparseCandidates(start) {
  const candidates = [];
  const root = findWorkspaceRoot(start);
  if (root) candidates.push(path.join(root, 'tools', 'lua', 'node_modules', 'luaparse'));
  candidates.push(path.resolve(start, '../../../../tools/lua/node_modules/luaparse'));
  candidates.push('luaparse');
  return candidates;
}

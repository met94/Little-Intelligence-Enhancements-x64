import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

// Every LIES hook script must carry the suite's standard re-entry guard.
//
// SuperBLT runs a hooked file's scripts several times per Lua state (once per
// require of the hooked file). Guarded suite mods (Iter, Keepers, Monkeepers,
// Useful Bots) apply once; an unguarded LIES re-applies each pass and silently
// overwrites their wrappers, so the documented priority order stops holding.
test('every hook script carries the load-once guard', () => {
  const mod = JSON.parse(read('mod.txt').replace(/^\uFEFF/, ''));
  const scripts = [...(mod.pre_hooks || []), ...(mod.hooks || [])]
    .map((entry) => entry && entry.script_path)
    .filter(Boolean);

  assert.ok(scripts.length >= 60, `expected the full hook list, got ${scripts.length}`);

  const guard = /^local key = ModPath \.\. '\t' \.\. RequiredScript\r?\nif _G\[key\] then return else _G\[key\] = true end\r?\n/;
  const missing = [];

  for (const script of new Set(scripts)) {
    const source = read(script).replace(/^\uFEFF/, '');

    if (!guard.test(source)) {
      missing.push(script);
    }
  }

  assert.deepEqual(missing, [], `hook scripts without the re-entry guard: ${missing.join(', ')}`);
});

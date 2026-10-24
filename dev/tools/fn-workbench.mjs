#!/usr/bin/env node
// One-function workbench: dump the LIES body, the 246.1 body, the 248.2 body,
// and both diffs for a single function.
//
// Usage:
//   node dev/tools/fn-workbench.mjs --file lua/coplogics/coplogicbase.lua \
//     --name CopLogicBase._upd_attention_obj_detection

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { parseSource, collectFunctions, classifySources } from './fn-ledger.mjs';
import { defaultClone } from './workspace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function extractFunction(source, name) {
  const parsed = parseSource(source);
  if (!parsed.ok) {
    throw new Error(`parse failed: ${parsed.error ? parsed.error.message : 'unknown error'}`);
  }
  const { functions } = collectFunctions(source, parsed.ast);
  const fn = functions.find(item => item.name === name);
  if (!fn) {
    const available = functions.map(item => item.name).sort();
    throw new Error(`function not found: ${name}\nAvailable: ${available.join(', ')}`);
  }
  return fn;
}

function findFunction(source, name) {
  try {
    return extractFunction(source, name);
  } catch {
    return null;
  }
}

function gitDiff(oldText, newText, oldLabel, newLabel) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lies-workbench-'));
  const oldFile = path.join(dir, 'old.lua');
  const newFile = path.join(dir, 'new.lua');
  try {
    fs.writeFileSync(oldFile, oldText, 'utf8');
    fs.writeFileSync(newFile, newText, 'utf8');
    const result = spawnSync('git', ['diff', '--no-index', '--unified=3', '--no-color', '--', oldFile, newFile], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`git diff failed: ${result.stderr || result.error}`);
    }
    let out = result.stdout || '';
    out = out
      .replace(/^diff --git .*$/m, '')
      .replace(/^index .*$/m, '')
      .replace(/^--- .*$/m, `--- ${oldLabel}`)
      .replace(/^\+\+\+ .*$/m, `+++ ${newLabel}`)
      .trim();
    return out || 'No differences.';
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function renderBody(fn) {
  if (!fn) return 'not found';
  const body = fn.bodyText.trim();
  if (/^function\b/.test(body)) return body;
  return `function ${fn.name}(${fn.params.join(', ')})\n${body}`;
}

export function buildDossier({ file, name, modSource, oldSource, newSource }) {
  const modFn = findFunction(modSource, name);
  if (!modFn) throw new Error(`LIES function not found: ${name}`);
  const oldFn = findFunction(oldSource, name);
  const newFn = findFunction(newSource, name);
  const classified = classifySources(modSource, oldSource, newSource);
  const row = classified.rows.find(item => item.name === name);

  const category = row ? row.category : 'UNKNOWN';
  const note = row && row.note ? row.note : '';
  const oldLines = oldFn ? oldFn.endLine - oldFn.startLine + 1 : 0;
  const newLines = newFn ? newFn.endLine - newFn.startLine + 1 : 0;
  const modLines = modFn.endLine - modFn.startLine + 1;

  const lines = [];
  lines.push(`# Function dossier: ${file} :: ${name}`);
  lines.push('');
  lines.push(`Category: **${category}**${note ? ` — ${note}` : ''}`);
  lines.push('');
  lines.push(`- LIES: ${modLines} lines, params \`(${modFn.params.join(', ')})\``);
  lines.push(`- 246.1: ${oldFn ? `${oldLines} lines, params \`(${oldFn.params.join(', ')})\`` : 'not found'}`);
  lines.push(`- 248.2: ${newFn ? `${newLines} lines, params \`(${newFn.params.join(', ')})\`` : 'not found'}`);
  lines.push('');
  lines.push('Normalized signature: `self` is omitted for methods; the body is the porting surface.');
  lines.push('');
  lines.push('## LIES body (V8.57)');
  lines.push('');
  lines.push('```lua');
  lines.push(renderBody(modFn));
  lines.push('```');
  lines.push('');
  lines.push('## 246.1 vanilla (a3180fc)');
  lines.push('');
  if (oldFn) {
    lines.push('```lua');
    lines.push(renderBody(oldFn));
    lines.push('```');
  } else {
    lines.push('246.1: not found.');
  }
  lines.push('');
  lines.push('## 248.2 vanilla (e3a8b616)');
  lines.push('');
  if (newFn) {
    lines.push('```lua');
    lines.push(renderBody(newFn));
    lines.push('```');
  } else {
    lines.push('248.2: not found.');
  }
  lines.push('');
  lines.push('## Diff 246.1 -> LIES');
  lines.push('');
  if (oldFn) {
    lines.push('```diff');
    lines.push(gitDiff(oldFn.bodyText, modFn.bodyText, '246.1 vanilla', 'LIES'));
    lines.push('```');
  } else {
    lines.push('Cannot diff: 246.1 function not found.');
  }
  lines.push('');
  lines.push('## Diff 246.1 -> 248.2');
  lines.push('');
  if (oldFn && newFn) {
    lines.push('```diff');
    lines.push(gitDiff(oldFn.bodyText, newFn.bodyText, '246.1 vanilla', '248.2 vanilla'));
    lines.push('```');
  } else {
    lines.push('Cannot diff: old or new function missing.');
  }
  lines.push('');
  lines.push('## Porter checklist');
  lines.push('');
  lines.push('- [ ] Decision: keep LIES body, adopt 248.2 vanilla, or merge.');
  lines.push('- [ ] If merge: re-apply the LIES intent onto the 248.2 body, not the 246.1 body.');
  lines.push('- [ ] Check removed/changed APIs (`_room_doors`, numeric `_nav_segments`, `no_dispose`, `session():send_to_peers_synched`, ...).');
  lines.push('- [ ] Check new 248.2 fields/callbacks this function must preserve.');
  lines.push('- [ ] Run `luajit -bl` and `api-audit` on the file.');
  lines.push('');

  return lines.join('\n');
}

function parseArgs(argv) {
  const args = {
    file: '',
    hook: '',
    name: '',
    mod: process.cwd(),
    clone: defaultClone(HERE),
    old: 'a3180fc',
    new: 'e3a8b616',
    out: '',
    list: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--hook') args.hook = argv[++i];
    else if (arg === '--name') args.name = argv[++i];
    else if (arg === '--mod') args.mod = argv[++i];
    else if (arg === '--clone') args.clone = argv[++i];
    else if (arg === '--old') args.old = argv[++i];
    else if (arg === '--new') args.new = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--list') args.list = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node dev/tools/fn-workbench.mjs --file <script_path> [--hook <hook_id>] --name <Class.method> [--list]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readModTxt(modDir) {
  const file = path.join(modDir, 'mod.txt');
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'));
  }
}

function gitShow(clone, rev, file) {
  try {
    return execFileSync('git', ['-C', clone, 'show', `${rev}:${file}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error('--file is required');
  const modDir = path.resolve(args.mod);
  const modFile = path.join(modDir, args.file);
  if (!fs.existsSync(modFile)) throw new Error(`mod file not found: ${modFile}`);

  const modSource = fs.readFileSync(modFile, 'utf8');

  if (args.list) {
    const parsed = parseSource(modSource);
    if (!parsed.ok) throw new Error(`parse failed: ${parsed.error ? parsed.error.message : 'unknown error'}`);
    const { functions } = collectFunctions(modSource, parsed.ast);
    for (const fn of functions) console.log(fn.name);
    return;
  }

  if (!args.name) throw new Error('--name is required unless --list is used');
  const modTxt = readModTxt(modDir);
  const hooks = Array.isArray(modTxt.hooks) ? modTxt.hooks : [];
  const hook = args.hook
    ? hooks.find(item => item.hook_id === args.hook)
    : hooks.find(item => item.script_path === args.file);
  if (!hook) throw new Error(`no hook found for ${args.file}; pass --hook`);

  const oldSource = gitShow(path.resolve(args.clone), args.old, `${hook.hook_id}.lua`);
  const newSource = gitShow(path.resolve(args.clone), args.new, `${hook.hook_id}.lua`);
  if (oldSource === null) throw new Error(`missing old game file: ${args.old}:${hook.hook_id}.lua`);
  if (newSource === null) throw new Error(`missing new game file: ${args.new}:${hook.hook_id}.lua`);

  const dossier = buildDossier({
    file: args.file,
    name: args.name,
    modSource,
    oldSource,
    newSource
  });

  if (args.out) {
    const out = path.resolve(args.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, dossier);
    console.log(`wrote ${out}`);
  } else {
    process.stdout.write(dossier);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

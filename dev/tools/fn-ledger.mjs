#!/usr/bin/env node
// Function-level ledger for LIES 248.2 port.
// Classifies every function defined by the mod against an old and a new game file.
//
// Usage:
//   node dev/tools/fn-ledger.mjs --mod . --clone ../../game-data/Payday-2-LuaJIT-Complete \
//     --old a3180fc --new e3a8b616 --out dev/port-248-ledger.md --json dev/reports/port-248-ledger.json

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { luaparseCandidates, defaultClone } from './workspace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadLuaparse() {
  for (const candidate of luaparseCandidates(HERE)) {
    try { return require(candidate); } catch { /* next */ }
  }
  throw new Error('luaparse not found; install with: npm install --prefix tools/lua luaparse');
}

const luaparse = loadLuaparse();

// ---------------------------------------------------------------------------
// Source normalization
// ---------------------------------------------------------------------------

// Strip comments and insignificant whitespace while preserving string bodies.
export function normalizeLua(source) {
  let out = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];

    if (c === '-' && c2 === '-') {
      const tail = source.slice(i);
      const long = /^--(\[(=*)\[)/.exec(tail);
      if (long) {
        const close = ']' + long[2] + ']';
        const end = source.indexOf(close, i + long[0].length);
        i = end === -1 ? n : end + close.length;
      } else {
        const nl = source.indexOf('\n', i + 2);
        i = nl === -1 ? n : nl + 1;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        const ch = source[i];
        out += ch;
        if (ch === '\\') {
          if (i + 1 < n) out += source[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (ch === quote) break;
      }
      continue;
    }

    if (c === '[') {
      const long = /^\[(=*)\[/.exec(source.slice(i));
      if (long) {
        const close = ']' + long[1] + ']';
        const end = source.indexOf(close, i + long[0].length);
        const stop = end === -1 ? n : end + close.length;
        out += source.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (/\s/.test(c) || c === ';') { i++; continue; }

    out += c;
    i++;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Parsing and collection
// ---------------------------------------------------------------------------

const LUA_VERSIONS = ['5.1', '5.2', '5.3'];

export function parseSource(source) {
  let lastError = null;
  for (const luaVersion of LUA_VERSIONS) {
    try {
      const ast = luaparse.parse(source, {
        luaVersion,
        comments: false,
        scope: false,
        ranges: true,
        locations: true
      });
      return { ok: true, ast, luaVersion };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, error: lastError };
}

function memberName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    const base = memberName(node.base);
    if (!base) return null;
    if (node.identifier) return `${base}.${node.identifier.name}`;
    if (node.index && node.index.type === 'StringLiteral') return `${base}.${node.index.value}`;
    return null;
  }
  return null;
}

function paramNames(parameters) {
  return (parameters || []).map(param => {
    if (param.type === 'VarargLiteral') return '...';
    if (param.type === 'Identifier') return param.name;
    return '?';
  });
}

function stringLiteralValue(node) {
  if (!node) return null;
  if (node.type !== 'StringLiteral') return null;
  if (node.value !== null && node.value !== undefined) return node.value;
  if (typeof node.raw === 'string' && node.raw.length >= 2) return node.raw.slice(1, -1);
  return null;
}

function functionRecord(name, node, source, form, isLocal = false, isHook = false) {
  if (!name) return null;
  const params = paramNames(node.parameters);
  const isMethod = form === 'colon' || name.includes('.');
  if (isMethod && params[0] === 'self') params.shift();

  const bodyStart = node.body && node.body[0] ? node.body[0].range[0] : node.range[0];
  const bodyEnd = node.range[1];
  const bodyText = source.slice(bodyStart, bodyEnd);

  return {
    name,
    params,
    norm: normalizeLua(bodyText),
    startLine: node.loc ? node.loc.start.line : 0,
    endLine: node.loc ? node.loc.end.line : 0,
    form,
    isLocal,
    isHook,
    bodyText
  };
}

export function collectFunctions(source, ast) {
  const out = [];
  const duplicates = new Map();

  const add = record => {
    if (!record) return;
    if (duplicates.has(record.name)) {
      duplicates.set(record.name, duplicates.get(record.name) + 1);
      // Last definition wins at runtime; replace the earlier record.
      const index = out.findIndex(r => r.name === record.name);
      if (index !== -1) out.splice(index, 1);
    } else {
      duplicates.set(record.name, 1);
    }
    out.push(record);
  };

  const visit = node => {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'FunctionDeclaration') {
      if (node.identifier) {
        const identifier = node.identifier;
        const form = identifier.type === 'MemberExpression' && identifier.indexer === ':' ? 'colon' : 'decl';
        add(functionRecord(memberName(identifier), node, source, form, Boolean(node.isLocal)));
      }
      // Anonymous function expressions are recorded by their assignment/local
      // statement; never descend into a function body.
      return;
    }

    if (node.type === 'CallStatement' && node.expression && node.expression.type === 'CallExpression') {
      const call = node.expression;
      const baseName = memberName(call.base);
      if (baseName === 'Hooks.PostHook' || baseName === 'Hooks.PreHook') {
        const args = call.arguments || [];
        const className = memberName(args[0]);
        const method = stringLiteralValue(args[1]);
        const id = stringLiteralValue(args[2]);
        const callback = args[3];
        if (className && method && id && callback && callback.type === 'FunctionDeclaration') {
          const kind = baseName === 'Hooks.PostHook' ? 'PostHook' : 'PreHook';
          add(functionRecord(`Hooks.${kind}:${className}.${method}:${id}`, callback, source, 'hook', false, true));
        }
        return;
      }
    }

    if (node.type === 'AssignmentStatement' && node.variables && node.init) {
      let found = false;
      for (let i = 0; i < node.init.length; i++) {
        const init = node.init[i];
        const variable = node.variables[i];
        if (init && init.type === 'FunctionDeclaration' && !init.identifier && variable) {
          const form = variable.type === 'MemberExpression' && variable.indexer === ':' ? 'colon' : 'assignment';
          add(functionRecord(memberName(variable), init, source, form));
          found = true;
        }
      }
      if (found) return;
    }

    if (node.type === 'LocalStatement' && node.init && node.init.length) {
      let found = false;
      for (let i = 0; i < node.init.length; i++) {
        const init = node.init[i];
        const variable = node.variables ? node.variables[i] : null;
        if (init && init.type === 'FunctionDeclaration' && !init.identifier && variable && variable.type === 'Identifier') {
          add(functionRecord(variable.name, init, source, 'local', true));
          found = true;
        }
      }
      if (found) return;
    }

    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'range' || key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) visit(child);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        visit(value);
      }
    }
  };

  visit(ast);
  return { functions: out, duplicates };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function toMap(functions) {
  const map = new Map();
  for (const fn of functions) map.set(fn.name, fn);
  return map;
}

function sameFunction(a, b) {
  if (!a || !b) return false;
  if (a.params.length !== b.params.length) return false;
  for (let i = 0; i < a.params.length; i++) {
    if (a.params[i] !== b.params[i]) return false;
  }
  return a.norm === b.norm;
}

export function classifySources(modSource, oldSource, newSource) {
  const errors = [];
  const parsed = {
    mod: parseSource(modSource),
    old: parseSource(oldSource),
    new: parseSource(newSource)
  };

  for (const stage of ['mod', 'old', 'new']) {
    if (!parsed[stage].ok) {
      errors.push({
        stage,
        message: `${stage} parse failed: ${parsed[stage].error ? parsed[stage].error.message : 'unknown error'}`
      });
    }
  }

  if (!parsed.mod.ok) {
    return { rows: [], errors, totals: {} };
  }

  const modFunctions = collectFunctions(modSource, parsed.mod.ast).functions;
  const oldFunctions = parsed.old.ok ? collectFunctions(oldSource, parsed.old.ast).functions : [];
  const newFunctions = parsed.new.ok ? collectFunctions(newSource, parsed.new.ast).functions : [];

  const oldMap = toMap(oldFunctions);
  const newMap = toMap(newFunctions);
  const rows = [];

  for (const modFn of modFunctions) {
    const oldFn = oldMap.get(modFn.name);
    const newFn = newMap.get(modFn.name);

    let category;
    let note = '';

    if (modFn.isHook) {
      category = 'MOD_ONLY_HOOK';
      note = 'Hooks:PostHook/PreHook callback; audit and port with the hooked method';
    } else if (!parsed.old.ok || !parsed.new.ok) {
      category = 'UNCLASSIFIED_PARSE_ERROR';
      note = 'old and/or new game file did not parse';
    } else if (!oldFn && !newFn) {
      category = 'MOD_ONLY';
    } else if (!oldFn && newFn) {
      category = 'MOD_ONLY_NEWALSO';
      note = 'name also exists in 248.2 vanilla; check whether LIES should override it';
    } else if (oldFn && !newFn) {
      category = 'VANISHED_IN_NEW';
      note = 'function exists in 246.1 but not in 248.2; drop or re-home';
    } else if (sameFunction(modFn, oldFn)) {
      category = modFn.isLocal && !modFn.name.includes('.') ? 'SAME_AS_OLD_VANILLA_LOCAL' : 'SAME_AS_OLD_VANILLA';
      note = category === 'SAME_AS_OLD_VANILLA_LOCAL'
        ? 'local helper; keep even if identical to vanilla'
        : 'stale 246.1 copy; delete unless intentionally kept';
    } else if (sameFunction(modFn, newFn)) {
      category = 'SAME_AS_NEW_VANILLA';
      note = 'matches 248.2 vanilla; no override needed';
    } else if (sameFunction(oldFn, newFn)) {
      category = 'LIES_EDIT_CLEAN';
    } else {
      category = 'LIES_EDIT_VANILLA_CHANGED';
      if (oldFn.params.join(',') !== newFn.params.join(',')) {
        note = `signature changed: (${oldFn.params.join(', ')}) -> (${newFn.params.join(', ')})`;
      }
    }

    rows.push({
      name: modFn.name,
      category,
      modLines: modFn.endLine - modFn.startLine + 1,
      oldLines: oldFn ? oldFn.endLine - oldFn.startLine + 1 : 0,
      newLines: newFn ? newFn.endLine - newFn.startLine + 1 : 0,
      modParams: modFn.params.join(', '),
      oldParams: oldFn ? oldFn.params.join(', ') : '',
      newParams: newFn ? newFn.params.join(', ') : '',
      isLocal: Boolean(modFn.isLocal),
      isHook: Boolean(modFn.isHook),
      form: modFn.form,
      note,
      startLine: modFn.startLine
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = {};
  for (const row of rows) totals[row.category] = (totals[row.category] || 0) + 1;

  return { rows, errors, totals };
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

const STATUS = {
  LIES_EDIT_VANILLA_CHANGED: '**PORT**',
  MOD_ONLY: 'audit',
  MOD_ONLY_NEWALSO: 'audit',
  MOD_ONLY_HOOK: 'audit (hook)',
  VANISHED_IN_NEW: 'drop/rewrite',
  LIES_EDIT_CLEAN: 'keep',
  SAME_AS_NEW_VANILLA: 'keep (new)',
  SAME_AS_OLD_VANILLA: 'delete',
  SAME_AS_OLD_VANILLA_LOCAL: 'keep (local helper)',
  UNCLASSIFIED_PARSE_ERROR: 'BLOCKED'
};

const ORDER = [
  'LIES_EDIT_VANILLA_CHANGED',
  'MOD_ONLY_NEWALSO',
  'MOD_ONLY_HOOK',
  'MOD_ONLY',
  'VANISHED_IN_NEW',
  'SAME_AS_OLD_VANILLA',
  'SAME_AS_OLD_VANILLA_LOCAL',
  'LIES_EDIT_CLEAN',
  'SAME_AS_NEW_VANILLA',
  'UNCLASSIFIED_PARSE_ERROR'
];

function statusRank(category) {
  const index = ORDER.indexOf(category);
  return index === -1 ? ORDER.length : index;
}

export function renderMarkdown({ oldRev, newRev, generated, files }) {
  const overall = {};
  for (const file of files) {
    for (const [key, value] of Object.entries(file.totals || {})) {
      overall[key] = (overall[key] || 0) + value;
    }
  }

  const lines = [];
  lines.push('# LIES 248.2 port — function ledger');
  lines.push('');
  lines.push(`Generated: ${generated}`);
  lines.push(`Old baseline: \`${oldRev}\`  Target: \`${newRev}\``);
  lines.push('');
  lines.push('Status is the proposed action. `PORT` = port LIES intent onto 248.2; `audit` = LIES-only, check API calls; `delete` = stale 246.1 copy; `keep` = no port work; `drop/rewrite` = target function gone; `BLOCKED` = parse failure.');
  lines.push('');
  lines.push('Scope: top-level function definitions only. Nested helpers are folded into their parent function body and are ported with it.');
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push('| category | count |');
  lines.push('|---|---:|');
  for (const category of ORDER) {
    if (overall[category]) lines.push(`| ${category} | ${overall[category]} |`);
  }
  lines.push('');

  for (const file of files) {
    lines.push(`## ${file.file}`);
    lines.push('');
    if (file.unhooked) {
      lines.push('**UNHOOKED FILE** — not referenced by mod.txt; it never loads.');
      lines.push('');
      continue;
    }
    if (!file.rows.length) {
      lines.push(file.errors && file.errors.length
        ? `BLOCKED: ${file.errors.map(e => e.message).join('; ')}`
        : 'No function definitions (hook/overlay file).');
      lines.push('');
      continue;
    }
    lines.push('| done | status | function | mod L | old L | new L | note |');
    lines.push('|---:|---|---|---:|---:|---:|---|');
    const sorted = [...file.rows].sort((a, b) => {
      const rank = statusRank(a.category) - statusRank(b.category);
      return rank !== 0 ? rank : a.name.localeCompare(b.name);
    });
    for (const row of sorted) {
      const status = STATUS[row.category] || row.category;
      lines.push(`| [ ] | ${status} | \`${row.name}\` | ${row.modLines} | ${row.oldLines} | ${row.newLines} | ${row.note || ''} |`);
    }
    lines.push('');
    if (file.errors && file.errors.length) {
      lines.push(`Parse errors: ${file.errors.map(e => e.message).join('; ')}`);
      lines.push('');
    }
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    mod: process.cwd(),
    clone: defaultClone(HERE),
    old: 'a3180fc',
    new: 'e3a8b616',
    out: '',
    json: '',
    only: '',
    verbose: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mod') args.mod = argv[++i];
    else if (arg === '--clone') args.clone = argv[++i];
    else if (arg === '--old') args.old = argv[++i];
    else if (arg === '--new') args.new = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--json') args.json = argv[++i];
    else if (arg === '--only') args.only = argv[++i];
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node dev/tools/fn-ledger.mjs [--mod DIR] [--clone DIR] [--old REV] [--new REV] [--out FILE] [--json FILE] [--only SUBSTR]');
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
  } catch (error) {
    return null;
  }
}

function walkLuaFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'dev' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkLuaFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.lua')) out.push(full);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const modDir = path.resolve(args.mod);
  const cloneDir = path.resolve(args.clone);
  const modTxt = readModTxt(modDir);
  const hooks = Array.isArray(modTxt.hooks) ? modTxt.hooks : [];

  if (!hooks.length) throw new Error(`no hooks in ${path.join(modDir, 'mod.txt')}`);

  const files = [];
  for (const hook of hooks) {
    const hookId = String(hook.hook_id || '');
    const scriptPath = String(hook.script_path || '');
    if (!hookId || !scriptPath) continue;
    if (args.only && !scriptPath.includes(args.only) && !hookId.includes(args.only)) continue;

    const modFile = path.join(modDir, scriptPath);
    if (!fs.existsSync(modFile)) {
      files.push({ file: scriptPath, hook: hookId, rows: [], errors: [{ stage: 'mod', message: `missing mod file: ${modFile}` }], totals: {} });
      continue;
    }

    const oldSource = gitShow(cloneDir, args.old, `${hookId}.lua`);
    const newSource = gitShow(cloneDir, args.new, `${hookId}.lua`);
    if (oldSource === null || newSource === null) {
      const missing = [];
      if (oldSource === null) missing.push(`old ${args.old}`);
      if (newSource === null) missing.push(`new ${args.new}`);
      files.push({ file: scriptPath, hook: hookId, rows: [], errors: [{ stage: 'game', message: `missing game file at ${missing.join(', ')}: ${hookId}.lua` }], totals: {} });
      continue;
    }

    const result = classifySources(fs.readFileSync(modFile, 'utf8'), oldSource, newSource);
    files.push({ file: scriptPath, hook: hookId, rows: result.rows, errors: result.errors, totals: result.totals });

    if (args.verbose) {
      const counts = Object.entries(result.totals).map(([k, v]) => `${k}=${v}`).join(' ');
      console.error(`${scriptPath}: ${counts || 'no functions'}`);
    }
  }

  // Flag Lua files that are not referenced by mod.txt: they never load.
  const hookedScripts = new Set(hooks.map(hook => String(hook.script_path || '')));
  const knownFiles = new Set(files.map(file => file.file));
  for (const absolute of walkLuaFiles(modDir)) {
    const rel = path.relative(modDir, absolute).replace(/\\/g, '/');
    if (hookedScripts.has(rel) || knownFiles.has(rel)) continue;
    files.push({ file: rel, hook: '', rows: [], errors: [], totals: {}, unhooked: true });
  }

  const markdown = renderMarkdown({
    oldRev: args.old,
    newRev: args.new,
    generated: new Date().toISOString(),
    files
  });
  const out = args.out ? path.resolve(args.out) : '';
  const jsonOut = args.json ? path.resolve(args.json) : '';
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown);
  }
  if (jsonOut) {
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify({ oldRev: args.old, newRev: args.new, generated: new Date().toISOString(), files }, null, 2));
  }

  const totalRows = files.reduce((sum, file) => sum + file.rows.length, 0);
  const totalErrors = files.reduce((sum, file) => sum + file.errors.length, 0);
  const unhooked = files.filter(file => file.unhooked).length;
  const totals = {};
  for (const file of files) {
    for (const [key, value] of Object.entries(file.totals || {})) totals[key] = (totals[key] || 0) + value;
  }
  console.log(`files=${files.length} functions=${totalRows} errors=${totalErrors} unhooked=${unhooked}`);
  console.log(Object.entries(totals).map(([k, v]) => `${k}=${v}`).join(' '));
  if (out) console.log(`wrote ${out}`);
  if (jsonOut) console.log(`wrote ${jsonOut}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

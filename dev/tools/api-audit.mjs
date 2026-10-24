#!/usr/bin/env node
// API audit for the LIES 248.2 port.
// Scans mod Lua for symbols removed or semantically changed by Diesel 3.0 / 247-248,
// checks that every hook target and script path exists, and reports findings.
//
// Usage:
//   node dev/tools/api-audit.mjs --mod . --clone ../../game-data/Payday-2-LuaJIT-Complete \
//     --new e3a8b616 --out dev/reports/api-audit.md --json dev/reports/api-audit.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { defaultClone } from './workspace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYMBOLS_PATH = path.join(HERE, 'removed-symbols.json');

export function loadSymbols(file = DEFAULT_SYMBOLS_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function extractHookDeclarations(source) {
  const declarations = [];
  const pattern = /Hooks\s*:\s*(PostHook|PreHook)\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*(['"])([^'"]+)\3\s*,\s*(['"])([^'"]+)\5/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    declarations.push({
      kind: match[1],
      className: match[2],
      method: match[4],
      id: match[6],
      line: source.slice(0, match.index).split('\n').length
    });
  }
  return declarations;
}

// Replace comments and string contents with spaces while preserving newlines.
// Keeps line numbers stable and prevents symbols inside comments/strings from
// producing false positives.
function maskLua(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  const blank = text => text.replace(/[^\n]/g, ' ');

  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];

    if (c === '-' && c2 === '-') {
      const long = /^--(\[(=*)\[)/.exec(source.slice(i));
      if (long) {
        const close = ']' + long[2] + ']';
        const end = source.indexOf(close, i + long[0].length);
        const stop = end === -1 ? n : end + close.length;
        out += blank(source.slice(i, stop));
        i = stop;
      } else {
        const end = source.indexOf('\n', i + 2);
        const stop = end === -1 ? n : end;
        out += blank(source.slice(i, stop));
        i = stop;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      while (i < n) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i++; break; }
        i++;
      }
      out += blank(source.slice(start, i));
      continue;
    }

    if (c === '[') {
      const long = /^\[(=*)\[/.exec(source.slice(i));
      if (long) {
        const close = ']' + long[1] + ']';
        const end = source.indexOf(close, i + long[0].length);
        const stop = end === -1 ? n : end + close.length;
        out += blank(source.slice(i, stop));
        i = stop;
        continue;
      }
    }

    out += c;
    i++;
  }

  return out;
}

// True when symbol occurs as a whole identifier/expression, not inside a longer name.
function containsSymbol(code, symbol) {
  let index = code.indexOf(symbol);
  while (index !== -1) {
    const before = index === 0 ? '' : code[index - 1];
    const after = index + symbol.length >= code.length ? '' : code[index + symbol.length];
    const beforeOk = !before || !/[A-Za-z0-9_]/.test(before);
    const afterOk = !after || !/[A-Za-z0-9_]/.test(after);
    if (beforeOk && afterOk) return true;
    index = code.indexOf(symbol, index + 1);
  }
  return false;
}

export function auditText(source, { file, symbols }) {
  const findings = [];
  const maskedLines = maskLua(source).split(/\r?\n/);
  const originalLines = source.split(/\r?\n/);
  // Longest first so _room_doors suppresses the _rooms substring on the same line.
  const ordered = [...symbols].sort((a, b) => b.symbol.length - a.symbol.length);

  for (let lineIndex = 0; lineIndex < maskedLines.length; lineIndex++) {
    const line = maskedLines[lineIndex];
    const code = line;
    if (!code.trim()) continue;
    const matched = [];
    for (const entry of ordered) {
      if (matched.some(existing => existing.includes(entry.symbol))) continue;
      if (!containsSymbol(code, entry.symbol)) continue;
      matched.push(entry.symbol);
      findings.push({
        file,
        line: lineIndex + 1,
        symbol: entry.symbol,
        severity: entry.severity,
        reason: entry.reason,
        text: (originalLines[lineIndex] || line).trim().slice(0, 200)
      });
    }
  }

  return findings;
}

export function renderReport({ targetRev, hookChecks, hookMethodChecks, findings }) {
  const errors = findings.filter(item => item.severity === 'error');
  const reviews = findings.filter(item => item.severity === 'review');
  const badHooks = hookChecks.filter(item => !item.ok);
  const methodChecks = hookMethodChecks || [];
  const badMethods = methodChecks.filter(item => !item.ok);

  const lines = [];
  lines.push('# LIES 248.2 API audit');
  lines.push('');
  lines.push(`Target: \`${targetRev}\``);
  lines.push('');
  lines.push(`- hooks: ${hookChecks.length - badHooks.length}/${hookChecks.length} ok`);
  lines.push(`- method checks: ${methodChecks.length - badMethods.length}/${methodChecks.length} ok`);
  lines.push(`- errors: ${errors.length}`);
  lines.push(`- review: ${reviews.length}`);
  lines.push('');

  lines.push('## Hook checks');
  lines.push('');
  lines.push('| status | hook | script | note |');
  lines.push('|---|---|---|---|');
  for (const check of hookChecks) {
    lines.push(`| ${check.ok ? 'ok' : 'FAIL'} | \`${check.hook}\` | \`${check.file}\` | ${check.reason || ''} |`);
  }
  lines.push('');

  lines.push('## Hook method checks');
  lines.push('');
  if (!methodChecks.length) {
    lines.push('None.');
    lines.push('');
  } else {
    lines.push('| status | hook | class.method | id |');
    lines.push('|---|---|---|---|');
    for (const check of methodChecks) {
      const status = !check.ok ? 'FAIL' : (check.inherited ? 'ok (base)' : 'ok');
      lines.push(`| ${status} | ${check.kind || ''} | \`${check.className}.${check.method}\` | \`${check.id}\` |`);
    }
    lines.push('');
  }

  for (const [title, items] of [['Errors', errors], ['Review', reviews]]) {
    lines.push(`## ${title}`);
    lines.push('');
    if (!items.length) {
      lines.push('None.');
      lines.push('');
      continue;
    }
    for (const item of items) {
      lines.push(`- \`${item.file}:${item.line}\` \`${item.symbol}\` — ${item.reason}. \`${item.text}\``);
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
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

function hookExists(cloneDir, rev, hook) {
  const result = spawnSync('git', ['-C', cloneDir, 'cat-file', '-e', `${rev}:${hook}.lua`], {
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe']
  });
  return result.status === 0;
}

function walkLua(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'dev' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkLua(full, out);
    else if (entry.isFile() && entry.name.endsWith('.lua')) out.push(full);
  }
  return out;
}

export function auditMod({ modDir, cloneDir, targetRev, symbols }) {
  const modTxt = readModTxt(modDir);
  const hooks = Array.isArray(modTxt.hooks) ? modTxt.hooks : [];
  const hookChecks = [];
  const findings = [];
  const luaFiles = walkLua(modDir);

  for (const hook of hooks) {
    const hookId = String(hook.hook_id || '');
    const scriptPath = String(hook.script_path || '');
    const modFile = path.join(modDir, scriptPath);
    const exists = fs.existsSync(modFile);
    const targetExists = exists && hookExists(cloneDir, targetRev, hookId);
    hookChecks.push({
      hook: hookId,
      file: scriptPath,
      ok: exists && targetExists,
      reason: !exists ? 'missing mod file' : (!targetExists ? `missing at ${targetRev}` : '')
    });
    if (!exists) continue;
    findings.push(...auditText(fs.readFileSync(modFile, 'utf8'), { file: scriptPath, symbols }));
  }

  // Also scan Lua files that are not hooked directly (helpers, menu files).
  const hooked = new Set(hooks.map(hook => String(hook.script_path || '')));
  for (const file of luaFiles) {
    const rel = path.relative(modDir, file).replace(/\\/g, '/');
    if (hooked.has(rel)) continue;
    findings.push(...auditText(fs.readFileSync(file, 'utf8'), { file: rel, symbols }));
  }

  // Verify every Hooks:PostHook/PreHook method exists at the target revision.
  const methodCache = new Map();
  const methodExists = (className, method) => {
    const key = `${className}.${method}`;
    if (methodCache.has(key)) return methodCache.get(key);
    const exactPatterns = [
      `function ${className}:${method}`,
      `function ${className}.${method}`,
      `${className}.${method} = function`
    ];
    let result = { ok: false, inherited: false };
    for (const pattern of exactPatterns) {
      const hit = spawnSync('git', ['-C', cloneDir, 'grep', '-n', '--fixed-strings', pattern, targetRev, '--', '*.lua'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      if (hit.status === 0) { result = { ok: true, inherited: false }; break; }
    }
    if (!result.ok) {
      const escaped = method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const inheritedPattern = `function [A-Za-z0-9_.]+[:.]${escaped}\\s*\\(`;
      const hit = spawnSync('git', ['-C', cloneDir, 'grep', '-n', '-E', inheritedPattern, targetRev, '--', '*.lua'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      if (hit.status === 0) result = { ok: true, inherited: true };
    }
    methodCache.set(key, result);
    return result;
  };

  const declarations = new Map();
  for (const file of luaFiles) {
    const rel = path.relative(modDir, file).replace(/\\/g, '/');
    const source = fs.readFileSync(file, 'utf8');
    for (const declaration of extractHookDeclarations(source)) {
      const key = `${declaration.className}.${declaration.method}:${declaration.id}`;
      if (!declarations.has(key)) declarations.set(key, { ...declaration, file: rel });
    }
  }

  const hookMethodChecks = [];
  for (const declaration of declarations.values()) {
    const check = methodExists(declaration.className, declaration.method);
    hookMethodChecks.push({
      kind: declaration.kind,
      className: declaration.className,
      method: declaration.method,
      id: declaration.id,
      file: declaration.file,
      ok: check.ok,
      inherited: check.inherited
    });
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.symbol.localeCompare(b.symbol));
  return { targetRev, hookChecks, hookMethodChecks, findings };
}

function parseArgs(argv) {
  const args = {
    mod: process.cwd(),
    clone: defaultClone(HERE),
    new: 'e3a8b616',
    out: '',
    json: '',
    symbols: DEFAULT_SYMBOLS_PATH,
    strict: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mod') args.mod = argv[++i];
    else if (arg === '--clone') args.clone = argv[++i];
    else if (arg === '--new') args.new = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--json') args.json = argv[++i];
    else if (arg === '--symbols') args.symbols = argv[++i];
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node dev/tools/api-audit.mjs [--mod DIR] [--clone DIR] [--new REV] [--symbols FILE] [--out FILE] [--json FILE] [--strict]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbols = loadSymbols(path.resolve(args.symbols));
  const report = auditMod({
    modDir: path.resolve(args.mod),
    cloneDir: path.resolve(args.clone),
    targetRev: args.new,
    symbols
  });
  const markdown = renderReport(report);

  if (args.out) {
    const out = path.resolve(args.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown);
  }
  if (args.json) {
    const out = path.resolve(args.json);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
  }
  if (!args.out && !args.json) process.stdout.write(markdown);

  const errors = report.findings.filter(item => item.severity === 'error').length;
  const reviews = report.findings.filter(item => item.severity === 'review').length;
  const badHooks = report.hookChecks.filter(item => !item.ok).length;
  const badMethods = report.hookMethodChecks.filter(item => !item.ok).length;
  console.log(`hooks=${report.hookChecks.length - badHooks}/${report.hookChecks.length} methods=${report.hookMethodChecks.length - badMethods}/${report.hookMethodChecks.length} errors=${errors} review=${reviews}`);
  if (args.strict && (errors || badHooks || badMethods)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

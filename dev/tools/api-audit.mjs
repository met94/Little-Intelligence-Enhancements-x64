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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYMBOLS_PATH = path.join(HERE, 'removed-symbols.json');

export function loadSymbols(file = DEFAULT_SYMBOLS_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Return the part of a line before a Lua line comment, ignoring -- inside strings.
function codePart(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '-' && line[i + 1] === '-') return line.slice(0, i);
  }
  return line;
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
  const lines = source.split(/\r?\n/);
  // Longest first so _room_doors suppresses the _rooms substring on the same line.
  const ordered = [...symbols].sort((a, b) => b.symbol.length - a.symbol.length);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const code = codePart(line);
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
        text: line.trim().slice(0, 200)
      });
    }
  }

  return findings;
}

export function renderReport({ targetRev, hookChecks, findings }) {
  const errors = findings.filter(item => item.severity === 'error');
  const reviews = findings.filter(item => item.severity === 'review');
  const badHooks = hookChecks.filter(item => !item.ok);

  const lines = [];
  lines.push('# LIES 248.2 API audit');
  lines.push('');
  lines.push(`Target: \`${targetRev}\``);
  lines.push('');
  lines.push(`- hooks: ${hookChecks.length - badHooks.length}/${hookChecks.length} ok`);
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
  for (const file of walkLua(modDir)) {
    const rel = path.relative(modDir, file).replace(/\\/g, '/');
    if (hooked.has(rel)) continue;
    findings.push(...auditText(fs.readFileSync(file, 'utf8'), { file: rel, symbols }));
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.symbol.localeCompare(b.symbol));
  return { targetRev, hookChecks, findings };
}

function parseArgs(argv) {
  const args = {
    mod: process.cwd(),
    clone: path.resolve(HERE, '../../../../game-data/Payday-2-LuaJIT-Complete'),
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
  console.log(`hooks=${report.hookChecks.length - badHooks}/${report.hookChecks.length} errors=${errors} review=${reviews}`);
  if (args.strict && (errors || badHooks)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

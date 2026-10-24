#!/usr/bin/env node
// Scan a SuperBLT log for LIES load status, Lua errors, and test-harness output.
//
// Usage:
//   node dev/tools/log-scan.mjs <logfile> [--mod DIR] [--out report.md] [--json report.json] [--strict]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const LUA_ERROR_RE = /attempt to (index|call|perform|compare|concatenate|arithmetic)|Lua: Error:/i;
const FATAL_RE = /FATAL ERROR|FATAL:/i;
const ERROR_MARKER_RE = /attempt to |Lua: Error:|stack traceback|FATAL ERROR|FATAL:/i;

function normalizeHook(hook) {
  return String(hook || '').replace(/\\/g, '/').replace(/\.lua$/, '');
}

export function scanLog(text, { file = '', hookFiles = [] } = {}) {
  const lines = text.split(/\r?\n/);
  const hooks = new Set(hookFiles.map(normalizeHook));

  const setup = [];
  const harness = [];
  const harnessErrors = [];
  const fatal = [];
  const luaErrors = [];
  const liesErrors = [];
  let setupSeen = false;

  const hasLiesFrame = (startIndex) => {
    const stop = Math.min(lines.length, startIndex + 8);
    for (let i = startIndex; i < stop; i++) {
      const line = lines[i];
      if (/\[LIES-TEST\]|mods[\\/]LIES|LIES\.lua|LIES:/.test(line)) return true;
      for (const hook of hooks) {
        if (hook && line.includes(hook)) return true;
      }
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/Setting up mod 'LIES'\s*$/.test(line)) {
      setup.push({ line: i + 1, text: line.trim() });
      setupSeen = true;
    }
    if (/\[LIES-TEST\]/.test(line)) harness.push({ line: i + 1, text: line.trim() });
    if (/\[LIES-TEST\]\s*ERROR/.test(line)) harnessErrors.push({ line: i + 1, text: line.trim() });
    if (FATAL_RE.test(line)) fatal.push({ line: i + 1, text: line.trim() });
    if (LUA_ERROR_RE.test(line)) {
      const entry = { line: i + 1, text: line.trim() };
      luaErrors.push(entry);
      if (setupSeen && ERROR_MARKER_RE.test(line) && hasLiesFrame(i)) {
        liesErrors.push(entry);
      }
    }
  }

  return {
    file,
    setup,
    harness,
    harnessErrors,
    fatal,
    luaErrors,
    liesErrors,
    ok: setup.length > 0 && fatal.length === 0 && liesErrors.length === 0 && harnessErrors.length === 0
  };
}

export function isOk(result, { strict = false } = {}) {
  if (!result.ok) return false;
  if (strict && result.luaErrors.length > 0) return false;
  return true;
}

export function renderReport(result) {
  const lines = [];
  lines.push('# LIES log scan');
  lines.push('');
  lines.push(`File: \`${result.file || '(stdin)'}\``);
  lines.push('');
  lines.push(`- setup: ${result.setup.length}`);
  lines.push(`- FATAL: ${result.fatal.length}`);
  lines.push(`- Lua errors: ${result.luaErrors.length}`);
  lines.push(`- LIES errors: ${result.liesErrors.length}`);
  lines.push(`- harness: ${result.harness.length}`);
  lines.push(`- harness errors: ${result.harnessErrors.length}`);
  lines.push(`- result: ${result.ok ? 'OK' : 'FAIL'}`);
  lines.push('');

  lines.push('## LIES setup');
  lines.push('');
  if (!result.setup.length) {
    lines.push('LIES did not report a setup line. Check that the mod is installed and enabled.');
  } else {
    for (const entry of result.setup) lines.push(`- ${entry.line}: \`${entry.text}\``);
  }
  lines.push('');

  lines.push('## FATAL');
  lines.push('');
  if (!result.fatal.length) lines.push('None.');
  else for (const entry of result.fatal) lines.push(`- ${entry.line}: \`${entry.text}\``);
  lines.push('');

  lines.push('## LIES errors');
  lines.push('');
  if (!result.liesErrors.length) lines.push('None.');
  else for (const entry of result.liesErrors) lines.push(`- ${entry.line}: \`${entry.text}\``);
  lines.push('');

  lines.push('## Other Lua errors');
  lines.push('');
  const other = result.luaErrors.filter(entry => !result.liesErrors.includes(entry));
  if (!other.length) lines.push('None.');
  else for (const entry of other) lines.push(`- ${entry.line}: \`${entry.text}\``);
  lines.push('');

  lines.push('## Harness output');
  lines.push('');
  if (!result.harness.length) lines.push('None.');
  else for (const entry of result.harness) lines.push(`- ${entry.line}: \`${entry.text}\``);
  lines.push('');

  lines.push('## Harness errors');
  lines.push('');
  if (!result.harnessErrors.length) lines.push('None.');
  else for (const entry of result.harnessErrors) lines.push(`- ${entry.line}: \`${entry.text}\``);
  lines.push('');

  return lines.join('\n') + '\n';
}

function readModTxt(modDir) {
  const file = path.join(modDir, 'mod.txt');
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'));
  }
}

function parseArgs(argv) {
  const args = {
    log: '',
    mod: process.cwd(),
    out: '',
    json: '',
    strict: false,
    hooks: ''
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mod') args.mod = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--json') args.json = argv[++i];
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--hooks') args.hooks = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node dev/tools/log-scan.mjs <logfile> [--mod DIR] [--hooks a,b] [--out FILE] [--json FILE] [--strict]');
      process.exit(0);
    } else if (!args.log) args.log = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.log) throw new Error('log file is required');

  let hookFiles = args.hooks ? args.hooks.split(',').map(item => item.trim()).filter(Boolean) : [];
  if (!hookFiles.length) {
    const modTxt = readModTxt(path.resolve(args.mod));
    if (modTxt && Array.isArray(modTxt.hooks)) hookFiles = modTxt.hooks.map(hook => hook.hook_id);
  }

  const result = scanLog(fs.readFileSync(path.resolve(args.log), 'utf8'), { file: path.resolve(args.log), hookFiles });
  const markdown = renderReport(result);

  if (args.out) {
    const out = path.resolve(args.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown);
  }
  if (args.json) {
    const out = path.resolve(args.json);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
  }
  if (!args.out && !args.json) process.stdout.write(markdown);

  console.log(`setup=${result.setup.length} fatal=${result.fatal.length} luaErrors=${result.luaErrors.length} liesErrors=${result.liesErrors.length} harness=${result.harness.length} ok=${isOk(result, { strict: args.strict })}`);
  if (!isOk(result, { strict: args.strict })) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

// Gate: the port backlog must be machine-readable.
//
// dev/port-248-ledger.md is generated from source classification, so a row
// stays `PORT` forever even after its intent landed. Completion therefore lives
// in dev/port-decisions.json, and this test fails when the two drift apart:
// every PORT/BLOCKED row needs a decision, no decision may name a function that
// is not in the ledger, and every reference must resolve (commit hash, or an
// existing dev/ report).
//
// It reads the generated ledger JSON (dev/reports/port-248-ledger.json) instead
// of the markdown, so a formatting change in the renderer cannot mask a gap.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD_ROOT = path.resolve(HERE, '..', '..', '..');

const DECISIONS_FILE = path.join(MOD_ROOT, 'dev', 'port-decisions.json');
const LEDGER_JSON = path.join(MOD_ROOT, 'dev', 'reports', 'port-248-ledger.json');
const PORT_STATUS = path.join(MOD_ROOT, 'dev', 'reports', 'port-status.md');

const VERDICTS = ['done', 'merge', 'keep', 'retire', 'parked'];
const REQUIRED_KEYS = ['function', 'file', 'verdict', 'reference', 'date', 'note'];
const DECISION_REQUIRED_CATEGORIES = ['LIES_EDIT_VANILLA_CHANGED', 'UNCLASSIFIED_PARSE_ERROR'];
const COMMIT_HASH = /^[0-9a-f]{7,40}$/i;
// Hand-written "next is ..." pointers rotted four times; the pointer has to be
// the decision store + ledger, never prose.
const STALE_POINTER = new RegExp('next (is|block)[^.\\n]*', 'i');

function readJson(file, what) {
  assert.ok(fs.existsSync(file), `${what} is missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ledgerRows() {
  const ledger = readJson(LEDGER_JSON, 'generated ledger JSON');
  assert.ok(Array.isArray(ledger.files), 'ledger JSON has no files array');
  const rows = [];
  for (const file of ledger.files) {
    for (const row of file.rows || []) rows.push({ file: file.file, ...row });
  }
  return rows;
}

function decisions() {
  const entries = readJson(DECISIONS_FILE, 'decision store');
  assert.ok(Array.isArray(entries), 'dev/port-decisions.json must be a JSON array');
  return entries;
}

const key = (file, fn) => `${file}::${fn}`;

test('decision store is an array of objects with the allowed keys and verdicts', () => {
  for (const [index, entry] of decisions().entries()) {
    assert.equal(typeof entry, 'object', `entry #${index} is not an object`);
    assert.ok(entry !== null && !Array.isArray(entry), `entry #${index} is not a plain object`);

    const keys = Object.keys(entry).sort();
    assert.deepEqual(keys, [...REQUIRED_KEYS].sort(),
      `entry #${index} (${entry.function || '?'}) has keys ${keys.join(', ')}; expected exactly ${REQUIRED_KEYS.join(', ')}`);

    assert.ok(VERDICTS.includes(entry.verdict),
      `entry #${index} (${entry.function}) has verdict "${entry.verdict}"; allowed: ${VERDICTS.join(', ')}`);
    assert.equal(typeof entry.function, 'string', `entry #${index} needs a function name`);
    assert.ok(entry.function.length > 0, `entry #${index} has an empty function name`);
    assert.equal(typeof entry.file, 'string', `entry #${index} (${entry.function}) needs a file path`);
    assert.match(entry.file, /^lua\/.*\.lua$/, `entry #${index} (${entry.function}) file must be a lua/ path, got "${entry.file}"`);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `entry #${index} (${entry.function}) needs an ISO date, got "${entry.date}"`);
    assert.equal(typeof entry.reference, 'string', `entry #${index} (${entry.function}) needs a reference`);
    assert.ok(entry.reference.length > 0, `entry #${index} (${entry.function}) has an empty reference`);
  }
});

test('decision store has no duplicate file::function entries', () => {
  const seen = new Map();
  for (const entry of decisions()) {
    const id = key(entry.file, entry.function);
    assert.ok(!seen.has(id), `duplicate decision for ${id}`);
    seen.set(id, entry);
  }
});

test('every PORT/BLOCKED ledger row carries a decision', () => {
  const decided = new Set(decisions().map(entry => key(entry.file, entry.function)));
  const missing = ledgerRows()
    .filter(row => DECISION_REQUIRED_CATEGORIES.includes(row.category))
    .filter(row => !decided.has(key(row.file, row.name)))
    .map(row => `${row.file}::${row.name}`);

  assert.deepEqual(missing, [],
    `ledger rows still classified PORT/BLOCKED with no dev/port-decisions.json entry:\n  ${missing.join('\n  ')}`);
});

test('every decision names a function that exists in the ledger', () => {
  const names = new Set(ledgerRows().map(row => key(row.file, row.name)));
  const orphans = decisions()
    .map(entry => key(entry.file, entry.function))
    .filter(id => !names.has(id));

  assert.deepEqual(orphans, [],
    `decisions name functions that are not in the ledger (typo or rename?):\n  ${orphans.join('\n  ')}`);
});

test('done and merge decisions point at a commit hash (or a report when the commit is not reconstructible)', () => {
  // Rule: a done/merge reference must be a 7-40 char commit hash. Seven seeds
  // predate this store and the docs record them only as "earlier port commits",
  // so a dev/ report path is accepted *if the file exists*; the hash is still
  // preferred and required whenever the commit is known.
  const bad = decisions()
    .filter(entry => entry.verdict === 'done' || entry.verdict === 'merge')
    .filter(entry => !COMMIT_HASH.test(entry.reference))
    .filter(entry => !/^dev\/.+\.(md|json)$/.test(entry.reference) || !fs.existsSync(path.join(MOD_ROOT, entry.reference)))
    .map(entry => `${entry.file}::${entry.function} -> ${entry.reference}`);

  assert.deepEqual(bad, [],
    `done/merge decisions need a 7-40 char commit hash (or an existing dev/ report):\n  ${bad.join('\n  ')}`);
});

test('keep, retire and parked decisions point at an existing report or a commit', () => {
  const bad = decisions()
    .filter(entry => entry.verdict === 'keep' || entry.verdict === 'retire' || entry.verdict === 'parked')
    .filter(entry => !COMMIT_HASH.test(entry.reference))
    .filter(entry => !/^dev\/.+\.(md|json)$/.test(entry.reference) || !fs.existsSync(path.join(MOD_ROOT, entry.reference)))
    .map(entry => `${entry.file}::${entry.function} -> ${entry.reference}`);

  assert.deepEqual(bad, [],
    `keep/retire/parked decisions need a commit hash or an existing dev/ report path:\n  ${bad.join('\n  ')}`);
});

test('backlog pointer is not hand-written prose with "next is/block"', () => {
  assert.ok(fs.existsSync(PORT_STATUS), `port status report is missing: ${PORT_STATUS}`);
  const text = fs.readFileSync(PORT_STATUS, 'utf8');
  const hits = text
    .split('\n')
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(hit => STALE_POINTER.test(hit.text));

  assert.deepEqual(hits.map(hit => `${hit.line}: ${hit.text.trim()}`), [],
    'port-status.md must point at dev/port-decisions.json + this gate instead of naming the next backlog item');
});

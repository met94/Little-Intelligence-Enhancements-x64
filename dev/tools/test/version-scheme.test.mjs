import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalVersion, LEGACY_VERSIONS } from '../door-watch-report.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const readJson = (...parts) => JSON.parse(read(...parts).replace(/^\uFEFF/, ''));

const TEXT = /\.(md|txt|lua|mjs|json|ps1)$/;
const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEXT.test(entry.name)) out.push(path.relative(root, full).replaceAll('\\', '/'));
  }
  return out;
}

const base = readJson('dev', 'upstream-base.json');
const map = readJson('dev', 'version-map.json');
const modTxt = readJson('mod.txt');
const releases = map.releases;

// The fork relabeled its scheme on this day (`V8.86_x64` -> `8.57.30`): every
// release dated before it shipped a `V8.<n>_x64` label, and a release published
// on or after it never did, so its `legacy` is null.
const RELABEL_DATE = '2026-11-03';

test('the fork version is <upstream-base>.<fork-patch>', () => {
  assert.match(modTxt.version, /^\d+\.\d+\.\d+$/, 'no V prefix and no _x64 suffix');
  assert.equal(map.upstreamBase, base.baseVersion, 'version-map upstreamBase must match upstream-base.json');
  assert.equal(modTxt.version, `${base.baseVersion}.${base.patch}`, 'mod.txt must be <baseVersion>.<patch>');
});

test('upstream-base.json records a real base commit and the first fork release', () => {
  assert.match(base.baseVersion, /^\d+\.\d+$/);
  assert.match(base.baseCommit, /^[0-9a-f]{40}$/, 'baseCommit must be a full SHA-1');
  assert.ok(base.rebaseLog.length > 0, 'the base must have a rebase-log entry');
  const latest = base.rebaseLog.at(-1);
  assert.equal(latest.baseVersion, base.baseVersion);
  assert.equal(latest.baseCommit, base.baseCommit);
  assert.equal(latest.firstForkVersion, `${base.baseVersion}.1`);
  assert.equal(releases.at(-1).version, latest.firstForkVersion, 'oldest mapped release must be the first fork release');
  assert.equal(releases.at(-1).legacy, latest.legacyFirstForkVersion);
});

test('version-map.json lists every fork release exactly once, newest first', () => {
  assert.equal(releases.length, base.patch, 'one map entry per fork release');
  for (let i = 0; i < releases.length; i++) {
    const entry = releases[i];
    const expected = `${base.baseVersion}.${releases.length - i}`;
    assert.equal(entry.version, expected, `release ${i} out of order`);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, 'release date');
    assert.ok(!Number.isNaN(Date.parse(entry.date)), `release ${entry.version} has an unparsable date`);
    // A release from before the relabel must carry the label it really shipped,
    // because a log of that build quotes it. A release published after it shipped
    // no label at all, so its `legacy` is null; inventing one to keep the
    // sequence contiguous is exactly what this test exists to stop.
    if (entry.date < RELABEL_DATE) {
      assert.match(entry.legacy ?? '', /^V\d+\.\d+_x64$/,
        `release ${entry.version} predates the relabel, so it must keep its label`);
    } else {
      assert.equal(entry.legacy, null,
        `release ${entry.version} is post-relabel, so it shipped no legacy label`);
    }
  }

  // Contiguity and uniqueness describe the labels that really shipped: the
  // post-relabel releases have none, so they are skipped rather than given an
  // invented label to keep the sequence whole. The labelled set is therefore
  // exactly the pre-relabel releases, V8.86_x64 (=8.57.30) down to V8.57_x64.
  const labelled = releases.filter(entry => entry.legacy);

  assert.deepEqual(labelled, releases.filter(entry => entry.date < RELABEL_DATE),
    'only a pre-relabel release may carry a legacy label');
  const legacyMinors = labelled.map((entry) => {
    const match = entry.legacy.match(/^V8\.(\d{2})_x64$/);

    assert.ok(match, `legacy label ${entry.legacy} is not a V8 label`);
    return Number(match[1]);
  });

  legacyMinors.forEach((minor, i) => {
    if (i > 0) assert.equal(minor, legacyMinors[i - 1] - 1, 'legacy labels must be contiguous');
  });
  assert.equal(new Set(labelled.map(entry => entry.legacy)).size, labelled.length, 'legacy labels must be unique');
});

test('the changelog carries one anchored header per mapped release', () => {
  const headers = [...read('changelog.txt').matchAll(/^Revision (\d+\.\d+\.\d+) \u2014 (\d{4}-\d{2}-\d{2})\r?$/gm)]
    .map(match => ({ version: match[1], date: match[2] }));

  // Anchored at column 0, so a header glued onto the previous line is a failure
  // rather than a silently missing entry (that happened twice before).
  assert.equal(headers.length, releases.length, 'every release needs its own header line');
  headers.forEach((header, i) => {
    assert.equal(header.version, releases[i].version, `header ${i + 1} is not the mapped release`);
    assert.equal(header.date, releases[i].date, `header ${header.version} date differs from the map`);
  });
});

test('legacy labels survive only where they are evidence', () => {
  // Two ways a legacy label may survive:
  //   - on a line that quotes a log field (`v=V8.86_x64`) or names a published
  //     artifact (GitHub tag, zip asset), which are verbatim strings;
  //   - in a file that documents the relabel itself by naming the mapping files.
  // Any other file must use the current scheme.
  const allowedLine = (line) => /v=V8\.|releases\/tag\/|LIES-V8\./.test(line);
  const exemptFiles = new Set(['dev/version-map.json', 'dev/upstream-base.json', 'dev/tools/test/version-scheme.test.mjs',
    // Generated by dev/tools/gates.ps1: it echoes failing assertion text verbatim.
    'dev/reports/static-gates.md']);
  const mentionsMap = (text) => /version-map\.json|upstream-base\.json/.test(text);
  const offenders = [];

  for (const file of walk(root)) {
    if (exemptFiles.has(file)) continue;
    const text = read(file);
    if (mentionsMap(text)) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      // `V8\\.66` style literals in test regexes count too: the backslash sits
      // between the 8 and the dot, so a plain `V8\.` pattern would miss them.
      if (/V8\\?\.\d{2}_x64|\bV8\\?\.(5[89]|6\d|7\d|8[0-6])\b/.test(line) && !allowedLine(line)) {
        offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }

  assert.deepEqual(offenders, [], 'legacy labels left behind');
});

test('the report tool resolves a pre-relabel log to the release that wrote it', () => {
  // Only the releases that really shipped a label may appear in the lookup: a
  // null legacy must be skipped, not turned into a map key the string
  // `undefined`/`null` would resolve through.
  const labelled = releases.filter(entry => entry.legacy);

  assert.equal(LEGACY_VERSIONS.size, labelled.length,
    'the tool must load every real legacy label and nothing else');
  assert.ok(!LEGACY_VERSIONS.has(null) && !LEGACY_VERSIONS.has(undefined),
    'an absent legacy must not become a map key');
  assert.equal(canonicalVersion('V8.86_x64'), '8.57.30');
  assert.equal(canonicalVersion('V8.57_x64'), '8.57.1');
  // Unknown labels are returned unchanged, so a future format cannot map by accident.
  assert.equal(canonicalVersion('8.57.30'), '8.57.30');
  assert.equal(canonicalVersion('V8.99_x64'), 'V8.99_x64');
});

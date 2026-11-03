import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

// Strip Lua comments so a claim cannot be satisfied by dead text. Handles
// whole-line `--[[ ... ]]` blocks, inline `--[[ ... ]]`, and `--` to EOL.
function stripLuaComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('--[[', i)) {
      const end = source.indexOf(']]', i + 4);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (source.startsWith('--', i)) {
      const eol = source.indexOf('\n', i);
      if (eol === -1) break;
      i = eol;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i++;
      while (i < source.length) {
        out += source[i];
        if (source[i] === '\\') {
          out += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const stripped = (file) => stripLuaComments(read(file));

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is missing`);
  const next = source.indexOf('\nfunction ', start + signature.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test('version metadata agrees on V8.86_x64', () => {
  const modTxt = JSON.parse(read('mod.txt').replace(/^\uFEFF/, ''));
  assert.equal(modTxt.version, 'V8.86_x64');

  // The in-code version is what every `[LIES-WATCH] v=` and `[LIES-TRACE] v=`
  // line reports, so a release bump that misses it makes a correct run's
  // version claim FAIL. Pin it to mod.txt.
  const manager = read('menumanager.lua');
  const inCode = /_G\.LIES = \{\s*\n\s*mod_path[\s\S]{0,600}?version = "(V[\d.]+_x64)"/.exec(manager);
  assert.ok(inCode, 'menumanager.lua does not declare LIES.version');
  assert.equal(inCode[1], modTxt.version, 'menumanager.lua LIES.version must equal the mod.txt version');

  const feed = JSON.parse(read('autoupdate.json').replace(/^\uFEFF/, ''));
  assert.equal(feed[0].version, 'V8.86_x64');

  const readme = read('README.md');
  assert.match(readme, /\*\*Current release:\*\* `V8\.86_x64`/);
  assert.doesNotMatch(readme, /V8\.57_x64/);

  const changelog = read('changelog.txt');
  const revisions = [...changelog.matchAll(/^Revision (V[\d.]+_x64) \u2014 (\d{4}-\d{2}-\d{2})\r?$/gm)];
  assert.ok(revisions.length > 0, 'changelog has no revision headers');
  assert.equal(revisions[0][1], 'V8.86_x64');
  assert.equal(revisions[0][2], '2026-11-02');
  assert.equal(revisions.at(-1)[1], 'V8.57_x64', 'older revision header was lost');
});

test('LIES still advertises the Navlink Delays menu entry it now implements', () => {
  const options = read('menu', 'options.txt');
  const entry = options.match(/"type" : "multiple_choice"[\s\S]{0,800}?"value" : "nav_link_interval"/);
  assert.ok(entry, 'nav_link_interval multiple-choice entry is missing');
  assert.match(entry[0], /"id" : "lies_nav_link_interval"/);
  assert.equal((entry[0].match(/menu_lies_nav_link_interval_(vanilla|half|athird|nochill)/g) || []).length, 4);

  const manager = read('menumanager.lua');
  assert.match(manager, /LIES\.settings\.nav_link_interval = value/);
});

test('ElementSpecialObjective finalization scales the nav-link interval', () => {
  const source = stripped(path.join('lua', 'managers', 'mapelements', 'elementspecialobjective.lua'));

  assert.match(source, /LIES\.settings\.nav_link_interval/);
  assert.match(source, /\(\{1, 0\.5, 0\.25, 0\}\)\[setting\]/);
  assert.match(source, /self\._values\.interval = interval \* mult/);
  assert.match(source, /self\._LIES_nav_interval_scaled/);

  // Only nav-link elements are scaled: a regular SO's interval feeds so_descriptor
  // and the GroupAIStateBesiege poll cooldown, so it must stay vanilla.
  const guard = source.match(/if ([^\n]*?) and interval and interval > 0 [^\n]*then/);
  assert.ok(guard, 'interval scaling guard is missing');
  assert.match(guard[1], /_is_nav_link|is_navigation_link/);
  // Pin the polarity: `if not self:_is_nav_link() and ...` still contains the
  // identifier, so the negation must be excluded explicitly.
  assert.doesNotMatch(guard[1], /\bnot\b[^\n]*_is_nav_link/);
  assert.doesNotMatch(guard[1], /\bnot\b/);
  assert.ok(
    source.indexOf('if interval > 3 then') < source.indexOf('interval * mult'),
    'the vanilla 3 s cap must be applied before the multiplier',
  );

  assert.match(source, /if interval > 3 then/);
  // The vanilla cap must survive as a fallback.
  assert.match(source, /function ElementSpecialObjective:nav_link_delay\(\)/);
});

test('scaling happens inside the _finalize_values post-hook, before nav-link registration', () => {
  const source = stripped(path.join('lua', 'managers', 'mapelements', 'elementspecialobjective.lua'));
  const hookStart = source.indexOf('"lies_send_navlink_element"');
  assert.notEqual(hookStart, -1, 'finalize post-hook registration is missing');

  const scaleAt = source.indexOf('_LIES_nav_interval_scaled', hookStart);
  const registerAt = source.indexOf('managers.navigation._LIES_navlink_elements[self._id] = self', hookStart);
  assert.notEqual(scaleAt, -1, 'interval scaling is not inside the post-hook');
  assert.notEqual(registerAt, -1, 'nav-link registration is missing');
  assert.ok(scaleAt < registerAt, 'interval scaling must run before nav-link registration');

  // Finalization runs before init clones _values; keep the scaling in the hook
  // body so both the engine and Iter's register_anim_nav_link see it.
  const hookEnd = source.indexOf('\nfunction ElementSpecialObjective:', hookStart);
  assert.notEqual(hookEnd, -1, 'post-hook end could not be located');
  assert.ok(scaleAt < hookEnd, 'interval scaling escaped the post-hook');
});

test('CopLogicIdle keeps the Keepers kpr_done guard', () => {
  const source = stripped(path.join('lua', 'coplogics', 'coplogicidle.lua'));
  const body = functionBody(source, 'function CopLogicIdle.clbk_action_timeout');

  assert.match(
    body,
    /if \(not data\.cool or not my_data\.detected_criminal\) and not data\.objective\.kpr_done then\s*\n\s*data\.objective_complete_clbk\(data\.unit, data\.objective\)/,
  );
});

test('TeamAILogicIdle keeps the Monkeepers action_expired guard', () => {
  const source = stripped(path.join('lua', 'teamailogics', 'teamailogicidle.lua'));
  const body = functionBody(source, 'function TeamAILogicIdle.action_complete_clbk');

  assert.match(
    body,
    /elseif not my_data\.action_expired then\s*\n\s*data\.objective_failed_clbk\(data\.unit, old_objective\)/,
  );
});

test('CopActionWalk:_init guards an empty nav path', () => {
  const source = stripped(path.join('lua', 'copactions', 'copactionwalk.lua'));
  const body = functionBody(source, 'function CopActionWalk:_init');

  assert.match(body, /self\._nav_path = self\._nav_path or \{\}/);
  assert.match(body, /not action_desc\.interrupted or not self\._nav_path\[1\] or not self\._nav_path\[1\]\.x/);

  // The guard must run before the simplified-path insert loop indexes _nav_path.
  const guardAt = body.indexOf('self._nav_path = self._nav_path or {}');
  const loopAt = body.indexOf('t_ins(self._nav_path, nav_point.x');
  assert.notEqual(guardAt, -1, '_nav_path guard is missing');
  assert.notEqual(loopAt, -1, 'simplified-path insert loop is missing');
  assert.ok(guardAt < loopAt, 'the _nav_path guard must run before the insert loop');
});

test('compat claims cannot be satisfied by Lua comments', () => {
  // Guard the stripper itself: a purely commented pattern must not match.
  const fake = stripLuaComments('-- if not data.objective.kpr_done then\n--[[ self._nav_path = self._nav_path or {} ]]\n');
  assert.doesNotMatch(fake, /kpr_done/);
  assert.doesNotMatch(fake, /_nav_path or \{\}/);
  // ...and real code after a comment still survives.
  assert.match(stripLuaComments('-- note\nlocal x = 1 -- tail\n'), /local x = 1/);
});

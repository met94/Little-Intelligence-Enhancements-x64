-- Regression test for the settled-facing target check in
-- CopLogicAttack._upd_aim (dev/reports/watch-settle-attention-unit-type-crash.md).
--
-- The shipped helper is extracted from lua/coplogics/coplogicattack.lua itself,
-- not copied: a copy could drift from the body that actually runs in game.
--
-- The crash it pins: the check used to read `attention_unit.type_name` off
-- `my_data.attention_unit`, an untyped union of a Vector3 and an enemy `u_key`.
-- A `u_key` is an opaque engine userdata (Idstring) with no `__index`, so the
-- field read raised "attempt to index local 'attention_unit' (a userdata value)"
-- and took the game down. The fix reads the typed aim record the engine keeps
-- (CopMovement:attention(): `pos` is a Vector3, a unit target has none).
--
-- Coverage: against a pre-fix build this file fails at the signature check below
-- (the old helper took `attention_unit`), which is the gate. The old expression
-- itself is named by the static pins in dev/tools/test/door-watch.test.mjs and
-- dev/tools/test/userdata-shape.test.mjs; this file covers the shipped body's
-- behaviour from there on.
--
-- Run from the repo root:
--   tools\luajit\luajit.exe dev/test-harness/test/watch_settle_target.lua
-- Optional first argument: another copy of the file, for reproducing a
-- pre-fix build (`... watch_settle_target.lua path\to\coplogicattack.lua`).

local SOURCE = (arg and arg[1]) or 'lua/coplogics/coplogicattack.lua'

local function read_file(path)
  local file = assert(io.open(path, 'rb'), 'cannot open ' .. path)
  local text = file:read('*a')
  file:close()

  return text
end

local source = read_file(SOURCE)
source = source:gsub('\r\n', '\n')

-- 1. The shipped 20-unit band and the helper body, sliced out of the real file.
local dis_line = source:match('\nlocal LIES_SETTLE_TARGET_DIS = %d+\n')
assert(dis_line, 'the 20-unit band is missing or changed')
dis_line = dis_line:gsub('^\n', '')

local header = '\nlocal function lies_settle_target_held(data, pos)'
local start = source:find(header, 1, true)
assert(start, 'lies_settle_target_held(data, pos) is missing from ' .. SOURCE)

local _, stop = source:find('\nend\n', start + 1, true)
assert(stop, 'lies_settle_target_held is not terminated')

-- `stop` is the trailing newline of the pattern, so the slice ends there; do not
-- add the pattern length back or the body swallows the next line.
local body = source:sub(start + 1, stop)
assert(body:sub(-4) == 'end\n', 'the helper slice must end on its own `end`')

-- 2. The body must not ask the union's type again, and must ask the engine.
assert(not body:find('attention_unit', 1, true), 'the helper must not touch the attention_unit union')
assert(not body:find('type_name', 1, true), 'the helper must not read type_name off a userdata')
assert(not body:find('type(', 1, true), 'the helper must not type-sniff at all')
assert(body:find('movement:attention()', 1, true), 'the helper must read CopMovement:attention()')
assert(body:find('attention.pos', 1, true), 'the helper must read the typed `pos` field')

-- 3. Load the shipped body with the two upvalues it needs; the band comes from
--    the shipped line, not a copy of its value.
local mvec3_dis = function(a, b)
  return math.sqrt((a.x - b.x) ^ 2 + (a.y - b.y) ^ 2 + (a.z - b.z) ^ 2)
end

local chunk = assert(loadstring(dis_line .. 'local mvec3_dis = ...\n\n' .. body .. '\nreturn lies_settle_target_held\n'))

local held = chunk(mvec3_dis)

-- 4. Fixtures. `newproxy(false)` is a userdata with no metatable, i.e. exactly
--    the shape of an Idstring `u_key`: tostring() is "userdata: 0x...", and any
--    field read raises instead of returning nil. Assert that fidelity first so
--    the main case cannot pass for the wrong reason.
local opaque = newproxy(false)
assert(tostring(opaque):find('^userdata: 0x') ~= nil, 'the opaque stand-in must print like an Idstring')
assert(not pcall(function() return opaque.type_name end), 'the opaque stand-in must raise on field access')

local function vec3(x, y, z)
  return { x = x, y = y, z = z }
end

local function data_with_attention(attention)
  return {
    unit = {
      movement = function()
        return {
          attention = function()
            return attention
          end
        }
      end
    }
  }
end

-- 5. No aim target: dropped.
assert(held(data_with_attention(nil), vec3(0, 0, 0)) == false, 'no attention target must drop the sample')

-- 6. The crash case: the aim target is an enemy key, not a position. Must answer
--    false without indexing the opaque userdata.
local ok, result = pcall(held, data_with_attention({ u_key = opaque }), vec3(0, 0, 0))
assert(ok, 'a u_key aim target must not raise: ' .. tostring(result))
assert(result == false, 'a u_key aim target must drop the sample')

-- 7. A unit attention has no `pos`: dropped, same as the old key branch.
assert(held(data_with_attention({ unit = {} }), vec3(0, 0, 0)) == false, 'a unit aim target must drop the sample')

-- 8. A live position is measured against the stashed one with the 20-unit band.
assert(held(data_with_attention({ pos = vec3(0, 0, 0) }), vec3(5, 0, 0)) == true, '5 units must hold')
assert(held(data_with_attention({ pos = vec3(0, 0, 0) }), vec3(20, 0, 0)) == true, 'the band edge (20) must hold')
assert(held(data_with_attention({ pos = vec3(0, 0, 0) }), vec3(20.5, 0, 0)) == false, 'the band is 20, not more')
assert(held(data_with_attention({ pos = vec3(0, 0, 0) }), vec3(25, 0, 0)) == false, '25 units must drop')

-- 9. A unit without movement cannot answer: dropped, not raised.
local no_movement = {
  unit = {
    movement = function()
      return nil
    end
  }
}
assert(held(no_movement, vec3(0, 0, 0)) == false, 'a nil movement must drop the sample')

print('ok: the settled-facing target check reads the engine aim record')

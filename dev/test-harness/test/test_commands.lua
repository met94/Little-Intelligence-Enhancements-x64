-- Static test for the LIES test-harness command parser.
-- Run from the worktree root:
--   tools\luajit\luajit.exe dev/test-harness/test/test_commands.lua

local hook_registered = false
Hooks = {
  Add = function(self, id, key, fn)
    assert(type(id) == 'string', 'hook id must be a string')
    assert(type(key) == 'string', 'hook key must be a string')
    assert(type(fn) == 'function', 'hook callback must be a function')
    hook_registered = true
  end
}

dofile('dev/test-harness/lua/chatmanager.lua')

assert(hook_registered, 'harness did not register ChatManagerOnSendMessage')
assert(type(LIES_TestHarness) == 'table', 'LIES_TestHarness table missing')
assert(type(LIES_TestHarness.parse_command) == 'function', 'parse_command missing')
assert(type(LIES_TestHarness.execute) == 'function', 'execute missing')
assert(type(LIES_TestHarness.execute_string) == 'function', 'execute_string missing')

local parse = LIES_TestHarness.parse_command

local cmd = parse('!lies nav')
assert(cmd and cmd.command == 'nav', 'nav command not parsed')

cmd = parse('!lies setting lua_cover 2')
assert(cmd and cmd.command == 'setting', 'setting command not parsed')
assert(cmd.args[1] == 'lua_cover' and cmd.args[2] == '2', 'setting args wrong')

cmd = parse('!lies spawn taser')
assert(cmd and cmd.command == 'spawn' and cmd.args[1] == 'taser', 'spawn command not parsed')

cmd = parse('!lies')
assert(cmd and cmd.command == 'help', 'bare !lies should map to help')

assert(parse('hello') == nil, 'non-command should return nil')
assert(parse('!other nav') == nil, 'other prefix should return nil')

print('ok: LIES test-harness parser')

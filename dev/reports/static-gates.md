# LIES 248.2 static gates

Generated: 2026-11-27 11:52:53Z

## Node tool tests

Result: PASS

ℹ pass 270
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 307.3479

## Test-harness Lua tests

Result: PASS

PASS find_segment_doors.lua
  ok: NavigationManager:find_segment_doors contract
PASS phalanx_signatures.lua
  ok: CopLogicPhalanxMinion phalanx helper signatures
PASS test_commands.lua
  ok: LIES test-harness parser
PASS test_coplogictravel_warp_nil_objective.lua
  ok: warp nil-objective guard (7 checks)
PASS watch_settle_target.lua
  ok: the settled-facing target check reads the engine aim record

## LuaJIT syntax (runtime files)

Result: PASS

Files: 70
Failures: 0

## Free identifiers (game-file locals)

Result: PASS

Files: 67
Findings: 0

## Function ledger

Result: PASS

files=70 functions=587 errors=0 unhooked=3
MOD_ONLY=223 MOD_ONLY_HOOK=42 LIES_EDIT_CLEAN=293 LIES_EDIT_VANILLA_CHANGED=23 VANISHED_IN_NEW=1 SAME_AS_OLD_VANILLA=3 SAME_AS_NEW_VANILLA=1 SAME_AS_OLD_VANILLA_LOCAL=1
decisions: done=18 merge=0 keep=5 retire=0 parked=0 undecided=0
wrote D:\Programowanie\payday\2\v2\.worktrees\LIES-lies-249\dev\port-248-ledger.md
wrote D:\Programowanie\payday\2\v2\.worktrees\LIES-lies-249\dev\reports\port-248-ledger.json

## API audit

Result: PASS

hooks=67/67 methods=49/49 errors=0 review=151
Baseline errors: 50 (current: 0)


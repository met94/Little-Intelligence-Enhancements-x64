# LIES log scan

File: `C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\2026_10_23_log.txt`

- setup: 6
- FATAL: 0
- Lua errors: 1
- LIES errors: 0
- harness: 3
- harness errors: 0
- result: OK

## LIES setup

- 55: `05:24:59 PM Lua: [INFO] [BLT] Setting up mod 'LIES'`
- 127: `05:24:59 PM Lua: [INFO] [BLT] Setting up mod 'LIES'`
- 211: `05:25:00 PM Lua: [INFO] [BLT] Setting up mod 'LIES'`
- 358: `05:25:19 PM Lua: [INFO] [BLT] Setting up mod 'LIES'`
- 430: `05:25:19 PM Lua: [INFO] [BLT] Setting up mod 'LIES'`
- 502: `05:25:19 PM Lua: [INFO] [BLT] Setting up mod 'LIES'`

## FATAL

None.

## LIES errors

None.

## Other Lua errors

- 321: `05:25:08 PM Log:  (D:\a\PAYDAY2-SuperBLT\PAYDAY2-SuperBLT\src\InitiateState.cpp:98) mods/BeardLib/Modules/Utils/ModAssetsModule.lua:156: attempt to compare number with nil`

## Harness output

- 614: `05:25:32 PM Lua: [LIES-TEST] state=table: 0x533f05c0 is_server=true police_called=nil weapons_hot=nil assault_mode=false assault_active=nil queued=10.015857696533(number) groups=3 spawning=0 cops=5`
- 615: `05:25:35 PM Lua: [LIES-TEST] alarm: on_police_called + on_police_weapons_hot + set_assault_mode`
- 616: `05:25:40 PM Lua: [LIES-TEST] state=table: 0x533f05c0 is_server=true police_called=true weapons_hot=true assault_mode=true assault_active=nil queued=18.034885406494(number) groups=3 spawning=0 cops=5`

## Harness errors

None.


# P0 baseline run — 2–3 minutes

Goal: capture the first real failure of pristine LIES V8.57 on game 248.2.
Do this once, before any port changes. The log is the input to P1.

## Prepare

```
powershell -NoProfile -ExecutionPolicy Bypass -File dev\build.ps1
```

This creates `dist\LIES`. It does not touch the game.

Clean profile: disable or move these overlapping mods for this run:

- `NavFixes`
- `Useful Bots`
- `Keepers`
- `Iter` / `Iter Lite`
- `Monkeepers` (only if team AI is being tested; harmless for baseline)

Keep SuperBLT and any hard dependency (BeardLib if LIES needs it; currently it does not).

## Install

Copy, as the user:

```
Copy-Item -LiteralPath '<repo>\dist\LIES' -Destination 'C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\LIES' -Recurse -Force
Copy-Item -LiteralPath '<repo>\dev\test-harness' -Destination 'C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\LIES-TestHarness' -Recurse -Force
```

Writes under `Program Files` may need an elevated shell.

## Run

1. Launch PAYDAY 2.
2. Load `Jewelry Store` on Normal.
3. Type in chat:
   - `!lies nav`
   - `!lies cover`
4. Shoot once to trigger the alarm.
5. `!lies assault`
6. Wait ~45 seconds; observe cop pathing/cover.
7. Quit the game.

If chat commands do not work, skip them and just play for 60 seconds. The log is still useful.

## Send

Send the newest file from:

```
C:\Program Files (x86)\Steam\steamapps\common\PAYDAY 2\mods\logs\
```

Expected: pristine V8.57 may crash on load or during the heist. That is the point.
Do not fix anything by hand before sending the log.

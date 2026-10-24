# Phalanx / marshal decisions — 248.2

Read-only research. No runtime code changed for this document.

## Evidence

### Phalanx in single-player

- 246.1 vanilla `_check_spawn_phalanx` starts with
  `if not Global.game_settings.single_player ...` (same at 248.2).
- LIES `_check_spawn_phalanx_LIES` **omits** that guard. It was introduced in
  LIES 4.5 and is swapped in by hhtacs setup.
- Therefore: **yes, LIES already did this on the version the mod was made for
  (246.1).** It is deliberate LIES/hhtacs behaviour, not a 248.2 regression.
- Is it required by the mod? It is required for hhtacs's phalanx feature set,
  not for the core LIES AI. Without hhtacs, the vanilla guard still applies.

### Phalanx respawn key

- LIES writes `self.phalanx.respawn_delay = 1200` (introduced in 7.295).
- Both 246.1 and 248.2 vanilla read
  `tweak_data.group_ai.phalanx.spawn_chance.respawn_delay` (300000 on DW+,
  120 on low difficulty).
- `phalanx.respawn_delay` is never read by the game or by LIES.
- Therefore: this is a **LIES bug / dead key**, not a 248.2 change. It has never
  worked.
- Intent likely: allow a phalanx respawn after 20 minutes instead of vanilla's
  effectively-once-per-heist 300000 s. But that is a gameplay decision.

### Marshal marksman

- 246.1 and 248.2 vanilla map `marshal_marksman.attack = MarshalLogicAttack`,
  a `CopLogicAttack` subclass with its own `update` and
  `_chk_exit_non_walkable_area`.
- LIES maps `marshal_marksman.attack = CopLogicAttack` at the top of
  `lua/copextensions/copbrain.lua`. This dates to LIES 6.23 (swat logic) and
  7.39 (direct `CopLogicAttack`).
- Therefore: **yes, LIES already downgraded marshal marksmen on 246.1.** It is a
  long-standing deliberate design choice: give marksmen the full LIES attack
  behaviour instead of the vanilla marshal subclass.
- Is it required by the mod? Not strictly. `MarshalLogicAttack` inherits from
  `CopLogicAttack`, so restoring it would still inherit most LIES overrides
  while regaining marshal-specific `update`/non-walkable-area exit logic.
  That hybrid is the only option that keeps both.

### Phalanx VIP/minion aliases

- 246.1 and 248.2 copy `CopLogicAttack`/`CopLogicIdle` functions onto the
  phalanx classes at game-file load, before LIES loads.
- LIES has never re-aliased them, so phalanx units have always run vanilla
  bodies for `_upd_aim`, `on_new_objective`, `damage_clbk`, etc.
- This is parity with the mod's base. It is not required to change unless the
  owner wants LIES behaviour on phalanx units.

## Options

### Phalanx solo

- **A. Keep LIES behaviour (recommended for hhtacs parity):** solo phalanx can
  spawn with hhtacs. Document as intentional hhtacs behaviour.
- B. Restore 248.2 guard: no solo phalanx; hhtacs loses that feature.

### Phalanx respawn

- **A. Fix the key (recommended if 20 min was intended):** write
  `self.phalanx.spawn_chance.respawn_delay = 1200`. Player effect: a phalanx can
  return once in a very long assault.
- B. Delete the dead line: keep vanilla once-per-heist pacing.
- C. Keep dead: no behaviour change, but leave a misleading key.

### Marshal

- **A. Keep LIES downgrade (historical parity):** marksmen use full LIES attack
  logic; lose `MarshalLogicAttack.update` / non-walkable exit.
- **B. Hybrid restore (recommended for 248.2 correctness):** map
  `marshal_marksman.attack = MarshalLogicAttack`. The subclass inherits LIES's
  `CopLogicAttack` overrides for most methods and regains marshal-specific
  movement/exit. Needs a marshal smoke.
- C. Full vanilla: restore both mapping and vanilla attack bodies; loses LIES
  behaviour on marksmen.

### Phalanx aliases

- A. Leave vanilla (recommended unless phalanx feels wrong): parity with base.
- B. Re-alias after LIES load: apply LIES aim/damage/idle behaviour to
  VIP/minions. Needs a phalanx smoke and file-order audit.

## Recommendation

- Keep solo phalanx for hhtacs, but document it.
- Fix the respawn key to `spawn_chance.respawn_delay = 1200` only if 20-minute
  respawn is intended; otherwise delete the line.
- Try the marshal hybrid (`MarshalLogicAttack`) in a marshal heist; it is the
  only option that keeps both LIES and marshal-specific logic.
- Leave phalanx aliases vanilla for now; revisit only if phalanx aim/damage
  feels wrong.

## Validation

- Phalanx: DW+ hhtacs assault; VIP spawns (solo if kept), buff icon appears,
  damage reduction ramps/disables, no `LEAKING POS RESERVATION`.
- Marshal: heist with marshal marksmen; they must keep distance, use cover,
  exit non-walkable areas correctly, and still use LIES aim/cover.
- Log: no `attempt to`, no nil calls, no phalanx/marshal stack traces.

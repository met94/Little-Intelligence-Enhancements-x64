# dev/ — LIES port and audit tooling

Everything under `dev/` supports the 248.2 port: the ledger, the reports it
feeds, and the static gates. The mod itself is the repo root; nothing here ships.

## The port backlog is machine-readable

- `dev/port-248-ledger.md` is **generated** by `dev/tools/fn-ledger.mjs`. Its
  status column is a *source classification* (`LIES_EDIT_VANILLA_CHANGED` renders
  as `**PORT**`), i.e. the action the diff suggests — never a completion marker. A
  row that says `PORT` after the intent landed is expected.
- `dev/port-decisions.json` is the **authority** on completion: one record per
  function (`function`, `file`, `verdict`, `reference`, `date`, `note`) with
  verdict `done` / `keep` / `merge` / `retire` / `parked` and a commit hash or
  report path as the reference. Add an entry in the same commit that lands the
  work — that is what stops a decided row from reopening.
- `dev/tools/test/port-backlog.test.mjs` enforces it: the gates fail when a
  `PORT`/`BLOCKED` ledger row has no decision, when a decision names a function
  the ledger does not contain, when a reference does not resolve, or when
  `dev/reports/port-status.md` grows a hand-written "next is …" backlog pointer.

Regenerate the ledger (identical to the `gates.ps1` invocation) with:

```
node dev/tools/fn-ledger.mjs --mod . --out dev/port-248-ledger.md --json dev/reports/port-248-ledger.json
```

The generated markdown/JSON carry a `decision` column/field, so the ledger itself
shows `done (703c9af)` next to a row that is still classified `PORT`.

## Gates

```
powershell -ExecutionPolicy Bypass -File dev/tools/gates.ps1
node --test dev/tools/test/*.test.mjs
```

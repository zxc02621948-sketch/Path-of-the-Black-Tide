# AI Editing Rules

This project contains a lot of Traditional Chinese player-facing text. Treat text encoding as part of correctness.

## Encoding

- All source files must stay UTF-8.
- Avoid using PowerShell `Get-Content` to inspect files with Traditional Chinese text; it can display valid UTF-8 as mojibake in this environment. Prefer `rg -n` for targeted search or Node.js `fs.readFileSync(path, 'utf8')` for reading snippets.
- Do not edit project files with tools that may write ANSI, Big5, or UTF-16 by default.
- Do not use PowerShell `Set-Content`, `Out-File`, or shell redirection for source-file edits unless the command explicitly preserves UTF-8 and has been verified.
- Prefer `apply_patch` for manual edits.
- If a file already contains mojibake, do not keep patching around it. Rewrite the affected data block or file as clean UTF-8.

## Chinese Text

- Use Traditional Chinese for player-facing strings.
- Keep game terms consistent:
  - `破綻` for temporary weakness display text.
  - `原生弱點` for native weakness.
  - `傷口` for wound stacks.
  - `格檔` for block.
  - `執旗者` for the support/flag role.
- Internal identifiers may remain English, for example `tempWeakness`, if changing them would risk logic regressions.
- Avoid duplicate fields such as two `name` or `desc` properties in one object.

## Required Checks After Text/Data Edits

Run these after editing player-facing text, data files, or notes:

```powershell
node scripts\check-mojibake.js
node --check js\data\equipment.js
node --check js\data\relics.js
node --check js\data\resonances.js
node --check js\ui\notes-render.js
```

If a different JS file was edited, run `node --check` on that file too.

## Mojibake Warning Signs

If suspicious mojibake characters appear in player-facing files, stop and clean the affected text before continuing.

Common warning categories:

- Replacement characters, for example Unicode `U+FFFD`.
- Private-use characters, for example Unicode ranges `U+E000-U+F8FF` and `U+F900-U+FAFF`.
- Repeated question-mark plus private-use combinations.
- Repeated CJK-looking fragments that do not form readable Traditional Chinese.

The script `scripts/check-mojibake.js` is the project guardrail, but visual inspection still matters.

## Data And Notes

- Prefer storing real descriptions in the data files (`js/data/*.js`) rather than hiding bad data with UI-only overrides.
- `notes-render.js` may summarize rules, but it should not be the only clean source of item/relic names.
- When adding a relic, weapon, gear, or resonance, update both:
  - The data object used by the game.
  - The notes/rules display if the mechanic needs explanation.

## Cache Busting

When changing a browser-loaded JS file that commonly gets cached, update its query version in `index.html`.

Examples:

- `js/data/equipment.js?v=...`
- `js/data/relics.js?v=...`
- `js/data/resonances.js?v=...`
- `js/ui/notes-render.js?v=...`

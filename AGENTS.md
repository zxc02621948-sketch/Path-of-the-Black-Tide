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

## Judgment Before Execution

- Do not follow user requests mechanically when the requested asset, implementation, wording, or direction appears questionable.
- Before using a provided image or asset, consider whether it fits the current purpose, including small-icon readability, visual style consistency, background-removal risk, color mood, and connection to the item or mechanic.
- If something seems unsuitable, risky, inconsistent, or likely to create poor results, explain the concern before applying it.
- If something is usable but has tradeoffs, state the tradeoffs clearly and recommend the best path.
- The user remains the final decision maker, but the assistant should act as a thoughtful production partner rather than only an execution tool.

## Collaboration Before Editing

- Before changing code, first understand the relevant runtime path. For example, distinguish formal gameplay flow from dev-tool shortcuts before patching event, combat, or modal behavior.
- If a request may conflict with existing logic, create side effects, or make a feature feel redundant, explain the concern and recommended options before editing.
- Before starting implementation, briefly state which files or systems will be touched, why, and what behavior should change.
- Do not automatically run checks after every small edit. If the user asks to defer checks, skip them unless the edit is high risk; in that case, explain the risk first.
- Keep small visual or asset iterations lightweight. Make the focused change, update cache when needed, and wait for feedback before broad cleanup or verification.

## Work Modes And Search Scope

Choose the lightest workflow that fits the user's request. Do not treat every task like a fresh codebase audit.

### Small Edit Mode

Use for narrowly scoped changes such as:

- Adding or swapping one image asset.
- Updating one numeric value.
- Changing one short player-facing sentence.
- Adjusting a few CSS rules.
- Updating one cache-busting query string.

Rules:

- Search only the directly relevant file or identifier.
- Do not scan the whole project unless the identifier cannot be found locally.
- Do not reread architecture files or unrelated modules.
- Run only the checks for files actually edited, plus `scripts/check-mojibake.js` when text/data changed.
- If the edit is asset-only plus a data path/cache update, prefer `node --check` for the edited JS file and defer broader checks unless risk increases.

### Batch Asset Mode

Use when adding several monster, relic, equipment, icon, or background images in a row.

Rules:

- The user may provide the monster/item name and already place the image in the target folder.
- For each asset, only rename/move the file, add the data field, and update cache if needed.
- Do not run the full check suite after every single image.
- Run one final `scripts/check-mojibake.js` and relevant `node --check` commands after the batch.
- Keep filenames stable, lowercase where practical, and descriptive, for example `rot-crawler.png` or `banner-guardian-bg.png`.

### Feature Mode

Use for new mechanics, enemy abilities, equipment effects, resonances, combat flow, UI behavior, or save-state behavior.

Rules:

- Start by reading the relevant local modules.
- Expand search only when a shared rule, event path, or rendering contract needs confirmation.
- Prefer existing patterns and helper APIs.
- Run checks for every JS file edited and any required data/notes checks.

### Review Or Cleanup Mode

Use when the user asks whether anything remains, whether old logic is still present, or whether a rule is consistent across the project.

Rules:

- This is the correct time for broader `rg` searches and cross-file inspection.
- Report what was searched and what remains uncertain.
- Keep fixes scoped to the discovered issue unless the user asks for a larger cleanup.

### Speed Discipline

- If a task is clearly in Small Edit Mode or Batch Asset Mode, avoid extra commentary and extra probing.
- Prefer one targeted `rg` over multiple exploratory commands.
- Avoid PowerShell `Get-Content` for Traditional Chinese snippets; use `rg -n` or Node UTF-8 reads.
- When in doubt, choose the narrower search first, then widen only if blocked.

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

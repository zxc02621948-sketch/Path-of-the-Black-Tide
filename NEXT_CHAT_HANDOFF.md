# Next Chat Handoff

這份文件是給下一個 Codex 聊天接續用的摘要。目標是不用閱讀完整舊對話，也能繼續 `D:\The Black Night Box` 的開發。

## Current Focus

目前正在做戰鬥畫面美術與 UI 微調。

- 怪物圖案已大致完成。
- 角色戰鬥卡背景圖已接上。
- 目前正在微調角色戰鬥卡的亮暗、層級、骰子、主戰者高亮等戰鬥 UI 細節。

請優先遵守 `AGENTS.md` 裡的 `Work Modes And Search Scope`。

尤其是：

- 小改不要全案掃描。
- 素材接圖不要每張都跑完整檢查。
- 連續調 UI 時先改給使用者看，等使用者說「這批可以了」或要切換工作時再統一跑檢查。
- 不要用 PowerShell `Get-Content` 讀中文內容，會把有效 UTF-8 顯示成亂碼。用 `rg -n` 或 Node `fs.readFileSync(path, 'utf8')`。

## Recent UI State

### Enemy Art

已接上的怪物圖大致包含：

- 黑影蠕蟲：`assets/enemies/shadow-worm.png`
- 腐骨爬蟲：`assets/enemies/rot-crawler.png`
- 瘴氣毒蛾：`assets/enemies/plague-moth.png`
- 腐骨騎士：`assets/enemies/rot-knight.png`
- 暗影獵人：`assets/enemies/shadow-hunter.png`
- 黑暗化身：`assets/enemies/dark-monster-icon.png`
- 深污腐骰宿主全卡面：`assets/enemies/dice-corruptor-bg.png`
- 夜幕之瞳全卡面：`assets/enemies/night-eye-bg.png`
- 痛痕守護者全卡面：`assets/enemies/wound-guardian-bg.png`
- 裂隙凝視者全卡面：`assets/enemies/rift-gazer-bg.png`
- 擲命守衛全卡面：`assets/enemies/fate-guardian-bg.png`
- 殘旗守衛全卡面：`assets/enemies/banner-guardian-bg.png`

暗影獵人有：

- `iconFlipX: true`
- `iconScale: 'large'`
- `iconSoftEdge: true`

`iconSoftEdge` 是在 `js/ui/render.js` 加 class，CSS 用 `.combat-enemy-img.soft-edge` 做邊緣霧化。

### Character Battle Art

角色戰鬥卡背景圖已加入：

- `assets/portraits/battle-warrior.png`
- `assets/portraits/battle-explorer.png`
- `assets/portraits/battle-scholar.png`
- `assets/portraits/battle-support.png`

資料在 `js/data/characters.js`：

- `CLASS_BATTLE_ART`
- `createCharacter()` 會寫入 `battleArt`

但舊存檔角色可能沒有 `battleArt`，所以 `js/ui/modal-render.js` 會用：

```js
const battleArt = char.battleArt || (typeof CLASS_BATTLE_ART !== 'undefined' ? CLASS_BATTLE_ART[char.cls] : '');
```

戰鬥卡背景 DOM：

```html
<div class="combat-character-art" aria-hidden="true"><img src="..."></div>
```

CSS 重點在 `style.css`：

- `.combat-character-art`
- `.combat-character-art img`
- `.combat-character-art::after`
- `.combat-unit.ally:not(.active) .combat-character-art`
- `.combat-unit.ally.active .combat-character-art`

目前效果：

- 角色戰鬥卡圖已經夠亮。
- 非主戰者背景圖會變暗。
- 主戰者背景圖較亮，並有更明顯邊框光。
- 點擊角色卡時會立刻亮起，不等戰鬥結算。

### Immediate Active Attacker

`js/core/combat-flow.js` 裡 `selectCombatAttacker(charId)` 已改成點擊瞬間更新 DOM：

- 移除其他 `.combat-unit.ally.active`
- 被點擊的角色立刻加 `.active`
- `G.combat.attackerId = char.id`

`_buildCombatScene(enemy, attacker, status)` 已改成：

```js
const attackerId = attacker?.id || G.combat?.attackerId || null;
```

這是為了骰子動畫和攻擊動畫開始前，主戰者卡片就亮起來。

## Current Visual Details

使用者剛剛確認：

- 角色卡亮度可以了。
- 骰子位置已修回右上。
- 攻擊文字已改成白字。
- 角色卡左上職業小圖示已隱藏。
- 仇恨條已拉到前景，不再被遮罩壓住。

最近的 CSS cache 版本可能是：

```html
style.css?v=character-battle-active1
```

最近的 combat-flow cache 版本可能是：

```html
js/core/combat-flow.js?v=attacker-active-immediate1
```

如果繼續改這些檔案，記得更新 `index.html` cache。

## User Preferences

- 使用者偏好快速小改，不希望每個小調整都花很久。
- 明確小改請少問、少掃描、少中途回報。
- 先改給他看，除非有高風險才跑檢查。
- 視覺微調可以先不跑檢查，等一批完成再統一檢查。
- 使用者喜歡邊看邊調，會直接指出「太暗」、「太大」、「位置不對」。

## Suggested Next Steps

如果新聊天室要繼續，可能會接著做：

- 繼續微調角色戰鬥卡背景圖的位置、亮度或遮罩。
- 看看四個角色在不同血量、死亡、主戰/非主戰狀態下是否好讀。
- 完成角色戰鬥卡後，跑一次收尾檢查：

```powershell
node scripts\check-mojibake.js
node --check js\data\characters.js
node --check js\data\enemies.js
node --check js\ui\render.js
node --check js\ui\modal-render.js
node --check js\core\combat-flow.js
```

如果沒有再改資料/文字，可視情況只跑改到的 JS。


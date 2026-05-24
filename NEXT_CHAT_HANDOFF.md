# Next Chat Handoff

這份文件給下一個 Codex 聊天接續 `D:\The Black Night Box` 用。目標是不用讀完整舊對話，也能繼續快速補圖、調文字、接資料。

請優先遵守 `AGENTS.md`：

- 專案文字維持 UTF-8。
- 不要用 PowerShell `Get-Content` 讀中文內容；用 `rg -n` 或 Node `fs.readFileSync(path, 'utf8')`。
- 手動編輯用 `apply_patch`。
- 玩家文字用繁體中文，術語保持一致：`破綻`、`原生弱點`、`傷口`、`格檔`、`執旗者`。
- 小改走 Small Edit Mode，不要全案掃描。
- 改玩家文字、資料檔、notes 後跑：

```powershell
node scripts\check-mojibake.js
node --check js\data\equipment.js
node --check js\data\relics.js
node --check js\data\resonances.js
node --check js\ui\notes-render.js
```

如果改了其他 JS 檔，也跑該檔 `node --check`。

## Current Focus

目前在批次補事件圖與少量事件文本，已經完成大部分 `forest`、`ruins`、`cave`、`empty` 事件圖。

使用者偏好：

- 每張圖先判斷適合哪個事件，不要機械接圖。
- 圖片要檢查透明度；四角 alpha 應為 0。
- 如果圖有白底、雜訊、可讀文字衝突、風格不一致，要先說。
- 小事件圖走目前 `eventImage` 小圖框。
- `命運賭桌`、`共鳴遺址` 之後可能改成滿版背景圖 + 輕黑遮罩，不要硬塞小圖框。
- 聖物類 `find_relic` 事件先不要接事件圖，因為聖物獎勵圖卡會占滿版面。

## Standard Asset Workflow

事件圖：

1. 判斷圖適合的事件。
2. 用 Node 檢查 PNG metadata/alpha，至少確認四角透明。
3. 複製到 `assets/events/`，用穩定 lowercase 檔名。
4. 在 `js/data/events.js` 對應事件加 `eventImage`。
5. 更新 `index.html` 的 `js/data/events.js?v=...`。
6. 跑 `node scripts\check-mojibake.js`、`node --check js\data\events.js` 和規則要求的相關 checks。

怪物圖：

1. 判斷對應敵人。
2. 檢查透明度。
3. 複製到 `assets/enemies/`。
4. 在 `js/data/enemies.js` 加 `cardBgImage`。
5. 更新 `index.html` 的 `js/data/enemies.js?v=...`。
6. 跑 `node scripts\check-mojibake.js`、`node --check js\data\enemies.js` 和相關 checks。

## Event Images Connected

`js/data/events.js` 目前已接：

- `森林中的足跡`：`assets/events/forest-footprints.png`
- `廢棄的補給包`：`assets/events/forest-supply-pack.png`
- `絆索陷阱`：`assets/events/forest-snare-trap.png`
- `吞腳泥潭`：`assets/events/swallowing-mud.png`
- `樹幹上的刻字`：`assets/events/forest-inscription.png`
- `黑色菌絲`：`assets/events/forest-dark-growth.png`
- `廢墟中的響動`：`assets/events/ruins-enemy.png`
- `殘破的告示牌`：`assets/events/ruins-inscription.png`
- `不穩的地板`：`assets/events/ruins-unstable-floor.png`
- `落石碎瓦`：`assets/events/ruins-falling-debris.png`
- `半塌的倉庫`：`assets/events/ruins-supply-cache.png`
- `守夜殘壇`：`assets/events/ruins-old-shrine.png`
- `牆後的刻痕`：`assets/events/ruins-wall-marks.png`
- `黑暗中的眼睛`：`assets/events/cave-eyes.png`
- `洞穴迷失`：`assets/events/cave-dark-trap.png`
- `割腳石灘`：`assets/events/cave-razor-stone.png`
- `洞壁上的記號`：`assets/events/cave-inscription.png`
- `地下水窪`：`assets/events/cave-dripping-water.png`
- `星光碎片`：`assets/events/cave-starlight-shard.png`
- `遠處的呼喊`：`assets/events/cave-lost-voice.png`
- `路旁的遺落物`：`assets/events/empty-supply.png`
- `腳印與布條`：`assets/events/empty-survivor-clue.png`
- `湧動的陰影`：`assets/events/empty-shadow-passage.png`
- `地面的裂縫`：`assets/events/empty-darkness-seep.png`
- `廢棄的臨時營地`：`assets/events/empty-old-camp.png`
- `低語`：`assets/events/empty-dark-whisper.png`
- `藏寶圖`：`assets/events/empty-treasure-map.png`

`index.html` 目前 events cache：

```html
<script src="js/data/events.js?v=empty-old-camp-image1"></script>
```

注意：這是最後一次事件圖接圖時的 cache。若再改 `events.js`，改成新的 query。

## Enemy Images Connected

`黑匣擬態` 已接：

- 檔案：`assets/enemies/dark-gift-mimic.png`
- 資料：`js/data/enemies.js` 的 `dark_gift_mimic` 加上：

```js
cardBgImage: 'assets/enemies/dark-gift-mimic.png',
```

`index.html` 目前 enemies cache：

```html
<script src="js/data/enemies.js?v=dark-gift-mimic-image1"></script>
```

## Text Changes This Round

已更新的事件文本：

`黑暗中的眼睛`

```text
火光照不到的裂縫裡亮起一排濕冷的眼睛。石壁傳來細碎爬行聲，某個東西正沿著黑暗貼近你們。
```

`洞穴迷失`

```text
火把的光被潮濕石壁吞沒，前方只剩一片濃黑。你們沿著回音摸索前進，直到腳下忽然踩空，有人重重摔進看不見的凹陷裡。
```

`守夜殘壇`

```text
斷裂的石壇刻著褪色星芒，底下仍有守夜餘燼微微發亮，短暫壓住周圍翻湧的黑霧。
```

`湧動的陰影` noteText

```text
「它們已經不再等到夜裡。」記錄此異象後，黑暗 +1。
```

## Remaining Image Decisions

一般 `EVENT_POOL` 裡，若排除聖物獎勵 `find_relic`，目前比較值得補圖的是：

- `祖靈火塘`
- `命運賭桌`

先不要補小事件圖的聖物獎勵：

- `樹根下的硬物`
- `廢墟的角落`
- `石縫中的遺留物`

理由：這些事件後續會顯示聖物獎勵/圖卡，手機版空間容易爆。

特殊事件：

- `共鳴遺址的線索` 不是 `EVENT_POOL` 固定事件，而是 `js/core/echo-sites.js` 動態產生。
- 若要接圖，會動 `echo-sites.js` 的 `_createEchoSiteClueEvent(...)` / `_triggerEchoSiteClue(...)` 流程。
- 使用者傾向這類事件改成滿版背景圖 + 一點黑色遮罩，不要塞小圖框。

## Event Image Flow

事件圖顯示已經接通：

- `modal-render.js` 讀 `cfg.eventImage`，用 `.event-illustration-img` 顯示。
- `event-notes.js` 已傳 `eventImage` / `eventImageAlt`。
- `event-encounters.js`、`event-traps.js` 也有多條傳遞。
- `combat` 類地形事件會先顯示文本 + 圖，再進戰鬥。

關鍵檔案：

- `js/data/events.js`
- `js/ui/modal-render.js`
- `js/core/event-notes.js`
- `js/core/event-encounters.js`
- `js/core/event-traps.js`
- `style.css`

## Balance And Strong Enemy Changes Still In Working Tree

之前已完成但尚未提交的規則變更仍在工作樹：

- `COMBAT_RELIC_DROP_CHANCES` in `js/config.js`
- `UNIQUE_STRONG_ENEMY_DARKNESS: 12`
- 弱/中怪聖物掉落率依天數提升。
- 強怪不走一般聖物掉落，維持祈願寶箱。
- `深污腐骰宿主` 改成黑夜、黑暗 >= 12 後在地圖上生成的明牌強敵。

關鍵檔案：

- `js/config.js`
- `js/core/combat-victory-flow.js`
- `js/core/combat-flow.js`
- `js/core/dark-monsters.js`
- `js/core/game-state.js`
- `js/core/game.js`
- `js/data/enemies.js`
- `js/ui/render.js`
- `style.css`

## Rescue Clue Discussion

`牆後的刻痕`：

- `revealRescueBoss: true`
- `condition: state => state?.canRevealRescueBoss?.() !== false`
- 正常流程下，只有還需要救人且有可揭露救援 Boss 線索時才會進池。
- 使用者覺得它太定向，不要硬轉成其他獎勵。
- 若未來覺得救滿後事件池變薄，建議新增一個非救援版囚籠/空鐵籠事件，不要改這個事件。

## Recent Checks

最近每次事件資料/文字/敵人圖更新後都跑過：

```powershell
node scripts\check-mojibake.js
node --check js\data\events.js
node --check js\data\enemies.js
node --check js\data\equipment.js
node --check js\data\relics.js
node --check js\data\resonances.js
node --check js\ui\notes-render.js
```

相關檢查均通過。

## Current Git Notes

工作樹有大量既有修改與未追蹤圖片。不要回退使用者/前序修改。

目前新增但可能尚未 stage 的資產包含大量 `assets/events/*.png` 和 `assets/enemies/dark-gift-mimic.png`。下一串如果要整理提交，先 `git status --short` 看完整清單。

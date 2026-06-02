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

## Latest Handoff 2026-06-02

下一個聊天室請先接這段。舊段落多數是事件圖時期的紀錄，仍可查，但目前最新重點已經轉到戰鬥教學、怪物卡背景、BGM、怪物平衡與職業說明。

使用者偏好：

- 不要提交或 push；需要時使用者會自己要求。
- 盡量不要用 PowerShell 處理中文檔案內容。若只是啟動命令可接受，但讀寫中文請用 Node `fs.readFileSync(path, 'utf8')` 與 `apply_patch`。
- 文字/資料改完請跑 `scripts/check-mojibake.js`，避免繁中變亂碼。
- 改 browser cache 後要更新 `index.html` query version。
- 回覆以繁體中文、直接說重點。

### Latest Implemented Changes

戰鬥教學：

- 第一場教學戰鬥固定黑影蠕蟲，會引導：
  - 點敵人圖卡看特性。
  - 關閉敵人說明。
  - 用格檔保護敵人當前意圖目標。
  - 說明格檔冷卻。
  - 開背包並使用教學磨刀石。
  - 選主戰者攻擊。
- 教學期間鎖住不該操作的按鈕，避免玩家跳步。
- 教學用磨刀石會優先處理，避免玩家背包滿或已有其他道具導致高光錯物品。
- 修過背包教學卡死：`modal-render.js` 補 `_escapeAttr()`，`combat-inventory-flow.js` 讓 `item_target` 可被教學允許。
- 黑影蠕蟲教學期間禁止蓄力意圖，避免格檔教學浪費。

教學與聖物流程：

- 教學第一件聖物目前傾向必定掉落，且應配合目前隊伍官配，避免給無用聖物。
- 獲得官配聖物後，分配畫面會高光建議分配對象；使用者要求拔掉額外建議卡。
- 教學完成前，若事件本來會給聖物二選一，會轉成怪物遭遇，避免玩家在教學戰鬥前先拿聖物。這類轉化戰鬥打完會補償聖物獲取，不應再等到下一格。
- 若玩家一直不去神壇融合：第 9 天應改成自由靈魂提示並用文字完成融合教學，避免第 10 天黑暗事件混在一起。
- 未融合前再次獲得聖物提醒只出現一次：同一角色不可同時裝第二件聖物，強制裝備會替換，替換下來的聖物留在原地，融合後可回來取回。

怪物卡背景：

- 黑暗化身專用整卡背景已接：
  - `assets/enemies/dark-avatar-card-bg.png`
  - `js/data/enemies.js` 的 `abyss_warden.cardBgImage`
  - `js/core/dark-monsters.js` 地圖生成的黑暗化身也帶同圖。
  - `style.css` 對 `enemy-abyss_warden` 和 `enemy-dark_monster_*` 用整卡 `cover`。
- 弱怪 / 中怪通用整卡背景已接：
  - `assets/enemies/common-monster-card-bg.png`
  - `resolveEnemyTier()` 會自動給 `weak` / `medium` 補 `cardBgImage`。
  - 目前套用：黑影蠕蟲、腐骨爬蟲、瘴氣毒蛾、腐骨騎士、暗影獵人與其升階版本。
- 守護者、寶箱擬態、尾王已有專屬 cardBgImage，不要套通用背景。

BGM / Audio：

- `assets/audio/game-over.wav` 已作為 Game Over 音樂。
- `audio-manager.js`：
  - `G.phase === 'over'` 優先於 `G.combat` 判定，避免全滅後仍播戰鬥 BGM。
  - 戰鬥結果 modal 若仍有 `cfg.combat.enemy`，會繼續保留戰鬥 BGM，避免連戰勝利畫面突然切探索音樂。
- `game-state.js` 的 `_endGame()` 會清掉 `G.combat` 與戰鬥殘留。
- `modal-render.js` 補 `syncAudioAfterCombatAnims` 真正於動畫解鎖後 `AudioManager.sync()`，修過連戰第一場結束後音樂消失。
- 使用者最新回報「好像可以了」，但若下一串又回報連戰 BGM 消失，優先查 AudioManager fade race / unlocked state。
- 注意：`git status` 顯示舊的 `assets/audio/battle-dark-avatar.mp3` 被刪除，新增 `assets/audio/battle-dark-avatar.wav`。確認 `audio-manager.js` 目前是否仍指向 mp3；若是，下一步要改 track path 或恢復 mp3。

黑暗化身規則：

- 主動討伐黑暗化身勝利：
  - 基礎黑暗 -2。
  - 本場命中並擊破原生弱點額外 -1。
  - 目標 Lv.10+ 額外 -1。
  - 其他黑暗化身追殺倒數 +1。
- 被動追殺勝利只移除該化身，不降低黑暗。
- 黑暗化身 Lv.5 與 Lv.15 圖像縮放已有差異，並有限制避免爆版。
- 黑暗化身攻擊偏主攻，偶爾純格檔，不再同回合打又補盾。

守護者 / 強怪 / 流派平衡：

- 聖物守護者生命已提高，但定位是「隊伍約有 1 件聖物時可冒險挑戰拿第二件」，不要太強。
- 擲命守衛：
  - 幸運 / 厄運圖示用 `assets/icons/fate-guardian-dice.png`。
  - 幸運面與厄運面每 2 回合換位置但數量保留。
  - 我方弱點擊破最多把厄運面加到 3。
  - 擲到幸運面新增 1 個幸運面，最多 3。
  - 幸運不應 x4，太強；目前應是較溫和傷害加成。
  - 厄運不扣半血，改扣四分之一並本回合攻擊減半。
- 痛痕守護者：
  - 傷口意圖要顯示傷口圖示與層數，目標自己亮紅光。
  - 面具可以引爆它的傷口，這是合理互動。
- 殘棋守衛：
  - 傷口旗每回合 +4。
  - 戰吼旗改 +3。
  - 命中弱點破除效果改為中斷當前旗面效果直到換旗。
- 深污腐骰宿主 / 強怪調過強度，約接近 10 層尾王；污染骰命中後會消除，污染骰也應會對玩家造成自傷。
- 獵星之眼 / 逐星弓：
  - 逐星弓曾經太超模，已削過追加攻擊額外傷害。
  - 獵星之眼配鷹眼羽飾與可疑弱點仍可能很穩，需要未來繼續實測滿裝上限。
- 銀鋒劍 / 銀蜂針：
  - 銀蜂針共鳴連擊傷害已改成每次連擊額外 +1，最多 +5。
  - 共鳴是額外效果，不需要寫「沿用」。
- 沉鐵劍律：
  - 使用者覺得仍偏超模，討論方向是氣勢 >20 且未使出重劍則失去一半氣勢，或只讓氣勢強化重劍威力。
- 痛痕爆發：
  - 使用者覺得沒有太刀時稍弱，可能需要小幅加強。
- 賭命骰子與搏命者反噬上限已降到 2 層。

UI / Tooltip / Emoji：

- 敵人 hover 浮窗已簡化，不顯示 HP / 攻擊 / 格檔，只保留描述、弱點、能力。
- 怪物 hover / 點擊詳細應只在怪物圖面上觸發，不應整張卡都跳浮窗。
- 擲命守衛命運骰圖示 hover / 點擊應說明命運盤能力，手機也要能看。
- 腐骨爬蟲能力已補到詳細 popover 和 hover 浮窗。
- 事件/道具獲得還有部分 emoji 沒完全改成正式圖，最新掃描重點：
  - `js/core/event-encounters.js` 多處 `${equip.icon}` / `${gear.icon}`。
  - `js/core/inventory.js` 祈願寶箱選項。
  - `js/ui/modal-render.js` 敵人 tooltip title、擲命/旗幟 UI 一些 emoji。
  - Combat log 文字可暫留，因為純文字不一定適合塞圖片。

角色 / 職業說明：

- 戰士職業說明剛修正：
  - 戰鬥骰最低視為 3。
  - 主戰攻擊後依最終骰面準備下回合格檔：最終骰面一半向上取整，最多 4。
  - 準備中的格檔下一回合開始生效。
- 之前錯誤原因：`warrior.passiveDesc` 誤填成搏命者文字。

### Latest Files Touched Recently

近期重要檔案：

- `index.html`
- `style.css`
- `js/data/characters.js`
- `js/data/enemies.js`
- `js/ui/audio-manager.js`
- `js/ui/modal-render.js`
- `js/core/combat-flow.js`
- `js/core/combat-inventory-flow.js`
- `js/core/combat-victory-flow.js`
- `js/core/dark-monsters.js`
- `js/core/game-state.js`
- `js/core/event-handlers.js`
- `js/core/event-encounters.js`
- `js/core/event-treasure.js`

新增資產：

- `assets/enemies/dark-avatar-card-bg.png`
- `assets/enemies/common-monster-card-bg.png`
- `assets/icons/fate-guardian-dice.png`
- `assets/audio/battle-dark-avatar.wav`

刪除 / 待確認：

- `assets/audio/battle-dark-avatar.mp3` 顯示為 deleted。確認是否是刻意替換成 wav；若 `audio-manager.js` 還指 mp3，需修。

### Suggested Next Chat Start

下一個聊天室建議先做：

1. `git status --short`
2. 確認 `assets/audio/battle-dark-avatar.mp3` 刪除與 `battle-dark-avatar.wav` 新增是否一致，必要時修 `audio-manager.js`。
3. 快測：
   - 教學戰鬥背包使用磨刀石。
   - 連續戰鬥 BGM。
   - 全滅 Game Over 音樂。
   - 黑暗化身 / 弱怪 / 中怪卡背景。
   - 戰士角色詳情職業說明。
4. 再繼續修正式圖示取代 emoji，優先 `event-encounters.js` 與 `inventory.js`。

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

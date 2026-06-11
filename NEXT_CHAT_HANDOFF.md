# 下一個聊天交接

## 專案位置

`C:\Users\user\Documents\Codex\2026-05-30\github\The-Black-Night-Box`

## 使用者偏好

- 使用繁體中文溝通。
- 不要用 PowerShell 讀取中文內容，會亂碼。搜尋用 `rg`，讀中文檔用 Node `fs.readFileSync(path, 'utf8')`。
- 改檔用 `apply_patch`；改瀏覽器載入的 JS 後記得在 `index.html` 更新對應 `?v=` 快取版本。
- 使用者會自己實測；不必每次做很重的瀏覽器檢查。
- 回答直接、輕鬆，但要明確說改了什麼。改前先講會動哪些檔、為什麼。
- 大改動先給「計畫」讓使用者過目，點頭再落地；高風險邏輯改動才跑檢查。

---

## 最新 session（2026-06-11）：獵星之眼共鳴效果重做

舊版獵星之眼效果（橘色細準星，當初只播上排 4 格）重做為新版藍色「眼睛＋星陣」8 格 sprite（使用者用自製 AI sprite 對齊工具產出並覆蓋進專案）。
- `assets/effects/star-hunter-eye-sprite.png`：使用者已覆蓋為新圖（1972×1002，4×2＝8 格；峰值在第 5 格＝左下爆亮鎖定）。
- `modal-render.js`：`star_hunter_eye` 移出「遊走打點」名單（`wanderingHitTrail`，line ~1598）→ 改**置中**打在目標（同裁星破滅）；`durationByTrail.star_hunter_eye` 720→480。
- `style.css`：`@keyframes star-hunter-eye-frames` 從只走上排 4 格 → **走完 8 格**（上排＋下排，峰值第 5 格才播得出）；`.trail-star-hunter-eye::before` 光暈 `drop-shadow` 橘金→藍/青；動畫 `.54s→.4s`（使用者實測覺得太長）；圖片 url 加 `?v=2`。
- `index.html`：`style.css`、`modal-render.js` → `?v=star-hunter-eye-fix2`。
- 驗證：`modal-render.js` node --check 過；使用者實測位置/速度皆 OK。
- **FYI**：dev-tool 的「黑暗化身共鳴連段」reel 裡 3 記獵星箭現在會置中疊在一起（原為散點）；重錄 reel 時可再單獨處理。

### 進行中（非程式）話題
- **行銷**：要寫 Threads 開發紀錄/內容文（自然、非業配）導回響；已給 4 個角度（玩家自決難度／煩到變吉祥物／40 天 AI 全端／每隻尾王都是倒下的你）。社群版預告分鏡「鉤子三明治」已給；建議重錄一記**真・命運骰破百爆擊**當英雄鏡頭（現有 reel 收尾的 100 其實是沉鐵特效冒充的佔位，且錄製時十二面骰動畫尚未做進去）。
- **影片自動化**：使用者想做半自動出片。環境查證＝**本機是把 Claude 跑在 OpenAI Codex harness 裡**（`codex-primary-runtime` + `openai-primary-runtime` plugin，自帶 Python 3.12/Node 24）。要 GUI 自動點剪映＝需在 Codex 開「Set up computer use」再驗 session 有無拿到桌面工具；但社群剪輯用 **ffmpeg 路線**即可（免設定、現在就能跑），PoC 待使用者給素材路徑＋時間點。

---

## 本次 session 完成的改動（皆為未提交工作樹修改）

### 1. 說明文字校正批次（desc / notes / 程式三方對齊）
- **幸運星**：「小於等於 3」→「1 或 2」，對齊程式 `dice-flow.js` 的 `value < 3`。（`relics.js` desc + `RELIC_FUSED_DESCS` + `notes-render.js`）
- **祈癒杖(T1)**：補上「本次攻擊無視敵人格檔」——程式本來 T1/T2 都清格檔。（`equipment.js` + `notes-render.js`）
- **磨刀石**：「本場戰鬥」→「下一次主戰攻擊」（combatMods 每次攻擊後清空，實為一次性）。連帶 `equipment-rules.js` 的 log「下場戰鬥生效」→「下一次攻擊生效」。
- **enemies.js 註解**：職業攻擊力寫反，改回「戰士 4 / 搏命者 5」。
- **銀蜂劍律頂層 desc**：補「額外 +1，最多 +5」並改回正常中文（原為 unicode 跳脫）。（`resonances.js`）
- **弓/武器 notes 對齊資料檔**：弓/逐星弓連鎖說明統一、太刀補「每層+5%/上限15層」、戰鼓補「不可疊加/可重敲」、匕首標點。

### 2. 共鳴遺址說明（`echo-sites.js`）
遺址提示彈窗補一句：**啟動任一共鳴後，地圖不再出現新的遺址線索**（規則本就如此，只是補上玩家可見說明）。

### 3. 離開前警告（`main.js`）
遊戲進行中（`G.phase` 為 day/night、隊伍存在）攔截重整/關閉分頁的 `beforeunload`。本遊戲不存當前進度。

### 4. 鷹眼羽飾融合落差（`relics.js` + `notes-render.js`）
未融合 `finalMin` 5→6（只認 6），融合維持 5（5-6）+ 首擊 +3。一刀三利：融合觸發 1/6→2/6、單體不再逼近共鳴、裂星破滅追擊頻率對半（與獵星之眼分開）。**已用 fetch 確認伺服器供應檔正確。**

### 5. 星盤戰鼓全體格檔（`equipment.js` + `combat-flow.js` + `notes-render.js`）
保留攻擊 +1，新增「接下來 3 回合開始時全體 +1 格檔」。
- `equipment.js`：effect 加 `teamBlockRounds: 3, teamBlockValue: 1`。
- `combat-flow.js`：新增 `G.combat.battleDrumBlock` 狀態（init 處）、`_refreshBattleDrum` 設定旗標、新方法 `_applyBattleDrumTeamBlock`（在 `_applyRoundStartPlayerPendingEffects` 呼叫）。additive 加在現有格檔上。
- **sim A/B 驗證**：vs 全體毒粉 AOE，損血 37.7%→19.6%（對半）；vs 夜幕之瞳幾乎不動，不破壞硬關。

### 6. 裁衡劍劍系聖物加成（`equipment.js` + `combat.js` + `combat-flow.js` + `notes-render.js`）
保留基礎升級，加：刺劍連擊每次 +1 保底、重劍「每場第一次氣勢流失」減免。
- `equipment.js`：effect 加 `rapierGuaranteedBonus: 1, greatswordReliefPerCombat: 1`。
- `combat.js`：銀蜂連擊保底加武器來源；沉鐵氣勢段加「本場第一次流失跳過」。
- `combat-flow.js`：戰鬥開始重置 `char._swordGreatswordReliefUsed = false`。
- **sim A/B 驗證**：銀蜂劍律 20.4→25.6、沉鐵劍律 23.5→27.0，沒過頭（仍低於獵星 41 / 命運骰 62），順手救起原本墊底的銀蜂劍律。

### 7. 倒下的旅人事件 + 救援回血砍除（7 檔，本次最大改動）
獨立的稀有戰鬥事件：打最高階中階怪 → 掉武器（補武器稀缺缺口）。不綁救援狀態。
- `enemies.js`：`getMaxTierMediumEnemy()`（resolveEnemyTier(base,999) 取最高階：深淵騎士 hp45/atk6、虛空獵人 hp40/atk6）。
- `events.js`：`createFallenTravelerEvent()`（type combat / epic / `maxPerRun: 2` / `combatEnemyResolver:'max_medium'` / `combatReward:'fallen_traveler'` / condition `canFindWeaponDrop`）；`_specialTerrainEvents` 注入四地形；3 個救援補給事件（`rescue_survivor`/`empty_survivor_clue`/`cave_lost_voice`）加 `skipHeal: true`。
- `event-encounters.js`：`_triggerTerrainCombat` 認 `combatEnemyResolver` 與 `combatReward`；`_triggerSupply` 支援 `skipHeal`（不回血、保留道具機率、改顯示線索文字）。
- `event-handlers.js`：`_canFindWeaponDrop()` + 在 state 註冊 `canFindWeaponDrop`。
- `combat-victory-flow.js`：`combatReward === 'fallen_traveler'` 分派 + 新方法 `_settleFallenTravelerVictory`（`randomWeaponForSquad` → 重用 `_openDarkGiftRewardAssignModal`）。
- `event-treasure.js`：`_openDarkGiftRewardAssignModal` 加 `sourceLabel` 參數（放棄文字不再誤寫黑匣擬態）。
- **驗證**：6 檔 node --check + mojibake 過；資料層 node 實測全綠（敵人階級、事件、四地形注入、condition、**maxPerRun=2 上限有效**）。`maxPerRun` 靠 `_dispatchTerrainEvent` 在 dispatch 前 `_recordEventCompletion` 計數，戰鬥事件也算。

---

## 待使用者實測（我無法在預覽 runtime 驗證——預覽 harness 卡舊快取，且戰鬥流程需 DOM）

1. **倒下的旅人**：用「測試工具」強制生成。確認 (a) 打深淵騎士/虛空獵人，(b) 勝利跳出武器指派 modal，(c) maxPerRun 一局最多 2 次。
2. **救援線索**：森林足跡/腳印與布條/遠處的呼喊 **不再回血**（仍可能給道具 + 揭露救援）。
3. **星盤戰鼓**：敲鼓後接下來 3 回合全隊出現 +1 格檔。
4. **鷹眼羽飾**：未融合只在骰 6 觸發弓追擊，融合後 5-6 都觸發。
5. **裁衡劍**：銀蜂刺劍多 1 次保底連擊；沉鐵未打出重劍時，本場第一次氣勢不掉。

---

## 已知待辦 / 可選（未做，非上線門檻）

- **發布前必拔**：「測試工具」按鈕在正常遊玩可見（dev-tool），使用者上線前會移除。
- 手機版 top-bar 偏高（390px 下約 172px，吃 ~20% 螢幕）——可收。
- UI 排版可選打磨：地圖在遊玩畫面更像主角、日誌欄前期太空、華麗邊框過度一致。
- 其他「不無小補」的融合/升級，可套用「降地板而非拉天花板」原則自行掃。
- 大事件全景背景可改「局部 scrim/漸層」讓圖更跳、文字仍清楚（使用者目前壓暗整張，可接受）。

---

## 工具與檢查指令

Bundled node：`C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`

本次新增的 `scripts/`（未追蹤，可當常駐工具）：
- `balance-sim.js`：直接載入遊戲本體 CombatRules 等，蒙地卡羅模擬戰鬥勝率/DPR。含戰鼓 A/B（七）、裁衡劍 A/B（八）。輸出 `balance-sim-report.md`。
- `relic-acquisition-sim.js`：聖物取得/共鳴成形率模擬。輸出 `relic-acquisition-report.md`。
- `desc-audit-dump.js`：傾印各物件 desc vs effect 供文字審查。
- `static-server.js` + `.claude/launch.json`：本機預覽靜態伺服器（port 8123）。

常用檢查：
```powershell
$node='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node --check js\<改過的檔>.js
& $node scripts\check-mojibake.js
& $node scripts\balance-sim.js          # 改數值/共鳴/武器後驗平衡
```

---

## 注意事項

- 工作樹有**大量未提交修改**（本次 + 之前 session 留下的）。**不要還原**任何既有修改。使用者說「更新上去」才做 git commit/push。
- 改瀏覽器載入的 JS 一定要 bump `index.html` 對應 `?v=`（本次都已 bump）。
- 模擬器 `balance-sim.js` 重建了流程層、**沒載入 combat-flow.js**；像戰鼓格檔這種在 combat-flow.js 的邏輯，要驗平衡得手動鏡像進 sim（戰鼓那段已鏡像）。combat.js 內的邏輯（如裁衡劍）則 sim 自動反映。
- 預覽 harness 會卡瀏覽器舊快取；要確認伺服器供應的檔內容，用 `preview_eval` 內 `fetch('/path?bust='+Math.random())` 讀，不要靠 `location.reload()`。

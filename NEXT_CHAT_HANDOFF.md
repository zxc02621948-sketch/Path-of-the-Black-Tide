# 下一個聊天交接

## 專案位置

`C:\Users\user\Documents\Codex\2026-05-30\github\The-Black-Night-Box`

## 使用者偏好

- 使用繁體中文溝通。
- 不要用 PowerShell 讀取中文內容，會亂碼。搜尋可以用 `rg`，讀中文檔請用 Node `fs.readFileSync(path, 'utf8')`。
- 修改檔案請用 `apply_patch`。
- 使用者會自己實測，不需要每次都做很重的瀏覽器檢查。
- 回答可以直接、輕鬆，但要明確說改了什麼。

## 目前工作樹狀態提醒

目前工作樹有不少尚未提交的修改，包含：

- `index.html`
- `style.css`
- `js/core/combat.js`
- `js/core/combat-flow.js`
- `js/core/combat-victory-flow.js`
- `js/core/relic-resonance.js`
- `js/core/event-encounters.js`
- `js/core/event-handlers.js`
- `js/core/game.js`
- `js/ui/modal-render.js`
- `js/ui/audio-manager.js`
- `js/ui/asset-preloader.js`
- `js/ui/render.js`
- 其他核心檔案

新增素材/頁面：

- `assets/audio/sfx/weakpoint-hit.wav`
- `assets/effects/weakpoint-hit-8frames.png`
- `battle-stage.html`
- `video-stage.html`

注意：不要還原使用者或前面聊天留下的變更。

## 最近完成的重點

### 弱點命中動畫與音效

- 加入弱點命中特效圖：`assets/effects/weakpoint-hit-8frames.png`
- 加入弱點命中音效：`assets/audio/sfx/weakpoint-hit.wav`
- `AudioManager` 新增 `weakpointHit`。
- 弱點命中動畫改成攻擊後延遲播放，不和主攻擊同時擠在一起。
- 同一輪玩家攻擊中，弱點破裂動畫只播一次。
- 弱點破裂動畫只在「原生弱點效果真的觸發」時播放。
- 透鏡、獵星之眼、鷹眼旗等新增的原生弱點，只要後續真的被命中並觸發效果，也應該播放弱點破裂。
- 曾修正一個 bug：`weakpointVisualScheduled` 一開始被放錯函式，後來已移到真正播放玩家攻擊演出的區塊。

待使用者實測：

- 戰士打中透鏡/獵星新增弱點時，是否會出現弱點破裂動畫與音效。
- 弱點動畫位置目前往下移過，如果還偏高可再調 `style.css` 裡 `.combat-hit-effect.hit-weakpoint-hit` 的 `top`。

### 事件演出互動鎖

- 事件 modal 現在可以在演出/音效期間鎖住互動。
- 共鳴啟動 modal 特別設定 `interactionLockMs: 2000`。
- modal 自己播放或排程的事件音效會被追蹤。
- 如果 modal 被關閉或換掉，會停止該 modal 播放中的事件音效，避免畫面關了聲音還在背景播。
- `AudioManager.playSfx()` 現在會回傳實際播放的 audio，讓 modal 能追蹤並停止。

待使用者實測：

- 共鳴事件演出期間是否無法提前按確認。
- 關閉或切換事件時，音效是否不再殘留。

### 手機事件演出

- 移除手機版把 `.event-intro-scene` 動畫關掉的 CSS。
- 手機事件圖片、標題、文字、選項應該會和桌機一樣有浮現演出。

待使用者實測：

- 手機一般事件是否恢復圖片浮現演出。
- 手機事件排版是否仍正常，不會因動畫造成明顯跳動或溢出。

### 戰鬥後選項與舉旗選項

- 新增 `useModalChoices`，讓某些有戰鬥場景的流程選項不要塞在黑色的 `.combat-actions` 區。
- 救援戰鬥勝利後，選項從「救出倖存者」改為「繼續」。
- 救援勝利與舉旗 prompt 已設定 `useModalChoices: true`，選項改回一般 modal 選項區。
- `.combat-actions.combat-actions-inline-disabled` 會隱藏原本黑色戰鬥操作區。

待使用者實測：

- 救援戰鬥勝利後按鈕位置是否好看，文字是否為「繼續」。
- 舉旗選項是否不再出現在醜的黑色戰鬥按鈕區。
- 真正戰鬥中的攻擊/格擋/背包等操作不應受到影響。

### 地圖視覺與移動十字

- 地圖背景使用開場教學/探索背景方向調整過。
- 未探索區域加深，已探索區域可看到背景紋理。
- 可移動十字框改為青綠色系，不再用金色底蓋住地圖/事件格。
- 事件格與空格的高亮差異曾調整過。

### 地下水窪事件

- `地下水窪` 改為稀有事件。
- 設計成小型整修點：
  - `取水修整`：全隊恢復 2 HP。
  - `搜尋洞穴`：一定獲得一個道具。
  - 第一個行動安全，第二個行動有 50% 機率遭遇怪物。
- 事件文字與手機排版已調整過。

### 起始選角與事件/筆記背景

- 起始角色卡在手機與桌機加了橫幅式背景圖，使用 `assets/portraits/battle*` 四張圖。
- 筆記彈窗與卡片背景曾做透明化調整。
- 共鳴列表置中調整過。

## 最近檢查過的指令

可用 bundled Node：

`C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`

常用檢查：

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\ui\modal-render.js
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\ui\audio-manager.js
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\core\combat.js
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\check-mojibake.js
```

最近 `scripts/check-mojibake.js` 回報：

`No mojibake markers found.`

## 下一步建議

使用者下一個聊天大概率會先實測：

1. 手機事件演出是否恢復。
2. 救援戰鬥勝利後的「繼續」按鈕位置是否好看。
3. 舉旗選項是否不再出現在黑色戰鬥操作區。
4. 共鳴演出是否會鎖互動並停止殘留音效。
5. 新增弱點被其他角色命中時，弱點破裂動畫是否正確播放。

如果使用者說「幫我更新上去」，再做 git 檢查、commit、push。注意目前有很多既有修改，不要亂還原。

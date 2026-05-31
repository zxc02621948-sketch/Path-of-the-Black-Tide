// Section.
let G = {};

const Game = {

  // Section.
  init(selectedClasses, startingLibraryRelicId = null, startingLibraryCarrierCls = null) {
    const cx = Math.floor(CONFIG.MAP_SIZE / 2);
    const cy = Math.floor(CONFIG.MAP_SIZE / 2);

    const libraryUnlockedAtStart = this._loadLibraryUnlocked();
    G = {
      day: 1,
      actionsLeft: CONFIG.ACTIONS_PER_DAY,
      phase: 'day',       // 'day' | 'night' | 'dawn' | 'over'
      // Pure darkness value, clamped from 0 to CONFIG.DARKNESS_MAX_THRESHOLD.
      darkness: 0,
      lightCharges: 0,
      darkMonsters: [],
      darknessMilestones: {},
      nightIntroShown: false,
      dayTransitionActive: false,
      pendingSystemModals: [],
      fateGamblingTableTriggered: false,
      echoSites: [],
      spawnedUniqueEnemies: [],
      defeatedUniqueEnemies: [],

      map: MapGen.generate(),
      playerX: cx,
      playerY: cy,

      squad: [],
      inventory: [],
      nightBoxFound: false,
      libraryUnlocked: libraryUnlockedAtStart,
      libraryUnlockedAtStart,
      torchActive: 0,
      rollMods: [],
      combatMods: [],

      // Section.
      activeResonances: [],
      activeResonanceKeys: new Set(),

      // Section.
      _altarRollGranted: false,

      // Section.
      library: this._loadLibrary(),
      notes: this._loadNotes(),
      visitedTerrains: this._loadVisitedTerrains(),

      // Section.
      modal: null,
      combat: null,
      gamblerRerollsLeft: 0,

      log: [],
    };

    this._placeStartingAltars?.();
    const usedNames = new Set();
    for (const cls of selectedClasses) {
      const char = this._spawnChar(cls, usedNames);
      G.squad.push(char);
      usedNames.add(char.name);
    }

    // Section.
    this._dedupeMapRelics();

    // Section.
    this._revealAround(cx, cy);

    this._log('你們踏上黑潮之途。', 'important');
    this._syncKnownRelicNotes();

    this._updateResonances();
    Render.fullRender();
    if (Render.shouldShowOpeningTutorial?.()) {
      Render.showTutorial?.(0);
    }
  },

  // Section.
  handleCellClick(x, y) {
    if (G.modal || G.phase === 'over' || G.mapMoveLocked || G.dayTransitionActive) return;
    if (this._triggerPendingDarkMonsterChase()) return;
    this._refreshRestPoints();

    if (x === G.playerX && y === G.playerY) {
      const currentCell = G.map?.[y]?.[x];
      if (!currentCell?.revealed) return;
      if (currentCell.type === 'altar') {
        currentCell.visited = true;
        this._triggerAltar(currentCell);
        return;
      }
      if (currentCell.droppedRelics?.length > 0) {
        this._triggerRelic(currentCell);
        return;
      }
      if (currentCell.type === 'relic') {
        this._triggerRelic(currentCell);
        return;
      }
      if (currentCell.type === 'rest' && G.actionsLeft > 0) {
        currentCell.visited = true;
        this._triggerRest(currentCell);
        return;
      }
      return;
    }

    if (!MapGen.isAdjacent(G.playerX, G.playerY, x, y)) { return; }
    if (!G.map[y][x].revealed) { return; }
    if (G.actionsLeft <= 0) { return; }

    this._animateMoveTo(x, y);
  },

  _animateMoveTo(x, y) {
    if (G.mapMoveLocked) return;
    G.mapMoveLocked = true;
    const done = () => {
      G.mapMoveLocked = false;
      this._moveTo(x, y);
    };
    if (Render.animatePlayerMove) {
      Render.animatePlayerMove(G.playerX, G.playerY, x, y, done);
    } else {
      done();
    }
  },

  _moveTo(x, y) {
    const cell = G.map[y][x];

    G.playerX = x;
    G.playerY = y;
    cell.visited = true;
    this._spendAction();
    this._revealAround(x, y);
    if (G.phase === 'night' && G.torchActive > 0) G.torchActive--;

    if (this._triggerActiveDarkMonsterHuntAt(x, y)) return;

    if (G.phase === 'night' && cell.corrupted) {
      this._triggerCorruptedAmbush(cell);
      return;
    }

    // 已清理格若有掉落聖物或遺落物，仍可互動。
    if (cell.cleared) {
      if (cell.droppedRelics?.length > 0) {
        this._triggerRelic(cell);
        return;
      }
      Render.fullRender();
      return;
    }

    this._triggerCell(cell);
  },

  _spendAction() {
    G.actionsLeft--;
    Render.renderTopBar();
  },

  // Section.
  // Section.
  endDay() {
    if (G.modal || G.phase === 'over' || G.dayTransitionActive) return;
    if (G.actionsLeft > 0) {
      Render.renderTopBar();
      return;
    }

    G.dayTransitionActive = true;
    Render.renderTopBar();
    const transition = this._dayTransitionInfo();
    AudioManager?.playDayTransitionSfx?.(transition.phase);
    if (typeof Render.showDayTransition === 'function') {
      Render.showDayTransition(transition, () => this._completeEndDay());
      return;
    }
    this._completeEndDay();
  },

  _dayTransitionInfo() {
    const endingDay = G.day || 1;
    const nextDay = endingDay + 1;
    const darknessDelta = G.phase === 'night' ? 2 : 1;
    const phase = G.phase === 'night'
      ? 'night'
      : (nextDay >= CONFIG.DAWN_DAY ? 'dawn' : (nextDay === CONFIG.NIGHT_START_DAY ? 'nightfall' : 'day'));
    const nextLabel = nextDay >= CONFIG.DAWN_DAY
      ? '黎明將至'
      : (nextDay === CONFIG.NIGHT_START_DAY && G.phase === 'day' ? '黑夜降臨' : `第 ${nextDay} 天`);
    return {
      endingDay,
      nextDay,
      phase,
      darknessDelta,
      endLabel: `第 ${endingDay} 天結束`,
      darknessLabel: `黑暗 +${darknessDelta}`,
      nextLabel,
    };
  },

  _completeEndDay() {
    G.dayTransitionActive = false;
    if (this._applyNightEndErosion()) return;

    G.day++;
    G.actionsLeft = CONFIG.ACTIONS_PER_DAY;
    this._refreshRestPoints();

    // 重置每日狀態
    for (const char of G.squad) {
      if (char.dead) continue;
      char.firstAidUsed = false;
      char.safeMoveUsed = false;
      if (char.cls === 'scholar') char.gamblerRerollsLeft = 0;
      char._exorcismRingUsed = false;
    }
    G.gamblerRerollsLeft = 0;
    this._syncGamblerRerollDisplay();

    const dailyDarkness = G.phase === 'night' ? 2 : 1;
    this._applyDarkness(dailyDarkness, G.phase === 'night' ? '夜晚結束' : '白天結束');
    if (G.phase === 'over') return;
    this._updateDarkMonstersDaily();
    this._maybeSpawnDailyDarkMonster();
    const hasPhaseTransition = (G.day === CONFIG.NIGHT_START_DAY && G.phase === 'day') || G.day >= CONFIG.DAWN_DAY;
    if (!hasPhaseTransition && this._triggerPendingDarkMonsterChase()) return;

    // 進入黑夜。
    if (G.day === CONFIG.NIGHT_START_DAY && G.phase === 'day') {
      this._enterNight();
      this._triggerPendingDarkMonsterChase();
      return;
    }
    if (G.day >= CONFIG.DAWN_DAY) {
      this._triggerDawn(); return;
    }

    this._log(`第 ${G.day} 天開始。`, 'important');
    Render.fullRender();
  },

  _enterNight() {
    G.phase = 'night';
    this._log('黑夜降臨，邊境變得更加危險。', 'night');
    this._log('黑夜結束今天時不再扣生命，但黑暗會更快壯大，並強化最終尾王。', 'night');
    if (typeof this._maybeSpawnUniqueStrongEnemy === 'function') {
      this._maybeSpawnUniqueStrongEnemy();
    }

    // 夜晚只放置目前的黑夜聖物；舊黑夜遺匣流程已移除。
    this._placeNightRelics();

    Render.fullRender();
    G.nightTransitionActive = true;
    Render.showNightTransition();
    const shouldShowIntro = !G.nightIntroShown;
    setTimeout(() => {
      G.nightTransitionActive = false;
      this._showNightIntroOnce();
      if (!shouldShowIntro) this._triggerPendingDarkMonsterChase?.();
    }, 1250);
  },

  _applyNightEndErosion() {
    if (G.phase !== 'night') return false;
    const damage = CONFIG.NIGHT_END_HP_COST ?? 2;
    if (damage <= 0) return false;

    const damaged = [];
    for (const char of this._aliveSquad()) {
      char.hp = Math.max(0, char.hp - damage);
      damaged.push(`${char.name} -${damage}`);
    }
    if (damaged.length > 0) {
      this._log(`黑夜侵蝕：${damaged.join('、')} HP。`, 'danger');
      if (this._checkLose()) return true;
    }
    return false;
  },

  _triggerDawn() {
    G.phase = 'dawn';
    G.actionsLeft = 0;
    if (G.finalBossDefeated) {
      this._endGame('dawn');
      return;
    }
    const boss = typeof getFinalBossEnemy === 'function' ? getFinalBossEnemy(G.darkness || 0) : null;
    if (!boss) {
      this._log('第 20 天黎明到來，你們走過了黑潮之途。', 'important');
      this._endGame('dawn');
      return;
    }
    G.finalBossSpawned = true;
    this._log('第 20 天黎明前，夜幕之瞳在黑霧深處睜開。', 'danger');
    this._triggerCombat({
      type: 'enemy',
      cleared: false,
      content: { enemy: boss, reward: 'final_boss' },
    }, { source: 'finalBoss' });
  },

  // Section.
  // Section.
  _triggerCell(cell) {
    if (cell.droppedRelics?.length > 0 && (cell.cleared || cell.type === 'empty' || cell.visited)) {
      this._triggerRelic(cell);
      return;
    }
    switch (cell.type) {
      case 'relic':   this._triggerRelic(cell);        break;
      case 'chest':   this._triggerWeaponChest(cell);  break;
      case 'enemy':   this._triggerCombat(cell);       break;
      case 'altar':   this._triggerAltar(cell);        break;
      case 'rest':    this._triggerRest(cell);         break;
      case 'forest':
      case 'ruins':
      case 'cave':    this._triggerTerrain(cell);      break;
      case 'empty':
      default:
        if (!cell.cleared && (cell.content?.event || cell.content?.eventPending)) {
          this._triggerTerrain(cell);
        } else {
          Render.fullRender();
        }
        break;
    }
  },

  // Section.
  _triggerRelic(cell) {
    const droppedRelic = !cell.content?.relic ? cell.droppedRelics?.[0] : null;
    const relic = cell.content?.relic || droppedRelic;
    if (!relic) { cell.cleared = true; Render.fullRender(); return; }

    const clearRelic = () => {
      if (droppedRelic) {
        cell.droppedRelics.shift();
        if (cell.droppedRelics.length === 0) delete cell.droppedRelics;
      } else {
        cell.cleared = true;
        if (cell.type === 'relic') {
          cell.type = 'empty';
          cell.content = null;
        }
      }
    };

    if (this._squadHasRelic(relic.id)) {
      clearRelic();
      this._openModal({
        title: `已擁有聖物：${relic.name}`,
        desc: `隊伍已經擁有「${relic.name}」。這件聖物已轉為塵光消散。`,
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    this._unlockNote(relic.id);

    const ownerStillDead = droppedRelic?._droppedBy
      && G.squad.some(c => c.dead && c.name === droppedRelic._droppedBy);
    if (ownerStillDead) {
      const lore = this._getFirstLore(relic.id);
      const slotLabel = droppedRelic._droppedSlot === 'fusedRelic' ? '融合聖物' : '攜帶聖物';
      this._openModal({
        title: `遺落物：${relic.name}`,
        desc: `原本欄位：${slotLabel}\n效果：${relic.desc}${lore ? `\n\n「${lore}」` : ''}\n\n${droppedRelic._droppedBy} 已經倒下，這件遺落物暫時無法取回。`,
        choices: [{ label: '離開', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    if (droppedRelic?._droppedBy) {
      const owner = G.squad.find(c => !c.dead && c.name === droppedRelic._droppedBy);
      if (owner) {
        this._openDroppedRelicReturnModal(cell, droppedRelic, relic, owner, clearRelic);
        return;
      }
    }

    if (G.eventRelicChoiceContext?.relicChoices?.length > 0) {
      this._openRelicAssignTargetModal(relic, clearRelic);
      return;
    }

    const lore = this._getFirstLore(relic.id);
    this._openModal({
      title: `發現聖物：${relic.name}`,
      descHtml: this._relicRewardCardHtml(relic, lore),
      typeText: false,
      resultFx: 'event-discover',
      choices: [
        { label: '分配聖物', action: () => this._openRelicAssignTargetModal(relic, clearRelic) },
        {
          label: '放棄聖物',
          className: 'relic-abandon-choice',
          action: () => {
            this._relicAssignContext = null;
            clearRelic();
            this._log(`放棄聖物「${relic.name}」。`);
            this._closeModal();
          },
        },
      ],
    });

  },

  _openRelicAssignTargetModal(relic, clearRelic) {
    const carriers = relic.scholarOnly
      ? G.squad.filter(c => !c.dead && c.hp > 0 && c.cls === 'scholar')
      : G.squad.filter(c => !c.dead);
    const emptySlots = carriers.filter(c => !c.relic);
    const withRelic = carriers.filter(c => c.relic && c.relic.id !== relic.id);
    const assignOptions = [];

    for (const char of emptySlots) {
      assignOptions.push({
        char,
        actionLabel: '收下',
        action: () => {
          char.relic = { ...relic };
          this._applyRelicEquip(char, relic);
          clearRelic();
          this._log(`${char.name} 獲得聖物「${relic.name}」。`, 'reward');
          this._closeModal();
          const newly = this._updateResonances({ announceModal: true });
          if (!newly.length) Render.fullRender();
        },
      });
    }

    for (const char of withRelic) {
      assignOptions.push({
        char,
        actionLabel: '替換',
        currentRelic: char.relic,
        action: () => this._replaceRelicWithLinkWarning(char, relic, clearRelic),
      });
    }

    this._relicAssignContext = { relic, options: assignOptions };

    const choices = [];
    if (G.eventRelicChoiceContext?.relicChoices?.length > 0) {
      choices.push({
        label: '返回選擇',
        action: () => {
          this._relicAssignContext = null;
          this._openEventRelicChoiceModal(G.eventRelicChoiceContext.cell, G.eventRelicChoiceContext.ev, G.eventRelicChoiceContext.relicChoices);
        },
      });
    }
    choices.push({
      label: '放棄聖物',
      className: 'relic-abandon-choice',
      action: () => {
        this._relicAssignContext = null;
        G.eventRelicChoiceContext = null;
        clearRelic();
        this._log(`放棄聖物「${relic.name}」。`);
        this._closeModal();
      },
    });

    this._openModal({
      title: `發現聖物：${relic.name}`,
      descHtml: this._relicAssignPanelHtml(assignOptions),
      typeText: false,
      choices,
    });
  },

  chooseRelicAssignTarget(index) {
    const option = this._relicAssignContext?.options?.[index];
    if (option?.action) option.action();
  },

  _relicAssignPanelHtml(assignOptions = []) {
    const assignCards = assignOptions.length
      ? assignOptions.map((option, index) => this._relicAssignTargetCardHtml(option, index)).join('')
      : '<div class="relic-assign-empty">沒有可持有這件聖物的角色。</div>';
    return `
      <div class="relic-assign-panel">
        <div class="relic-assign-instruction">選擇要交給哪位角色。</div>
        <div class="relic-assign-target-grid">${assignCards}</div>
      </div>
    `;
  },

  _relicRewardCardHtml(relic, lore = '', compact = false) {
    const desc = this._escapeHtmlLocal(relic.desc || '');
    const loreHtml = !compact && lore ? `<div class="relic-reward-lore">「${this._escapeHtmlLocal(lore)}」</div>` : '';
    const relicClass = String(relic.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
    const visual = relic.iconImage
      ? `<img class="relic-reward-img" src="${this._escapeAttrLocal(relic.iconImage)}" alt="">`
      : `<span class="relic-reward-emoji">${this._escapeHtmlLocal(relic.icon || '◆')}</span>`;
    return `
      <div class="relic-reward-panel relic-reward-display relic-${relicClass}${compact ? ' compact' : ''}">
        <div class="relic-reward-visual">${visual}</div>
        <div class="relic-reward-copy">
          ${compact ? '' : `<div class="relic-reward-desc">${desc}</div>`}
          ${loreHtml}
        </div>
      </div>
    `;
  },

  _relicAssignTargetCardHtml(option, index) {
    const char = option.char;
    const cls = CHARACTER_CLASSES[char.cls] || {};
    const hpText = `${Math.max(0, char.hp || 0)}/${char.maxHp || 0}`;
    const current = option.currentRelic
      ? `<span class="relic-assign-current">替換：${this._escapeHtmlLocal(option.currentRelic.name || '既有聖物')}</span>`
      : '<span class="relic-assign-current empty">空欄位</span>';
    const battleArt = char.battleArt || (typeof CLASS_BATTLE_ART !== 'undefined' ? CLASS_BATTLE_ART[char.cls] : '');
    const art = battleArt ? `<span class="relic-assign-art"><img src="${this._escapeAttrLocal(battleArt)}" alt=""></span>` : '';
    return `
      <button type="button" class="relic-assign-target-card${option.currentRelic ? ' replace' : ''}" onclick="Game.chooseRelicAssignTarget(${index})">
        ${art}
        <span class="relic-assign-head">
          <span class="relic-assign-class">${this._escapeHtmlLocal(cls.icon || '◆')}</span>
          <span class="relic-assign-name">${this._escapeHtmlLocal(char.name || '')}</span>
          <span class="relic-assign-action">${this._escapeHtmlLocal(option.actionLabel || '選擇')}</span>
        </span>
        <span class="relic-assign-meta">HP ${this._escapeHtmlLocal(hpText)}</span>
        ${current}
      </button>
    `;
  },

  _escapeHtmlLocal(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  },

  _escapeAttrLocal(value) {
    return this._escapeHtmlLocal(value).replace(/`/g, '&#96;');
  },

  _openDroppedRelicReturnModal(cell, droppedRelic, relic, owner, clearRelic) {
    const slot = droppedRelic._droppedSlot === 'fusedRelic' ? 'fusedRelic' : 'relic';
    const slotLabel = slot === 'fusedRelic' ? '融合欄' : '攜帶欄';
    const occupied = !!owner[slot];
    const lore = this._getFirstLore(relic.id);
    const choices = occupied
      ? [{ label: '離開', action: () => { this._closeModal(); Render.fullRender(); } }]
      : [{
          label: `歸還給 ${owner.name}`,
          action: () => {
            const restored = { ...relic };
            if (slot === 'fusedRelic') {
              if (restored.fusedEffect) restored.effect = { ...restored.fusedEffect };
              owner.fusedRelic = restored;
              this._applyFusionBonus(owner, restored);
              this._unlockNote(restored.id, true);
            } else {
              owner.relic = restored;
              this._applyRelicEquip(owner, restored);
              this._unlockNote(restored.id);
            }
            clearRelic();
            this._log(`${owner.name} 取回${slot === 'fusedRelic' ? '融合' : ''}遺落物「${restored.name}」。`, 'reward');
            this._closeModal();
            const newly = this._updateResonances({ announceModal: true });
            if (!newly.length) Render.fullRender();
          },
        }, {
          label: '離開',
          action: () => { this._closeModal(); Render.fullRender(); },
        }];
    this._openModal({
      title: `遺落物：${relic.name}`,
      desc: [
        `原本欄位：${slotLabel}`,
        `效果：${relic.desc}`,
        lore ? `\n「${lore}」` : '',
        occupied ? `\n${owner.name} 的${slotLabel}已有聖物，暫時無法取回。` : `\n${owner.name} 已經復活，可以取回這件遺落物。`,
      ].filter(Boolean).join('\n'),
      choices,
    });
  },

  _replaceRelicWithLinkWarning(char, relic, clearRelic) {
    this._confirmRelicReplacement(char, relic, () => this._commitRelicReplace(char, relic, clearRelic), {
      onCancel: () => this._openRelicAssignTargetModal(relic, clearRelic),
    });
  },

  _confirmRelicReplacement(char, relic, onConfirm, opts = {}) {
    if (!char?.relic) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }
    const resonanceWarning = this._hasStarHunterEye(char)
      ? '\n\n目前觸發「獵星之眼」。替換後如果不再同時持有已融合鷹眼羽飾與鷹眼透鏡，該共鳴效果會消失。'
      : '';
    this._openModal({
      title: '確認替換聖物',
      desc: `${char.name} 目前已攜帶「${char.relic.name}」。\n\n確定要替換成「${relic.name}」嗎？原本的聖物會掉落在原地。${resonanceWarning}`,
      choices: [
        {
          label: `確認替換為「${relic.name}」`,
          danger: true,
          action: onConfirm,
        },
        {
          label: '取消',
          action: typeof opts.onCancel === 'function' ? opts.onCancel : () => this._closeModal(),
        },
      ],
    });
  },

  _commitRelicReplace(char, relic, clearRelic) {
    const replaced = char.relic ? { ...char.relic } : null;
    this._removeRelicEffect(char, char.relic);
    if (replaced) {
      this._dropRelicAt(G.playerX, G.playerY, replaced);
    }
    char.relic = { ...relic };
    this._applyRelicEquip(char, relic);
    clearRelic();
    this._log(`${char.name} 改為攜帶聖物「${relic.name}」。${replaced ? `原本的「${replaced.name}」掉落在原地。` : ''}`, 'reward');
    this._closeModal();
    const newly = this._updateResonances({ announceModal: true });
    if (!newly.length) Render.fullRender();
  },

  // Section.
  // Combat flow methods live in js/core/combat-flow.js.

  // Section.
  // Section.
  // New altar rules: fixed hidden altars can be used once per day.
  // Game Site Actions methods live in js/core/site-actions.js.

  // Game Event Handlers methods live in js/core/event-handlers.js.

  _progressEventDelta(ev, fallbackDelta = undefined) {
    if (!ev) return null;
    if (typeof ev.darknessChange === 'number' && ev.darknessChange > 0) return ev.darknessChange;
    if (typeof ev.reduceDarkness === 'number' && ev.reduceDarkness > 0) return -ev.reduceDarkness;
    if (typeof ev.darknessChange === 'number' && ev.darknessChange < 0) return ev.darknessChange;
    return null;
  },

  // Section.
  // Inventory methods live in js/core/inventory.js.

  // Game Dev Tool methods live in js/core/dev-tool.js.

  // Character detail methods live in js/core/character-details.js.

  // Dice and roll modifier methods live in js/core/dice-flow.js.

  // Relic, vision, and resonance methods live in js/core/relic-resonance.js.

  // Game state, persistence, and squad helper methods live in js/core/game-state.js.


};

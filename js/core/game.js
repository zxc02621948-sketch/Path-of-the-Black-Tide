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
      erosionBossSpawned: false,
      fateGamblingTableTriggered: false,

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
      explorerCooldownExpires: 0,   // 探索者路標冷卻到期日，0 = 可使用。

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

    this._log('你們踏入黑夜邊境。', 'important');
    if (G.libraryUnlocked && G.library.length > 0) {
      this._log(`聖物庫中有 ${G.library.length} 件聖物可用。`, 'reward');
    }

    this._updateResonances();
    Render.fullRender();
  },

  // Section.
  handleCellClick(x, y) {
    if (G.modal || G.phase === 'over' || G.mapMoveLocked) return;
    if (this._triggerPendingDarkMonsterChase()) return;
    this._refreshRestPoints();

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
    if (G.modal || G.phase === 'over') return;
    if (G.actionsLeft > 0) {
      Render.renderTopBar();
      return;
    }

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
    this._log(`黑夜結束今天時，全隊會受到 ${CONFIG.NIGHT_END_HP_COST || 2} 點黑夜侵蝕。`, 'night');

    // 夜晚只放置目前的黑夜聖物；舊黑夜遺匣流程已移除。
    this._placeNightRelics();

    Render.fullRender();
    Render.showNightTransition();
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
    this._log('第 20 天黎明到來，你們撐過了黑夜邊境。', 'important');
    this._endGame('dawn');
  },

  // Section.
  // Section.
  _triggerCell(cell) {
    if (cell.droppedRelics?.length > 0 && (cell.cleared || cell.type === 'empty')) {
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

    const carriers = relic.scholarOnly
      ? G.squad.filter(c => !c.dead && c.hp > 0 && c.cls === 'scholar')
      : G.squad.filter(c => !c.dead);
    const emptySlots = carriers.filter(c => !c.relic);
    const withRelic = carriers.filter(c => c.relic && c.relic.id !== relic.id);
    const choices = [];

    for (const char of emptySlots) {
      choices.push({
        label: `交給 ${char.name}`,
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
      choices.push({
        label: `替換 ${char.name} 的「${char.relic.name}」`,
        detail: `目前效果：${char.relic.desc}`,
        action: () => this._replaceRelicWithLinkWarning(char, relic, clearRelic),
      });
    }

    choices.push({
      label: '放棄聖物',
      action: () => { clearRelic(); this._log(`放棄聖物「${relic.name}」。`); this._closeModal(); },
    });

    const lore = this._getFirstLore(relic.id);
    this._openModal({
      title: `發現聖物：${relic.name}`,
      desc: `效果：${relic.desc}${lore ? `\n\n「${lore}」` : ''}`,
      choices,
    });

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
    if (this._hasStarHunterEye(char)) {
      this._openModal({
        title: '聖物共鳴將消失',
        desc: `${char.name} 目前觸發「獵星之眼」。替換聖物後，如果不再同時持有已融合鷹眼羽飾與鷹眼透鏡，該共鳴效果會消失。\n\n確定要替換「${char.relic.name}」嗎？`,
        choices: [
          {
            label: `確認替換為「${relic.name}」`,
            danger: true,
            action: () => this._commitRelicReplace(char, relic, clearRelic),
          },
          { label: '取消', action: () => this._closeModal() },
        ],
      });
      return;
    }
    this._commitRelicReplace(char, relic, clearRelic);
  },

  _commitRelicReplace(char, relic, clearRelic) {
    this._removeRelicEffect(char, char.relic);
    char.relic = { ...relic };
    this._applyRelicEquip(char, relic);
    clearRelic();
    this._log(`${char.name} 改為攜帶聖物「${relic.name}」。`, 'reward');
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

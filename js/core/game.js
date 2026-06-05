// Section.
let G = {};

const GUIDE_QUEST_DISABLED_KEY = 'bbn_guide_quest_disabled';
const CLASS_SIGNATURE_RELICS = {
  warrior: ['pain_mask', 'iron_scabbard', 'silver_bee_pin', 'pain_splinter_badge'],
  explorer: ['eagle_eye_feather', 'flaw_lens'],
  scholar: ['wager_dice', 'lucky_star'],
  support: ['war_banner', 'eagle_banner'],
};

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
      darkMonsterRespawns: [],
      darkMonsterChasesToday: 0,
      eventCounts: {},
      darknessMilestones: {},
      nightIntroShown: false,
      dayTransitionActive: false,
      pendingSystemModals: [],
      fateGamblingTableTriggered: false,
      echoSites: [],
      echoSiteReserveHintDismissed: false,
      spawnedUniqueEnemies: [],
      defeatedUniqueEnemies: [],
      guideQuest: null,
      combatTutorial: { active: false, completed: false, firstCombatStarted: false },

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
    this._applyStartingLibraryRelic(startingLibraryRelicId, startingLibraryCarrierCls);

    // Section.
    this._dedupeMapRelics();

    // Section.
    this._revealAround(cx, cy);
    this._initGuideQuest();

    this._log('你們踏上黑潮之途。', 'important');
    this._syncKnownRelicNotes();

    this._updateResonances();
    Render.fullRender();
    if (Render.shouldShowOpeningTutorial?.()) {
      Render.showTutorial?.(0);
    }
    this._showGuideQuestIntro();
  },

  _initGuideQuest() {
    if (this._isGuideQuestDisabled()) {
      G.guideQuest = { active: false, completed: true };
      return;
    }
    const hasRelic = this._aliveSquad().some(char => char.relic || char.fusedRelic);
    G.guideQuest = {
      active: true,
      stage: hasRelic ? 'find_altar' : 'find_relic',
      introShown: false,
      relicHintShown: hasRelic,
      altarTarget: null,
      relicAmbushTarget: null,
      delayedRelicChoice: false,
      preFusionRelicHintShown: false,
      freedomSkipShown: false,
      completed: false,
      firstCombatStarted: false,
    };
    if (hasRelic) this._revealGuideAltarTarget();
  },

  _showGuideQuestIntro() {
    if (!G.guideQuest?.active || G.guideQuest.introShown) return;
    G.guideQuest.introShown = true;
    const hasRelic = G.guideQuest.stage === 'find_altar';
    this._queueSystemModal({
      title: hasRelic ? '指引任務：前往神壇' : '指引任務：尋找第一件聖物',
      desc: hasRelic
        ? '你已經帶著聖物踏上旅程。前往地圖上發光的神壇，可以融合聖物，讓它變得更強大。'
        : '先讓小隊取得第一件聖物。\n\n前往地圖上的怪物格，挑戰怪物並學會戰鬥流程。這場教學戰鬥勝利後，會留下第一件聖物。',
      resultFx: hasRelic ? 'event-discover' : 'event-scene',
      choices: [
        { label: '開始行動', action: () => { this._closeModal(); Render.fullRender(); } },
        { label: '不再顯示', action: () => this._disableGuideQuest() },
      ],
    });
  },

  _onGuideRelicAcquired(relic = null) {
    if (!G.guideQuest?.active || G.guideQuest.stage !== 'find_relic') return;
    G.guideQuest.stage = 'find_altar';
    G.guideQuest.relicAmbushTarget = null;
    G.guideQuest.relicHintShown = true;
    const altar = this._revealGuideAltarTarget();
    const altarText = altar ? `\n\n神壇位置已標記在地圖上：(${altar.x},${altar.y})。` : '';
    this._queueSystemModal({
      title: '指引任務：聖物可以融合',
      desc: [
        relic?.name ? `你取得了聖物「${relic.name}」。` : '你取得了第一件聖物。',
        '接下來前往神壇，可以融合目前攜帶的聖物，讓它變得更強大。',
        '融合後角色的普通聖物欄會空出來，之後再攜帶第二件聖物，就有機會形成更強大的共鳴效果。',
      ].join('\n\n') + altarText,
      resultFx: 'event-discover',
      choices: [
        { label: '前往神壇', action: () => { this._closeModal(); Render.fullRender(); } },
        { label: '不再顯示', action: () => this._disableGuideQuest() },
      ],
    });
  },

  _pickGuideTutorialRelic(pool = []) {
    const availableById = new Map(pool.filter(Boolean).map(relic => [relic.id, relic]));
    const candidates = [];
    const seen = new Set();
    for (const char of this._aliveSquad()) {
      for (const relicId of CLASS_SIGNATURE_RELICS[char.cls] || []) {
        if (seen.has(relicId)) continue;
        const relic = availableById.get(relicId);
        if (!relic || !this._charMeetsRelicWeaponRequirement(char, relic)) continue;
        seen.add(relicId);
        candidates.push(relic);
      }
    }
    return weightedRelicPick(candidates.length ? candidates : pool);
  },

  _isGuideRelicAssignmentRequired() {
    return !!(G.guideQuest?.active && !G.guideQuest.completed && G.guideQuest.stage === 'find_relic');
  },

  _recommendedRelicCarrierId(relic, assignOptions = []) {
    if (!relic) return null;
    const candidateClasses = Object.entries(CLASS_SIGNATURE_RELICS)
      .filter(([, relicIds]) => relicIds.includes(relic.id))
      .map(([cls]) => cls);
    for (const cls of candidateClasses) {
      const emptyMatch = assignOptions.find(option => option.char?.cls === cls && !option.currentRelic);
      if (emptyMatch) return emptyMatch.char.id;
      const replaceMatch = assignOptions.find(option => option.char?.cls === cls);
      if (replaceMatch) return replaceMatch.char.id;
    }
    if (relic.requiredWeaponFamilies?.length) {
      const emptyMatch = assignOptions.find(option => !option.currentRelic);
      if (emptyMatch) return emptyMatch.char.id;
    }
    return null;
  },

  _onGuideAltarFusion() {
    if (!G.guideQuest?.active || G.guideQuest.completed) return;
    G.guideQuest.stage = 'complete';
    G.guideQuest.completed = true;
    this._queueSystemModal({
      title: '指引任務完成',
      desc: '聖物已完成融合。\n\n接下來你可以繼續探索，尋找第二件能搭配的聖物。當聖物彼此呼應時，就可能啟動強大的共鳴效果。\n\n更多事件正等著你去體驗，請謹慎又小心地享受這場冒險。',
      resultFx: 'event-reward',
      choices: [{ label: '繼續探索', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _maybeShowPreFusionRelicReminder(relic, clearRelic) {
    const quest = G.guideQuest;
    if (!quest?.active || quest.completed || quest.stage !== 'find_altar' || quest.preFusionRelicHintShown) return false;
    if (!this._aliveSquad().some(char => char.relic)) return false;
    quest.preFusionRelicHintShown = true;
    this._openModal({
      title: '聖物欄位提醒',
      desc: [
        '你的探險精神值得嘉獎，真的。',
        '不過在完成融合之前，同一個人不能同時裝備第二件普通聖物；如果強制裝備，會替換掉目前攜帶的聖物。',
        '請別擔心，被替換下來的聖物會留在原地。完成融合後，你可以回來把它取回。',
      ].join('\n\n'),
      resultFx: 'event-discover',
      choices: [{
        label: '知道了，分配聖物',
        action: () => {
          this._closeModal();
          this._openRelicAssignTargetModal(relic, clearRelic);
        },
      }],
    });
    return true;
  },

  _maybeCompleteGuideQuestByFreedom() {
    const quest = G.guideQuest;
    if (!quest?.active || quest.completed || quest.stage !== 'find_altar' || quest.freedomSkipShown) return false;
    if ((G.day || 1) < 9) return false;
    quest.freedomSkipShown = true;
    quest.active = false;
    quest.completed = true;
    quest.stage = 'complete';
    this._queueSystemModal({
      title: '指引任務：自由之魂',
      desc: [
        '看來你擁有崇尚自由的靈魂！那我們就長話短說，用文字幫你介紹完。',
        '聖物可以在神壇融合。融合後，角色目前攜帶的普通聖物會變成融合聖物，普通聖物欄會空出來。',
        '之後再取得第二件能搭配的聖物，就有機會形成共鳴。共鳴通常會大幅改變戰鬥節奏，是隊伍變強的重要路線。',
        '從現在開始，指引不再標記神壇。是否追尋共鳴，就交給你決定。',
      ].join('\n\n'),
      resultFx: 'event-reward',
      choices: [{ label: '我自由了', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    return true;
  },

  _isGuideQuestDisabled() {
    try {
      return localStorage.getItem(GUIDE_QUEST_DISABLED_KEY) === 'true';
    } catch {
      return false;
    }
  },

  _disableGuideQuest() {
    try {
      localStorage.setItem(GUIDE_QUEST_DISABLED_KEY, 'true');
    } catch {
      // Storage may be unavailable; still hide the guide for this run.
    }
    if (G.guideQuest) {
      G.guideQuest.active = false;
      G.guideQuest.completed = true;
    }
    this._closeModal();
    Render.fullRender();
  },

  _revealGuideAltarTarget() {
    if (!G.guideQuest) return null;
    let target = null;
    let bestDist = Infinity;
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (!cell || cell.cleared) continue;
        const isAltar = cell.type === 'altar' || cell.hiddenSite?.type === 'altar';
        if (!isAltar) continue;
        const dist = MapGen.distance(G.playerX, G.playerY, cell.x, cell.y);
        if (dist < bestDist) {
          target = cell;
          bestDist = dist;
        }
      }
    }
    if (!target) return null;
    if (target.hiddenSite?.type === 'altar') {
      this._revealHiddenSite?.(target);
    } else {
      target.revealed = true;
      target.altarHidden = false;
    }
    G.guideQuest.altarTarget = { x: target.x, y: target.y };
    return target;
  },

  _isGuideTargetCell(x, y, cell) {
    const quest = G.guideQuest;
    if (!quest?.active || quest.completed || !cell?.revealed) return false;
    if (quest.stage === 'find_altar') {
      return quest.altarTarget?.x === x && quest.altarTarget?.y === y;
    }
    if (quest.stage === 'find_relic') {
      if (quest.relicAmbushTarget) {
        return quest.relicAmbushTarget.x === x && quest.relicAmbushTarget.y === y && !cell.cleared && cell.type === 'enemy';
      }
      return !cell.cleared && cell.type === 'enemy';
    }
    return false;
  },

  _shouldUseCombatTutorialEnemy(opts = {}) {
    if (!G.combatTutorial) G.combatTutorial = { active: false, completed: false, firstCombatStarted: false };
    if (G.combatTutorial.completed || G.combatTutorial.firstCombatStarted) return false;
    if (opts.source === 'devTest' || opts.source === 'finalBoss') return false;
    return true;
  },

  // Section.
  handleCellClick(x, y) {
    if (this._isWorldInteractionLocked?.() || G.mapMoveLocked) return;
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
    if (this._isWorldInteractionLocked?.() || G.mapMoveLocked) return;
    G.mapMoveLocked = true;
    const done = () => {
      G.mapMoveLocked = false;
      if (this._isWorldTransitionActive?.() || G.modal || G.combat || G.phase === 'over') return;
      this._moveTo(x, y);
    };
    if (Render.animatePlayerMove) {
      Render.animatePlayerMove(G.playerX, G.playerY, x, y, done);
    } else {
      done();
    }
  },

  _moveTo(x, y) {
    if (this._isWorldTransitionActive?.() || G.modal || G.combat || G.phase === 'over') return;
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
    if (G.modal || G.combat || G.phase === 'over' || this._isWorldTransitionActive?.()) return;
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
    if (this._applyNightEndErosion()) {
      G.dayTransitionActive = false;
      return;
    }

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
    G.darkMonsterChasesToday = 0;
    this._syncGamblerRerollDisplay();

    const dailyDarkness = G.phase === 'night' ? 2 : 1;
    this._applyDarkness(dailyDarkness, G.phase === 'night' ? '夜晚結束' : '白天結束');
    if (G.phase === 'over') {
      G.dayTransitionActive = false;
      return;
    }
    this._updateDarkMonstersDaily();
    this._maybeSpawnDailyDarkMonster();
    this._respawnRoutedDarkMonsters?.();
    const hasPhaseTransition = (G.day === CONFIG.NIGHT_START_DAY && G.phase === 'day') || G.day >= CONFIG.DAWN_DAY;
    if (!hasPhaseTransition) {
      G.dayTransitionActive = false;
      this._flushSystemModal?.();
      if (this._triggerPendingDarkMonsterChase()) return;
    }

    // 進入黑夜。
    if (G.day === CONFIG.NIGHT_START_DAY && G.phase === 'day') {
      this._enterNight();
      return;
    }
    if (G.day >= CONFIG.DAWN_DAY) {
      G.dayTransitionActive = false;
      this._triggerDawn(); return;
    }

    this._maybeCompleteGuideQuestByFreedom();
    this._log(`第 ${G.day} 天開始。`, 'important');
    G.dayTransitionActive = false;
    this._flushSystemModal?.();
    Render.fullRender();
  },

  _enterNight() {
    G.phase = 'night';
    this._log('黑夜降臨，邊境變得更加危險。', 'night');
    this._log('黑夜結束今天時不再扣生命，但黑暗會更快壯大，並強化最終尾王。', 'night');
    if (typeof this._maybeSpawnUniqueStrongEnemy === 'function') {
      this._maybeSpawnUniqueStrongEnemy();
    }

    this._placeNightRelics();

    Render.fullRender();
    G.nightTransitionActive = true;
    const shouldShowIntro = !G.nightIntroShown;
    const finishNightTransition = () => {
      G.dayTransitionActive = false;
      G.nightTransitionActive = false;
      this._showNightIntroOnce();
      if (!shouldShowIntro) this._triggerPendingDarkMonsterChase?.();
      this._flushSystemModal?.();
      Render.fullRender();
    };
    if (typeof Render.showNightTransition === 'function') {
      Render.showNightTransition(finishNightTransition);
    } else {
      setTimeout(finishNightTransition, 2400);
    }
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
    const guideRelicRequired = this._isGuideRelicAssignmentRequired();
    const choices = [
      { label: '分配聖物', action: () => this._openRelicAssignTargetModal(relic, clearRelic) },
    ];
    if (!guideRelicRequired) {
      choices.push({
        label: '放棄聖物',
        className: 'relic-abandon-choice',
        action: () => {
          this._relicAssignContext = null;
          clearRelic();
          this._log(`放棄聖物「${relic.name}」。`);
          this._closeModal();
        },
      });
    }
    this._openModal({
      title: `發現聖物：${relic.name}`,
      descHtml: this._relicRewardCardHtml(relic, lore),
      typeText: false,
      resultFx: 'event-discover',
      choices,
    });

  },

  _openRelicAssignTargetModal(relic, clearRelic) {
    if (this._maybeShowPreFusionRelicReminder(relic, clearRelic)) return;
    const baseCarriers = relic.scholarOnly
      ? G.squad.filter(c => !c.dead && c.hp > 0 && c.cls === 'scholar')
      : G.squad.filter(c => !c.dead);
    const carriers = baseCarriers.filter(char => this._charMeetsRelicWeaponRequirement(char, relic));
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
          this._onGuideRelicAcquired(relic);
          if (!newly.length && !G.modal) Render.fullRender();
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

    const recommendedCarrierId = this._recommendedRelicCarrierId(relic, assignOptions);
    for (const option of assignOptions) {
      option.recommended = !!recommendedCarrierId && option.char?.id === recommendedCarrierId;
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
    if (!this._isGuideRelicAssignmentRequired()) {
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
    }

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
    const requirementText = this._relicRequirementText?.(this._relicAssignContext?.relic) || '';
    const recommended = assignOptions.find(option => option.recommended)?.char || null;
    const recommendText = recommended ? `建議交給 ${recommended.name}。` : '';
    return `
      <div class="relic-assign-panel">
        <div class="relic-assign-instruction">選擇要交給哪位角色。${recommendText ? `<br>${this._escapeHtmlLocal(recommendText)}` : ''}${requirementText ? `<br>${this._escapeHtmlLocal(requirementText)}。` : ''}</div>
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
      <button type="button" class="relic-assign-target-card${option.currentRelic ? ' replace' : ''}${option.recommended ? ' recommended' : ''}" onclick="Game.chooseRelicAssignTarget(${index})">
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
    this._onGuideRelicAcquired(relic);
    if (!newly.length && !G.modal) Render.fullRender();
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

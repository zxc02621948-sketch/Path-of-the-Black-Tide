// Extracted from js/core/game.js. Keeps the original Game API while making this system easier to maintain.
const GameEventHandlers = {
  _triggerTerrain(cell) {
    this._recordTerrain(cell.type);
    let ev = cell.content?.event;
    if (!ev && cell.content?.eventPending) {
      ev = this._rollTerrainEventForCell(cell);
      if (ev) {
        cell.content.event = ev;
        delete cell.content.eventPending;
      }
    }
    if (!ev) { this._triggerEmptyTerrainSearch(cell); return; }

    if (ev.type === 'echo_site_clue' && !this._isEchoSiteClueStillValid(ev)) {
      ev = this._rerollTerrainEventWithoutEchoSite(cell);
      if (!ev) { this._triggerEmptyTerrainSearch(cell); return; }
      cell.content.event = ev;
    }

    if (!ev.gamblerResolved && this._maybePromptGamblerEventReroll(cell, ev)) return;

    this._dispatchTerrainEvent(cell, ev);
  },

  _maybePromptGamblerEventReroll(cell, ev) {
    const gambler = this._getAvailableGambler();
    if (!gambler || ev.gamblerResolved) return false;
    let resolved = false;

    this._openModal({
      title: '搏命者重擲事件',
      desc: [
        `目前事件：${ev.name}`,
        `今天剩餘重擲：${this._gamblerRerollsLeft()}`,
        '可以接受目前事件，或消耗 1 次重擲重新抽取事件。',
      ].join('\n'),
      choices: [
        {
          label: '接受目前事件',
          action: () => {
            if (resolved) return;
            resolved = true;
            ev.gamblerResolved = true;
            this._closeModal();
            this._triggerTerrain(cell);
          },
        },
        {
          label: '重擲事件',
          action: () => {
            if (resolved) return;
            resolved = true;
            this._spendGamblerReroll();
            const next = this._rollTerrainEventForCell(cell);
            if (!next) {
              this._closeModal();
              this._triggerEmptyTerrainSearch(cell);
              return;
            }
            next.gamblerResolved = true;
            cell.content.event = next;
            delete cell.content.eventPending;
            this._log(`搏命者重擲事件，改為「${next.name}」。`, 'reward');
            this._closeModal();
            this._triggerTerrain(cell);
          },
        },
      ],
    });
    return true;
  },

  _triggerEmptyTerrainSearch(cell) {
    cell.cleared = true;
    delete cell.content?.eventPending;
    const names = { forest: '森林', ruins: '廢墟', cave: '洞穴' };
    const name = names[cell.type] || '地形';
    this._openModal({
      title: `${name}探索`,
      desc: `你們仔細搜索這處${name}，沒有找到值得停留的線索。`,
      resultFx: 'event-quiet',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _dispatchTerrainEvent(cell, ev) {
    cell.cleared = true;
    if (ev.id === 'empty_darkness_seep') { this._triggerDarknessSeep(cell, ev); return; }
    if (ev.id === 'empty_dark_whisper') { this._triggerDarkWhisper(cell, ev); return; }
    if (ev.id === 'empty_old_camp') { this._triggerOldCamp(cell, ev); return; }
    if (ev.id === 'cave_starlight_shard') { this._triggerCaveStarlightShard(ev); return; }
    if (ev.choiceTrap) { this._triggerChoiceTrap(cell, ev); return; }
    if (this._shouldConvertGuideRelicEventToCombat(ev)) {
      this._triggerGuideRelicEventAmbush(cell, ev);
      return;
    }
    switch (ev.type) {
      case 'rescue':     this._triggerRescue(ev);              break;
      case 'supply':     this._triggerSupply(ev);              break;
      case 'forest_forage': this._triggerForestForage(ev);      break;
      case 'trap':       this._triggerTrap(ev);                break;
      case 'note':       this._triggerNote(ev);                break;
      case 'combat':     this._triggerTerrainCombat(cell, ev); break;
      case 'find_relic': this._triggerRandomRelicFind(cell, ev); break;
      case 'fate_table': this._triggerFateGamblingTable(cell, ev); break;
      case 'echo_site_clue': this._triggerEchoSiteClue(cell, ev); break;
      case 'treasure_map': this._triggerTreasureMap(cell, ev); break;
      default:           Render.fullRender();
    }
  },

  _rollTerrainEventForCell(cell) {
    const delayedRelicEvent = this._consumeGuideDelayedRelicEvent(cell);
    if (delayedRelicEvent) return delayedRelicEvent;
    const echoEvent = this._maybeCreateEchoSiteClueEvent();
    if (echoEvent) return echoEvent;
    return this._rerollTerrainEventWithoutEchoSite(cell);
  },

  _shouldConvertGuideRelicEventToCombat(ev) {
    if (!ev || ev.type !== 'find_relic' || ev._guideDelayedRelicCompensation) return false;
    return !!G.guideQuest?.active && G.guideQuest.stage === 'find_relic' && !G.guideQuest.completed;
  },

  _triggerGuideRelicEventAmbush(cell, ev) {
    if (G.guideQuest) {
      G.guideQuest.delayedRelicChoice = true;
      G.guideQuest.relicAmbushTarget = { x: cell.x, y: cell.y };
    }
    const ambushEvent = {
      ...ev,
      id: `${ev.id || 'guide_relic'}_ambush`,
      type: 'combat',
      name: ev.name || '黑暗伏擊',
      desc: `${ev.desc || '你們發現了聖物的氣息。'}\n\n你們還沒來得及確認那件遺物，黑暗中的怪物先撲了出來。`,
      _guideRelicAmbush: true,
    };
    this._log(`${ambushEvent.name}：聖物氣息被黑暗驚動，遭遇怪物。`, 'danger');
    this._triggerTerrainCombat(cell, ambushEvent);
  },

  _consumeGuideDelayedRelicEvent(cell) {
    if (!G.guideQuest?.delayedRelicChoice) return null;
    if (!cell || !['forest', 'ruins', 'cave'].includes(cell.type)) return null;
    if (!this._canFindEventRelic()) return null;
    const pool = typeof EVENT_POOL !== 'undefined' && Array.isArray(EVENT_POOL[cell.type])
      ? EVENT_POOL[cell.type]
      : [];
    const eventState = {
      ...G,
      squadHasRelic: relicId => this._squadHasRelic(relicId),
      relicIdInRun: relicId => this._getRelicIdsInRun().has(relicId),
      canFindEventRelic: () => this._canFindEventRelic(),
    };
    const relicEvent = pool.find(item =>
      item?.type === 'find_relic' &&
      (typeof _eventConditionPass !== 'function' || _eventConditionPass(item, eventState))
    );
    if (!relicEvent) return null;
    G.guideQuest.delayedRelicChoice = false;
    return {
      ...relicEvent,
      rarity: relicEvent.rarity || 'epic',
      categoryRoll: null,
      categoryName: '延後的聖物事件',
      categoryDesc: '先前遭遇戰延後的聖物機會',
      _guideDelayedRelicCompensation: true,
    };
  },

  _rerollTerrainEventWithoutEchoSite(cell) {
    const terrainType = ['forest', 'ruins', 'cave'].includes(cell.type) ? cell.type : 'empty';
    return randomTerrainEvent(terrainType, {
      ...G,
      squadHasRelic: relicId => this._squadHasRelic(relicId),
      relicIdInRun: relicId => this._getRelicIdsInRun().has(relicId),
      canRevealAltarClue: () => this._canRevealAltarClue(),
      canRevealRescueBoss: () => this._canRevealRescueBoss(),
      canFindEventRelic: () => this._canFindEventRelic(),
      canPlaceTreasureChest: () => this._canPlaceTreasureChest(),
    });
  },

  _canRevealAltarClue() {
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (cell?.hiddenSite?.type === 'altar') return true;
        if (cell?.type === 'altar' && cell.altarHidden) return true;
      }
    }
    return false;
  },

  _canRevealRescueBoss() {
    if (!this._needsRescue()) return false;
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (cell?.hiddenSite?.type === 'rescue') return true;
        if (cell?.content?.reward === 'rescue' && !cell.cleared && !cell.rescueRevealed) return true;
      }
    }
    return false;
  },

  _canFindEventRelic() {
    const pool = this._getAvailableRelics(this._relicRewardPoolForPhase(), { ignoreWeaponRequirements: true });
    return pool.length > 0;
  },

  _canPlaceTreasureChest() {
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (!cell || cell.type !== 'empty' || cell.content || cell.hiddenSite || cell.cleared) continue;
        if (cell.x === G.playerX && cell.y === G.playerY) continue;
        return true;
      }
    }
    return false;
  },

  _isEchoSiteClueStillValid(ev) {
    if (!ev || ev.type !== 'echo_site_clue') return true;
    if ((G.activeResonances || []).length > 0) return false;
    if (this._activeEchoSites().length >= (CONFIG.ECHO_SITE_MAX_ACTIVE || 3)) return false;
    if (!this._hasEchoSitePlacementCell()) return false;
    const system = getEchoRelicSystemById(ev.echoSystemId);
    if (!system) return false;
    return !!this._pickEchoSiteRelic(system);
  },

  // Treasure, chest, and fate table event methods live in js/core/event-treasure.js.

  // Combat, rescue, supply, and camp event methods live in js/core/event-encounters.js.

  // Trap event methods live in js/core/event-traps.js.

  // Note and discovery event methods live in js/core/event-notes.js.

  _triggerRandomRelicFind(cell, ev = null) {
    const pool = this._getAvailableRelics(this._relicRewardPoolForPhase(), { ignoreWeaponRequirements: !!ev });
    if (pool.length > 0) {
      if (ev?._guideDelayedRelicCompensation && G.guideQuest) G.guideQuest.delayedRelicChoice = false;
      if (ev) this._log(`${this._eventDiceInline(ev)}${ev.desc}`, 'reward');
      if (ev && pool.length > 1) {
        const choices = this._pickEventRelicChoices(pool);
        this._openEventRelicChoiceModal(cell, ev, choices);
        return;
      }

      const relic = weightedRelicPick(pool);
      if (ev) this._completeProgressEvent(ev);
      cell.type = 'relic';
      cell.content = { relic: { ...relic } };
      cell.cleared = false;
      this._triggerRelic(cell);
    } else {
      cell.cleared = true;
      this._openModal({
        title: '聖物',
        desc: '目前沒有可取得的聖物。',
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
    }
  },

  _pickEventRelicChoices(pool) {
    const first = weightedRelicPick(pool);
    if (!first) return [];
    const firstGroup = this._eventRelicChoiceGroup(first);
    const differentGroupPool = pool.filter(relic =>
      relic?.id !== first.id && this._eventRelicChoiceGroup(relic) !== firstGroup
    );
    const fallbackPool = pool.filter(relic => relic?.id !== first.id);
    const secondPool = differentGroupPool.length > 0 ? differentGroupPool : fallbackPool;
    const second = weightedRelicPick(secondPool);
    return [first, second].filter(Boolean);
  },

  _eventRelicChoiceGroup(relic) {
    const byId = {
      pain_mask: 'wound',
      pain_splinter_badge: 'wound',
      eagle_eye_feather: 'weakness',
      flaw_lens: 'weakness',
      war_banner: 'banner',
      eagle_banner: 'banner',
      lucky_star: 'dice',
      wager_dice: 'dice',
      exorcism_ring: 'dark',
      black_iron_crown: 'dark',
    };
    return byId[relic?.id] || relic?.effect?.type || relic?.id || 'unknown';
  },

  _openEventRelicChoiceModal(cell, ev, relicChoices) {
    G.eventRelicChoiceContext = { cell, ev, relicChoices };
    this._openModal({
      title: ev.name,
      descHtml: `
        <div class="event-relic-choice-intro">
          <p>${this._escapeEventHtml(`${this._eventDiceText(ev)}${ev.desc || ''}`)}</p>
          <p>你們找到兩件殘留聖物，只能帶走其中一件。</p>
        </div>
        <div class="event-relic-choice-grid">
          ${relicChoices.map((relic, index) => this._eventRelicChoiceCardHtml(relic, index)).join('')}
        </div>
      `,
      typeText: false,
      choices: [{ label: '全部放棄', action: () => { G.eventRelicChoiceContext = null; this._completeProgressEvent(ev); this._closeModal(); Render.fullRender(); } }],
    });
  },

  _eventRelicChoiceCardHtml(relic, index) {
    const lore = this._getFirstLore(relic.id);
    const shortDesc = this._shortEventRelicDesc(relic.desc || '');
    const relicClass = String(relic.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
    const locked = !this._squadMeetsRelicWeaponRequirement(relic);
    const requirementText = locked ? this._relicRequirementText(relic) : '';
    const visual = relic.iconImage
      ? `<img class="event-relic-choice-img" src="${this._escapeEventAttr(relic.iconImage)}" alt="">`
      : `<span class="event-relic-choice-emoji">${this._escapeEventHtml(relic.icon || '◆')}</span>`;
    return `
      <button type="button" class="event-relic-choice relic-${relicClass}${locked ? ' locked' : ''}" ${locked ? 'disabled' : `onclick="Game.chooseEventRelicChoice(${index})"`}>
        <span class="event-relic-choice-visual">${visual}</span>
        <span class="event-relic-choice-body">
          <span class="event-relic-choice-kicker">帶走這件聖物</span>
          <span class="event-relic-choice-name">${this._escapeEventHtml(relic.name || '未知聖物')}</span>
          <span class="event-relic-choice-desc">${this._escapeEventHtml(shortDesc)}</span>
          ${locked ? `<span class="event-relic-choice-lock">${this._escapeEventHtml(requirementText)}</span>` : ''}
          ${lore ? `<span class="event-relic-choice-lore">「${this._escapeEventHtml(this._shortEventRelicDesc(lore, 32))}」</span>` : ''}
        </span>
      </button>
    `;
  },

  chooseEventRelicChoice(index) {
    const ctx = G.eventRelicChoiceContext;
    const relic = ctx?.relicChoices?.[index];
    if (!ctx || !relic) return;
    if (!this._squadMeetsRelicWeaponRequirement(relic)) return;
    this._claimEventRelicChoice(ctx.cell, ctx.ev, relic);
  },

  _shortEventRelicDesc(text, limit = 48) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
  },

  _escapeEventHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  },

  _escapeEventAttr(value) {
    return this._escapeEventHtml(value).replace(/`/g, '&#96;');
  },

  _previewEventRelicChoice(cell, ev, relicChoices, relic) {
    const lore = this._getFirstLore(relic.id);
    this._openModal({
      title: relic.name,
      titleHtml: EquipmentIcon.label(relic, 'equipment-inline-icon relic-detail-icon'),
      desc: `效果：${relic.desc}${lore ? `\n\n「${lore}」` : ''}`,
      choices: [
        { label: `拿取「${relic.name}」`, action: () => this._claimEventRelicChoice(cell, ev, relic) },
        { label: '返回選擇', action: () => this._openEventRelicChoiceModal(cell, ev, relicChoices) },
      ],
    });
  },

  _claimEventRelicChoice(cell, ev, relic) {
    this._completeProgressEvent(ev);
    cell.type = 'relic';
    cell.content = { relic: { ...relic } };
    cell.cleared = false;
    this._triggerRelic(cell);
  },

  _eventDiceText(ev) {
    return '';
  },

  _eventDiceInline(ev) {
    return '';
  },

  _rarityLabel(rarity) {
    return ({ common: '普通', rare: '稀有', epic: '史詩', legendary: '傳說' })[rarity] || rarity || '事件';
  },

  _awardDarknessOverflowTreasure(ev, overflow) {
    if (overflow <= 0) return '';
    const kind = overflow >= 2 ? 'weapon' : 'broken';
    const rewardName = kind === 'weapon' ? '完整藏寶圖' : '殘破藏寶圖';
    const chestCell = this._placeTreasureChestRandom(kind);
    if (chestCell) {
      const source = ev?.name || '淨化事件';
      const text = kind === 'weapon'
        ? `你們身上已無黑暗纏繞，光明餘燼在灰燼中重新聚成路標，指向一處完整藏寶圖標記。`
        : `你們身上已無黑暗纏繞，少量光明餘燼沒有散去，而是指向一處殘破藏寶圖標記。`;
      this._log(`${source}：光明餘燼指向${rewardName}線索 (${chestCell.x},${chestCell.y})。`, 'reward');
      return `\n\n${text} 寶箱位置：(${chestCell.x},${chestCell.y})。`;
    }

    const healed = this._healAliveSquad(1, false);
    this._log(healed.length > 0
      ? `${ev?.name || '淨化事件'}：沒有合適藏寶點，溢出的淨化力量改為全隊恢復 1 HP。`
      : `${ev?.name || '淨化事件'}：沒有合適藏寶點。`,
      healed.length > 0 ? 'reward' : 'dim');
    return healed.length > 0
      ? '\n\n沒有合適位置可標記寶箱，溢出的淨化力量改為全隊恢復 1 HP。'
      : '\n\n沒有合適位置可標記寶箱。';
  },

  _applyDarknessReductionWithOverflow(ev, amount, reason = '') {
    const current = Math.max(0, G.darkness || 0);
    const actual = Math.min(current, Math.max(0, amount));
    const overflow = Math.max(0, amount - actual);
    if (actual > 0) this._applyDarkness(-actual, reason || ev?.name || '淨化');
    return {
      actual,
      overflow,
      text: this._awardDarknessOverflowTreasure(ev, overflow),
    };
  },

  _resolveProgressEventForModal(ev, fallbackDelta = undefined) {
    let delta = this._progressEventDelta(ev, fallbackDelta);
    if (typeof delta !== 'number' || delta === 0) return { text: '', dice: null };

    if (delta < 0) {
      const roll = Dice.rollRaw();
      const success = roll >= 4;
      const amount = ev.purificationRoll && roll === 6 ? 2 : Math.abs(delta);
      if (success) {
        const reduction = this._applyDarknessReductionWithOverflow(ev, amount, `${ev.name} 淨化`);
        this._log(`${ev.name} 降低黑暗判定成功：黑暗 -${reduction.actual}。`, 'reward');
        return {
          text: `\n\n降低黑暗判定：${Dice.face(roll)}（${roll}），成功，黑暗 -${reduction.actual}。${reduction.text.replace(/^\n\n/, '')}`,
          dice: { type: 'neutral', label: '淨化骰', value: roll, raw: roll },
        };
      }
      this._log(`${ev.name} 降低黑暗判定失敗：黑暗不變。`, 'dim');
      return {
        text: `\n\n降低黑暗判定：${Dice.face(roll)}（${roll}），失敗，黑暗不變。`,
        dice: { type: 'danger', label: '淨化骰', value: roll, raw: roll },
      };
    }

    // Section.
    return { text: '', dice: null };
  },

  _completeProgressEvent(ev, fallbackDelta = undefined) {
    let delta = this._progressEventDelta(ev, fallbackDelta);
    if (typeof delta !== 'number' || delta === 0) return;
    if (delta < 0) {
      this._rollDarknessReduction(ev, delta);
      return;
    }
    this._applyDarkness(delta, ev.name || '事件');
  },

  _rollDarknessReduction(ev, delta) {
    const roll = Dice.rollRaw();
    const success = roll >= 4;
    const amount = ev.purificationRoll && roll === 6 ? 2 : Math.abs(delta);
    if (success) {
      this._log(`${ev.name} 降低黑暗判定成功：擲出 ${Dice.face(roll)}（${roll}）。`, 'reward');
      const reduction = this._applyDarknessReductionWithOverflow(ev, amount, `${ev.name} 淨化`);
      this._log(`黑暗降低 ${reduction.actual}。`, 'reward');
      return true;
    }
    this._log(`${ev.name} 降低黑暗判定失敗：擲出 ${Dice.face(roll)}（${roll}），黑暗不變。`, 'dim');
    return false;
  },
};

Object.assign(Game, GameEventHandlers);

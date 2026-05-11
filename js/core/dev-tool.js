// Extracted from js/core/game.js. Keeps the original object API while making this system easier to maintain.
const GameDevTool = {
  openDevTool() {
    if (G.phase === 'over') return;
    if (this._aliveSquad().length === 0) return;
    this._openModal({
      title: '測試工具',
      desc: '自由新增測試用資源。這裡不會消耗行動，也不會檢查掉落限制。',
      choices: [
        { label: '給角色一般聖物', action: () => this._devChooseRelicSlot('relic') },
        { label: '給角色融合聖物', action: () => this._devChooseRelicSlot('fusedRelic') },
        { label: '啟動共鳴', action: () => this._devChooseResonance() },
        { label: '替換角色武器', action: () => this._devChooseWeapon() },
        { label: '替換角色裝備', action: () => this._devChooseGear() },
        { label: '指定怪物戰鬥', action: () => this._devChooseEnemyCombat() },
        { label: '指定觸發事件', action: () => this._devChooseEventTerrain() },
        { label: '調整隊伍狀態', action: () => this._devOpenSquadStateTool() },
        { label: '關閉', action: () => this._closeModal() },
      ],
    });
  },

  _devChooseRelicSlot(slot) {
    const relics = (typeof RELICS !== 'undefined' ? RELICS : []).filter(Boolean);
    const title = slot === 'fusedRelic' ? '測試工具：選擇融合聖物' : '測試工具：選擇一般聖物';
    this._openModal({
      title,
      desc: '選擇要新增的聖物。',
      choices: relics.map(relic => ({
        label: `${relic.icon} ${relic.name}`,
        detail: relic.desc,
        action: () => this._devChooseRelicTarget(relic, slot),
      })).concat([{ label: '返回', action: () => this.openDevTool() }]),
    });
  },

  _devChooseRelicTarget(relic, slot) {
    this._openModal({
      title: `測試工具：${relic.name}`,
      desc: `${relic.desc}\n\n選擇要交給哪位角色。`,
      choices: this._aliveSquad().map(char => ({
        label: `${char.name}${slot === 'fusedRelic' ? '（融合欄）' : '（一般欄）'}`,
        action: () => this._devGrantRelic(char, relic, slot),
      })).concat([{ label: '返回', action: () => this._devChooseRelicSlot(slot) }]),
    });
  },

  _devGrantRelic(char, relic, slot) {
    if (!char || !relic) return;
    const equipped = this._devEquipRelicToSlot(char, relic, slot);
    if (equipped) this._log(`測試工具：${char.name} 獲得${slot === 'fusedRelic' ? '融合聖物' : '聖物'}「${equipped.name}」。`, 'reward');
    this._closeModal();
    const newly = this._updateResonances({ announceModal: true });
    if (!newly.length) Render.fullRender();
  },

  _devEquipRelicToSlot(char, relic, slot) {
    if (!char || !relic) return null;
    if (slot === 'fusedRelic') {
      if (char.fusedRelic) this._removeFusionBonus(char, char.fusedRelic);
      const fusedRelic = { ...relic };
      if (fusedRelic.fusedEffect) fusedRelic.effect = { ...fusedRelic.fusedEffect };
      char.fusedRelic = fusedRelic;
      this._applyFusionBonus(char, fusedRelic);
      this._unlockNote(fusedRelic.id, true);
      return fusedRelic;
    }
    if (char.relic) this._removeRelicEffect(char, char.relic);
    char.relic = { ...relic };
    this._applyRelicEquip(char, char.relic);
    this._unlockNote(relic.id, true);
    return char.relic;
  },

  _devChooseResonance() {
    const choices = this._devResonanceOptions().map(option => ({
      label: option.name,
      detail: option.desc,
      action: () => this._devChooseResonanceTarget(option),
    }));
    this._openModal({
      title: '測試工具：啟動共鳴',
      desc: '選擇要直接啟動的共鳴，測試工具會自動把對應聖物放到角色的一般欄與融合欄。',
      choices: choices.concat([{ label: '返回', action: () => this.openDevTool() }]),
    });
  },

  _devResonanceOptions() {
    const options = [];
    for (const res of (typeof RESONANCES !== 'undefined' ? RESONANCES : [])) {
      const [firstRelicId, secondRelicId] = res.relics || [];
      if (!firstRelicId || !secondRelicId) continue;
      const fusedRelicId = res.bodyRequiresFused || firstRelicId;
      const carriedRelicId = fusedRelicId === firstRelicId ? secondRelicId : firstRelicId;
      options.push({
        id: res.id,
        name: res.name,
        desc: res.desc || res.bodyEffect?.desc || '',
        fusedRelicId,
        carriedRelicId,
      });
    }
    options.push(
      {
        id: 'dodeca_fate_dice',
        name: '十二面命運骰',
        desc: '融合賭命骰子，攜帶幸運星，讓該角色的攻擊骰改為 1d12。',
        fusedRelicId: 'wager_dice',
        carriedRelicId: 'lucky_star',
      },
      {
        id: 'dodeca_lucky_dice',
        name: '十二面幸運骰',
        desc: '融合幸運星，攜帶賭命骰子，讓該角色的攻擊骰改為 1d12，且不會命中原生弱點。',
        fusedRelicId: 'lucky_star',
        carriedRelicId: 'wager_dice',
      },
      {
        id: 'star_hunter_eye',
        name: '獵星之眼',
        desc: '融合鷹眼羽飾，攜帶鷹眼透鏡；每次弓攻擊前可補上鷹眼暫時原生弱點。',
        fusedRelicId: 'eagle_eye_feather',
        carriedRelicId: 'flaw_lens',
      },
      {
        id: 'star_breaker_eye',
        name: '裂星破滅',
        desc: '融合鷹眼透鏡，攜帶鷹眼羽飾。',
        fusedRelicId: 'flaw_lens',
        carriedRelicId: 'eagle_eye_feather',
      },
      {
        id: 'dual_banner_formation',
        name: '雙旗陣',
        desc: '融合戰旗，攜帶鷹旗。',
        fusedRelicId: 'war_banner',
        carriedRelicId: 'eagle_banner',
      },
    );
    return options.filter(option => this._devRelicById(option.fusedRelicId) && this._devRelicById(option.carriedRelicId));
  },

  _devChooseResonanceTarget(option) {
    const fusedRelic = this._devRelicById(option.fusedRelicId);
    const carriedRelic = this._devRelicById(option.carriedRelicId);
    if (!fusedRelic || !carriedRelic) return;
    this._openModal({
      title: `測試工具：${option.name}`,
      desc: `融合欄：${fusedRelic.name}\n一般欄：${carriedRelic.name}\n\n選擇要套用到哪位角色。`,
      choices: this._aliveSquad().map(char => ({
        label: char.name,
        action: () => this._devActivateResonance(char, option),
      })).concat([{ label: '返回', action: () => this._devChooseResonance() }]),
    });
  },

  _devActivateResonance(char, option) {
    if (!char || !option) return;
    const fusedRelic = this._devRelicById(option.fusedRelicId);
    const carriedRelic = this._devRelicById(option.carriedRelicId);
    if (!fusedRelic || !carriedRelic) return;
    const equippedFused = this._devEquipRelicToSlot(char, fusedRelic, 'fusedRelic');
    const equippedCarried = this._devEquipRelicToSlot(char, carriedRelic, 'relic');
    this._log(`測試工具：${char.name} 啟動共鳴「${option.name}」（融合 ${equippedFused.name}，攜帶 ${equippedCarried.name}）。`, 'reward');
    this._closeModal();
    const newly = this._updateResonances({ announceModal: true });
    if (!newly.length) Render.fullRender();
  },

  _devRelicById(id) {
    return (typeof RELICS !== 'undefined' ? RELICS : []).find(relic => relic?.id === id) || null;
  },

  _devChooseWeapon() {
    const weapons = (typeof WEAPONS !== 'undefined' ? WEAPONS : []).filter(Boolean);
    this._openModal({
      title: '測試工具：選擇武器',
      desc: '選擇要新增的武器。',
      choices: weapons.map(weapon => ({
        label: `${weapon.icon} ${weapon.name}`,
        detail: weapon.desc,
        action: () => this._devChooseWeaponTarget(weapon),
      })).concat([{ label: '返回', action: () => this.openDevTool() }]),
    });
  },

  _devChooseWeaponTarget(weapon) {
    this._openModal({
      title: `測試工具：${weapon.name}`,
      desc: `${weapon.desc}\n\n選擇要裝備的角色。`,
      choices: this._aliveSquad().map(char => ({
        label: `${char.name}${char.weapon ? `（替換 ${char.weapon.name}）` : ''}`,
        action: () => {
          char.weapon = { ...weapon };
          this._log(`測試工具：${char.name} 裝備武器「${weapon.name}」。`, 'reward');
          this._closeModal();
          Render.fullRender();
        },
      })).concat([{ label: '返回', action: () => this._devChooseWeapon() }]),
    });
  },

  _devChooseGear() {
    const gears = (typeof GEARS !== 'undefined' ? GEARS : []).filter(Boolean);
    this._openModal({
      title: '測試工具：選擇裝備',
      desc: '選擇要新增的角色裝備。',
      choices: gears.map(gear => ({
        label: `${gear.icon} ${gear.name}`,
        detail: gear.desc,
        action: () => this._devChooseGearTarget(gear),
      })).concat([{ label: '返回', action: () => this.openDevTool() }]),
    });
  },

  _devChooseGearTarget(gear) {
    this._openModal({
      title: `測試工具：${gear.name}`,
      desc: `${gear.desc}\n\n選擇要裝備的角色。`,
      choices: this._aliveSquad().map(char => ({
        label: `${char.name}${char.gear ? `（替換 ${char.gear.name}）` : ''}`,
        action: () => {
          char.gear = { ...gear };
          this._log(`測試工具：${char.name} 裝備「${gear.name}」。`, 'reward');
          this._closeModal();
          Render.fullRender();
        },
      })).concat([{ label: '返回', action: () => this._devChooseGear() }]),
    });
  },

  _devChooseEnemyCombat() {
    const enemies = (typeof ENEMIES !== 'undefined' ? ENEMIES : []).filter(Boolean);
    const choices = enemies.map(enemy => {
      const resolved = this._devResolveEnemyForCombat(enemy);
      return {
        label: `${resolved.icon || ''} ${resolved.name}`,
        detail: this._devEnemyCombatDetail(resolved),
        action: () => this._devStartEnemyCombat(resolved),
      };
    });

    if (typeof this._darkMonsterEnemy === 'function') {
      for (const level of [5, 10, 15]) {
        const darkEnemy = this._darkMonsterEnemy({ id: `dev_${level}`, level }, { activeHunt: false });
        choices.push({
          label: `${darkEnemy.icon || ''} ${darkEnemy.name}`,
          detail: this._devEnemyCombatDetail(darkEnemy),
          action: () => this._devStartEnemyCombat(darkEnemy, {
            source: 'devDarkMonster',
            darkMonsterId: `dev_${level}`,
          }),
        });
      }
    }

    this._openModal({
      title: '測試工具：指定怪物戰鬥',
      desc: '選擇一個怪物直接進入測試戰鬥。測試戰鬥不消耗行動，也不會結算地圖格獎勵。',
      choices: choices.concat([{ label: '返回', action: () => this.openDevTool() }]),
    });
  },

  _devResolveEnemyForCombat(enemy) {
    if (enemy?.tiers && typeof resolveEnemyTier === 'function') {
      return resolveEnemyTier(enemy, G.day || 1);
    }
    return { ...enemy };
  },

  _devEnemyCombatDetail(enemy) {
    const tags = [];
    if (enemy.darkMonster) tags.push('黑暗怪');
    if (enemy.boss || enemy.rescueBoss || enemy.erosionBoss || enemy.treasureMimic) tags.push('特殊怪');
    if (enemy.nightOnly) tags.push('夜晚限定');
    const tagText = tags.length ? `｜${tags.join('、')}` : '';
    return `HP ${enemy.hp}／攻擊 ${enemy.attack}／格檔 ${enemy.block || 0}／原生弱點 ${enemy.weakness}${tagText}`;
  },

  _devStartEnemyCombat(enemy, opts = {}) {
    if (!enemy) return;
    const reward = enemy.treasureMimic ? 'treasure_mimic' : null;
    const cell = {
      type: 'enemy',
      cleared: false,
      content: { enemy: { ...enemy } },
    };
    if (reward) cell.content.reward = reward;
    this._log(`測試工具：開始與「${enemy.name}」戰鬥。`, 'info');
    this._triggerCombat(cell, { source: opts.source || 'devTest', darkMonsterId: opts.darkMonsterId || null });
  },

  _devChooseEventTerrain() {
    const terrainChoices = [
      { key: 'forest', label: '森林事件' },
      { key: 'ruins', label: '遺跡事件' },
      { key: 'cave', label: '洞穴事件' },
      { key: 'empty', label: '空地事件' },
    ];
    this._openModal({
      title: '測試工具：指定觸發事件',
      desc: '選擇事件類型。測試事件會走正式事件流程，但不需要真的踩到對應地形。',
      choices: terrainChoices.map(entry => ({
        label: entry.label,
        action: () => this._devChooseEvent(entry.key, entry.label),
      })).concat([{ label: '返回', action: () => this.openDevTool() }]),
    });
  },

  _devChooseEvent(terrainType, terrainLabel) {
    const events = this._devEventsForTerrain(terrainType);
    this._openModal({
      title: `測試工具：${terrainLabel}`,
      desc: '選擇要直接觸發的事件。',
      choices: events.map(ev => ({
        label: `${ev.name}（${this._devEventTypeLabel(ev)}）`,
        detail: ev.desc || '',
        action: () => this._devTriggerEvent(terrainType, ev),
      })).concat([{ label: '返回', action: () => this._devChooseEventTerrain() }]),
    });
  },

  _devEventsForTerrain(terrainType) {
    const pool = (typeof EVENT_POOL !== 'undefined' && EVENT_POOL[terrainType])
      ? EVENT_POOL[terrainType]
      : [];
    const events = pool.map(ev => this._devDecorateEvent(ev));
    if (terrainType === 'empty' && typeof createFateGamblingTableEvent === 'function') {
      events.push(this._devDecorateEvent(createFateGamblingTableEvent()));
    }
    return events;
  },

  _devDecorateEvent(ev) {
    if (typeof _decorateEvent === 'function') return _decorateEvent(ev, ev.rarity || 'common');
    return { ...ev, rarity: ev.rarity || 'common' };
  },

  _devEventTypeLabel(ev) {
    const map = {
      rescue: '救援',
      supply: '補給',
      trap: '陷阱',
      note: '線索',
      combat: '戰鬥',
      find_relic: '聖物',
      fate_table: '命運賭桌',
      treasure_map: '藏寶圖',
    };
    return map[ev.type] || ev.type || '事件';
  },

  _devTriggerEvent(terrainType, ev) {
    const cell = {
      x: G.playerX,
      y: G.playerY,
      type: terrainType,
      cleared: false,
      content: { event: { ...ev, gamblerResolved: true } },
    };
    this._log(`測試工具：觸發事件「${ev.name}」。`, 'info');
    this._dispatchTerrainEvent(cell, cell.content.event);
  },

  _devOpenSquadStateTool() {
    this._openModal({
      title: '測試工具：調整隊伍狀態',
      desc: '快速恢復隊伍，或指定角色倒下，用來測試救援、死亡掉落與低血量流程。',
      choices: [
        { label: '全隊恢復至滿血', action: () => this._devRestoreSquad() },
        { label: '指定角色恢復至滿血', action: () => this._devChooseRestoreCharacter() },
        { label: '指定角色倒下', danger: true, action: () => this._devChooseKillCharacter() },
        { label: '返回', action: () => this.openDevTool() },
      ],
    });
  },

  _devRestoreSquad() {
    for (const char of G.squad || []) {
      char.dead = false;
      char.deathLocation = null;
      char.hp = char.maxHp;
    }
    this._log('測試工具：全隊恢復至滿血。', 'reward');
    this._closeModal();
    this._updateResonances();
    Render.fullRender();
  },

  _devChooseRestoreCharacter() {
    this._openModal({
      title: '測試工具：指定恢復',
      desc: '選擇要恢復至滿血的角色。倒下角色也會被救起。',
      choices: (G.squad || []).map(char => ({
        label: `${char.name}（${char.dead ? '倒下' : `${char.hp}/${char.maxHp} HP`}）`,
        action: () => this._devRestoreCharacter(char),
      })).concat([{ label: '返回', action: () => this._devOpenSquadStateTool() }]),
    });
  },

  _devRestoreCharacter(char) {
    if (!char) return;
    char.dead = false;
    char.deathLocation = null;
    char.hp = char.maxHp;
    this._log(`測試工具：${char.name} 恢復至滿血。`, 'reward');
    this._closeModal();
    this._updateResonances();
    Render.fullRender();
  },

  _devChooseKillCharacter() {
    const candidates = (G.squad || []).filter(char => !char.dead);
    this._openModal({
      title: '測試工具：指定倒下',
      desc: '選擇要指定倒下的角色。這會觸發正式死亡處理，包含聖物掉落與融合失效。',
      choices: candidates.map(char => ({
        label: `${char.name}（${char.hp}/${char.maxHp} HP）`,
        danger: true,
        action: () => this._devKillCharacter(char),
      })).concat([{ label: '返回', action: () => this._devOpenSquadStateTool() }]),
    });
  },

  _devKillCharacter(char) {
    if (!char || char.dead) return;
    this._markCharDead(char);
    this._log(`測試工具：指定 ${char.name} 倒下。`, 'danger');
    this._closeModal();
    if (this._checkLose()) return;
    Render.fullRender();
  },
};

Object.assign(Game, GameDevTool);

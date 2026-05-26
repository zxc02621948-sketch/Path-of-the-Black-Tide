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
        { label: '效果演出測試', action: () => this._devOpenEffectTool() },
        { label: '直接開始神壇', action: () => this._devStartAltar() },
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
        label: relic.name,
        labelHtml: EquipmentIcon.label(relic, 'equipment-inline-icon relic-detail-icon'),
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
    this._openModal({
      title: '測試工具：指定怪物戰鬥',
      desc: '選擇怪物分類。弱型與中型可以指定階段強度，測試戰鬥不消耗行動，也不會結算地圖格獎勵。',
      choices: [
        { label: '弱型怪物', action: () => this._devChooseEnemyCombatCategory('weak') },
        { label: '中型怪物', action: () => this._devChooseEnemyCombatCategory('medium') },
        { label: '強型怪物', action: () => this._devChooseEnemyCombatCategory('strong') },
        { label: '頭目怪物', action: () => this._devChooseEnemyCombatCategory('boss') },
        { label: '傷害測試木樁', action: () => this._devStartTrainingDummyCombat() },
        { label: '尾王測試', action: () => this._devChooseFinalBossCombat() },
        { label: '聖物守護者', action: () => this._devChooseEnemyCombatCategory('echo') },
        { label: '黑匣擬態', action: () => this._devChooseEnemyCombatCategory('dark_gift') },
        { label: '黑暗化身', action: () => this._devChooseEnemyCombatCategory('dark') },
        { label: '返回', action: () => this.openDevTool() },
      ],
    });
  },

  _devChooseEnemyCombatCategory(category) {
    if (category === 'dark') {
      this._devChooseDarkMonsterCombat();
      return;
    }
    const enemies = this._devEnemiesForCategory(category);
    const labels = {
      weak: '弱型怪物',
      medium: '中型怪物',
      strong: '強型怪物',
      boss: '頭目怪物',
      echo: '聖物守護者',
      dark_gift: '黑匣擬態',
    };
    if (enemies.length === 0) {
      this._openModal({
        title: `測試工具：${labels[category] || '怪物'}`,
        desc: '目前沒有這個分類的怪物。',
        choices: [{ label: '返回', action: () => this._devChooseEnemyCombat() }],
      });
      return;
    }
    this._openModal({
      title: `測試工具：${labels[category] || '怪物'}`,
      desc: '選擇要測試的怪物。',
      choices: enemies.map(enemy => {
        const preview = this._devResolveEnemyForCombat(enemy, 0);
        return {
          label: `${preview.icon || ''} ${enemy.tiers?.[0]?.name || preview.name || enemy.id}`,
          detail: this._devEnemyCombatDetail(preview),
          action: () => this._devChooseEnemyCombatStrength(enemy, category),
        };
      }).concat([{ label: '返回', action: () => this._devChooseEnemyCombat() }]),
    });
  },

  _devEnemiesForCategory(category) {
    const enemies = (typeof ENEMIES !== 'undefined' ? ENEMIES : []).filter(Boolean);
    if (category === 'weak') return enemies.filter(enemy => enemy.tier === 'weak' && !enemy.boss);
    if (category === 'medium') return enemies.filter(enemy => enemy.tier === 'medium' && !enemy.boss);
    if (category === 'strong') return enemies.filter(enemy => enemy.tier === 'strong' && !enemy.boss);
    if (category === 'echo') return enemies.filter(enemy => enemy.echoGuardian);
    if (category === 'dark_gift') return enemies.filter(enemy => enemy.darkGiftMimic);
    if (category === 'boss') {
      return enemies.filter(enemy =>
        (enemy.boss || enemy.rescueBoss || enemy.treasureMimic) &&
        !enemy.echoGuardian &&
        !enemy.darkGiftMimic &&
        !enemy.devOnly
      );
    }
    return [];
  },

  _devStartTrainingDummyCombat() {
    const dummy = typeof getEnemyById === 'function'
      ? getEnemyById('training_dummy')
      : (typeof ENEMIES !== 'undefined' ? ENEMIES.find(enemy => enemy?.id === 'training_dummy') : null);
    if (!dummy) {
      this._openModal({
        title: '測試工具：傷害測試木樁',
        desc: '找不到測試木樁資料。',
        choices: [{ label: '返回', action: () => this._devChooseEnemyCombat() }],
      });
      return;
    }
    this._devStartEnemyCombat({ ...dummy }, { source: 'devTest' });
  },

  _devChooseEnemyCombatStrength(enemy, category) {
    const tierCount = Array.isArray(enemy?.tiers) ? enemy.tiers.length : 0;
    if (tierCount <= 0) {
      const resolved = this._devResolveEnemyForCombat(enemy);
      this._devStartEnemyCombat(resolved);
      return;
    }
    this._openModal({
      title: `測試工具：${enemy.tiers?.[0]?.name || enemy.name}`,
      desc: '選擇要測試的階段強度。',
      choices: enemy.tiers.map((tier, index) => {
        const resolved = this._devResolveEnemyForCombat(enemy, index);
        return {
          label: `第 ${index + 1} 階：${tier.name}`,
          detail: this._devEnemyCombatDetail(resolved),
          action: () => this._devStartEnemyCombat(resolved),
        };
      }).concat([{ label: '返回', action: () => this._devChooseEnemyCombatCategory(category) }]),
    });
  },

  _devChooseDarkMonsterCombat() {
    if (typeof this._darkMonsterEnemy !== 'function') {
      this._openModal({
        title: '測試工具：黑暗化身',
        desc: '目前無法建立黑暗化身。',
        choices: [{ label: '返回', action: () => this._devChooseEnemyCombat() }],
      });
      return;
    }
    const levels = [5, 10, 15];
    this._openModal({
      title: '測試工具：黑暗化身',
      desc: '選擇黑暗化身強度。',
      choices: levels.map(level => {
        const darkEnemy = this._darkMonsterEnemy({ id: `dev_${level}`, level }, { activeHunt: false });
        return {
          label: `黑暗 ${level}：${darkEnemy.icon || ''} ${darkEnemy.name}`,
          detail: this._devEnemyCombatDetail(darkEnemy),
          action: () => this._devStartEnemyCombat(darkEnemy, {
            source: 'devDarkMonster',
            darkMonsterId: `dev_${level}`,
          }),
        };
      }).concat([{ label: '返回', action: () => this._devChooseEnemyCombat() }]),
    });
  },

  _devChooseFinalBossCombat() {
    const levels = [10, 15, 19];
    this._openModal({
      title: '測試工具：尾王測試',
      desc: '選擇黑暗值。尾王會依黑暗增加生命與攻擊，測試戰鬥不會結算通關。',
      choices: levels.map(level => {
        const boss = typeof getFinalBossEnemy === 'function' ? getFinalBossEnemy(level) : null;
        return {
          label: `黑暗 ${level}：${boss?.icon || ''} ${boss?.name || '夜幕之瞳'}`,
          detail: boss ? this._devEnemyCombatDetail(boss) : '找不到尾王資料',
          action: () => {
            if (!boss) return;
            this._devStartEnemyCombat(boss, { source: 'devTest' });
          },
        };
      }).concat([{ label: '返回', action: () => this._devChooseEnemyCombat() }]),
    });
  },

  _devResolveEnemyForCombat(enemy, tierIndex = null) {
    if (enemy?.darkGiftMimic && typeof getDarkGiftMimicEnemy === 'function') return getDarkGiftMimicEnemy();
    if (enemy?.tiers) {
      const index = Number.isInteger(tierIndex)
        ? Math.max(0, Math.min(enemy.tiers.length - 1, tierIndex))
        : Math.min(enemy.tiers.length - 1, Math.floor(((G.day || 1) - 1) / (enemy.tierUpDays || 1)));
      return { ...enemy, ...enemy.tiers[index], tiers: undefined, devTierIndex: index };
    }
    return { ...enemy };
  },

  _devEnemyCombatDetail(enemy) {
    const tags = [];
    if (enemy.darkMonster) tags.push('黑暗化身');
    if (enemy.boss || enemy.rescueBoss || enemy.treasureMimic || enemy.darkGiftMimic) tags.push('特殊怪');
    if (enemy.nightOnly) tags.push('夜晚限定');
    const tagText = tags.length ? `｜${tags.join('、')}` : '';
    const weaknessText = Number.isFinite(enemy.weakness) ? enemy.weakness : (enemy.finalBoss ? '開眼顯現' : '無');
    return `HP ${enemy.hp}／攻擊 ${enemy.attack}／原生弱點 ${weaknessText}${tagText}`;
  },

  _devStartEnemyCombat(enemy, opts = {}) {
    if (!enemy) return;
    const reward = enemy.darkGiftMimic ? 'dark_gift_mimic' : (enemy.treasureMimic ? 'treasure_mimic' : null);
    const cell = {
      type: 'enemy',
      cleared: false,
      content: { enemy: { ...enemy } },
    };
    if (reward) cell.content.reward = reward;
    this._log(`測試工具：開始與「${enemy.name}」戰鬥。`, 'info');
    this._triggerCombat(cell, { source: opts.source || 'devTest', darkMonsterId: opts.darkMonsterId || null });
  },

  _devStartAltar() {
    const cell = {
      type: 'altar',
      cleared: false,
      content: null,
      altarUsedDay: null,
    };
    this._log('測試工具：開啟神壇。', 'info');
    this._triggerAltar(cell);
  },

  _devOpenEffectTool() {
    this._openModal({
      title: '測試工具：效果演出',
      desc: '選擇要預覽的演出。戰鬥演出會開啟假戰鬥場景，播放期間也可以直接關閉。',
      typeText: false,
      choices: [
        { label: '戰鬥演出', action: () => this._devChooseCombatEffect() },
        { label: '事件演出', action: () => this._devChooseEventEffect() },
        { label: '返回', action: () => this.openDevTool() },
      ],
    });
  },

  _devChooseCombatEffect() {
    const options = this._devCombatEffectOptions();
    this._openModal({
      title: '測試工具：戰鬥演出',
      desc: '選擇要在假戰鬥畫面中播放的效果。',
      typeText: false,
      choices: options.map(option => ({
        label: option.name,
        detail: option.detail || '',
        action: () => this._devPreviewCombatEffect(option.id),
      })).concat([{ label: '返回', action: () => this._devOpenEffectTool() }]),
    });
  },

  _devCombatEffectOptions() {
    return [
      { id: 'bow', name: '弓射擊', detail: '一般弓箭飛行與命中。', weaponFamily: 'bow', attackTrail: 'pierce', hitEffect: 'pierce', damage: 5 },
      { id: 'sword', name: '劍攻擊', detail: '劍系斬擊 sprite。', weaponFamily: 'sword', attackTrail: 'slash', hitEffect: 'slash', damage: 6 },
      { id: 'dagger', name: '匕首攻擊', detail: '匕首斬擊 sprite。', weaponFamily: 'dagger', attackTrail: 'slash', hitEffect: 'slash', damage: 5 },
      { id: 'silver_bee_pin', name: '銀蜂針', detail: '銀蜂針共鳴射擊。', weaponFamily: 'sword', attackTrail: 'slash', hitEffect: 'slash', relicFx: 'silver_bee_pin', damage: 6 },
      { id: 'iron_scabbard', name: '沉鐵劍鞘', detail: '重擊命中與持有者強化。', weaponFamily: 'sword', attackTrail: 'slash', hitEffect: 'slash', relicFx: 'iron_scabbard', damage: 8 },
      { id: 'star_hunter_eye', name: '獵星之眼', detail: '弓箭先命中，準星再啟動。', weaponFamily: 'bow', attackTrail: 'pierce', hitEffect: 'pierce', relicFx: 'star_hunter_eye', damage: 7 },
      { id: 'star_breaker', name: '裂星破滅', detail: '弓箭命中後觸發裂星爆破與重擊。', weaponFamily: 'bow', attackTrail: 'pierce', hitEffect: 'pierce', relicFx: 'star_breaker', damage: 12 },
      { id: 'wound_burst', name: '痛痕傷口爆發', detail: '傷口引爆 hitEffect。', weaponFamily: 'sword', hitEffect: 'wound-burst', damage: 10 },
      { id: 'eagle_mark', name: '命中原生弱點', detail: '弱點命中標記。', weaponFamily: 'bow', attackTrail: 'pierce', hitEffect: 'eagle-mark', damage: 6 },
    ];
  },

  _devPreviewCombatEffect(effectId) {
    const option = this._devCombatEffectOptions().find(item => item.id === effectId);
    if (!option) return;
    const combat = this._devEffectCombatScene(option);
    const attackerId = combat.attackerId;
    const damage = Math.max(1, option.damage || 6);
    const enemyHp = combat.enemy.hp;
    const damageEvent = {
      type: 'primary',
      damage,
      from: enemyHp,
      to: Math.max(0, enemyHp - damage),
      attackTrail: option.attackTrail || option.hitEffect || 'strike',
      hitEffect: option.hitEffect || option.attackTrail || 'strike',
      relicFx: option.relicFx || '',
    };
    this._openModal({
      title: `效果演出：${option.name}`,
      desc: option.detail || '戰鬥演出預覽。',
      typeText: false,
      combat,
      combatAnims: {
        delay: 120,
        lockActions: false,
        playerAttacker: attackerId,
        playerFollowHits: 1,
        playerDamageEvents: [damageEvent],
      },
      choices: [
        { label: '重播', action: () => this._devReplayEffectPreview(() => this._devPreviewCombatEffect(effectId)) },
        { label: '返回', action: () => this._devChooseCombatEffect() },
        { label: '關閉', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _devEffectCombatScene(option = {}) {
    const alive = this._aliveSquad();
    const attacker = alive[0] || G.squad?.find(char => !char.dead) || G.squad?.[0];
    const attackerId = attacker?.id || 'dev_attacker';
    const weapon = {
      ...(attacker?.weapon || {}),
      name: '演出測試武器',
      family: option.weaponFamily || attacker?.weapon?.family || 'sword',
    };
    const squad = (G.squad || []).map((char, index) => ({
      ...char,
      hp: Math.max(1, char.hp || char.maxHp || 10),
      maxHp: char.maxHp || 10,
      weapon: index === 0 || char.id === attackerId ? weapon : (char.weapon || null),
      block: CombatStatus.getBlock(char),
      threat: 0,
      activeBanners: [],
      wagerDiceFaces: [],
      gazeWeaknesses: [...CombatStatus.nativeWeaknesses(char, 'gaze')],
    }));
    if (squad.length === 0) {
      squad.push({
        id: attackerId,
        name: '測試者',
        cls: 'warrior',
        hp: 12,
        maxHp: 12,
        attack: 5,
        weapon,
        block: 0,
        threat: 0,
        activeBanners: [],
        wagerDiceFaces: [],
        gazeWeaknesses: [],
      });
    }
    return {
      status: `演出測試：${option.name || '戰鬥效果'}`,
      attackerId,
      selectable: false,
      canGuard: false,
      canUseBag: false,
      enemy: {
        id: 'dev_effect_target',
        name: '演出假想敵',
        icon: '◆',
        desc: '測試用目標。',
        hp: 34,
        maxHp: 34,
        attack: 5,
        weakness: 6,
        block: 0,
        currentBlock: 0,
        woundMax: 15,
        wounds: option.id === 'wound_burst' ? 10 : 0,
        extraWeaknesses: [],
        disabledNativeWeaknesses: [],
        nativeWeaknessSources: {},
        tempWeakness: null,
        eagleTempWeakness: null,
        eagleNativeWeakness: null,
        suspiciousFlaw: false,
        gamblerNativeWeakness: null,
        gamblerTempWeakness: null,
        gamblerTempWeaknesses: [],
        weaknessDesc: '',
      },
      squad,
    };
  },

  _devChooseEventEffect() {
    const options = this._devEventEffectOptions();
    this._openModal({
      title: '測試工具：事件演出',
      desc: '選擇要用事件視窗預覽的效果。',
      typeText: false,
      choices: options.map(option => ({
        label: option.name,
        detail: option.detail || '',
        action: () => this._devPreviewEventEffect(option.id),
      })).concat([{ label: '返回', action: () => this._devOpenEffectTool() }]),
    });
  },

  _devEventEffectOptions() {
    return [
      { id: 'event-hit', name: '事件受擊', detail: '一般事件傷害震動。', fx: 'event-hit' },
      { id: 'event-dark-hit', name: '黑暗衝擊', detail: '黑暗傷害/侵蝕演出。', fx: 'event-dark-hit' },
      { id: 'event-clear', name: '事件成功', detail: '成功或解除危機。', fx: 'event-clear' },
      { id: 'event-scene', name: '一般事件登場', detail: '帶事件圖的一般事件預設登場。', introFx: 'scene', backdrop: 'assets/events/echo-site-fate.png' },
      { id: 'event-ambush', name: '戰鬥遭遇', detail: '遭遇戰切入。', fx: 'event-ambush' },
      { id: 'event-discover', name: '發現聖物', detail: '聖物/遺物浮現演出。', fx: 'event-discover' },
      { id: 'event-reward', name: '發現裝備', detail: '裝備掉落與分配前演出。', fx: 'event-reward' },
      { id: 'event-quiet', name: '探索無果', detail: '安靜搜索後沒有發現。', fx: 'event-quiet' },
      { id: 'fate-roll-success', name: '命運賭桌成功', detail: '賭桌成功光效。', fx: 'fate-roll-success', backdrop: 'assets/events/fate-table-blood-wager.png' },
      { id: 'fate-fail-blood', name: '命運賭桌失敗：血', detail: '第一局失敗。', fx: 'fate-fail-blood', backdrop: 'assets/events/fate-table-blood-fail.png' },
      { id: 'fate-fail-night', name: '命運賭桌失敗：黑夜', detail: '第二局失敗。', fx: 'fate-fail-night', backdrop: 'assets/events/fate-table-night-fail.png' },
      { id: 'fate-fail-life', name: '命運賭桌失敗：命', detail: '第三局失敗。', fx: 'fate-fail-life', backdrop: 'assets/events/fate-table-life-fail.png' },
      { id: 'night-transition', name: '第十天黑夜過渡', detail: '全畫面黑夜降臨覆蓋演出。', nightTransition: true },
    ];
  },

  _devPreviewEventEffect(effectId) {
    const option = this._devEventEffectOptions().find(item => item.id === effectId);
    if (!option) return;
    if (option.nightTransition) {
      Render.showNightTransition();
    }
    this._openModal({
      title: `效果演出：${option.name}`,
      desc: option.nightTransition
        ? '已播放第十天黑夜過渡覆蓋演出。'
        : '事件演出預覽。',
      typeText: false,
      eventBackdrop: option.backdrop || '',
      introFx: option.introFx || '',
      resultFx: option.fx || '',
      choices: [
        { label: '重播', action: () => this._devReplayEffectPreview(() => this._devPreviewEventEffect(effectId)) },
        { label: '返回', action: () => this._devChooseEventEffect() },
        { label: '關閉', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _devReplayEffectPreview(callback) {
    G.modal = null;
    document.getElementById('event-modal')?.classList.add('hidden');
    FxPlayer.frame(() => {
      FxPlayer.after(40, () => {
        if (typeof callback === 'function') callback();
      });
    });
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
        action: () => this._devPreviewEvent(terrainType, terrainLabel, ev),
      })).concat([{ label: '返回', action: () => this._devChooseEventTerrain() }]),
    });
  },

  _devPreviewEvent(terrainType, terrainLabel, ev) {
    this._openModal({
      title: `${ev.name}（${this._devEventTypeLabel(ev)}）`,
      desc: ev.desc || '',
      typeText: false,
      choices: [
        { label: `${ev.name}（${this._devEventTypeLabel(ev)}）`, action: () => this._devTriggerEvent(terrainType, ev) },
        { label: '返回', action: () => this._devChooseEvent(terrainType, terrainLabel) },
      ],
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
    if (typeof this._createEchoSiteClueEvent === 'function') {
      const echoEvent = this._createEchoSiteClueEvent(true);
      if (echoEvent) events.unshift(echoEvent);
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
      echo_site_clue: '共鳴遺址',
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
    G.modal = null;
    document.getElementById('event-modal')?.classList.add('hidden');
    setTimeout(() => {
      this._dispatchTerrainEvent(cell, cell.content.event);
    }, 0);
  },

  _devOpenSquadStateTool() {
    this._openModal({
      title: '測試工具：調整隊伍狀態',
      desc: '快速恢復隊伍，或指定角色倒下，用來測試救援、死亡掉落與低血量流程。',
      choices: [
        { label: '全隊恢復至滿血', action: () => this._devRestoreSquad() },
        { label: '指定角色恢復至滿血', action: () => this._devChooseRestoreCharacter() },
        { label: '加入測試隊友', action: () => this._devChooseAddSquadMember() },
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

  _devChooseAddSquadMember() {
    if ((G.squad || []).length >= (CONFIG.MAX_SQUAD_SIZE || 3)) {
      this._openModal({
        title: '測試工具：加入隊友',
        desc: `隊伍已達上限 ${CONFIG.MAX_SQUAD_SIZE || 3} 人。`,
        choices: [{ label: '返回', action: () => this._devOpenSquadStateTool() }],
      });
      return;
    }
    const currentClasses = new Set((G.squad || []).map(char => char.cls));
    const classes = Object.values(CHARACTER_CLASSES || {}).filter(cls => !currentClasses.has(cls.id));
    this._openModal({
      title: '測試工具：加入隊友',
      desc: '選擇要加入隊伍的職業。新增角色會使用正式初始武器與滿血狀態。',
      choices: classes.map(cls => ({
        label: `${cls.icon} ${cls.name}`,
        detail: cls.desc,
        action: () => this._devAddSquadMember(cls.id),
      })).concat([{ label: '返回', action: () => this._devOpenSquadStateTool() }]),
    });
  },

  _devAddSquadMember(cls) {
    if (!cls || !CHARACTER_CLASSES?.[cls]) return;
    if ((G.squad || []).length >= (CONFIG.MAX_SQUAD_SIZE || 3)) return;
    if ((G.squad || []).some(char => char.cls === cls)) return;
    const usedNames = new Set((G.squad || []).map(char => char.name));
    const char = this._spawnChar(cls, usedNames);
    G.squad.push(char);
    this._log(`測試工具：${char.name} 加入隊伍。`, 'reward');
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

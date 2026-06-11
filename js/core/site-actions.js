// Extracted from js/core/game.js. Keeps the original Game API while making this system easier to maintain.
const GameSiteActions = {
  _canFieldRest() {
    if (this._isWorldInteractionLocked?.() || G.phase !== 'day' || G.actionsLeft <= 0 || G.phase === 'over') return false;
    return this._aliveSquad().some(char => char.hp < char.maxHp);
  },

  _fallenSquad() {
    return (G.squad || []).filter(char => char && (char.dead || char.hp <= 0));
  },

  fieldRest() {
    if (!this._canFieldRest()) {
      Render.renderTopBar();
      return;
    }
    this._openModal({
      title: '確認原地休息',
      desc: '原地休息會消耗 1 行動，讓全體存活角色恢復 2 HP。\n\n倒下的角色不會被救起。確定要休息嗎？',
      choices: [
        {
          label: '確認休息',
          action: () => {
            this._closeModal();
            this._doFieldRest();
          },
        },
        { label: '取消', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _doFieldRest() {
    if (!this._canFieldRest()) {
      Render.fullRender();
      return;
    }
    G.actionsLeft = Math.max(0, (G.actionsLeft || 0) - 1);
    const healed = this._healAliveSquad(2, false);
    this._log(healed.length > 0
      ? `原地休息：${healed.join('、')} HP。`
      : '原地休息：沒有人需要治療。',
      healed.length > 0 ? 'reward' : 'dim');
    Render.fullRender();
  },

  _triggerAltar(cell) {
    this._recordTerrain('altar');
    const usedToday = cell.altarUsedDay === G.day;
    const fusionCandidates = this._altarFusionCandidates();
    const choices = [];

    if (!usedToday) {
      choices.push({
        label: '融合聖物',
        hint: G.actionsLeft > 0
          ? '消耗 1 行動，角色最大 HP -1。'
          : '今天行動力已用完，明天再回到神壇融合。',
        action: () => this._chooseAltarFusionTarget(cell),
      });
      choices.push({
        label: '血祭',
        hint: '全隊最大 HP -1；探索骰 4-5 黑暗 -1，6 黑暗 -2。',
        danger: true,
        action: () => this._confirmAltarBloodSacrifice(cell),
      });
    }

    choices.push({
      label: '離開',
      action: () => { this._closeModal(); Render.fullRender(); },
    });

    this._openModal({
      title: '神壇',
      desc: [
        usedToday
          ? '這座神壇今天已經使用過。'
          : '古老神壇低聲燃著微光，可以選擇血祭或融合聖物。',
        `可融合角色：${fusionCandidates.length}`,
      ].join('\n\n'),
      choices,
    });
  },

  _altarFusionCandidates() {
    return this._aliveSquad().filter(char =>
      char.relic &&
      char.relic.fusable !== false &&
      !char.fusedRelic &&
      char.maxHp > 1
    );
  },

  _chooseAltarFusionTarget(cell) {
    if (cell.altarUsedDay === G.day) {
      this._triggerAltar(cell);
      return;
    }
    if (G.actionsLeft <= 0) {
      this._openModal({
        title: '神壇融合',
        desc: '今天的行動力已經用完，無法再進行融合。\n\n如果還想使用這座神壇，請先結束今天，明天再回到這裡。',
        choices: [{ label: '返回', action: () => this._triggerAltar(cell) }],
      });
      return;
    }
    const candidates = this._altarFusionCandidates();
    if (candidates.length === 0) {
      this._openModal({
        title: '神壇融合',
        desc: '目前沒有可融合的聖物，或角色最大 HP 不足以支付代價。',
        choices: [{ label: '返回', action: () => this._triggerAltar(cell) }],
      });
      return;
    }

    this._openModal({
      title: '神壇融合',
      desc: '選擇要融合聖物的角色。融合會消耗 1 行動，且該角色最大 HP -1。',
      choices: candidates.map(char => ({
        label: `${char.name}：融合「${char.relic.name}」`,
        action: () => this._doAltarFusion(char, cell),
      })).concat([{ label: '返回', action: () => this._triggerAltar(cell) }]),
    });
  },

  _doAltarFusion(char, cell) {
    if (cell.altarUsedDay === G.day || G.actionsLeft <= 0 || !char?.relic || char.relic.fusable === false || char.fusedRelic || char.maxHp <= 1) {
      this._triggerAltar(cell);
      return;
    }

    this._closeModal();
    G.actionsLeft = Math.max(0, G.actionsLeft - 1);
    cell.altarUsedDay = G.day;

    const relic = char.relic;
    const fusedRelic = { ...relic };
    if (fusedRelic.fusedEffect) fusedRelic.effect = { ...fusedRelic.fusedEffect };

    char.maxHp = Math.max(1, char.maxHp - 1);
    char.hp = Math.min(char.hp, char.maxHp);
    char.fusedRelic = fusedRelic;
    char.relic = null;

    this._applyFusionBonus(char, fusedRelic);
    this._removeMapRelicsById(fusedRelic.id);
    this._unlockNote(fusedRelic.id, true);
    const newly = this._updateResonances();

    this._log(`${char.name} 融合聖物「${fusedRelic.name}」，最大 HP -1。`, 'reward');
    const resonanceText = newly.length > 0
      ? `\n\n聖物共鳴啟動：\n${newly.map(res => `${res.name}：${res.effect?.desc || '共鳴效果已啟動。'}`).join('\n')}`
      : '';
    this._openModal({
      title: '神壇融合成功',
      desc: `${char.name} 最大 HP -1，融合聖物「${fusedRelic.name}」。\n\n消耗 1 行動。${resonanceText}`,
      choices: [{ label: '離開神壇', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    this._onGuideAltarFusion?.();
  },

  _confirmAltarBloodSacrifice(cell) {
    if (cell.altarUsedDay === G.day) {
      this._triggerAltar(cell);
      return;
    }
    this._openModal({
      title: '確認血祭',
      desc: [
        '血祭會讓全隊存活角色最大 HP -1。',
        '接著進行一次探索骰判定：擲出 4-5 時黑暗 -1，擲出 6 時黑暗 -2。',
        '這是高代價行動，請確認真的要獻上生命上限。',
      ].join('\n\n'),
      choices: [
        {
          label: '確認血祭',
          danger: true,
          action: () => this._doAltarBloodSacrifice(cell),
        },
        { label: '取消', action: () => this._triggerAltar(cell) },
      ],
    });
  },

  _doAltarBloodSacrifice(cell) {
    if (cell.altarUsedDay === G.day) {
      this._triggerAltar(cell);
      return;
    }

    this._closeModal();
    cell.altarUsedDay = G.day;

    const alive = this._aliveSquad();
    if (alive.length === 0) {
      Render.fullRender();
      return;
    }

    for (const char of alive) {
      char.maxHp = Math.max(1, char.maxHp - 1);
      char.hp = Math.min(char.hp, char.maxHp);
    }

    const actor = alive.find(c => c.cls === 'explorer') || alive[0];
    const rollResult = this._rollWithMods('explore', actor, { successMin: 4 });
    const roll = rollResult.value;
    const amount = roll === 6 ? 2 : roll >= 4 ? 1 : 0;
    const rerollText = this._gamblerExploreRerollText(rollResult);
    if (amount > 0) this._applyDarkness(-amount, '神壇血祭');

    this._log(amount > 0
      ? `神壇血祭成功：${actor.name} 擲出 ${Dice.face(roll)}（${roll}），黑暗 -${amount}。`
      : `神壇血祭失敗：${actor.name} 擲出 ${Dice.face(roll)}（${roll}），黑暗不變。`,
      amount > 0 ? 'reward' : 'dim');

    this._openModal({
      title: '神壇血祭',
      desc: [
        '全隊最大 HP -1。',
        `${actor.name} 正在擲探索骰進行血祭判定。`,
      ].join('\n\n'),
      preDesc: [
        '全隊最大 HP -1。',
        `${actor.name} 正在擲探索骰進行血祭判定。`,
      ].join('\n\n'),
      resultAppend: [
        rerollText,
        `${actor.name} 擲出 ${Dice.face(roll)}（${roll}）。`,
        amount === 2 ? '大成功：黑暗 -2。' : amount === 1 ? '成功：黑暗 -1。' : '失敗：黑暗不變。',
      ].filter(Boolean).join('\n\n'),
      dice: { type: amount > 0 ? 'neutral' : 'danger', label: `${actor.name} 的探索骰`, value: roll, raw: rollResult.raw, floored: rollResult.floored, animate: true, charCls: rollResult.charCls },
      choices: [{ label: '離開神壇', action: () => { this._closeModal(); if (this._checkLose()) return; Render.fullRender(); } }],
    });
  },

  _triggerRest(cell) {
    this._recordTerrain('rest');
    this._refreshRestPoints();
    if (G.phase !== 'day') {
      this._triggerEmberPoint(cell);
      return;
    }

    const dead = this._fallenSquad();
    const injured = this._aliveSquad().filter(c => c.hp < c.maxHp);
    const groupRestLabel = this._siteRestHealLabel?.(0.30) ?? 30;
    const firstAidLabel = this._siteRestHealLabel?.(0.50) ?? 50;
    const choices = [];

    choices.push({
      label: `休息：全隊恢復 ${groupRestLabel}% 最大 HP`,
      action: () => {
        const healed = this._healAliveSquad(c => this._siteRestHealAmount?.(c, 0.30) ?? Math.ceil(c.maxHp * 0.30), true);
        this._log(healed.length > 0 ? '隊伍休息並恢復生命。' : '隊伍休息，但沒有人需要治療。', 'reward');
        this._markRestUsed(cell);
        this._closeModal();
        Render.fullRender();
      },
    });

    if (injured.length > 0) {
      choices.push({
        label: `急救：指定一名角色恢復 ${firstAidLabel}% 最大 HP`,
        action: () => {
          const targetChoices = injured.map(char => ({
            label: `${char.name}（HP ${char.hp}/${char.maxHp}）`,
            action: () => {
              const before = char.hp;
              const heal = this._restHealAmount(char, this._siteRestHealAmount?.(char, 0.50) ?? Math.ceil(char.maxHp * 0.50));
              char.hp = Math.min(char.maxHp, char.hp + heal);
              this._log(`${char.name} 恢復 ${char.hp - before} HP。`, 'reward');
              this._markRestUsed(cell);
              this._closeModal();
              Render.fullRender();
            },
          }));
          targetChoices.push({ label: '返回', action: () => { this._closeModal(); this._triggerRest(cell); } });
          this._openModal({ title: '急救', desc: '選擇要治療的角色。', choices: targetChoices });
        },
      });
    }

    for (const char of dead) {
      const reviveHp = this._siteRestHealAmount?.(char, 0.50) ?? Math.ceil(char.maxHp * 0.50);
      choices.push({
        label: `救起 ${char.name}（${reviveHp} HP）`,
        action: () => {
          this._reviveChar(char, reviveHp);
          this._markRestUsed(cell);
          this._closeModal();
          Render.fullRender();
        },
      });
    }

    choices.push({ label: '離開', action: () => { this._closeModal(); Render.fullRender(); } });
    this._openModal({ title: '休息點', desc: '你們找到可以短暫喘息的地方。', choices });
  },

  _triggerEmberPoint(cell) {
    const injured = this._aliveSquad().filter(c => c.hp < c.maxHp);
    const groupRestLabel = this._siteRestHealLabel?.(0.30) ?? 30;
    const firstAidLabel = this._siteRestHealLabel?.(0.50) ?? 50;
    const choices = [
      {
        label: `殘火治療：全隊恢復 ${groupRestLabel}% 最大 HP`,
        action: () => {
          const healed = this._healAliveSquad(char => this._siteRestHealAmount?.(char, 0.30) ?? Math.ceil(char.maxHp * 0.30), true);
          if (healed.length > 0) this._log('殘火讓隊伍恢復生命。', 'reward');
          this._markRestUsed(cell);
          this._closeModal();
          Render.fullRender();
        },
      },
    ];

    if (injured.length > 0) {
      choices.push({
        label: `殘火急救：指定一名角色恢復 ${firstAidLabel}% 最大 HP`,
        action: () => {
          const targetChoices = injured.map(char => ({
            label: `${char.name}（HP ${char.hp}/${char.maxHp}）`,
            action: () => {
              const before = char.hp;
              const heal = this._restHealAmount(char, this._siteRestHealAmount?.(char, 0.50) ?? Math.ceil(char.maxHp * 0.50));
              char.hp = Math.min(char.maxHp, char.hp + heal);
              this._log(`殘火讓 ${char.name} 恢復 ${char.hp - before} HP。`, 'reward');
              this._markRestUsed(cell);
              this._closeModal();
              Render.fullRender();
            },
          }));
          targetChoices.push({ label: '返回', action: () => { this._closeModal(); this._triggerEmberPoint(cell); } });
          this._openModal({ title: '殘火急救', desc: '選擇要治療的角色。', choices: targetChoices });
        },
      });
    }

    for (const char of this._fallenSquad()) {
      const reviveHp = this._siteRestHealAmount?.(char, 0.50) ?? Math.ceil(char.maxHp * 0.50);
      choices.push({
        label: `救起 ${char.name}（${reviveHp} HP）`,
        action: () => {
          this._reviveChar(char, reviveHp);
          this._markRestUsed(cell);
          this._closeModal();
          Render.fullRender();
        },
      });
    }

    this._openModal({ title: '殘火點', desc: '黑夜中的殘火仍留有一點溫度，可以治療或救起倒下隊友。', choices });
  },
};

Object.assign(Game, GameSiteActions);

// event-traps methods extracted from js/core/event-handlers.js.
const GameEventTraps = {
  _triggerTrap(ev, forcedRollResult = null) {
    if (ev.fixedTrap) {
      this._triggerFixedTrap(ev);
      return;
    }

    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer') || this._aliveSquad()[0];
    if (!attacker) { Render.fullRender(); return; }

    if (!forcedRollResult) {
      this._openModal({
        title: ev.name,
        desc: (ev.desc || '') + `\n\n${attacker.name} 將進行探索骰判定，門檻 ${ev.successMin || 3}。`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{ label: '擲探索骰', action: () => this._rollTrapWithAnimation(ev, attacker) }],
      });
      return;
    }

    const rollResult = forcedRollResult;
    const roll = rollResult.value;
    const success = roll >= (ev.successMin || 3);
    if (!success) {
      const candidates = this._aliveSquad();
      const victim = candidates[Math.floor(Math.random() * candidates.length)];
      const damage = ev.failDamage || CONFIG.DEFAULT_TRAP_DAMAGE;
      if (victim) victim.hp = Math.max(0, victim.hp - this._reduceIncomingDamage(victim, damage));
      this._log(victim ? `${victim.name} 受到 ${damage} 點陷阱傷害。` : '陷阱觸發。', 'danger');
    } else {
      this._completeProgressEvent(ev);
    }

    const preDesc = `${ev.desc || ''}`;
    const resultText = `${attacker.name} 正在進行探索骰判定，門檻 ${ev.successMin || 3}。\n\n${attacker.name} 擲出 ${Dice.face(roll)}（${roll}）：${success ? '成功通過。' : '失敗，觸發陷阱。'}`;
    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: `${preDesc}\n\n${resultText}`,
      resultAppend: resultText,
      resultFx: success ? 'event-clear' : 'event-hit',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: success ? 'neutral' : 'danger', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: !!rollResult.animate, charCls: rollResult.charCls },
      choices: [{ label: '繼續', action: () => { this._closeModal(); if (this._checkLose()) return; Render.fullRender(); } }],
    });
  },

  _rollTrapWithAnimation(ev, attacker) {
    const rollResult = this._rollWithMods('explore', attacker, { successMin: ev.successMin || 3 });
    rollResult.animate = true;
    this._triggerTrap(ev, rollResult);
  },

  _triggerDarknessSeep(cell, ev, forcedRollResult = null) {
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n選擇通過方式。小心通過需要探索骰，失敗會讓隨機隊員受傷；硬闖會讓全隊受傷但直接通過。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        { label: `小心通過（探索骰門檻 ${ev.successMin || 3}，失敗隨機隊員 -${ev.failDamage || 3} HP）`, action: () => this._rollDarknessSeepWithAnimation(cell, ev) },
        { label: '硬闖（全隊 -2 HP，直接通過）', danger: true, action: () => this._forceDarknessSeep(cell, ev) },
      ],
    });
  },

  _rollDarknessSeep(cell, ev, forcedRollResult = null) {
    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer' && c.hp > 0)
      || this._aliveSquad().sort((a, b) => b.hp - a.hp)[0];
    const rollResult = forcedRollResult || this._rollWithMods('explore', attacker, { successMin: ev.successMin || 3 });
    const roll = rollResult.value;
    const success = roll >= (ev.successMin || 3);

    if (success) {
      this._completeProgressEvent(ev);
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}`;
      const resultText = `${attacker.name} 正在小心通過，進行探索骰判定，門檻 ${ev.successMin || 3}。\n\n擲出 ${Dice.face(roll)}（${roll}），安全通過。`;
      this._openModal({
        title: ev.name,
        desc: preDesc,
        preDesc,
        resultDesc: `${preDesc}\n\n${resultText}`,
        resultAppend: resultText,
        resultFx: 'event-clear',
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        dice: { type: 'neutral', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: !!rollResult.animate, charCls: rollResult.charCls },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    const candidates = this._aliveSquad();
    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    const damage = this._reduceIncomingDamage(victim, ev.failDamage || 3);
    victim.hp = Math.max(0, victim.hp - damage);
    this._log(`${victim.name} 被黑霧侵蝕，受到 ${damage} 傷害。`, 'danger');
    const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}`;
    const resultText = `${attacker.name} 正在小心通過，進行探索骰判定，門檻 ${ev.successMin || 3}。\n\n擲出 ${Dice.face(roll)}（${roll}），通過失敗。${victim.name} 受到 ${damage} 傷害。`;
    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: `${preDesc}\n\n${resultText}`,
      resultAppend: resultText,
      resultFx: 'event-dark-hit',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'danger', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: !!rollResult.animate, charCls: rollResult.charCls },
      choices: [
        {
          label: '再次小心通過',
          action: () => { if (this._checkLose()) return; this._rollDarknessSeepWithAnimation(cell, ev); },
        },
        {
          label: '改為硬闖',
          danger: true,
          action: () => { if (this._checkLose()) return; this._forceDarknessSeep(cell, ev); },
        },
      ],
    });
  },

  _rollDarknessSeepWithAnimation(cell, ev) {
    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer' && c.hp > 0)
      || this._aliveSquad().sort((a, b) => b.hp - a.hp)[0];
    const rollResult = this._rollWithMods('explore', attacker, { successMin: ev.successMin || 3 });
    rollResult.animate = true;
    this._rollDarknessSeep(cell, ev, rollResult);
  },

  _forceDarknessSeep(cell, ev) {
    const damaged = [];
    for (const char of this._aliveSquad()) {
      const damage = this._reduceIncomingDamage(char, 2);
      char.hp = Math.max(0, char.hp - damage);
      damaged.push(`${char.name} -${damage}`);
    }
    this._completeProgressEvent(ev);
    this._log(`硬闖通過：${damaged.join('、')} HP。`, 'danger');
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n你們選擇硬闖，直接通過。\n${damaged.join('、')} HP。`,
      resultFx: 'event-hit',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); if (this._checkLose()) return; Render.fullRender(); } }],
    });
  },

  _triggerChoiceTrap(cell, ev) {
    const choices = [
      { label: `${ev.choiceTrapLabel || '小心解除'}（探索骰門檻 ${ev.successMin || 3}，失敗隨機隊員 -${ev.failDamage || 2} HP）`, action: () => this._rollChoiceTrapWithAnimation(cell, ev) },
      { label: `${ev.forceTrapLabel || '硬闖'}（全隊 -${ev.forceDamage || 1} HP，直接通過）`, danger: true, action: () => this._forceChoiceTrap(cell, ev) },
    ];
    if (ev.detourActionCost > 0) {
      choices.push({
        label: `${ev.detourTrapLabel || '繞路'}（行動 -${ev.detourActionCost}，不受傷）`,
        action: () => this._detourChoiceTrap(cell, ev),
      });
    }
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n選擇解除方式。小心處理需要探索骰；硬闖會讓全隊受傷但直接通過${ev.detourActionCost > 0 ? '；繞路會消耗剩餘行動但避免傷害' : ''}。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices,
    });
  },

  _rollChoiceTrap(cell, ev, forcedRollResult = null) {
    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer' && c.hp > 0)
      || this._aliveSquad().sort((a, b) => b.hp - a.hp)[0];
    const rollResult = forcedRollResult || this._rollWithMods('explore', attacker, { successMin: ev.successMin || 3 });
    const roll = rollResult.value;
    const success = roll >= (ev.successMin || 3);

    if (success) {
      this._completeProgressEvent(ev);
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}`;
      const resultText = `${attacker.name} 正在小心處理，進行探索骰判定，門檻 ${ev.successMin || 3}。\n\n擲出 ${Dice.face(roll)}（${roll}），成功通過。`;
      this._openModal({
        title: ev.name,
        desc: preDesc,
        preDesc,
        resultDesc: `${preDesc}\n\n${resultText}`,
        resultAppend: resultText,
        resultFx: 'event-clear',
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        dice: { type: 'neutral', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: !!rollResult.animate, charCls: rollResult.charCls },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    const candidates = this._aliveSquad();
    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    const damage = this._reduceIncomingDamage(victim, ev.failDamage || 2);
    victim.hp = Math.max(0, victim.hp - damage);
    this._log(`${victim.name} 受到 ${damage} 點陷阱傷害。`, 'danger');
    const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}`;
    const resultText = `${attacker.name} 正在小心處理，進行探索骰判定，門檻 ${ev.successMin || 3}。\n\n擲出 ${Dice.face(roll)}（${roll}），解除失敗。${victim.name} 受到 ${damage} 傷害。`;
    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: `${preDesc}\n\n${resultText}`,
      resultAppend: resultText,
      resultFx: 'event-hit',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'danger', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: !!rollResult.animate, charCls: rollResult.charCls },
      choices: [
        {
          label: '再次小心解除',
          action: () => { if (this._checkLose()) return; this._rollChoiceTrapWithAnimation(cell, ev); },
        },
        {
          label: '改為硬闖',
          danger: true,
          action: () => { if (this._checkLose()) return; this._forceChoiceTrap(cell, ev); },
        },
      ],
    });
  },

  _rollChoiceTrapWithAnimation(cell, ev) {
    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer' && c.hp > 0)
      || this._aliveSquad().sort((a, b) => b.hp - a.hp)[0];
    const rollResult = this._rollWithMods('explore', attacker, { successMin: ev.successMin || 3 });
    rollResult.animate = true;
    this._rollChoiceTrap(cell, ev, rollResult);
  },

  _forceChoiceTrap(cell, ev) {
    const damaged = [];
    for (const char of this._aliveSquad()) {
      const damage = this._reduceIncomingDamage(char, ev.forceDamage || 1);
      char.hp = Math.max(0, char.hp - damage);
      damaged.push(`${char.name} -${damage}`);
    }
    this._completeProgressEvent(ev);
    this._log(`硬闖陷阱：${damaged.join('、')} HP。`, 'danger');
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.forceDesc || ev.desc || ''}\n\n你們選擇硬闖，直接通過。\n${damaged.join('、')} HP。`,
      resultFx: 'event-hit',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); if (this._checkLose()) return; Render.fullRender(); } }],
    });
  },

  _detourChoiceTrap(cell, ev) {
    const cost = ev.detourActionCost || 1;
    const spent = this._spendTrapAction(cost, ev.name);
    this._completeProgressEvent(ev);
    const text = spent > 0
      ? `你們選擇繞路，避開危險區域。\n\n行動 -${spent}。`
      : '你們選擇繞路，避開危險區域。\n\n今天已沒有剩餘行動可扣。';
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.detourDesc || ev.desc || ''}\n\n${text}`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerFixedTrap(ev) {
    const effects = [];
    if (ev.actionCost > 0) {
      const spent = this._spendTrapAction(ev.actionCost, ev.name);
      effects.push(spent > 0 ? `行動 -${spent}` : '今天已沒有剩餘行動可扣');
    }
    if (ev.partyDamage > 0) {
      const damaged = this._damageAliveSquad(ev.partyDamage);
      effects.push(`全隊受傷：${damaged.join('、')}`);
    }
    if (ev.targetDamage > 0) {
      const target = this._aliveSquad().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (target) {
        const damage = this._reduceIncomingDamage(target, ev.targetDamage);
        target.hp = Math.max(0, target.hp - damage);
        effects.push(`${target.name} -${damage} HP`);
        this._log(`${ev.name}：${target.name} 受到 ${damage} 傷害。`, 'danger');
      }
    }
    this._completeProgressEvent(ev);
    const descText = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${ev.fixedResultText || '陷阱立刻生效，沒有時間閃避。'}\n${effects.join('\n')}`;
    const choices = [{ label: '繼續', action: () => { this._closeModal(); if (this._checkLose()) return; Render.fullRender(); } }];
    this._openModal({
      title: ev.name,
      desc: descText,
      resultFx: (ev.partyDamage > 0 || ev.targetDamage > 0) ? 'event-hit' : 'event-clear',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      typeText: !ev.eventImage,
      choices,
    });
  },

  _spendTrapAction(amount = 1, reason = '陷阱') {
    const before = Math.max(0, G.actionsLeft || 0);
    const spent = Math.min(before, Math.max(0, amount));
    G.actionsLeft = Math.max(0, before - spent);
    if (spent > 0) this._log(`${reason}：行動 -${spent}。`, 'danger');
    return spent;
  },

  _damageAliveSquad(amount = 1) {
    const damaged = [];
    for (const char of this._aliveSquad()) {
      const damage = this._reduceIncomingDamage(char, amount);
      char.hp = Math.max(0, char.hp - damage);
      damaged.push(`${char.name} -${damage}`);
    }
    this._log(`固定陷阱傷害：${damaged.join('、')} HP。`, 'danger');
    return damaged;
  },


};

Object.assign(Game, GameEventTraps);

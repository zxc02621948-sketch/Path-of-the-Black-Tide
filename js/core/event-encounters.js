// event-encounters methods extracted from js/core/event-handlers.js.
const GameEventEncounters = {
  _triggerTerrainCombat(cell, ev) {
    cell.cleared = false;
    const enemy = randomEnemy(G.phase === 'night');
    cell.type = 'enemy';
    cell.content = { enemy, event: ev };
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}`,
      resultFx: 'event-ambush',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{
        label: '進入戰鬥',
        danger: true,
        action: () => {
          this._log(`${this._eventDiceInline(ev)}${ev.desc}`);
          this._closeModal();
          this._triggerCombat(cell);
        },
      }],
    });
  },

  _settleTerrainCombatSmallReward(ev, enemy, attacker, roll, rollResult, combatLog = [], combatAnims = null) {
    let rewardDesc = '';
    const hasReward = Math.random() < (CONFIG.CAVE_ENEMY_WIN_REWARD_CHANCE || 0.25);

    if (hasReward && Math.random() < 0.5) {
      const equip = randomEquipment(G.day);
      const addResult = this._addInventoryItem(equip);
      if (!addResult.added) {
        this._openInventoryFullModal(ev, equip, '');
        return;
      }
      const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
      this._log(`${ev.name} 勝利後發現道具「${equip.name}」。`, 'reward');
      rewardDesc = `\n\n戰鬥後找到道具：${equip.icon} ${equip.name}${countText}\n${equip.desc}`;
    } else if (hasReward) {
      rewardDesc = this._revealNearbyFromEvent(1);
      this._log(`${ev.name} 勝利後揭露附近區域。`, 'reward');
    }

    this._openModal({
      title: '戰鬥勝利',
      desc: `${enemy.name} 被擊敗。${rewardDesc}`,
      combatLog,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims,
      dice: null,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerCorruptedAmbush(cell) {
    const base = randomEnemy(true);
    const enemy = {
      ...base,
      hp: (base.hp || 1) + 1,
      attack: (base.attack || 1) + 1,
      maxHp: (base.hp || 1) + 1,
    };
    cell.type = 'enemy';
    cell.cleared = false;
    cell.content = { enemy, reward: 'corrupted' };
    this._log('腐化地形觸發伏擊。', 'danger');
    this._triggerCombat(cell);
  },

  _triggerRescue(ev) {
    const usedNames = new Set(G.squad.map(c => c.name));
    const usedClasses = new Set(G.squad.map(c => c.cls));
    const fixedPool = Object.values(typeof CLASS_FIXED_CHARACTER !== 'undefined' ? CLASS_FIXED_CHARACTER : {})
      .filter(Boolean);
    const available = fixedPool.filter(p => !usedNames.has(p.name) && !usedClasses.has(p.cls));

    if (available.length === 0) {
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n目前沒有可救援的新職業。`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{ label: '繼續', action: () => this._closeModal() }],
      });
      return;
    }

    const tmpl = available[Math.floor(Math.random() * available.length)];
    const newChar = this._spawnChar(tmpl.cls, usedNames, tmpl.name);
    newChar.flavor = tmpl.flavor;
    const squadFull = G.squad.length >= CONFIG.MAX_SQUAD_SIZE;
    const choices = [];

    if (!squadFull) {
      choices.push({
        label: `邀請 ${newChar.name} 加入隊伍`,
        action: () => {
          G.squad.push(newChar);
          this._completeProgressEvent(ev);
          this._log(`${newChar.name} 加入隊伍。`, 'reward');
          this._closeModal(); Render.fullRender();
        },
      });
    } else {
      for (const char of this._aliveSquad()) {
        choices.push({
          label: `讓 ${char.name} 離隊，邀請 ${newChar.name}`,
          action: () => {
            this._removeCharFromSquad(char);
            G.squad.push(newChar);
            this._completeProgressEvent(ev);
            this._log(`${char.name} 離隊，${newChar.name} 加入隊伍。`, 'reward');
            this._updateResonances();
            this._closeModal(); Render.fullRender();
          },
        });
      }
    }
    this._log(`發現倖存者：${newChar.name}。`, 'reward');

    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n你們找到了 ${newChar.name}（${CHARACTER_CLASSES[newChar.cls]?.name || newChar.cls}）。\n${newChar.flavor || ''}`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices,
    });
  },

  _triggerSupply(ev) {
    if (this._progressEventDelta(ev) < 0) {
      this._triggerSupplyWithManualProgress(ev);
      return;
    }
    const rescueClue = ev.revealRescueBoss && this._needsRescue() ? this._revealRescueBoss() : '';
    const revealInfo = ev.revealIfNoRescue && !this._needsRescue()
      ? this._revealNearbyFromEvent(ev.revealIfNoRescue)
      : '';
    const eventInfo = rescueClue || revealInfo;
    this._ensureInventory();
    const rewardType = this._rollSupplyRewardType();
    if (rewardType === 'item') {
      const equip = randomEquipment(G.day);
      const addResult = this._addInventoryItem(equip);
      const progress = this._resolveProgressEventForModal(ev, null);
      if (!addResult.added) {
        this._openInventoryFullModal(ev, equip, `${eventInfo}${progress.text}`);
        return;
      }
      const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
      this._log(`${ev.name}：獲得道具「${equip.name}」。`, 'reward');
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n獲得道具：${equip.icon} ${equip.name}${countText}\n${equip.desc}${eventInfo}`;
      this._openModal({
        title: ev.name,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      desc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : `${preDesc}${progress.text}`,
      preDesc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : undefined,
      resultDesc: progress.dice ? `${preDesc}${progress.text}` : undefined,
      resultAppend: progress.dice ? progress.text : undefined,
      dice: progress.dice,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    } else if (rewardType === 'gear') {
      const gear = randomGear(G.day);
      const progress = this._resolveProgressEventForModal(ev, null);
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n發現角色裝備：${gear.icon} ${gear.name}\n${gear.desc}${eventInfo}${progress.text}`;
      this._openSupplyGearRewardModal(ev, gear, desc);
    } else if (ev.itemOnly) {
      const progress = this._resolveProgressEventForModal(ev, null);
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n沒有找到可帶走的道具。${eventInfo}`;
      this._openModal({
        title: ev.name,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      desc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : `${preDesc}${progress.text}`,
      preDesc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : undefined,
      resultDesc: progress.dice ? `${preDesc}${progress.text}` : undefined,
      resultAppend: progress.dice ? progress.text : undefined,
      dice: progress.dice,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    } else {
      // Section.
      const heal = ev.heal || CONFIG.DEFAULT_SUPPLY_HEAL;
      const healed = [];
      if (ev.healTarget === 'lowest') {
        const target = this._aliveSquad().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (target) {
          const before = target.hp;
          target.hp = Math.min(target.maxHp, target.hp + heal);
          if (target.hp > before) healed.push(`${target.name} +${target.hp - before}`);
        }
      } else {
        for (const char of this._aliveSquad()) {
          const before = char.hp;
          char.hp = Math.min(char.maxHp, char.hp + heal);
          if (char.hp > before) healed.push(`${char.name} +${char.hp - before}`);
        }
      }
      const progress = this._resolveProgressEventForModal(ev, null);
      this._log(healed.length > 0 ? `${ev.name}：${healed.join('、')} HP。` : `${ev.name}：隊伍休整，但沒有人需要治療。`, healed.length > 0 ? 'reward' : 'dim');
      const healText = healed.length > 0
        ? `${ev.healTarget === 'lowest' ? '最低 HP 角色' : '隊伍'}恢復生命：${healed.join('、')}。`
        : '隊伍短暫休整，但目前沒有人需要治療。';
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${healText}${eventInfo}`;
      this._openModal({
        title: ev.name,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      desc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : `${preDesc}${progress.text}`,
      preDesc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : undefined,
      resultDesc: progress.dice ? `${preDesc}${progress.text}` : undefined,
      resultAppend: progress.dice ? progress.text : undefined,
      dice: progress.dice,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    }
  },

  _triggerSupplyWithManualProgress(ev) {
    const rescueClue = ev.revealRescueBoss && this._needsRescue() ? this._revealRescueBoss() : '';
    const revealInfo = ev.revealIfNoRescue && !this._needsRescue()
      ? this._revealNearbyFromEvent(ev.revealIfNoRescue)
      : '';
    const eventInfo = rescueClue || revealInfo;
    this._ensureInventory();

    const rewardType = this._rollSupplyRewardType();
    if (rewardType === 'item') {
      const equip = randomEquipment(G.day);
      const addResult = this._addInventoryItem(equip);
      if (!addResult.added) {
        this._openInventoryFullModal(ev, equip, eventInfo);
        return;
      }
      const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
      this._log(`${ev.name}：獲得道具「${equip.name}」。`, 'reward');
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n獲得道具：${equip.icon} ${equip.name}${countText}\n${equip.desc}${eventInfo}`;
      this._openModal({
        title: ev.name,
        desc,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: this._manualProgressChoices(ev, desc),
      });
      return;
    }

    if (rewardType === 'gear') {
      const gear = randomGear(G.day);
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n發現角色裝備：${gear.icon} ${gear.name}\n${gear.desc}${eventInfo}`;
      this._openSupplyGearRewardModal(ev, gear, desc, nextDesc => this._manualProgressChoices(ev, nextDesc));
      return;
    }

    if (ev.itemOnly) {
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n你們翻找了一陣，但沒有找到能帶走的物資。`;
      this._openModal({
        title: ev.name,
        desc,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: this._manualProgressChoices(ev, desc),
      });
      return;
    }

    const heal = ev.heal || CONFIG.DEFAULT_SUPPLY_HEAL;
    const healed = [];
    if (ev.healTarget === 'lowest') {
      const target = this._aliveSquad().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (target) {
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        if (target.hp > before) healed.push(`${target.name} +${target.hp - before}`);
      }
    } else {
      for (const char of this._aliveSquad()) {
        const before = char.hp;
        char.hp = Math.min(char.maxHp, char.hp + heal);
        if (char.hp > before) healed.push(`${char.name} +${char.hp - before}`);
      }
    }
    this._log(healed.length > 0 ? `${ev.name}：${healed.join('、')} HP。` : `${ev.name}：隊伍休整，但沒有人需要治療。`, healed.length > 0 ? 'reward' : 'dim');
    const healText = healed.length > 0
      ? `沒有找到可用道具，但你們短暫休整。恢復生命：${healed.join('、')}。`
      : '沒有找到可用道具。你們短暫休整，但目前沒有人需要治療。';
    const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${healText}`;
    this._openModal({
      title: ev.name,
      desc,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: this._manualProgressChoices(ev, desc),
    });
  },

  _rollSupplyRewardType() {
    const itemChance = Math.max(0, CONFIG.SUPPLY_EQUIPMENT_CHANCE ?? 0.35);
    const gearChance = Math.max(0, CONFIG.SUPPLY_GEAR_CHANCE ?? 0.15);
    const roll = Math.random();
    if (roll < itemChance) return 'item';
    if (roll < itemChance + gearChance) return 'gear';
    return 'heal';
  },

  _openSupplyGearRewardModal(ev, gear, desc, nextChoices = null) {
    const choices = this._aliveSquad().map(char => ({
      label: `${char.name}${char.gear ? `（替換 ${char.gear.name}）` : ''}`,
      action: () => {
        const current = char.gear;
        char.gear = { ...gear };
        const equipLine = `${char.name} 裝備「${gear.name}」${current ? `，替換「${current.name}」` : ''}。`;
        this._log(`${ev.name}：${equipLine}`, 'reward');
        if (typeof nextChoices === 'function') {
          const nextDesc = `${desc}\n\n${equipLine}`;
          this._openModal({
            title: ev.name,
            desc: nextDesc,
            eventImage: ev.eventImage || '',
            eventImageAlt: ev.name || '',
            choices: nextChoices(nextDesc),
          });
          return;
        }
        this._closeModal();
        Render.fullRender();
      },
    }));
    choices.push({
      label: `放棄「${gear.name}」`,
      action: () => {
        this._log(`${ev.name}：放棄角色裝備「${gear.name}」。`, 'dim');
        if (typeof nextChoices === 'function') {
          const nextDesc = `${desc}\n\n你們放棄了這件裝備。`;
          this._openModal({
            title: ev.name,
            desc: nextDesc,
            eventImage: ev.eventImage || '',
            eventImageAlt: ev.name || '',
            choices: nextChoices(nextDesc),
          });
          return;
        }
        this._closeModal();
        Render.fullRender();
      },
    });
    this._openModal({
      title: ev.name,
      desc,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices,
    });
  },

  _manualProgressChoices(ev, desc) {
    const delta = this._progressEventDelta(ev);
    if (typeof delta !== 'number' || delta >= 0) {
      return [{ label: '繼續', action: () => { this._completeProgressEvent(ev); this._closeModal(); Render.fullRender(); } }];
    }
    const amount = Math.abs(delta);
    return [{
      label: `進行黑暗降低判定（成功黑暗 -${amount}）`,
      action: () => this._resolveManualProgressModal(ev, desc),
    }];
  },

  _resolveManualProgressModal(ev, desc) {
    const result = this._resolveProgressEventForModal(ev, null);
    this._openModal({
      title: ev.name,
      desc: result.dice ? `${desc}\n\n正在進行淨化判定。` : `${desc}${result.text}`,
      preDesc: result.dice ? `${desc}\n\n正在進行淨化判定。` : undefined,
      resultDesc: result.dice ? `${desc}${result.text}` : undefined,
      resultAppend: result.dice ? result.text : undefined,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: result.dice ? { ...result.dice, animate: true } : null,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerCaveStarlightShard(ev, rollResult = null) {
    if (!rollResult) {
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n星光碎片需要擲骰判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{
          label: '擲淨化骰',
          action: () => {
            const roll = Dice.rollRaw();
            this._triggerCaveStarlightShard(ev, { value: roll, raw: roll, animate: true });
          },
        }],
      });
      return;
    }

    const roll = rollResult.value;
    const success = roll >= 4;

    if (!success) {
      this._log(`${ev.name} 淨化失敗：擲出 ${Dice.face(roll)}（${roll}），黑暗不變。`, 'dim');
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        preDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        resultDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n擲出 ${Dice.face(roll)}（${roll}），淨化失敗，黑暗不變。`,
        resultAppend: `擲出 ${Dice.face(roll)}（${roll}），淨化失敗，黑暗不變。`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        dice: { type: 'danger', label: '淨化骰', value: roll, raw: roll, animate: !!rollResult.animate },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    if (roll === 6 && Math.random() < 0.5) {
      const equip = randomEquipment(G.day);
      const addResult = this._addInventoryItem(equip);
      if (!addResult.added) {
        this._log(`${ev.name}：背包已滿，無法直接放入「${equip.name}」。`, 'dim');
        this._openInventoryFullModal(ev, equip, '');
        return;
      }
      const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
      this._log(`${ev.name}：獲得道具「${equip.name}」。`, 'reward');
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        preDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        resultDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n大成功：你們獲得 ${equip.icon} ${equip.name}${countText}。\n${equip.desc}`,
        resultAppend: `大成功：你們獲得 ${equip.icon} ${equip.name}${countText}。\n${equip.desc}`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        dice: { type: 'neutral', label: '淨化骰', value: roll, raw: roll, animate: !!rollResult.animate },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    const amount = roll === 6 ? 2 : 1;
    const reduction = this._applyDarknessReductionWithOverflow(ev, amount, `${ev.name} 淨化`);
    this._log(`${ev.name} 淨化成功：黑暗 -${reduction.actual}。`, 'reward');
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
      preDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
      resultDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n擲出 ${Dice.face(roll)}（${roll}），${roll === 6 ? '大成功' : '成功'}：黑暗 -${reduction.actual}。${reduction.text.replace(/^\n\n/, '')}`,
      resultAppend: `擲出 ${Dice.face(roll)}（${roll}），${roll === 6 ? '大成功' : '成功'}：黑暗 -${reduction.actual}。${reduction.text.replace(/^\n\n/, '')}`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'neutral', label: '淨化骰', value: roll, raw: roll, animate: !!rollResult.animate },
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerOldCamp(cell, ev) {
    const heal = ev.heal || 2;
    for (const char of this._aliveSquad()) char.hp = Math.min(char.maxHp, char.hp + heal);
    this._completeProgressEvent(ev, null);
    this._log(`${ev.name}：全隊恢復 ${heal} HP。`, 'reward');
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n全隊先恢復 ${heal} HP。你們可以選擇是否翻找營地。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        { label: '翻找營地', action: () => this._resolveOldCampGamble(cell, ev) },
        { label: '離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _resolveOldCampGamble(cell, ev) {
    const mode = Math.random() < 0.5 ? 'high' : 'low';
    const roll = Dice.rollRaw();
    const bigSuccess = (mode === 'high' && roll === 6) || (mode === 'low' && roll === 1);
    const bigFail = (mode === 'high' && roll === 1) || (mode === 'low' && roll === 6);
    const success = mode === 'high' ? roll >= 4 : roll <= 3;
    const modeText = mode === 'high' ? '比大：4-6 成功' : '比小：1-3 成功';

    if (bigSuccess) {
      this._closeModal();
      this._log(`${ev.name} 翻找大成功：發現聖物。`, 'reward');
      this._triggerRandomRelicFind(cell, ev);
      return;
    }

    if (bigFail) {
      this._closeModal();
      this._log(`${ev.name} 翻找大失敗：遭遇怪物襲擊。`, 'danger');
      this._triggerTerrainCombat(cell, ev);
      return;
    }

    if (success) {
      const equip = randomEquipment(G.day);
      const addResult = this._addInventoryItem(equip);
      if (!addResult.added) {
        this._openInventoryFullModal(ev, equip, '');
        return;
      }
      this._log(`${ev.name} 翻找成功：獲得道具「${equip.name}」。`, 'reward');
      this._openModal({
        title: ev.name,
        desc: `${modeText}\n\n正在翻找營地。`,
        preDesc: `${modeText}\n\n正在翻找營地。`,
        resultDesc: `${modeText}\n\n擲出 ${Dice.face(roll)}（${roll}），成功獲得 ${equip.icon} ${equip.name}。\n${equip.desc}`,
        resultAppend: `擲出 ${Dice.face(roll)}（${roll}），成功獲得 ${equip.icon} ${equip.name}。\n${equip.desc}`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        dice: { type: 'neutral', label: '翻找骰', value: roll, raw: roll, animate: true },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    this._openModal({
      title: ev.name,
      desc: `${modeText}\n\n正在翻找營地。`,
      preDesc: `${modeText}\n\n正在翻找營地。`,
      resultDesc: `${modeText}\n\n擲出 ${Dice.face(roll)}（${roll}），沒有找到可用物資。`,
      resultAppend: `擲出 ${Dice.face(roll)}（${roll}），沒有找到可用物資。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'danger', label: '翻找骰', value: roll, raw: roll, animate: true },
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },


};

Object.assign(Game, GameEventEncounters);

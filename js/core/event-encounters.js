// event-encounters methods extracted from js/core/event-handlers.js.
const GameEventEncounters = {
  _triggerTerrainCombat(cell, ev) {
    cell.cleared = false;
    const enemy = randomEnemy(G.phase === 'night');
    cell.type = 'enemy';
    cell.content = { enemy, event: ev };
    this._log(`${this._eventDiceInline(ev)}${ev.desc}`);
    this._triggerCombat(cell);
  },

  _settleTerrainCombatSmallReward(ev, enemy, attacker, roll, rollResult, combatLog = []) {
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
    if (Math.random() < CONFIG.SUPPLY_EQUIPMENT_CHANCE) {
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
      desc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : `${preDesc}${progress.text}`,
      preDesc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : undefined,
      resultDesc: progress.dice ? `${preDesc}${progress.text}` : undefined,
      resultAppend: progress.dice ? progress.text : undefined,
      dice: progress.dice,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    } else if (ev.itemOnly) {
      const progress = this._resolveProgressEventForModal(ev, null);
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n沒有找到可帶走的道具。${eventInfo}`;
      this._openModal({
        title: ev.name,
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
      if (ev.healTarget === 'lowest') {
        const target = this._aliveSquad().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (target) target.hp = Math.min(target.maxHp, target.hp + heal);
      } else {
        for (const char of this._aliveSquad()) char.hp = Math.min(char.maxHp, char.hp + heal);
      }
      const progress = this._resolveProgressEventForModal(ev, null);
      this._log(`${ev.name}：恢復生命。`, 'reward');
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n隊伍恢復 ${heal} HP。${eventInfo}`;
      this._openModal({
        title: ev.name,
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

    if (Math.random() < CONFIG.SUPPLY_EQUIPMENT_CHANCE) {
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
        choices: this._manualProgressChoices(ev, desc),
      });
      return;
    }

    if (ev.itemOnly) {
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n你們翻找了一陣，但沒有找到能帶走的物資。`;
      this._openModal({
        title: ev.name,
        desc,
        choices: this._manualProgressChoices(ev, desc),
      });
      return;
    }

    const heal = ev.heal || CONFIG.DEFAULT_SUPPLY_HEAL;
    if (ev.healTarget === 'lowest') {
      const target = this._aliveSquad().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (target) target.hp = Math.min(target.maxHp, target.hp + heal);
    } else {
      for (const char of this._aliveSquad()) char.hp = Math.min(char.maxHp, char.hp + heal);
    }
    this._log(`${ev.name}：隊伍恢復生命。`, 'reward');
    const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n沒有找到可用道具，但你們短暫休整，恢復了些許生命。`;
    this._openModal({
      title: ev.name,
      desc,
      choices: this._manualProgressChoices(ev, desc),
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
      dice: result.dice ? { ...result.dice, animate: true } : null,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerCaveStarlightShard(ev, rollResult = null) {
    if (!rollResult) {
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n星光碎片需要擲骰判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
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
      dice: { type: 'danger', label: '翻找骰', value: roll, raw: roll, animate: true },
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },


};

Object.assign(Game, GameEventEncounters);

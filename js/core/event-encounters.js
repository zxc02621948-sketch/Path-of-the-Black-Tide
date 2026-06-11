// event-encounters methods extracted from js/core/event-handlers.js.
const GameEventEncounters = {
  _triggerTerrainCombat(cell, ev) {
    cell.cleared = false;
    const enemy = ev.combatEnemyResolver === 'max_medium' && typeof getMaxTierMediumEnemy === 'function'
      ? getMaxTierMediumEnemy()
      : randomEnemy(G.phase === 'night');
    cell.type = 'enemy';
    cell.content = { enemy, event: ev, reward: ev.combatReward || null };
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}`,
      resultFx: 'event-ambush',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      eventSfx: ev.eventSfx || '',
      eventSfxVolume: ev.eventSfxVolume,
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
    let rewardDescHtml = '';
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
      rewardDescHtml = `<br><br>戰鬥後找到道具：${this._equipmentRewardLabelHtml(equip, countText)}<br>${this._modalTextHtml(equip.desc)}`;
    } else if (hasReward) {
      rewardDesc = this._revealNearbyFromEvent(1);
      rewardDescHtml = this._modalTextHtml(rewardDesc);
      this._log(`${ev.name} 勝利後揭露附近區域。`, 'reward');
    }

    this._openModal({
      title: '戰鬥勝利',
      desc: `${enemy.name} 被擊敗。${rewardDesc}`,
      descHtml: `${this._modalTextHtml(`${enemy.name} 被擊敗。`)}${rewardDescHtml}`,
      typeText: false,
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

  _triggerSupply(ev, cell = null) {
    if (ev?.id === 'ruins_supply_cache') {
      this._triggerRuinsSupplyCache(ev, cell);
      return;
    }
    if (ev?.id === 'forest_supply') {
      this._triggerForestSupplyPack(ev);
      return;
    }
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
      const preDescHtml = `${this._modalTextHtml(`${this._eventDiceText(ev)}${ev.desc || ''}`)}<br><br>獲得道具：${this._equipmentRewardLabelHtml(equip, countText)}<br>${this._modalTextHtml(equip.desc)}${this._modalTextHtml(eventInfo)}`;
      this._openModal({
        title: ev.name,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      desc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : `${preDesc}${progress.text}`,
      descHtml: progress.dice ? undefined : `${preDescHtml}${this._modalTextHtml(progress.text)}`,
      preDescHtml: progress.dice ? `${preDescHtml}<br><br>正在進行淨化判定。` : undefined,
      typeText: !progress.dice ? false : undefined,
      preDesc: progress.dice ? `${preDesc}\n\n正在進行淨化判定。` : undefined,
      resultDesc: progress.dice ? `${preDesc}${progress.text}` : undefined,
      resultAppend: progress.dice ? progress.text : undefined,
      dice: progress.dice,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
    } else if (rewardType === 'gear' && !ev.itemOnly) {
      const gear = randomGear(G.day);
      const progress = this._resolveProgressEventForModal(ev, null);
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n發現角色裝備：${gear.icon} ${gear.name}\n${gear.desc}${eventInfo}${progress.text}`;
      const descHtml = `${this._modalTextHtml(`${this._eventDiceText(ev)}${ev.desc || ''}`)}<br><br>發現角色裝備：${this._equipmentRewardLabelHtml(gear, '', 'equipment-inline-icon gear-reward-inline-icon')}<br>${this._modalTextHtml(gear.desc)}${this._modalTextHtml(eventInfo)}${this._modalTextHtml(progress.text)}`;
      this._openSupplyGearRewardModal(ev, gear, desc, null, descHtml);
    } else if (ev.itemOnly) {
      const progress = this._resolveProgressEventForModal(ev, null);
      const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n翻找過後，並沒有找到可用的道具。${eventInfo}`;
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
      if (!ev.skipHeal) {
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
      }
      const progress = this._resolveProgressEventForModal(ev, null);
      this._log(healed.length > 0 ? `${ev.name}：${healed.join('、')} HP。` : `${ev.name}：${ev.skipHeal ? '循著線索找到方向。' : '隊伍在此地稍作休整。'}`, healed.length > 0 ? 'reward' : 'dim');
      const healText = ev.skipHeal
        ? '你們循著線索前進，沒有找到可帶走的補給，但已經記下了方向。'
        : (healed.length > 0
          ? `隊伍在此地稍作休整，恢復生命：${healed.join('、')}。`
          : '隊伍在此地稍作休整，整理補給與傷勢。');
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

  _triggerForestSupplyPack(ev) {
    const rareGearMode = Math.random() < 0.20;
    const roll = Dice.rollRaw();
    if (rareGearMode) {
      this._resolveForestSupplyGear(ev, roll);
      return;
    }
    this._resolveForestSupplyItemOrRest(ev, roll);
  },

  _resolveForestSupplyItemOrRest(ev, roll) {
    const modeText = '分配補給：4-6 成功';
    const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n你們把補給包取下，先清點還能使用的東西。`;
    const success = roll >= 4;
    if (!success) {
      this._openForestSupplyRestResult(ev, roll, modeText, preDesc, '分配補給判定', '袋裡的物資多半受潮或破損，沒能整理出可帶走的一份。你們把還能用的破布、繃帶與火絨就地用掉，原地修整。');
      return;
    }

    this._ensureInventory();
    const equip = randomEquipment(G.day);
    const addResult = this._addInventoryItem(equip);
    if (!addResult.added) {
      this._openInventoryFullModal(ev, equip, `\n\n分配補給判定：${Dice.face(roll)}（${roll}），成功，但背包已滿，無法直接放入。`);
      return;
    }

    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    const resultText = `分配補給判定：${Dice.face(roll)}（${roll}），成功。\n\n你們把乾燥的繃帶、火絨與藥瓶分好，留下最完整的一份物資。\n\n獲得道具：${equip.icon} ${equip.name}${countText}\n${equip.desc}`;
    const resultHtml = `分配補給判定：${Dice.face(roll)}（${roll}），成功。<br><br>你們把乾燥的繃帶、火絨與藥瓶分好，留下最完整的一份物資。<br><br>獲得道具：${this._equipmentRewardLabelHtml(equip, countText)}<br>${this._modalTextHtml(equip.desc)}`;
    this._log(`${ev.name}：分配補給成功，獲得道具「${equip.name}」。`, 'reward');
    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: resultText,
      resultAppend: resultText,
      resultAppendHtml: resultHtml,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'neutral', label: '分配骰', value: roll, raw: roll, animate: true },
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _resolveForestSupplyGear(ev, roll) {
    const modeText = '翻查暗袋：1-2 發現裝備';
    const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n補給包底部有額外縫線，你們拆開暗袋檢查。`;
    const success = roll <= 2;
    if (!success) {
      this._openForestSupplyRestResult(ev, roll, modeText, preDesc, '翻查暗袋判定', '暗袋裡只剩潮掉的線團與碎布。你們把能用的材料就地整理，原地修整。');
      return;
    }

    const gear = randomGear(G.day);
    const resultText = `翻查暗袋判定：${Dice.face(roll)}（${roll}），成功。\n\n暗袋裡包著一件仍能使用的角色裝備。\n\n發現角色裝備：${gear.icon} ${gear.name}\n${gear.desc}`;
    const resultHtml = `翻查暗袋判定：${Dice.face(roll)}（${roll}），成功。<br><br>暗袋裡包著一件仍能使用的角色裝備。<br><br>發現角色裝備：${this._equipmentRewardLabelHtml(gear, '', 'equipment-inline-icon gear-reward-inline-icon')}<br>${this._modalTextHtml(gear.desc)}`;
    this._log(`${ev.name}：翻查暗袋成功，發現角色裝備「${gear.name}」。`, 'reward');
    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: resultText,
      resultAppend: resultText,
      resultAppendHtml: resultHtml,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'neutral', label: '翻找骰', value: roll, raw: roll, animate: true },
      choices: [{
        label: '分配裝備',
        action: () => this._openSupplyGearRewardModal(ev, gear, resultText, null, resultHtml),
      }],
    });
  },

  _openForestSupplyRestResult(ev, roll, modeText, preDesc, resultLabel, resultBody) {
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
    const restText = healed.length > 0 ? `恢復生命：${healed.join('、')}。` : '目前沒有人需要治療。';
    const resultText = `${modeText}\n\n${resultLabel}：${Dice.face(roll)}（${roll}），未獲得可攜帶物資。\n\n${resultBody}\n${restText}`;
    this._log(healed.length > 0 ? `${ev.name}：原地修整，${healed.join('、')} HP。` : `${ev.name}：原地修整。`, healed.length > 0 ? 'reward' : 'dim');
    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: resultText,
      resultAppend: resultText,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: 'neutral', label: resultLabel.replace('判定', ''), value: roll, raw: roll, animate: true },
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerRuinsSupplyCache(ev, cell = null) {
    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n倒塌的木架壓住幾只箱子。入口附近還能快速翻找，但若要深入倉庫，就得花時間搬開碎石與樑木。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        {
          label: '快速翻找',
          hint: '不消耗行動。較常找到普通道具，也可能只整理出可用材料。',
          action: () => this._resolveRuinsSupplyQuick(ev, cell),
        },
        {
          label: G.actionsLeft > 0 ? '深入調查（行動 -1）' : '深入調查（行動不足）',
          danger: true,
          hint: '行動 -1。更容易發現破舊寶箱，也可能遭遇寶箱擬態怪。',
          action: () => this._resolveRuinsSupplyDeep(ev, cell),
        },
        { label: '離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _resolveRuinsSupplyQuick(ev, cell = null) {
    const roll = Math.random();
    if (roll < 0.60) {
      this._openRuinsSupplyItemReward(ev, '你們在入口附近翻找，很快從倒塌架子下拉出一包還能使用的物資。', '快速翻找');
      return;
    }
    if (roll < 0.85) {
      this._openRuinsSupplyRestResult(ev, '你們翻開幾只潮壞的木箱，裡面多半只剩腐爛布料與碎裂瓶罐。能用的材料不多，但足夠讓隊伍原地修整。');
      return;
    }
    this._openRuinsSupplyChestResult(ev, cell, 'quick');
  },

  _resolveRuinsSupplyDeep(ev, cell = null) {
    if ((G.actionsLeft || 0) <= 0) {
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n天色與體力都不允許你們再搬開更深處的碎石。你們只能在入口附近稍作整理。`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [
          { label: '快速翻找', action: () => this._resolveRuinsSupplyQuick(ev, cell) },
          { label: '離開', action: () => { this._closeModal(); Render.fullRender(); } },
        ],
      });
      return;
    }
    G.actionsLeft = Math.max(0, G.actionsLeft - 1);
    const roll = Math.random();
    if (roll < 0.25) {
      this._openRuinsSupplyItemReward(ev, '你們花時間搬開斷樑，從倉庫深處整理出一份保存較完整的物資。', '深入調查', '行動 -1。');
      return;
    }
    if (roll < 0.50) {
      this._openRuinsSupplyRestResult(ev, '你們搬開碎石後只找到一堆腐壞物資。雖然沒有可帶走的東西，但拆下的布料與木片還能用來整備。', '行動 -1。');
      return;
    }
    this._openRuinsSupplyChestResult(ev, cell, 'deep', '行動 -1。');
  },

  _openRuinsSupplyChestResult(ev, cell = null, mode = 'quick', costText = '') {
    const chestRoll = Math.random();
    const quick = mode !== 'deep';
    if (quick) {
      if (chestRoll < 0.60) {
        this._openRuinsSupplyRestResult(ev, '破舊寶箱被撬開後，只剩空蕩蕩的木屑與鏽蝕零件。你們拆下還能用的材料，原地修整。', costText);
        return;
      }
      if (chestRoll < 0.95) {
        this._openRuinsSupplyItemReward(ev, '你們在破舊寶箱底部找到一份被油布包住的普通物資。', '破舊寶箱', costText);
        return;
      }
      this._openRuinsSupplyGearReward(ev, '箱底暗格裡卡著一件仍能使用的角色裝備。', costText);
      return;
    }

    if (chestRoll < 0.35) {
      this._openRuinsSupplyItemReward(ev, '倉庫深處的破舊寶箱裡，還留著一份包得很緊的物資。', '深入寶箱', costText);
      return;
    }
    if (chestRoll < 0.60) {
      this._openRuinsSupplyGearReward(ev, '你們撬開箱底夾層，找到一件能派上用場的角色裝備。', costText);
      return;
    }
    if (chestRoll < 0.85) {
      this._triggerRuinsWarehouseMimic(ev, cell, costText);
      return;
    }
    this._openRuinsSupplyRestResult(ev, '寶箱裡的東西早已腐壞，只有一些布條與木片還能拿來修整隊伍。', costText);
  },

  _openRuinsSupplyItemReward(ev, text, sourceLabel = '半塌的倉庫', costText = '') {
    this._ensureInventory();
    const item = randomEquipment(G.day);
    const addResult = this._addInventoryItem(item);
    if (!addResult.added) {
      this._openInventoryFullModal(ev, item, costText ? `\n\n${costText}` : '');
      return;
    }
    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    this._log(`${ev.name}：${sourceLabel}獲得道具「${item.name}」。`, 'reward');
    this._openModal({
      title: ev.name,
      descHtml: `${costText ? `${this._modalTextHtml(costText)}<br><br>` : ''}${this._modalTextHtml(text)}<br><br>獲得道具：${this._equipmentRewardLabelHtml(item, countText)}<br>${this._modalTextHtml(item.desc)}`,
      typeText: false,
      resultFx: 'event-reward',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _openRuinsSupplyGearReward(ev, text, costText = '') {
    const gear = randomGear(G.day);
    const desc = `${costText ? `${costText}\n\n` : ''}${text}\n\n發現角色裝備：${gear.icon} ${gear.name}\n${gear.desc}`;
    const descHtml = `${costText ? `${this._modalTextHtml(costText)}<br><br>` : ''}${this._modalTextHtml(text)}<br><br>發現角色裝備：${this._equipmentRewardLabelHtml(gear, '', 'equipment-inline-icon gear-reward-inline-icon')}<br>${this._modalTextHtml(gear.desc)}`;
    this._log(`${ev.name}：發現角色裝備「${gear.name}」。`, 'reward');
    this._openSupplyGearRewardModal(ev, gear, desc, null, descHtml);
  },

  _openRuinsSupplyRestResult(ev, text, costText = '') {
    const heal = ev.heal || CONFIG.DEFAULT_SUPPLY_HEAL;
    const healed = [];
    for (const char of this._aliveSquad()) {
      const before = char.hp;
      char.hp = Math.min(char.maxHp, char.hp + heal);
      if (char.hp > before) healed.push(`${char.name} +${char.hp - before}`);
    }
    const healText = healed.length > 0 ? `恢復生命：${healed.join('、')}。` : '目前沒有人需要治療。';
    this._log(healed.length > 0 ? `${ev.name}：原地修整，${healed.join('、')} HP。` : `${ev.name}：原地修整。`, healed.length > 0 ? 'reward' : 'dim');
    this._openModal({
      title: ev.name,
      desc: `${costText ? `${costText}\n\n` : ''}${text}\n${healText}`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerRuinsWarehouseMimic(ev, cell = null, costText = '') {
    const enemy = getTreasureMimicEnemy();
    if (cell) {
      cell.type = 'enemy';
      cell.content = { enemy, reward: 'warehouse_mimic', sourceEvent: ev };
      cell.cleared = false;
    }
    this._log(`${ev.name}：破舊寶箱張開利齒，寶箱擬態怪襲來。`, 'danger');
    this._openModal({
      title: ev.name,
      desc: `${costText ? `${costText}\n\n` : ''}你們撬開倉庫深處的破舊寶箱，箱內忽然傳出濕黏的磨牙聲。木板向外翻開，藏在裡面的東西撲了出來。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      eventSfx: enemy.spawnSfx || 'mimicSpawnGrowl',
      choices: [{
        label: '進入戰鬥',
        danger: true,
        action: () => {
          this._closeModal();
          if (cell) this._triggerCombat(cell);
        },
      }],
    });
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
      const descHtml = `${this._modalTextHtml(`${this._eventDiceText(ev)}${ev.desc || ''}`)}<br><br>獲得道具：${this._equipmentRewardLabelHtml(equip, countText)}<br>${this._modalTextHtml(equip.desc)}${this._modalTextHtml(eventInfo)}`;
      this._openModal({
        title: ev.name,
        desc,
        descHtml,
        typeText: false,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: this._manualProgressChoices(ev, desc),
      });
      return;
    }

    if (rewardType === 'gear') {
      const gear = randomGear(G.day);
      const baseDesc = `${this._eventDiceText(ev)}${ev.desc || ''}${eventInfo}`;
      const desc = `${baseDesc}\n\n發現角色裝備：${gear.icon} ${gear.name}\n${gear.desc}`;
      const descHtml = `${this._modalTextHtml(`${this._eventDiceText(ev)}${ev.desc || ''}`)}<br><br>發現角色裝備：${this._equipmentRewardLabelHtml(gear, '', 'equipment-inline-icon gear-reward-inline-icon')}<br>${this._modalTextHtml(gear.desc)}${this._modalTextHtml(eventInfo)}`;
      this._openSupplyGearRewardModal(ev, gear, desc, nextDesc => this._manualProgressChoices(ev, nextDesc), descHtml, baseDesc);
      return;
    }

    if (ev.itemOnly) {
      const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n翻找過後，並沒有找到可用的道具。`;
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
    this._log(healed.length > 0 ? `${ev.name}：${healed.join('、')} HP。` : `${ev.name}：隊伍在此地稍作休整。`, healed.length > 0 ? 'reward' : 'dim');
    const healText = healed.length > 0
      ? `沒有找到可用道具，但隊伍在此地稍作休整，恢復生命：${healed.join('、')}。`
      : '沒有找到可用道具，但隊伍在此地稍作休整，整理補給與傷勢。';
    const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n${healText}`;
    this._openModal({
      title: ev.name,
      desc,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: this._manualProgressChoices(ev, desc),
    });
  },

  _triggerCaveDrippingWater(cell, ev) {
    const desc = `${this._eventDiceText(ev)}${ev.desc || ''}\n\n這裡像是一處短暫的整修點。你們可以先取水休息，也可以搜尋洞穴，但停留太久也許會引來附近的東西。`;
    this._openModal({
      title: ev.name,
      desc,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        { label: '取水修整', action: () => this._resolveCaveWaterRest(cell, ev, false) },
        { label: '搜尋洞穴', action: () => this._resolveCaveWaterSearch(cell, ev, false) },
        { label: '離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _resolveCaveWaterRest(cell, ev, risky = false) {
    if (risky && this._rollCaveWaterAmbush(cell, ev)) return;

    const heal = ev.heal || 2;
    const healed = [];
    for (const char of this._aliveSquad()) {
      const before = char.hp;
      char.hp = Math.min(char.maxHp, char.hp + heal);
      if (char.hp > before) healed.push(`${char.name} +${char.hp - before}`);
    }
    const healText = healed.length > 0
      ? `全隊恢復生命：${healed.join('、')}。`
      : '隊伍在水邊稍作休息，整理補給與傷勢。';
    this._log(healed.length > 0 ? `${ev.name}：${healed.join('、')} HP。` : `${ev.name}：隊伍在此地稍作休整。`, healed.length > 0 ? 'reward' : 'dim');

    if (risky) {
      this._openModal({
        title: ev.name,
        desc: `你們在水窪旁短暫休整，冰冷的水氣讓呼吸慢慢穩定下來。\n\n${healText}`,
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    this._openModal({
      title: ev.name,
      desc: `小隊在水邊短暫休整，冰冷的水氣讓傷口不再那麼灼痛。\n\n${healText}\n\n洞穴深處仍傳來細微的回聲，或許還能再探索一下。\n\n但繼續停留，也可能引來附近的怪物。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        { label: '搜尋洞穴', danger: true, action: () => this._resolveCaveWaterSearch(cell, ev, true) },
        { label: '離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _resolveCaveWaterSearch(cell, ev, risky = false) {
    if (risky && this._rollCaveWaterAmbush(cell, ev)) return;

    this._ensureInventory();
    const equip = randomEquipment(G.day);
    const addResult = this._addInventoryItem(equip);
    if (!addResult.added) {
      this._openInventoryFullModal(ev, equip, '');
      return;
    }
    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    this._log(`${ev.name}：搜尋洞穴，獲得道具「${equip.name}」。`, 'reward');
    const rewardText = `你們沿著水窪旁的岩縫翻找，找到一件還能使用的物資。\n\n獲得道具：${equip.icon} ${equip.name}${countText}\n${equip.desc}`;
    const rewardHtml = `${this._modalTextHtml('你們沿著水窪旁的岩縫翻找，找到一件還能使用的物資。')}<br><br>獲得道具：${this._equipmentRewardLabelHtml(equip, countText)}<br>${this._modalTextHtml(equip.desc)}`;

    if (risky) {
      this._openModal({
        title: ev.name,
        desc: rewardText,
        descHtml: rewardHtml,
        typeText: false,
        resultFx: 'event-reward',
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    this._openModal({
      title: ev.name,
      desc: `${rewardText}\n\n水窪旁仍有乾淨的水源，或許可以趁機休息片刻。\n\n但此地太安靜了，繼續停留也許並不安全。`,
      descHtml: `${rewardHtml}${this._modalTextHtml('\n\n水窪旁仍有乾淨的水源，或許可以趁機休息片刻。\n\n但此地太安靜了，繼續停留也許並不安全。')}`,
      typeText: false,
      resultFx: 'event-reward',
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        { label: '取水修整', danger: true, action: () => this._resolveCaveWaterRest(cell, ev, true) },
        { label: '離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _rollCaveWaterAmbush(cell, ev) {
    const chance = Math.max(0, Math.min(1, ev.secondActionAmbushChance ?? 0.5));
    if (Math.random() >= chance) return false;
    const ambushEvent = {
      ...ev,
      type: 'combat',
      desc: '你們決定繼續停留。\n\n水聲、火光與翻動碎石的動靜在洞穴裡傳得太遠。附近的怪物被驚動，從陰影中撲了出來。',
      eventSfx: ev.eventSfx || 'eventDanger',
    };
    this._closeModal();
    this._log(`${ev.name}：停留太久，遭遇怪物襲擊。`, 'danger');
    this._triggerTerrainCombat(cell, ambushEvent);
    return true;
  },

  _rollSupplyRewardType() {
    const itemChance = Math.max(0, CONFIG.SUPPLY_EQUIPMENT_CHANCE ?? 0.35);
    const gearChance = Math.max(0, CONFIG.SUPPLY_GEAR_CHANCE ?? 0.15);
    const roll = Math.random();
    if (roll < itemChance) return 'item';
    if (roll < itemChance + gearChance) return 'gear';
    return 'heal';
  },

  _triggerForestForage(ev) {
    const hasAction = (G.actionsLeft || 0) > 0;
    const desc = `${this._eventDiceText(ev)}${ev.desc || ''}${hasAction ? '' : '\n\n今天已沒有餘裕深入採集。'}`;
    const choices = [];
    if (hasAction) {
      choices.push({
        label: '深入採集（行動 -1）',
        action: () => this._resolveForestForageDeep(ev),
      });
    }
    choices.push({
      label: '快速摘取',
      action: () => this._resolveForestForageQuick(ev),
    });
    choices.push({
      label: '離開',
      action: () => {
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

  _resolveForestForageDeep(ev) {
    if ((G.actionsLeft || 0) <= 0) {
      this._resolveForestForageQuick(ev);
      return;
    }
    G.actionsLeft = Math.max(0, G.actionsLeft - 1);

    const herb = getEquipById('herb_pack');
    const gear = randomGear(G.day);
    if (!herb || !gear) {
      this._openModal({
        title: ev.name,
        desc: '你們花時間沿著濕滑坡地採集，但最後只找到幾株已經腐爛的草葉。',
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    const openGearReward = (herbText, herbHtml = '') => {
      const desc = [
        '你們花時間沿著濕滑坡地採集，撥開樹根旁的濕葉，把還能辨認的草藥整理成一份藥包。',
        '行動 -1。',
        herbText,
        '',
        `那只舊布包裡還留著一件能派上用場的裝備。`,
        `發現角色裝備：${gear.icon} ${gear.name}`,
        gear.desc,
      ].filter(line => line !== '').join('\n');
      const descHtml = [
        '你們花時間沿著濕滑坡地採集，撥開樹根旁的濕葉，把還能辨認的草藥整理成一份藥包。<br>行動 -1。',
        herbHtml || this._modalTextHtml(herbText),
        `那只舊布包裡還留著一件能派上用場的裝備。<br>發現角色裝備：${this._equipmentRewardLabelHtml(gear, '', 'equipment-inline-icon gear-reward-inline-icon')}<br>${this._modalTextHtml(gear.desc)}`,
      ].join('<br><br>');
      this._openSupplyGearRewardModal(ev, gear, desc, null, descHtml);
    };

    const addResult = this._addInventoryItem(herb);
    if (!addResult.added) {
      this._log(`${ev.name}：深入採集，行動 -1，背包已滿但發現草藥包與裝備。`, 'reward');
      this._openForestForageHerbFullModal(ev, herb, openGearReward);
      return;
    }

    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    const herbText = `獲得道具：${herb.icon} ${herb.name}${countText}\n${herb.desc}`;
    const herbHtml = `獲得道具：${this._equipmentRewardLabelHtml(herb, countText)}<br>${this._modalTextHtml(herb.desc)}`;
    this._log(`${ev.name}：深入採集，行動 -1，獲得草藥包並發現裝備「${gear.name}」。`, 'reward');
    openGearReward(herbText, herbHtml);
  },

  _openForestForageHerbFullModal(ev, herb, continueWithGear) {
    const choices = [];
    const continueAfter = (text, html = '') => {
      continueWithGear(text, html || this._modalTextHtml(text));
    };
    const targets = this._aliveSquad();
    if (targets.length > 0 && herb.useOutOfCombat !== false) {
      choices.push({
        label: `立即使用「${herb.name}」`,
        action: () => {
          this._openModal({
            _isEquipUse: true,
            title: `使用道具：${herb.name}`,
            desc: `${herb.desc}\n\n選擇使用目標。`,
            choices: targets.map(char => ({
              label: `${char.name}（HP ${char.hp}/${char.maxHp}）`,
              action: () => {
                const result = EquipmentRules.use(G, char, herb);
                if (result.log) this._log(result.log, 'reward');
                continueAfter(`背包已滿，你們直接使用草藥包。\n${result.log || ''}`.trim());
              },
            })).concat([{ label: '返回', action: () => this._openForestForageHerbFullModal(ev, herb, continueWithGear) }]),
          });
        },
      });
    }
    for (let i = 0; i < G.inventory.length; i++) {
      const slot = G.inventory[i];
      const oldItem = this._inventoryItem(slot);
      if (!oldItem) continue;
      const countText = (slot.count || 1) > 1 ? ` x${slot.count}` : '';
      choices.push({
        label: `丟棄「${oldItem.name}${countText}」，換成「${herb.name}」`,
        action: () => {
          G.inventory[i] = { item: { ...herb }, count: 1 };
          this._log(`丟棄「${oldItem.name}${countText}」，放入「${herb.name}」。`, 'reward');
          continueAfter(`背包已重新整理，放入 ${herb.icon} ${herb.name}。\n${herb.desc}`);
        },
      });
    }
    choices.push({
      label: `放棄「${herb.name}」`,
      action: () => {
        this._log(`${ev.name}：背包已滿，放棄草藥包。`, 'dim');
        continueAfter('背包已滿，你們只能把草藥包留在原地。');
      },
    });

    this._openModal({
      title: '背包已滿',
      descHtml: `${this._modalTextHtml(ev?.name || '霧中採集路')}<br><br>你們整理出一份 ${this._equipmentRewardLabelHtml(herb)}，但背包已滿，無法直接放入。<br>${this._modalTextHtml(herb.desc)}<br><br>先處理這份草藥包，再分配舊布包裡找到的裝備。`,
      typeText: false,
      choices,
    });
  },

  _resolveForestForageQuick(ev) {
    const herb = getEquipById('herb_pack');
    if (!herb) {
      this._openModal({
        title: ev.name,
        desc: '你們只在路邊停了片刻，但那些草葉早已受潮腐敗，最後沒有帶走任何東西。',
        eventImage: ev.eventImage || '',
        eventImageAlt: ev.name || '',
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }
    const addResult = this._addInventoryItem(herb);
    if (!addResult.added) {
      this._log(`${ev.name}：快速摘取草藥包，但背包已滿。`, 'reward');
      this._openInventoryFullModal(ev, herb, '');
      return;
    }
    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    this._log(`${ev.name}：快速摘取，獲得草藥包。`, 'reward');
    this._openModal({
      title: ev.name,
      descHtml: `你們只在路邊停了片刻，挑走幾株氣味仍清的草藥，沒有冒險深入濕滑坡地。<br><br>獲得道具：${this._equipmentRewardLabelHtml(herb, countText)}<br>${this._modalTextHtml(herb.desc)}`,
      typeText: false,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _openSupplyGearRewardModal(ev, gear, desc, nextChoices = null, descHtml = '', nextBaseDesc = '') {
    const choices = this._aliveSquad().map(char => ({
      label: `${char.name}${char.gear ? `（替換 ${char.gear.name}）` : ''}`,
      action: () => {
        const current = char.gear;
        char.gear = { ...gear };
        const equipLine = `${char.name} 裝備「${gear.name}」${current ? `，替換「${current.name}」` : ''}。`;
        this._log(`${ev.name}：${equipLine}`, 'reward');
        if (typeof nextChoices === 'function') {
          const nextDesc = nextBaseDesc || desc;
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
          const nextDesc = `${nextBaseDesc || desc}\n\n你們放棄了這件裝備。`;
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
      descHtml: descHtml || undefined,
      typeText: descHtml ? false : undefined,
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
      const resultHtml = `大成功：你們獲得 ${this._equipmentRewardLabelHtml(equip, countText)}。<br>${this._modalTextHtml(equip.desc)}`;
      this._openModal({
        title: ev.name,
        desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        preDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n正在進行淨化判定。4-5 成功降低黑暗 1；6 大成功降低黑暗 2，或有機率獲得道具。`,
        resultDesc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n大成功：你們獲得 ${equip.icon} ${equip.name}${countText}。\n${equip.desc}`,
        resultAppend: `大成功：你們獲得 ${equip.icon} ${equip.name}${countText}。\n${equip.desc}`,
        resultAppendHtml: resultHtml,
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
      const rewardHtml = `擲出 ${Dice.face(roll)}（${roll}），成功獲得 ${this._equipmentRewardLabelHtml(equip)}。<br>${this._modalTextHtml(equip.desc)}`;
      this._openModal({
        title: ev.name,
        desc: `${modeText}\n\n正在翻找營地。`,
        preDesc: `${modeText}\n\n正在翻找營地。`,
        resultDesc: `${modeText}\n\n擲出 ${Dice.face(roll)}（${roll}），成功獲得 ${equip.icon} ${equip.name}。\n${equip.desc}`,
        resultAppend: `擲出 ${Dice.face(roll)}（${roll}），成功獲得 ${equip.icon} ${equip.name}。\n${equip.desc}`,
        resultAppendHtml: rewardHtml,
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

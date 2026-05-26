// event-treasure methods extracted from js/core/event-handlers.js.
const GameEventTreasure = {
  _triggerTreasureMap(cell, ev) {
    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer' && c.hp > 0)
      || this._aliveSquad().sort((a, b) => b.hp - a.hp)[0];
    if (!attacker) { Render.fullRender(); return; }

    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n使用探索骰判定藏寶圖結果：單數會使藏寶圖破損，但仍會顯示一個可能有危險的寶箱；雙數會顯示只出武器的寶箱。`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [
        { label: `${attacker.name} 擲探索骰`, action: () => this._rollTreasureMap(ev, attacker) },
        { label: '暫時離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _rollTreasureMap(ev, attacker) {
    const rollResult = this._rollWithMods('explore', attacker, { successMin: 1 });
    rollResult.animate = true;
    const roll = rollResult.value;
    const preDesc = `${this._eventDiceText(ev)}${ev.desc || ''}`;
    let desc = `${attacker.name} 正在擲探索骰解讀藏寶圖。\n\n${attacker.name} 擲出 ${Dice.face(roll)}（${roll}）。`;
    let choices = [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }];

    if (roll % 2 === 1) {
      const chestCell = this._placeTreasureChestRandom('broken');
      if (chestCell) {
        desc += `\n\n單數：藏寶圖破損，但仍指出一個可疑寶箱位置 (${chestCell.x},${chestCell.y})。這個寶箱可能只有怪物或普通物品。`;
        this._log(`藏寶圖破損，顯示可疑寶箱 (${chestCell.x},${chestCell.y})。`, 'dim');
      } else {
        desc += '\n\n單數：藏寶圖破損，但地圖上沒有合適位置可放置寶箱。';
        this._log('藏寶圖破損，未能顯示寶箱。', 'dim');
      }
    } else {
      const chestCell = this._placeTreasureChestRandom('weapon');
      if (chestCell) {
        desc += `\n\n雙數：找到武器寶箱位置 (${chestCell.x},${chestCell.y})。`;
        this._log(`藏寶圖找到武器寶箱 (${chestCell.x},${chestCell.y})。`, 'reward');
      } else {
        desc += '\n\n雙數：找到寶藏方向，但地圖上沒有合適位置可放置寶箱。';
        this._log('藏寶圖未能放置武器寶箱。', 'dim');
      }
    }

    this._openModal({
      title: ev.name,
      desc: preDesc,
      preDesc,
      resultDesc: `${preDesc}\n\n${desc}`,
      resultAppend: desc,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      dice: { type: roll % 2 === 0 ? 'neutral' : 'danger', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: true, charCls: rollResult.charCls },
      choices,
    });
  },

  _placeTreasureChestRandom(kind = 'weapon') {
    const candidates = [];
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (!cell || cell.type !== 'empty' || cell.content || cell.hiddenSite || cell.cleared) continue;
        if (cell.x === G.playerX && cell.y === G.playerY) continue;
        candidates.push(cell);
      }
    }
    if (candidates.length === 0) return null;
    const cell = candidates[Math.floor(Math.random() * candidates.length)];
    cell.type = 'chest';
    cell.content = { chest: true, chestKind: kind };
    cell.revealed = true;
    cell.cleared = false;
    return cell;
  },

  _triggerDarkWhisper(cell, ev) {
    this._applyDarkness(1, ev.name || '黑暗低語');
    const chestCell = this._placeTreasureChestRandom('dark_gift');
    const foundText = chestCell
      ? `低語在遠處凝成一個黑暗贈禮寶箱。\n\n寶箱位置：(${chestCell.x},${chestCell.y})。`
      : '低語尋不到合適的落點，只在空地裡散成冷霧。';
    this._log(chestCell
      ? `黑暗低語標記黑暗贈禮寶箱 (${chestCell.x},${chestCell.y})。`
      : '黑暗低語未能標記黑暗贈禮寶箱。',
      chestCell ? 'reward' : 'dim');
    this._openModal({
      title: ev.name,
      desc: `${ev.desc || ''}\n\n「黑暗記得每個進來的人的名字。」\n\n黑暗 +1。\n${foundText}`,
      eventImage: ev.eventImage || '',
      eventImageAlt: ev.name || '',
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerWeaponChest(cell) {
    if (cell.content?.chestKind === 'dark_gift') {
      this._triggerDarkGiftChest(cell);
      return;
    }
    if (cell.content?.chestKind === 'broken') {
      this._triggerBrokenTreasureChest(cell);
      return;
    }

    const weapon = randomWeaponForSquad(G.squad);
    if (!weapon) {
      cell.type = 'empty';
      cell.content = null;
      cell.cleared = true;
      this._openModal({
        title: '寶箱',
        desc: '寶箱裡沒有適合目前隊伍的武器。',
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    const choices = this._aliveSquad().map(char => {
      const current = char.weapon;
      const upgraded = current?.id === weapon.id && weapon.upgradeTo ? getWeaponById(weapon.upgradeTo) : null;
      const label = upgraded
        ? `${char.name}：升級為 ${upgraded.name}`
        : `${char.name}：裝備 ${weapon.name}${current ? `（替換 ${current.name}）` : ''}`;
      return {
        label,
        action: () => this._giveWeaponFromChest(cell, char, weapon),
      };
    });
    choices.push({
      label: `放棄「${weapon.name}」`,
      action: () => {
        this._clearWeaponChest(cell);
        this._log(`放棄寶箱中的武器「${weapon.name}」。`, 'dim');
        this._closeModal();
        Render.fullRender();
      },
    });
    this._log(`發現武器寶箱：${weapon.name}。`, 'reward');

    this._openModal({
      title: `寶箱：${weapon.name}`,
      desc: `${weapon.icon} ${weapon.name}\n${weapon.desc}\n\n選擇要交給哪位角色。若角色已持有同型武器，會改為升級。`,
      choices,
    });
  },

  _triggerBrokenTreasureChest(cell) {
    if (Math.random() < 0.5) {
      const enemy = getTreasureMimicEnemy();
      cell.type = 'enemy';
      cell.content = { enemy, reward: 'treasure_mimic' };
      cell.cleared = false;
      this._log('破損寶箱張開利齒，寶箱擬態怪襲來。', 'danger');
      this._triggerCombat(cell);
      return;
    }

    const item = randomEquipment(G.day);
    const addResult = this._addInventoryItem(item);
    this._clearWeaponChest(cell);
    if (!addResult.added) {
      this._openInventoryFullModal({
        name: '破損寶箱',
        desc: '寶箱裡找到一件普通道具，但背包已滿。',
      }, item, '');
      return;
    }
    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    this._log(`破損寶箱中獲得道具「${item.name}」。`, 'reward');
    this._openModal({
      title: '破損寶箱',
      desc: `你們找到 ${item.icon} ${item.name}${countText}。\n${item.desc}`,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _triggerDarkGiftChest(cell) {
    if (Math.random() < 0.45) {
      const enemy = typeof getDarkGiftMimicEnemy === 'function' ? getDarkGiftMimicEnemy() : getTreasureMimicEnemy();
      cell.type = 'enemy';
      cell.content = { enemy, reward: 'dark_gift_mimic' };
      cell.cleared = false;
      this._log(`黑暗贈禮寶箱變成黑匣擬態，原生弱點為 ${enemy.weakness}。`, 'danger');
      this._triggerCombat(cell);
      return;
    }

    const item = randomEquipment(G.day);
    const addResult = this._addInventoryItem(item);
    this._clearWeaponChest(cell);
    if (!addResult.added) {
      this._openInventoryFullModal({
        name: '黑暗贈禮寶箱',
        desc: '黑暗贈禮吐出一件道具，但背包已滿。',
      }, item, '');
      return;
    }
    const countText = addResult.count > 1 ? ` x${addResult.count}` : '';
    this._log(`黑暗贈禮寶箱中獲得道具「${item.name}」。`, 'reward');
    this._openModal({
      title: '黑暗贈禮寶箱',
      desc: `黑匣沒有張開牙齒，只吐出一件能用的東西。\n\n你們找到 ${item.icon} ${item.name}${countText}。\n${item.desc}`,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _settleTreasureMimicVictory(cell, enemy, attacker, roll, rollResult, combatLog = [], finalHitDesc = '', combatAnims = null) {
    const baseChance = CONFIG.TREASURE_MIMIC_GEAR_DROP_CHANCE ?? 0.5;
    const boostedChance = CONFIG.TREASURE_MIMIC_WEAKNESS_GEAR_DROP_CHANCE ?? 0.8;
    const chance = enemy?.gearDropBoost ? boostedChance : baseChance;
    const dropped = Math.random() < chance;

    if (!dropped) {
      this._clearWeaponChest(cell);
      this._openModal({
        title: '戰鬥勝利',
        desc: `${enemy.name} 被擊敗。${finalHitDesc ? `\n${finalHitDesc}` : ''}\n\n箱體碎裂，裡面的裝備也跟著毀壞。`,
        combatLog,
        combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
        combatAnims,
        dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: roll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
        choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }

    const gear = randomGear(G.day);
    this._log(`寶箱擬態怪掉落角色裝備「${gear.name}」。`, 'reward');
    this._openModal({
      title: '戰鬥勝利',
      desc: `${enemy.name} 被擊敗。${finalHitDesc ? `\n${finalHitDesc}` : ''}\n\n箱體崩裂後留下可用的裝備。\n\n${gear.icon} ${gear.name}\n${gear.desc}${enemy?.gearDropBoost ? '\n\n命中原生弱點使掉落率提高。' : ''}`,
      combatLog,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 擊敗 ${enemy.name}`),
      combatAnims,
      dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: roll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      choices: [],
    });
    setTimeout(() => this._openTreasureMimicGearModal(cell, enemy, gear, combatLog), this._combatAnimWaitMs(combatAnims));
  },

  _settleDarkGiftMimicVictory(cell, enemy, attacker, roll, rollResult, combatLog = [], finalHitDesc = '', combatAnims = null) {
    this._applyDarkness(-1, '黑匣擬態');
    const reward = this._rollDarkGiftMimicReward();
    const openedText = enemy?.darkGiftOpened
      ? '\n\n天然骰面命中原生弱點，黑匣直接開啟。'
      : '';
    this._log(`黑匣擬態掉落${reward.label}「${reward.name}」。`, 'reward');
    this._openModal({
      title: '黑匣開啟',
      desc: `${enemy.name} 被擊敗。${finalHitDesc ? `\n${finalHitDesc}` : ''}${openedText}\n\n黑暗 -1。\n\n黑匣留下 ${reward.icon} ${reward.name}。\n${reward.desc}`,
      combatLog,
      combat: this._buildCombatScene(enemy, attacker, `${attacker.name} 開啟 ${enemy.name}`),
      combatAnims,
      dice: { type: 'combat', label: `${attacker.name} 的攻擊骰`, value: roll, raw: rollResult.raw, floored: rollResult.floored, charCls: rollResult.charCls, sides: rollResult.sides, dodecaFateDice: rollResult.dodecaFateDice, dodecaLuckyDice: rollResult.dodecaLuckyDice },
      choices: reward.type === 'gear'
        ? []
        : this._darkGiftRewardAssignChoices(cell, reward),
    });
    if (reward.type === 'gear') {
      setTimeout(() => this._openDarkGiftRewardAssignModal(cell, reward, combatLog), this._combatAnimWaitMs(combatAnims));
    }
  },

  _rollDarkGiftMimicReward() {
    const roll = Math.random();
    if (roll < 0.45) {
      const gear = randomGear(G.day);
      return { type: 'gear', label: '角色裝備', ...gear };
    }
    if (roll < 0.80) {
      const weapon = randomWeaponForSquad(G.squad);
      if (weapon) return { type: 'weapon', label: '武器', ...weapon };
    }
    const pool = this._getAvailableRelics([...getDayRelics(), ...getNightRelics()]);
    if (pool.length > 0) {
      const relic = weightedRelicPick(pool);
      return { type: 'relic', label: '聖物', ...relic };
    }
    const gear = randomGear(G.day);
    return { type: 'gear', label: '角色裝備', ...gear };
  },

  _darkGiftRewardAssignChoices(cell, reward) {
    if (reward.type === 'weapon') {
      const choices = this._aliveSquad().map(char => {
        const current = char.weapon;
        const upgraded = current?.id === reward.id && reward.upgradeTo ? getWeaponById(reward.upgradeTo) : null;
        const label = upgraded
          ? `${char.name}：升級為 ${upgraded.name}`
          : `${char.name}：裝備 ${reward.name}${current ? `（替換 ${current.name}）` : ''}`;
        return { label, action: () => this._giveWeaponFromChest(cell, char, reward) };
      });
      choices.push({
        label: `放棄「${reward.name}」`,
        action: () => {
          this._clearWeaponChest(cell);
          this._log(`放棄黑匣擬態掉落的武器「${reward.name}」。`, 'dim');
          this._closeModal();
          Render.fullRender();
        },
      });
      return choices;
    }

    if (reward.type === 'relic') {
      const carriers = reward.scholarOnly
        ? this._aliveSquad().filter(c => c.cls === 'scholar')
        : this._aliveSquad();
      const choices = carriers.map(char => ({
        label: `${char.name}${char.relic ? `（替換 ${char.relic.name}）` : ''}`,
        detail: char.relic ? `目前效果：${char.relic.desc}` : '',
        action: () => {
          const grant = () => {
            const result = this._grantFateTableRelic(char, reward);
            this._clearWeaponChest(cell);
            this._openModal({
              title: `獲得聖物：${reward.name}`,
              desc: [
                `${char.name} 獲得聖物「${reward.name}」。`,
                result?.replaced ? `原本的「${result.replaced.name}」掉落在原地。` : '',
                this._resonanceActivatedText(result?.newly || []),
              ].filter(Boolean).join('\n'),
              choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
            });
          };
          if (char.relic) {
            this._confirmRelicReplacement(char, reward, grant, { onCancel: () => this._openModal({
              title: `獲得聖物：${reward.name}`,
              desc: `${reward.icon} ${reward.name}\n${reward.desc}\n\n選擇要交給哪位角色。`,
              choices,
            }) });
            return;
          }
          grant();
        },
      }));
      choices.push({
        label: `放棄「${reward.name}」`,
        action: () => {
          this._clearWeaponChest(cell);
          this._log(`放棄黑匣擬態掉落的聖物「${reward.name}」。`, 'dim');
          this._closeModal();
          Render.fullRender();
        },
      });
      return choices;
    }

    const choices = this._aliveSquad().map(char => ({
      label: `${char.name}：裝備 ${reward.name}${char.gear ? `（替換 ${char.gear.name}）` : ''}`,
      action: () => this._giveGearFromTreasureMimic(cell, char, reward),
    }));
    choices.push({
      label: `放棄「${reward.name}」`,
      action: () => {
        this._clearWeaponChest(cell);
        this._log(`放棄黑匣擬態掉落的裝備「${reward.name}」。`, 'dim');
        this._closeModal();
        Render.fullRender();
      },
    });
    return choices;
  },

  _openDarkGiftRewardAssignModal(cell, reward, combatLog = []) {
    if (reward.type === 'weapon') {
      const choices = this._aliveSquad().map(char => {
        const current = char.weapon;
        const upgraded = current?.id === reward.id && reward.upgradeTo ? getWeaponById(reward.upgradeTo) : null;
        const label = upgraded
          ? `${char.name}：升級為 ${upgraded.name}`
          : `${char.name}：裝備 ${reward.name}${current ? `（替換 ${current.name}）` : ''}`;
        return { label, action: () => this._giveWeaponFromChest(cell, char, reward) };
      });
      choices.push({
        label: `放棄「${reward.name}」`,
        action: () => {
          this._clearWeaponChest(cell);
          this._log(`放棄黑匣擬態掉落的武器「${reward.name}」。`, 'dim');
          this._closeModal();
          Render.fullRender();
        },
      });
      this._openModal({
        title: `獲得武器：${reward.name}`,
        desc: `${reward.icon} ${reward.name}\n${reward.desc}\n\n選擇要交給哪位角色。若角色已持有同型武器，會改為升級。`,
        combatLog,
        choices,
      });
      return;
    }

    if (reward.type === 'relic') {
      const carriers = reward.scholarOnly
        ? this._aliveSquad().filter(c => c.cls === 'scholar')
        : this._aliveSquad();
      const choices = carriers.map(char => ({
        label: `${char.name}${char.relic ? `（替換 ${char.relic.name}）` : ''}`,
        detail: char.relic ? `目前效果：${char.relic.desc}` : '',
        action: () => {
          const grant = () => {
            const result = this._grantFateTableRelic(char, reward);
            this._clearWeaponChest(cell);
            this._openModal({
              title: `獲得聖物：${reward.name}`,
              desc: [
                `${char.name} 獲得聖物「${reward.name}」。`,
                result?.replaced ? `原本的「${result.replaced.name}」掉落在原地。` : '',
                this._resonanceActivatedText(result?.newly || []),
              ].filter(Boolean).join('\n'),
              choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
            });
          };
          if (char.relic) {
            this._confirmRelicReplacement(char, reward, grant, {
              onCancel: () => this._openDarkGiftRewardAssignModal(cell, reward, combatLog),
            });
            return;
          }
          grant();
        },
      }));
      choices.push({
        label: `放棄「${reward.name}」`,
        action: () => {
          this._clearWeaponChest(cell);
          this._log(`放棄黑匣擬態掉落的聖物「${reward.name}」。`, 'dim');
          this._closeModal();
          Render.fullRender();
        },
      });
      this._openModal({
        title: `獲得聖物：${reward.name}`,
        desc: `${reward.icon} ${reward.name}\n${reward.desc}\n\n選擇要交給哪位角色。`,
        combatLog,
        choices,
      });
      return;
    }

    this._openGearRewardModal({
      gear: reward,
      combatLog,
      abandonLog: `放棄黑匣擬態掉落的裝備「${reward.name}」。`,
      clear: () => this._clearWeaponChest(cell),
    });
  },

  _openTreasureMimicGearModal(cell, enemy, gear, combatLog = []) {
    this._openGearRewardModal({
      gear,
      combatLog,
      boostText: enemy?.gearDropBoost ? '命中原生弱點使掉落率提高。' : '',
      abandonLog: `放棄寶箱擬態怪掉落的裝備「${gear.name}」。`,
      clear: () => this._clearWeaponChest(cell),
    });
  },

  _openGearRewardModal({ gear, combatLog = [], boostText = '', abandonLog = '', clear = null }) {
    this._gearAssignContext = { gear, clear, abandonLog };
    this._openModal({
      title: `發現裝備：${gear.name}`,
      descHtml: this._gearRewardCardHtml(gear, boostText),
      typeText: false,
      resultFx: 'event-reward',
      combatLog,
      choices: [
        { label: '分配裝備', action: () => this._openGearAssignTargetModal(gear, clear, abandonLog) },
        {
          label: '放棄裝備',
          className: 'relic-abandon-choice',
          action: () => {
            this._gearAssignContext = null;
            if (typeof clear === 'function') clear();
            this._log(abandonLog || `放棄裝備「${gear.name}」。`, 'dim');
            this._closeModal();
            Render.fullRender();
          },
        },
      ],
    });
  },

  _openGearAssignTargetModal(gear, clear = null, abandonLog = '') {
    const assignOptions = this._aliveSquad().map(char => ({
      char,
      actionLabel: char.gear ? '替換' : '裝備',
      currentGear: char.gear || null,
      action: () => this._giveGearFromTreasureMimic({ clear }, char, gear),
    }));
    this._gearAssignContext = { gear, options: assignOptions, clear, abandonLog };
    this._openModal({
      title: `發現裝備：${gear.name}`,
      descHtml: this._gearAssignPanelHtml(assignOptions),
      typeText: false,
      choices: [{
        label: '放棄裝備',
        className: 'relic-abandon-choice',
        action: () => {
          this._gearAssignContext = null;
          if (typeof clear === 'function') clear();
          this._log(abandonLog || `放棄裝備「${gear.name}」。`, 'dim');
          this._closeModal();
          Render.fullRender();
        },
      }],
    });
  },

  chooseGearAssignTarget(index) {
    const option = this._gearAssignContext?.options?.[index];
    if (option?.action) option.action();
  },

  _gearRewardCardHtml(gear, boostText = '') {
    const visual = gear.iconImage
      ? `<img class="relic-reward-img gear-reward-img" src="${this._escapeAttrLocal(gear.iconImage)}" alt="">`
      : `<span class="relic-reward-emoji">${this._escapeHtmlLocal(gear.icon || '◆')}</span>`;
    return `
      <div class="relic-reward-panel relic-reward-display gear-reward-panel">
        <div class="relic-reward-visual">${visual}</div>
        <div class="relic-reward-copy">
          <div class="relic-reward-desc">${this._escapeHtmlLocal(gear.desc || '')}</div>
          ${boostText ? `<div class="relic-reward-lore">${this._escapeHtmlLocal(boostText)}</div>` : ''}
        </div>
      </div>
    `;
  },

  _gearAssignPanelHtml(assignOptions = []) {
    const assignCards = assignOptions.length
      ? assignOptions.map((option, index) => this._gearAssignTargetCardHtml(option, index)).join('')
      : '<div class="relic-assign-empty">沒有可裝備這件裝備的角色。</div>';
    return `
      <div class="relic-assign-panel gear-assign-panel">
        <div class="relic-assign-instruction">選擇要交給哪位角色。</div>
        <div class="relic-assign-target-grid">${assignCards}</div>
      </div>
    `;
  },

  _gearAssignTargetCardHtml(option, index) {
    const char = option.char;
    const cls = CHARACTER_CLASSES[char.cls] || {};
    const hpText = `${Math.max(0, char.hp || 0)}/${char.maxHp || 0}`;
    const current = option.currentGear
      ? `<span class="relic-assign-current">替換：${this._escapeHtmlLocal(option.currentGear.name || '既有裝備')}</span>`
      : '<span class="relic-assign-current empty">空欄位</span>';
    const battleArt = char.battleArt || (typeof CLASS_BATTLE_ART !== 'undefined' ? CLASS_BATTLE_ART[char.cls] : '');
    const art = battleArt ? `<span class="relic-assign-art"><img src="${this._escapeAttrLocal(battleArt)}" alt=""></span>` : '';
    return `
      <button type="button" class="relic-assign-target-card gear-assign-target-card${option.currentGear ? ' replace' : ''}" onclick="Game.chooseGearAssignTarget(${index})">
        ${art}
        <span class="relic-assign-head">
          <span class="relic-assign-class">${this._escapeHtmlLocal(cls.icon || '◆')}</span>
          <span class="relic-assign-name">${this._escapeHtmlLocal(char.name || '')}</span>
          <span class="relic-assign-action">${this._escapeHtmlLocal(option.actionLabel || '裝備')}</span>
        </span>
        <span class="relic-assign-meta">HP ${this._escapeHtmlLocal(hpText)}</span>
        ${current}
      </button>
    `;
  },

  _openTreasureMimicGearAssignModal(cell, enemy, gear, combatLog = []) {
    const choices = this._aliveSquad().map(char => ({
      label: `${char.name}：裝備 ${gear.name}${char.gear ? `（替換 ${char.gear.name}）` : ''}`,
      action: () => this._giveGearFromTreasureMimic(cell, char, gear),
    }));
    choices.push({
      label: `放棄「${gear.name}」`,
      action: () => {
        this._clearWeaponChest(cell);
        this._log(`放棄寶箱擬態怪掉落的裝備「${gear.name}」。`, 'dim');
        this._closeModal();
        Render.fullRender();
      },
    });

    this._openModal({
      title: `獲得裝備：${gear.name}`,
      desc: `${gear.icon} ${gear.name}\n${gear.desc}${enemy?.gearDropBoost ? '\n\n命中原生弱點使掉落率提高。' : ''}\n\n選擇要交給哪位角色。`,
      combatLog,
      choices,
    });
  },

  _giveWeaponFromChest(cell, char, weapon) {
    const current = char.weapon;
    const upgraded = current?.id === weapon.id && weapon.upgradeTo ? getWeaponById(weapon.upgradeTo) : null;
    if (upgraded) {
      char.weapon = { ...upgraded };
      this._log(`${char.name} 的武器升級為 ${upgraded.name}。`, 'reward');
    } else {
      char.weapon = { ...weapon };
      this._log(`${char.name} 裝備武器「${weapon.name}」${current ? `，替換「${current.name}」` : ''}。`, 'reward');
    }
    this._clearWeaponChest(cell);
    this._closeModal();
    Render.fullRender();
  },

  _giveGearFromTreasureMimic(cell, char, gear) {
    const current = char.gear;
    char.gear = { ...gear };
    this._log(`${char.name} 裝備「${gear.name}」${current ? `，替換「${current.name}」` : ''}。`, 'reward');
    this._gearAssignContext = null;
    if (typeof cell?.clear === 'function') {
      cell.clear();
    } else {
      this._clearWeaponChest(cell);
    }
    this._closeModal();
    Render.fullRender();
  },

  _clearWeaponChest(cell) {
    cell.type = 'empty';
    cell.content = null;
    cell.cleared = true;
  },

  _triggerFateGamblingTable(cell, ev) {
    const candidates = this._aliveSquad();
    if (candidates.length === 0) { Render.fullRender(); return; }
    G.fateGamblingTableTriggered = true;
    this._openFateTableIntro(ev);
  },

  _openFateTableIntro(ev) {
    this._openModal({
      title: ev.name,
      desc: this._eventDiceText(ev) + (ev.desc || ''),
      eventBackdrop: ev.eventImage || '',
      choices: [
        { label: '進入賭桌', action: () => this._openFateTableRoundSetup({ ev, round: 1 }) },
        { label: '轉身離開', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _fateTableRoundInfo(round) {
    const rounds = {
      1: {
        name: '第一局：血賭',
        rule: '賭奇數。必須賭到成功才可進入下一局；失敗時上桌角色受傷，傷害逐次提高。',
        diceLabel: '血賭骰',
        successText: '奇數',
        rewardText: '命運贈禮：聖物二選一。',
      },
      2: {
        name: '第二局：夜賭',
        rule: '賭偶數。必須賭到成功才可進入下一局；失敗時黑暗依序 +2、+4、+8。',
        diceLabel: '夜賭骰',
        successText: '偶數',
        rewardText: '命運贈禮：免費融合一次。',
      },
      3: {
        name: '第三局：命賭',
        rule: '先選大或小。小為 1-3，大為 4-6；失敗時上桌角色受到 15 傷害，且黑暗 +1。',
        diceLabel: '命賭骰',
        successText: '你選中的大小',
        rewardText: '命運贈禮：聖物二選一，並免費融合一次。',
      },
    };
    return rounds[round] || rounds[1];
  },

  _fateTableLeavePenalty(round) {
    if (round >= 3) return 2;
    if (round >= 2) return 1;
    return 0;
  },

  _fateTableRoundBackdrop(round) {
    if (round === 1) return 'assets/events/fate-table-blood-wager.png';
    if (round === 2) return 'assets/events/fate-table-night-wager.png';
    if (round === 3) return 'assets/events/fate-table-life-wager.png';
    return '';
  },

  _fateTableFailureBackdrop(round) {
    if (round === 1) return 'assets/events/fate-table-blood-fail.png';
    if (round === 2) return 'assets/events/fate-table-night-fail.png';
    if (round === 3) return 'assets/events/fate-table-life-fail.png';
    return '';
  },

  _fateTableFailureFx(round) {
    if (round === 1) return 'fate-fail-blood';
    if (round === 2) return 'fate-fail-night';
    if (round === 3) return 'fate-fail-life';
    return '';
  },

  _fateTableNextFailureText(round, ctx = {}) {
    if (round === 1) {
      const damage = 4 + Math.max(0, ctx.bloodLosses || 0) * 2;
      return `下一次血賭失敗：上桌角色受到 ${damage} 傷害。`;
    }
    if (round === 2) {
      const dark = Math.min(8, 2 * Math.pow(2, Math.max(0, ctx.darkLosses || 0)));
      return `下一次夜賭失敗：黑暗 +${dark}。`;
    }
    return '命賭失敗固定：上桌角色受到 15 傷害，黑暗 +1。';
  },

  _openFateTableRoundSetup(ctx) {
    const candidates = this._aliveSquad();
    if (candidates.length === 0) { Render.fullRender(); return; }
    const round = Math.max(1, Math.min(3, ctx?.round || 1));
    const info = this._fateTableRoundInfo(round);
    const leavePenalty = this._fateTableLeavePenalty(round);
    const choices = [];

    if (round === 2) {
      choices.push({
        label: '開始夜賭',
        danger: true,
        action: () => this._rollFateGamblingTable({ ...ctx, round }, null),
      });
    } else {
      for (const char of candidates) {
        if (round === 3) {
          choices.push({
            label: `讓 ${char.name} 坐上賭桌（HP ${char.hp}/${char.maxHp}）`,
            action: () => this._openFateTableHighLowChoice({ ...ctx, round }, char),
          });
        } else {
          choices.push({
            label: `讓 ${char.name} 坐上賭桌（HP ${char.hp}/${char.maxHp}）`,
            action: () => this._rollFateGamblingTable({ ...ctx, round }, char),
          });
        }
      }
    }

    choices.push({
      label: leavePenalty > 0 ? `離開賭桌（黑暗 +${leavePenalty}）` : '離開賭桌',
      danger: leavePenalty > 0,
      action: () => this._leaveFateGamblingTable(round),
    });

    this._openModal({
      title: `命運賭桌：${info.name}`,
      desc: [
        round === 1
          ? '你們走到空椅前。骨骰安靜地躺在桌中央，像是在等第一個名字。'
          : round === 2
            ? '第二枚骰子自行滾上桌面。這一次，賭桌不看任何人的血，只看黑夜願意吞下多少光。'
            : '你已經把手伸進賭局，桌面仍在等待下一枚骰子。',
        '',
        info.rule,
        this._fateTableNextFailureText(round, ctx),
        info.rewardText,
        leavePenalty > 0 ? `此時離桌必須支付黑暗 +${leavePenalty}。` : '此時離桌沒有代價。',
      ].filter(Boolean).join('\n'),
      eventBackdrop: this._fateTableRoundBackdrop(round),
      choices,
    });
  },

  _openFateTableHighLowChoice(ctx, gambler) {
    if (!gambler || gambler.dead || gambler.hp <= 0) {
      this._openFateTableRoundSetup(ctx);
      return;
    }
    this._openModal({
      title: '命運賭桌：第三局・命賭',
      desc: [
        `${gambler.name} 坐上空椅。`,
        '',
        '選擇這一局要賭大或小。',
        '小為 1-3，大為 4-6。',
        this._fateTableNextFailureText(3, ctx),
      ].join('\n'),
      choices: [
        { label: '賭小（1-3）', action: () => this._rollFateGamblingTable(ctx, gambler, 'low') },
        { label: '賭大（4-6）', action: () => this._rollFateGamblingTable(ctx, gambler, 'high') },
        { label: '返回選人', action: () => this._openFateTableRoundSetup(ctx) },
      ],
    });
  },

  _rollFateGamblingTable(ctx, gambler, guess = null) {
    const round = Math.max(1, Math.min(3, ctx?.round || 1));
    if (round !== 2 && (!gambler || gambler.dead || gambler.hp <= 0)) {
      this._openFateTableRoundSetup(ctx);
      return;
    }
    const rollerName = gambler?.name || '賭桌';
    const rollerCls = gambler?.cls || '';
    const roll = Dice.rollRaw();
    const isSuccess = round === 1
      ? roll % 2 === 1
      : round === 2
        ? roll % 2 === 0
        : (guess === 'low' ? roll <= 3 : roll >= 4);

    if (isSuccess) {
      this._resolveFateTableSuccess(ctx, gambler, roll, guess, rollerName, rollerCls);
    } else {
      this._resolveFateTableFailure(ctx, gambler, roll, guess, rollerName, rollerCls);
    }
  },

  _resolveFateTableSuccess(ctx, gambler, roll, guess = null, rollerName = null, rollerCls = '') {
    const round = Math.max(1, Math.min(3, ctx?.round || 1));
    const info = this._fateTableRoundInfo(round);
    const name = rollerName || gambler?.name || '賭桌';
    const guessText = round === 3 ? `你選擇${guess === 'low' ? '小' : '大'}，` : '';
    const preDesc = round === 2
      ? `賭桌自行擲出${info.diceLabel}。`
      : `${name} 將${info.diceLabel}擲向賭桌。`;
    const resultAppend = [
      `${name} 擲出 ${Dice.face(roll)}（${roll}）。${guessText}賭局命中${info.successText}。`,
      '',
      round === 1
        ? '骰聲停下時，桌面裂開一道細光。命運看見了你的影子。'
        : round === 2
          ? '黑夜沒有退去，只是替你讓出了一條歪斜的路。'
          : '命運終於抬眼。它沒有微笑，卻把不屬於你的東西推到你面前。',
      '',
      info.rewardText,
    ].join('\n');

    const acceptAction = round === 1
      ? () => this._openFateTableRelicChoice(ctx, '命運贈禮：聖物', '桌面上浮現兩件被黑霧托起的聖物。選擇一件帶走。', () => this._openFateTableDecision(ctx))
      : round === 2
        ? () => this._openFateTableFusionChoice(ctx, '命運贈禮：融合', '命運替一件聖物打開了不經神壇的縫隙。選擇要融合的角色。', () => this._openFateTableDecision(ctx))
        : () => this._acceptFinalFateTableGift(ctx);

    this._openModal({
      title: `命運賭桌：${info.name}`,
      desc: preDesc,
      preDesc,
      resultAppend,
      resultTitle: `命運賭桌：${info.name}成功`,
      resultFx: 'fate-roll-success',
      dice: { type: 'neutral', label: `${name} 的${info.diceLabel}`, value: roll, raw: roll, animate: true, charCls: rollerCls },
      eventBackdrop: this._fateTableRoundBackdrop(round),
      choices: [{ label: '接受命運贈禮', action: acceptAction }],
    });
  },

  _resolveFateTableFailure(ctx, gambler, roll, guess = null, rollerName = null, rollerCls = '') {
    const round = Math.max(1, Math.min(3, ctx?.round || 1));
    const info = this._fateTableRoundInfo(round);
    const name = rollerName || gambler?.name || '賭桌';
    const guessText = round === 3 ? `你選擇${guess === 'low' ? '小' : '大'}，` : '';
    const preDesc = round === 2
      ? `賭桌自行擲出${info.diceLabel}。`
      : `${name} 將${info.diceLabel}擲向賭桌。`;
    let resultAppend = '';
    let dead = false;
    let nextCtx = { ...ctx, round };

    if (round === 1) {
      const damage = 4 + Math.max(0, ctx?.bloodLosses || 0) * 2;
      nextCtx.bloodLosses = Math.max(0, ctx?.bloodLosses || 0) + 1;
      gambler.hp = Math.max(0, gambler.hp - damage);
      dead = gambler.hp <= 0;
      if (dead) this._removeGamblerAtFateTable(gambler);
      resultAppend = [
        `${name} 擲出 ${Dice.face(roll)}（${roll}），不是奇數。`,
        '',
        `血賭失利：${name} 受到 ${damage} 傷害。`,
        dead ? `${name} 被桌下的黑影拖離隊伍。` : `賭桌沒有聲音，卻像是在笑。下一次血賭失敗將受到 ${damage + 2} 傷害。`,
      ].join('\n');
    } else if (round === 2) {
      const lossCount = Math.max(0, ctx?.darkLosses || 0);
      const dark = Math.min(8, 2 * Math.pow(2, lossCount));
      nextCtx.darkLosses = lossCount + 1;
      this._applyDarkness(dark, '命運賭桌夜賭失利');
      if (G.phase === 'over') return;
      const nextDark = Math.min(8, dark * 2);
      resultAppend = [
        `${name} 擲出 ${Dice.face(roll)}（${roll}），不是偶數。`,
        '',
        `夜賭失利：黑暗 +${dark}。`,
        '你們沒有失去血，卻聽見遠處有什麼東西因此醒來。',
        `下一次夜賭失敗將使黑暗 +${nextDark}。`,
      ].join('\n');
    } else {
      const damage = 15;
      gambler.hp = Math.max(0, gambler.hp - damage);
      this._applyDarkness(1, '命運賭桌命賭失利');
      if (G.phase === 'over') return;
      dead = gambler.hp <= 0;
      if (dead) this._removeGamblerAtFateTable(gambler);
      resultAppend = [
        `${name} 擲出 ${Dice.face(roll)}（${roll}）。${guessText}賭局落空。`,
        '',
        `命賭失利：${name} 受到 ${damage} 傷害，黑暗 +1。`,
        dead ? `${name} 的名字被刻進桌面，再也沒有回應。` : '命運沒有收回視線，只是把代價推到你面前。',
      ].join('\n');
    }

    const leavePenalty = this._fateTableLeavePenalty(round);
    const choices = [
      {
        label: `繼續${info.name}`,
        danger: round >= 3,
        action: () => { if (dead && this._checkLose()) return; this._openFateTableRoundSetup(nextCtx); },
      },
      {
        label: leavePenalty > 0 ? `離開賭桌（黑暗 +${leavePenalty}）` : '離開賭桌',
        danger: leavePenalty > 0,
        action: () => { if (dead && this._checkLose()) return; this._leaveFateGamblingTable(round); },
      },
    ];

    this._openModal({
      title: `命運賭桌：${info.name}`,
      desc: preDesc,
      preDesc,
      resultAppend,
      resultTitle: `命運賭桌：${info.name}失敗`,
      resultBackdrop: this._fateTableFailureBackdrop(round),
      resultFx: this._fateTableFailureFx(round),
      dice: { type: 'neutral', label: `${name} 的${info.diceLabel}`, value: roll, raw: roll, animate: true, charCls: rollerCls },
      eventBackdrop: this._fateTableRoundBackdrop(round),
      choices,
    });
  },

  _openFateTableDecision(ctx) {
    const round = Math.max(1, Math.min(3, ctx?.round || 1));
    const nextRound = round + 1;
    if (nextRound > 3) {
      this._finishFateGamblingTable('命運賭桌：賭局結束', '賭桌收起所有聲音。命運沒有道別，只留下你們仍在呼吸。');
      return;
    }
    const leavePenalty = this._fateTableLeavePenalty(round);
    const choices = [
      {
        label: `繼續下注：${this._fateTableRoundInfo(nextRound).name}`,
        danger: nextRound >= 3,
        action: () => this._openFateTableRoundSetup({ ...ctx, round: nextRound }),
      },
      {
        label: leavePenalty > 0 ? `離開賭桌（黑暗 +${leavePenalty}）` : '離開賭桌',
        danger: leavePenalty > 0,
        action: () => this._leaveFateGamblingTable(round),
      },
    ];
    this._openModal({
      title: '命運賭桌：是否繼續',
      desc: [
        '你可以把手收回，也可以把下一個人推向空椅。',
        '',
        leavePenalty > 0
          ? `現在離桌會支付黑暗 +${leavePenalty}。這不是失敗，是貪婪留下的帳。`
          : '現在離桌沒有代價。第一把只是試探命運。',
      ].join('\n'),
      choices,
    });
  },

  _leaveFateGamblingTable(round = 1) {
    const penalty = this._fateTableLeavePenalty(round);
    if (penalty > 0) {
      this._applyDarkness(penalty, '命運賭桌離桌代價');
      if (G.phase === 'over') return;
    }
    this._openModal({
      title: '命運賭桌：離桌',
      desc: [
        penalty > 0
          ? '你把手抽回來，但桌面仍留下你的指紋。黑夜記住了這筆債。'
          : '你們沒有坐下。骰子輕輕轉了一圈，像是在笑。',
        '',
        penalty > 0 ? `黑暗 +${penalty}。` : '事件結束。',
      ].join('\n'),
      choices: [{ label: '離開', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _finishFateGamblingTable(title, desc) {
    this._openModal({
      title,
      desc,
      choices: [{ label: '離開賭桌', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _openFateTableRelicChoice(ctx, title, intro, onDone) {
    const pool = this._getAvailableRelics([...getDayRelics(), ...getNightRelics()]);
    const relicChoices = typeof this._pickEventRelicChoices === 'function'
      ? this._pickEventRelicChoices(pool)
      : pool.slice(0, 2);
    if (relicChoices.length === 0) {
      this._openModal({
        title,
        desc: `${intro}\n\n桌面上的霧散得太快，沒有聖物成形。`,
        choices: [{ label: '繼續', action: onDone }],
      });
      return;
    }

    G.fateTableRelicChoiceContext = { ctx, title, intro, relicChoices, onDone };

    this._openModal({
      title,
      descHtml: `
        <div class="event-relic-choice-intro">
          <p>${this._escapeEventHtml(intro)}</p>
          <p>命運把兩件聖物推到桌面，只允許你們帶走其中一件。</p>
        </div>
        <div class="event-relic-choice-grid">
          ${relicChoices.map((relic, index) => this._fateTableRelicChoiceCardHtml(relic, index)).join('')}
        </div>
      `,
      typeText: false,
      choices: [{
        label: '放棄聖物',
        action: () => {
          G.fateTableRelicChoiceContext = null;
          if (typeof onDone === 'function') onDone();
        },
      }],
    });
  },

  _fateTableRelicChoiceCardHtml(relic, index) {
    const lore = this._getFirstLore(relic.id);
    const shortDesc = this._shortEventRelicDesc(relic.desc || '');
    const relicClass = String(relic.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
    const visual = relic.iconImage
      ? `<img class="event-relic-choice-img" src="${this._escapeEventAttr(relic.iconImage)}" alt="">`
      : `<span class="event-relic-choice-emoji">${this._escapeEventHtml(relic.icon || '◆')}</span>`;
    return `
      <button type="button" class="event-relic-choice relic-${relicClass}" onclick="Game.chooseFateTableRelicChoice(${index})">
        <span class="event-relic-choice-visual">${visual}</span>
        <span class="event-relic-choice-body">
          <span class="event-relic-choice-kicker">接受命運贈禮</span>
          <span class="event-relic-choice-name">${this._escapeEventHtml(relic.name || '未知聖物')}</span>
          <span class="event-relic-choice-desc">${this._escapeEventHtml(shortDesc)}</span>
          ${lore ? `<span class="event-relic-choice-lore">「${this._escapeEventHtml(this._shortEventRelicDesc(lore, 32))}」</span>` : ''}
        </span>
      </button>
    `;
  },

  chooseFateTableRelicChoice(index) {
    const ctx = G.fateTableRelicChoiceContext;
    const relic = ctx?.relicChoices?.[index];
    if (!ctx || !relic) return;
    this._openFateTableRelicAssignModal({
      title: ctx.title,
      intro: ctx.intro,
      relic,
      onDone: ctx.onDone,
    });
  },

  _openFateTableRelicAssignModal({ title, intro, relic, onDone }) {
    if (!relic) return;
    const carriers = relic.scholarOnly
      ? this._aliveSquad().filter(c => c.cls === 'scholar')
      : this._aliveSquad();
    const choices = carriers.map(char => ({
      label: `${char.name}${char.relic ? `（替換 ${char.relic.name}）` : ''}`,
      detail: char.relic ? `目前效果：${char.relic.desc}` : '',
      action: () => {
        const grant = () => {
          const result = this._grantFateTableRelic(char, relic);
          G.fateTableRelicChoiceContext = null;
          this._openModal({
            title: `${title}：完成`,
            desc: [
              `${char.name} 獲得聖物「${relic.name}」。`,
              result?.replaced ? `原本的「${result.replaced.name}」掉落在原地。` : '',
              this._resonanceActivatedText(result?.newly || []),
            ].filter(Boolean).join('\n'),
            choices: [{ label: '繼續', action: onDone }],
          });
        };
        if (char.relic) {
          this._confirmRelicReplacement(char, relic, grant, {
            onCancel: () => this._openFateTableRelicAssignModal({ title, intro, relic, onDone }),
          });
          return;
        }
        grant();
      },
    }));
    choices.push({
      label: '放棄聖物',
      action: () => {
        this._log(`命運賭桌：放棄聖物「${relic.name}」。`, 'dim');
        G.fateTableRelicChoiceContext = null;
        if (typeof onDone === 'function') onDone();
      },
    });

    this._openModal({
      title,
      desc: `${intro}\n\n獲得「${relic.name}」。\n${relic.desc}`,
      choices,
    });
  },

  _fateTableFusionCandidates() {
    return this._aliveSquad().filter(char =>
      char.relic &&
      char.relic.fusable !== false &&
      !char.fusedRelic
    );
  },

  _openFateTableFusionChoice(ctx, title, intro, onDone) {
    const candidates = this._fateTableFusionCandidates();
    if (candidates.length === 0) {
      this._openModal({
        title,
        desc: `${intro}\n\n目前沒有可融合的聖物。命運的贈禮在桌面上空響了一聲。`,
        choices: [{ label: '繼續', action: onDone }],
      });
      return;
    }

    const choices = candidates.map(char => ({
      label: `${char.name}：融合「${char.relic.name}」`,
      action: () => {
        const result = this._grantFateTableFusion(char);
        this._openModal({
          title: `${title}：完成`,
          desc: [
            `${char.name} 免費融合聖物「${result.relic?.name || '未知聖物'}」。`,
            this._resonanceActivatedText(result.newly || []),
          ].filter(Boolean).join('\n'),
          choices: [{ label: '繼續', action: onDone }],
        });
      },
    }));
    choices.push({ label: '放棄融合', action: onDone });

    this._openModal({
      title,
      desc: `${intro}\n\n本次融合不消耗行動，也不降低最大生命。`,
      choices,
    });
  },

  _grantFateTableFusion(char) {
    if (!char?.relic || char.relic.fusable === false || char.fusedRelic) return { relic: null, newly: [] };
    const relic = char.relic;
    const fusedRelic = { ...relic };
    if (fusedRelic.fusedEffect) fusedRelic.effect = { ...fusedRelic.fusedEffect };

    char.fusedRelic = fusedRelic;
    char.relic = null;

    this._applyFusionBonus(char, fusedRelic);
    this._removeMapRelicsById(fusedRelic.id);
    this._unlockNote(fusedRelic.id, true);
    const newly = this._updateResonances();
    this._log(`${char.name} 在命運賭桌免費融合聖物「${fusedRelic.name}」。`, 'reward');
    return { relic: fusedRelic, newly };
  },

  _acceptFinalFateTableGift(ctx) {
    const finish = () => this._finishFateGamblingTable(
      '命運賭桌：命運贈禮',
      '命運把最後一枚籌碼推回你們面前。賭桌上的光熄滅，只剩黑夜慢慢合攏。'
    );
    const fusionStep = () => this._openFateTableFusionChoice(
      ctx,
      '命運贈禮：融合',
      '最後的賭局讓一件聖物短暫鬆動，像是等著被塞進另一段命運。',
      finish
    );
    this._openFateTableRelicChoice(
      ctx,
      '命運贈禮：聖物',
      '賭桌裂開一道細光，兩件聖物從黑霧裡浮起。',
      fusionStep
    );
  },

  _grantFateTableRelic(char, relic) {
    if (!char || !relic) return { newly: [], replaced: null };
    let replaced = null;
    if (char.relic) {
      replaced = { ...char.relic };
      this._removeRelicEffect(char, char.relic);
      this._dropRelicAt(G.playerX, G.playerY, char.relic);
      this._log(char.name + ' 原本的聖物掉落在原地。', 'dim');
    }
    char.relic = { ...relic };
    this._applyRelicEquip(char, relic);
    this._unlockNote(relic.id);
    const newly = this._updateResonances();
    this._log(char.name + ' 獲得聖物「' + relic.name + '」。', 'reward');
    return { newly, replaced };
  },

  _removeGamblerAtFateTable(gambler) {
    this._removeRelicEffect(gambler, gambler.relic);
    this._removeRelicEffect(gambler, gambler.fusedRelic);
    this._removeFusionBonus(gambler, gambler.fusedRelic);
    G.squad = G.squad.filter(c => c.id !== gambler.id);
    this._updateResonances();
  },


};

Object.assign(Game, GameEventTreasure);

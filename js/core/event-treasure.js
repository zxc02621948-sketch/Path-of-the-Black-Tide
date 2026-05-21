// event-treasure methods extracted from js/core/event-handlers.js.
const GameEventTreasure = {
  _triggerTreasureMap(cell, ev) {
    const attacker = G.squad.find(c => !c.dead && c.cls === 'explorer' && c.hp > 0)
      || this._aliveSquad().sort((a, b) => b.hp - a.hp)[0];
    if (!attacker) { Render.fullRender(); return; }

    this._openModal({
      title: ev.name,
      desc: `${this._eventDiceText(ev)}${ev.desc || ''}\n\n使用探索骰判定藏寶圖結果：單數會使藏寶圖破損，但仍會顯示一個可能有危險的寶箱；雙數會顯示只出武器的寶箱。`,
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
      dice: { type: roll % 2 === 0 ? 'neutral' : 'danger', label: `${attacker.name} 的探索骰`, value: roll, raw: rollResult.raw, animate: true, charCls: rollResult.charCls },
      choices,
    });
  },

  _placeTreasureChestRandom(kind = 'weapon') {
    const candidates = [];
    for (const row of G.map || []) {
      for (const cell of row || []) {
        if (!cell || cell.type !== 'empty' || cell.content || cell.hiddenSite || cell.cleared || cell.reserved) continue;
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
      choices: [{
        label: `分配「${gear.name}」`,
        action: () => this._openTreasureMimicGearModal(cell, enemy, gear, combatLog),
      }],
    });
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
      choices: this._darkGiftRewardAssignChoices(cell, reward),
    });
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

    this._openTreasureMimicGearModal(cell, null, reward, combatLog);
  },

  _openTreasureMimicGearModal(cell, enemy, gear, combatLog = []) {
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
    this._clearWeaponChest(cell);
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
    const choices = candidates.map(char => ({
      label: `讓 ${char.name} 坐上賭桌`,
      action: () => this._rollFateGamblingTable(char, 0),
    }));
    choices.push({ label: '離開賭桌', action: () => { this._closeModal(); Render.fullRender(); } });
    this._openModal({
      title: ev.name,
      desc: this._eventDiceText(ev) + (ev.desc || ''),
      choices,
    });
  },

  _rollFateGamblingTable(gambler, failureCount) {
    const roll = Dice.rollRaw();
    const isOdd = roll % 2 === 1;
    if (isOdd) {
      const preDesc = gambler.name + ' 將命運骰擲向賭桌。';
      const resultAppend = [
        gambler.name + ' 擲出 ' + Dice.face(roll) + '（' + roll + '），骰面為單數。',
        '',
        '骨骰停止。黑霧像被刀切開一樣散去。',
        '黑暗中的聲音低低笑了起來：「命運看見你了。」',
        '',
        '你可以取走賭桌上的骰子，也可以讓它換成另一件聖物。',
      ].join('\n');
      this._openModal({
        title: '命運賭桌：成功',
        desc: preDesc,
        preDesc,
        resultAppend,
        dice: { type: 'neutral', label: gambler.name + ' 的命運骰', value: roll, raw: roll, animate: true, charCls: gambler.cls },
        choices: [
          { label: '取得賭命骰子', action: () => this._awardWagerDiceFromFateTable(gambler) },
          { label: '換成隨機聖物', action: () => this._awardRandomRelicFromFateTable(gambler) },
        ],
      });
      return;
    }

    const nextFailureCount = failureCount + 1;
    const damage = 2 + nextFailureCount * 2;
    gambler.hp = Math.max(0, gambler.hp - damage);
    if (gambler.hp <= 0) {
      this._removeGamblerAtFateTable(gambler);
      const preDesc = gambler.name + ' 將命運骰擲向賭桌。';
      const resultAppend = [
        gambler.name + ' 擲出 ' + Dice.face(roll) + '（' + roll + '），骰面為雙數。',
        '',
        '賭桌傷害 ' + damage + ' 點讓 ' + gambler.name + ' 倒下。',
        '黑影從桌面裂縫中伸出，把他按回那張空椅子。',
        '',
        gambler.name + ' 永久離隊，未獲得賭命骰子。',
      ].join('\n');
      this._openModal({
        title: '命運賭桌：倒下',
        desc: preDesc,
        preDesc,
        resultAppend,
        dice: { type: 'danger', label: gambler.name + ' 的命運骰', value: roll, raw: roll, animate: true, charCls: gambler.cls },
        choices: [{ label: '離開賭桌', action: () => { this._closeModal(); if (this._checkLose()) return; Render.fullRender(); } }],
      });
      return;
    }

    const desc = nextFailureCount === 1
      ? [
          gambler.name + ' 擲出 ' + Dice.face(roll) + '（' + roll + '），骰面為雙數。',
          '',
          '第一次失敗：' + gambler.name + ' 受到 ' + damage + ' 傷害。',
          '賭桌沒有聲音，卻像是在笑。',
          '',
          '下一次失敗傷害提高為 ' + (damage + 2) + '。',
        ].join('\n')
      : [
          gambler.name + ' 再次擲出 ' + Dice.face(roll) + '（' + roll + '），仍是雙數。',
          '',
          '連續失敗：' + gambler.name + ' 受到 ' + damage + ' 傷害。',
          '黑色裂紋沿著桌面爬上他的手臂。',
          '',
          '下一次失敗傷害提高為 ' + (damage + 2) + '。',
        ].join('\n');

    const nextDamage = damage + 2;
    const preDesc = gambler.name + (nextFailureCount === 1 ? ' 將命運骰擲向賭桌。' : ' 再次將命運骰擲向賭桌。');
    this._openModal({
      title: '命運賭桌：失敗',
      desc: preDesc,
      preDesc,
      resultAppend: desc,
      dice: { type: 'danger', label: gambler.name + ' 的命運骰', value: roll, raw: roll, animate: true, charCls: gambler.cls },
      choices: [
        { label: '繼續擲骰（下次失敗 ' + nextDamage + ' 傷害）', action: () => this._rollFateGamblingTable(gambler, nextFailureCount) },
        { label: '停手離開', action: () => this._leaveFateGamblingTable(gambler) },
      ],
    });
  },

  _leaveFateGamblingTable(gambler) {
    this._openModal({
      title: '命運賭桌：停手離開',
      desc: [
        gambler.name + ' 的手停在骰子上方。',
        '',
        '最後，他把手收了回來。',
        '黑暗中的聲音像是在嘲笑，又像是在惋惜。',
        '',
        '「活著的人，才有下一把。」',
        '',
        '事件結束，未獲得賭命骰子。',
      ].join('\n'),
      choices: [{ label: '離開', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _awardWagerDiceFromFateTable(gambler) {
    const relic = getEventRelicById('wager_dice') || getRelicById('wager_dice');
    if (!relic) {
      this._openModal({
        title: '命運賭桌：空無一物',
        desc: '賭桌上的骰子碎成粉末，什麼也沒有留下。',
        choices: [{ label: '離開賭桌', action: () => { this._closeModal(); Render.fullRender(); } }],
      });
      return;
    }
    this._openFateTableRelicAssignModal({
      title: '命運賭桌：取得賭命骰子',
      intro: gambler.name + ' 收下賭桌上的骰子。黑暗中的笑聲逐漸遠去。',
      relic,
    });
  },

  _awardRandomRelicFromFateTable(gambler) {
    const pool = this._getAvailableRelics([...getDayRelics(), ...getNightRelics()]);
    if (pool.length === 0) {
      this._awardWagerDiceFromFateTable(gambler);
      return;
    }
    const relic = weightedRelicPick(pool);
    this._openFateTableRelicAssignModal({
      title: '命運賭桌：隨機聖物',
      intro: gambler.name + ' 推開賭桌上的骰子，黑霧凝成另一件聖物。',
      relic,
    });
  },

  _openFateTableRelicAssignModal({ title, intro, relic }) {
    if (!relic) return;
    const carriers = relic.scholarOnly
      ? this._aliveSquad().filter(c => c.cls === 'scholar')
      : this._aliveSquad();
    const choices = carriers.map(char => ({
      label: `${char.name}${char.relic ? `（替換 ${char.relic.name}）` : ''}`,
      detail: char.relic ? `目前效果：${char.relic.desc}` : '',
      action: () => {
        const result = this._grantFateTableRelic(char, relic);
        this._openModal({
          title: `${title}：完成`,
          desc: [
            `${char.name} 獲得聖物「${relic.name}」。`,
            result?.replaced ? `原本的「${result.replaced.name}」掉落在原地。` : '',
            this._resonanceActivatedText(result?.newly || []),
          ].filter(Boolean).join('\n'),
          choices: [{ label: '離開賭桌', action: () => { this._closeModal(); Render.fullRender(); } }],
        });
      },
    }));
    choices.push({
      label: '放棄聖物',
      action: () => {
        this._log(`命運賭桌：放棄聖物「${relic.name}」。`, 'dim');
        this._closeModal();
        Render.fullRender();
      },
    });

    this._openModal({
      title,
      desc: `${intro}\n\n獲得「${relic.name}」。\n${relic.desc}`,
      choices,
    });
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

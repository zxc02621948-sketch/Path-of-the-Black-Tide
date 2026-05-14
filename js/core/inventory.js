// inventory methods extracted from js/core/game.js.
const GameInventory = {
  // Section.
  // Section.
  useInventoryItem(itemIndex) {
    if (G.modal || G.phase === 'over') return;
    this._ensureInventory();
    const idx = Number(itemIndex);
    const slot = G.inventory[idx];
    const item = this._inventoryItem(slot);
    if (!slot || !item) return;
    if (item.effect?.type === 'wish_chest') {
      this._openWishChest(idx);
      return;
    }
    if (item.useOutOfCombat === false) {
      Render.fullRender();
      return;
    }
    const targets = this._aliveSquad();
    if (targets.length === 0) return;

    this._openModal({
      _isEquipUse: true,
      title: `使用道具：${item.name}`,
      desc: `${item.desc}\n\n選擇使用目標。`,
      choices: targets.map(char => ({
        label: `${char.name}（HP ${char.hp}/${char.maxHp}）`,
        action: () => {
          const result = EquipmentRules.use(G, char, item);
          if (result.used) {
            this._consumeInventorySlot(idx);
            if (result.log) this._log(result.log, 'reward');
          }
          this._closeModal();
          Render.fullRender();
        },
      })).concat([{ label: '取消', action: () => this._closeModal() }]),
    });
  },

  useEquipment(charId, equipId) {
    if (!EquipmentRules.canUse(G)) return;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead) return;
    const idx = char.equipment.findIndex(e => e.id === equipId);
    if (idx === -1) return;
    const equip = char.equipment[idx];

    const result = EquipmentRules.use(G, char, equip);
    if (result.used) {
      char.equipment.splice(idx, 1);
      if (result.log) this._log(result.log, 'reward');
      Render.fullRender();
    }
  },

  _ensureInventory() {
    if (!Array.isArray(G.inventory)) G.inventory = [];
    G.inventory = G.inventory
      .filter(Boolean)
      .map(slot => slot.item ? slot : { item: { ...slot }, count: Math.max(1, slot.count || 1) });
    for (const char of (G.squad || [])) {
      if (!Array.isArray(char.equipment) || char.equipment.length === 0) continue;
      while (char.equipment.length > 0 && G.inventory.length < (CONFIG.MAX_INVENTORY_ITEMS || 3)) {
        G.inventory.push({ item: { ...char.equipment.shift() }, count: 1 });
      }
    }
  },

  _inventorySpaceLeft() {
    this._ensureInventory();
    return Math.max(0, (CONFIG.MAX_INVENTORY_ITEMS || 3) - G.inventory.length);
  },

  _inventoryItem(slot) {
    return slot?.item || slot || null;
  },

  _inventoryMaxStack(item) {
    if (!item || item.stackable === false || item.special === true) return 1;
    return item.maxStack || 2;
  },

  _addInventoryItem(item) {
    this._ensureInventory();
    const maxStack = this._inventoryMaxStack(item);
    if (maxStack > 1) {
      const stack = G.inventory.find(slot => {
        const existing = this._inventoryItem(slot);
        return existing?.id === item.id && (slot.count || 1) < this._inventoryMaxStack(existing);
      });
      if (stack) {
        stack.count = Math.min(maxStack, (stack.count || 1) + 1);
        return { added: true, stacked: true, count: stack.count };
      }
    }
    if (G.inventory.length < (CONFIG.MAX_INVENTORY_ITEMS || 3)) {
      G.inventory.push({ item: { ...item }, count: 1 });
      return { added: true, stacked: false, count: 1 };
    }
    return { added: false };
  },

  _consumeInventorySlot(idx) {
    const slot = G.inventory[idx];
    if (!slot) return;
    slot.count = Math.max(0, (slot.count || 1) - 1);
    if (slot.count <= 0) G.inventory.splice(idx, 1);
  },

  _openInventoryFullModal(ev, item, rescueClue = '') {
    const choices = [];
    if (this._aliveSquad().length > 0 && item.useOutOfCombat !== false) {
      choices.push({
        label: `立即使用「${item.name}」`,
        action: () => this._chooseImmediateItemTarget(item, ev, rescueClue),
      });
    }
    for (let i = 0; i < G.inventory.length; i++) {
      const slot = G.inventory[i];
      const oldItem = this._inventoryItem(slot);
      if (!oldItem) continue;
      const countText = (slot.count || 1) > 1 ? ` x${slot.count}` : '';
      choices.push({
        label: `丟棄「${oldItem.name}${countText}」，換成「${item.name}」`,
        action: () => {
          G.inventory[i] = { item: { ...item }, count: 1 };
          this._log(`丟棄「${oldItem.name}${countText}」，放入「${item.name}」。`, 'reward');
          this._closeModal();
          Render.fullRender();
        },
      });
    }
    choices.push({
      label: `放棄「${item.name}」`,
      action: () => {
        this._log(`放棄道具「${item.name}」。`, 'dim');
        this._closeModal();
        Render.fullRender();
      },
    });

    this._openModal({
      title: '背包已滿',
      desc: `${ev?.name || '獲得道具'}\n\n背包已滿，無法直接放入 ${item.icon} ${item.name}。\n${item.desc}\n\n可丟棄背包內一格道具，或放棄新道具。`,
      choices,
    });
  },

  _chooseImmediateItemTarget(item, ev = null, rescueClue = '') {
    if (item.effect?.type === 'wish_chest') {
      this._openWishChest(null);
      return;
    }
    const targets = this._aliveSquad();
    this._openModal({
      _isEquipUse: true,
      title: `使用道具：${item.name}`,
      desc: `${item.desc}\n\n選擇使用目標。`,
      choices: targets.map(char => ({
        label: `${char.name}（HP ${char.hp}/${char.maxHp}）`,
        action: () => {
          const result = EquipmentRules.use(G, char, item);
          if (result.log) this._log(result.log, 'reward');
          this._closeModal();
          Render.fullRender();
        },
      })).concat([{ label: '返回', action: () => this._openInventoryFullModal(ev, item, rescueClue) }]),
    });
  },

  _awardWishChest(sourceName = '強敵戰利品') {
    const item = getEquipById('wish_chest');
    if (!item) return false;
    const addResult = this._addInventoryItem(item);
    if (!addResult.added) {
      this._openInventoryFullModal({ name: sourceName }, item, '');
      return false;
    }
    this._log(`${sourceName}：獲得道具「${item.name}」。`, 'reward');
    return true;
  },

  _openWishChest(itemIndex = null) {
    if (G.phase === 'over') return;
    this._ensureInventory();
    const idx = itemIndex === null ? null : Number(itemIndex);
    const item = idx === null ? getEquipById('wish_chest') : this._inventoryItem(G.inventory[idx]);
    if (!item || item.effect?.type !== 'wish_chest') return;

    this._openModal({
      title: '祈願寶箱',
      desc: '寶箱內的微光像是在等待命令。\n\n選擇一項祈願。選定後會消耗祈願寶箱。',
      choices: [
        { label: '休整祈願：原地休息', action: () => this._openWishRest(idx) },
        { label: '遺物祈願：獲得隨機聖物', action: () => this._openWishRelic(idx) },
        { label: '武裝祈願：裝備二選一', action: () => this._openWishGear(idx) },
        { label: '兵刃祈願：升級一名隊友武器', action: () => this._openWishWeaponUpgrade(idx) },
        { label: '黎明祈願：黑暗 -2', action: () => this._useWishDawn(idx) },
        { label: '返回', action: () => { this._closeModal(); Render.fullRender(); } },
      ],
    });
  },

  _consumeWishChest(idx) {
    if (idx !== null && Number.isFinite(idx)) {
      this._consumeInventorySlot(idx);
    }
  },

  _openWishRest(idx) {
    const choices = [];
    choices.push({
      label: '休息：全隊恢復 30% 最大 HP',
      action: () => {
        const healed = this._healAliveSquad(c => Math.ceil(c.maxHp * 0.30), true);
        this._consumeWishChest(idx);
        this._log(healed.length > 0 ? `休整祈願：${healed.join('、')}。` : '休整祈願：隊伍休息，但沒有人需要治療。', 'reward');
        this._closeModal();
        Render.fullRender();
      },
    });

    const injured = this._aliveSquad().filter(c => c.hp < c.maxHp);
    if (injured.length > 0) {
      choices.push({
        label: '急救：指定一名角色恢復 50% 最大 HP',
        action: () => {
          const targetChoices = injured.map(char => ({
            label: `${char.name}（HP ${char.hp}/${char.maxHp}）`,
            action: () => {
              const before = char.hp;
              const heal = this._restHealAmount(char, Math.ceil(char.maxHp * 0.50));
              char.hp = Math.min(char.maxHp, char.hp + heal);
              this._consumeWishChest(idx);
              this._log(`休整祈願：${char.name} 恢復 ${char.hp - before} HP。`, 'reward');
              this._closeModal();
              Render.fullRender();
            },
          }));
          targetChoices.push({ label: '返回', action: () => this._openWishRest(idx) });
          this._openModal({ title: '休整祈願：急救', desc: '選擇要治療的角色。', choices: targetChoices });
        },
      });
    }

    for (const char of G.squad.filter(c => c.dead)) {
      const reviveHp = Math.ceil(char.maxHp * 0.20);
      choices.push({
        label: `救起 ${char.name}（${reviveHp} HP）`,
        action: () => {
          this._reviveChar(char, reviveHp);
          this._consumeWishChest(idx);
          this._log(`休整祈願：${char.name} 被救起。`, 'reward');
          this._closeModal();
          Render.fullRender();
        },
      });
    }

    choices.push({ label: '返回', action: () => this._openWishChest(idx) });
    this._openModal({
      title: '休整祈願',
      desc: '寶箱中的光變得溫暖，像一處短暫安全的休息點。',
      choices,
    });
  },

  _openWishRelic(idx) {
    const pool = this._getAvailableRelics([...getDayRelics(), ...getNightRelics()]);
    if (pool.length === 0) {
      this._openModal({
        title: '遺物祈願',
        desc: '目前沒有可獲得的聖物。',
        choices: [{ label: '返回', action: () => this._openWishChest(idx) }],
      });
      return;
    }
    const relic = weightedRelicPick(pool);
    const choices = this._aliveSquad().map(char => ({
      label: `${char.name}${char.relic ? `（替換 ${char.relic.name}）` : ''}`,
      action: () => this._grantWishRelic(idx, char, relic),
    }));
    choices.push({ label: '返回', action: () => this._openWishChest(idx) });
    this._openModal({
      title: `遺物祈願：${relic.name}`,
      desc: `${relic.icon || '◆'} ${relic.name}\n${relic.desc}\n\n選擇一名隊友攜帶。`,
      choices,
    });
  },

  _grantWishRelic(idx, char, relic) {
    if (!char || !relic) return;
    if (char.relic) {
      this._removeRelicEffect(char, char.relic);
      this._dropRelicAt(G.playerX, G.playerY, char.relic);
      this._log(`${char.name} 放下原本攜帶的聖物。`, 'dim');
    }
    char.relic = { ...relic };
    this._applyRelicEquip(char, relic);
    this._unlockNote(relic.id);
    this._consumeWishChest(idx);
    const newly = this._updateResonances();
    this._log(`遺物祈願：${char.name} 獲得聖物「${relic.name}」。`, 'reward');
    this._openModal({
      title: '遺物祈願完成',
      desc: `${char.name} 獲得聖物「${relic.name}」。${this._resonanceActivatedText(newly)}`,
      choices: [{ label: '繼續', action: () => { this._closeModal(); Render.fullRender(); } }],
    });
  },

  _openWishGear(idx) {
    const first = randomGear(G.day);
    let second = randomGear(G.day);
    for (let guard = 0; guard < 8 && second?.id === first?.id; guard++) second = randomGear(G.day);
    const options = [first, second].filter(Boolean);
    if (options.length === 0) {
      this._openModal({
        title: '武裝祈願',
        desc: '目前沒有可獲得的裝備。',
        choices: [{ label: '返回', action: () => this._openWishChest(idx) }],
      });
      return;
    }
    const choices = options.map(gear => ({
      label: `${gear.icon} ${gear.name}`,
      action: () => this._openWishGearTarget(idx, gear),
    }));
    choices.push({ label: '返回', action: () => this._openWishChest(idx) });
    this._openModal({
      title: '武裝祈願',
      desc: options.map(gear => `${gear.icon} ${gear.name}\n${gear.desc}`).join('\n\n'),
      choices,
    });
  },

  _openWishGearTarget(idx, gear) {
    const choices = this._aliveSquad().map(char => ({
      label: `${char.name}${char.gear ? `（替換 ${char.gear.name}）` : ''}`,
      action: () => {
        const current = char.gear;
        char.gear = { ...gear };
        this._consumeWishChest(idx);
        this._log(`武裝祈願：${char.name} 裝備「${gear.name}」${current ? `，替換「${current.name}」` : ''}。`, 'reward');
        this._closeModal();
        Render.fullRender();
      },
    }));
    choices.push({ label: '返回', action: () => this._openWishGear(idx) });
    this._openModal({
      title: `武裝祈願：${gear.name}`,
      desc: `${gear.icon} ${gear.name}\n${gear.desc}\n\n選擇一名隊友裝備。`,
      choices,
    });
  },

  _openWishWeaponUpgrade(idx) {
    const candidates = this._aliveSquad()
      .map(char => ({ char, upgraded: char.weapon?.upgradeTo ? getWeaponById(char.weapon.upgradeTo) : null }))
      .filter(entry => entry.upgraded);
    if (candidates.length === 0) {
      this._openModal({
        title: '兵刃祈願',
        desc: '目前沒有可升級的武器。',
        choices: [{ label: '返回', action: () => this._openWishChest(idx) }],
      });
      return;
    }
    const choices = candidates.map(({ char, upgraded }) => ({
      label: `${char.name}：${char.weapon.name} → ${upgraded.name}`,
      action: () => {
        char.weapon = { ...upgraded };
        this._consumeWishChest(idx);
        this._log(`兵刃祈願：${char.name} 的武器升級為「${upgraded.name}」。`, 'reward');
        this._closeModal();
        Render.fullRender();
      },
    }));
    choices.push({ label: '返回', action: () => this._openWishChest(idx) });
    this._openModal({
      title: '兵刃祈願',
      desc: '選擇一名隊友，直接升級其目前武器。',
      choices,
    });
  },

  _useWishDawn(idx) {
    this._consumeWishChest(idx);
    this._applyDarkness(-2, '黎明祈願');
    this._log('黎明祈願：黑暗 -2。', 'reward');
    this._closeModal();
    Render.fullRender();
  },


};

Object.assign(Game, GameInventory);

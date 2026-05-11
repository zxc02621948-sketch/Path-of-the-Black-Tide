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


};

Object.assign(Game, GameInventory);

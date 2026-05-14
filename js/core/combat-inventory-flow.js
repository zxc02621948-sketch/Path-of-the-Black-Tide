// Combat inventory methods extracted from combat-flow.js.
const GameCombatInventoryFlow = {
  openCombatBag() {
    if (!G.combat || G.phase === 'over') return;
    if (G.combat.actionInProgress) return;
    if (!this._canUseCombatBag()) {
      this._showCombatModal();
      return;
    }
    G.combat.bagOpen = !G.combat.bagOpen;
    G.combat.pendingInventoryItemIndex = null;
    this._showCombatModal();
  },

  selectCombatBagItem(itemIndex) {
    if (!G.combat || G.phase === 'over') return;
    if (G.combat.actionInProgress) return;
    this._ensureInventory();
    if (G.combat.itemUsedRound === G.combat.round) {
      this._showCombatModal();
      return;
    }
    const idx = Number(itemIndex);
    const slot = G.inventory[idx];
    const item = this._inventoryItem(slot);
    if (!slot || !item || item.useInCombat === false) return;
    if (item.useType === 'roll_mod' && G.combat.rollItemUsedRound === G.combat.round) {
      this._showCombatModal();
      return;
    }
    G.combat.pendingInventoryItemIndex = idx;
    G.combat.bagOpen = false;
    this._showCombatModal();
  },

  useCombatInventoryItemOnTarget(charId) {
    if (!G.combat || G.phase === 'over') return;
    if (G.combat.actionInProgress) return;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead || char.hp <= 0) return;
    const idx = G.combat.pendingInventoryItemIndex;
    const slot = G.inventory[idx];
    const item = this._inventoryItem(slot);
    if (!slot || !item || item.useInCombat === false) return;
    const result = EquipmentRules.use(G, char, item);
    if (result.used) {
      this._consumeInventorySlot(idx);
      G.combat.itemUsedRound = G.combat.round;
      if (item.useType === 'roll_mod') G.combat.rollItemUsedRound = G.combat.round;
      if (result.log) this._log(result.log, 'reward');
    }
    G.combat.pendingInventoryItemIndex = null;
    G.combat.bagOpen = false;
    this._showCombatModal();
  },

  cancelCombatItemTargeting() {
    if (!G.combat) return;
    if (G.combat.actionInProgress) return;
    G.combat.pendingInventoryItemIndex = null;
    G.combat.bagOpen = true;
    this._showCombatModal();
  },

  _combatItemTargeting() {
    return G.combat?.pendingInventoryItemIndex !== null && G.combat?.pendingInventoryItemIndex !== undefined;
  },

  _canUseCombatBag() {
    return !!G.combat && G.combat.itemUsedRound !== G.combat.round;
  },

};

Object.assign(Game, GameCombatInventoryFlow);

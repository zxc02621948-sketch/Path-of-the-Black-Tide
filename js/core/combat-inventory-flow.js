// Combat inventory methods extracted from combat-flow.js.
const GameCombatInventoryFlow = {
  openCombatBag() {
    if (!G.combat || G.phase === 'over') return;
    if (G.combat.actionInProgress) return;
    if (!this._combatTutorialAllows?.('bag')) return;
    if (!this._canUseCombatBag()) {
      this._showCombatModal();
      return;
    }
    G.combat.bagOpen = !G.combat.bagOpen;
    G.combat.pendingInventoryItemIndex = null;
    G.combat.guardTargeting = false;
    if (G.combat.bagOpen) this._advanceCombatTutorial?.('item_bag', 'item_select');
    this._showCombatModal();
  },

  selectCombatBagItem(itemIndex) {
    if (!G.combat || G.phase === 'over') return;
    if (G.combat.actionInProgress) return;
    if (!this._combatTutorialAllows?.('bag')) return;
    this._ensureInventory();
    if (G.combat.itemUsedRound === G.combat.round) {
      this._showCombatModal();
      return;
    }
    const isTutorialWhetstone = String(itemIndex) === 'tutorial_whetstone';
    const idx = isTutorialWhetstone ? itemIndex : Number(itemIndex);
    const slot = isTutorialWhetstone ? G.combat.tutorialWhetstone : G.inventory[idx];
    const item = this._inventoryItem(slot);
    if (!slot || !item || item.useInCombat === false) return;
    if (G.combatTutorial?.active && !G.combatTutorial.completed && G.combatTutorial.step === 'item_select' && item.id !== 'whetstone') return;
    if (item.useType === 'roll_mod' && G.combat.rollItemUsedRound === G.combat.round) {
      this._showCombatModal();
      return;
    }
    G.combat.pendingInventoryItemIndex = idx;
    G.combat.guardTargeting = false;
    G.combat.bagOpen = false;
    this._advanceCombatTutorial?.('item_select', 'item_target');
    this._showCombatModal();
  },

  useCombatInventoryItemOnTarget(charId) {
    if (!G.combat || G.phase === 'over') return;
    if (G.combat.actionInProgress) return;
    if (!this._combatTutorialAllows?.('item_target')) return;
    const char = G.squad.find(c => c.id === charId);
    if (!char || char.dead || char.hp <= 0) return;
    const idx = G.combat.pendingInventoryItemIndex;
    const isTutorialWhetstone = String(idx) === 'tutorial_whetstone';
    const slot = isTutorialWhetstone ? G.combat.tutorialWhetstone : G.inventory[idx];
    const item = this._inventoryItem(slot);
    if (!slot || !item || item.useInCombat === false) return;
    const result = EquipmentRules.use(G, char, item);
    if (result.used) {
      if (isTutorialWhetstone) {
        G.combat.tutorialWhetstone = null;
      } else {
        this._consumeInventorySlot(idx);
      }
      G.combat.itemUsedRound = G.combat.round;
      if (item.useType === 'roll_mod') G.combat.rollItemUsedRound = G.combat.round;
      if (result.log) this._log(result.log, 'reward');
    }
    G.combat.pendingInventoryItemIndex = null;
    G.combat.bagOpen = false;
    this._advanceCombatTutorial?.('item_target', 'attack_role');
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
    return !!G.combat && G.combat.itemUsedRound !== G.combat.round && this._combatActableSquad().length > 0;
  },

};

Object.assign(Game, GameCombatInventoryFlow);

// 地形事件規則：集中探索者路標與事件調度相關的小規則。
const TerrainRules = {
  nonReservableTypes: ['altar', 'rest', 'evacuate'],

  canReserve(state) {
    return state.squad.some(c => !c.dead && CHARACTER_CLASSES[c.cls]?.passive === 'waymark')
      && !state.explorerReserved
      && state.day >= state.explorerCooldownExpires;
  },

  canReserveEvent(state, cell, event) {
    return this.canReserve(state)
      && event.type !== 'note'
      && !event.noReserve
      && !this.nonReservableTypes.includes(cell.type);
  },

  reserveCooldownEnd(day) {
    return day + CONFIG.EXPLORER_RESERVE_COOLDOWN_DAYS;
  },
};

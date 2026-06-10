// 道具規則：道具是一次性消耗品，主要影響單次判定或下一場戰鬥。
const EquipmentRules = {
  canUse(state) {
    return !state.modal || state.modal._isEquipUse === true;
  },

  use(state, char, equip) {
    if (!char || !equip) return { used: false, log: null };
    const combatBadgeMeta = {
      source: equip.name,
      sourceItemId: equip.id || '',
      sourceItemName: equip.name || '',
      sourceItemIcon: equip.icon || '',
      sourceItemIconImage: equip.iconImage || '',
      sourceCharId: char.id || '',
      sourceCharName: char.name || '',
    };

    if (equip.useType === 'instant') {
      if (equip.effect.type === 'heal' || equip.effect.type === 'heal_percent') {
        const hasSupport = state.squad.some(c => !c.dead && c.hp > 0 && c.cls === 'support');
        const rate = equip.effect.type === 'heal_percent'
          ? ((hasSupport || char.cls === 'support') ? equip.effect.supportValue : equip.effect.value)
          : null;
        const heal = rate ? Math.ceil(char.maxHp * rate) : equip.effect.value;
        const before = char.hp;
        char.hp = Math.min(char.maxHp, char.hp + heal);
        return { used: true, log: `${char.name} 使用道具【${equip.name}】，恢復 ${char.hp - before} HP。` };
      }
      return { used: true, log: `${char.name} 使用道具【${equip.name}】。` };
    }

    if (equip.useType === 'combat_mod') {
      state.combatMods.push({ ...equip.effect, ...combatBadgeMeta });
      return { used: true, log: `${char.name} 激活道具【${equip.name}】，下場戰鬥生效。` };
    }

    if (equip.useType === 'roll_mod') {
      state.rollMods.push({ ...equip.effect, ...combatBadgeMeta });
      return { used: true, log: `${char.name} 激活道具【${equip.name}】，下次判定生效。` };
    }

    return { used: false, log: null };
  },
};

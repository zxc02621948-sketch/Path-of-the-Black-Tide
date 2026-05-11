// 骰子系統
const Dice = {
  // 擲一顆 1d6
  rollRaw() {
    return Math.ceil(Math.random() * 6);
  },

  rollRawSides(sides = 6) {
    return Math.ceil(Math.random() * sides);
  },

  // 帶職業保底的骰子
  // diceType: 'combat' | 'explore' | 'altar' | 'relic' | 'trap' | 'neutral'
  // char: 角色物件（可為 null）
  roll(diceType, char) {
    const raw = this.rollRaw();
    let floor = 1;

    if (char) {
      const classDef = CHARACTER_CLASSES[char.cls];
      const floors = CONFIG.FLOOR_BONUS[char.cls] || {};

      // 職業保底
      if (diceType === 'combat'  && floors.combat)  floor = floors.combat;
      if (diceType === 'explore' && floors.explore) floor = floors.explore;
      if ((diceType === 'altar' || diceType === 'relic') && floors.altar) floor = floors.altar;

      // 聖物加成由各系統在結算時處理。
    }

    const value = Math.max(raw, floor);
    return { raw, value, floored: value > raw };
  },

  // 為整個小隊的某類骰子中取最高值（多角色攻擊時用）
  rollBest(diceType, squad) {
    let best = { raw: 0, value: 0, floored: false, char: null };
    for (const char of squad) {
      const result = this.roll(diceType, char);
      if (result.value > best.value) {
        best = { ...result, char };
      }
    }
    return best;
  },

  // 骰面轉文字（顯示用）
  face(n) {
    if (n > 6) return String(n);
    return ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n] || '🎲';
  },
};

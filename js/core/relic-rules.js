// 聖物規則。舊聖物已移除，這裡只保留目前新版聖物需要的共用接口。
const RelicRules = {
  applyEquip(state, char, relic) {
    if (!relic) return;
    if (relic.effect?.type === 'squad_max_hp') {
      for (const c of state.squad) {
        c.maxHp += relic.effect.value;
        c.hp = Math.min(c.hp + relic.effect.value, c.maxHp);
      }
    }
    if (relic.effect?.type === 'carrier_max_hp') {
      char.maxHp += relic.effect.value;
      char.hp = Math.min(char.hp + relic.effect.value, char.maxHp);
    }
  },

  removeEquip(state, char, relic) {
    if (!relic) return;
    if (relic.effect?.type === 'squad_max_hp') {
      for (const c of state.squad) {
        c.maxHp = Math.max(1, c.maxHp - relic.effect.value);
        c.hp = Math.min(c.hp, c.maxHp);
      }
    }
    if (relic.effect?.type === 'carrier_max_hp') {
      char.maxHp = Math.max(1, char.maxHp - relic.effect.value);
      char.hp = Math.min(char.hp, char.maxHp);
    }
  },

  fusionBonusDesc(relic) {
    const map = {
      lucky_star: '攻擊骰 6 傷害 +2；若使用 12 面骰，攻擊骰 12 傷害 +4；每場戰鬥前 2 次小於 3 改為 6，且 12 面骰擲出 6 時有一半機率改為 12。',
      exorcism_ring: '每天第一次探索骰視為成功。',
      eagle_eye_feather: '每場戰鬥第一次由鷹眼羽飾觸發的追加攻擊，該次追擊傷害 +3。',
      flaw_lens: '第一次命中原生弱點必定新增原生弱點，命中原生弱點額外 +2 傷害。',
      pain_mask: '主戰造成傷害時，每 4 點原始傷害附加 1 層傷口；傷口達到 15 層時引爆並消耗所有傷口，每層造成 2 點固定傷害。',
      pain_splinter_badge: '攻擊骰最終骰面為 6 時附加 3 層傷口；傷口 5 層以上時額外傷害提高為 30%，且傷口上限提高為 20 層。',
      black_iron_crown: '主動討伐黑暗化身時，全隊對黑暗化身造成的傷害 +10%，至少 +1。',
      wager_dice: '可押注 4 個骰面；押中仍為該擊傷害 +4，懊悔仍最多 2 層。',
    };
    return map[relic?.id] || '';
  },

  applyFusionBonus(state, char, relic) {
    if (!relic) return;
  },

  removeFusionBonus(state, char, relic) {
    if (!relic) return;
  },

  visionBonus(state, phase) {
    return state.squad.some(c => c.cls === 'explorer') ? CONFIG.EXPLORER_VISION_BONUS : 0;
  },

};

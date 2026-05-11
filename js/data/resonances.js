const RESONANCES = [
  {
    id: 'pain_resonance',
    name: '痛痕共鳴・爆發',
    relics: ['pain_mask', 'pain_splinter_badge'],
    desc: '同身共鳴：融合痛苦面具 + 痛苦徽記。',
    bodyRequiresFused: 'pain_mask',
    squadEffect: { type: 'none', desc: '此共鳴必須由同一角色同時持有兩件聖物才會啟動。' },
    bodyEffect: {
      type: 'pain_resonance',
      threshold: 10,
      diceWoundsOnDamage: true,
      ignoreWoundDamageBonus: true,
      explodeDamagePerWound: 2,
      desc: '持有者攻擊時，目標傷口不提供傷害加成；若本次造成傷害，附加等同最終骰面的傷口。施加傷口後若目標達到 10 層以上傷口，引爆並消耗所有傷口，每層造成 2 點固定傷害。',
    },
    lore: '痛苦被壓到極限後，會變成一次乾脆的爆裂。',
  },
  {
    id: 'pain_scar_resonance',
    name: '痛痕共鳴・折磨',
    relics: ['pain_splinter_badge', 'pain_mask'],
    desc: '同身共鳴：融合痛苦徽記 + 痛苦面具。',
    bodyRequiresFused: 'pain_splinter_badge',
    squadEffect: { type: 'none', desc: '此共鳴必須由同一角色同時持有兩件聖物才會啟動。' },
    bodyEffect: {
      type: 'pain_scar_resonance',
      threshold: 6,
      bonusRate: 0.20,
      desc: '攻擊 6 層以上傷口的敵人時，該次擊中最終傷害額外提高 20%。',
    },
    lore: '傷口不急著爆開，它只是讓每一次痛都更深。',
  },
];

function checkResonances(squad) {
  const allRelicIds = new Set();
  const charRelicMap = {};

  for (const char of squad) {
    const ids = [];
    if (char.relic) { allRelicIds.add(char.relic.id); ids.push(char.relic.id); }
    if (char.fusedRelic) { allRelicIds.add(char.fusedRelic.id); ids.push(char.fusedRelic.id); }
    charRelicMap[char.id] = ids;
  }

  const active = [];
  for (const res of RESONANCES) {
    const [r1, r2] = res.relics;
    if (!allRelicIds.has(r1) || !allRelicIds.has(r2)) continue;

    let bodyChar = null;
    for (const char of squad) {
      const ids = charRelicMap[char.id] || [];
      if (ids.includes(r1) && ids.includes(r2)) { bodyChar = char; break; }
    }
    if (res.bodyRequiresFused && bodyChar?.fusedRelic?.id !== res.bodyRequiresFused) continue;

    active.push({
      ...res,
      isBody: !!bodyChar,
      bodyChar: bodyChar || null,
      effect: bodyChar ? res.bodyEffect : res.squadEffect,
    });
  }
  return active;
}

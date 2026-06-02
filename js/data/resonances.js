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
      retainWoundRate: 0.35,
      desc: '攻擊時不吃傷口增傷；造成傷害後依最終骰面附加傷口。傷口達 10 層時引爆，每層造成 2 點固定傷害，爆發後保留約三分之一傷口。',
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
      threshold: 5,
      bonusRate: 0.30,
      highThreshold: 10,
      highBonusRate: 0.50,
      desc: '攻擊 5 層以上傷口的敵人時，該次擊中最終傷害額外提高 30%；若目標有 10 層以上傷口，改為提高 50%。',
    },
    lore: '傷口不急著爆開，它只是讓每一次痛都更深。',
  },
  {
    id: 'greatsword_resonance',
    name: '沉鐵劍律',
    relics: ['iron_scabbard', 'silver_bee_pin'],
    desc: '\u9280\u8702\u91dd\u4e0d\u518d\u89f8\u767c\u523a\u528d\u9023\u64ca\uff0c\u6539\u70ba\u5f37\u5316\u91cd\u528d\uff1a\u91cd\u528d\u547d\u4e2d\u5f8c\uff0c\u9664\u4e86\u6c89\u9435\u528d\u9798\u539f\u672c\u7684\u6c23\u52e2\u5916\uff0c\u984d\u5916\u7372\u5f97 3 \u9ede\u6c23\u52e2\u3002\u6c23\u52e2 1 \u7b49\u65bc\u57fa\u790e\u653b\u64ca +1\uff1b\u6bcf 5 \u9ede\u65e2\u6709\u6c23\u52e2\uff0c\u4f7f\u672c\u6b21\u91cd\u528d\u50b7\u5bb3 +1\u3002\u6c23\u52e2 20 \u4ee5\u4e0a\u672a\u6253\u51fa\u91cd\u528d\u6642\uff0c\u5931\u53bb\u4e00\u534a\u6c23\u52e2\u3002',
    bodyRequiresFused: 'iron_scabbard',
    squadEffect: { type: 'none', desc: '此共鳴必須由同一角色同時持有兩件聖物才會啟動。' },
    bodyEffect: {
      type: 'greatsword_resonance',
      extraMomentum: 3,
      momentumLossOnMiss: 3,
      momentumCollapseThreshold: 20,
      momentumCollapseKeepRate: 0.5,
      damagePerMomentum: 5,
      damageBonus: 1,
      desc: '銀蜂針不再觸發刺劍連擊，改為強化重劍：重劍命中後，除了沉鐵劍鞘原本的氣勢外，額外獲得 3 點氣勢。每 1 點氣勢使基礎攻擊 +1；此外，每 5 點既有氣勢，使本次重劍傷害 +1。融合沉鐵劍鞘時，每次重劍命中合計獲得 8 點氣勢；若劍系主戰攻擊未打出重劍，氣勢 -3，最低為 0。',
    },
    lore: '細針不再追求連刺，而是替沉重的一劍校準落點。',
  },
  {
    id: 'rapier_resonance',
    name: '銀蜂劍律',
    relics: ['silver_bee_pin', 'iron_scabbard'],
    desc: '\u6c89\u9435\u528d\u9798\u4e0d\u518d\u89f8\u767c\u91cd\u528d\uff0c\u6539\u70ba\u5f37\u5316\u523a\u528d\uff1a\u672c\u6b21\u523a\u528d\u6bcf\u6210\u529f\u9023\u64ca 1 \u6b21\uff0c\u5f8c\u7e8c\u9023\u64ca\u50b7\u5bb3 +1\u3002',
    bodyRequiresFused: 'silver_bee_pin',
    squadEffect: { type: 'none', desc: '此共鳴必須由同一角色同時持有兩件聖物才會啟動。' },
    bodyEffect: {
      type: 'rapier_resonance',
      guaranteedFollowUps: 0,
      followDamageStep: 1,
      followDamageMaxBonus: 5,
      desc: '沉鐵劍鞘不再觸發重劍，改為強化刺劍：本次刺劍每成功連擊 1 次，後續連擊傷害額外 +1，最多 +5。',
    },
    lore: '劍鞘壓住重量，只留下銀針般連續刺入的節奏。',
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

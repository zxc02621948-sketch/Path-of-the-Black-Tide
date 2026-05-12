const RELICS = [
  {
    id: 'war_banner',
    name: '戰爭旗',
    icon: '⚑',
    rarity: 'rare',
    fusable: true,
    supportRelic: true,
    bannerRelic: true,
    desc: '主戰攻擊前，可選擇舉起戰爭旗，旗面自動決定。戰吼面：全隊擊中傷害依階級提高。創傷面：每回合第一次擊中時依階級施加傷口。非執旗者舉旗為 1 階，若此旗已融合則為 2 階。執旗者舉旗以本次攻擊骰判定：1-2 失敗，3-4 為 2 階，5-6 為 3 階；若此旗已融合，1-4 為 2 階，5-6 為 3 階。',
    effect: {
      type: 'banner',
      bannerId: 'war_banner',
      faces: [
        { id: 'warcry', name: '戰吼面', type: 'hit_damage_bonus', values: [1, 2, 3] },
        { id: 'wound', name: '創傷面', type: 'first_hit_wound', values: [1, 2, 3] },
      ],
    },
    fusedEffect: {
      type: 'banner',
      bannerId: 'war_banner',
      faces: [
        { id: 'warcry', name: '戰吼面', type: 'hit_damage_bonus', values: [1, 2, 3] },
        { id: 'wound', name: '創傷面', type: 'first_hit_wound', values: [1, 2, 3] },
      ],
      fused: true,
    },
    nightOnly: false,
    lore: ['布面殘破，號令卻仍能讓隊伍重新排成一線。'],
    locationHint: '支援路線事件或普通聖物中可能出現。',
  },
  {
    id: 'eagle_banner',
    name: '鷹眼旗',
    icon: '⚑',
    rarity: 'rare',
    fusable: true,
    supportRelic: true,
    bannerRelic: true,
    desc: '主戰攻擊前，可選擇舉起鷹眼旗，旗面自動決定。破綻面：每回合附加 1 個鷹眼破綻，高階命中時額外增傷。原生面：命中任一原生弱點時增加傷害，高階可新增鷹眼暫時原生弱點。鷹眼旗產生的弱點同時只能存在 1 個，且可互相覆蓋。非執旗者舉旗為 1 階，若此旗已融合則為 2 階。執旗者舉旗以本次攻擊骰判定：1-2 失敗，3-4 為 2 階，5-6 為 3 階；若此旗已融合，1-4 為 2 階，5-6 為 3 階。',
    effect: {
      type: 'banner',
      bannerId: 'eagle_banner',
      faces: [
        { id: 'temp', name: '破綻面', type: 'eagle_temp_weakness', values: [0, 2, 3] },
        { id: 'native', name: '原生面', type: 'eagle_native_weakness', nativeDamage: [3, 3, 4], rollGreaterThan: [null, 3, 2], durations: [0, 2, 3] },
      ],
    },
    fusedEffect: {
      type: 'banner',
      bannerId: 'eagle_banner',
      faces: [
        { id: 'temp', name: '破綻面', type: 'eagle_temp_weakness', values: [0, 2, 3] },
        { id: 'native', name: '原生面', type: 'eagle_native_weakness', nativeDamage: [3, 3, 4], rollGreaterThan: [null, 3, 2], durations: [0, 2, 3] },
      ],
      fused: true,
    },
    nightOnly: false,
    lore: ['旗尖所指之處，連陰影都露出裂縫。'],
    locationHint: '支援路線事件或普通聖物中可能出現。',
  },
  {
    id: 'wager_dice',
    name: '賭命骰子',
    icon: '🎲',
    rarity: 'legendary',
    fusable: true,
    eventOnly: true,
    desc: '戰鬥開始後，持有者主戰前可押注 3 個骰面。若本次攻擊命中押注骰面，傷害 +4；若未命中，下次受擊回合受到的傷害 +30%，最多 3 層。',
    effect: { type: 'wager_dice', faces: 3, damageBonus: 4, missPenaltyRate: 0.30, maxMissStacks: 3 },
    fusedEffect: { type: 'wager_dice', faces: 4, damageBonus: 4, missPenaltyRate: 0.30, maxMissStacks: 3 },
    nightOnly: false,
    lore: ['骰子沉甸甸的，像把一小段命運握在掌心。'],
    locationHint: '命運賭桌事件或聖物獎勵中可能出現。',
  },
  {
    id: 'lucky_star',
    name: '幸運星',
    icon: '⭐',
    rarity: 'legendary',
    fusable: true,
    desc: '攻擊骰最終為 6 時傷害 +2；每場戰鬥前 1 次可將小於等於 3 的攻擊骰面改為 6，且免疫以此方式造成的雙數副作用。',
    effect: { type: 'lucky_star', sixDamageBonus: 2, twelveDamageBonus: 4, lowRollToSixUses: 1, forcedSixImmuneGamblerPenalty: true },
    fusedEffect: { type: 'lucky_star', sixDamageBonus: 2, twelveDamageBonus: 4, lowRollToSixUses: 2, finalSixTwelveImmuneGamblerPenalty: true, sixToTwelveUses: 2, sixToTwelveChance: 0.5 },
    nightOnly: false,
    lore: ['它不像星星，更像一枚不肯熄滅的小小承諾。'],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'exorcism_ring',
    name: '驅邪戒',
    icon: '💍',
    rarity: 'rare',
    fusable: true,
    desc: '淨化判定失敗時可重骰一次。',
    effect: { type: 'exorcism_ring', rerollOnFail: true, guaranteedSuccess: false },
    fusedEffect: { type: 'exorcism_ring', rerollOnFail: false, guaranteedSuccess: true },
    darkRelic: true,
    nightOnly: true,
    lore: ['戒面刻著細小符文，靠近黑暗時會微微發熱。'],
    locationHint: '黑夜聖物獎勵中可能出現。',
  },
  {
    id: 'eagle_eye_feather',
    name: '鷹眼羽飾',
    icon: '🪶',
    rarity: 'rare',
    fusable: true,
    desc: '主戰使用弓時，最終骰面至少為 5，可視為命中原生弱點並觸發弓追擊；此視為命中不會破壞原生弱點。',
    effect: { type: 'eagle_eye_feather', finalMin: 5, firstFollowUpDamageBonus: 0 },
    fusedEffect: { type: 'eagle_eye_feather', finalMin: 5, firstFollowUpDamageBonus: 3 },
    nightOnly: false,
    lore: ['羽梢永遠指向最脆弱的縫隙。'],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'flaw_lens',
    name: '鷹眼透鏡',
    icon: '🔍',
    rarity: 'rare',
    fusable: true,
    desc: '主戰攻擊命中原生弱點時，有 50% 機率新增 1 個原生弱點；每場戰鬥最多成功新增 1 次，失敗不消耗機會。',
    effect: { type: 'flaw_lens', chance: 0.5, guaranteed: false, fusedWeaknessDamage: 0 },
    fusedEffect: { type: 'flaw_lens', chance: 1, guaranteed: true, fusedWeaknessDamage: 2 },
    nightOnly: false,
    lore: ['透鏡裡的裂紋，總能對準敵人最薄的地方。'],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'pain_mask',
    name: '痛苦面具',
    icon: '🎭',
    rarity: 'rare',
    fusable: true,
    desc: '主戰時，攻擊 4 層以上傷口的敵人，每 4 層傷口額外造成 1 點傷害。',
    effect: { type: 'pain_mask', damagePerWound: 4, stacksPerStep: 1 },
    fusedEffect: { type: 'pain_mask', damagePerWound: 4, stacksPerStep: 1, explodeAtWounds: 15, explodeDamagePerWound: 2 },
    nightOnly: false,
    lore: ['面具內側沒有臉，只有咬緊的痛。'],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'pain_splinter_badge',
    name: '痛苦徽記',
    icon: '🩸',
    rarity: 'rare',
    fusable: true,
    desc: '攻擊 5 層以上傷口的敵人時，最終傷害提高 20%。',
    effect: { type: 'wound_damage_bonus', threshold: 5, bonusRate: 0.20 },
    fusedEffect: { type: 'wound_damage_bonus', threshold: 5, bonusRate: 0.30, woundMax: 20 },
    nightOnly: false,
    lore: ['徽記像乾涸的傷疤，碰到鮮血時又重新發亮。'],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'black_iron_crown',
    name: '黑鐵王冠',
    icon: '👑',
    rarity: 'legendary',
    fusable: true,
    darkRelic: true,
    desc: '狩獵黑暗怪時，黑暗怪等級至少 5 時降低其強度 2 級。',
    effect: { type: 'dark_monster_hunt_weaken', value: 2, minLevel: 5, fusedDamageRate: 0.10, fusedMinBonus: 1 },
    nightOnly: true,
    lore: ['它不是為王準備的，而是為仍敢直視黑夜的人。'],
    locationHint: '黑夜聖物獎勵中可能出現。',
  },
];

const RARITY_WEIGHTS = CONFIG.RARITY_WEIGHTS || { common: 5, uncommon: 3, rare: 1, legendary: 0 };

function weightedRelicPick(pool) {
  const weighted = [];
  for (const relic of pool) {
    const w = RARITY_WEIGHTS[relic.rarity] ?? 0;
    for (let i = 0; i < w; i++) weighted.push(relic);
  }
  if (weighted.length === 0) return pool[0] ?? null;
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function getRelicById(id) {
  return RELICS.find(r => r.id === id) || null;
}

function getDayRelics() {
  return RELICS.filter(r => !r.nightOnly && !r.guaranteed && !r.eventOnly);
}

function getNightRelics() {
  return RELICS.filter(r => r.nightOnly && !r.guaranteed && !r.eventOnly);
}

function getSupportRelics() {
  return RELICS.filter(r => r.supportRelic && !r.guaranteed && !r.eventOnly);
}

function getEventRelicById(id) {
  return RELICS.find(r => r.id === id && r.eventOnly) || null;
}

const ECHO_RELIC_SYSTEMS = [
  {
    id: 'wound',
    name: '傷口體系',
    siteName: '傷口共鳴遺址',
    relics: ['pain_mask', 'pain_splinter_badge'],
    clueText: '線索上的字像被指甲一筆一筆刮出來，越靠近末尾，紙面越像乾掉的傷疤。',
    siteText: '遺址裡殘留著痛苦聖物的氣息。石階上滿是黑色裂痕，像有什麼東西曾在這裡反覆受傷又反覆站起。',
    guardianText: '守護者不會格檔，卻會讓自身傷口滋長並付出生命，再把傷口轉為攻擊傷害；命中原生弱點可破除每回合自然滋長，但牠的撕裂自身意圖仍會繼續增加傷口並自損。',
    victoryText: '遺址裡的傷痕逐漸閉合，只剩一件仍在微微顫動的聖物。',
  },
  {
    id: 'eagle',
    name: '鷹眼體系',
    siteName: '鷹眼共鳴遺址',
    relics: ['eagle_eye_feather', 'flaw_lens'],
    clueText: '線索不是寫在紙上，而是刻在一片透明碎鏡裡。轉動角度時，鏡中會短暫浮出遠方的裂光。',
    siteText: '遺址裡漂浮著銳利視線。每一道石縫都像眼睛，靜靜盯著隊伍的步伐與呼吸。',
    guardianText: '守護者每回合會為我方全體新增各自的原生弱點；攻擊前擲凝視骰，若命中受擊者原生弱點則傷害 +3 並移除該弱點。命中守護者原生弱點可清除我方全體由裂隙凝視產生的原生弱點。',
    victoryText: '凝視碎裂後，空氣中的裂光聚成一件聖物。',
  },
  {
    id: 'fate',
    name: '命運體系',
    siteName: '命運共鳴遺址',
    relics: ['wager_dice', 'lucky_star'],
    clueText: '線索中央壓著一個骰印，明明沒有骰子，卻能聽見它在紙背後反覆滾動。',
    siteText: '遺址裡傳出骰子滾動的聲音。每一步都像下注，連沉默都帶著代價。',
    guardianText: '守護者每回合會指定幸運面與厄運面，攻擊前擲命運骰。命中幸運面時單體傷害 x4；命中厄運面時自身剩餘生命減半且本回合不攻擊。命中守護者原生弱點可為本次命運骰新增 1 個厄運面。',
    victoryText: '最後一聲骰響停下，命運留下了它願意支付的代價。',
  },
  {
    id: 'banner',
    name: '戰旗體系',
    siteName: '戰旗共鳴遺址',
    relics: ['war_banner', 'eagle_banner'],
    clueText: '線索是一角褪色旗布，邊緣被火燒黑，布面仍殘留著某種不肯散去的號令。',
    siteText: '遺址裡插著褪色旗幟。風沒有吹動它們，卻仍能聽見整齊而遙遠的踏步聲。',
    guardianText: '守護者像一支殘軍般死守陣地，格檔與持久戰會讓它更難突破。',
    victoryText: '殘旗垂落，舊日軍勢的回聲散開，旗影下露出一件聖物。',
  },
];

function getEchoRelicSystems() {
  return ECHO_RELIC_SYSTEMS.map(system => ({
    ...system,
    relics: [...system.relics],
  }));
}

function getEchoRelicSystemById(id) {
  return getEchoRelicSystems().find(system => system.id === id) || null;
}

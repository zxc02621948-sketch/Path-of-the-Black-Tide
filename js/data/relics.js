const RELICS = [
  {
    id: 'war_banner',
    name: '戰爭旗',
    icon: '⚑',
    iconImage: 'assets/relics/war-banner.png?v=2',
    rarity: 'rare',
    fusable: true,
    supportRelic: true,
    bannerRelic: true,
    desc: '主戰攻擊前，可選擇舉起戰爭旗，旗面自動決定。戰吼面：每回合開始時對敵人造成 5/8/10 點固定傷害。創傷面：每回合第一次擊中時施加 1/2/3 層傷口。非輔助舉旗為 1 階，若此旗已融合則為 2 階。輔助舉旗以本次攻擊骰判定：1-2 失敗，3-4 為 2 階，5-6 為 3 階；若此旗已融合，1-4 為 2 階，5-6 為 3 階。',
    effect: {
      type: 'banner',
      bannerId: 'war_banner',
      faces: [
        { id: 'warcry', name: '戰吼面', type: 'banner_round_damage', values: [5, 8, 10] },
        { id: 'wound', name: '創傷面', type: 'first_hit_wound', values: [1, 2, 3] },
      ],
    },
    fusedEffect: {
      type: 'banner',
      bannerId: 'war_banner',
      faces: [
        { id: 'warcry', name: '戰吼面', type: 'banner_round_damage', values: [5, 8, 10] },
        { id: 'wound', name: '創傷面', type: 'first_hit_wound', values: [1, 2, 3] },
      ],
      fused: true,
    },
    nightOnly: false,
    lore: [
      '戰爭旗來自邊境舊軍勢。布面殘破，號令卻仍能讓隊伍重新排成一線。',
      '旗桿背面刻著一隻展翼的眼。有人說，真正的戰陣需要另一面旗替它看見破口。',
    ],
    locationHint: '支援路線事件或普通聖物中可能出現。',
  },
  {
    id: 'eagle_banner',
    name: '鷹眼旗',
    icon: '⚑',
    iconImage: 'assets/relics/eagle-banner.png?v=2',
    rarity: 'rare',
    fusable: true,
    supportRelic: true,
    bannerRelic: true,
    desc: '主戰攻擊前，可選擇舉起鷹眼旗，旗面自動決定。破綻面：每回合附加 1 個鷹眼破綻；命中該破綻時 1/2/3 階額外傷害 +0/+2/+3。原生面：命中任一原生弱點時傷害 +3/+3/+4；2 階若最終骰面大於 3，新增 1 個鷹眼暫時原生弱點 2 回合；3 階若最終骰面大於 2，新增 1 個鷹眼暫時原生弱點 3 回合。鷹眼旗產生的弱點同時只能存在 1 個，且可互相覆蓋。非輔助舉旗為 1 階，若此旗已融合則為 2 階。輔助舉旗以本次攻擊骰判定：1-2 失敗，3-4 為 2 階，5-6 為 3 階；若此旗已融合，1-4 為 2 階，5-6 為 3 階。',
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
    lore: [
      '鷹眼旗並不鼓舞衝鋒，它只把敵人的破口高高標出。',
      '旗布邊緣殘留著古戰號的針腳。若與戰爭旗同列，視線與號令或許能重新合成戰陣。',
    ],
    locationHint: '支援路線事件或普通聖物中可能出現。',
  },
  {
    id: 'wager_dice',
    name: '賭命骰子',
    icon: '🎲',
    iconImage: 'assets/relics/wager-dice.png',
    rarity: 'legendary',
    fusable: true,
    eventOnly: true,
    desc: '戰鬥開始後，持有者主戰前可押注 3 個骰面。若本次攻擊命中押注骰面，傷害 +4；若未命中，下次受擊回合受到的傷害 +30%，最多 3 層。',
    effect: { type: 'wager_dice', faces: 3, damageBonus: 4, missPenaltyRate: 0.30, maxMissStacks: 3 },
    fusedEffect: { type: 'wager_dice', faces: 4, damageBonus: 4, missPenaltyRate: 0.30, maxMissStacks: 3 },
    nightOnly: false,
    lore: [
      '賭命骰子沉甸甸的，像把一小段命運握在掌心。',
      '骰角有一點星光般的凹痕。命運若要翻面，也許需要一顆不肯熄滅的星替它落定。',
    ],
    locationHint: '命運賭桌事件或聖物獎勵中可能出現。',
  },
  {
    id: 'lucky_star',
    name: '幸運星',
    icon: '⭐',
    iconImage: 'assets/relics/lucky-star.png',
    rarity: 'legendary',
    fusable: true,
    desc: '攻擊骰最終為 6 時傷害 +2；每場戰鬥前 1 次可將小於等於 3 的攻擊骰面改為 6，且免疫以此方式造成的雙數副作用。',
    effect: { type: 'lucky_star', sixDamageBonus: 2, twelveDamageBonus: 4, lowRollToSixUses: 1, forcedSixImmuneGamblerPenalty: true },
    fusedEffect: { type: 'lucky_star', sixDamageBonus: 2, twelveDamageBonus: 4, lowRollToSixUses: 2, finalSixTwelveImmuneGamblerPenalty: true, sixToTwelveUses: 2, sixToTwelveChance: 0.5 },
    nightOnly: false,
    lore: [
      '幸運星不像星星，更像一枚不肯熄滅的小小承諾。',
      '它會在骰聲最重時亮起。有人把它縫進賭具裡，說那能讓命運露出第十二個面。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'exorcism_ring',
    name: '驅邪戒',
    icon: '💍',
    iconImage: 'assets/relics/exorcism-ring.png',
    rarity: 'rare',
    fusable: true,
    desc: '每天第一次探索骰若未達成功門檻，會自動重骰一次，並採用重骰結果。',
    effect: { type: 'exorcism_ring', rerollOnFail: true, guaranteedSuccess: false },
    fusedEffect: { type: 'exorcism_ring', rerollOnFail: false, guaranteedSuccess: true },
    darkRelic: true,
    nightOnly: true,
    lore: [
      '驅魔戒的戒面刻著細小符文，靠近黑暗時會微微發熱。',
      '它不渴求共鳴，只會在第一次探索失手前收緊，像提醒持有者還有一次機會。',
    ],
    locationHint: '黑夜聖物獎勵中可能出現。',
  },
  {
    id: 'iron_scabbard',
    name: '沉鐵劍鞘',
    icon: '▰',
    iconImage: 'assets/relics/iron-scabbard.png?v=2',
    rarity: 'rare',
    fusable: true,
    desc: '持有者使用劍系武器主戰時，高骰視為重劍。重劍命中後，自身基礎攻擊 +3，直到戰鬥結束。',
    effect: { type: 'greatsword_stance', minRoll: 4, attackBonus: 3 },
    fusedEffect: { type: 'greatsword_stance', minRoll: 4, attackBonus: 5 },
    nightOnly: false,
    lore: [
      '沉鐵劍鞘比劍更沉。拔劍時，手腕會記住那份重量。',
      '鞘口內側有細小針痕，像有人曾用銀針校準重劍落下的位置。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'silver_bee_pin',
    name: '銀蜂針',
    icon: '◇',
    iconImage: 'assets/relics/silver-bee-pin.png',
    rarity: 'rare',
    fusable: true,
    desc: '持有者使用劍系武器主戰時，低骰視為刺劍。刺劍命中後觸發連擊：第一次連擊必定成功，之後每次連擊機率 -20%；連擊傷害為本次傷害的 50%。',
    effect: { type: 'rapier_stance', maxRoll: 3, damageRate: 0.5, chanceStep: 20, maxFollowUps: 5, minChance: 0 },
    fusedEffect: { type: 'rapier_stance', maxRoll: 3, damageRate: 0.5, chanceStep: 10, maxFollowUps: 10, minChance: 10 },
    nightOnly: false,
    lore: [
      '銀蜂針尾端銀亮，像一隻停在劍柄上的蜂。出劍越快，嗡鳴越細。',
      '針身曾被壓在沉重劍鞘下磨直。它可以追求連刺，也能替重劍找準最沉的一點。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'eagle_eye_feather',
    name: '鷹眼羽飾',
    icon: '🪶',
    iconImage: 'assets/relics/eagle-eye-feather.png?v=2',
    rarity: 'rare',
    fusable: true,
    desc: '主戰使用弓時，最終骰面至少為 5，可視為命中原生弱點並觸發弓追擊；此視為命中不會破壞原生弱點。',
    effect: { type: 'eagle_eye_feather', finalMin: 5, firstFollowUpDamageBonus: 0 },
    fusedEffect: { type: 'eagle_eye_feather', finalMin: 5, firstFollowUpDamageBonus: 3 },
    nightOnly: false,
    lore: [
      '鷹眼羽飾的羽梢永遠指向最脆弱的縫隙。',
      '羽軸裡藏著一道像鏡片裂紋的光。若有人用透鏡看它，箭路會變得異常清楚。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'flaw_lens',
    name: '鷹眼透鏡',
    icon: '🔍',
    iconImage: 'assets/relics/flaw-lens.png',
    rarity: 'rare',
    fusable: true,
    desc: '主戰攻擊命中原生弱點時，有 50% 機率新增 1 個原生弱點；每場戰鬥最多成功新增 1 次，失敗不消耗機會。',
    effect: { type: 'flaw_lens', chance: 0.5, guaranteed: false, fusedWeaknessDamage: 0 },
    fusedEffect: { type: 'flaw_lens', chance: 1, guaranteed: true, fusedWeaknessDamage: 2 },
    nightOnly: false,
    lore: [
      '鷹眼透鏡裡的裂紋，總能對準敵人最薄的地方。',
      '鏡框上夾著幾根舊羽。透過羽飾校準時，破口不再只是被看見，而會被獵星者釘住。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'pain_mask',
    name: '痛苦面具',
    icon: '🎭',
    iconImage: 'assets/relics/pain-mask.png',
    rarity: 'rare',
    fusable: true,
    desc: '主戰造成傷害時，每 4 點原始傷害附加 1 層傷口。',
    effect: { type: 'pain_mask', damagePerWound: 4, stacksPerStep: 1 },
    fusedEffect: { type: 'pain_mask', damagePerWound: 4, stacksPerStep: 1, explodeAtWounds: 15, explodeDamagePerWound: 2 },
    nightOnly: false,
    lore: [
      '痛苦面具內側沒有臉，只有咬緊的痛。',
      '面具額心缺了一枚徽記的形狀。若把乾涸的傷疤嵌回去，痛苦會選擇爆裂或折磨。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'pain_splinter_badge',
    name: '痛苦徽記',
    icon: '🩸',
    iconImage: 'assets/relics/pain-splinter-badge.png',
    rarity: 'rare',
    fusable: true,
    desc: '攻擊骰最終骰面為 6 時，附加 2 層傷口。攻擊 5 層以上傷口的敵人時，最終傷害提高 20%。',
    effect: { type: 'wound_damage_bonus', threshold: 5, bonusRate: 0.20, woundOnRoll: 6, woundStacks: 2 },
    fusedEffect: { type: 'wound_damage_bonus', threshold: 5, bonusRate: 0.30, woundMax: 20, woundOnRoll: 6, woundStacks: 3 },
    nightOnly: false,
    lore: [
      '痛苦徽記像乾涸的傷疤，碰到鮮血時又重新發亮。',
      '徽記背面磨出面具內側的弧度。它能讓痛保持清醒，也能讓痛在極限時炸開。',
    ],
    locationHint: '普通聖物獎勵中可能出現。',
  },
  {
    id: 'black_iron_crown',
    name: '黑鐵王冠',
    icon: '👑',
    iconImage: 'assets/relics/black-iron-crown.png',
    rarity: 'legendary',
    fusable: true,
    darkRelic: true,
    desc: '主動討伐黑暗化身時，若黑暗化身等級高於 5，戰鬥等級 -2，最低降至 5。被動追殺不會降低等級。',
    effect: { type: 'dark_monster_hunt_weaken', value: 2, minLevel: 5, fusedDamageRate: 0.10, fusedMinBonus: 1 },
    nightOnly: true,
    lore: [
      '黑鐵冠不是為王準備的，而是為仍敢直視黑夜的人。',
      '冠內沒有另一件聖物的凹槽，只有被黑暗化身抓出的刮痕。它的力量不是共鳴，而是狩獵。',
    ],
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

const RELIC_FUSED_DESCS = {
  war_banner: '主戰攻擊前，可選擇舉起戰爭旗，旗面自動決定。戰吼面：每回合開始時對敵人造成 5/8/10 點固定傷害。創傷面：每回合第一次擊中時施加 1/2/3 層傷口。融合後此旗不會舉旗失敗；非輔助舉起時直接成為 2 階，輔助舉起時 1-4 為 2 階，5-6 為 3 階。',
  eagle_banner: '主戰攻擊前，可選擇舉起鷹眼旗，旗面自動決定。破綻面：每回合附加 1 個鷹眼破綻；命中該破綻時 1/2/3 階額外傷害 +0/+2/+3。原生面：命中任一原生弱點時傷害 +3/+3/+4；2 階若最終骰面大於 3，新增 1 個鷹眼暫時原生弱點 2 回合；3 階若最終骰面大於 2，新增 1 個鷹眼暫時原生弱點 3 回合。融合後此旗不會舉旗失敗；非輔助舉起時直接成為 2 階，輔助舉起時 1-4 為 2 階，5-6 為 3 階。',
  wager_dice: '戰鬥開始後，持有者主戰前可押注 4 個骰面。若本次攻擊命中押注骰面，傷害 +4；若未命中，下次受擊回合受到的傷害 +30%，最多 3 層。',
  lucky_star: '攻擊骰最終為 6 時傷害 +2；攻擊骰最終為 12 時傷害 +4。每場戰鬥前 2 次可將小於等於 3 的攻擊骰面改為 6，且完全免疫最終骰面 6 與 12 的雙數副作用。若使用 12 面骰，每場戰鬥前 2 次骰到 6 時有 50% 機率改為 12。',
  exorcism_ring: '每天第一次探索骰必定成功：若骰面低於成功門檻，將最終骰面提高到該門檻。',
  iron_scabbard: '持有者使用劍系武器主戰時，高骰視為重劍。重劍命中後，自身基礎攻擊 +5，直到戰鬥結束。',
  silver_bee_pin: '持有者使用劍系武器主戰時，低骰視為刺劍。刺劍命中後觸發連擊：第一次連擊必定成功，之後每次連擊機率 -10%，最低 10%；連擊傷害為本次傷害的 50%。',
  eagle_eye_feather: '主戰使用弓時，最終骰面至少為 5，可視為命中原生弱點並觸發弓追擊；此視為命中不會破壞原生弱點。每場戰鬥第一次由鷹眼羽飾觸發的弓追加攻擊，額外傷害 +3。',
  flaw_lens: '主戰攻擊命中原生弱點時，必定新增 1 個原生弱點；每場戰鬥最多成功新增 1 次。命中原生弱點時傷害 +2。',
  pain_mask: '主戰造成傷害時，每 4 點原始傷害附加 1 層傷口。若敵人傷口達 15 層，會引爆並消耗所有傷口，每層造成 2 點固定傷害。',
  pain_splinter_badge: '攻擊骰最終骰面為 6 時，附加 3 層傷口。攻擊 5 層以上傷口的敵人時，最終傷害提高 30%，並將傷口上限提高至 20。',
  black_iron_crown: '主動討伐黑暗化身時，若黑暗化身等級高於 5，戰鬥等級 -2，最低降至 5。被動追殺不會降低等級。主動討伐黑暗化身時，全隊對黑暗化身造成的傷害 +10%，至少 +1。',
};

function relicEffectDesc(relic, fused = false) {
  if (!relic) return '';
  if (fused && RELIC_FUSED_DESCS[relic.id]) return RELIC_FUSED_DESCS[relic.id];
  return relic.desc || '';
}

function relicFusionDesc(relic) {
  if (!relic?.fusedEffect) return '';
  return RELIC_FUSED_DESCS[relic.id] || '';
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

// Consumables, weapons, and gear.
const EQUIPMENT = [
  {
    id: 'herb_pack',
    name: '草藥包',
    icon: '🌿',
    desc: '立即使用，恢復目標 30% 最大生命；輔助使用時恢復 40%。',
    useType: 'instant',
    useInCombat: true,
    useOutOfCombat: true,
    effect: { type: 'heal_percent', value: 0.30, supportValue: 0.40 },
  },
  {
    id: 'whetstone',
    name: '磨刀石',
    icon: '🪨',
    desc: '本場戰鬥主戰攻擊 +1。',
    useType: 'combat_mod',
    useInCombat: true,
    useOutOfCombat: false,
    effect: { type: 'attack_bonus', value: 1 },
  },
  {
    id: 'leather_patch',
    name: '皮革補片',
    icon: '🧩',
    desc: '本場戰鬥受到的傷害 -1。',
    useType: 'combat_mod',
    useInCombat: true,
    useOutOfCombat: false,
    effect: { type: 'damage_reduce', value: 1 },
  },
  {
    id: 'bone_dice',
    name: '骨骰',
    icon: '🎲',
    desc: '下一次骰子判定重骰，保留較高結果。',
    useType: 'roll_mod',
    useInCombat: true,
    useOutOfCombat: true,
    effect: { type: 'reroll_keep_high' },
  },
  {
    id: 'focus_charm',
    name: '專注護符',
    icon: '🔷',
    desc: '下一次骰子判定，若擲出 1 改為 2。',
    useType: 'roll_mod',
    useInCombat: true,
    useOutOfCombat: true,
    effect: { type: 'floor_one', value: 2 },
  },
];

const WEAPONS = [
  {
    id: 'sword',
    name: '劍',
    icon: '⚔️',
    desc: '主戰時，傷害 +1。',
    effect: { type: 'damage_bonus', value: 1 },
  },
  {
    id: 'bow',
    name: '弓',
    icon: '🏹',
    desc: '主戰時，命中原生弱點後，可追加攻擊一次。每次追加攻擊若再次命中原生弱點，可繼續追加攻擊。每回合最多額外追擊 2 次。',
    effect: { type: 'bow_followup', maxPerRound: 2 },
  },
  {
    id: 'dagger',
    name: '匕首',
    icon: '🗡️',
    desc: '主戰時，命中弱點時，額外 +2 傷害。',
    effect: { type: 'weakness_bonus', value: 2 },
  },
  {
    id: 'hammer',
    name: '槌',
    icon: '🔨',
    desc: '主戰時，額外破除敵人 2 點格檔；若擲出 1，主戰者 -1 HP。',
    effect: { type: 'defense_pierce', value: 2, penalty: { onRoll: 1, selfDmg: 1 } },
  },
  {
    id: 'battle_drum',
    name: '戰鼓',
    icon: '🥁',
    desc: '主戰攻擊後，敲響戰鼓：接下來 2 次我方主戰攻擊 +1 攻擊。不可疊加，可重新敲響刷新次數。持鼓者主戰時，骰面附加傷害減半。',
    effect: { type: 'battle_drum', attackBonus: 1, durationAttacks: 2, diceDamageRate: 0.5 },
  },
  {
    id: 'healing_staff',
    name: '祈癒杖',
    icon: '+',
    desc: '主戰時，命中原生弱點後，全隊恢復 1 HP。',
    effect: { type: 'healing_staff', healOnRealWeakness: 1 },
  },
  {
    id: 'katana',
    name: '太刀',
    icon: '⚔️',
    desc: '主戰造成傷害時，施加 1 層傷口。每 1 層傷口使敵人受到的傷害提高 5%，通常上限 15 層。',
    effect: { type: 'wound_on_hit', stacks: 1 },
  },
];

Object.assign(WEAPONS.find(w => w.id === 'sword') || {}, { family: 'sword', tier: 1, upgradeTo: 'sword_plus' });
Object.assign(WEAPONS.find(w => w.id === 'bow') || {}, { family: 'bow', tier: 1, upgradeTo: 'bow_plus' });
Object.assign(WEAPONS.find(w => w.id === 'dagger') || {}, { family: 'dagger', tier: 1, upgradeTo: 'dagger_plus' });
Object.assign(WEAPONS.find(w => w.id === 'hammer') || {}, { family: 'hammer', tier: 1, upgradeTo: 'hammer_plus' });
Object.assign(WEAPONS.find(w => w.id === 'battle_drum') || {}, { family: 'battle_drum', tier: 1, upgradeTo: 'battle_drum_plus' });
Object.assign(WEAPONS.find(w => w.id === 'healing_staff') || {}, { family: 'healing_staff', tier: 1, upgradeTo: 'healing_staff_plus' });
Object.assign(WEAPONS.find(w => w.id === 'katana') || {}, { family: 'katana', tier: 1, upgradeTo: 'soul_cutter_katana' });

WEAPONS.push(
  {
    id: 'sword_plus',
    family: 'sword',
    tier: 2,
    name: '進階劍',
    icon: '⚔️',
    desc: '主戰時，傷害 +2。',
    effect: { type: 'damage_bonus', value: 2 },
  },
  {
    id: 'bow_plus',
    family: 'bow',
    tier: 2,
    name: '逐星弓',
    icon: '🏹',
    desc: '主戰時，命中原生弱點後可追加攻擊。每回合最多額外追擊 3 次；本回合每次追加攻擊傷害額外 +2，可疊加。',
    effect: { type: 'bow_followup', maxPerRound: 3, followUpDamageStep: 2 },
  },
  {
    id: 'dagger_plus',
    family: 'dagger',
    tier: 2,
    name: '影牙匕首',
    icon: '🗡️',
    desc: '主戰時，命中弱點時額外 +2 傷害。若本次攻擊未命中任何弱點，額外造成等同於最終骰面的傷害。',
    effect: { type: 'shadow_fang_dagger', weaknessBonus: 2 },
  },
  {
    id: 'hammer_plus',
    family: 'hammer',
    tier: 2,
    name: '進階槌',
    icon: '🔨',
    desc: '主戰時，額外破除敵人 4 點格檔；若擲出 1，主戰者 -1 HP。',
    effect: { type: 'defense_pierce', value: 4, penalty: { onRoll: 1, selfDmg: 1 } },
  },
  {
    id: 'battle_drum_plus',
    family: 'battle_drum',
    tier: 2,
    name: '進階戰鼓',
    icon: '🥁',
    desc: '主戰攻擊後，敲響戰鼓：接下來 3 次我方主戰攻擊 +1 攻擊。不可疊加，可重新敲響刷新次數。持鼓者主戰時，骰面附加傷害減半。',
    effect: { type: 'battle_drum', attackBonus: 1, durationAttacks: 3, diceDamageRate: 0.5 },
  },
  {
    id: 'healing_staff_plus',
    family: 'healing_staff',
    tier: 2,
    name: '進階祈癒杖',
    icon: '+',
    desc: '主戰時，本次攻擊無視敵人格檔。命中原生弱點時，全隊恢復 2 HP。',
    effect: { type: 'healing_staff', healOnRealWeakness: 2 },
  },
  {
    id: 'soul_cutter_katana',
    family: 'katana',
    tier: 2,
    name: '斷魂太刀',
    icon: '⚔️',
    desc: '主戰造成傷害時，施加 1 層傷口；命中 8 層以上傷口的敵人時，本次傷害 +3；若本次攻擊觸發傷口引爆，額外造成 10 點固定傷害。',
    effect: { type: 'wound_on_hit', stacks: 1, highWoundDamageBonus: 3, woundThreshold: 8, explodeDamage: 10 },
  },
);

const GEARS = [
  {
    id: 'shield',
    name: '盾牌',
    icon: '🛡️',
    desc: '主戰攻擊時，獲得等同骰面一半的格檔，向下取整，最低 1。',
    effect: { type: 'player_block_on_attack', rollDivisor: 2, min: 1 },
  },
  {
    id: 'grappling_hook',
    name: '鉤索',
    icon: '🪝',
    desc: '主戰攻擊時，若原本未命中任何弱點，最終骰面 +1 並重新判定命中。每回合限一次；若因此命中原生弱點，不會觸發弓追擊。',
    effect: { type: 'grappling_hook', value: 1 },
  },
  {
    id: 'telescope',
    name: '望遠鏡',
    icon: '🔭',
    desc: '若裝備者不是主戰者，敵人新增 1 個破綻。',
    effect: { type: 'add_temp_weakness' },
  },
  {
    id: 'bandage',
    name: '繃帶包',
    icon: '🩹',
    desc: '主戰攻擊後，治療生命比例最低的隊友 3 HP。每場戰鬥限一次。',
    effect: { type: 'battlefield_bandage', value: 3 },
  },
  {
    id: 'serrated_oil',
    name: '鋸齒油',
    icon: '🧴',
    desc: '主戰攻擊時，若最終骰面至少為 5 且造成傷害，額外施加 1 層傷口。每回合限一次。',
    effect: { type: 'serrated_oil', rollMin: 5, stacks: 1 },
  },
  {
    id: 'corrosive_oil',
    name: '腐蝕油',
    icon: '🧪',
    desc: '主戰命中任一弱點且敵人至少 5 層傷口時，消耗 1 層傷口並造成 3 點固定傷害。每回合限一次。',
    minDay: 10,
    effect: { type: 'corrosive_oil', woundThreshold: 5, woundCost: 1, damage: 3 },
  },
  {
    id: 'bone_dice_bag',
    name: '骨骰袋',
    icon: '🎲',
    desc: '每場戰鬥前 2 次，攻擊骰 1/2/3 會翻為 6/5/4。若因此觸發搏命者雙數，免疫該次反噬與減傷。',
    effect: { type: 'low_roll_flip', usesPerCombat: 2, map: { 1: 6, 2: 5, 3: 4 } },
  },
];

function getWeaponById(id) {
  return WEAPONS.find(w => w.id === id) || null;
}

function randomWeaponForSquad(squad = []) {
  const blockedFamilies = new Set((squad || [])
    .map(c => c.weapon)
    .filter(w => (w?.tier || 1) > 1)
    .map(w => w.family || w.id));
  const pool = WEAPONS.filter(w => (w.tier || 1) === 1 && !blockedFamilies.has(w.family || w.id));
  if (pool.length === 0) return null;
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}

function getGearById(id) {
  return GEARS.find(g => g.id === id) || null;
}

function getEquipById(id) {
  return EQUIPMENT.find(e => e.id === id) || null;
}

function randomEquipment(day = 1) {
  const pool = EQUIPMENT.filter(item => !item.minDay || day >= item.minDay);
  const source = pool.length > 0 ? pool : EQUIPMENT;
  return { ...source[Math.floor(Math.random() * source.length)] };
}

function randomGear(day = 1) {
  const pool = GEARS.filter(item => !item.minDay || day >= item.minDay);
  const source = pool.length > 0 ? pool : GEARS;
  return { ...source[Math.floor(Math.random() * source.length)] };
}

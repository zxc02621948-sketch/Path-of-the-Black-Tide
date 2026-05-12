// 敵人定義
// 弱/中型敵人使用 tiers 陣列，依天數自動升階
// 強型（boss）使用平坦數值，不升階
//
// 升階公式：tierIdx = floor((day - 1) / tierUpDays)，上限為 tiers.length - 1
// 傷害公式：damage = max(0, 攻擊力 + 骰值)，格檔由意圖決定（每回合重置）
// 角色攻擊力：戰士 5 / 搏命者 4 / 探索者 3 / 輔助 2
//
// 意圖類型：
//   attack       → 攻擊主戰者（傷害 = enemy.attack）
//   block        → 格檔（值 = enemy.block），本回合不反擊
//   block_attack → 格檔 + 攻擊主戰者
//   aoe          → 全體攻擊（傷害 = max(1, enemy.attack - 2)）
//   dice_attack  → 擲 1d6 決定攻擊力
//   idle         → 不攻擊

const ENEMIES = [

  // ══ 弱型（tierUpDays: 3，4 階）════════════════════════════

  {
    id: 'shadow_worm',
    icon: '🪱',
    tier: 'weak',
    tierUpDays: 3,
    weakness: 3,
    weaknessEffect: { type: 'stun', desc: '蠕蟲被震懾，本回合不反擊' },
    nightOnly: false,
    lore: '邊境封鎖後第三年，首次出現在北方廢墟。沒有眼睛，靠震動感知獵物。',
    intents: [
      { type: 'attack',      weight: 2 },
      { type: 'dice_attack', weight: 2 },
    ],
    tiers: [
      { name: '黑影蠕蟲', desc: '在廢墟縫隙中蠕動，移動迅速，無法格檔',             hp: 18, block: 0, attack: 3 },
      { name: '暗蝕蠕蟲', desc: '被黑暗侵蝕後體型膨脹，速度未減',                   hp: 23, block: 0, attack: 4 },
      { name: '深淵蠕蟲', desc: '幾乎與黑暗融為一體，偶爾才看得出輪廓',             hp: 29, block: 0, attack: 5 },
      { name: '虛空蠕蟲', desc: '完全吸收了黑暗，每一次衝擊都帶著虛空的重量',       hp: 35, block: 0, attack: 5 },
    ],
  },

  {
    id: 'rot_crawler',
    icon: '🦂',
    tier: 'weak',
    tierUpDays: 3,
    weakness: 5,
    weaknessEffect: { type: 'block_break', desc: '甲殼破裂，暫時無法格檔，直到我方下一回合結束' },
    abilities: [{ type: 'shell_charge', maxStacks: 3, bonusPerStack: 1 }],
    nightOnly: false,
    lore: '舊日的甲蟲被黑暗腐化，外殼變得堅硬，但弱點是那條連結頭部與軀幹的縫隙。',
    intents: [
      { type: 'block',       weight: 3 },
      { type: 'block_attack',weight: 1 },
      { type: 'attack',      weight: 1 },
    ],
    tiers: [
      { name: '腐骨爬蟲', desc: '甲殼厚重，常以格檔抵擋攻擊再反擊',                 hp: 20, block: 3, attack: 2 },
      { name: '腐甲爬蟲', desc: '甲殼已被黑暗強化，格檔值更高',                     hp: 25, block: 4, attack: 3 },
      { name: '黑鐵爬蟲', desc: '幾乎無法正面擊穿，弱點縫隙是唯一機會',             hp: 31, block: 5, attack: 4 },
      { name: '深淵爬蟲', desc: '外殼已完全黑化，格檔幾乎無懈可擊',                 hp: 37, block: 6, attack: 4 },
    ],
  },

  {
    id: 'plague_moth',
    icon: '🦋',
    tier: 'weak',
    tierUpDays: 3,
    weakness: 2,
    weaknessEffect: { type: 'poison_weaken', desc: '毒粉潰散，本場戰鬥毒粉傷害 -1' },
    abilities: [{ type: 'poison_dust', weakenReduction: 1 }],
    nightOnly: false,
    lore: '翅膀上的鱗粉有輕微毒性，大量聚集時會讓人產生幻覺。',
    intents: [
      { type: 'aoe', weight: 1 },
    ],
    tiers: [
      { name: '瘴氣毒蛾', desc: '翅膀散出腐蝕性毒粉，穩定壓低全隊血線',             hp: 15, block: 0, attack: 0 },
      { name: '腐蝕毒蛾', desc: '毒粉濃度提升，全體毒粉更具威脅',                   hp: 19, block: 0, attack: 1 },
      { name: '深淵毒蛾', desc: '黑暗賦予更強毒性，揮翅就帶起腐化的氣流',           hp: 24, block: 0, attack: 1 },
      { name: '虛空毒蛾', desc: '翅膀幾乎透明，毒性已足以讓人短暫失去方向感',       hp: 29, block: 0, attack: 2 },
    ],
  },

  // ══ 中型（tierUpDays: 6，3 階）════════════════════════════

  {
    id: 'rot_knight',
    icon: '💀',
    tier: 'medium',
    tierUpDays: 6,
    weakness: 4,
    weaknessEffect: { type: 'block_break', desc: '盔甲破碎，暫時無法格檔，直到我方下一回合結束' },
    abilities: [{ type: 'block_thorns' }],
    nightOnly: false,
    lore: '有人說它們曾經是守衛，是黑夜將它們留下，讓它們繼續站崗。',
    intents: [
      { type: 'block',        weight: 3 },
      { type: 'block_attack', weight: 1 },
      { type: 'attack',       weight: 1 },
    ],
    tiers: [
      { name: '腐骨騎士', desc: '腐爛的盔甲仍然堅固，硬砍格檔會受到反震',           hp: 28, block: 4, attack: 3, thornDamage: 1 },
      { name: '黑鐵騎士', desc: '黑暗強化了甲冑，格檔幾乎成為本能',                 hp: 36, block: 5, attack: 4, thornDamage: 2 },
      { name: '深淵騎士', desc: '已與黑暗融合，盔甲是它的皮膚，格檔是它的呼吸',     hp: 45, block: 6, attack: 5, thornDamage: 2 },
    ],
  },

  {
    id: 'shadow_hunter',
    icon: '👁️',
    tier: 'medium',
    tierUpDays: 6,
    weakness: 1,
    weaknessEffect: { type: 'expose', duration: 2, desc: '獵人被揭露，追獵與低血增傷暫時失效 2 回合' },
    abilities: [{ type: 'blood_hunt', lowHpThreshold: 0.5, damageBonus: 1 }],
    nightOnly: false,
    lore: '迷霧獵人的弱點是速度——它移動太快，快到偶爾會自己撞上障礙。',
    intents: [
      { type: 'attack',      weight: 1 },
      { type: 'dice_attack', weight: 2 },
      { type: 'aoe',         weight: 1 },
    ],
    tiers: [
      { name: '暗影獵人', desc: '潛伏於陰影之中，優先追殺血線最低者',               hp: 24, block: 0, attack: 4 },
      { name: '深影獵人', desc: '更深的黑影包覆牠的輪廓，追獵更加致命',             hp: 32, block: 1, attack: 5 },
      { name: '虛空獵人', desc: '已與虛空融合，意圖更難預測',                       hp: 40, block: 2, attack: 6 },
    ],
  },

  // ══ 強型（固定數值，不升階）═══════════════════════════════

  {
    id: 'dice_corruptor',
    icon: '☣️',
    tier: 'strong',
    tierUpDays: 10,
    weakness: 3,
    weaknessEffect: { type: 'clear_dice_pollution', desc: '污染核心破裂，全隊各清除 1 個污染骰面' },
    abilities: [{ type: 'dice_pollution', heal: 6, empoweredSelfDamage: 1, empoweredMax: 3 }],
    nightOnly: false,
    lore: '牠不吞食血肉，而是污染骰運。被牠注視過的人會在熟悉的骰面上看見黑斑，下一次命運落在那裡時，攻擊只會餵飽牠。',
    intents: [
      { type: 'pollute', weight: 1 },
    ],
    tiers: [
      { name: '腐骰宿主', desc: '寄生在骰運上的污染怪。會污染隊友骰面，讓攻擊歸零並為自身回血。', hp: 78, block: 0, attack: 5 },
      { name: '深污腐骰宿主', desc: '污染已滲入牠周圍的每一次擲骰。拖得越久，滿污染後的反噬越危險。', hp: 92, block: 0, attack: 6 },
    ],
  },

  {
    id: 'cage_warden',
    name: '囚籠看守',
    icon: '🗝️',
    desc: '拖著鏽鐵鑰匙的看守，身後傳來被囚者的低聲呼救',
    hp: 38,
    block: 3,
    attack: 4,
    weakness: 5,
    weaknessEffect: { type: 'block_break', desc: '鑰匙束被擊落，看守暫時無法格檔，直到我方下一回合結束' },
    nightOnly: false,
    boss: true,
    rescueBoss: true,
    lore: '它不像在巡邏，更像是在清點還活著的人。',
    intents: [
      { type: 'attack',       weight: 2 },
      { type: 'block',        weight: 2 },
      { type: 'block_attack', weight: 1 },
      { type: 'aoe',          weight: 1 },
    ],
  },

  {
    id: 'abyss_warden',
    name: '深淵守衛',
    icon: '🌑',
    desc: '只在黑夜中現身，格檔極高，正面強攻幾乎無效',
    hp: 150,
    block: 5,
    attack: 6,
    weakness: 6,
    weaknessEffect: { type: 'fear', desc: '守衛發出驚懼氣息，此擊無視格檔' },
    nightOnly: true,
    lore: '沒有人知道它來自哪裡。有人說黑夜本身就是它的家。',
    intents: [
      { type: 'block',        weight: 3 },
      { type: 'block_attack', weight: 1 },
      { type: 'attack',       weight: 2 },
    ],
  },

  {
    id: 'erosion_warden',
    name: '侵蝕之喉',
    icon: '🌫️',
    desc: '黑暗凝聚的形體，擊敗它可減少黑暗',
    hp: 150,
    block: 3,
    attack: 6,
    weakness: 6,
    weaknessEffect: { type: 'fear', desc: '黑霧潰散，此擊無視格檔' },
    nightOnly: false,
    boss: true,
    erosionBoss: true,
    lore: '它不守衛任何東西。它本身就是侵蝕的入口。',
    intents: [
      { type: 'aoe',         weight: 2 },
      { type: 'dice_attack', weight: 2 },
      { type: 'attack',      weight: 1 },
    ],
  },
  {
    id: 'treasure_mimic',
    name: '寶箱擬態怪',
    icon: '▣',
    desc: '破損寶箱裡蜷伏的怪物，硬殼裡卡著尚能使用的裝備。',
    hp: 34,
    block: 5,
    attack: 5,
    weakness: 5,
    weaknessEffect: { type: 'gear_drop_boost', desc: '箱扣鬆脫，若勝利，角色裝備掉落率提高' },
    nightOnly: false,
    boss: true,
    treasureMimic: true,
    lore: '它學會了等待貪心的人，也學會了把戰利品藏進肚子裡。',
    intents: [
      { type: 'block',        weight: 1 },
      { type: 'block_attack', weight: 2 },
      { type: 'attack',       weight: 2 },
      { type: 'aoe',          weight: 1 },
    ],
  },

  {
    id: 'echo_guardian_wound',
    name: '痛痕守護者',
    icon: '🩸',
    desc: '共鳴遺址中的守護者，身上纏滿不會癒合的黑色傷痕。',
    hp: 90,
    block: 0,
    attack: 3,
    weakness: 4,
    weaknessEffect: { type: 'suppress_pain_growth', desc: '傷痕崩裂，痛痕守護者不再於每回合開始自然累積傷口' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'wound',
    abilities: [
      { type: 'pain_growth', naturalStacks: 2, attackBonusPerWounds: 2, specialEvery: 3, specialStacks: 6, selfDamagePerStack: 1 },
    ],
    lore: '它不像被傷口折磨，而像是把傷口當成武器養在身上。',
    intents: [
      { type: 'attack', weight: 3 },
      { type: 'aoe',    weight: 1 },
    ],
  },

  {
    id: 'echo_guardian_eagle',
    name: '裂隙凝視者',
    icon: '🔍',
    desc: '共鳴遺址中的守護者，眼中浮著細碎裂光，像在等待破綻張開。',
    hp: 50,
    block: 0,
    attack: 4,
    weakness: 5,
    weaknessEffect: { type: 'clear_gaze_weaknesses', desc: '凝視破碎，清除我方全體由裂隙凝視產生的原生弱點' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'eagle',
    abilities: [
      { type: 'rift_gaze', addPerRound: 1, nativeDamageBonus: 3 },
    ],
    lore: '被它盯上的人，會先感覺到自己的弱點。',
    intents: [
      { type: 'attack',      weight: 3 },
      { type: 'aoe',         weight: 1 },
    ],
  },

  {
    id: 'echo_guardian_fate',
    name: '擲命守衛',
    icon: '🎲',
    desc: '共鳴遺址中的守護者，掌心反覆滾動著沒有落點的黑骰。',
    hp: 50,
    block: 0,
    attack: 6,
    weakness: 1,
    weaknessEffect: { type: 'add_fate_unlucky', desc: '命運偏折，擲命守衛本次命運骰新增 1 個厄運面' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'fate',
    abilities: [
      { type: 'fate_gamble', luckyMultiplier: 4 },
    ],
    lore: '它不預測命運，只負責讓所有結果都變得更昂貴。',
    intents: [
      { type: 'attack', weight: 1 },
    ],
  },

  {
    id: 'echo_guardian_banner',
    name: '殘旗守衛',
    icon: '⚑',
    desc: '共鳴遺址中的守護者，背後殘旗無風自揚，像仍在號令早已消失的軍勢。',
    hp: 60,
    block: 6,
    attack: 4,
    weakness: 3,
    weaknessEffect: { type: 'fear', desc: '旗勢動搖，此擊無視格檔' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'banner',
    lore: '它守著的不是旗，而是旗倒下前最後一個命令。',
    intents: [
      { type: 'attack', weight: 1 },
    ],
    abilities: [
      { type: 'banner_guardian', woundStacks: 2, damageBonus: 2, switchBlock: 6 },
    ],
  },

  {
    id: 'training_dummy',
    name: '測試木樁',
    icon: '◎',
    desc: '不會攻擊的測試用目標，適合測量流派傷害、疊層與連擊節奏。',
    hp: 999,
    block: 0,
    attack: 0,
    weakness: 6,
    weaknessEffect: { type: 'fear', desc: '木樁毫無防備，此擊無視格檔' },
    nightOnly: false,
    boss: true,
    devOnly: true,
    lore: '它沒有故事。它只是站在那裡，承受所有奇怪的測試。',
    intents: [
      { type: 'idle', weight: 1 },
    ],
  },
];

// ── 升階解算 ──────────────────────────────────────────────────
function resolveEnemyTier(base, day) {
  if (!base.tiers) return { ...base };
  const idx = Math.min(base.tiers.length - 1, Math.floor((day - 1) / base.tierUpDays));
  return { ...base, ...base.tiers[idx], tiers: undefined };
}

// ── 意圖解算 ──────────────────────────────────────────────────
function resolveIntent(enemy) {
  const intents = enemy.intents;
  if (!intents || intents.length === 0) return { type: 'attack', weight: 1 };
  const total = intents.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const intent of intents) {
    r -= (intent.weight || 1);
    if (r <= 0) return intent;
  }
  return intents[intents.length - 1];
}

function intentLabel(intent, enemy) {
  const blk = enemy.block || 0;
  const atk = enemy.attack || 0;
  const aoe = Math.max(1, atk - 2);
  switch (intent.type) {
    case 'attack':       return `⚔️ 攻擊主戰者　${atk} 傷`;
    case 'block':        return `🛡️ 格檔　+${blk}`;
    case 'block_attack': return `🛡️⚔️ 格檔 +${blk}，攻擊主戰者 ${atk} 傷`;
    case 'aoe':          return `🌊 全體攻擊　各 ${aoe} 傷`;
    case 'dice_attack':  return `🎲 擲骰攻擊　骰數傷害`;
    case 'idle':         return '… 不攻擊';
    default:             return '❓ 未知意圖';
  }
}

// ── 查詢 ──────────────────────────────────────────────────────
function getEnemyById(id) {
  return ENEMIES.find(e => e.id === id) || null;
}

function getDayEnemies() {
  return ENEMIES.filter(e => !e.nightOnly);
}

function getNightEnemies() {
  return ENEMIES;
}

function randomEnemyForDay(isNight, dayOverride = null) {
  const day = dayOverride || (typeof G !== 'undefined' && G?.day) || 1;
  const allowedTiers = day >= 13 ? ['weak', 'medium', 'strong'] : (day <= 3 ? ['weak'] : ['weak', 'medium']);
  const pool = (isNight ? getNightEnemies() : getDayEnemies())
    .filter(e => !e.boss && !e.rescueBoss && !e.erosionBoss)
    .filter(e => allowedTiers.includes(e.tier));
  const base = pool[Math.floor(Math.random() * pool.length)];
  return resolveEnemyTier(base, day);
}

function randomEnemy(isNight) {
  return randomEnemyForDay(isNight);
}

function getRescueBossEnemy() {
  const boss = ENEMIES.find(e => e.rescueBoss);
  return boss ? { ...boss } : randomEnemy(false);
}

function getErosionBossEnemy() {
  const boss = ENEMIES.find(e => e.erosionBoss);
  return boss ? { ...boss } : randomEnemy(true);
}

function getTreasureMimicEnemy() {
  const mimic = ENEMIES.find(e => e.treasureMimic);
  return mimic ? { ...mimic } : randomEnemy(false);
}

function getEchoGuardianEnemy(systemId) {
  const guardian = ENEMIES.find(e => e.echoGuardian && e.echoSystemId === systemId);
  const fallback = ENEMIES.find(e => e.echoGuardian);
  return guardian ? { ...guardian } : (fallback ? { ...fallback } : randomEnemy(false));
}

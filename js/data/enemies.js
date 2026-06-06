// 敵人定義
// 弱/中型敵人使用 tiers 陣列，依天數自動升階
// 強型（boss）使用平坦數值，不升階
//
// 升階公式：tierIdx = floor((day - 1) / tierUpDays)，上限為 tiers.length - 1
// 傷害公式：damage = max(0, 攻擊力 + 骰值)，格檔由意圖決定（每回合重置）
// 角色攻擊力：戰士 5 / 搏命者 4 / 探索者 3 / 輔助 2
//
// 意圖類型：
//   attack       → 攻擊主戰者（弱/中型傷害 = enemy.attack + 三面骰）
//   block        → 格檔（值 = enemy.block），本回合不攻擊
//   block_attack → 格檔 + 攻擊主戰者（弱/中型傷害 = enemy.attack + 三面骰）
//   aoe          → 全體攻擊（傷害 = max(1, enemy.attack - 2)）
//   dice_attack  → 弱/中型擲三面骰，加上 enemy.attack；強敵維持 1d6
//   worm_coil    → 蠕蟲蜷縮蓄勢，不攻擊，格檔並強化下一次攻擊
//   idle         → 不攻擊

const ENEMIES = [

  // ══ 弱型（tierUpDays: 3，4 階）════════════════════════════

  {
    id: 'shadow_worm',
    icon: '蟲',
    iconImage: 'assets/enemies/shadow-worm.png',
    iconFlipX: true,
    iconScale: 'large',
    spawnSfx: 'shadowWormSpawnGrowl',
    spawnSfxVolume: 0.5,
    tier: 'weak',
    tierUpDays: 3,
    weakness: 3,
    weaknessEffect: { type: 'stun', desc: '蠕蟲被震懾，下一次先攻中斷' },
    abilities: [{ type: 'first_strike', coilBlock: 2, coilDamageBonus: 1 }],
    attackTrail: 'jaw_bite',
    attackSfx: 'shadowWormSpawnGrowl',
    attackSfxVolume: 0.32,
    nightOnly: false,
    lore: '邊境封鎖後第三年，首次出現在北方廢墟。沒有眼睛，靠震動感知獵物。',
    intents: [
      { type: 'attack',      weight: 2 },
      { type: 'dice_attack', weight: 2 },
      { type: 'worm_coil',   weight: 1 },
    ],
    tiers: [
      { name: '黑影蠕蟲', desc: '在廢墟縫隙中蠕動，每回合選擇主戰者後會先攻，無法格檔', hp: 21, block: 0, attack: 3 },
      { name: '暗蝕蠕蟲', desc: '被黑暗侵蝕後體型膨脹，每回合選擇主戰者後會先攻', hp: 26, block: 0, attack: 3 },
      { name: '深淵蠕蟲', desc: '幾乎與黑暗融為一體，每回合選擇主戰者後會先攻',   hp: 32, block: 0, attack: 4 },
      { name: '虛空蠕蟲', desc: '完全吸收了黑暗，每回合選擇主戰者後會先攻，每次衝擊都帶著虛空的重量', hp: 39, block: 0, attack: 4 },
    ],
  },

  {
    id: 'rot_crawler',
    icon: '蟲',
    iconImage: 'assets/enemies/rot-crawler.png',
    iconScale: 'large',
    spawnSfx: 'rotCrawlerSpawnHiss',
    spawnSfxVolume: 0.52,
    tier: 'weak',
    tierUpDays: 3,
    weakness: 5,
    weaknessEffect: { type: 'block_break', desc: '甲殼破裂，清除格檔，本場不再再生硬殼' },
    abilities: [{ type: 'shell_regen', blockByStage: [3, 3, 4, 4], blockTargetDamageBonus: 2 }],
    attackTrail: 'shell_impact',
    attackSfx: 'rotCrawlerSpawnHiss',
    attackSfxVolume: 0.34,
    nightOnly: false,
    lore: '舊日的甲蟲被黑暗腐化，外殼變得堅硬，但弱點是那條連結頭部與軀幹的縫隙。',
    intents: [
      { type: 'attack',      weight: 1 },
    ],
    tiers: [
      { name: '腐骨爬蟲', desc: '甲殼厚重，常以格檔抵擋攻擊後再發起攻擊',           hp: 20, block: 3, attack: 2 },
      { name: '腐甲爬蟲', desc: '甲殼已被黑暗強化，攻擊有格檔的目標時更加兇狠',     hp: 25, block: 3, attack: 3 },
      { name: '黑鐵爬蟲', desc: '幾乎無法正面擊穿，弱點縫隙是唯一機會',             hp: 31, block: 4, attack: 4 },
      { name: '深淵爬蟲', desc: '外殼已完全黑化，會追著防線薄弱處啃咬',             hp: 37, block: 4, attack: 4 },
    ],
  },

  {
    id: 'plague_moth',
    icon: '蛾',
    iconImage: 'assets/enemies/plague-moth.png',
    iconScale: 'large',
    spawnSfx: 'plagueMothSpawn',
    spawnSfxVolume: 0.5,
    tier: 'weak',
    tierUpDays: 3,
    weakness: 2,
    weaknessEffect: { type: 'poison_weaken', desc: '毒粉潰散，本場戰鬥毒粉傷害 -1' },
    abilities: [{ type: 'poison_dust', weakenReduction: 1 }],
    attackTrail: 'poison_cloud',
    attackSfx: 'plagueMothSpawn',
    attackSfxVolume: 0.32,
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
    icon: '骸',
    iconImage: 'assets/enemies/rot-knight.png',
    iconFlipX: true,
    iconScale: 'large',
    spawnSfx: 'rotKnightSpawnRoar',
    spawnSfxVolume: 0.58,
    tier: 'medium',
    tierUpDays: 6,
    weakness: 4,
    weaknessEffect: { type: 'block_break', desc: '盔甲破碎，暫時無法格檔，直到我方下一回合結束' },
    abilities: [{ type: 'block_thorns' }],
    attackTrail: 'slash',
    attackTrailFamily: 'sword',
    attackSfx: 'swordWoosh',
    attackSfxVolume: 0.44,
    nightOnly: false,
    lore: '有人說它們曾經是守衛，是黑夜將它們留下，讓它們繼續站崗。',
    intents: [
      { type: 'block',  weight: 2 },
      { type: 'attack', weight: 3 },
    ],
    tiers: [
      { name: '腐骨騎士', desc: '腐爛的盔甲仍然堅固，硬砍格檔會受到反震',           hp: 28, block: 3, attack: 4, thornDamage: 2 },
      { name: '黑鐵騎士', desc: '黑暗強化了甲冑，格檔幾乎成為本能',                 hp: 36, block: 4, attack: 5, thornDamage: 2 },
      { name: '深淵騎士', desc: '已與黑暗融合，盔甲是它的皮膚，格檔是它的呼吸',     hp: 45, block: 5, attack: 6, thornDamage: 3 },
    ],
  },

  {
    id: 'shadow_hunter',
    icon: '眼',
    iconImage: 'assets/enemies/shadow-hunter.png',
    iconFlipX: true,
    iconScale: 'large',
    iconSoftEdge: true,
    spawnSfx: 'shadowHunterSpawnRoar',
    spawnSfxVolume: 0.58,
    tier: 'medium',
    tierUpDays: 6,
    weakness: 1,
    weaknessEffect: { type: 'expose', duration: 2, desc: '獵人被揭露，追獵與低血增傷暫時失效 2 回合' },
    abilities: [{ type: 'blood_hunt', lowHpThreshold: 0.5, damageBonus: 1 }],
    attackTrail: 'slash',
    attackTrailFamily: 'dagger',
    attackSfx: 'daggerWoosh',
    attackSfxVolume: 0.42,
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
    name: '深污腐骰宿主',
    icon: '腐',
    cardBgImage: 'assets/enemies/dice-corruptor-bg.png',
    hideIconInCombat: true,
    spawnSfx: 'diceCorruptorSpawn',
    spawnSfxVolume: 0.64,
    tier: 'strong',
    unique: true,
    noRetreat: true,
    desc: '\u6c61\u67d3\u5df2\u6ef2\u5165\u7260\u5468\u570d\u7684\u6bcf\u4e00\u6b21\u64f2\u9ab0\u3002\u7260\u6703\u7528\u8108\u885d\u58d3\u8feb\u5168\u968a\uff0c\u4e26\u8b93\u4e3b\u6230\u8005\u7684\u9ab0\u904b\u66f4\u5feb\u88ab\u6c61\u67d3\u3002',
    hp: 108,
    block: 0,
    attack: 7,
    weakness: 3,
    weaknessEffect: { type: 'clear_dice_pollution', desc: '污染核心破裂，全隊各清除 1 個污染骰面' },
    abilities: [{ type: 'dice_pollution', heal: 7, pollutedFaceSelfDamage: 1, empoweredSelfDamage: 2, empoweredMax: 3, polluteActiveAttacker: true, extraRandomPollutions: 0, pollutePulseDamage: 1 }],
    nightOnly: false,
    lore: '\u7260\u4e0d\u541e\u98df\u8840\u8089\uff0c\u800c\u662f\u6c61\u67d3\u9ab0\u904b\u3002\u6c61\u67d3\u8108\u885d\u6703\u50b7\u5bb3\u5168\u968a\u3001\u6c61\u67d3\u4e3b\u6230\u8005\u8207\u984d\u5916\u968a\u53cb\uff1b\u64b2\u64ca\u6703\u6c61\u67d3\u88ab\u653b\u64ca\u76ee\u6a19\uff1b\u6c61\u6f6e\u6703\u6c61\u67d3\u96a8\u6a5f\u968a\u53cb\u3002',
    intents: [
      { type: 'pollute', weight: 1 },
    ],
  },

  {
    id: 'cage_warden',
    name: '囚籠看守',
    icon: '守',
    cardBgImage: 'assets/enemies/cage-warden.png',
    mapIconImage: 'assets/ui/cage-warden-map.png',
    hideIconInCombat: true,
    desc: '拖著鏽鐵鑰匙的看守，身後傳來被囚者的低聲呼救。若拖得太久，牠會處刑牢中的倖存者。',
    hp: 36,
    block: 3,
    attack: 5,
    weakness: 5,
    weaknessEffect: { type: 'block_break', desc: '鑰匙束被擊落，看守暫時無法格檔，直到我方下一回合結束，處刑倒數 +1' },
    nightOnly: false,
    boss: true,
    rescueBoss: true,
    abilities: [{ type: 'execution_countdown', turns: 5, delayOnBreak: 1 }],
    lore: '它不像在巡邏，更像是在清點還活著的人。',
    intents: [
      { type: 'attack',       weight: 3 },
      { type: 'block_attack', weight: 1 },
    ],
  },

  {
    id: 'abyss_warden',
    name: '黑暗化身',
    icon: '夜',
    iconImage: 'assets/enemies/dark-avatar-combat.png',
    cardBgImage: 'assets/enemies/dark-avatar-card-bg.png',
    iconScale: 'large',
    attackTrail: 'dark_avatar',
    attackSfx: 'darkMonsterGrowl',
    attackSfxVolume: 0.36,
    desc: '只在黑夜中現身的黑暗化身。牠會隨黑暗層數強化，但生成後不再依天數升階。',
    hp: 30,
    block: 4,
    attack: 3,
    damageDieSides: 3,
    weakness: 6,
    weaknessEffect: { type: 'weaken_next_attack', amount: 1, desc: '黑霧裂解，此擊無視格檔，且黑暗化身下一次攻擊 -1' },
    nightOnly: true,
    darkMonsterBase: true,
    lore: '沒有人知道它來自哪裡。有人說黑夜本身就是它的家。黑暗化身生成時會依當下黑暗層數決定強度：每 1 層黑暗使生命 +10%；每 6 層黑暗使攻擊 +1。生成後不會因黑暗繼續上升而即時變強。',
    intents: [
      { type: 'attack', weight: 4 },
      { type: 'block',  weight: 1 },
    ],
  },

  {
    id: 'treasure_mimic',
    name: '寶箱擬態怪',
    icon: '▣',
    cardBgImage: 'assets/enemies/treasure-mimic.png',
    hideIconInCombat: true,
    spawnSfx: 'mimicSpawnGrowl',
    spawnSfxVolume: 0.56,
    deathSfx: 'mimicDeathCrateBreak',
    deathSfxVolume: 0.58,
    attackTrail: 'jaw_bite',
    attackSfx: 'mimicSpawnGrowl',
    attackSfxVolume: 0.34,
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
    id: 'dark_gift_mimic',
    name: '黑匣擬態',
    icon: '◈',
    cardBgImage: 'assets/enemies/dark-gift-mimic.png',
    hideIconInCombat: true,
    spawnSfx: 'mimicSpawnGrowl',
    spawnSfxVolume: 0.56,
    deathSfx: 'mimicDeathCrateBreak',
    deathSfxVolume: 0.58,
    attackTrail: 'jaw_bite',
    attackSfx: 'mimicSpawnGrowl',
    attackSfxVolume: 0.34,
    desc: '黑暗贈禮寶箱裡蜷伏的怪物。它的鎖孔每次遭遇都會換一個原生弱點，若以天然骰面命中原生弱點，箱體會直接開啟。',
    hp: 42,
    block: 6,
    attack: 4,
    weakness: 1,
    weaknessEffect: { type: 'fear', desc: '鎖孔鬆動，此擊無視格檔' },
    nightOnly: false,
    boss: true,
    darkGiftMimic: true,
    lore: '它不是寶箱被怪物占據，而是黑暗學會了偽裝成獎賞。',
    intents: [
      { type: 'block',        weight: 2 },
      { type: 'block_attack', weight: 2 },
      { type: 'attack',       weight: 3 },
    ],
  },

  {
    id: 'echo_guardian_wound',
    name: '痛痕守護者',
    icon: '血',
    cardBgImage: 'assets/enemies/wound-guardian-bg.png',
    hideIconInCombat: true,
    desc: '共鳴遺址中的守護者，身上纏滿不會癒合的黑色傷痕。',
    hp: 110,
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
    icon: '鏡',
    cardBgImage: 'assets/enemies/rift-gazer-bg.png',
    hideIconInCombat: true,
    desc: '共鳴遺址中的守護者，眼中浮著細碎裂光，像在等待破綻張開。',
    hp: 80,
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
    icon: '骰',
    cardBgImage: 'assets/enemies/fate-guardian-bg.png',
    hideIconInCombat: true,
    desc: '共鳴遺址中的守護者，掌心反覆滾動著沒有落點的黑骰。',
    hp: 85,
    block: 0,
    attack: 6,
    weakness: 1,
    weaknessEffect: { type: 'add_fate_unlucky', desc: '命運偏折，擲命守衛新增 1 個厄運面，最多 3 面' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'fate',
    abilities: [
      { type: 'fate_gamble', luckyMultiplier: 2, unluckySelfDamageRate: 0.25, rerollEvery: 2, maxLuckyFaces: 3, maxUnluckyFaces: 3 },
    ],
    lore: '它不預測命運，只負責讓所有結果都變得更昂貴。',
    intents: [
      { type: 'attack', weight: 1 },
    ],
  },

  {
    id: 'echo_guardian_banner',
    name: '殘旗守衛',
    icon: '旗',
    cardBgImage: 'assets/enemies/banner-guardian-bg.png',
    hideIconInCombat: true,
    desc: '共鳴遺址中的守護者，背後殘旗無風自揚，像仍在號令早已消失的軍勢。',
    hp: 90,
    block: 6,
    attack: 4,
    weakness: 3,
    weaknessEffect: { type: 'banner_interrupt', desc: '中斷當前旗面效果' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'banner',
    lore: '它守著的不是旗，而是旗倒下前最後一個命令。',
    intents: [
      { type: 'attack', weight: 1 },
    ],
    abilities: [
      { type: 'banner_guardian', woundStacks: 4, damageBonus: 3, switchBlock: 6 },
    ],
  },

  {
    id: 'echo_guardian_sword',
    name: '斷律劍衛',
    icon: '劍',
    cardBgImage: 'assets/enemies/sword-law-guardian.png',
    hideIconInCombat: true,
    desc: '共鳴遺址中的守護者，黑鐵重律與銀蜂連刺被縫在同一副鎧甲裡。',
    hp: 90,
    block: 0,
    attack: 2,
    weakness: 3,
    weaknessEffect: { type: 'reduce_sword_law_attack', amount: 1, min: 1, desc: '劍律偏移，斷律劍衛的基礎攻擊 -1，最低 1' },
    nightOnly: false,
    boss: true,
    echoGuardian: true,
    echoSystemId: 'sword',
    lore: '它不是握著劍，而是讓所有劍都服從同一條斷裂的律。',
    intents: [
      { type: 'attack', weight: 1 },
    ],
    abilities: [
      { type: 'sword_law_guardian', baseAttack: 2, lowMax: 3, growMin: 4, growAmount: 1, minBaseAttack: 1 },
    ],
  },

  {
    id: 'night_heart',
    name: '夜幕之瞳',
    icon: '夜',
    cardBgImage: 'assets/enemies/night-eye-bg.png',
    hideIconInCombat: true,
    desc: '第 20 天黎明前，夜幕之瞳在黑霧深處睜開。它閉眼時遮蔽自身弱點並凝成格檔，開眼時露出一瞬破綻，隨後降下足以奪命的黑光。',
    hp: 90,
    block: 0,
    attack: 3,
    weakness: null,
    weaknessEffect: { type: 'final_dawn_break', desc: '短暫破曉：下一次閉眼不獲得格檔，下一次開眼攻擊不造成濺射' },
    nightOnly: false,
    boss: true,
    finalBoss: true,
    noRetreat: true,
    lore: '那不是怪物的眼睛，而是黑夜本身第一次注視你們。',
    abilities: [
      {
        type: 'final_boss',
        hpPerDarkness: 5,
        attackPerDarkness: 5,
        closedBlock: 6,
        splashDamage: 1,
        blockPierceDamage: 3,
        darknessTiers: [
          { minDarkness: 10, hpBonus: 20, closedBlock: 8, splashDamage: 2, blockPierceDamage: 4 },
          { minDarkness: 15, hpBonus: 50, closedBlock: 10, splashDamage: 2, blockPierceDamage: 6, eyeDamageBonus: 1 },
          { minDarkness: 19, hpBonus: 90, closedBlock: 12, splashDamage: 3, blockPierceDamage: 8, eyeDamageBonus: 2, blackLightDamage: 1 },
        ],
      },
    ],
    intents: [
      { type: 'attack', weight: 1 },
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
    canRetreat: true,
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
  const commonCardBg = ['weak', 'medium'].includes(base.tier)
    ? 'assets/enemies/common-monster-card-bg.png'
    : null;
  return {
    ...base,
    ...base.tiers[idx],
    cardBgImage: base.cardBgImage || commonCardBg,
    tiers: undefined,
    tierStageIndex: idx,
    tierStageCount: base.tiers.length,
    tierResolvedDay: day,
  };
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
  const weakDie = ['weak', 'medium'].includes(enemy?.tier);
  const attackText = weakDie ? `${atk}+骰` : `${atk}`;
  const diceText = weakDie ? `${atk > 0 ? `${atk}+` : ''}骰 傷害（三面骰）` : '骰數傷害';
  switch (intent.type) {
    case 'attack':       return `攻擊主戰者　${attackText} 傷`;
    case 'block':        return `格檔　+${blk}`;
    case 'block_attack': return `格檔 +${blk}，攻擊主戰者 ${attackText} 傷`;
    case 'aoe':          return `全體攻擊　各 ${aoe} 傷`;
    case 'dice_attack':  return `擲骰攻擊　${diceText}`;
    case 'worm_coil':    return '蜷縮蓄勢　格檔 +2，下次攻擊 +1';
    case 'pollute':      return '污染 1 名隊友的骰面';
    case 'idle':         return '… 不攻擊';
    default:             return '未知意圖';
  }
}

// ── 查詢 ──────────────────────────────────────────────────────
function getEnemyById(id) {
  return ENEMIES.find(e => e.id === id) || null;
}

function getFinalBossEnemy(darkness = null) {
  const boss = getEnemyById('night_heart');
  if (!boss) return null;
  const value = Math.max(0, Math.floor(Number.isFinite(darkness) ? darkness : ((typeof G !== 'undefined' && G?.darkness) || 0)));
  const ability = Array.isArray(boss.abilities) ? boss.abilities.find(item => item?.type === 'final_boss') : null;
  const tier = finalBossDarknessTier(ability, value);
  const hpPerDarkness = Math.max(0, ability?.hpPerDarkness ?? 5);
  return {
    ...boss,
    hp: (boss.hp || 1) + value * hpPerDarkness + Math.max(0, tier?.hpBonus || 0),
    attack: (boss.attack || 0) + Math.floor(value / 5),
    finalBossDarkness: value,
    finalBossPrescaled: true,
  };
}

function finalBossDarknessTier(ability, darkness = 0) {
  const tiers = Array.isArray(ability?.darknessTiers) ? ability.darknessTiers : [];
  const available = tiers
    .filter(tier => Math.max(0, tier?.minDarkness || 0) <= darkness)
    .sort((a, b) => Math.max(0, a.minDarkness || 0) - Math.max(0, b.minDarkness || 0));
  return available.length > 0 ? available[available.length - 1] : null;
}

function getDarkMonsterEnemy(darkness = null) {
  const base = getEnemyById('abyss_warden');
  if (!base) return randomEnemyForDay(true);
  const value = Math.max(0, Math.floor(Number.isFinite(darkness) ? darkness : ((typeof G !== 'undefined' && G?.darkness) || 0)));
  const hpMultiplier = 1 + value * 0.1;
  const attackBonus = Math.floor(value / 6);
  return {
    ...base,
    hp: Math.max(1, Math.round((base.hp || 1) * hpMultiplier)),
    maxHp: Math.max(1, Math.round((base.hp || 1) * hpMultiplier)),
    attack: (base.attack || 0) + attackBonus,
    darkMonsterLevel: value,
    darkMonsterHpMultiplier: hpMultiplier,
    darkMonsterAttackBonus: attackBonus,
  };
}

function getDayEnemies() {
  return ENEMIES.filter(e => !e.nightOnly);
}

function getNightEnemies() {
  return ENEMIES;
}

function randomEnemyForDay(isNight, dayOverride = null) {
  const day = dayOverride || (typeof G !== 'undefined' && G?.day) || 1;
  const baseTiers = day <= 3 ? ['weak'] : ['weak', 'medium'];
  const source = isNight ? getNightEnemies() : getDayEnemies();
  const pool = source
    .filter(e => !e.boss && !e.rescueBoss)
    .filter(e => baseTiers.includes(e.tier));
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

function getTreasureMimicEnemy() {
  const mimic = ENEMIES.find(e => e.treasureMimic);
  return mimic ? { ...mimic } : randomEnemy(false);
}

function getDarkGiftMimicEnemy() {
  const mimic = ENEMIES.find(e => e.darkGiftMimic);
  const enemy = mimic ? { ...mimic } : getTreasureMimicEnemy();
  enemy.weakness = Dice.rollRaw();
  return enemy;
}

function getEchoGuardianEnemy(systemId) {
  const guardian = ENEMIES.find(e => e.echoGuardian && e.echoSystemId === systemId);
  const fallback = ENEMIES.find(e => e.echoGuardian);
  return guardian ? { ...guardian } : (fallback ? { ...fallback } : randomEnemy(false));
}

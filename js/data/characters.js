// 職業定義
const CHARACTER_CLASSES = {
  warrior: {
    id: 'warrior',
    name: '戰士',
    icon: '⚔️',
    desc: '血厚且擅長正面戰鬥，戰鬥骰有較高下限。',
    maxHp: 26,
    attack: 5,
    passive: 'combat_floor',
    passiveDesc: '戰鬥骰最低視為 3。主戰攻擊後，依最終骰面準備下回合格檔：獲得最終骰面一半（向上取整）的格檔，最多 4 點。準備中的格檔會在下一回合開始時生效',
  },
  explorer: {
    id: 'explorer',
    name: '探索者',
    icon: '🧭',
    desc: '善於觀察敵人的破綻，能把一次失手轉成下一次機會。',
    maxHp: 20,
    attack: 3,
    passive: 'suspicious_flaw',
    passiveDesc: '主戰未命中原生弱點後標記可疑弱點；之後差 1 命中原生弱點時可消耗，視為命中。每個我方攻擊回合結束準備 10% 閃避率，下一回合開始生效；若探索者主戰，額外準備最終骰面 x3% 閃避率，最多 50%。受擊時依閃避率判定，成功免傷，失敗則每 10% 傷害 -1；受擊後歸 0',
  },
  scholar: {
    id: 'scholar',
    name: '搏命者',
    icon: '🎲',
    desc: '以命運為賭注，能用骰面改寫敵人的破綻。',
    maxHp: 20,
    attack: 4,
    passive: 'gambler_attack',
    passiveDesc: '\u4e3b\u6230\u653b\u64ca\u6642\uff0c\u55ae\u6578\u8996\u70ba\u547d\u4e2d\u7834\u7dbb\uff0c\u4e26\u5237\u65b0\u6575\u4eba\u7834\u7dbb\u4e14\u672c\u6b21\u50b7\u5bb3 +1\uff1b\u96d9\u6578\u7372\u5f97 1 \u5c64\u53cd\u566c\uff0c\u4e0b\u4e00\u6b21\u53d7\u64ca\u6d41\u7a0b\u53d7\u5230\u7684\u50b7\u5bb3\u6bcf\u5c64 +20%\uff0c\u6700\u591a 2 \u5c64\uff0c\u89f8\u767c\u5f8c\u6e05\u7a7a\u3002\u6230\u9b25\u4e2d\u5be6\u969b\u640d\u5931 HP \u5f8c\uff0c\u4e0b\u56de\u5408\u7372\u5f97\u640d\u5931 HP x2 \u7684\u683c\u6a94',
  },
  support: {
    id: 'support',
    name: '輔助',
    icon: '✚',
    desc: '維持隊伍生存，在戰鬥中替傷勢最危急的隊友穩住局面。',
    maxHp: 18,
    attack: 2,
    passive: 'team_heal',
    passiveDesc: '我方攻擊回合結束時，若輔助存活，治療目前 HP 百分比最低的一名存活隊友 1 HP；若輔助是主戰者，改為治療最低兩名隊友各 1 HP。觸發後輔助仇恨 +1',
  },
};

const CHARACTER_POOL = [
  { name: '老韋', cls: 'warrior', flavor: '曾是邊境守衛，沉默寡言。' },
  { name: '林葭', cls: 'explorer', flavor: '熟悉荒野與廢墟，總能找到還能走的路。' },
  { name: '陳書明', cls: 'scholar', flavor: '把命運當作骰局，笑著走向最壞的結果。' },
  { name: '小慈', cls: 'support', flavor: '在黑暗裡維持火光，也維持眾人的呼吸。' },
];

const CLASS_FIXED_CHARACTER = {
  warrior:  CHARACTER_POOL.find(c => c.cls === 'warrior'),
  explorer: CHARACTER_POOL.find(c => c.cls === 'explorer'),
  scholar:  CHARACTER_POOL.find(c => c.cls === 'scholar'),
  support:  CHARACTER_POOL.find(c => c.cls === 'support'),
};

const CLASS_PORTRAITS = {
  warrior: 'assets/portraits/warrior-laowei.png',
  explorer: 'assets/portraits/explorer-linjia.png',
  scholar: 'assets/portraits/scholar-chenshuming.png',
  support: 'assets/portraits/support-xiaoci.png',
};

const CLASS_AVATARS = {
  warrior: 'assets/portraits/avatar-warrior-laowei.png',
  explorer: 'assets/portraits/avatar-explorer-linjia.png',
  scholar: 'assets/portraits/avatar-scholar-chenshuming.png',
  support: 'assets/portraits/avatar-support-xiaoci.png',
};

const CLASS_BATTLE_ART = {
  warrior: 'assets/portraits/battle-warrior.png',
  explorer: 'assets/portraits/battle-explorer.png',
  scholar: 'assets/portraits/battle-scholar.png',
  support: 'assets/portraits/battle-support.png',
};

const CLASS_DEATH_SFX = {
  warrior: 'warriorDeath',
  explorer: 'explorerDeath',
  scholar: 'scholarDeath',
  support: 'supportDeath',
};

const _CLASS_DEFAULT_WEAPON = {
  warrior: 'sword',
  explorer: 'bow',
  scholar:  'dagger',
  support:  'battle_drum',
};

const _CLASS_DEFAULT_GEAR = {
  warrior: null,
  explorer: null,
  scholar:  null,
  support:  null,
};

function _defaultWeapon(cls) {
  const id = _CLASS_DEFAULT_WEAPON[cls];
  return id ? { ...WEAPONS.find(w => w.id === id) } : null;
}

function _defaultGear(cls) {
  const id = _CLASS_DEFAULT_GEAR[cls];
  return id ? { ...GEARS.find(g => g.id === id) } : null;
}

function createCharacter(name, cls, id) {
  const classDef = CHARACTER_CLASSES[cls];
  return {
    id: id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    cls,
    hp: classDef.maxHp,
    maxHp: classDef.maxHp,
    attack: classDef.attack,
    dead: false,
    deathLocation: null,
    relic: null,
    fusedRelic: null,
    equipment: [],
    weapon: _defaultWeapon(cls),
    gear: _defaultGear(cls),
    portrait: CLASS_PORTRAITS[cls] || '',
    avatar: CLASS_AVATARS[cls] || '',
    battleArt: CLASS_BATTLE_ART[cls] || '',
    deathSfx: CLASS_DEATH_SFX[cls] || '',
    flavor: '',
    firstAidUsed: false,
    safeMoveUsed: false,
    gamblerRerollsLeft: cls === 'scholar' ? 2 : 0,
    _ironShardUsed: false,
    _block: 0,
  };
}

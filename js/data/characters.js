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
    passiveDesc: '戰鬥骰最低 3',
  },
  explorer: {
    id: 'explorer',
    name: '探索者',
    icon: '🧭',
    desc: '善於觀察敵人的破綻，能把一次失手轉成下一次機會。',
    maxHp: 20,
    attack: 3,
    passive: 'suspicious_flaw',
    passiveDesc: '主戰未命中原生弱點後標記可疑弱點；之後差 1 命中原生弱點時可消耗，視為命中',
  },
  scholar: {
    id: 'scholar',
    name: '搏命者',
    icon: '🎲',
    desc: '以命運為賭注，能用骰面改寫敵人的破綻。',
    maxHp: 20,
    attack: 4,
    passive: 'gambler_attack',
    passiveDesc: '主戰攻擊時，單數刷新敵人破綻且本次傷害 +1；雙數獲得 1 層反噬，下一次受擊流程受到的傷害每層 +20%，最多 3 層，觸發後清空',
  },
  support: {
    id: 'support',
    name: '輔助',
    icon: '✚',
    desc: '維持隊伍生存，每日恢復並降低失敗傷害。',
    maxHp: 18,
    attack: 2,
    passive: 'tactical_support',
    passiveDesc: '若輔助不是主戰者，主戰者本回合第一次攻擊傷害 +1；若主戰者本回合受到敵人攻擊，該次傷害 -1',
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
    flavor: '',
    firstAidUsed: false,
    safeMoveUsed: false,
    gamblerRerollsLeft: cls === 'scholar' ? 2 : 0,
    _ironShardUsed: false,
    _block: 0,
  };
}

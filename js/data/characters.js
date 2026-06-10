// 職業定義
const CHARACTER_CLASSES = {
  warrior: {
    id: 'warrior',
    name: '戰士',
    icon: '戰',
    desc: '血厚且擅長正面戰鬥，戰鬥骰有較高下限。',
    maxHp: 28,
    attack: 4,
    passive: 'combat_floor',
    passiveShort: '戰鬥保底；下回合格檔',
    passiveSections: [
      { type: 'combat', label: '戰鬥被動', text: '戰鬥骰最低視為 3。' },
      { type: 'defense', label: '防禦被動', text: '主戰攻擊後，依最終骰面準備下回合格檔：獲得最終骰面一半（向上取整）的格檔，最多 4 點。準備中的格檔會在下一回合開始時生效。' },
    ],
    passiveDesc: '戰鬥骰最低視為 3。主戰攻擊後，依最終骰面準備下回合格檔：獲得最終骰面一半（向上取整）的格檔，最多 4 點。準備中的格檔會在下一回合開始時生效',
  },
  explorer: {
    id: 'explorer',
    name: '探索者',
    icon: '探',
    desc: '善於觀察敵人的破綻，能把一次失手轉成下一次機會。',
    maxHp: 22,
    attack: 3,
    passive: 'suspicious_flaw',
    passiveShort: '可疑弱點；視野與閃避',
    passiveSections: [
      { type: 'combat', label: '戰鬥被動', text: '主戰未命中原生弱點後標記可疑弱點；之後差 1 命中原生弱點時可消耗，視為命中。' },
      { type: 'defense', label: '防禦被動', text: '每個我方攻擊回合結束準備 10% 閃避率，下一回合開始生效；若探索者主戰，額外準備最終骰面 x3% 閃避率，最多 50%。受擊時依閃避率判定，成功免傷，失敗則每 10% 傷害 -1；受擊後歸 0。' },
      { type: 'map', label: '地圖被動', text: '探索者擔任探索骰時，探索骰最低視為 3；隊伍中有探索者時，地圖視野 +1。' },
    ],
    passiveDesc: '主戰未命中原生弱點後標記可疑弱點；之後差 1 命中原生弱點時可消耗，視為命中。每個我方攻擊回合結束準備 10% 閃避率，下一回合開始生效；若探索者主戰，額外準備最終骰面 x3% 閃避率，最多 50%。受擊時依閃避率判定，成功免傷，失敗則每 10% 傷害 -1；受擊後歸 0。探索者擔任探索骰時，探索骰最低視為 3；隊伍中有探索者時，地圖視野 +1',
  },
  scholar: {
    id: 'scholar',
    name: '搏命者',
    icon: '命',
    desc: '以命運為賭注，能用骰面改寫敵人的破綻。',
    maxHp: 22,
    attack: 5,
    passive: 'gambler_attack',
    passiveShort: '單數破綻；壞命重擲',
    passiveSections: [
      { type: 'combat', label: '戰鬥被動', text: '主戰攻擊時，單數視為命中破綻並刷新敵人破綻，本次傷害 +2；骰面 1 獲得 1 層反噬，骰面 6 傷害 +6，並清除自身反噬。' },
      { type: 'defense', label: '防禦被動', text: '受擊流程受到的傷害每層反噬 +20%，最多 2 層，持續到戰鬥結束。戰鬥中實際損失 HP 後，下回合獲得損失 HP x2 的格檔。' },
      { type: 'map', label: '地圖被動', text: '每天第一次探索骰將進入壞結果時，若搏命者 HP 大於 1，自動重擲並接受新結果，觸發時搏命者 -1 HP。' },
    ],
    passiveDesc: '主戰攻擊時，單數視為命中破綻並刷新敵人破綻，本次傷害 +2；骰面 1 獲得 1 層反噬，受擊流程受到的傷害每層 +20%，最多 2 層，持續到戰鬥結束；骰面 6 傷害 +6，並清除自身反噬。每天第一次探索骰將進入壞結果時，若搏命者 HP 大於 1，自動重擲並接受新結果，觸發時搏命者 -1 HP。戰鬥中實際損失 HP 後，下回合獲得損失 HP x2 的格檔',
  },
  support: {
    id: 'support',
    name: '輔助',
    icon: '輔',
    desc: '維持隊伍生存，在戰鬥中替傷勢最危急的隊友穩住局面。',
    maxHp: 20,
    attack: 2,
    passive: 'team_heal',
    passiveShort: '救急治療；休息照護',
    passiveSections: [
      { type: 'combat', label: '戰鬥被動', text: '我方攻擊回合結束時，若輔助存活，治療目前 HP 百分比最低的一名存活隊友 1 HP；若輔助是主戰者，改為治療最低兩名隊友各 1 HP。觸發後輔助仇恨 +1。' },
      { type: 'map', label: '地圖被動', text: '隊伍有存活輔助時，休息點與殘火點治療額外恢復 10% 最大生命，救起角色時也額外恢復 10% 最大生命；每 5 天開始時整理 1 個草藥包，背包已滿則無法帶走。' },
    ],
    passiveDesc: '我方攻擊回合結束時，若輔助存活，治療目前 HP 百分比最低的一名存活隊友 1 HP；若輔助是主戰者，改為治療最低兩名隊友各 1 HP。觸發後輔助仇恨 +1。隊伍有存活輔助時，休息點與殘火點治療額外恢復 10% 最大生命，救起角色時也額外恢復 10% 最大生命；每 5 天開始時整理 1 個草藥包，背包已滿則無法帶走',
  },
};

function classPassiveSections(clsOrId) {
  const classDef = typeof clsOrId === 'string' ? CHARACTER_CLASSES[clsOrId] : clsOrId;
  if (!classDef) return [];
  if (Array.isArray(classDef.passiveSections) && classDef.passiveSections.length > 0) {
    return classDef.passiveSections;
  }
  return classDef.passiveDesc ? [{ type: 'general', label: '職業被動', text: classDef.passiveDesc }] : [];
}

function classPassiveDesc(clsOrId) {
  return classPassiveSections(clsOrId).map(section => `${section.label}：${section.text}`).join('\n');
}

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
    gamblerRerollsLeft: 0,
    _ironShardUsed: false,
    _block: 0,
  };
}

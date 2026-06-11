// 地形格觸發的隨機事件定義
// type: 事件類型，game.js 的 resolveEvent() 會依此分派邏輯

const EVENT_CATEGORIES = {
  1: { name: '風險事件', desc: '陷阱、受傷、迷路或危險遭遇' },
  2: { name: '資源事件', desc: '金錢、道具、補給或少量治療' },
  3: { name: '角色事件', desc: '倖存者、求援或隊員相關事件' },
  4: { name: '聖物事件', desc: '聖物、線索或交換機會' },
  5: { name: '異變事件', desc: '黑暗污染、怪物或環境異變' },
  6: { name: '筆記事件', desc: '世界筆記、敵人情報或聖物線索' },
};

const EVENT_POOL = {
  forest: [
    {
      id: 'rescue_survivor',
      name: '森林中的足跡',
      desc: '樹叢中留下新鮮足跡，旁邊有被匆忙藏起來的補給。',
      eventImage: 'assets/events/forest-footprints.png',
      type: 'supply',
      rarity: 'rare',
      category: 3,
      weight: 3,
      heal: 2,
      skipHeal: true,
      revealRescueBoss: true,
      condition: state => state?.canRevealRescueBoss?.() !== false,
    },
    {
      id: 'forest_supply',
      name: '廢棄的補給包',
      desc: '一只被遺忘的背包掛在樹枝上，裡面還有些東西。',
      eventImage: 'assets/events/forest-supply-pack.png',
      type: 'supply',
      rarity: 'common',
      category: 2,
      weight: 3,
      heal: 2,
      healTarget: 'lowest',
    },
    {
      id: 'forest_forage_path',
      name: '霧中採集路',
      desc: '樹根之間長著幾株能辨認的草藥，旁邊還有被樹葉半掩的舊布包。要拿到它們不難，但得沿著濕滑坡地繞一段路。',
      eventImage: 'assets/events/forest-forage-path.png',
      type: 'forest_forage',
      rarity: 'rare',
      category: 2,
      weight: 1,
    },
    {
      id: 'forest_ancestral_pyre',
      name: '祖靈火塘',
      desc: '熄滅已久的火塘忽然燃起一線暖光，壓住了周圍黑霧。',
      eventImage: 'assets/events/forest-ancestral-pyre.png',
      type: 'supply',
      rarity: 'epic',
      category: 2,
      weight: 1,
      maxPerRun: 1,
      heal: 2,
      darknessChange: -1,
    },
    {
      id: 'forest_trap',
      name: '絆索陷阱',
      desc: '腳下突然收緊——有人布置了陷阱。',
      eventImage: 'assets/events/forest-snare-trap.png',
      type: 'trap',
      rarity: 'common',
      category: 1,
      weight: 1,
      diceType: 'explore',
      successMin: 4,
      failDamage: 3,
      successDesc: '探索者及時察覺，輕鬆脫身。',
      failDesc: '陷阱觸發，有人受傷了。',
      choiceTrap: true,
      noForceTrap: true,
      detourActionCost: 1,
      detourTrapLabel: '繞開絆索',
      detourDesc: '你們停下腳步，沿著樹叢邊緣慢慢繞開繃緊的繩索。',
    },
    {
      id: 'forest_mire',
      name: '吞腳泥潭',
      desc: '潮濕落葉底下不是泥地，而是一片會把靴底慢慢吞下去的黑泥。',
      eventImage: 'assets/events/swallowing-mud.png',
      type: 'trap',
      rarity: 'common',
      category: 1,
      weight: 0.25,
      maxPerRun: 1,
      fixedTrap: true,
      actionCost: 1,
      fixedResultText: '你們花了不少時間把人和行囊從泥裡拖出來。',
    },
    {
      id: 'forest_inscription',
      name: '樹幹上的刻字',
      desc: '有人在樹幹上刻了幾行字，刻痕沿著年輪彎曲，像是在標記某個古老方位。',
      eventImage: 'assets/events/forest-inscription.png',
      type: 'note',
      rarity: 'common',
      category: 6,
      weight: 2,
      noteText: '「三棵交叉的枯樹不是路標，而是神壇的柱影。沿根系最冷的方向走，會找到仍在沉默的古老儀式。」',
      revealAltarClue: true,
      altarClueChance: 0.6,
      condition: state => state?.canRevealAltarClue?.() !== false,
    },
    {
      id: 'forest_relic_roots',
      name: '樹根下的硬物',
      desc: '盤根錯節的老樹下，泥土裡露出一角不屬於森林的東西。',
      type: 'find_relic',
      rarity: 'epic',
      category: 4,
      weight: 0.2,
      condition: state => state?.canFindEventRelic?.() !== false,
    },
    {
      id: 'forest_dark_growth',
      name: '黑色菌絲',
      desc: '樹幹上的黑色菌絲忽然收縮，像嗅到活人的氣味。腐爛的木皮裂開，藏在林間的東西正被你們驚醒。',
      eventImage: 'assets/events/forest-dark-growth.png',
      eventSfx: 'forestDarkGrowth',
      eventSfxVolume: 0.34,
      type: 'combat',
      rarity: 'rare',
      category: 5,
      weight: 2,
    },
  ],

  ruins: [
    {
      id: 'ruins_relic',
      name: '廢墟的角落',
      desc: '廢棄建物的角落，磚縫中隱約有什麼在閃光。',
      type: 'find_relic',
      rarity: 'epic',
      category: 4,
      weight: 0.2,
      condition: state => state?.canFindEventRelic?.() !== false,
    },
    {
      id: 'ruins_enemy',
      name: '廢墟中的響動',
      desc: '碎石在腳下滾落，聲音沿著半塌的牆面傳進黑暗。廢墟深處有什麼被驚醒了，低沉的嘶吼正朝你們逼近。',
      eventImage: 'assets/events/ruins-enemy.png',
      eventSfx: 'ruinsEnemy',
      eventSfxVolume: 0.36,
      type: 'combat',
      rarity: 'rare',
      category: 5,
      weight: 3,
    },
    {
      id: 'ruins_inscription',
      name: '殘破的告示牌',
      desc: '一塊幾乎腐朽的木板斜靠在廢墟邊，刻痕被黑霧磨得模糊，只剩幾行仍能辨認。',
      eventImage: 'assets/events/ruins-inscription.png',
      type: 'note',
      rarity: 'common',
      category: 6,
      weight: 2,
      noteText: '「舊神壇仍在邊境深處沉默。凡帶著聖物者，皆可向它請求一次古老的融合。」',
      revealAltarClue: true,
      altarClueChance: 0.6,
      condition: state => state?.canRevealAltarClue?.() !== false,
    },
    {
      id: 'ruins_trap',
      name: '不穩的地板',
      desc: '腳下的木板先是輕輕下沉，接著裂縫像黑線一樣往四周爬開。下方傳來空洞回音，整片地板正在崩塌。',
      eventImage: 'assets/events/ruins-unstable-floor.png',
      type: 'trap',
      rarity: 'rare',
      category: 1,
      weight: 1,
      diceType: 'explore',
      successMin: 4,
      failDamage: 4,
      successDesc: '安全通過。',
      failDesc: '地板碎裂，有人墜落受傷。',
      choiceTrap: true,
      choiceTrapLabel: '小心退後',
      forceTrapLabel: '強行跨越',
      forceDamage: 3,
      detourActionCost: 1,
      detourTrapLabel: '從側牆繞過',
      detourDesc: '你們放棄穿越即將崩塌的地板，沿著殘牆外側繞了一大圈。',
      forceDesc: '你們沒有時間慢慢尋找安全落腳點。\n\n眾人壓低身體，踩著即將崩塌的木板與碎石快速穿過。腳下接連傳來斷裂聲，尖銳碎片劃過小腿與手臂。\n\n地板最終在身後塌陷，但你們已經越過危險區域。\n\n全隊受到 3 點陷阱傷害，直接通過。',
    },
    {
      id: 'ruins_falling_debris',
      name: '落石碎瓦',
      desc: '頭頂傳來細碎聲響，半塌的樑柱突然鬆動，碎瓦像雨一樣砸落。',
      eventImage: 'assets/events/ruins-falling-debris.png',
      type: 'trap',
      rarity: 'rare',
      category: 1,
      weight: 1,
      fixedTrap: true,
      partyDamage: 1,
      fixedResultText: '你們來不及完全避開，只能低頭護住要害衝過去。',
    },
    {
      id: 'ruins_supply_cache',
      name: '半塌的倉庫',
      desc: '一間倉庫只剩半面牆，但角落裡似乎還壓著能用的補給。',
      eventImage: 'assets/events/ruins-supply-cache.png',
      type: 'supply',
      rarity: 'rare',
      category: 2,
      weight: 2,
      heal: 2,
    },
    {
      id: 'ruins_old_shrine',
      name: '守夜殘壇',
      desc: '斷裂的石壇刻著褪色星芒，底下仍有守夜餘燼微微發亮，短暫壓住周圍翻湧的黑霧。',
      eventImage: 'assets/events/ruins-old-shrine.png',
      type: 'note',
      rarity: 'epic',
      category: 6,
      weight: 1,
      maxPerRun: 1,
      noteText: '你們點燃餘燼，黑暗短暫退去。',
      darknessChange: -1,
      purificationRoll: true,
      revealAltarClue: true,
      altarClueChance: 0.8,
      condition: state => (state?.canRevealAltarClue?.() !== false) || ((state?.darkness || 0) > 0),
    },
    {
      id: 'ruins_wounded_stranger',
      name: '牆後的刻痕',
      desc: '廢墟牆後有新刻下的求救記號，但人已經被什麼東西拖走了。',
      eventImage: 'assets/events/ruins-wall-marks.png',
      type: 'note',
      rarity: 'rare',
      category: 3,
      weight: 1,
      noteText: '「他們把還活著的人帶往鐵籠。守衛比普通怪物更難纏。」',
      revealRescueBoss: true,
      revealIfNoRescue: 1,
      condition: state => state?.canRevealRescueBoss?.() !== false,
    },
  ],

  cave: [
    {
      id: 'cave_enemy',
      name: '黑暗中的眼睛',
      desc: '火光照不到的裂縫裡亮起一排濕冷的眼睛。石壁傳來細碎爬行聲，某個東西正沿著黑暗貼近你們。',
      eventImage: 'assets/events/cave-eyes.png',
      eventSfx: 'caveEyes',
      eventSfxVolume: 0.35,
      type: 'combat',
      rarity: 'rare',
      category: 5,
      weight: 4,
      winSmallReward: true,
    },
    {
      id: 'cave_relic',
      name: '石縫中的遺留物',
      desc: '洞穴的石壁深處，有什麼東西被小心地塞進去。',
      type: 'find_relic',
      rarity: 'epic',
      category: 4,
      weight: 0.2,
      condition: state => state?.canFindEventRelic?.() !== false,
    },
    {
      id: 'cave_dark_trap',
      name: '洞穴迷失',
      desc: '火把的光被潮濕石壁吞沒，前方只剩一片濃黑。你們沿著回音摸索前進，直到腳下忽然踩空，有人重重摔進看不見的凹陷裡。',
      eventImage: 'assets/events/cave-dark-trap.png',
      type: 'trap',
      rarity: 'common',
      category: 1,
      weight: 1,
      diceType: 'explore',
      successMin: 3,
      failDamage: 4,
      failDarknessChange: 1,
      successDesc: '憑直覺找到了出口，有驚無險。',
      failDesc: '在黑暗中跌落，有人重重摔傷。',
      choiceTrap: true,
      choiceTrapLabel: '摸索前進',
      forceTrapLabel: '強行穿過',
      forceDamage: 2,
      detourActionCost: 1,
      detourTrapLabel: '退回找路',
      detourDesc: '你們退回還能辨認方向的岔口，重新摸索另一條通道。',
      forceDesc: '你們不再試圖辨認方向，而是互相抓住衣角，硬是穿過漆黑的洞道。\n\n尖石刮過小腿，濕滑地面讓幾個人踉蹌跌撞。等到微弱光線重新出現時，每個人身上都多了些擦傷。\n\n全隊受到 2 點陷阱傷害，直接通過。',
    },
    {
      id: 'cave_razor_stone',
      name: '割腳石灘',
      desc: '洞底鋪滿薄刃般的碎石，踩上去時石片沿著靴縫割進皮肉。',
      eventImage: 'assets/events/cave-razor-stone.png',
      type: 'trap',
      rarity: 'common',
      category: 1,
      weight: 1,
      fixedTrap: true,
      targetDamage: 2,
      fixedResultText: '隊伍中最虛弱的人被迫放慢腳步，仍被碎石割傷。',
    },
    {
      id: 'cave_inscription',
      name: '洞壁上的記號',
      desc: '有人在洞壁上刻了奇怪的符號，像是某種地圖。',
      eventImage: 'assets/events/cave-inscription.png',
      type: 'note',
      rarity: 'common',
      category: 6,
      weight: 1,
      noteText: '「洞穴深處，石柱之間，藏著舊日聖物。星月不照之處，羅盤仍會顫動。」',
      revealAltarClue: true,
      altarClueChance: 0.6,
      condition: state => state?.canRevealAltarClue?.() !== false,
    },
    {
      id: 'cave_dripping_water',
      name: '地下水窪',
      desc: '岩壁上的水珠一滴一滴落下，在洞穴低處聚成一小灘水窪。\n\n水面很冷，卻沒有結冰。微弱的光在水下晃動，像是倒映著某片不存在的星空。\n\n你們蹲下檢查，確認水裡沒有黑色菌絲，也沒有腐敗的氣味。\n\n這或許不是安全的地方，但至少能讓人短暫喘一口氣。',
      eventImage: 'assets/events/cave-dripping-water.png',
      type: 'supply',
      rarity: 'rare',
      category: 2,
      weight: 1,
      heal: 2,
      healTarget: 'all',
      restPoint: true,
      secondActionAmbushChance: 0.5,
      itemRewardText: '你們沿著水窪旁的石縫翻找，發現有人曾在這裡停留。\n\n濕透的布包被壓在碎石底下，裡面還有幾件勉強能用的東西。\n\n獲得 1 個道具。',
      healRewardText: '你們在水窪旁短暫休整，冰冷的水讓傷口不再那麼灼痛。\n\n全隊恢復 2 HP。',
    },
    {
      id: 'cave_starlight_shard',
      name: '星光碎片',
      desc: '岩縫裡嵌著冷白碎晶，握在手心時黑暗退了一步。',
      eventImage: 'assets/events/cave-starlight-shard.png',
      type: 'supply',
      rarity: 'epic',
      category: 2,
      weight: 1,
      heal: 0,
      darknessChange: -1,
      purificationRoll: true,
      starlightShard: true,
    },
    {
      id: 'cave_lost_voice',
      name: '遠處的呼喊',
      desc: '洞穴深處傳來人的聲音，忽遠忽近，只留下散落的布條與火石。',
      eventImage: 'assets/events/cave-lost-voice.png',
      type: 'supply',
      rarity: 'rare',
      category: 3,
      weight: 1,
      heal: 2,
      skipHeal: true,
      healTarget: 'lowest',
      revealRescueBoss: true,
      revealIfNoRescue: 1,
      condition: state => state?.canRevealRescueBoss?.() !== false,
    },
  ],

  empty: [
    {
      id: 'empty_supply',
      name: '路旁的遺落物',
      desc: '不知是誰遺落在路邊的背包，裡面還有些用得上的東西。',
      eventImage: 'assets/events/empty-supply.png',
      type: 'supply',
      rarity: 'common',
      category: 2,
      weight: 4,
      itemOnly: true,
    },
    {
      id: 'empty_survivor_clue',
      name: '腳印與布條',
      desc: '泥地上留著新鮮腳印，旁邊撕下的布條纏在枯枝上，像是刻意留下的記號。',
      eventImage: 'assets/events/empty-survivor-clue.png',
      type: 'supply',
      rarity: 'rare',
      category: 3,
      weight: 2,
      heal: 2,
      skipHeal: true,
      revealRescueBoss: true,
      condition: state => state?.canRevealRescueBoss?.() !== false,
    },
    {
      id: 'empty_shadow_passage',
      name: '湧動的陰影',
      desc: '地面上的陰影像水面般起伏，從腳邊無聲退開，只留下刺骨的寒意。',
      eventImage: 'assets/events/empty-shadow-passage.png',
      type: 'note',
      rarity: 'rare',
      category: 1,
      weight: 2,
      noteText: '「它們已經不再等到夜裡。」記錄此異象後，黑暗 +1。',
      darknessChange: 1,
    },
    {
      id: 'empty_darkness_seep',
      name: '地面的裂縫',
      desc: '地面裂縫滲出黑霧，踏上去時有什麼沿著腳底往上蔓延。',
      eventImage: 'assets/events/empty-darkness-seep.png',
      type: 'trap',
      rarity: 'rare',
      category: 5,
      weight: 1,
      diceType: 'explore',
      successMin: 3,
      failDamage: 3,
      successDesc: '安全通過。',
      failDesc: '黑霧侵入，有人受到傷害。',
    },
    {
      id: 'empty_old_camp',
      name: '廢棄的臨時營地',
      desc: '地上還有熄滅不久的篝火痕跡，旁邊散落著幾件能用的物資。',
      eventImage: 'assets/events/empty-old-camp.png',
      type: 'supply',
      rarity: 'rare',
      category: 2,
      weight: 3,
      heal: 2,
      gambleCamp: true,
    },
    {
      id: 'empty_dark_whisper',
      name: '低語',
      desc: '什麼都沒有。但有人說他聽到了自己的名字，聲音還指向遠處某個不該出現的黑匣。',
      eventImage: 'assets/events/empty-dark-whisper.png',
      type: 'note',
      rarity: 'common',
      category: 6,
      weight: 1,
      noteText: '「黑暗記得每個進來的人的名字。」',
    },
    {
      id: 'empty_treasure_map',
      name: '藏寶圖',
      desc: '你們在泥土與碎石之間找到一張沾滿灰塵的舊地圖。圖上用褪色墨線標出某處埋藏點，但紙張已經脆得像枯葉。',
      eventImage: 'assets/events/empty-treasure-map.png',
      type: 'treasure_map',
      rarity: 'rare',
      category: 2,
      weight: 2,
      condition: state => state?.canPlaceTreasureChest?.() !== false,
    },
  ],
};

function createFateGamblingTableEvent(baseEvent = null) {
  return {
    id: 'fate_gambling_table',
    name: '命運賭桌',
    type: 'fate_table',
    rarity: 'legendary',
    condition: state => (state?.darkness || 0) >= 5
      && !state?.fateGamblingTableTriggered
      && (state?.squad || []).some(c => !c.dead && c.hp > 0)
      && (
        state?.canFindEventRelic?.() !== false ||
        (state?.squad || []).some(c => !c.dead && c.hp > 0 && c.relic && c.relic.fusable !== false && !c.fusedRelic)
      ),
    category: 6,
    categoryRoll: baseEvent?.categoryRoll || 6,
    categoryName: baseEvent?.categoryName || '特殊事件',
    categoryDesc: baseEvent?.categoryDesc || '最高稀有度的三重賭局事件。',
    eventImage: 'assets/events/fate-gambling-table.png',
    noReserve: true,
    desc: [
      '黑暗邊界的霧氣忽然安靜下來。',
      '',
      '你們在黑暗邊界看見一張老舊賭桌。桌面乾裂，邊角腐朽，卻乾淨得不像是被遺棄之物。桌中央放著一只骨骰，骰面上刻著模糊的黑色紋路，像血乾掉後留下的痕跡。',
      '',
      '隊伍停下腳步。',
      '',
      '每個人都聽見骰子在桌上輕輕滾動的聲音。',
      '',
      '可是沒有人碰它。',
      '',
      '賭桌旁沒有莊家，沒有對手，只有一張空椅子，正對著你們。',
      '',
      '黑暗中傳來低語：',
      '',
      '「押上你的命，命運才會回頭看你。」',
      '',
      '你們知道，這不是普通的賭局。',
      '這張桌子不要金幣，不要承諾，也不保證公平。',
      '',
      '它只收一樣東西。',
      '',
      '命。',
    ].join('\n'),
  };
}

function createFallenTravelerEvent() {
  return {
    id: 'fallen_traveler',
    name: '倒下的旅人',
    type: 'combat',
    rarity: 'epic',
    weight: 1,
    maxPerRun: 2,
    category: 3,
    combatEnemyResolver: 'max_medium',
    combatReward: 'fallen_traveler',
    desc: '循著微弱的氣息找去，人已經沒了呼吸。他的武器仍握在手裡，但某個東西守在屍體旁，不讓你們靠近。',
    condition: state => state?.canFindWeaponDrop?.() !== false,
  };
}

const EVENT_RARITY_WEIGHTS = {
  common: 62,
  rare: 27,
  epic: 9,
  legendary: 2,
};
const EVENT_RARITIES = ['common', 'rare', 'epic', 'legendary'];

function _rollAvailableEventRarity(candidatesByRarity) {
  const available = EVENT_RARITIES.filter(rarity => candidatesByRarity[rarity]?.length > 0);
  const total = available.reduce((sum, rarity) => sum + (EVENT_RARITY_WEIGHTS[rarity] || 0), 0);
  if (total <= 0) return available[0] || null;
  let roll = Math.random() * total;
  for (const rarity of available) {
    roll -= EVENT_RARITY_WEIGHTS[rarity] || 0;
    if (roll < 0) return rarity;
  }
  return available[available.length - 1] || null;
}

function _eventConditionPass(ev, state) {
  if (ev?.maxPerRun && (state?.eventCounts?.[ev.id] || 0) >= ev.maxPerRun) return false;
  if (!ev?.condition) return true;
  if (typeof ev.condition === 'function') return !!ev.condition(state || {});
  return true;
}

function _eventState(state = null) {
  return {
    ...(state || {}),
    squadHasRelic: id => {
      if (typeof state?.squadHasRelic === 'function') return state.squadHasRelic(id);
      return (state?.squad || []).some(c => c.relic?.id === id || c.fusedRelic?.id === id);
    },
  };
}

function _pickWeightedEvent(pool) {
  if (!pool || pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, ev) => sum + Math.max(0, ev.weight ?? 1), 0);
  if (totalWeight <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let roll = Math.random() * totalWeight;
  for (const ev of pool) {
    roll -= Math.max(0, ev.weight ?? 1);
    if (roll <= 0) return ev;
  }
  return pool[pool.length - 1];
}

function _decorateEvent(ev, rarity) {
  return {
    ...ev,
    rarity: ev.rarity || rarity || 'common',
    categoryRoll: null,
    categoryName: ({ common: '普通事件', rare: '稀有事件', epic: '史詩事件', legendary: '傳說事件' })[ev.rarity || rarity] || '事件',
    categoryDesc: ({ common: '常見的地形遭遇', rare: '較少見的地形遭遇', epic: '罕見且影響較大的遭遇', legendary: '極罕見的特殊遭遇' })[ev.rarity || rarity] || '',
  };
}

// 地形事件：先看目前地形實際可用的稀有度，再依稀有度權重抽選。
function randomTerrainEvent(terrainType, state = null) {
  const basePool = EVENT_POOL[terrainType];
  if (!basePool) return null;
  const pool = [...basePool, ..._specialTerrainEvents(terrainType)];
  const eventState = _eventState(state);
  const candidatesByRarity = {};
  for (const rarity of EVENT_RARITIES) {
    candidatesByRarity[rarity] = pool.filter(ev => (ev.rarity || 'common') === rarity && _eventConditionPass(ev, eventState));
  }
  const rarity = _rollAvailableEventRarity(candidatesByRarity);
  if (!rarity) return null;
  const picked = _pickWeightedEvent(candidatesByRarity[rarity]);
  return picked ? _decorateEvent(picked, rarity) : null;
}

function _specialTerrainEvents(terrainType) {
  const extras = [createFallenTravelerEvent()];
  if (terrainType === 'empty') extras.push(createFateGamblingTableEvent());
  return extras;
}

function randomEmptyEvent(state = null) {
  return randomTerrainEvent('empty', state);
}

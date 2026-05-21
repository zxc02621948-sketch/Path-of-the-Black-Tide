// 《黑夜邊境》— 所有平衡數值集中於此，方便調整
const CONFIG = {
  // Development helper: show advanced notes and locked rule entries for testing.
  DEV_UNLOCK_ALL_NOTES: true,

  // 地圖
  MAP_SIZE: 12,

  // 時間
  TOTAL_DAYS: 20,
  NIGHT_START_DAY: 10,
  DAWN_DAY: 20,
  ACTIONS_PER_DAY: 3,
  DARKNESS_DAILY_GAIN: 1,
  DARKNESS_BOSS_THRESHOLD: 5,
  DARKNESS_CORRUPT_THRESHOLD: 7,
  DARKNESS_MAX_THRESHOLD: 20,
  DARKNESS_DEVOUR_THRESHOLD: 20,
  DARKNESS_BOSS_MIN_DISTANCE: 5,

  // 小隊
  MAX_SQUAD_SIZE: 3,
  STARTING_SQUAD_SIZE: 2,

  // 視野 (單位：格距離，曼哈頓距離)
  DAY_VISION_RANGE: 2,
  NIGHT_VISION_RANGE: 1,
  EXPLORER_VISION_BONUS: 1,   // 探索者額外視野

  // 黑夜侵蝕已改由黑暗值、黑暗化身與尾王強化承擔壓力。
  NIGHT_END_HP_COST: 0,
  // 火把照明 (接下來幾次黑夜移動視野 +1)
  TORCH_SAFE_MOVES: 2,

  // 神壇融合
  ALTAR_SUCCESS_MIN: 4,       // 骰出 >= 此值才算成功
  ALTAR_MIN_SUCCESS_MIN: 2,

  // 戰鬥
  RETREAT_HP_COST: 1,         // 撤退時每名成員扣血
  COMBAT_RELIC_DROP_CHANCE: 0.25,
  TREASURE_MIMIC_GEAR_DROP_CHANCE: 0.50,
  TREASURE_MIMIC_WEAKNESS_GEAR_DROP_CHANCE: 0.80,
  DAY_EVENT_RELIC_DROP_CHANCE: 0.10,
  NIGHT_EVENT_RELIC_DROP_CHANCE: 0.18,
  ECHO_SITE_MIN_DAY: 3,
  ECHO_SITE_EVENT_CHANCE: 0.10,
  ECHO_SITE_MAX_ACTIVE: 3,

  // 職位骰子保底
  FLOOR_BONUS: {
    warrior:  { combat: 3 },
    explorer: { explore: 3 },
    scholar:  {},
    support:  {},              // 輔助保底透過被動處理
  },

  // 支援職被動
  SUPPORT_DAILY_HEAL: 2,      // 輔助每天為全隊回血量
  SUPPORT_FAIL_REDUCE: 1,     // 輔助降低失敗傷害
  FIRST_AID_HEAL: 2,
  BLOOD_PRICE_SHIELD: 2,

  // 探索者
  EXPLORER_RESERVE_COOLDOWN_DAYS: 5,

  // 補給
  SUPPLY_EQUIPMENT_CHANCE: 0.35,
  SUPPLY_GEAR_CHANCE: 0.15,
  CAVE_ENEMY_WIN_REWARD_CHANCE: 0.25,
  MAX_EQUIPMENT_PER_CHAR: 2,
  MAX_INVENTORY_ITEMS: 3,
  DEFAULT_SUPPLY_HEAL: 2,
  DEFAULT_TRAP_DAMAGE: 2,

  // 融合/特殊聖物加成
  FUSED_FALLEN_ECHO_EXTRA_BONUS: 2,
  FUSED_SURVIVOR_MEDAL_EXTRA_HP: 2,

  // 地圖生成格數（不得超過 MAP_SIZE * MAP_SIZE - 1 起點）
  MAP_ALTARS:      2,
  MAP_ALTAR_MIN_DISTANCE: 7,
  MAP_ALTAR_MIN_START_DISTANCE: 4,
  MAP_ALTAR_POSITIONS: [],
  MAP_REST_POINTS: 4,
  MAP_REST_MIN_DISTANCE: 4,
  REST_REFRESH_DAYS: 5,
  MAP_RELIC_SPOTS: 0,
  MAP_RELIC_MIN_DISTANCE: 5,
  MAP_RESCUE_BOSSES: 1,
  MAP_RESCUE_BOSS_MIN_DISTANCE: 5,
  MAP_ENEMY_SPOTS: 10,
  MAP_RUINS:       22,
  MAP_CAVES:       12,
  MAP_FORESTS:     28,

  // 黑夜聖物
  NIGHT_RELIC_PLACEMENT_COUNT: 2,

  // 稀有度加權（0 = 不進入隨機池）
  RARITY_WEIGHTS: {
    common: 5,
    uncommon: 3,
    rare: 1,
    legendary: 0,
  },
};
